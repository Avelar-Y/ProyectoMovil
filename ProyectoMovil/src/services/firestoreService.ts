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
    // sanitize reservation object: remove undefined fields (Firestore rejects undefined)
    const sanitize = (v: any): any => {
      if (v === undefined) return undefined;
      if (v === null) return null;
      if (Array.isArray(v)) {
        const arr = v.map(sanitize).filter(x => x !== undefined);
        return arr;
      }
      if (typeof v === 'object') {
        // If it's a Firestore sentinel (FieldValue), return as-is
        // Heuristic: FieldValue has a toString that includes 'FieldValue' in RNFirebase, but safe approach is to
        // keep any object that does not have own enumerable properties to avoid stripping sentinels.
        const keys = Object.keys(v || {});
        if (keys.length === 0) return v;
        const out: any = {};
        for (const k of keys) {
          const val = sanitize(v[k]);
          if (val !== undefined) out[k] = val;
        }
        return out;
      }
      return v;
    };

    const cleaned = sanitize(reservation);
    const data = { ...cleaned, createdAt: firestore.FieldValue.serverTimestamp(), createdAtClient: Date.now() } as any;
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
    // sanitize service: remove undefined fields recursively
    const sanitize = (v: any): any => {
      if (v === undefined) return undefined;
      if (v === null) return null;
      if (Array.isArray(v)) {
        const arr = v.map(sanitize).filter(x => x !== undefined);
        return arr.length === 0 ? undefined : arr;
      }
      if (typeof v === 'object') {
        const keys = Object.keys(v || {});
        if (keys.length === 0) return v;
        const out: any = {};
        for (const k of keys) {
          const val = sanitize(v[k]);
          if (val !== undefined) out[k] = val;
        }
        return Object.keys(out).length === 0 ? undefined : out;
      }
      return v;
    };

    const cleaned = sanitize(service) || {};
    const data = { ...cleaned, createdAt: firestore.FieldValue.serverTimestamp(), createdAtClient: Date.now() } as any;
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

// --- Active reservation and messaging helpers ---
export const getActiveReservationForUser = async (uid: string): Promise<Reservation | null> => {
  try {
    const snap = await firestore()
      .collection('reservations')
      .where('userId', '==', uid)
      .where('status', 'in', ['pending', 'confirmed', 'in_progress'])
      .orderBy('createdAtClient', 'desc')
      .limit(1)
      .get();
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { id: d.id, ...(d.data() as Reservation) };
  } catch (err: any) {
    // if 'in' queries or orderBy requires index, fallback to client filter
    try {
      const snap = await firestore().collection('reservations').where('userId', '==', uid).get();
      const docs = snap.docs.map(d => ({ id: d.id, ...(d.data() as Reservation) }));
      const filtered = docs.filter(r => ['pending', 'confirmed', 'in_progress'].includes(r.status || ''));
      filtered.sort((a: any, b: any) => (b.createdAtClient || 0) - (a.createdAtClient || 0));
      return filtered.length > 0 ? filtered[0] : null;
    } catch (e) {
      console.error('getActiveReservationForUser fallback error', e);
      throw e;
    }
  }
};

export const listenReservation = (reservationId: string, onChange: (data: Reservation | null) => void) => {
  const ref = firestore().collection('reservations').doc(reservationId);
  const unsub = ref.onSnapshot(snap => {
    if (!snap.exists) return onChange(null);
    onChange({ id: snap.id, ...(snap.data() as Reservation) });
  }, err => {
    console.warn('listenReservation error', err);
  });
  return unsub;
};

export const listenMessages = (reservationId: string, onMessage: (messages: any[]) => void) => {
  const ref = firestore().collection('reservations').doc(reservationId).collection('messages').orderBy('createdAtClient', 'asc');
  const unsub = ref.onSnapshot(snap => {
    const msgs = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
    onMessage(msgs);
  }, err => {
    console.warn('listenMessages error', err);
  });
  return unsub;
};

// Load messages in pages (most recent last). If startAfterDoc is provided, loads messages before that doc (older messages).
export const loadMessagesPage = async (reservationId: string, limit = 25, startAfterDoc?: FirebaseFirestoreTypes.DocumentSnapshot) => {
  try {
    let q = firestore().collection('reservations').doc(reservationId).collection('messages').orderBy('createdAtClient', 'desc').limit(limit);
    if (startAfterDoc) q = q.startAfter(startAfterDoc);
    const snap = await q.get();
    // return in ascending order for rendering
    const docs = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
    return { messages: docs.reverse(), lastVisible: snap.docs[snap.docs.length - 1] };
  } catch (err) {
    console.error('loadMessagesPage error', err);
    throw err;
  }
};

// Listen only for new messages after a given client timestamp
export const listenNewMessages = (reservationId: string, sinceClientTimestamp: number, onNew: (msgs: any[]) => void) => {
  try {
    const ref = firestore().collection('reservations').doc(reservationId).collection('messages')
      .where('createdAtClient', '>', sinceClientTimestamp)
      .orderBy('createdAtClient', 'asc');
    const unsub = ref.onSnapshot(snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      onNew(docs);
    }, err => console.warn('listenNewMessages error', err));
    return unsub;
  } catch (err) {
    console.error('listenNewMessages setup error', err);
    throw err;
  }
};

export const sendMessage = async (reservationId: string, message: { authorId?: string; text: string; attachments?: string[] }) => {
  try {
    const payload: any = { ...message, createdAt: firestore.FieldValue.serverTimestamp(), createdAtClient: Date.now() };
    const ref = await firestore().collection('reservations').doc(reservationId).collection('messages').add(payload);
    return ref.id;
  } catch (err) {
    console.error('sendMessage error', err);
    throw err;
  }
};

export const cancelReservation = async (reservationId: string, reason?: string) => {
  try {
    const payload: any = { status: 'cancelled', updatedAt: firestore.FieldValue.serverTimestamp() };
    if (reason) payload.cancelReason = reason;
    await firestore().collection('reservations').doc(reservationId).update(payload);
  } catch (err) {
    console.error('cancelReservation error', err);
    throw err;
  }
};

export const acceptReservation = async (reservationId: string) => {
  try {
    await firestore().collection('reservations').doc(reservationId).update({ status: 'in_progress', updatedAt: firestore.FieldValue.serverTimestamp() });
  } catch (err) {
    console.error('acceptReservation error', err);
    throw err;
  }
};

const defaultExport = {
  saveReservation,
  getReservationsForUser,
  saveService,
  getServices,
  getActiveReservationForUser,
  listenReservation,
  listenMessages,
  sendMessage,
  cancelReservation,
  acceptReservation,
};

export default defaultExport;
