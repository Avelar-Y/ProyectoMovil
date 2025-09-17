import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, FlatList, Modal, Pressable, ActivityIndicator, TextInput, RefreshControl } from 'react-native';
import Chip from '../components/Chip';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useRefresh } from '../contexts/RefreshContext';

// Home minimalista
export default function Home({ navigation }: any) {
  const { user, logout } = useAuth();
  const { colors } = useTheme();
  const refreshCtx = useRefresh();

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
          {item.price != null && <Text style={[styles.price, { color: colors.primary }]}>${item.price}</Text>}
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

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header minimal */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.welcome, { color: colors.muted }]}>Hola</Text>
          <Text style={[styles.appName, { color: colors.text }]} numberOfLines={1}>{user?.email?.split('@')[0] || 'Usuario'}</Text>
        </View>
        <TouchableOpacity onPress={() => setShowProfile(true)}>
          <Image source={{ uri: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png' }} style={styles.avatar} />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchBarWrapper}>
        <View style={[styles.searchBar, { backgroundColor: colors.inputBg || colors.card, borderColor: colors.border }]}> 
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
      </View>

      {/* Categories chips */}
      <FlatList
        data={categories}
        keyExtractor={c => c}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
        renderItem={({ item }) => (
          <Chip label={item} active={query === item} onPress={() => onSelectCategory(item)} variant="sm" maxWidth={140} />
        )}
      />

      {/* Services list */}
      {filtered.length === 0 ? (
        <View style={styles.emptyWrapper}>
          <Text style={{ color: colors.muted, marginBottom: 8 }}>No hay servicios que coincidan.</Text>
          <TouchableOpacity onPress={() => setQuery('')}><Text style={{ color: colors.primary }}>Limpiar búsqueda</Text></TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => i.id}
          renderItem={renderService}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          keyboardShouldPersistTaps="handled"
        />
      )}

      {/* Profile modal */}
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
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  welcome: { fontSize: 12, fontWeight: '500', letterSpacing: 0.5 },
  appName: { fontSize: 20, fontWeight: '700', maxWidth: 180 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  searchBarWrapper: { paddingHorizontal: 20, paddingBottom: 6 },
  searchBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, gap: 12 },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  chipsRow: { paddingHorizontal: 16, paddingVertical: 8 },
  chip: { },
  listContent: { paddingHorizontal: 16, paddingBottom: 40 },
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
