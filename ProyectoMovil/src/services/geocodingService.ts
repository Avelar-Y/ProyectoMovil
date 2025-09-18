// Simple Geocoding service using Google Geocoding API.
// NOTE: Reemplazar la API key por un import centralizado. No exponer clave real en repositorio público.

export interface GeocodeResult {
  lat: number;
  lng: number;
  formattedAddress?: string;
}

export async function geocodeAddress(addressLine?: string, city?: string, province?: string, country?: string, apiKey: string = 'YOUR_GOOGLE_MAPS_API_KEY'): Promise<GeocodeResult | null> {
  const parts = [addressLine, city, province, country].filter(Boolean).join(', ');
  if (!parts) return null;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(parts)}&key=${apiKey}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data: any = await res.json();
    if (data.status !== 'OK' || !data.results?.length) {
      if (data.status === 'REQUEST_DENIED') {
        throw new Error('Geocoding REQUEST_DENIED: revisa tu API key / billing / API habilitada');
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
