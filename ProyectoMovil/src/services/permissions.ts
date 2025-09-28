import { Platform, PermissionsAndroid } from 'react-native';
let Geo: any = null;
try { Geo = require('react-native-geolocation-service'); } catch {}

export type LocationPermissionStatus = 'granted' | 'denied' | 'unavailable' | 'limited';

export interface LocationPermissionResult {
  status: LocationPermissionStatus;
  fineGranted?: boolean; // permiso preciso
  coarseGranted?: boolean; // permiso aproximado (Android 12+ / iOS 14+ conceptos)
  canAskAgain?: boolean;
}

// Solicita FINE y (cuando aplique) COARSE. Devuelve un objeto con detalle.
export async function requestLocationPermission(): Promise<LocationPermissionResult> {
  if (Platform.OS === 'android') {
    try {
      const fine = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION, {
        title: 'Permiso de ubicación',
        message: 'La app necesita acceder a tu ubicación para compartirla en la reserva y calcular rutas.',
        buttonPositive: 'Aceptar',
        buttonNegative: 'Cancelar'
      });
      // Intentar COARSE si existe (algunos dispositivos pueden otorgar coarse aunque FINE sea negado)
      let coarseRes: string | undefined;
      if (PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION) {
        try {
          coarseRes = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION);
        } catch {}
      }
      const fineGranted = fine === PermissionsAndroid.RESULTS.GRANTED;
      const coarseGranted = coarseRes === PermissionsAndroid.RESULTS.GRANTED || fineGranted; // fine implica coarse
      if (fineGranted) return { status: 'granted', fineGranted:true, coarseGranted:true, canAskAgain:true };
      if (coarseGranted) return { status: 'limited', fineGranted:false, coarseGranted:true, canAskAgain:true };
      const never = fine === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN;
      return { status: 'denied', fineGranted:false, coarseGranted:false, canAskAgain: !never };
    } catch (e) {
      console.warn('requestLocationPermission error', e);
      return { status: 'unavailable' };
    }
  } else if (Platform.OS === 'ios') {
    // En iOS React Native 0.81+ la API geolocation pide permisos automáticamente al llamar, pero es mejor forzar con navigator.geolocation.getCurrentPosition.
    return new Promise<LocationPermissionResult>((resolve) => {
      if (!navigator?.geolocation) return resolve({ status: 'unavailable' });
      const geo: any = (Geo && typeof Geo.getCurrentPosition === 'function') ? Geo : navigator.geolocation as any;
      if (geo && typeof geo.getCurrentPosition === 'function') {
        // La librería nativa muestra prompt si no fue concedido aún
        geo.getCurrentPosition(
          () => resolve({ status:'granted', fineGranted:true, coarseGranted:true, canAskAgain:true }),
          (err: { code?: number; message?: string }) => {
            console.log('iOS getCurrentPosition perm error', err?.message);
            resolve({ status:'denied', fineGranted:false, coarseGranted:false, canAskAgain:true });
          },
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
        );
      } else {
        // Si no existe getCurrentPosition asumimos que el permiso se pedirá al iniciar watchPosition
        resolve({ status:'granted', fineGranted:true, coarseGranted:true, canAskAgain:true });
      }
    });
  }
  return { status:'unavailable' };
}
