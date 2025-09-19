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

console.log('[locationTracking] Geo module loaded:', !!Geo);

export function hasLocationCapability() {
  const hasLib = !!Geo && (typeof Geo.getCurrentPosition === 'function' || typeof Geo.watchPosition === 'function');
  // navigator fallback (RN puede no exponerlo en nuevas versiones)
  const navGeo = typeof navigator !== 'undefined' ? (navigator as any).geolocation : undefined;
  const hasNavWatch = !!navGeo && typeof navGeo.watchPosition === 'function';
  const hasNavGet = !!navGeo && typeof navGeo.getCurrentPosition === 'function';
  // Consideramos capability si al menos podemos obtener la posición puntual (getCurrentPosition)
  return hasLib || hasNavWatch || hasNavGet;
}

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
  pollIntervalId: number | null;
  reservationId: string | null;
  lastPoint: { lat: number; lng: number } | null;
  lastTimestamp: number;
  startedAt: number | null;
  mode: 'watch' | 'poll' | null;
}

const state: InternalState = {
  watchId: null,
  pollIntervalId: null,
  reservationId: null,
  lastPoint: null,
  lastTimestamp: 0,
  startedAt: null,
  mode: null,
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
  return !!state.watchId || !!state.pollIntervalId;
}

export function getTrackingMode() {
  return state.mode;
}

export function getTrackingUptimeMs() {
  return state.startedAt ? Date.now() - state.startedAt : 0;
}

export async function startProviderLocationUpdates(reservationId: string, opts: StartOptions = {}) {
  if (state.watchId || state.pollIntervalId) {
    if (state.reservationId === reservationId) return; // ya estamos trackeando esa reserva
    stopProviderLocationUpdates();
  }
  const hasLibWatch = !!Geo && typeof Geo.watchPosition === 'function';
  const hasLibGet = !!Geo && typeof Geo.getCurrentPosition === 'function';
  const navGeo: any = typeof navigator !== 'undefined' ? (navigator as any).geolocation : undefined;
  const hasNavWatch = !!navGeo && typeof navGeo.watchPosition === 'function';
  const hasNavGet = !!navGeo && typeof navGeo.getCurrentPosition === 'function';

  const canWatch = hasLibWatch || hasNavWatch;
  const canGet = hasLibGet || hasNavGet;
  if (!canWatch && !canGet) {
    console.warn('[locationTracking] No geolocation capability (watch/get). Abort start.');
    return;
  }

  state.reservationId = reservationId;
  state.startedAt = Date.now();
  state.lastPoint = null;
  state.lastTimestamp = 0;
  state.mode = null;

  // Sembrar providerLocation inicial
  if (canGet) {
    try {
      const seedPos = await getCurrentProviderPosition();
      if (seedPos) {
        await updateReservation(reservationId, { providerLocation: { ...seedPos, updatedAt: new Date() } });
        state.lastPoint = seedPos;
        state.lastTimestamp = Date.now();
      }
    } catch (e) {
      console.warn('[locationTracking] Seed position failed', (e as any)?.message);
    }
  }

  const minTime = typeof opts.minTimeMs === 'number' ? opts.minTimeMs : DEFAULT_MIN_TIME_MS;
  const minDist = typeof opts.minDistanceM === 'number' ? opts.minDistanceM : DEFAULT_MIN_DISTANCE_M;

  // Helper para decidir si actualizamos Firestore
  const maybePushUpdate = async (point: { lat:number; lng:number }, label: string) => {
    const now = Date.now();
    if (state.lastTimestamp && (now - state.lastTimestamp) < minTime) return; // tiempo
    if (state.lastPoint) {
      const dist = haversine(state.lastPoint, point);
      if (dist < minDist) return; // distancia
    }
    state.lastPoint = point;
    state.lastTimestamp = now;
    try {
      if (state.reservationId) {
  await updateReservation(state.reservationId, { providerLocation: { ...point, updatedAt: new Date() } });
      }
    } catch (e) {
      console.warn('[locationTracking] Firestore update failed', (e as any)?.message);
    }
  };

  if (canWatch) {
    let watchFn: any;
    if (hasLibWatch) {
      watchFn = Geo.watchPosition.bind(Geo);
    } else if (hasNavWatch) {
      watchFn = navGeo.watchPosition.bind(navGeo);
    }
    state.watchId = watchFn(async (pos: any) => {
      const { latitude, longitude } = pos.coords || {};
      if (typeof latitude !== 'number' || typeof longitude !== 'number') return;
      await maybePushUpdate({ lat: latitude, lng: longitude }, 'watch');
    }, (err: any) => {
      console.warn('[locationTracking] watchPosition error', err?.message);
    }, hasLibWatch ? {
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
    state.mode = 'watch';
    console.log('[locationTracking] Tracking iniciado en modo watch');
    return;
  }

  // Fallback polling
  if (canGet) {
    state.mode = 'poll';
    const interval = Math.max(4000, Math.round(minTime / 2)); // más frecuente que minTime para evaluar filtros
    state.pollIntervalId = setInterval(async () => {
      if (!state.reservationId) return;
      const pos = await getCurrentProviderPosition();
      if (pos) await maybePushUpdate(pos, 'poll');
    }, interval) as unknown as number;
    console.log('[locationTracking] Tracking iniciado en modo polling cada', interval, 'ms');
  }
}

export async function getCurrentProviderPosition(): Promise<{ lat:number; lng:number } | null> {
  const hasLib = !!Geo && typeof Geo.getCurrentPosition === 'function';
  const hasNavigator = typeof navigator !== 'undefined' && (navigator.geolocation as any) && typeof (navigator.geolocation as any).getCurrentPosition === 'function';
  if (!hasLib && !hasNavigator) return null;
  return new Promise(resolve => {
  const fn = hasLib ? Geo.getCurrentPosition.bind(Geo) : (navigator.geolocation as any).getCurrentPosition.bind(navigator.geolocation as any);
    try {
      fn((pos: any) => {
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      }, (_err: any) => resolve(null), { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 });
    } catch { resolve(null); }
  });
}

export function stopProviderLocationUpdates() {
  if (state.watchId) {
    try {
      if (Geo && typeof Geo.clearWatch === 'function') Geo.clearWatch(state.watchId);
    } catch {}
    try {
      if (navigator?.geolocation?.clearWatch) navigator.geolocation.clearWatch(state.watchId);
    } catch {}
  }
  if (state.pollIntervalId) {
    try { clearInterval(state.pollIntervalId); } catch {}
  }
  state.watchId = null;
  state.pollIntervalId = null;
  state.reservationId = null;
  state.lastPoint = null;
  state.lastTimestamp = 0;
  state.startedAt = null;
  state.mode = null;
}
