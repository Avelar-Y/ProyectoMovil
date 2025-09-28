import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { getReservationsForService } from '../services/firestoreService';

export interface ServiceReservationsProps { route: any; }

export default function ServiceReservations({ route }: ServiceReservationsProps) {
  const { serviceId } = route.params || {};
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [reservations, setReservations] = useState<any[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!serviceId) return;
        const res = await getReservationsForService(serviceId);
        if (mounted) setReservations(res || []);
      } catch (e) {
        console.warn('ServiceReservations load', e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false };
  }, [serviceId]);

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Reservas relacionadas</Text>
      {loading ? <ActivityIndicator color={colors.primary} /> : (
        reservations.length === 0 ? <Text style={{ color: colors.muted }}>No hay reservas</Text> : (
          <View>
            {reservations.map(r => (
              <View key={r.id} style={[styles.row, { borderColor: colors.border }]}> 
                <Text style={{ color: colors.text, fontWeight: '600' }}>{r.name}</Text>
                <Text style={{ color: colors.muted }}>{r.date}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>{r.userEmail}</Text>
              </View>
            ))}
          </View>
        )
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, minHeight: '100%' },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  row: { paddingVertical: 10, borderBottomWidth: 1 }
});
