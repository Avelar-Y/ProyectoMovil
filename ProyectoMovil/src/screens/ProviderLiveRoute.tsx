import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { listenReservation, updateReservation } from '../services/firestoreService';
import useLiveRoute from '../hooks/useLiveRoute';
import { requestLocationPermission } from '../services/permissions';
import { startProviderLocationUpdates, stopProviderLocationUpdates, hasLocationCapability } from '../services/locationTracking';

interface Props { route: any; navigation: any; }

// Pantalla enfocada únicamente a mostrar la ruta dinámica del proveedor hacia el destino del cliente.
// Usa posición local en vivo para feedback inmediato + subida a Firestore en background (servicio existente).
export default function ProviderLiveRoute({ route, navigation }: Props) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const reservationId = route.params?.reservationId;
  const [reservation, setReservation] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  // mantenemos livePos sólo para feedback local inmediato antes de que suba al servidor
  const [livePos, setLivePos] = useState<{ lat:number; lng:number } | null>(null);
  const mapRef = useRef<MapView | null>(null);

  const clientLocation = reservation?.clientLocation || (reservation?.address?.lat && reservation?.address?.lng ? { lat: reservation.address.lat, lng: reservation.address.lng } : null);
  const providerStored = reservation?.providerLocation;
  const effectiveProvider = livePos || providerStored;
  const canRoute = !!effectiveProvider && !!clientLocation;

  // Hook centralizado de ruta en vivo (usa providerLocation de servidor para coherencia multi-dispositivo)
  const [liveRouteState, forceRecalc] = useLiveRoute(reservationId, {
    forceClientLocation: clientLocation,
    enable: true,
    minMoveMeters: 25,
    minIntervalMs: 12000,
  });

  useEffect(() => {
    if (!reservationId) return;
    const unsub = listenReservation(reservationId, (res) => { setReservation(res); setLoading(false); });
    return () => { unsub && unsub(); };
  }, [reservationId]);

  // Persistir distancia/tiempo si el cálculo del hook difiere del documento
  useEffect(() => {
    if (!reservationId) return;
    const dist = liveRouteState.distanceText;
    const dur = liveRouteState.durationText;
    if (!dist && !dur) return;
    if (dist !== reservation?.routeDistanceText || dur !== reservation?.routeDurationText) {
      (async () => { try { await updateReservation(reservationId, { routeDistanceText: dist, routeDurationText: dur }); } catch {} })();
    }
  }, [liveRouteState.distanceText, liveRouteState.durationText, reservationId, reservation?.routeDistanceText, reservation?.routeDurationText]);

  // Watch local (solo cuando sharing activo)
  useEffect(() => {
    if (!sharing) { setLivePos(null); stopProviderLocationUpdates(); return; }
    (async () => {
      if (!hasLocationCapability()) {
        Alert.alert('Ubicación no disponible', 'No se detecta API de ubicación en este dispositivo/emulador.');
        setSharing(false); return;
      }
  const perm = await requestLocationPermission();
  if (perm.status !== 'granted' && perm.status !== 'limited') { Alert.alert('Permiso requerido','Concede el permiso de ubicación (precisa o aproximada).'); setSharing(false); return; }
      try {
        await startProviderLocationUpdates(reservationId, { minTimeMs: 8000, minDistanceM: 15 } as any);
      } catch (e:any) { console.warn('startProviderLocationUpdates error', e.message); }
      // Watch local inmediato
      try {
        const geo: any = (navigator as any)?.geolocation;
        if (geo?.watchPosition) {
          const id = geo.watchPosition((pos:any) => {
            const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            setLivePos(p); // el hook recalculará según providerLocation servidor; esto es sólo feedback local
          }, (err:any) => console.warn('local watch error', err?.message), { enableHighAccuracy:true, distanceFilter:0 });
          return () => { try { geo.clearWatch(id); } catch {} };
        }
      } catch {}
    })();
    return () => { stopProviderLocationUpdates(); };
  }, [sharing, reservationId]);

  const relative = (d: any) => {
    if (!d) return '—';
    const date = d instanceof Date ? d : (d.seconds ? new Date(d.seconds*1000) : new Date(d));
    const diff = Date.now() - date.getTime();
    if (diff < 60000) return Math.round(diff/1000)+ 's';
    if (diff < 3600000) return Math.round(diff/60000)+ 'm';
    return Math.round(diff/3600000)+'h';
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={{ color: colors.primary, fontWeight:'600' }}>Cerrar</Text></TouchableOpacity>
        <Text style={{ color: colors.text, fontWeight:'700' }}>Ruta en vivo</Text>
        <View style={{ width:60 }} />
      </View>
      {loading ? <ActivityIndicator style={{ marginTop:40 }} color={colors.primary} /> : !reservation ? (
        <Text style={{ color: colors.muted, marginTop:40 }}>Reserva no encontrada</Text>
      ) : (
        <>
          <View style={{ flex:1 }}>
            <MapView
              ref={r => { mapRef.current = r; }}
              style={{ flex:1 }}
              initialRegion={{
                latitude: (effectiveProvider?.lat || clientLocation?.lat || 0),
                longitude: (effectiveProvider?.lng || clientLocation?.lng || 0),
                latitudeDelta: 0.03, longitudeDelta:0.03
              }}
            >
              {effectiveProvider && <Marker coordinate={{ latitude: effectiveProvider.lat, longitude: effectiveProvider.lng }} title="Proveedor" pinColor={colors.primary} />}
              {clientLocation && <Marker coordinate={{ latitude: clientLocation.lat, longitude: clientLocation.lng }} title="Destino" />}
              {liveRouteState.routePoints.length>0 && <Polyline coordinates={liveRouteState.routePoints} strokeWidth={5} strokeColor={colors.primary} />}
            </MapView>
            <View style={[styles.overlayBox, { backgroundColor: colors.card }]}> 
              {!canRoute && <Text style={{ color: colors.muted, fontSize:12 }}>Faltan coordenadas para trazar la ruta.</Text>}
              {canRoute && liveRouteState.loadingRoute && <ActivityIndicator size="small" color={colors.primary} />}
              {canRoute && !liveRouteState.loadingRoute && (
                <Text style={{ color: colors.text, fontSize:12 }}>
                  Dist: {liveRouteState.distanceText || reservation?.routeDistanceText || '...'}  /  Tiempo: {liveRouteState.durationText || reservation?.routeDurationText || '...'}
                </Text>
              )}
              {providerStored && (
                <Text style={{ color: colors.muted, fontSize:10, marginTop:4 }}>Servidor: act {relative(providerStored.updatedAt)} {livePos && '(local en vivo)'}</Text>
              )}
              <TouchableOpacity onPress={() => forceRecalc()} style={[styles.refreshBtn, { backgroundColor: colors.primary }]}>
                <Text style={{ color:'#fff', fontSize:11, fontWeight:'600' }}>Recalcular</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.bottomPanel}> 
            <TouchableOpacity
              onPress={() => setSharing(s => !s)}
              style={[styles.shareBtn, { backgroundColor: sharing ? colors.danger : colors.primary }]}
            >
              <Text style={{ color:'#fff', fontWeight:'700' }}>{sharing ? 'Detener' : 'Compartir ubicación'}</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:{ flex:1 },
  topBar:{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:16, paddingVertical:12 },
  overlayBox:{ position:'absolute', left:12, top:12, padding:10, borderRadius:10, elevation:4 },
  refreshBtn:{ position:'absolute', right:8, top:8, paddingHorizontal:10, paddingVertical:6, borderRadius:8 },
  bottomPanel:{ padding:16 },
  shareBtn:{ paddingVertical:14, borderRadius:12, alignItems:'center' }
});
