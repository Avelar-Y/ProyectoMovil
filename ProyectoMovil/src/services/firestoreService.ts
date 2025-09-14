import firestore from '@react-native-firebase/firestore';
import type { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';

export type Reservation = {
  id?: string;
  userEmail: string;
  service: string;
  name: string;
  date: string;
  note?: string;
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

export const getReservationsForUser = async (userEmail: string) : Promise<Reservation[]> => {
  try {
    // Order by client timestamp for immediate visibility; server timestamp will sync later.
    const snap = await firestore()
      .collection('reservations')
      .where('userEmail', '==', userEmail)
      .orderBy('createdAtClient', 'desc')
      .get();
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as Reservation) }));
  } catch (err) {
    console.error('getReservationsForUser error', err);
    throw err;
  }
};

export default {
  saveReservation,
  getReservationsForUser,
};
