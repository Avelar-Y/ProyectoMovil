import { useCallback, useEffect, useRef, useState } from 'react';
import { listenProviderLocation } from '../services/firestoreService';
import { fetchRoute } from '../services/directionsService';
import { GOOGLE_MAPS_API_KEY } from '@env';

export interface UseLiveRouteOptions {
  minMoveMeters?: number;     // distancia mínima para recalcular
  minIntervalMs?: number;     // tiempo mínimo entre recalculos auto
  forceClientLocation?: { lat: number; lng: number } | null; // cliente fijo (siempre el mismo destino)
  enable?: boolean;           // permitir activar/desactivar rápidamente
}

export interface LiveRouteState {
  providerLocation: { lat: number; lng: number; updatedAt?: any } | null;
  routePoints: { latitude: number; longitude: number }[];
  distanceText?: string;
  durationText?: string;
  loadingRoute: boolean;
  lastCalcAt?: number;
  stale: boolean; // true si la ubicación del proveedor no se ha actualizado hace > staleMs
}

const DEFAULT_MOVE = 25;      // 25m
const DEFAULT_INTERVAL = 12000; // 12s
const STALE_MS = 60_000;        // 60s sin actualización => stale

export function useLiveRoute(reservationId: string | undefined, opts: UseLiveRouteOptions): [LiveRouteState, () => void] {
  const { minMoveMeters = DEFAULT_MOVE, minIntervalMs = DEFAULT_INTERVAL, forceClientLocation, enable = true } = opts;
  const [providerLocation, setProviderLocation] = useState<LiveRouteState['providerLocation']>(null);
  const [routePoints, setRoutePoints] = useState<LiveRouteState['routePoints']>([]);
  const [distanceText, setDistanceText] = useState<string | undefined>();
  const [durationText, setDurationText] = useState<string | undefined>();
  const [loadingRoute, setLoadingRoute] = useState(false);
  const lastMetaRef = useRef<{ ts: number; origin?: { lat:number; lng:number } } | null>(null);

  // simple haversine
  const haversine = useCallback((a:{lat:number;lng:number}, b:{lat:number;lng:number}) => {
    const R = 6371e3; const toRad = (d:number)=>d*Math.PI/180;
    const dLat = toRad(b.lat - a.lat); const dLng = toRad(b.lng - a.lng);
    const la1 = toRad(a.lat); const la2 = toRad(b.lat);
    const h = Math.sin(dLat/2)**2 + Math.cos(la1)*Math.cos(la2)*Math.sin(dLng/2)**2;
    return 2*R*Math.atan2(Math.sqrt(h), Math.sqrt(1-h));
  }, []);

  const computeRoute = useCallback(async (force = false) => {
    if (!enable) return;
    if (!reservationId || !providerLocation || !forceClientLocation) return;
    const now = Date.now();
    const meta = lastMetaRef.current;
    if (!force && meta && meta.origin) {
      const dt = now - meta.ts;
      const moved = haversine(meta.origin, providerLocation) > minMoveMeters;
      if (dt < minIntervalMs && !moved) return; // throttle
    }
    setLoadingRoute(true);
    try {
      const result = await fetchRoute({
        origin: { latitude: providerLocation.lat, longitude: providerLocation.lng },
        destination: { latitude: forceClientLocation.lat, longitude: forceClientLocation.lng },
        apiKey: GOOGLE_MAPS_API_KEY,
      });
      setRoutePoints(result.points);
      setDistanceText(result.distanceText);
      setDurationText(result.durationText);
      lastMetaRef.current = { ts: now, origin: { ...providerLocation } };
    } catch (e:any) {
      console.warn('[useLiveRoute] computeRoute error', e.message);
    } finally { setLoadingRoute(false); }
  }, [enable, reservationId, providerLocation?.lat, providerLocation?.lng, forceClientLocation?.lat, forceClientLocation?.lng, minMoveMeters, minIntervalMs, haversine]);

  // Escuchar sólo providerLocation
  useEffect(() => {
    if (!enable) return;
    if (!reservationId) return;
    const unsub = listenProviderLocation(reservationId, loc => {
      setProviderLocation(loc);
    });
    return () => { unsub && unsub(); };
  }, [reservationId, enable]);

  // Recalcular cuando cambie providerLocation o destino
  useEffect(() => { computeRoute(); }, [computeRoute]);

  const stale = providerLocation?.updatedAt ? (Date.now() - (providerLocation.updatedAt.seconds ? providerLocation.updatedAt.seconds*1000 : new Date(providerLocation.updatedAt).getTime())) > STALE_MS : false;

  const forceRecalc = useCallback(() => { computeRoute(true); }, [computeRoute]);

  return [{ providerLocation, routePoints, distanceText, durationText, loadingRoute, lastCalcAt: lastMetaRef.current?.ts, stale }, forceRecalc];
}

export default useLiveRoute;