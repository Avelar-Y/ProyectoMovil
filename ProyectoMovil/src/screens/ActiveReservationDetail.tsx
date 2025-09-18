import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, TextInput, Alert } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { listenReservation, updateReservation, cancelReservationAtomic, acceptReservation, getUserProfile } from '../services/firestoreService';
import { fetchRoute } from '../services/directionsService';
import { startProviderLocationUpdates, stopProviderLocationUpdates, isTrackingActive } from '../services/locationTracking';
import { requestLocationPermission } from '../services/permissions';

interface Props { route: any; navigation: any; }

const STATUS_FLOW: string[] = ['pending','confirmed','in_progress','completed'];

export default function ActiveReservationDetail({ route, navigation }: Props) {
  const { colors } = useTheme();
  const { user } = useAuth();
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
  const [sharingLocation, setSharingLocation] = useState(false);
  const [trackingError, setTrackingError] = useState<string | null>(null);

  // Helper para obtener ubicación dinámica del proveedor / cliente (placeholder: debería venir de Firestore en tiempo real)
  const providerLocation = reservation?.providerLocation; // { lat, lng, updatedAt }
  const clientLocation = reservation?.clientLocation || (reservation?.address?.lat && reservation?.address?.lng ? { lat: reservation.address.lat, lng: reservation.address.lng } : null);

  const canShowRoute = providerLocation && clientLocation;

  const computeRoute = useCallback(async () => {
    if (!canShowRoute || !reservationId) return;
    setRouteLoading(true);
    try {
      const apiKey = 'AIzaSyBrUoLvY2cDFD6zEcfN_-tseOEkPkxvTjY'; // TODO: reemplazar por variable de entorno / config
      const result = await fetchRoute({
        origin: { latitude: providerLocation.lat, longitude: providerLocation.lng },
        destination: { latitude: clientLocation.lat, longitude: clientLocation.lng },
        apiKey
      });
      setRoutePoints(result.points);
      // Guardar distancia/tiempo si aún no existe o cambió
      const dist = result.distanceText;
      const dur = result.durationText;
      if ((dist && dist !== reservation?.routeDistanceText) || (dur && dur !== reservation?.routeDurationText)) {
        try { await updateReservation(reservationId, { routeDistanceText: dist, routeDurationText: dur }); } catch {}
      }
      // Ajustar cámara
      if (mapRef.current && result.points.length) {
        try { mapRef.current.fitToCoordinates(result.points, { edgePadding:{ top:80,left:40,right:40,bottom:80 }, animated:true }); } catch {}
      }
    } catch (e:any) {
      console.warn('computeRoute error', e.message);
    } finally {
      setRouteLoading(false);
    }
  }, [canShowRoute, providerLocation, clientLocation, reservationId, reservation?.routeDistanceText, reservation?.routeDurationText]);

  // Recalcular ruta cuando cambien ubicaciones
  useEffect(()=>{ computeRoute(); }, [computeRoute]);

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
      await updateReservation(reservationId, { note: editNote || undefined, 'address.addressLine': editAddress || undefined });
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
    try { await acceptReservation(reservationId); } catch(e:any){ Alert.alert('Error', e?.message || 'No se pudo aceptar'); }
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
  useEffect(() => {
    const eligible = isProvider && reservation?.providerId === (user as any)?.uid && ['confirmed','in_progress'].includes(status || '');
    if (eligible && sharingLocation && reservationId) {
      (async () => {
        try {
          setTrackingError(null);
          // Reducimos umbrales para pruebas (5s / 5m). En producción se pueden subir.
          await startProviderLocationUpdates(reservationId, { minTimeMs: 5000, minDistanceM: 5 } as any);
        } catch (e:any) {
          setTrackingError(e?.message || 'No se pudo iniciar tracking');
          setSharingLocation(false);
        }
      })();
    } else {
      stopProviderLocationUpdates();
    }
    return () => { stopProviderLocationUpdates(); };
  }, [sharingLocation, isProvider, status, reservation?.providerId, reservationId, user]);

  // Recentrar mapa cuando cambie providerLocation de forma significativa
  const lastCenteredRef = useRef<{ lat:number; lng:number } | null>(null);
  useEffect(() => {
    if (!mapRef.current || !providerLocation) return;
    const last = lastCenteredRef.current;
    const changed = !last || Math.abs(last.lat - providerLocation.lat) > 0.00005 || Math.abs(last.lng - providerLocation.lng) > 0.00005; // ~5m
    if (changed) {
      try {
        mapRef.current.animateCamera({ center: { latitude: providerLocation.lat, longitude: providerLocation.lng } });
        lastCenteredRef.current = { lat: providerLocation.lat, lng: providerLocation.lng };
      } catch {}
    }
  }, [providerLocation?.lat, providerLocation?.lng]);

  // Util para formatear tiempo relativo última actualización
  const toDate = (v:any): Date | null => {
    if (!v) return null; if (v instanceof Date) return v; if (v.seconds) return new Date(v.seconds * 1000); if (typeof v === 'number') return new Date(v); return null;
  };
  const lastProviderUpdateDate = toDate(providerLocation?.updatedAt);
  const relativeTime = (d: Date | null) => {
    if (!d) return '—';
    const diff = Date.now() - d.getTime();
    if (diff < 60000) return `${Math.max(1, Math.round(diff/1000))}s`;
    if (diff < 3600000) return `${Math.round(diff/60000)}m`;
    return `${Math.round(diff/3600000)}h`;
  };

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
              {canShowRoute && (
                <View style={{ height: 220, marginTop: 12, borderRadius:12, overflow:'hidden' }}>
                  <MapView
                    ref={(r) => { mapRef.current = r; }}
                    style={{ flex:1 }}
                    initialRegion={{
                      latitude: providerLocation.lat,
                      longitude: providerLocation.lng,
                      latitudeDelta: 0.02,
                      longitudeDelta: 0.02
                    }}
                  >
                    <Marker coordinate={{ latitude: providerLocation.lat, longitude: providerLocation.lng }} title="Proveedor" pinColor={colors.primary} />
                    <Marker coordinate={{ latitude: clientLocation.lat, longitude: clientLocation.lng }} title="Cliente" />
                    {routePoints.length > 0 && <Polyline coordinates={routePoints} strokeWidth={5} strokeColor={colors.primary} />}
                  </MapView>
                  <View style={{ position:'absolute', left:10, top:10, backgroundColor: colors.card, padding:8, borderRadius:8 }}>
                    {routeLoading ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <Text style={{ color: colors.text, fontSize:12 }}>
                        {reservation.routeDistanceText || '...'} / {reservation.routeDurationText || ''}
                      </Text>
                    )}
                  </View>
                  <View style={{ position:'absolute', left:10, bottom:10, backgroundColor: colors.card, paddingHorizontal:8, paddingVertical:6, borderRadius:8 }}>
                    <Text style={{ color: colors.muted, fontSize:11 }}>
                      Prov. actualización: {relativeTime(lastProviderUpdateDate)}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={computeRoute} style={{ position:'absolute', right:10, top:10, backgroundColor: colors.primary, paddingHorizontal:12, paddingVertical:8, borderRadius:8 }}>
                    <Text style={{ color:'#fff', fontSize:12, fontWeight:'600' }}>Refrescar ruta</Text>
                  </TouchableOpacity>
                </View>
              )}
              {(isProvider && reservation?.providerId === (user as any)?.uid && ['confirmed','in_progress'].includes(status || '')) && (
                <View style={{ marginTop:12 }}>
                  <TouchableOpacity
                    onPress={async () => {
                      if (!sharingLocation) {
                        // Vamos a activar: primero verificar disponibilidad
                        if (typeof navigator === 'undefined' || !navigator.geolocation) {
                          Alert.alert('Ubicación no disponible', 'Este entorno no expone geolocalización. Prueba en un dispositivo físico o habilita el permiso en el emulador.');
                          return;
                        }
                        const perm = await requestLocationPermission();
                        if (perm !== 'granted') {
                          Alert.alert('Permiso requerido', 'Necesitamos el permiso de ubicación para compartirla.');
                          return;
                        }
                      }
                      setSharingLocation(prev => !prev);
                    }}
                    style={{ backgroundColor: sharingLocation ? colors.primary : colors.highlight, paddingVertical:12, borderRadius:10, alignItems:'center' }}
                  >
                    <Text style={{ color: sharingLocation ? '#fff' : colors.primary, fontWeight:'600' }}>
                      {sharingLocation ? 'Dejar de compartir mi ubicación' : 'Compartir mi ubicación'}
                    </Text>
                  </TouchableOpacity>
                  {trackingError && (
                    <Text style={{ color: colors.danger, fontSize:12, marginTop:6 }}>{trackingError}</Text>
                  )}
                  {!sharingLocation && !trackingError && (
                    <Text style={{ color: colors.muted, fontSize:11, marginTop:6 }}>
                      Activa para que el cliente vea tu movimiento en el mapa.
                    </Text>
                  )}
                  {sharingLocation && (
                    <Text style={{ color: colors.muted, fontSize:11, marginTop:6 }}>
                      Enviando ubicación periódicamente (filtro cada ~10s y ≥25m).
                    </Text>
                  )}
                  {(!sharingLocation && (typeof navigator === 'undefined' || !navigator.geolocation)) && (
                    <Text style={{ color: colors.danger, fontSize:11, marginTop:6 }}>
                      Geolocalización no disponible (sin API del dispositivo). Usa un equipo físico o revisa la config del emulador.
                    </Text>
                  )}
                </View>
              )}
              {!canShowRoute && (
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
          </ScrollView>
        )}
      </View>
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
