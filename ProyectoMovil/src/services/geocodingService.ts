// Simple Geocoding service using Google Geocoding API.
// NOTE: Reemplazar la API key por un import centralizado. No exponer clave real en repositorio público.

export interface GeocodeResult {
  lat: number;
  lng: number;
  formattedAddress?: string;
  source?: 'google' | 'osm';
}
import { GOOGLE_MAPS_API_KEY } from '@env';
// Log defensivo (se mostrará una sola vez al importar). No revela la clave completa, sólo longitud.
try {
  const len = GOOGLE_MAPS_API_KEY ? GOOGLE_MAPS_API_KEY.length : 0;
  console.log('[geocodingService] GOOGLE_MAPS_API_KEY longitud:', len, len ? '(ok)' : '(vacía)');
} catch {}

export async function geocodeAddress(addressLine?: string, city?: string, province?: string, country?: string, apiKey: string = GOOGLE_MAPS_API_KEY): Promise<GeocodeResult | null> {
  const parts = [addressLine, city, province, country].filter(Boolean).join(', ');
  if (!parts) return null;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(parts)}&key=${apiKey}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data: any = await res.json();
    if (data.status !== 'OK' || !data.results?.length) {
      if (data.status === 'REQUEST_DENIED') {
        console.warn('[geocodeAddress] REQUEST_DENIED (posible API key/billing). Devolviendo null para permitir fallback.');
        return null;
      }
      return null;
    }
    const first = data.results[0];
    return {
      lat: first.geometry.location.lat,
      lng: first.geometry.location.lng,
      formattedAddress: first.formatted_address,
    };
  } catch (e: any) {
    console.warn('geocodeAddress error', e.message);
    throw e;
  }
}

// ---------------- HÍBRIDO (Google primario + fallback OSM) ------------------

export interface HybridGeocodeOptions {
  useOsmFallback?: boolean;    // true por defecto
  forceProvider?: 'google' | 'osm'; // fuerza un proveedor específico
  cacheTtlMs?: number;         // TTL cache en memoria
}

interface CacheEntry { value: GeocodeResult | null; ts: number }
const _geoCache = new Map<string, CacheEntry>();
const DEFAULT_TTL = 1000 * 60 * 60; // 1h

function normalizeKey(parts: string[]): string {
  return parts.map(p => (p || '').trim().toLowerCase()).filter(Boolean).join('|');
}

function getFromCache(key: string, ttl: number): GeocodeResult | null | undefined {
  const entry = _geoCache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.ts > ttl) { _geoCache.delete(key); return undefined; }
  return entry.value;
}
function setCache(key: string, value: GeocodeResult | null) {
  _geoCache.set(key, { value, ts: Date.now() });
}

async function googleGeocodeRaw(address: string): Promise<GeocodeResult | null> {
  if (!GOOGLE_MAPS_API_KEY || GOOGLE_MAPS_API_KEY === 'CHANGEME') {
    console.warn('[googleGeocodeRaw] API key ausente o placeholder. Saltando a fallback.');
    return null;
  }
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const data: any = await res.json();
  if (data.status === 'ZERO_RESULTS') return null;
  if (data.status === 'REQUEST_DENIED') {
    console.warn('[googleGeocodeRaw] REQUEST_DENIED (API key/billing). Retornando null para permitir fallback OSM.');
    return null;
  }
  if (data.status !== 'OK') throw new Error('Google geocode: ' + data.status);
  const first = data.results[0];
  return { lat: first.geometry.location.lat, lng: first.geometry.location.lng, formattedAddress: first.formatted_address, source: 'google' };
}

async function osmGeocodeRaw(address: string): Promise<GeocodeResult | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'ProyectoMovil-Geocoder/1.0 (contact@example.com)' }});
  if (!res.ok) throw new Error('OSM HTTP ' + res.status);
  const data = await res.json() as any[];
  if (!data.length) return null;
  const first = data[0];
  return { lat: parseFloat(first.lat), lng: parseFloat(first.lon), formattedAddress: first.display_name, source: 'osm' };
}

export async function geocodeAddressHybrid(addressLine?: string, city?: string, province?: string, country?: string, options: HybridGeocodeOptions = {}): Promise<GeocodeResult | null> {
  const partsArr = [addressLine, city, province, country].filter(Boolean) as string[];
  if (!partsArr.length) return null;
  const address = partsArr.join(', ');
  const key = normalizeKey(partsArr);
  const ttl = options.cacheTtlMs ?? DEFAULT_TTL;
  const cached = getFromCache(key, ttl);
  if (cached !== undefined) return cached;

  const { useOsmFallback = true, forceProvider } = options;
  let result: GeocodeResult | null = null;
  let googleError: any = null;

  if (!forceProvider || forceProvider === 'google') {
    try {
      result = await googleGeocodeRaw(address);
    } catch (e: any) {
      googleError = e;
      // Si no hay fallback permitido, relanzamos
      if (!useOsmFallback) throw e;
    }
  }

  if (!result && (forceProvider === 'osm' || (useOsmFallback && (!forceProvider || forceProvider !== 'google')))) {
    try {
      result = await osmGeocodeRaw(address);
    } catch (e) {
      if (googleError) throw googleError; // priorizar error Google si existía
      throw e;
    }
  }

  setCache(key, result);
  return result;
}

// Helper para hash rápido de dirección (para detectar si cambió)
export function computeAddressHash(addressLine?: string, city?: string, province?: string, country?: string): string | null {
  const arr = [addressLine, city, province, country].filter(Boolean) as string[];
  if (!arr.length) return null;
  const base = arr.map(s => s.trim().toLowerCase()).join('|');
  let h = 0; for (let i=0;i<base.length;i++){ h = ((h<<5)-h) + base.charCodeAt(i); h |= 0; }
  return 'a' + Math.abs(h).toString(36);
}
