import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, TextInput, Alert } from 'react-native';
import FeatureHint from '../components/FeatureHint';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useRefresh } from '../contexts/RefreshContext';
import { listenReservation, updateReservation, cancelReservationAtomic, getUserProfile, confirmCompletion, acceptReservationExclusive } from '../services/firestoreService';
import { geocodeAddressHybrid, computeAddressHash } from '../services/geocodingService';
import { fetchRoute } from '../services/directionsService';
import { GOOGLE_MAPS_API_KEY } from '@env';
import { stopProviderLocationUpdates, hasLocationCapability } from '../services/locationTracking';
import { requestLocationPermission } from '../services/permissions';
import PaymentModal from '../components/PaymentModal';
import { listPaymentMethods } from '../services/payments/paymentService';

interface Props { route: any; navigation: any; }

const STATUS_FLOW: string[] = ['pending','confirmed','in_progress','completed'];

export default function ActiveReservationDetail({ route, navigation }: Props) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { triggerRefresh } = useRefresh();
  const initial = route.params?.reservation || null;
  const reservationId = initial?.id || route.params?.reservationId;
  const [reservation, setReservation] = useState<any | null>(initial);
  const [loading, setLoading] = useState(!initial);
  const [editing, setEditing] = useState(false);
  const [editNote, setEditNote] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [profileRole, setProfileRole] = useState<'user' | 'provider' | null>(null);
  const isProvider = profileRole === 'provider';
  // cancel reason UI state
  const [showCancelUI, setShowCancelUI] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [routePoints, setRoutePoints] = useState<{ latitude:number; longitude:number }[]>([]);
  const [routeLoading, setRouteLoading] = useState(false);
  const mapRef = useRef<MapView | null>(null);
  // Tracking proveedor desactivado temporalmente
  const [sharingLocation] = useState(false);
  const [trackingError] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [cards, setCards] = useState<any[]>([]);
  const [finalizing, setFinalizing] = useState(false);

  // Helper para obtener ubicación dinámica del proveedor / cliente (placeholder: debería venir de Firestore en tiempo real)
  // Desactivamos ubicación de proveedor (marcador y ruta). Mantener tipos coherentes.
  const providerLocation: { lat:number; lng:number } | null = null;
  const [liveProviderPos] = useState<{ lat:number; lng:number } | null>(null);
  const clientLocation = reservation?.clientLocation || (reservation?.address?.lat && reservation?.address?.lng ? { lat: reservation.address.lat, lng: reservation.address.lng } : null);

  const hasClientLocation = !!clientLocation;
  // Usamos la posición efectiva para dibujar la ruta: si el proveedor está viendo la reserva y tiene tracking activo, preferimos la local en vivo.
  const effectiveProviderLocation: { lat:number; lng:number } | null = null; // Forzamos null para ocultar marker y ruta
  const hasProviderLocation = false;
  const canShowRoute = false; // Ruta deshabilitada (sin provider)

  // Pequeña función util para distancia (m) entre dos puntos
  const haversine = (a:{lat:number;lng:number}, b:{lat:number;lng:number}) => {
    const R = 6371e3; const toRad = (d:number)=>d*Math.PI/180;
    const dLat = toRad(b.lat - a.lat); const dLng = toRad(b.lng - a.lng);
    const la1 = toRad(a.lat); const la2 = toRad(b.lat);
    const h = Math.sin(dLat/2)**2 + Math.cos(la1)*Math.cos(la2)*Math.sin(dLng/2)**2;
    return 2*R*Math.atan2(Math.sqrt(h), Math.sqrt(1-h));
  };

  const lastRouteMetaRef = useRef<{ origin?:{lat:number;lng:number}; dest?:{lat:number;lng:number}; ts:number }|null>(null);
  const ROUTE_MIN_TIME_MS = 15000; // no recalcular más rápido que cada 15s automáticamente
  const ROUTE_MIN_MOVE_M = 30; // o si se movió >30m

  const computeRoute = useCallback(async () => {
    // Ruta deshabilitada
    return;
  }, []);

  // Recalcular ruta cuando cambien ubicaciones
  useEffect(()=>{ /* ruta deshabilitada */ }, []);

  // Watch local (en vivo) sólo para el proveedor activo compartiendo su ubicación.
  // Tracking local deshabilitado

  // load role
  useEffect(() => {
    (async () => {
      try {
        const uid = (user as any)?.uid; if (!uid) return;
        const p = await getUserProfile(uid);
        setProfileRole(p?.role === 'provider' ? 'provider' : 'user');
      } catch {}
    })();
  }, [user]);

  // subscribe to reservation changes
  useEffect(() => {
    if (!reservationId) return;
    let unsub: any = null;
    setLoading(true);
    unsub = listenReservation(reservationId, (res: any) => {
      // Log de depuración de cambio de providerLocation
      setReservation((prev: any) => {
        const prevLoc = prev?.providerLocation as any;
        const newLoc = res?.providerLocation as any;
        if (newLoc && (!prevLoc || prevLoc.lat !== newLoc.lat || prevLoc.lng !== newLoc.lng)) {
          console.log('[ActiveReservationDetail] providerLocation update', newLoc);
        }
        return res;
      });
      setLoading(false);
    });
    return () => { try { unsub && unsub(); } catch(_){} };
  }, [reservationId]);

  const status = reservation?.status;
  const canEditClient = !isProvider && status && ['pending','confirmed'].includes(status);
  const canAccept = isProvider && status === 'pending';
  const canCancelClient = !isProvider && status && ['pending','confirmed'].includes(status);
  const canChat = status && ['confirmed','in_progress'].includes(status);

  const stateColor = (s?: string) => {
    switch(s){
      case 'pending': return colors.muted;
      case 'confirmed': return colors.accent;
      case 'in_progress': return colors.primary;
      case 'completed': return colors.accent;
      case 'cancelled': return colors.danger;
      default: return colors.muted;
    }
  };

  const handleSave = async () => {
    if (!reservationId) return;
    try {
      const addressLine = editAddress || undefined;
      // Intentar geocodificar si hay dirección nueva
      let geo: any = null;
      let geocodeHash: string | null = null;
      if (addressLine) {
        try {
          geo = await geocodeAddressHybrid(addressLine, undefined, undefined, 'Honduras', { useOsmFallback: true });
          geocodeHash = computeAddressHash(addressLine, undefined, undefined, 'Honduras');
        } catch (e:any) { console.warn('handleSave geocode', e.message); }
      }
      const updatePayload: any = { note: editNote || undefined };
      if (addressLine) updatePayload['address.addressLine'] = addressLine;
      if (geocodeHash) updatePayload['address.geocodeHash'] = geocodeHash;
      if (geo) {
        updatePayload.clientLocation = { lat: geo.lat, lng: geo.lng, updatedAt: new Date(), source: 'geocode_edit' };
      }
      await updateReservation(reservationId, updatePayload);
      setEditing(false);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudo actualizar');
    }
  };

  const handleCancel = async () => {
    if (!reservationId) return;
    // Mostrar panel interno para capturar motivo (opcional).
    setShowCancelUI(true);
  };

  const handleAccept = async () => {
    if (!reservationId) return;
    try {
      const uid = (user as any)?.uid;
      if (!uid) throw new Error('Proveedor no autenticado');
      await acceptReservationExclusive(reservationId, uid);
    } catch(e:any){ Alert.alert('Error', e?.message || 'No se pudo aceptar'); }
  };

  const openFinishFlow = () => {
    if (!reservationId || status !== 'in_progress') {
      Alert.alert('Finalización','La reserva no está en progreso.');
      return;
    }
    setShowPaymentModal(true);
  };

  const handleConfirmPayment = async (data: { method:'card'|'cash'; cardId?: string; breakdown:any }) => {
    if (!reservationId) return;
    try {
      setFinalizing(true);
      await confirmCompletion(reservationId, {
        paymentMethod: data.method,
        paymentInfo: data.method==='card'? { cardId: data.cardId }: undefined,
        breakdown: data.breakdown,
        markPaid: data.method==='cash'? false : true,
      });
      setShowPaymentModal(false);
      Alert.alert('Reserva','Servicio marcado como completado');
      // Disparar refresco global para que dashboards/listas reflejen el cambio
      try { triggerRefresh(); } catch {}
    } catch (e:any) {
      Alert.alert('Error', e?.message || 'No se pudo completar');
    } finally {
      setFinalizing(false);
    }
  };

  const headerStatusLabel = (s?: string) => {
    if (!s) return '...';
    const map: any = { pending: 'Pendiente', confirmed: 'Confirmada', in_progress: 'En curso', completed: 'Completada', cancelled: 'Cancelada' };
    return map[s] || s;
  };

  const timeline = STATUS_FLOW.filter(step => step !== 'completed' || status === 'completed');

  // Iniciar/detener tracking cuando:
  // - El usuario es proveedor de la reserva
  // - Estado es confirmed o in_progress
  // Efecto de tracking remoto deshabilitado

  // Recentrar mapa cuando cambie providerLocation de forma significativa
  const lastCenteredRef = useRef<{ lat:number; lng:number } | null>(null);
  // Centrado en proveedor deshabilitado

  // Util para formatear tiempo relativo última actualización
  const toDate = (v:any): Date | null => {
    if (!v) return null; if (v instanceof Date) return v; if (v.seconds) return new Date(v.seconds * 1000); if (typeof v === 'number') return new Date(v); return null;
  };
  const lastProviderUpdateDate = null;
  const relativeTime = (d: Date | null) => {
    if (!d) return '—';
    const diff = Date.now() - d.getTime();
    if (diff < 60000) return `${Math.max(1, Math.round(diff/1000))}s`;
    if (diff < 3600000) return `${Math.round(diff/60000)}m`;
    return `${Math.round(diff/3600000)}h`;
  };

  useEffect(() => {
    (async () => {
      try {
        const uid = (user as any)?.uid; if (!uid) return;
        const pm = await listPaymentMethods(uid);
        setCards(pm);
      } catch {}
    })();
  }, [user]);

  return (
    <View style={[styles.modalContainer, { backgroundColor: colors.overlay }]}>
      <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.handle} />
        <View style={styles.headerRow}>
          <View style={[styles.statusChip, { backgroundColor: stateColor(status) }]}>
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>{headerStatusLabel(status)}</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
            <Text style={{ color: colors.primary, fontWeight: '700' }}>Cerrar</Text>
          </TouchableOpacity>
        </View>
        {loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 30 }} /> : !reservation ? (
          <Text style={{ color: colors.muted, marginTop: 30 }}>Reserva no encontrada</Text>
        ) : (
          <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>{reservation.serviceSnapshot?.title || 'Servicio'}</Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>ID: {reservation.id}</Text>
            <FeatureHint id="reservation_status" title="Estados" text="Tu reserva avanza: pendiente → confirmada → en curso → completada. Puedes editar o cancelar mientras esté pendiente o confirmada." />
            {typeof reservation.serviceSnapshot?.price !== 'undefined' && (
              <Text style={{ color: colors.text, fontWeight: '700', marginTop: 4 }}>${reservation.serviceSnapshot.price}</Text>
            )}

            <View style={[styles.section, { borderColor: colors.border }]}> 
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Participantes</Text>
              <Text style={{ color: colors.muted, marginTop: 4 }}>Cliente: {reservation.name || reservation.userEmail}</Text>
              {reservation.providerDisplayName && (
                <Text style={{ color: colors.muted, marginTop: 2 }}>Proveedor: {reservation.providerDisplayName}</Text>
              )}
            </View>

            <View style={[styles.section, { borderColor: colors.border }]}> 
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Ubicación y nota</Text>
              <Text style={{ color: colors.text, marginTop: 6 }}>{reservation.address?.addressLine || 'Sin dirección'}</Text>
              {reservation.note ? (
                <Text style={{ color: colors.muted, marginTop: 4 }}>{reservation.note}</Text>
              ) : null}
              {(hasClientLocation) && (
                <View style={{ height: 220, marginTop: 12, borderRadius:12, overflow:'hidden' }}>
                  <MapView
                    ref={(r) => { mapRef.current = r; }}
                    style={{ flex:1 }}
                    initialRegion={{
                      latitude: clientLocation.lat,
                      longitude: clientLocation.lng,
                      latitudeDelta: 0.02,
                      longitudeDelta: 0.02
                    }}
                  >
                    {/* Marker de proveedor deshabilitado */}
                    <Marker coordinate={{ latitude: clientLocation!.lat, longitude: clientLocation!.lng }} title="Destino" />
                    {/* Ruta deshabilitada */}
                  </MapView>
                  {/* <View style={{ position:'absolute', left:10, top:10, backgroundColor: colors.card, padding:8, borderRadius:8 }}>
                    <Text style={{ color: colors.muted, fontSize:12 }}>Ubicación del proveedor desactivada temporalmente.</Text>
                  </View> */}
                  {/* Indicador de actualización proveedor oculto */}
                  {/* Botón refrescar ruta deshabilitado */}
                </View>
              )}
              {/* Bloque de compartir ubicación deshabilitado temporalmente */}
              {!hasClientLocation && (
                <View style={{ marginTop:12, padding:12, borderRadius:12, borderWidth:1, borderColor: colors.border, backgroundColor: colors.inputBg }}>
                  <Text style={{ color: colors.text, fontWeight:'600', marginBottom:4 }}>Mapa / Ruta</Text>
                  <Text style={{ color: colors.muted, fontSize:12, lineHeight:16 }}>
                    Aún no se puede mostrar el mapa porque la reserva no tiene coordenadas de ubicación para el {providerLocation ? 'cliente' : 'proveedor'}{!providerLocation && !clientLocation ? ' ni el cliente' : ''}.
                  </Text>
                  <Text style={{ color: colors.muted, fontSize:12, marginTop:6 }}>
                    Próximos pasos: implementar subida de localización en tiempo real o editar manualmente el documento en Firestore con campos providerLocation / clientLocation.
                  </Text>
                  <TouchableOpacity
                    onPress={async () => {
                      if (!reservationId) return;
                      try {
                        // Coordenadas de prueba (Centro de San Pedro Sula -> Mall Multiplaza)
                        const testProvider = { lat: 15.5042, lng: -88.0250, updatedAt: new Date() };
                        const testClient = { lat: 15.5086, lng: -88.0189, updatedAt: new Date() };
                        await updateReservation(reservationId, { providerLocation: testProvider, clientLocation: testClient });
                        Alert.alert('Agregado', 'Coordenadas de prueba insertadas. Se actualizará el mapa en unos segundos.');
                      } catch (e:any) {
                        Alert.alert('Error', e?.message || 'No se pudo agregar coordenadas de prueba');
                      }
                    }}
                    style={{ marginTop:10, backgroundColor: colors.primary, paddingVertical:10, borderRadius:10, alignItems:'center' }}
                  >
                    <Text style={{ color:'#fff', fontSize:13, fontWeight:'600' }}>Insertar coordenadas de prueba</Text>
                  </TouchableOpacity>
                </View>
              )}
              {editing && (
                <View style={{ marginTop: 10 }}>
                  <TextInput placeholder="Nueva dirección" value={editAddress} onChangeText={setEditAddress} placeholderTextColor={colors.muted} style={[styles.input,{ backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]} />
                  <TextInput placeholder="Nota" value={editNote} onChangeText={setEditNote} placeholderTextColor={colors.muted} style={[styles.input,{ backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border, height:80 }]} multiline />
                  <View style={{ flexDirection:'row', gap:8 }}>
                    <TouchableOpacity onPress={() => setEditing(false)} style={[styles.smallBtn,{ backgroundColor: colors.muted }]}><Text style={styles.smallBtnText}>Cancelar</Text></TouchableOpacity>
                    <TouchableOpacity onPress={handleSave} style={[styles.smallBtn,{ backgroundColor: colors.primary }]}><Text style={styles.smallBtnText}>Guardar</Text></TouchableOpacity>
                  </View>
                </View>
              )}
            </View>

            <View style={[styles.section, { borderColor: colors.border }]}> 
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Progreso</Text>
              <View style={styles.timelineRow}>
                {timeline.map((step, i) => {
                  const reached = STATUS_FLOW.indexOf(step) <= STATUS_FLOW.indexOf(status || 'pending');
                  return (
                    <View key={step} style={styles.timelineItem}>
                      <View style={[styles.timelineDot, { backgroundColor: reached ? colors.primary : colors.border }]} />
                      {i < timeline.length -1 && <View style={[styles.timelineBar, { backgroundColor: reached ? colors.primary : colors.border }]} />}
                      <Text style={{ color: reached ? colors.primary : colors.muted, fontSize:10, marginTop:4 }}>{step}</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {canEditClient && !editing && (
              <TouchableOpacity onPress={() => { setEditing(true); setEditNote(reservation.note || ''); setEditAddress(reservation.address?.addressLine || ''); }} style={[styles.inlineAction, { backgroundColor: colors.highlight }]}>
                <Text style={{ color: colors.primary, fontWeight: '600' }}>Editar nota / dirección</Text>
              </TouchableOpacity>
            )}
            {canChat && (
              <TouchableOpacity onPress={() => navigation.navigate('ChatRoom', { reservationId })} style={[styles.inlineAction, { backgroundColor: colors.primary }]}>
                <Text style={{ color: '#fff', fontWeight: '600' }}>Abrir chat</Text>
              </TouchableOpacity>
            )}
            {canAccept && (
              <TouchableOpacity onPress={handleAccept} style={[styles.inlineAction, { backgroundColor: colors.accent }]}>
                <Text style={{ color: '#fff', fontWeight: '600' }}>Aceptar reserva</Text>
              </TouchableOpacity>
            )}
            {canCancelClient && (
              <TouchableOpacity onPress={handleCancel} style={[styles.inlineAction, { backgroundColor: colors.danger }]}>
                <Text style={{ color: '#fff', fontWeight: '600' }}>Cancelar reserva</Text>
              </TouchableOpacity>
            )}
            {showCancelUI && (
              <View style={[styles.section, { borderColor: colors.border, marginTop: 18 }]}> 
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Motivo de cancelación</Text>
                <Text style={{ color: colors.muted, fontSize:12, marginTop:6 }}>Opcional, pero ayuda a mejorar el servicio.</Text>
                <TextInput
                  placeholder="Motivo (opcional)"
                  value={cancelReason}
                  onChangeText={setCancelReason}
                  multiline
                  placeholderTextColor={colors.muted}
                  style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border, height:90, textAlignVertical:'top' }]}
                />
                <View style={{ flexDirection:'row', gap:10, marginTop:4 }}>
                  <TouchableOpacity onPress={() => { setShowCancelUI(false); setCancelReason(''); }} style={[styles.smallBtn, { backgroundColor: colors.muted }]}> 
                    <Text style={styles.smallBtnText}>Volver</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={async () => {
                      try {
                        await cancelReservationAtomic(reservationId, cancelReason.trim() || undefined);
                        navigation.goBack();
                      } catch (e: any) {
                        Alert.alert('Error', e?.message || 'No se pudo cancelar');
                      }
                    }}
                    style={[styles.smallBtn, { backgroundColor: colors.danger }]}
                  >
                    <Text style={styles.smallBtnText}>Confirmar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            {isProvider && status==='in_progress' && (
              <View style={{ marginTop:12 }}>
                <TouchableOpacity onPress={openFinishFlow} style={{ backgroundColor: colors.primary, padding:12, borderRadius:10 }}>
                  <Text style={{ color:'#fff', fontWeight:'600', textAlign:'center' }}>Finalizar y cobrar</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        )}
      </View>
      <PaymentModal visible={showPaymentModal} onClose={()=>setShowPaymentModal(false)} price={reservation?.price || reservation?.basePrice || 0} cards={cards} onConfirm={handleConfirmPayment} loading={finalizing} />
    </View>
  );
}

const styles = StyleSheet.create({
  modalContainer: { flex:1, justifyContent:'flex-end' },
  sheet: { maxHeight:'92%', borderTopLeftRadius:24, borderTopRightRadius:24, paddingHorizontal:20, paddingTop:8, borderWidth:1 },
  handle: { width:50, height:5, borderRadius:3, backgroundColor:'#666', alignSelf:'center', marginBottom:12 },
  headerRow: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:8 },
  closeBtn: { paddingHorizontal:12, paddingVertical:6, borderRadius:16, backgroundColor:'rgba(0,0,0,0.05)' },
  statusChip: { paddingHorizontal:10, paddingVertical:6, borderRadius:14 },
  title: { fontSize:20, fontWeight:'700', marginBottom:4 },
  section: { marginTop:18, padding:14, borderRadius:14, borderWidth:1 },
  sectionTitle: { fontSize:14, fontWeight:'700', textTransform:'uppercase', letterSpacing:0.5 },
  input: { borderWidth:1, borderRadius:10, padding:10, marginBottom:8 },
  inlineAction: { marginTop:14, padding:14, borderRadius:14, alignItems:'center' },
  smallBtn: { flex:1, padding:12, borderRadius:10, alignItems:'center', marginTop:4 },
  smallBtnText: { color:'#fff', fontWeight:'600' },
  timelineRow: { flexDirection:'row', marginTop:12, justifyContent:'space-between' },
  timelineItem: { flex:1, alignItems:'center', position:'relative' },
  timelineDot: { width:16, height:16, borderRadius:8 },
  timelineBar: { position:'absolute', top:8, left:'50%', width:'100%', height:2, zIndex:-1 }
});
