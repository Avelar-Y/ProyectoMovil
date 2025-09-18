import {
  getFirestore,
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  limit as limitFn,
  startAfter,
  serverTimestamp,
  arrayUnion,
  runTransaction,
  onSnapshot,
} from '@react-native-firebase/firestore';
import type { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';

const db = getFirestore();

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
  finalState?: 'completed' | 'cancelled'; // estado terminal definitivo
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
  const data = { ...cleaned, createdAt: serverTimestamp(), createdAtClient: Date.now() } as any;
  const docRef = await addDoc(collection(db, 'reservations'), data);
  return docRef.id;
  } catch (err) {
    console.error('saveReservation error', err);
    throw err;
  }
};

export const updateReservationStatus = async (reservationId: string, status: Reservation['status']) => {
    try {
      await updateDoc(doc(db, 'reservations', reservationId), { status });
    } catch (err) {
    console.error('updateReservationStatus error', err);
    throw err;
  }
};

export const updatePaymentInfo = async (reservationId: string, paymentInfo: any, paymentStatus?: Reservation['paymentStatus']) => {
  try {
    const payload: any = { paymentInfo };
    if (paymentStatus) payload.paymentStatus = paymentStatus;
    await updateDoc(doc(db, 'reservations', reservationId), payload);
  } catch (err) {
    console.error('updatePaymentInfo error', err);
    throw err;
  }
};

export const getReservationsForUser = async (userEmail: string) : Promise<Reservation[]> => {
  try {
    // Order by client timestamp for immediate visibility; server timestamp will sync later.
    const orderedQuery = query(collection(db, 'reservations'), where('userEmail', '==', userEmail), orderBy('createdAtClient', 'desc'));
    try {
      const snap = await getDocs(orderedQuery);
  return snap.docs.map((d: FirebaseFirestoreTypes.QueryDocumentSnapshot) => ({ id: d.id, ...(d.data() as Reservation) }));
    } catch (err: any) {
      // Si la query falla porque requiere un índice, hacemos un fallback: obtener sin orderBy y ordenar en cliente
      const message = err?.message || '';
      const code = err?.code || '';
      if (code === 'failed-precondition' || /requires an index/i.test(message)) {
        console.warn('Ordered reservations query requires an index, falling back to client-side ordering.');
          const snap = await getDocs(query(collection(db, 'reservations'), where('userEmail', '==', userEmail)));
          const docs = snap.docs.map((d: FirebaseFirestoreTypes.QueryDocumentSnapshot) => ({ id: d.id, ...(d.data() as Reservation) }));
        // Normalizar createdAtClient y createdAt
        const normalized = docs.map((d: Reservation) => {
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
  key?: string;
  tags?: string[];
  active?: boolean;
  duration?: number; // duración estimada en minutos
  // owner/provider information (optional)
  ownerId?: string;
  ownerPhone?: string;
  ownerDisplayName?: string;
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
    const data = { ...cleaned, createdAt: serverTimestamp(), createdAtClient: Date.now() } as any;
  const docRef = await addDoc(collection(db, 'services'), data);
    return docRef.id;
  } catch (err) {
    console.error('saveService error', err);
    throw err;
  }
};

export const getServices = async (): Promise<Service[]> => {
  try {
    const snap = await getDocs(collection(db, 'services'));
    return snap.docs.map((d: FirebaseFirestoreTypes.QueryDocumentSnapshot) => ({ id: d.id, ...(d.data() as Service) }));
  } catch (err) {
    console.error('getServices error', err);
    throw err;
  }
};

export const getServicesForProvider = async (providerId: string): Promise<Service[]> => {
  try {
  const snap = await getDocs(query(collection(db, 'services'), where('ownerId', '==', providerId)));
  return snap.docs.map((d: FirebaseFirestoreTypes.QueryDocumentSnapshot) => ({ id: d.id, ...(d.data() as Service) }));
  } catch (err) {
    console.error('getServicesForProvider error', err);
    throw err;
  }
};

// Activar o desactivar un servicio individual
export const setServiceActive = async (serviceId: string, active: boolean) => {
  try {
    await updateDoc(doc(db, 'services', serviceId), { active, updatedAt: serverTimestamp() });
  } catch (err) {
    console.error('setServiceActive error', err);
    throw err;
  }
};

// Desactivar (o activar) todos los servicios de un proveedor (batch simple secuencial)
export const setAllServicesActiveForProvider = async (providerId: string, active: boolean) => {
  try {
    const services = await getServicesForProvider(providerId);
    for (const s of services) {
      if (!s.id) continue;
      try { await updateDoc(doc(db, 'services', s.id), { active, updatedAt: serverTimestamp() }); } catch (e) { console.warn('batch service update failed', s.id, e); }
    }
  } catch (err) {
    console.error('setAllServicesActiveForProvider error', err);
    throw err;
  }
};

export const getReservationsForService = async (serviceIdOrKey: string) => {
  try {
    const snap = await getDocs(query(collection(db, 'reservations'), where('service', '==', serviceIdOrKey), orderBy('createdAtClient', 'desc')));
    return snap.docs.map((d: FirebaseFirestoreTypes.QueryDocumentSnapshot) => ({ id: d.id, ...(d.data() as any) }));
  } catch (err: any) {
    console.warn('getReservationsForService fallback to unordered fetch', err);
    // fallback without orderBy
    const snap = await getDocs(query(collection(db, 'reservations'), where('service', '==', serviceIdOrKey)));
    return snap.docs.map((d: FirebaseFirestoreTypes.QueryDocumentSnapshot) => ({ id: d.id, ...(d.data() as any) }));
  }
};

export const getUserProfile = async (uid: string) => {
  try {
  const docRef = doc(db, 'users', uid);
  const snap = await getDoc(docRef);
    const exists = snap.exists();
    return exists ? (snap.data() as any) : null;
  } catch (err) {
    console.error('getUserProfile error', err);
    throw err;
  }
};

export const updateUserProfile = async (uid: string, data: Record<string, any>) => {
  try {
  await setDoc(doc(db, 'users', uid), { ...data, updatedAt: serverTimestamp() }, { merge: true });
  } catch (err) {
    console.error('updateUserProfile error', err);
    throw err;
  }
};

// --- Active reservation and messaging helpers ---
export const getActiveReservationForUser = async (uid: string): Promise<Reservation | null> => {
  try {
    const q = query(collection(db, 'reservations'), where('userId', '==', uid), where('status', 'in', ['pending', 'confirmed', 'in_progress']), orderBy('createdAtClient', 'desc'), limitFn(1));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { id: d.id, ...(d.data() as Reservation) };
  } catch (err: any) {
    // if 'in' queries or orderBy requires index, fallback to client filter
    try {
      const snap = await getDocs(query(collection(db, 'reservations'), where('userId', '==', uid)));
  const docs = snap.docs.map((d: FirebaseFirestoreTypes.QueryDocumentSnapshot) => ({ id: d.id, ...(d.data() as Reservation) }));
  const filtered = docs.filter((r: Reservation) => ['pending', 'confirmed', 'in_progress'].includes(r.status || ''));
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
    const q = query(collection(db, 'reservations'), where('providerId', '==', providerId), where('status', 'in', ['pending', 'confirmed', 'in_progress']), orderBy('createdAtClient', 'desc'), limitFn(1));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { id: d.id, ...(d.data() as Reservation) };
  } catch (err: any) {
    // fallback to client-side filter if needed
    try {
      const snap = await getDocs(query(collection(db, 'reservations'), where('providerId', '==', providerId)));
      const docs = snap.docs.map((d: FirebaseFirestoreTypes.QueryDocumentSnapshot) => ({ id: d.id, ...(d.data() as Reservation) }));
  const filtered = docs.filter((r: Reservation) => ['pending', 'confirmed', 'in_progress'].includes(r.status || ''));
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
      const q = query(collection(db, 'reservations'), where('service', 'in', ch), where('status', '==', 'pending'));
      const snap = await getDocs(q);
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
    const snap = await getDocs(query(collection(db, 'reservations'), where('providerId', '==', providerId), where('status', 'in', ['confirmed', 'in_progress'])));
    return snap.docs.map((d: FirebaseFirestoreTypes.QueryDocumentSnapshot) => ({ id: d.id, ...(d.data() as Reservation) }));
  } catch (err: any) {
    // fallback for SDKs that don't allow multiple where in some combinations
    try {
      const snap = await getDocs(query(collection(db, 'reservations'), where('providerId', '==', providerId)));
      const docs = snap.docs.map((d: FirebaseFirestoreTypes.QueryDocumentSnapshot) => ({ id: d.id, ...(d.data() as Reservation) }));
      return docs.filter((r: Reservation) => ['confirmed', 'in_progress'].includes(r.status || ''));
    } catch (e) {
      console.error('getActiveReservationsForProvider fallback error', e);
      throw e;
    }
  }
};

export const listenReservation = (reservationId: string, onChange: (data: Reservation | null) => void) => {
  const ref = doc(db, 'reservations', reservationId);
  const unsub = onSnapshot(ref, snap => {
    if (!snap.exists()) return onChange(null);
    onChange({ id: snap.id, ...(snap.data() as Reservation) });
  }, err => {
    console.warn('listenReservation error', err);
  });
  return unsub;
};

export const listenMessages = (reservationId: string, onMessage: (messages: any[]) => void) => {
  const ref = query(collection(db, 'reservations', reservationId, 'messages'), orderBy('createdAtClient', 'asc'));
  const unsub = onSnapshot(ref as any, snap => {
    const msgs = snap.docs.map((d: FirebaseFirestoreTypes.QueryDocumentSnapshot) => ({ id: d.id, ...(d.data() as any) }));
    onMessage(msgs);
  }, err => {
    console.warn('listenMessages error', err);
  });
  return unsub;
};

// Load messages in pages (most recent last). If startAfterDoc is provided, loads messages before that doc (older messages).
export const loadMessagesPage = async (reservationId: string, limit = 25, startAfterDoc?: FirebaseFirestoreTypes.DocumentSnapshot) => {
  try {
    let q = query(collection(db, 'reservations', reservationId, 'messages'), orderBy('createdAtClient', 'desc'), limitFn(limit));
    if (startAfterDoc) q = query(q, startAfter(startAfterDoc as any));
    const snap = await getDocs(q as any);
    // return in ascending order for rendering
    const docs = snap.docs.map((d: FirebaseFirestoreTypes.QueryDocumentSnapshot) => ({ id: d.id, ...(d.data() as any) }));
    return { messages: docs.reverse(), lastVisible: snap.docs[snap.docs.length - 1] };
  } catch (err) {
    console.error('loadMessagesPage error', err);
    throw err;
  }
};

// Listen only for new messages after a given client timestamp
export const listenNewMessages = (reservationId: string, sinceClientTimestamp: number, onNew: (msgs: any[]) => void) => {
  try {
    const ref = query(collection(db, 'reservations', reservationId, 'messages'), where('createdAtClient', '>', sinceClientTimestamp), orderBy('createdAtClient', 'asc'));
    const unsub = onSnapshot(ref as any, snap => {
      const docs = snap.docs.map((d: FirebaseFirestoreTypes.QueryDocumentSnapshot) => ({ id: d.id, ...(d.data() as any) }));
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
    const payload: any = { ...message, createdAt: serverTimestamp(), createdAtClient: Date.now() };
    const ref = await addDoc(collection(db, 'reservations', reservationId, 'messages'), payload);
    return ref.id;
  } catch (err) {
    console.error('sendMessage error', err);
    throw err;
  }
};

export const cancelReservation = async (reservationId: string, reason?: string) => {
  try {
    const payload: any = { status: 'cancelled', finalState: 'cancelled', updatedAt: serverTimestamp(), cancelledAt: serverTimestamp() };
    if (reason) payload.cancelReason = reason;
    await updateDoc(doc(db, 'reservations', reservationId), payload);
  } catch (err) {
    console.error('cancelReservation error', err);
    throw err;
  }
};

// Versión transaccional que valida estado antes de cancelar (evita race conditions)
export const cancelReservationAtomic = async (reservationId: string, reason?: string, allowed: string[] = ['pending','confirmed']) => {
  try {
    await runTransaction(db, async (tx) => {
      const ref = doc(db, 'reservations', reservationId);
      const snap = await tx.get(ref as any);
      if (!snap.exists()) throw new Error('Reservation not found');
      const data = snap.data() as any;
      const current = data.status || 'pending';
      if (data.finalState) throw new Error('Reservation already finalized');
      if (!allowed.includes(current)) throw new Error('Estado no permite cancelación');
      const update: any = {
        status: 'cancelled',
        finalState: 'cancelled',
        updatedAt: serverTimestamp(),
        cancelledAt: serverTimestamp(),
      };
      if (reason) update.cancelReason = reason;
      tx.update(ref as any, update);
    });
  } catch (err) {
    console.error('cancelReservationAtomic error', err);
    throw err;
  }
};

export const acceptReservation = async (reservationId: string) => {
  try {
    await updateDoc(doc(db, 'reservations', reservationId), { status: 'in_progress', updatedAt: serverTimestamp() });
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
    cleaned.updatedAt = serverTimestamp();
    await setDoc(doc(db, 'reservations', reservationId), cleaned, { merge: true });
  } catch (err) {
    console.error('updateReservation error', err);
    throw err;
  }
};

// Notification helper: write an in-app notification document (clients can listen to this collection)
export const sendInAppNotification = async (toUserId: string | null, payload: { title: string; body?: string; data?: Record<string, any> }) => {
  try {
    const docObj = {
      to: toUserId,
      title: payload.title,
      body: payload.body || '',
      data: payload.data || {},
      read: false,
      createdAt: serverTimestamp(),
    } as any;
    const ref = await addDoc(collection(db, 'notifications'), docObj);
    return ref.id;
  } catch (err) {
    console.error('sendInAppNotification error', err);
    throw err;
  }
};

// Provider accepts a reservation atomically: ensures it was pending and assigns the provider
export const acceptReservationAndAssign = async (reservationId: string, providerId: string) => {
  try {
    await runTransaction(db, async (tx) => {
      const ref = doc(db, 'reservations', reservationId);
      const snap = await tx.get(ref as any);
      if (!snap.exists()) throw new Error('Reservation not found');
      const data = snap.data() as any;
      const status = data.status || 'pending';
      if (status !== 'pending') throw new Error('Reservation is not pending');
      // assign provider and set status
      tx.update(ref as any, {
        providerId,
        assignedAt: serverTimestamp(),
        status: 'in_progress',
        updatedAt: serverTimestamp(),
      });
      // write a notification to the client
      const clientId = data.userId || null;
      if (clientId) {
        tx.set(doc(collection(db, 'notifications')), {
          to: clientId,
          title: 'Tu servicio fue aceptado',
          body: `Tu servicio ha sido aceptado por un proveedor.`,
          data: { reservationId, providerId },
          read: false,
          createdAt: serverTimestamp(),
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
    await updateDoc(doc(db, 'reservations', reservationId), {
      rejectedBy: arrayUnion(providerId),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.error('rejectReservationByProvider error', err);
    throw err;
  }
};

// Provider starts the service (mark started)
export const startService = async (reservationId: string, providerId: string) => {
  try {
    const ref = doc(db, 'reservations', reservationId);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Reservation not found');
    const data = snap.data() as any;
    if (data.providerId !== providerId) throw new Error('Not assigned provider');
    await updateDoc(ref, { status: 'in_progress', startedAt: serverTimestamp(), updatedAt: serverTimestamp() });
  } catch (err) {
    console.error('startService error', err);
    throw err;
  }
};

// Provider marks the service finished
export const finishService = async (reservationId: string, providerId: string) => {
  try {
    const ref = doc(db, 'reservations', reservationId);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Reservation not found');
    const data = snap.data() as any;
    if (data.providerId !== providerId) throw new Error('Not assigned provider');
    await updateDoc(ref, { status: 'completed', finalState: 'completed', finishedAt: serverTimestamp(), updatedAt: serverTimestamp() });
    // notify client that service finished (client should confirm and pay)
    const clientId = data.userId || null;
    if (clientId) {
      await addDoc(collection(db, 'notifications'), {
        to: clientId,
        title: 'Servicio finalizado',
        body: `El proveedor ha marcado el servicio como finalizado. Confirma y califica.`,
        data: { reservationId },
        read: false,
        createdAt: serverTimestamp(),
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
    const payload: any = { status: 'completed', finalState: 'completed', updatedAt: serverTimestamp() };
    if (paymentInfo) {
      payload.paymentInfo = paymentInfo;
      payload.paymentStatus = 'paid';
    }
    await updateDoc(doc(db, 'reservations', reservationId), payload);
  } catch (err) {
    console.error('confirmCompletion error', err);
    throw err;
  }
};

// Save a rating for provider or client related to a reservation
export const saveRating = async (reservationId: string, raterId: string, targetId: string, targetType: 'provider' | 'client', rating: number, comment?: string) => {
  try {
    // Ratings stored under users/{targetId}/ratings
    await addDoc(collection(db, 'users', targetId, 'ratings'), {
      reservationId,
      raterId,
      rating,
      comment: comment || '',
      createdAt: serverTimestamp(),
    });
    // mark reservation that rating was given
    const key = targetType === 'provider' ? 'providerRated' : 'clientRated';
    await updateDoc(doc(db, 'reservations', reservationId), { [key]: true, updatedAt: serverTimestamp() });
  } catch (err) {
    console.error('saveRating error', err);
    throw err;
  }
};

export const getReservationsByProvider = async (providerId: string) : Promise<Reservation[]> => {
  try {
    const snap = await getDocs(query(collection(db, 'reservations'), where('providerId', '==', providerId), orderBy('createdAtClient', 'desc')));
    return snap.docs.map((d: FirebaseFirestoreTypes.QueryDocumentSnapshot) => ({ id: d.id, ...(d.data() as Reservation) }));
  } catch (err: any) {
    console.warn('getReservationsByProvider fallback to unordered fetch', err);
    const snap = await getDocs(query(collection(db, 'reservations'), where('providerId', '==', providerId)));
  const docs = snap.docs.map((d: FirebaseFirestoreTypes.QueryDocumentSnapshot) => ({ id: d.id, ...(d.data() as Reservation) }));
    docs.sort((a: any, b: any) => (b.createdAtClient || 0) - (a.createdAtClient || 0));
    return docs;
  }
};

const defaultExport = {
  saveReservation,
  getReservationsForUser,
  saveService,
  getServices,
  getServicesForProvider,
  setServiceActive,
  setAllServicesActiveForProvider,
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
  cancelReservationAtomic,
  acceptReservation,
  updateReservation,
};

export default defaultExport;
