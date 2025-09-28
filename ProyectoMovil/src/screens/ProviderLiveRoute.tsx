import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { listenReservation, updateReservation } from '../services/firestoreService';
import useLiveRoute from '../hooks/useLiveRoute';
import { requestLocationPermission } from '../services/permissions';
import { stopProviderLocationUpdates } from '../services/locationTracking';

interface Props { route: any; navigation: any; }

// Pantalla enfocada únicamente a mostrar la ruta dinámica del proveedor hacia el destino del cliente.
// Usa posición local en vivo para feedback inmediato + subida a Firestore en background (servicio existente).
export default function ProviderLiveRoute({ route, navigation }: Props) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const reservationId = route.params?.reservationId;
  const [reservation, setReservation] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  // Sharing deshabilitado temporalmente
  const [sharing] = useState(false);
  const [livePos] = useState<{ lat:number; lng:number } | null>(null);
  const mapRef = useRef<MapView | null>(null);

  const clientLocation = reservation?.clientLocation || (reservation?.address?.lat && reservation?.address?.lng ? { lat: reservation.address.lat, lng: reservation.address.lng } : null);
  const providerStored: { lat:number; lng:number } | null = null; // ocultamos providerLocation
  const effectiveProvider: { lat:number; lng:number } | null = null;
  const canRoute = false; // sin ruta sin proveedor

  // Hook centralizado de ruta en vivo (usa providerLocation de servidor para coherencia multi-dispositivo)
  const [liveRouteState] = useLiveRoute(reservationId, {
    forceClientLocation: clientLocation,
    enable: false,
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
  // Efecto de sharing deshabilitado temporalmente

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
                latitude: (clientLocation?.lat || 0),
                longitude: (clientLocation?.lng || 0),
                latitudeDelta: 0.03, longitudeDelta:0.03
              }}
            >
              {/* Marker de proveedor oculto temporalmente */}
              {clientLocation && <Marker coordinate={{ latitude: clientLocation.lat, longitude: clientLocation.lng }} title="Destino" />}
              {/* Ruta oculta (sin proveedor) */}
            </MapView>
            <View style={[styles.overlayBox, { backgroundColor: colors.card }]}> 
              <Text style={{ color: colors.muted, fontSize:12 }}>Ubicación del proveedor desactivada temporalmente.</Text>
            </View>
          </View>
          <View style={styles.bottomPanel}> 
            {/* Botón compartir ubicación deshabilitado */}
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
