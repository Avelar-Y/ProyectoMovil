import { Platform, PermissionsAndroid } from 'react-native';
let Geo: any = null;
try { Geo = require('react-native-geolocation-service'); } catch {}

export type LocationPermissionStatus = 'granted' | 'denied' | 'unavailable';

export async function requestLocationPermission(): Promise<LocationPermissionStatus> {
  if (Platform.OS === 'android') {
    try {
      const fine = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION, {
        title: 'Permiso de ubicación',
        message: 'La app necesita acceder a tu ubicación para compartirla en la reserva y calcular rutas.',
        buttonPositive: 'Aceptar',
        buttonNegative: 'Cancelar'
      });
      if (fine === PermissionsAndroid.RESULTS.GRANTED) return 'granted';
      if (fine === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) return 'denied';
      return 'denied';
    } catch (e) {
      console.warn('requestLocationPermission error', e);
      return 'unavailable';
    }
  } else if (Platform.OS === 'ios') {
    // En iOS React Native 0.81+ la API geolocation pide permisos automáticamente al llamar, pero es mejor forzar con navigator.geolocation.getCurrentPosition.
    return new Promise<LocationPermissionStatus>((resolve) => {
      if (!navigator?.geolocation) return resolve('unavailable');
      const geo: any = (Geo && typeof Geo.getCurrentPosition === 'function') ? Geo : navigator.geolocation as any;
      if (geo && typeof geo.getCurrentPosition === 'function') {
        // La librería nativa muestra prompt si no fue concedido aún
        geo.getCurrentPosition(
          () => resolve('granted'),
          (err: { code?: number; message?: string }) => {
            console.log('iOS getCurrentPosition perm error', err?.message);
            resolve('denied');
          },
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
        );
      } else {
        // Si no existe getCurrentPosition asumimos que el permiso se pedirá al iniciar watchPosition
        resolve('granted');
      }
    });
  }
  return 'unavailable';
}
