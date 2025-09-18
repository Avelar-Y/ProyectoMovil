// Servicio de tracking de ubicación del proveedor.
// NOTA: Para producción se recomienda usar la librería 'react-native-geolocation-service'
// (mejor precisión y soporte) y gestionar permisos explícitamente.
// Aquí usamos la API global de geolocalización para simplicidad.

import { updateReservation } from './firestoreService';
// Preferimos la librería nativa si está disponible
let Geo: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Geo = require('react-native-geolocation-service');
} catch {}

// Declaración mínima para evitar errores TS en entornos donde los tipos de geolocalización no están presentes.
// En un proyecto con @types/react-native o librerías específicas esto no sería necesario.
declare global {
  interface Navigator { geolocation?: {
    watchPosition: (
      success: (pos: { coords: { latitude: number; longitude: number } }) => void,
      error?: (err: { code?: number; message?: string }) => void,
      options?: any
    ) => number;
    clearWatch: (id: number) => void;
  } }
}

interface InternalState {
  watchId: number | null;
  reservationId: string | null;
  lastPoint: { lat: number; lng: number } | null;
  lastTimestamp: number;
  startedAt: number | null;
}

const state: InternalState = {
  watchId: null,
  reservationId: null,
  lastPoint: null,
  lastTimestamp: 0,
  startedAt: null,
};

// Umbrales por defecto
const DEFAULT_MIN_TIME_MS = 10000; // 10s entre escrituras
const DEFAULT_MIN_DISTANCE_M = 25; // 25 metros

interface StartOptions { minTimeMs?: number; minDistanceM?: number; }

function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371e3; // metros
  const toRad = (d: number) => d * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const la1 = toRad(a.lat);
  const la2 = toRad(b.lat);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(la1) * Math.cos(la2) * sinDLng * sinDLng;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R * c; // metros
}

export function isTrackingActive() {
  return !!state.watchId;
}

export function getTrackingUptimeMs() {
  return state.startedAt ? Date.now() - state.startedAt : 0;
}

export async function startProviderLocationUpdates(reservationId: string, opts: StartOptions = {}) {
  if (state.watchId) {
    if (state.reservationId === reservationId) return; // ya estamos trackeando esa reserva
    stopProviderLocationUpdates();
  }
  const hasLib = !!Geo && typeof Geo.watchPosition === 'function';
  const hasNavigator = typeof navigator !== 'undefined' && navigator.geolocation && typeof navigator.geolocation.watchPosition === 'function';
  if (!hasLib && !hasNavigator) {
    throw new Error('Geolocalización no disponible (ni API nativa ni navigator)');
  }
  state.reservationId = reservationId;
  state.startedAt = Date.now();
  state.lastPoint = null;
  state.lastTimestamp = 0;

  const minTime = typeof opts.minTimeMs === 'number' ? opts.minTimeMs : DEFAULT_MIN_TIME_MS;
  const minDist = typeof opts.minDistanceM === 'number' ? opts.minDistanceM : DEFAULT_MIN_DISTANCE_M;

  let watchFn: any;
  if (hasLib) {
    watchFn = Geo.watchPosition.bind(Geo);
  } else if (hasNavigator && navigator.geolocation) {
    watchFn = navigator.geolocation.watchPosition.bind(navigator.geolocation as any);
  } else {
    throw new Error('No hay implementación de watchPosition disponible');
  }
  state.watchId = watchFn(async (pos: any) => {
    try {
      if (!state.reservationId) return;
      const { latitude, longitude } = pos.coords;
      const now = Date.now();
      const point = { lat: latitude, lng: longitude };

      // Filtros por tiempo
  if (now - state.lastTimestamp < minTime) return;

      // Filtro por distancia
      if (state.lastPoint) {
        const dist = haversine(state.lastPoint, point);
  if (dist < minDist) return;
      }

      state.lastPoint = point;
      state.lastTimestamp = now;
      await updateReservation(state.reservationId, {
        providerLocation: { ...point, updatedAt: new Date() }
      });
    } catch (e) {
      console.warn('Update providerLocation falló', (e as any)?.message);
    }
  }, (err: any) => {
    console.warn('watchPosition error', err?.message);
  }, hasLib ? {
    enableHighAccuracy: true,
    distanceFilter: 0,
    interval: minTime,
    fastestInterval: Math.max(1000, Math.round(minTime/2)),
    forceRequestLocation: true,
    showLocationDialog: true,
  } : {
    enableHighAccuracy: true,
    distanceFilter: 0,
    timeout: 15000,
    maximumAge: 4000,
  });
}

export function stopProviderLocationUpdates() {
  if (state.watchId && navigator?.geolocation?.clearWatch) {
    try { navigator.geolocation.clearWatch(state.watchId); } catch { }
  }
  state.watchId = null;
  state.reservationId = null;
  state.lastPoint = null;
  state.lastTimestamp = 0;
  state.startedAt = null;
}
