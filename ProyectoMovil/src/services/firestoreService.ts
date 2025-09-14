import firestore from '@react-native-firebase/firestore';

type Reservation = {
  id?: string;
  userEmail: string;
  service: string;
  name: string;
  date: string;
  note?: string;
  createdAt: FirebaseFirestoreTypes.Timestamp | any;
};

export const saveReservation = async (reservation: Omit<Reservation, 'id' | 'createdAt'>) => {
  const data = { ...reservation, createdAt: firestore.FieldValue.serverTimestamp() } as any;
  const docRef = await firestore().collection('reservations').add(data);
  return docRef.id;
};

export const getReservationsForUser = async (userEmail: string) => {
  const snap = await firestore()
    .collection('reservations')
    .where('userEmail', '==', userEmail)
    .orderBy('createdAt', 'desc')
    .get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export default {
  saveReservation,
  getReservationsForUser,
};
