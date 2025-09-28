import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { getReservationById, type Reservation } from '../services/firestoreService';
import { useAuth } from '../contexts/AuthContext';

interface Props { route: any; navigation: any; }

// Pantalla de SOLO lectura para reservas ya finalizadas (completed / cancelled).
// No ofrece acciones: solo muestra un resumen compacto.
export default function ReservationSummary({ route, navigation }: Props) {
  const { reservationId } = route.params || {};  
  const { colors } = useTheme();
  const { user } = useAuth();
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await getReservationById(reservationId);
        if (!mounted) return;
        setReservation(data);
      } catch (e: any) {
        if (!mounted) return; setError(e?.message || 'Error cargando reserva');
      } finally { if (mounted) setLoading(false); }
    })();
    return () => { mounted = false; };
  }, [reservationId]);

  const statusColor = (s?: string) => {
    switch(s){
      case 'pending': return colors.muted;
      case 'confirmed': return colors.accent;
      case 'in_progress': return colors.primary;
      case 'completed': return colors.accent;
      case 'cancelled': return colors.danger;
      default: return colors.muted;
    }
  };
  const statusLabel: any = { pending:'Pendiente', confirmed:'Confirmada', in_progress:'En curso', completed:'Completada', cancelled:'Cancelada' };

  const formatTs = (ts: any) => {
    try {
      if (!ts) return '-';
      if (typeof ts === 'string') return ts;
      if (ts.toDate) {
        const d = ts.toDate();
        return d.toLocaleString();
      }
    } catch {}
    return '-';
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={{ color: colors.primary, fontWeight:'600' }}>Cerrar</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Resumen</Text>
        <View style={{ width:60 }} />
      </View>
      {loading && (
        <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}>
          <ActivityIndicator color={colors.primary} />
          <Text style={{ color: colors.muted, marginTop:8 }}>Cargando...</Text>
        </View>
      )}
      {!loading && error && (
        <View style={{ padding:20 }}>
          <Text style={{ color: colors.danger }}>{error}</Text>
        </View>
      )}
      {!loading && !error && !reservation && (
        <View style={{ padding:20 }}>
          <Text style={{ color: colors.muted }}>Reserva no encontrada.</Text>
        </View>
      )}
      {!loading && reservation && (
        <ScrollView contentContainerStyle={{ paddingBottom:40 }}>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}> 
            <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
              <Text style={[styles.serviceTitle, { color: colors.text }]}>{reservation.serviceSnapshot?.title || reservation.service}</Text>
              <View style={[styles.statusChip, { backgroundColor: statusColor(reservation.status), borderColor: colors.background, borderWidth:0.5 }]}> 
                <Text style={{ color:'#fff', fontSize:11, fontWeight:'600' }}>{statusLabel[reservation.status || ''] || reservation.status}</Text>
              </View>
            </View>
            {!!reservation.note && <Text style={{ color: colors.muted, marginTop:4 }}>{reservation.note}</Text>}
            {!!reservation.address?.addressLine && (
              <Text style={{ color: colors.muted, marginTop:6 }} numberOfLines={2}>{reservation.address.addressLine}</Text>
            )}
            <View style={styles.rowWrap}> 
              <LabelValue label="Creada" value={formatTs(reservation.createdAt)} colors={colors} />
              <LabelValue label="Iniciada" value={formatTs(reservation.startedAt)} colors={colors} />
              <LabelValue label="Finalizada" value={formatTs(reservation.finishedAt)} colors={colors} />
            </View>
            {!!reservation.routeDistanceText && (
              <View style={styles.rowWrap}> 
                <LabelValue label="Distancia" value={reservation.routeDistanceText} colors={colors} />
                <LabelValue label="Duración" value={reservation.routeDurationText || '-'} colors={colors} />
              </View>
            )}
            {reservation.status === 'cancelled' && !!(reservation as any).cancelReason && (
              <View style={{ marginTop:10 }}>
                <Text style={{ color: colors.danger, fontSize:12 }}>Motivo cancelación:</Text>
                <Text style={{ color: colors.danger, fontSize:13, marginTop:2 }}>{(reservation as any).cancelReason}</Text>
              </View>
            )}
            {reservation.status === 'completed' && (
              <View style={{ marginTop:12 }}>
                <Text style={{ color: colors.text, fontWeight:'600', marginBottom:4 }}>Pago</Text>
                <LabelValue label="Método" value={(reservation as any).paymentMethod || '—'} colors={colors} />
                <LabelValue label="Estado pago" value={reservation.paymentStatus || '—'} colors={colors} />
                {(() => {
                  const bd = (reservation as any).paymentBreakdown;
                  if (!bd) return null;
                  return (
                    <View style={{ marginTop:4 }}>
                      <LabelValue label="Subtotal" value={`L ${bd.base?.toFixed?.(2)}` } colors={colors} />
                      {typeof bd.bookingFee === 'number' && <LabelValue label="Reservación" value={`L ${bd.bookingFee.toFixed(2)}`} colors={colors} />}
                      {bd.processingPercent > 0 && <LabelValue label={`Proc (${bd.processingPercent}% )`} value={`L ${bd.processingAmount.toFixed(2)}`} colors={colors} />}
                      <LabelValue label="Total" value={`L ${bd.total?.toFixed?.(2)}` } colors={colors} />
                      <LabelValue label="Proveedor recibe" value={`L ${bd.providerReceives?.toFixed?.(2)}` } colors={colors} />
                    </View>
                  );
                })()}
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const LabelValue = ({ label, value, colors }: any) => (
  <View style={{ marginRight:18, marginTop:6 }}>
    <Text style={{ color: colors.muted, fontSize:11 }}>{label}</Text>
    <Text style={{ color: colors.text, fontSize:13, fontWeight:'600', marginTop:2 }}>{value || '—'}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex:1, paddingTop: 40, paddingHorizontal:16 },
  title: { fontSize:18, fontWeight:'700' },
  card: { marginTop:12, padding:16, borderRadius:16, borderWidth:1 },
  serviceTitle: { fontSize:16, fontWeight:'700', flexShrink:1 },
  statusChip: { paddingHorizontal:10, paddingVertical:4, borderRadius:12 },
  rowWrap: { flexDirection:'row', flexWrap:'wrap', marginTop:10 },
  backBtn: { paddingHorizontal:8, paddingVertical:6 },
  headerRow: { flexDirection:'row', alignItems:'center', justifyContent:'space-between' }
});
