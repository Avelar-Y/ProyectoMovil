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
  // provider / assignment fields
  providerId?: string;
  providerPhone?: string;
  providerDisplayName?: string;
  rejectedBy?: string[];
  assignedAt?: FirebaseFirestoreTypes.Timestamp | null;
  startedAt?: FirebaseFirestoreTypes.Timestamp | null;
  finishedAt?: FirebaseFirestoreTypes.Timestamp | null;
  updatedAt?: FirebaseFirestoreTypes.Timestamp | null;
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
  // owner/provider information (optional)
  ownerId?: string;
  ownerPhone?: string;
  ownerDisplayName?: string;
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

export const getServicesForProvider = async (providerId: string): Promise<Service[]> => {
  try {
    const snap = await firestore().collection('services').where('ownerId', '==', providerId).get();
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as Service) }));
  } catch (err) {
    console.error('getServicesForProvider error', err);
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

export const getActiveReservationForProvider = async (providerId: string): Promise<Reservation | null> => {
  try {
    const snap = await firestore()
      .collection('reservations')
      .where('providerId', '==', providerId)
      .where('status', 'in', ['pending', 'confirmed', 'in_progress'])
      .orderBy('createdAtClient', 'desc')
      .limit(1)
      .get();
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { id: d.id, ...(d.data() as Reservation) };
  } catch (err: any) {
    // fallback to client-side filter if needed
    try {
      const snap = await firestore().collection('reservations').where('providerId', '==', providerId).get();
      const docs = snap.docs.map(d => ({ id: d.id, ...(d.data() as Reservation) }));
      const filtered = docs.filter(r => ['pending', 'confirmed', 'in_progress'].includes(r.status || ''));
      filtered.sort((a: any, b: any) => (b.createdAtClient || 0) - (a.createdAtClient || 0));
      return filtered.length > 0 ? filtered[0] : null;
    } catch (e) {
      console.error('getActiveReservationForProvider fallback error', e);
      throw e;
    }
  }
};

// Get pending reservations that are available for a given provider.
export const getPendingReservationsForProvider = async (providerId: string): Promise<Reservation[]> => {
  try {
    // Only consider reservations that target services owned by this provider
    const services = await getServicesForProvider(providerId);
    const serviceIds = (services || []).map(s => s.id).filter(Boolean) as string[];
    if (!serviceIds || serviceIds.length === 0) return [];

    // Firestore 'in' supports up to 10 values; chunk if necessary
    const chunkSize = 10;
    const chunks: string[][] = [];
    for (let i = 0; i < serviceIds.length; i += chunkSize) chunks.push(serviceIds.slice(i, i + chunkSize));

    const results: Reservation[] = [];
    for (const ch of chunks) {
      const q = firestore().collection('reservations').where('service', 'in', ch).where('status', '==', 'pending');
      const snap = await q.get();
      for (const d of snap.docs) {
        results.push({ id: d.id, ...(d.data() as Reservation) });
      }
    }

    // Remove duplicates (in case) and filter out reservations where this provider already rejected or is excluded
    const seen = new Set<string>();
    const filtered = results.filter(r => {
      if (!r.id) return false;
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      const rej = Array.isArray((r as any).rejectedBy) ? (r as any).rejectedBy : [];
      const providerAssigned = (r as any).providerId;
      if (rej.includes(providerId)) return false;
      if (providerAssigned && providerAssigned !== providerId) return false;
      return true;
    });

    return filtered;
  } catch (err) {
    console.error('getPendingReservationsForProvider error', err);
    throw err;
  }
};

// Get active reservations (accepted/confirmed/in_progress) for this provider
export const getActiveReservationsForProvider = async (providerId: string): Promise<Reservation[]> => {
  try {
    const snap = await firestore()
      .collection('reservations')
      .where('providerId', '==', providerId)
      .where('status', 'in', ['confirmed', 'in_progress'])
      .get();
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as Reservation) }));
  } catch (err: any) {
    // fallback for SDKs that don't allow multiple where in some combinations
    try {
      const snap = await firestore().collection('reservations').where('providerId', '==', providerId).get();
      const docs = snap.docs.map(d => ({ id: d.id, ...(d.data() as Reservation) }));
      return docs.filter(r => ['confirmed', 'in_progress'].includes(r.status || ''));
    } catch (e) {
      console.error('getActiveReservationsForProvider fallback error', e);
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
    const payload: any = { status: 'cancelled', updatedAt: firestore.FieldValue.serverTimestamp(), cancelledAt: firestore.FieldValue.serverTimestamp() };
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

export const updateReservation = async (reservationId: string, data: Record<string, any>) => {
  try {
    // sanitize undefined fields
    const cleaned: any = {};
    for (const k of Object.keys(data)) {
      if (data[k] !== undefined) cleaned[k] = data[k];
    }
    cleaned.updatedAt = firestore.FieldValue.serverTimestamp();
    await firestore().collection('reservations').doc(reservationId).set(cleaned, { merge: true });
  } catch (err) {
    console.error('updateReservation error', err);
    throw err;
  }
};

// Notification helper: write an in-app notification document (clients can listen to this collection)
export const sendInAppNotification = async (toUserId: string | null, payload: { title: string; body?: string; data?: Record<string, any> }) => {
  try {
    const doc = {
      to: toUserId,
      title: payload.title,
      body: payload.body || '',
      data: payload.data || {},
      read: false,
      createdAt: firestore.FieldValue.serverTimestamp(),
    } as any;
    const ref = await firestore().collection('notifications').add(doc);
    return ref.id;
  } catch (err) {
    console.error('sendInAppNotification error', err);
    throw err;
  }
};

// Provider accepts a reservation atomically: ensures it was pending and assigns the provider
export const acceptReservationAndAssign = async (reservationId: string, providerId: string) => {
  try {
    await firestore().runTransaction(async (tx) => {
      const ref = firestore().collection('reservations').doc(reservationId);
      const snap = await tx.get(ref as any);
      if (!snap.exists) throw new Error('Reservation not found');
      const data = snap.data() as any;
      const status = data.status || 'pending';
      if (status !== 'pending') throw new Error('Reservation is not pending');
      // assign provider and set status
      tx.update(ref as any, {
        providerId,
        assignedAt: firestore.FieldValue.serverTimestamp(),
        status: 'in_progress',
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
      // write a notification to the client
      const clientId = data.userId || null;
      if (clientId) {
        tx.set(firestore().collection('notifications').doc(), {
          to: clientId,
          title: 'Tu servicio fue aceptado',
          body: `Tu servicio ha sido aceptado por un proveedor.`,
          data: { reservationId, providerId },
          read: false,
          createdAt: firestore.FieldValue.serverTimestamp(),
        } as any);
      }
    });
  } catch (err) {
    console.error('acceptReservationAndAssign error', err);
    throw err;
  }
};

// Provider rejects a reservation: mark in rejectedBy array so we don't offer it repeatedly
export const rejectReservationByProvider = async (reservationId: string, providerId: string) => {
  try {
    await firestore().collection('reservations').doc(reservationId).update({
      rejectedBy: firestore.FieldValue.arrayUnion(providerId),
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error('rejectReservationByProvider error', err);
    throw err;
  }
};

// Provider starts the service (mark started)
export const startService = async (reservationId: string, providerId: string) => {
  try {
    const ref = firestore().collection('reservations').doc(reservationId);
    const snap = await ref.get();
    if (!snap.exists) throw new Error('Reservation not found');
    const data = snap.data() as any;
    if (data.providerId !== providerId) throw new Error('Not assigned provider');
    await ref.update({ status: 'in_progress', startedAt: firestore.FieldValue.serverTimestamp(), updatedAt: firestore.FieldValue.serverTimestamp() });
  } catch (err) {
    console.error('startService error', err);
    throw err;
  }
};

// Provider marks the service finished
export const finishService = async (reservationId: string, providerId: string) => {
  try {
    const ref = firestore().collection('reservations').doc(reservationId);
    const snap = await ref.get();
    if (!snap.exists) throw new Error('Reservation not found');
    const data = snap.data() as any;
    if (data.providerId !== providerId) throw new Error('Not assigned provider');
    await ref.update({ status: 'completed', finishedAt: firestore.FieldValue.serverTimestamp(), updatedAt: firestore.FieldValue.serverTimestamp() });
    // notify client that service finished (client should confirm and pay)
    const clientId = data.userId || null;
    if (clientId) {
      await firestore().collection('notifications').add({
        to: clientId,
        title: 'Servicio finalizado',
        body: `El proveedor ha marcado el servicio como finalizado. Confirma y califica.`,
        data: { reservationId },
        read: false,
        createdAt: firestore.FieldValue.serverTimestamp(),
      } as any);
    }
  } catch (err) {
    console.error('finishService error', err);
    throw err;
  }
};

// Client confirms completion and optionally pays
export const confirmCompletion = async (reservationId: string, paymentInfo?: any) => {
  try {
    const payload: any = { status: 'completed', updatedAt: firestore.FieldValue.serverTimestamp() };
    if (paymentInfo) {
      payload.paymentInfo = paymentInfo;
      payload.paymentStatus = 'paid';
    }
    await firestore().collection('reservations').doc(reservationId).update(payload);
  } catch (err) {
    console.error('confirmCompletion error', err);
    throw err;
  }
};

// Save a rating for provider or client related to a reservation
export const saveRating = async (reservationId: string, raterId: string, targetId: string, targetType: 'provider' | 'client', rating: number, comment?: string) => {
  try {
    // Ratings stored under users/{targetId}/ratings
    await firestore().collection('users').doc(targetId).collection('ratings').add({
      reservationId,
      raterId,
      rating,
      comment: comment || '',
      createdAt: firestore.FieldValue.serverTimestamp(),
    });
    // mark reservation that rating was given
    const key = targetType === 'provider' ? 'providerRated' : 'clientRated';
    await firestore().collection('reservations').doc(reservationId).update({ [key]: true, updatedAt: firestore.FieldValue.serverTimestamp() });
  } catch (err) {
    console.error('saveRating error', err);
    throw err;
  }
};

const defaultExport = {
  saveReservation,
  getReservationsForUser,
  saveService,
  getServices,
  getServicesForProvider,
  getActiveReservationForUser,
  getPendingReservationsForProvider,
  getActiveReservationsForProvider,
  acceptReservationAndAssign,
  rejectReservationByProvider,
  startService,
  finishService,
  listenReservation,
  listenMessages,
  sendMessage,
  cancelReservation,
  acceptReservation,
  updateReservation,
};

export default defaultExport;
