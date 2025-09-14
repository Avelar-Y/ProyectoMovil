import firestore from '@react-native-firebase/firestore';
import type { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';

export type Reservation = {
  id?: string;
  userEmail: string;
  userId?: string;
  service: string; // id or key
  serviceSnapshot?: {
    id?: string;
    title?: string;
    price?: number;
  };
  name: string;
  date: string;
  note?: string;
  address?: {
    addressLine?: string;
    city?: string;
    province?: string;
    postalCode?: string;
    country?: string;
    lat?: number;
    lng?: number;
  };
  amount?: number; // stored amount at time of reservation
  currency?: string;
  paymentStatus?: 'unpaid' | 'pending' | 'paid' | 'failed' | 'refunded';
  paymentInfo?: Record<string, any> | null;
  status?: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  createdAt?: FirebaseFirestoreTypes.Timestamp | null;
};

export const saveReservation = async (reservation: Omit<Reservation, 'id' | 'createdAt'>) => {
  try {
    const data = { ...reservation, createdAt: firestore.FieldValue.serverTimestamp(), createdAtClient: Date.now() } as any;
    const docRef = await firestore().collection('reservations').add(data);
    return docRef.id;
  } catch (err) {
    console.error('saveReservation error', err);
    throw err;
  }
};

export const updateReservationStatus = async (reservationId: string, status: Reservation['status']) => {
  try {
    await firestore().collection('reservations').doc(reservationId).update({ status });
  } catch (err) {
    console.error('updateReservationStatus error', err);
    throw err;
  }
};

export const updatePaymentInfo = async (reservationId: string, paymentInfo: any, paymentStatus?: Reservation['paymentStatus']) => {
  try {
    const payload: any = { paymentInfo };
    if (paymentStatus) payload.paymentStatus = paymentStatus;
    await firestore().collection('reservations').doc(reservationId).update(payload);
  } catch (err) {
    console.error('updatePaymentInfo error', err);
    throw err;
  }
};

export const getReservationsForUser = async (userEmail: string) : Promise<Reservation[]> => {
  try {
    // Order by client timestamp for immediate visibility; server timestamp will sync later.
    const orderedQuery = firestore()
      .collection('reservations')
      .where('userEmail', '==', userEmail)
      .orderBy('createdAtClient', 'desc');
    try {
      const snap = await orderedQuery.get();
      return snap.docs.map(d => ({ id: d.id, ...(d.data() as Reservation) }));
    } catch (err: any) {
      // Si la query falla porque requiere un índice, hacemos un fallback: obtener sin orderBy y ordenar en cliente
      const message = err?.message || '';
      const code = err?.code || '';
      if (code === 'failed-precondition' || /requires an index/i.test(message)) {
        console.warn('Ordered reservations query requires an index, falling back to client-side ordering.');
        const snap = await firestore()
          .collection('reservations')
          .where('userEmail', '==', userEmail)
          .get();
        const docs = snap.docs.map(d => ({ id: d.id, ...(d.data() as Reservation) }));
        // Normalizar createdAtClient y createdAt
        const normalized = docs.map(d => {
          const dataAny: any = d as any;
          if (!dataAny.createdAtClient && dataAny.createdAt && typeof dataAny.createdAt.toMillis === 'function') {
            dataAny.createdAtClient = dataAny.createdAt.toMillis();
          }
          return dataAny;
        });
        normalized.sort((a: any, b: any) => (b.createdAtClient || 0) - (a.createdAtClient || 0));
        return normalized;
      }
      throw err;
    }
  } catch (err) {
    console.error('getReservationsForUser error', err);
    throw err;
  }
};

// Export default al final del archivo (después de declarar todas las funciones)


export type Service = {
  id?: string;
  title: string;
  description?: string;
  price?: number;
  duration?: number;
  icon?: string;
  key?: string;
  tags?: string[];
  active?: boolean;
  createdAt?: FirebaseFirestoreTypes.Timestamp | null;
  createdAtClient?: number;
};

export const saveService = async (service: Omit<Service, 'id' | 'createdAt'>) => {
  try {
    const data = { ...service, createdAt: firestore.FieldValue.serverTimestamp(), createdAtClient: Date.now() } as any;
    const docRef = await firestore().collection('services').add(data);
    return docRef.id;
  } catch (err) {
    console.error('saveService error', err);
    throw err;
  }
};

export const getServices = async (): Promise<Service[]> => {
  try {
    const snap = await firestore().collection('services').get();
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as Service) }));
  } catch (err) {
    console.error('getServices error', err);
    throw err;
  }
};

export const getReservationsForService = async (serviceIdOrKey: string) => {
  try {
    const snap = await firestore()
      .collection('reservations')
      .where('service', '==', serviceIdOrKey)
      .orderBy('createdAtClient', 'desc')
      .get();
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
  } catch (err: any) {
    console.warn('getReservationsForService fallback to unordered fetch', err);
    // fallback without orderBy
    const snap = await firestore().collection('reservations').where('service', '==', serviceIdOrKey).get();
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
  }
};

export const getUserProfile = async (uid: string) => {
  try {
    const doc = await firestore().collection('users').doc(uid).get();
    // doc.exists puede ser una propiedad booleana o un método depending on SDK typings
    const exists = typeof (doc as any).exists === 'function' ? (doc as any).exists() : (doc as any).exists;
    return exists ? (doc.data() as any) : null;
  } catch (err) {
    console.error('getUserProfile error', err);
    throw err;
  }
};

export const updateUserProfile = async (uid: string, data: Record<string, any>) => {
  try {
    await firestore().collection('users').doc(uid).set({ ...data, updatedAt: firestore.FieldValue.serverTimestamp() }, { merge: true });
  } catch (err) {
    console.error('updateUserProfile error', err);
    throw err;
  }
};

const defaultExport = {
  saveReservation,
  getReservationsForUser,
  saveService,
  getServices,
};

export default defaultExport;
