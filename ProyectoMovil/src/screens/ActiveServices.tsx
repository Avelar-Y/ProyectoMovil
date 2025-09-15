import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert, RefreshControl, Image, ActivityIndicator } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { getActiveReservationForUser, cancelReservation } from '../services/firestoreService';
import firestore from '@react-native-firebase/firestore';

export default function ActiveServices({ navigation }: any) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [activeReservation, setActiveReservation] = useState<any | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const uid = (user as any)?.uid;
      if (!uid) {
        setActiveReservation(null);
        return;
      }
      const r = await getActiveReservationForUser(uid);
      // guard: if the returned reservation is cancelled, treat as no active
      if (r && r.status === 'cancelled') setActiveReservation(null);
      else setActiveReservation(r);
    } catch (e) {
      console.warn('ActiveServices load error', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const uid = (user as any)?.uid;
    if (!uid) return;
    // listen for changes to reservations for this user
    const unsub = firestore().collection('reservations').where('userId', '==', uid).onSnapshot((snap) => {
      // If any relevant doc changes, reload active reservation. Also ignore cancelled docs.
      const hasNonCancelled = snap.docs.some(d => {
        const data = d.data() as any;
        return data.status && data.status !== 'cancelled';
      });
      if (hasNonCancelled) load();
      else {
        // If all docs are cancelled/removed, clear active
        setActiveReservation(null);
      }
    }, (e) => console.warn('ActiveServices listener', e));
    return () => unsub();
  }, [user]);

  const handleCancel = async () => {
    if (!activeReservation?.id) return;
    Alert.alert('Cancelar reserva', '¿Deseas cancelar esta reserva?', [
      { text: 'No', style: 'cancel' },
      { text: 'Sí', onPress: async () => {
        try {
          await cancelReservation(activeReservation.id, 'Cancelada por usuario');
          Alert.alert('Reserva cancelada');
          await load();
        } catch (e: any) {
          Alert.alert('Error', e?.message || 'No se pudo cancelar');
        }
      } }
    ]);
  };

  if (!activeReservation) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }] }>
        <FlatList
          data={[]}
          renderItem={null}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
        />
        <Text style={{ color: colors.muted }}>No tienes servicios en curso.</Text>
      </View>
    );
  }

  const provName = activeReservation.providerDisplayName || 'Proveedor';
  const stateLabel = activeReservation.status === 'pending' ? 'Buscando proveedor' : activeReservation.status === 'in_progress' ? 'En curso' : activeReservation.status === 'confirmed' ? 'En camino' : activeReservation.status;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }] }>
      <Text style={[styles.title, { color: colors.text }]}>Servicios en curso 🕒</Text>
      <View style={[styles.card, { backgroundColor: colors.card }] }>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Image source={{ uri: activeReservation.providerAvatar || 'https://cdn-icons-png.flaticon.com/512/149/149071.png' }} style={styles.avatar} />
          <View style={{ marginLeft: 10 }}>
            <Text style={{ fontWeight: '700', color: colors.text }}>{provName}</Text>
            <Text style={{ color: colors.muted }}>Estado: {stateLabel}</Text>
          </View>
          <View style={{ marginLeft: 'auto' }}>
            {typeof activeReservation.serviceSnapshot?.price !== 'undefined' ? (
              <Text style={{ fontWeight: '700', color: colors.text }}>${activeReservation.serviceSnapshot.price}</Text>
            ) : null}
          </View>
        </View>
        <Text style={{ color: colors.muted, marginTop: 8 }}>{activeReservation.serviceSnapshot?.title}</Text>
        <View style={{ flexDirection: 'row', marginTop: 12 }}>
          <TouchableOpacity style={[styles.detailBtn]} onPress={() => navigation.navigate('ServiceDetail', { service: activeReservation.serviceSnapshot, reservationId: activeReservation.id })}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>Ver detalles</Text>
          </TouchableOpacity>
          {activeReservation.status === 'pending' && (
            <TouchableOpacity style={[styles.cancelBtn, processing && { opacity: 0.7 }]} onPress={async () => { setProcessing(true); await handleCancel(); setProcessing(false); }} disabled={processing}>
              {processing ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Cancelar</Text>}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  card: { padding: 12, borderRadius: 8 },
  detailBtn: { backgroundColor: '#3498db', padding: 10, borderRadius: 8, marginRight: 8 },
  cancelBtn: { backgroundColor: '#e74c3c', padding: 10, borderRadius: 8 }
  ,
  avatar: { width: 56, height: 56, borderRadius: 28 }
});
