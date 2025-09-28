import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, FlatList, Modal, Pressable, ActivityIndicator, TextInput, RefreshControl, Share, Platform, StatusBar } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Chip from '../components/Chip'; // mantenido por si se usa en otra parte (puede quitarse si ya no se necesita)
import CategoryTabs from '../components/CategoryTabs';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useRefresh } from '../contexts/RefreshContext';
import BrandingBanner from '../components/BrandingBanner';
import { SHARE_MESSAGE } from '../branding';
import FeatureHint from '../components/FeatureHint';
import { formatMoney } from '../utils/currency';

// Home minimalista
export default function Home({ navigation }: any) {
  const { user, logout } = useAuth();
  const { colors } = useTheme();
  const refreshCtx = useRefresh();
  const insets = useSafeAreaInsets();

  const [query, setQuery] = useState('');
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showProfile, setShowProfile] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const api = await import('../services/firestoreService');
      const docs = await api.getServices();
      const mapped = docs.map((d: any) => ({
        id: d.id,
        title: d.title || d.key || 'Servicio',
        description: d.description || '',
        img: d.icon || d.img || 'https://cdn-icons-png.flaticon.com/512/854/854878.png',
        price: d.price,
        tags: Array.isArray(d.tags) ? d.tags : [],
        createdAtMillis: d.createdAt?.toMillis ? d.createdAt.toMillis() : (d.createdAtClient || null),
        raw: d,
      }));
      mapped.sort((a: any, b: any) => (b.createdAtMillis || 0) - (a.createdAtMillis || 0));
      setServices(mapped);
    } catch (e) {
      console.warn('load services error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Integración con RefreshContext global
  useEffect(() => {
    const id = 'Home';
    refreshCtx.register(id, load);
    return () => refreshCtx.unregister(id);
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return services;
    return services.filter(s => (s.title || '').toLowerCase().includes(q) || (s.description || '').toLowerCase().includes(q));
  }, [query, services]);

  const categories = useMemo(() => ([
    'Plomería', 'Electricidad', 'Limpieza', 'Mensajería', 'Jardinería', 'Reparaciones'
  ]), []);

  const onSelectCategory = (c: string) => setQuery(c);
  const onRefresh = () => { setRefreshing(true); load(); };

  const renderService = ({ item }: { item: any }) => (
    <TouchableOpacity style={[styles.card, { backgroundColor: colors.card }]} onPress={() => navigation.navigate('ServiceDetail', { service: item.raw })}>
      <Image source={{ uri: item.img }} style={styles.cardImg} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>{item.title}</Text>
        {!!item.description && <Text style={[styles.cardDesc, { color: colors.muted }]} numberOfLines={1}>{item.description}</Text>}
        <View style={styles.metaRow}>
          {item.price != null && (
            <Text style={[styles.price, { color: colors.primary }]}>
              {formatMoney(item.price, { currency: item.raw.currency || 'HNL' })}
            </Text>
          )}
          {item.createdAtMillis && <Text style={[styles.date, { color: colors.muted }]}>{new Date(item.createdAtMillis).toLocaleDateString()}</Text>}
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Altura segura superior combinando notch (iOS) o StatusBar (Android) para evitar que el banner se "pegue" arriba.
  const topSafe = insets.top || (Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0);

  return (
    <SafeAreaView style={{ flex:1, backgroundColor: colors.background }} edges={['top','left','right']}> 
      <FlatList
        data={filtered}
        keyExtractor={i=>i.id}
        renderItem={renderService}
        ListHeaderComponent={
          <View style={{ paddingTop: Math.max(10, topSafe * 0.3), paddingBottom:4 }}>
            <View style={{ paddingHorizontal:20 }}>
              <View style={styles.headerRow}> 
                <BrandingBanner variant="minimal" compact hideTagline />
                <TouchableOpacity onPress={() => setShowProfile(true)}>
                  <Image source={{ uri: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png' }} style={styles.avatar} />
                </TouchableOpacity>
              </View>
              <Text style={[styles.tagline, { color: colors.muted }]}>Resolvemos en minutos</Text>
              <View style={[styles.searchBar, { backgroundColor: colors.inputBg || colors.card, borderColor: colors.border, marginTop:10 }]}> 
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Buscar servicio"
                  placeholderTextColor={colors.muted}
                  style={[styles.searchInput, { color: colors.text }]}
                  returnKeyType="search"
                />
                {query.length > 0 && (
                  <TouchableOpacity onPress={() => setQuery('')}>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>Limpiar</Text>
                  </TouchableOpacity>
                )}
              </View>
              <View style={{ marginTop:10 }}>
                <CategoryTabs categories={categories} value={query} onChange={onSelectCategory} allowDeselect />
              </View>
              <View style={{ marginTop:10 }}>
                <FeatureHint id="home_intro" title="Encuentra y reserva" text="Explora categorías o busca directamente. Toca un servicio para ver detalles y reservar en minutos." />
              </View>
            </View>
          </View>
        }
        contentContainerStyle={[styles.listContent, filtered.length === 0 && { flexGrow:1, justifyContent:'center' }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={styles.emptyWrapper}> 
            <Text style={{ color: colors.muted, marginBottom: 8 }}>No hay servicios que coincidan.</Text>
            <TouchableOpacity onPress={() => setQuery('')}><Text style={{ color: colors.primary }}>Limpiar búsqueda</Text></TouchableOpacity>
          </View>
        }
      />
      <Modal visible={showProfile} animationType="fade" transparent onRequestClose={() => setShowProfile(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowProfile(false)}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}> 
            <Text style={[styles.modalTitle, { color: colors.text }]}>Perfil</Text>
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>{user?.email}</Text>
            <TouchableOpacity style={[styles.logoutBtn, { backgroundColor: colors.primary }]} onPress={async () => { try { await logout(); } catch(e) {} finally { setShowProfile(false); } }}> 
              <Text style={{ color: '#fff', fontWeight: '600' }}>Cerrar sesión</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowProfile(false)} style={styles.closeBtn}> 
              <Text style={{ color: colors.muted }}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerRow: { flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
  tagline: { fontSize:12, marginTop:4, fontWeight:'500', letterSpacing:0.3 },
  shareBtn: { paddingVertical:6, paddingHorizontal:12, borderRadius:10 },
  welcome: { fontSize: 12, fontWeight: '500', letterSpacing: 0.5 },
  appName: { fontSize: 20, fontWeight: '700', maxWidth: 180 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  // Reducimos padding inferior para pegar los chips al buscador
  // Quitamos paddingBottom para que los chips "toquen" visualmente el borde inferior
  searchBarWrapper: { paddingHorizontal: 20, paddingBottom: 0 },
  // Reducimos paddingVertical de 10 -> 8 para compactar altura
  searchBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, borderWidth: 1, gap: 12 },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  // Unificamos paddingHorizontal con header/buscador (20) y añadimos paddingTop mínimo para separar de tabs
  listContent: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 4 },
  card: { flexDirection: 'row', padding: 12, borderRadius: 12, marginBottom: 12, gap: 12 },
  cardImg: { width: 54, height: 54, borderRadius: 10 },
  cardTitle: { fontSize: 15, fontWeight: '600' },
  cardDesc: { fontSize: 12, marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 10 },
  price: { fontSize: 13, fontWeight: '600' },
  date: { fontSize: 11 },
  emptyWrapper: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: 24 },
  modalCard: { borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 16, fontWeight: '700' },
  logoutBtn: { marginTop: 20, paddingVertical: 12, alignItems: 'center', borderRadius: 10 },
  closeBtn: { marginTop: 12, paddingVertical: 8, alignItems: 'center' }
});
