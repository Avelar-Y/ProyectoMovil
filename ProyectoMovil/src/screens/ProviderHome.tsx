import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList, TouchableOpacity, Image } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { getServicesForProvider, getPendingReservationsForProvider } from '../services/firestoreService';

export default function ProviderHome({ navigation }: any) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [services, setServices] = useState<any[]>([]);
  const [pending, setPending] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const uid = (user as any)?.uid;
        if (!uid) return;
        const sv = await getServicesForProvider(uid);
        const pd = await getPendingReservationsForProvider(uid);
        if (!mounted) return;
        setServices(sv || []);
        setPending(pd || []);
      } catch (e) {
        console.warn('ProviderHome load error', e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false };
  }, [user]);

  if (loading) return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ActivityIndicator />
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Panel de proveedor</Text>

      <View style={{ marginTop: 12 }}>
        <Text style={{ color: colors.muted, marginBottom: 8 }}>Servicios publicados</Text>
        {services.length === 0 ? (
          <Text style={{ color: colors.muted }}>No tienes servicios publicados.</Text>
        ) : (
          <FlatList data={services} keyExtractor={i => i.id} renderItem={({ item }) => (
            <TouchableOpacity onPress={() => navigation.navigate('AddService', { service: item })} style={[styles.row, { backgroundColor: colors.card }]}> 
              <Image source={{ uri: item.icon || 'https://cdn-icons-png.flaticon.com/512/854/854878.png' }} style={{ width: 48, height: 48, borderRadius: 8, marginRight: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '700' }}>{item.title}</Text>
                <Text style={{ color: colors.muted }}>{item.price ? String(item.price) : 'Sin precio'}</Text>
              </View>
            </TouchableOpacity>
          )} />
        )}
      </View>

      <View style={{ marginTop: 18 }}>
        <Text style={{ color: colors.muted, marginBottom: 8 }}>Solicitudes pendientes</Text>
        {pending.length === 0 ? (
          <Text style={{ color: colors.muted }}>No hay solicitudes pendientes.</Text>
        ) : (
          <FlatList data={pending} keyExtractor={i => i.id} renderItem={({ item }) => (
            <TouchableOpacity onPress={() => navigation.navigate('MyServices')} style={[styles.row, { backgroundColor: colors.card }]}> 
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '700' }}>{item.serviceSnapshot?.title || 'Servicio'}</Text>
                <Text style={{ color: colors.muted }}>{item.name} · {item.date}</Text>
              </View>
            </TouchableOpacity>
          )} />
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
