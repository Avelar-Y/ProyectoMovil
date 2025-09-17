import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList, TouchableOpacity, Image } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { getServicesForProvider, getPendingReservationsForProvider } from '../services/firestoreService';
import { useRefresh } from '../contexts/RefreshContext';

export default function ProviderHome({ navigation }: any) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [services, setServices] = useState<any[]>([]);
  const [pending, setPending] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const refreshCtx = useRefresh();

  const loadAll = React.useCallback(async () => {
    setLoading(true);
    try {
      const uid = (user as any)?.uid;
      if (!uid) {
        setServices([]);
        setPending([]);
        return;
      }
      const sv = await getServicesForProvider(uid);
      const pd = await getPendingReservationsForProvider(uid);
      setServices(sv || []);
      setPending(pd || []);
    } catch (e) {
      console.warn('ProviderHome load error', e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Provide a stable handler that can be registered on-demand by tests or controlled components.
  const loadAllHandler = React.useCallback(async () => {
    try {
      await loadAll();
    } catch (e) {
      console.warn('ProviderHome global refresh error', e);
    }
  }, [loadAll]);

  // NOTE: intentionally avoid automatic registration on mount to prevent re-registration loops.
  // If you want this screen to participate in the global refresh, call refreshCtx.register('ProviderHome', loadAllHandler)
  // from a user action (e.g. a toggle/button) or from a higher-level coordinator that ensures stable identity.

  if (loading) return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      <ActivityIndicator />
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      <Text style={[styles.title, { color: colors.text }]}>Panel de proveedor</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
        <TouchableOpacity onPress={loadAll} style={[styles.cta, { backgroundColor: colors.primary, marginRight: 8 }]}> 
          <Text style={{ color: '#fff', fontWeight: '700' }}>Cargar ahora</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => refreshCtx.register('ProviderHome', loadAllHandler)} style={[styles.cta, { backgroundColor: colors.surface }]}> 
          <Text style={{ color: colors.text, fontWeight: '700' }}>Registrar refresh</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => refreshCtx.unregister('ProviderHome')} style={[styles.cta, { backgroundColor: colors.surface, marginLeft: 8 }]}> 
          <Text style={{ color: colors.text, fontWeight: '700' }}>Anular registro</Text>
        </TouchableOpacity>
      </View>

      <View style={{ marginTop: 12 }}>
        <Text style={{ color: colors.muted, marginBottom: 8 }}>Servicios publicados</Text>
        {services.length === 0 ? (
          <Text style={{ color: colors.muted }}>No tienes servicios publicados.</Text>
        ) : (
          <FlatList
            data={services}
            keyExtractor={i => i.id}
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => navigation.navigate('AddService', { service: item })} style={[styles.row, { backgroundColor: colors.card }]}> 
                <Image source={{ uri: item.icon || 'https://cdn-icons-png.flaticon.com/512/854/854878.png' }} style={{ width: 48, height: 48, borderRadius: 8, marginRight: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: '700' }}>{item.title}</Text>
                  <Text style={{ color: colors.muted }}>{item.price ? String(item.price) : 'Sin precio'}</Text>
                </View>
              </TouchableOpacity>
            )}
            refreshing={refreshCtx.refreshing || loading}
            onRefresh={async () => await refreshCtx.triggerRefresh()}
          />
        )}
      </View>

      <View style={{ marginTop: 18 }}>
        <Text style={{ color: colors.muted, marginBottom: 8 }}>Solicitudes pendientes</Text>
        {pending.length === 0 ? (
          <Text style={{ color: colors.muted }}>No hay solicitudes pendientes.</Text>
        ) : (
          <FlatList
            data={pending}
            keyExtractor={i => i.id}
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => navigation.navigate('MyServices')} style={[styles.row, { backgroundColor: colors.card }]}> 
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: '700' }}>{item.serviceSnapshot?.title || 'Servicio'}</Text>
                  <Text style={{ color: colors.muted }}>{item.name} · {item.date}</Text>
                </View>
              </TouchableOpacity>
            )}
            refreshing={refreshCtx.refreshing || loading}
            onRefresh={async () => await refreshCtx.triggerRefresh()}
          />
        )}
      </View>

      <View style={{ marginTop: 20 }}>
        <TouchableOpacity onPress={() => navigation.navigate('MyServices')} style={[styles.cta, { backgroundColor: colors.primary }]}> 
          <Text style={{ color: '#fff', fontWeight: '700' }}>Ir a Mis servicios</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 20, fontWeight: '700' },
  row: { padding: 12, borderRadius: 8, flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  cta: { padding: 12, borderRadius: 8, alignItems: 'center' },
});
