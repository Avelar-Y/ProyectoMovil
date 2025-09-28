import React, { useRef, useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { fetchRoute, fitCoordsPadding, RouteResult } from '../services/directionsService';
import { useTheme } from '../contexts/ThemeContext';

const ORIGIN_DEFAULT = { latitude: 15.5042, longitude: -88.0250 };
const DEST_DEFAULT = { latitude: 15.5086, longitude: -88.0189 };

export default function MapRouteDemo() {
  const mapRef = useRef<MapView | null>(null);
  const { colors } = useTheme();
  const [origin] = useState(ORIGIN_DEFAULT);
  const [destination] = useState(DEST_DEFAULT);
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [loading, setLoading] = useState(false);

  // TODO: extraer a configuración central (env / secure storage). No exponer claves reales en el código fuente.
  const apiKey = 'AIzaSyBrUoLvY2cDFD6zEcfN_-tseOEkPkxvTjY';

  const handleRoute = async () => {
    setLoading(true);
    try {
      const r = await fetchRoute({ origin, destination, apiKey });
      setRoute(r);
      if (r.points.length > 0) fitCoordsPadding(mapRef.current, [origin, destination, ...r.points]);
    } catch (e: any) {
      if (typeof e?.message === 'string' && e.message.includes('REQUEST_DENIED')) {
        Alert.alert('Clave inválida', 'La Directions API respondió REQUEST_DENIED. Verifica que la API Key sea válida, tenga billing habilitado y la Directions API activada.');
      } else {
        Alert.alert('Ruta', e?.message || 'Error obteniendo ruta');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={(ref) => { mapRef.current = ref; }}
        style={styles.map}
        initialRegion={{ ...origin, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
      >
        <Marker coordinate={origin} title="Origen" />
        <Marker coordinate={destination} title="Destino" />
        {route?.points?.length ? (
          <Polyline coordinates={route.points} strokeWidth={5} strokeColor={colors.primary || 'blue'} />
        ) : null}
      </MapView>
      <View style={[styles.panel, { backgroundColor: colors.surface }]}>
        <Text style={[styles.title, { color: colors.text }]}>Demo Ruta</Text>
        {route?.distanceText && (
          <Text style={{ color: colors.muted }}>Distancia: {route.distanceText}  Tiempo: {route.durationText}</Text>
        )}
        <TouchableOpacity style={[styles.btn, { backgroundColor: colors.primary }]} onPress={handleRoute} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Calcular ruta</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  panel: { position: 'absolute', left: 10, right: 10, top: 40, padding: 14, borderRadius: 12, elevation: 4 },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  btn: { marginTop: 10, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700' },
});
