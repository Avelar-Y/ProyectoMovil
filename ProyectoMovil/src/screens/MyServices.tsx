import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Linking, Alert, RefreshControl, Image, ActivityIndicator } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import {
  getServicesForProvider,
  getPendingReservationsForProvider,
  getActiveReservationsForProvider,
  acceptReservationAndAssign,
  rejectReservationByProvider,
  startService,
  finishService,
} from '../services/firestoreService';
import firestore from '@react-native-firebase/firestore';

export default function MyServices({ navigation }: any) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [services, setServices] = useState<any[]>([]);
  const [pending, setPending] = useState<any[]>([]);
  const [active, setActive] = useState<any[]>([]);
  const uid = (user as any)?.uid;
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadAll = async () => {
    setLoading(true);
    try {
      if (!uid) return;
      const sv = await getServicesForProvider(uid);
      setServices(sv || []);
      const p = await getPendingReservationsForProvider(uid);
      setPending(p || []);
      const a = await getActiveReservationsForProvider(uid);
      setActive(a || []);
    } catch (e) {
      console.warn('MyServices load error', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // Realtime listeners: watch reservations collection for changes relevant to this provider
    if (!uid) return;
    const pendingUnsub = firestore()
      .collection('reservations')
      .where('status', '==', 'pending')
      .onSnapshot(() => {
        // small optimization: reload lists on change
        loadAll();
      }, (e) => console.warn('pending listener error', e));

    const activeUnsub = firestore()
      .collection('reservations')
      .where('providerId', '==', uid)
      .onSnapshot(() => { loadAll(); }, (e) => console.warn('active listener error', e));

    return () => {
      pendingUnsub();
      activeUnsub();
    };
  }, [uid]);

  const handleAccept = async (reservationId: string) => {
    Alert.alert('Confirmar', '¿Aceptar esta solicitud?', [
      { text: 'No', style: 'cancel' },
      { text: 'Sí', onPress: async () => {
        try {
          if (!uid) return Alert.alert('Error', 'Usuario no identificado');
          await acceptReservationAndAssign(reservationId, uid);
          Alert.alert('Reserva aceptada');
          await loadAll();
          navigation.navigate('Chat', { reservationId });
        } catch (e: any) {
          Alert.alert('Error', e?.message || 'No se pudo aceptar');
        }
      }}
    ]);
  };

  const handleReject = async (reservationId: string) => {
    Alert.alert('Confirmar', '¿Rechazar esta solicitud?', [
      { text: 'No', style: 'cancel' },
      { text: 'Sí', onPress: async () => {
        try {
          if (!uid) return Alert.alert('Error', 'Usuario no identificado');
          await rejectReservationByProvider(reservationId, uid);
          Alert.alert('Solicitud rechazada');
          await loadAll();
        } catch (e: any) {
          Alert.alert('Error', e?.message || 'No se pudo rechazar');
        }
      }}
    ]);
  };

  const handleStart = async (reservationId: string) => {
    try {
      if (!uid) return Alert.alert('Error', 'Usuario no identificado');
      await startService(reservationId, uid);
      Alert.alert('Servicio iniciado');
      await loadAll();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudo iniciar');
    }
  };

  const handleFinish = async (reservationId: string) => {
    try {
      if (!uid) return Alert.alert('Error', 'Usuario no identificado');
      await finishService(reservationId, uid);
      Alert.alert('Servicio finalizado');
      await loadAll();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudo finalizar');
    }
  };

  const openInMaps = (address: any) => {
    if (!address) return;
    const lat = address.lat;
    const lng = address.lng;
    const line = address.addressLine || '';
    let url = '';
    if (lat && lng) url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    else url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(line)}`;
    Linking.openURL(url).catch(() => Alert.alert('Error', 'No se pudo abrir Google Maps'));
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }] }>
      <Text style={[styles.title, { color: colors.text }]}>Mis servicios</Text>

      <Text style={[styles.sectionTitle, { color: colors.text }]}>🔔 Solicitudes nuevas</Text>
      {loading ? (
        <Text style={{ color: colors.muted }}>Cargando...</Text>
      ) : pending.length === 0 ? (
        <Text style={{ color: colors.muted }}>No hay nuevas solicitudes.</Text>
      ) : (
        <FlatList
          data={pending}
          keyExtractor={(i) => i.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await loadAll(); setRefreshing(false); }} />}
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: colors.card }] }>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Image source={{ uri: item.userAvatar || item.providerAvatar || 'https://cdn-icons-png.flaticon.com/512/149/149071.png' }} style={styles.avatar} />
                <View style={{ marginLeft: 10, flex: 1 }}>
                  <Text style={{ fontWeight: '700', color: colors.text }}>{item.name || 'Cliente'}</Text>
                  <Text style={{ color: colors.muted }}>{item.serviceSnapshot?.title || item.service}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  {typeof item.serviceSnapshot?.price !== 'undefined' ? (
                    <Text style={{ fontWeight: '700', color: colors.text }}>${item.serviceSnapshot.price}</Text>
                  ) : null}
                </View>
              </View>
              <Text style={{ color: colors.muted, marginTop: 8 }}>{item.address?.addressLine || 'Dirección no disponible'}</Text>
              <Text style={{ color: colors.muted }}>{item.note || ''}</Text>
              <Text style={{ color: colors.muted }}>{item.date}</Text>
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={[styles.acceptBtn, processingId === item.id && { opacity: 0.7 }]}
                  onPress={async () => { setProcessingId(item.id); await handleAccept(item.id); setProcessingId(null); }}
                  disabled={processingId === item.id}
                >
                  {processingId === item.id ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Aceptar ✅</Text>}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.rejectBtn, processingId === item.id && { opacity: 0.7 }]}
                  onPress={async () => { setProcessingId(item.id); await handleReject(item.id); setProcessingId(null); }}
                  disabled={processingId === item.id}
                >
                  {processingId === item.id ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Rechazar ❌</Text>}
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 16 }]}>📋 Órdenes activas</Text>
      {active.length === 0 ? (
        <Text style={{ color: colors.muted }}>No hay órdenes activas.</Text>
      ) : (
        <FlatList
          data={active}
          keyExtractor={(i) => i.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await loadAll(); setRefreshing(false); }} />}
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: colors.card }] }>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Image source={{ uri: item.userAvatar || item.providerAvatar || 'https://cdn-icons-png.flaticon.com/512/149/149071.png' }} style={styles.avatarSmall} />
                  <Text style={{ fontWeight: '700', color: colors.text, marginLeft: 8 }}>{item.name || 'Cliente'}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: item.status === 'in_progress' ? '#f39c12' : item.status === 'confirmed' ? '#2ecc71' : '#95a5a6' }]}>
                  <Text style={{ color: '#fff', fontWeight: '700' }}>{item.status}</Text>
                </View>
              </View>
              <Text style={{ color: colors.muted }}>{item.address?.addressLine || 'Dirección no disponible'}</Text>
              {typeof item.serviceSnapshot?.price !== 'undefined' ? (
                <Text style={{ color: colors.muted }}>Precio estimado: ${item.serviceSnapshot.price}</Text>
              ) : null}
              <Text style={{ color: colors.muted }}>Estado: {item.status}</Text>
              <View style={styles.actionsRow}>
                {item.status !== 'in_progress' ? (
                  <TouchableOpacity
                    style={[styles.acceptBtn, processingId === item.id && { opacity: 0.7 }]}
                    onPress={async () => { setProcessingId(item.id); await handleStart(item.id); setProcessingId(null); }}
                    disabled={processingId === item.id}
                  >
                    {processingId === item.id ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Iniciar servicio</Text>}
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.rejectBtn, processingId === item.id && { opacity: 0.7 }]}
                    onPress={async () => { setProcessingId(item.id); await handleFinish(item.id); setProcessingId(null); }}
                    disabled={processingId === item.id}
                  >
                    {processingId === item.id ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Finalizar servicio</Text>}
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={[styles.mapBtn]} onPress={() => openInMaps(item.address)}>
                  <Text style={{ color: '#fff', fontWeight: '700' }}>Abrir en Maps</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  sectionTitle: { fontWeight: '700', marginTop: 8, marginBottom: 8 },
  card: { padding: 12, borderRadius: 8, marginBottom: 8 },
  actionsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  acceptBtn: { backgroundColor: '#2ecc71', padding: 10, borderRadius: 8, flex: 1, alignItems: 'center', marginRight: 8 },
  rejectBtn: { backgroundColor: '#e74c3c', padding: 10, borderRadius: 8, flex: 1, alignItems: 'center', marginRight: 8 },
  mapBtn: { backgroundColor: '#3498db', padding: 10, borderRadius: 8, flex: 1, alignItems: 'center' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }
  ,
  avatar: { width: 56, height: 56, borderRadius: 28 }
  ,
  avatarSmall: { width: 40, height: 40, borderRadius: 20 }
});
