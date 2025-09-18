// Declaración ligera local si no existen tipos instalados
// (Alternativa: instalar @types/mapbox__polyline cuando esté disponible)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const polyline: { decode: (s: string) => number[][] } = require('@mapbox/polyline');

export type RouteResult = {
  points: { latitude: number; longitude: number }[];
  distanceText?: string;
  durationText?: string;
  raw?: any;
};

const decode = (encoded: string): { latitude: number; longitude: number }[] => {
  if (!encoded) return [];
  return polyline.decode(encoded).map((pair: number[]) => {
    const lat = pair[0];
    const lng = pair[1];
    return { latitude: lat, longitude: lng };
  });
};

// Cache en memoria: clave = `${o}|${d}|${mode}`
const routeCache = new Map<string, RouteResult>();

export async function fetchRoute(options: { origin: { latitude: number; longitude: number }; destination: { latitude: number; longitude: number }; apiKey: string; mode?: 'driving' | 'walking' | 'bicycling' | 'transit'; cache?: boolean; }) : Promise<RouteResult> {
  const { origin, destination, apiKey, mode='driving', cache=true } = options;
  const o = `${origin.latitude},${origin.longitude}`;
  const d = `${destination.latitude},${destination.longitude}`;
  const key = `${o}|${d}|${mode}`;
  if (cache && routeCache.has(key)) return routeCache.get(key)!;
  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(o)}&destination=${encodeURIComponent(d)}&mode=${mode}&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Directions request failed: ${res.status}`);
  const data: any = await res.json();
  if (data.status !== 'OK') throw new Error(`Directions API error: ${data.status}`);
  const route = data.routes?.[0];
  const leg = route?.legs?.[0];
  const points = decode(route?.overview_polyline?.points || '');
  const result: RouteResult = {
      points,
      distanceText: leg?.distance?.text,
      durationText: leg?.duration?.text,
      raw: data,
  };
  if (cache) routeCache.set(key, result);
  return result;
}

export function clearRouteCache() { routeCache.clear(); }

export function fitCoordsPadding(mapRef: any, coords: { latitude: number; longitude: number }[], edgePadding = { top: 80, left: 40, right: 40, bottom: 80 }) {
  if (!mapRef || !coords || coords.length === 0) return;
  try {
    mapRef.fitToCoordinates(coords, { edgePadding, animated: true });
  } catch {}
}
