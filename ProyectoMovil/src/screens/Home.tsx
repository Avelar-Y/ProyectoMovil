import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, FlatList, Modal, Pressable, ActivityIndicator, Alert, TextInput, Keyboard } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import CustomButton from '../components/CustomButton';
import { useTheme } from '../contexts/ThemeContext';
import { useRefresh } from '../contexts/RefreshContext';

// Versión limpia y única de Home.tsx para evitar duplicados y errores de JSX
export default function Home({ navigation }: any) {
  const { user, logout } = useAuth();
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<any>>([]);
  const [showResults, setShowResults] = useState(false);
  const [services, setServices] = useState<Array<any>>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [showProfile, setShowProfile] = useState(false);

  // Cargar servicios una sola vez (no realtime). La función loadServicesOnce
  // ya existe más abajo y también está registrada en RefreshContext.
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const docs = await (async () => {
          try {
            return await (await import('../services/firestoreService')).getServices();
          } catch (e) {
            console.warn('getServices failed, returning empty list as fallback', e);
            return [];
          }
        })();
        await loadServicesOnce();
      } catch (e) {
        console.warn('loadServicesOnce error on mount', e);
      } finally {
        if (mounted) setLoadingServices(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // register a manual reload handler for global refresh
  const refreshCtx = useRefresh();
  const loadServicesOnce = async () => {
    try {
      // use the service helper to get services and fallback client-side if needed
      const docs = await (async () => {
        try {
          return await (await import('../services/firestoreService')).getServices();
        } catch (e) {
          console.warn('getServices failed, returning empty list as fallback', e);
          return [];
        }
      })();

      const formatted = docs.map((data: any) => ({
        id: data.id,
        key: (data.key as string) || data.id,
        title: data.title || data.key || 'Servicio',
        img: data.icon || data.img || 'https://cdn-icons-png.flaticon.com/512/854/854878.png',
        price: data.price ? String(data.price) : '$',
        description: data.description || data.desc || '',
        duration: data.duration || data.time || null,
        tags: Array.isArray(data.tags) ? data.tags : [],
        createdAtMillis: data.createdAt && data.createdAt.toMillis ? data.createdAt.toMillis() : (data.createdAtClient || null),
        ...data,
      }));
      // sort by createdAtMillis desc
      formatted.sort((a: any, b: any) => (b.createdAtMillis || 0) - (a.createdAtMillis || 0));
      setServices(formatted);
      setLoadingServices(false);
    } catch (e) {
      console.warn('loadServicesOnce error', e);
    }
  };
  const loadServicesHandler = React.useCallback(async () => { await loadServicesOnce(); }, []);
  React.useEffect(() => {
    const id = 'Home';
    refreshCtx.register(id, loadServicesHandler);
    return () => refreshCtx.unregister(id);
  }, [loadServicesHandler]);

  const filteredServices = services.filter(s => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (s.title || '').toLowerCase().includes(q) || (s.key || '').toLowerCase().includes(q);
  });

  if (loadingServices) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const renderService = ({ item }: { item: any }) => (
    <TouchableOpacity style={[styles.choiceRow, { backgroundColor: colors.card }]} onPress={() => navigation.navigate('ServiceDetail', { service: item })}>
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
        <Image source={{ uri: item.img }} style={{ width: 56, height: 56, borderRadius: 8, marginRight: 12 }} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>{item.title}</Text>
          <Text numberOfLines={1} style={{ color: colors.muted, marginTop: 4, fontSize: 12 }}>{item.description || 'Descripción no disponible'}</Text>
        </View>
      </View>
      <View style={{ alignItems: 'flex-end', marginLeft: 8, justifyContent: 'center' }}>
        <Text style={{ color: colors.muted, fontSize: 12 }}>{item.createdAtMillis ? new Date(item.createdAtMillis).toLocaleDateString() : ''}</Text>
      </View>
    </TouchableOpacity>
  );

  // header and categories will be rendered above the lists to avoid TextInput inside ListHeaderComponent

  const handleSearchSubmit = () => {
    Keyboard.dismiss();
    const q = (query || '').trim();
    if (!q) {
      setShowResults(false);
      setSearchResults([]);
      return;
    }
    const items = services.filter(s => {
      const title = (s.title || s.key || '').toLowerCase();
      const desc = (s.description || '').toLowerCase();
      return title.includes(q.toLowerCase()) || desc.includes(q.toLowerCase());
    });
    setSearchResults(items);
    setShowResults(true);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Image source={{ uri: 'https://cdn-icons-png.flaticon.com/512/565/565547.png' }} style={styles.logo} />
          <View>
            <Text style={[styles.smallText, { color: colors.muted }]}>Bienvenido</Text>
            <Text style={[styles.headerTitle, { color: colors.text }]}>ProyectoMovil</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => Alert.alert('Notificaciones', 'No hay notificaciones')} style={{ marginRight: 12 }}>
            <Image source={{ uri: 'https://cdn-icons-png.flaticon.com/512/1827/1827979.png' }} style={{ width: 28, height: 28 }} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowProfile(true)}>
            <Image source={{ uri: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png' }} style={styles.profileIcon} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search input under profile (fixed) */}
      <View style={styles.searchContainerHeader}>
        <TextInput
          placeholder="Buscar servicio..."
          placeholderTextColor={colors.muted}
          style={[styles.searchInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
          value={query}
          onChangeText={text => { setQuery(text); setShowResults(false); }}
          onSubmitEditing={handleSearchSubmit}
          returnKeyType="search"
          blurOnSubmit={false}
        />
      </View>

      {/* Categories */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Categorías</Text>
        <FlatList
          data={[
            { id: 'plom', title: 'Plomería', icon: 'https://cdn-icons-png.flaticon.com/512/2921/2921222.png' },
            { id: 'elec', title: 'Electricidad', icon: 'https://cdn-icons-png.flaticon.com/512/2321/2321406.png' },
            { id: 'lim', title: 'Limpieza', icon: 'https://cdn-icons-png.flaticon.com/512/2913/2913496.png' },
            { id: 'mens', title: 'Mensajería', icon: 'https://cdn-icons-png.flaticon.com/512/2991/2991148.png' },
            { id: 'jard', title: 'Jardinería', icon: 'https://cdn-icons-png.flaticon.com/512/1995/1995574.png' },
            { id: 'rep', title: 'Reparaciones', icon: 'https://cdn-icons-png.flaticon.com/512/2965/2965567.png' },
          ]}
          horizontal
          keyExtractor={i => i.id}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity style={[styles.categoryItem, { backgroundColor: colors.card }]} onPress={() => { setQuery(item.title); setShowResults(false); }}>
              <Image source={{ uri: item.icon }} style={styles.categoryIcon} />
              <Text style={{ color: colors.text, marginTop: 6 }}>{item.title}</Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* If showResults true, render results list (same screen) */}
      {showResults ? (
        <View style={[styles.section, { marginTop: 8 }] }>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Resultados</Text>
          {searchResults.length === 0 ? (
            <Text style={{ color: colors.muted, marginTop: 8 }}>No se encontraron servicios para "{query}"</Text>
          ) : (
            <FlatList
              data={searchResults}
              keyExtractor={i => i.id}
              renderItem={({ item }) => (
                <TouchableOpacity style={[styles.choiceRow, { backgroundColor: colors.card }]} onPress={() => navigation.navigate('ServiceDetail', { service: item })}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <Image source={{ uri: item.img || item.icon }} style={{ width: 44, height: 44, borderRadius: 6, marginRight: 12 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontWeight: '700' }}>{item.title}</Text>
                      <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12 }}>{item.description}</Text>
                    </View>
                  </View>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>{item.price}</Text>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      ) : null}

      {/*
        Main services list
        <FlatList
          data={filteredServices}
          keyExtractor={item => item.id || item.key}
          contentContainerStyle={styles.container}
          renderItem={renderService}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          ListFooterComponent={<View style={{ height: 120 }} />}
        />

        <Modal visible={showProfile} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { backgroundColor: colors.card }] }>
              <Text style={{ color: colors.text, fontWeight: '700' }}>{user?.email || 'Usuario'}</Text>
              <View style={{ marginTop: 12 }}>
                <Pressable onPress={() => { setShowProfile(false); }} style={styles.modalButton}><Text>Cerrar</Text></Pressable>
                <Pressable onPress={async () => { try { await logout(); } catch (e) { console.warn('logout failed', e); } finally { setShowProfile(false); } }} style={[styles.modalButton, { backgroundColor: colors.primary }]}><Text style={{ color: '#fff' }}>Cerrar sesión</Text></Pressable>
              </View>
            </View>
          </View>
        </Modal>

        <View style={[styles.bottomBar, { backgroundColor: colors.surface }] }>
          <View style={[styles.balanceBox, { backgroundColor: colors.card }] }>
            <Text style={{ color: colors.muted, fontSize: 12 }}>Tu balance</Text>
            <Text style={{ color: colors.text, fontWeight: '700', marginTop: 6 }}>--</Text>
          </View>
          <View style={styles.ctaWrapper}>
            <CustomButton title="Pedir ahora" onPress={() => navigation.navigate('ServiceDetail')} />
          </View>
        </View>
      */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 180 },
  headerRow: { padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  logo: { width: 44, height: 44, borderRadius: 10, marginRight: 12 },
  smallText: { fontSize: 12, color: '#666' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  profileIcon: { width: 36, height: 36, borderRadius: 18 },
  choiceRow: { padding: 12, marginHorizontal: 16, marginVertical: 8, borderRadius: 10, flexDirection: 'row', alignItems: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 20 },
  modalCard: { borderRadius: 12, padding: 16 },
  modalButton: { padding: 10, borderRadius: 8, marginTop: 8 },
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 12, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 16, borderRadius: 12 },
  balanceBox: { padding: 12, borderRadius: 8 },
  ctaWrapper: { flex: 1, marginLeft: 12 },
  searchContainer: { paddingHorizontal: 20, paddingVertical: 12 },
  searchContainerHeader: { paddingHorizontal: 20, paddingBottom: 12 },
  searchInput: { padding: 10, borderRadius: 10, borderWidth: 1 },
  section: { paddingHorizontal: 20, marginTop: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  categoryItem: { width: 90, height: 100, borderRadius: 10, marginRight: 12, padding: 10, alignItems: 'center', justifyContent: 'center' },
  categoryIcon: { width: 36, height: 36 },
  quickCta: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10 },
  promoBanner: { padding: 16, borderRadius: 10, marginHorizontal: 20, marginTop: 12 },
  nearItem: { width: 140, padding: 8, marginRight: 12, borderRadius: 10, alignItems: 'center' },
  testimonial: { padding: 12, borderRadius: 10 },
  supportButton: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 }
});
