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
import { geocodeAddressHybrid, computeAddressHash } from './geocodingService';

const db = getFirestore();

// ===================== LEDGER / TRANSACCIONES FINANCIERAS =====================
// Enfoque Option B (ledger completo) seleccionado.
// Creamos documentos en collection 'transactions' por cada reserva pagada (card o cash).
// Idempotencia basada en reservationId + type ('service_payment').
// Esto permitirá reportes de ingresos (provider) y egresos (cliente) sin recalcular.

export interface Transaction {
  id?: string;
  reservationId: string;              // referencia lógica a la reserva
  type: 'service_payment';            // para extensibilidad futura
  method: 'card' | 'cash';
  currency: string;                   // 'HNL'
  amountClientPaid: number;           // total pagado por cliente (breakdown.total)
  providerReceives: number;           // base (price del servicio)
  bookingFee?: number;                // comisión fija
  processingPercent?: number;         // % aplicado (solo card)
  processingAmount?: number;          // monto de comisión %
  base: number;                       // precio listado (subtotal)
  createdAt?: FirebaseFirestoreTypes.Timestamp | null;
  createdAtClient?: number;
  providerId?: string | null;
  clientId?: string | null;
  serviceId?: string | null;
  serviceTitle?: string | null;
  // snapshot redundante para queries offline / integridad histórica
  snapshot?: any;
}

/**
 * Crea (si no existe) una transacción de pago para una reserva ya marcada como paid.
 * Idempotente: si existe un doc con reservationId + type, retorna sin duplicar.
 * Se ejecuta fuera de la transacción principal porque es derivado (eventual consistency aceptable).
 */
export const ensureTransactionForPaidReservation = async (reservationId: string) => {
  if (!reservationId) return;
  try {
    const resRef = doc(db, 'reservations', reservationId);
    const resSnap = await getDoc(resRef);
    if (!resSnap.exists()) return;
    const data: any = resSnap.data();
    const paymentStatus = data.paymentStatus || 'unpaid';
    if (paymentStatus !== 'paid') return; // Solo crear si realmente está pagada

    const method: 'card' | 'cash' = (data.paymentMethod === 'card') ? 'card' : 'cash';
    const breakdown = data.paymentBreakdown || {};
    const base = +((breakdown.base ?? data.amount ?? data.serviceSnapshot?.price) || 0);
    const total = +((breakdown.total ?? base) || 0);
    const providerReceives = +((breakdown.providerReceives ?? base) || 0);
    const bookingFee = typeof breakdown.bookingFee === 'number' ? +breakdown.bookingFee : undefined;
    const processingPercent = typeof breakdown.processingPercent === 'number' ? +breakdown.processingPercent : undefined;
    const processingAmount = typeof breakdown.processingAmount === 'number' ? +breakdown.processingAmount : undefined;
    const currency = breakdown.currency || data.currency || 'HNL';

    // Idempotencia: buscar si ya existe
    const qExisting = query(collection(db, 'transactions'), where('reservationId', '==', reservationId), where('type', '==', 'service_payment'));
    const existingSnap = await getDocs(qExisting);
    if (!existingSnap.empty) return; // ya existe

    const txDoc: Transaction = {
      reservationId,
      type: 'service_payment',
      method,
      currency,
      amountClientPaid: total,
      providerReceives,
      bookingFee,
      processingPercent,
      processingAmount,
      base,
      createdAt: serverTimestamp() as any,
      createdAtClient: Date.now(),
      providerId: data.providerId || null,
      clientId: data.userId || null,
      serviceId: data.service || data.serviceSnapshot?.id || null,
      serviceTitle: data.serviceSnapshot?.title || null,
      snapshot: {
        paymentStatus,
        paymentMethod: method,
        paymentBreakdown: breakdown,
        status: data.status,
        finalState: data.finalState,
      },
    };
    await addDoc(collection(db, 'transactions'), txDoc as any);
  } catch (e) {
    console.warn('ensureTransactionForPaidReservation error', e);
  }
};

// Listar transacciones para un proveedor (paginable por createdAtClient si se requiere)
export const listTransactionsForProvider = async (providerId: string, limitN = 50): Promise<Transaction[]> => {
  if (!providerId) return [];
  try {
    const qRef = query(collection(db, 'transactions'), where('providerId', '==', providerId), orderBy('createdAtClient', 'desc'), limitFn(limitN));
    const snap = await getDocs(qRef as any);
    return snap.docs.map((d: any) => ({ id: d.id, ...(d.data() as Transaction) }));
  } catch (e) {
    console.warn('listTransactionsForProvider error', e); return [];
  }
};

export const listTransactionsForClient = async (clientId: string, limitN = 50): Promise<Transaction[]> => {
  if (!clientId) return [];
  try {
    const qRef = query(collection(db, 'transactions'), where('clientId', '==', clientId), orderBy('createdAtClient', 'desc'), limitFn(limitN));
    const snap = await getDocs(qRef as any);
    return snap.docs.map((d: any) => ({ id: d.id, ...(d.data() as Transaction) }));
  } catch (e) {
    console.warn('listTransactionsForClient error', e); return [];
  }
};

// Agregados simples en cliente (para dataset pequeño). Para volúmenes grandes mover a Cloud Function / BigQuery.
export const aggregateProviderStats = async (providerId: string, period?: { fromTs?: number; toTs?: number }) => {
  const txs = await listTransactionsForProvider(providerId, 500); // límite razonable temporal
  const filtered = txs.filter(t => {
    const ts = (t as any).createdAtClient || 0;
    if (period?.fromTs && ts < period.fromTs) return false;
    if (period?.toTs && ts > period.toTs) return false;
    return true;
  });
  let gross = 0, providerTotal = 0, bookingFees = 0, processing = 0;
  for (const t of filtered) {
    gross += t.amountClientPaid || 0;
    providerTotal += t.providerReceives || 0;
    bookingFees += t.bookingFee || 0;
    processing += t.processingAmount || 0;
  }
  return {
    count: filtered.length,
    gross: +gross.toFixed(2),
    providerReceives: +providerTotal.toFixed(2),
    bookingFees: +bookingFees.toFixed(2),
    processingFees: +processing.toFixed(2),
    netToApp: +(bookingFees + processing).toFixed(2),
  };
};

export const aggregateClientStats = async (clientId: string, period?: { fromTs?: number; toTs?: number }) => {
  const txs = await listTransactionsForClient(clientId, 500);
  const filtered = txs.filter(t => {
    const ts = (t as any).createdAtClient || 0;
    if (period?.fromTs && ts < period.fromTs) return false;
    if (period?.toTs && ts > period.toTs) return false;
    return true;
  });
  let spent = 0;
  for (const t of filtered) spent += t.amountClientPaid || 0;
  return {
    count: filtered.length,
    totalSpent: +spent.toFixed(2),
    avgTicket: filtered.length ? +(spent / filtered.length).toFixed(2) : 0,
  };
};

// ===================== THREADS (Conversaciones unificadas cliente <-> proveedor) =====================
// Un thread representa un único canal entre dos usuarios (participants: [uidA, uidB])
// Los mensajes se guardan en threads/{threadId}/messages
// Tipos de mensaje: 'text' | 'reservation_event'

export type Thread = {
  id?: string;
  participants: string[]; // exactly 2, sorted
  participantInfo?: Record<string, { displayName?: string; avatarUrl?: string; phone?: string }>; // metadata ligera
  lastMessage?: { text?: string; type?: string; createdAtClient?: number };
  lastActivityAt?: FirebaseFirestoreTypes.Timestamp | null;
  createdAt?: FirebaseFirestoreTypes.Timestamp | null;
};

export type ThreadMessage = {
  id?: string;
  type: 'text' | 'reservation_event';
  authorId?: string; // para text
  text?: string; // para text o resumen
  reservationId?: string; // para reservation_event
  snapshot?: any; // snapshot de la reserva (title, price, status)
  dateLabel?: string; // YYYY-MM-DD para mostrar separador
  createdAt?: FirebaseFirestoreTypes.Timestamp | null;
  createdAtClient?: number;
};

const threadIdFor = (a: string, b: string) => {
  const arr = [a, b].sort();
  return `${arr[0]}__${arr[1]}`; // simple determinístico
};

export const getOrCreateThread = async (userA: string, userB: string, participantInfo?: Thread['participantInfo']) => {
  if (!userA || !userB || userA === userB) throw new Error('Participantes inválidos para thread');
  const id = threadIdFor(userA, userB);
  const ref = doc(db, 'threads', id);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref as any);
    if (snap.exists()) {
      // Optionally actualizar participantInfo incremental
      if (participantInfo && Object.keys(participantInfo).length > 0) {
        tx.set(ref as any, { participantInfo, updatedAt: serverTimestamp() }, { merge: true });
      }
      return id;
    }
    const data: Thread = {
      participants: [userA, userB].sort(),
      participantInfo: participantInfo || {},
      createdAt: serverTimestamp() as any,
      lastActivityAt: serverTimestamp() as any,
      lastMessage: { text: 'Conversación iniciada', type: 'system', createdAtClient: Date.now() }
    } as any;
    tx.set(ref as any, data);
    return id;
  });
};

export const sendThreadMessage = async (threadId: string, payload: { authorId: string; text: string }) => {
  if (!threadId) throw new Error('threadId requerido');
  const messagesCol = collection(db, 'threads', threadId, 'messages');
  const msg: ThreadMessage = {
    type: 'text',
    authorId: payload.authorId,
    text: payload.text,
    createdAt: serverTimestamp() as any,
    createdAtClient: Date.now(),
  };
  await addDoc(messagesCol, msg as any);
  await updateDoc(doc(db, 'threads', threadId), {
    lastMessage: { text: payload.text, type: 'text', createdAtClient: msg.createdAtClient },
    lastActivityAt: serverTimestamp(),
  });
};

export const appendReservationEvent = async (threadId: string, data: { reservationId: string; snapshot?: any; status?: string }) => {
  try {
    if (!threadId) return;
    const messagesCol = collection(db, 'threads', threadId, 'messages');
    const today = new Date();
    const dateLabel = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    const text = `Nueva reserva (${data.snapshot?.title || data.reservationId})`;
    const msg: ThreadMessage = {
      type: 'reservation_event',
      reservationId: data.reservationId,
      snapshot: data.snapshot || {},
      text,
      dateLabel,
      createdAt: serverTimestamp() as any,
      createdAtClient: Date.now(),
    };
    await addDoc(messagesCol, msg as any);
    await updateDoc(doc(db, 'threads', threadId), {
      lastMessage: { text, type: 'reservation_event', createdAtClient: msg.createdAtClient },
      lastActivityAt: serverTimestamp(),
    });
  } catch (e) {
    console.warn('appendReservationEvent error', e);
  }
};

export const listThreadsForUser = async (uid: string): Promise<Thread[]> => {
  try {
    if (!uid) return [];
    // query threads where array-contains participants contains uid
    const q = query(collection(db, 'threads'), where('participants', 'array-contains', uid));
    const snap = await getDocs(q);
  const list: Thread[] = snap.docs.map((d: FirebaseFirestoreTypes.QueryDocumentSnapshot) => ({ id: d.id, ...(d.data() as any) }));
    // Sort by lastActivityAt / fallback lastMessage.createdAtClient
    list.sort((a: any, b: any) => {
      const ta = a.lastMessage?.createdAtClient || 0;
      const tb = b.lastMessage?.createdAtClient || 0;
      return tb - ta;
    });
    return list;
  } catch (e) {
    console.warn('listThreadsForUser error', e);
    return [];
  }
};

export const listenThreadMessages = (threadId: string, onChange: (msgs: ThreadMessage[]) => void) => {
  if (!threadId) return () => {};
  const ref = query(collection(db, 'threads', threadId, 'messages'), orderBy('createdAtClient', 'asc'));
  const unsub = onSnapshot(ref as any, snap => {
    const msgs = snap.docs.map((d: FirebaseFirestoreTypes.QueryDocumentSnapshot) => ({ id: d.id, ...(d.data() as any) })) as ThreadMessage[];
    onChange(msgs);
  }, err => console.warn('listenThreadMessages error', err));
  return unsub;
};

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
  // Ubicaciones y tracking
  providerLocation?: { lat: number; lng: number; updatedAt?: any } | null;
  clientLocation?: { lat: number; lng: number; updatedAt?: any } | null;
  // Información de ruta dinámica (texto humano devuelto por Directions API)
  routeDistanceText?: string;
  routeDurationText?: string;
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
  if (!(cleaned as any).currency) (cleaned as any).currency = 'HNL';
  const data = { ...cleaned, createdAt: serverTimestamp(), createdAtClient: Date.now() } as any;
  const docRef = await addDoc(collection(db, 'reservations'), data);
  return docRef.id;
  } catch (err) {
    console.error('saveReservation error', err);
    throw err;
  }
};

/**
 * DEPRECATED: No usar para transiciones críticas (accept/start) porque no aplica validaciones de exclusividad.
 * Mantener solo para cambios secundarios (ej: marcar 'completed' en migraciones puntuales) si fuera necesario.
 * Si se intenta mover a 'confirmed' o 'in_progress' lanza error para forzar uso de flujo nuevo.
 */
export const updateReservationStatus = async (reservationId: string, status: Reservation['status']) => {
  if (['confirmed','in_progress'].includes(status as string)) {
    throw new Error('updateReservationStatus deprecated: usa acceptReservationExclusive/startService');
  }
  try {
    await updateDoc(doc(db, 'reservations', reservationId), { status, updatedAt: serverTimestamp() });
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
  if (!(cleaned as any).currency) (cleaned as any).currency = 'HNL';
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

// Escucha únicamente cambios de providerLocation (y updatedAt opcional) para reducir re-renders pesados.
// Retorna unsubscribe y llama al callback con { lat, lng, updatedAt } o null si se elimina.
export const listenProviderLocation = (reservationId: string, onLoc: (loc: { lat: number; lng: number; updatedAt?: any } | null) => void) => {
  if (!reservationId) return () => {};
  const ref = doc(db, 'reservations', reservationId);
  const unsub = onSnapshot(ref, snap => {
    if (!snap.exists()) { onLoc(null); return; }
    const data: any = snap.data();
    const loc = data?.providerLocation;
    if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
      onLoc(loc);
    } else {
      onLoc(null);
    }
  }, err => console.warn('listenProviderLocation error', err));
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
    const ref = doc(db, 'reservations', reservationId);
    await updateDoc(ref, payload);
    try {
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data: any = snap.data();
        if (data.providerId) await clearActiveReservationForProvider(data.providerId, reservationId);
      }
    } catch(e){ console.warn('cancelReservation sentinel cleanup error', e); }
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
      const providerId = data.providerId;
      if (providerId) {
        const userRef = doc(db, 'users', providerId);
        const userSnap = await tx.get(userRef as any);
        if (userSnap.exists()) {
          const udata = userSnap.data() as any;
          if (udata.activeReservationId === reservationId) {
            tx.update(userRef as any, { activeReservationId: null, updatedAt: serverTimestamp() });
          }
        }
      }
    });
  } catch (err) {
    console.error('cancelReservationAtomic error', err);
    throw err;
  }
};

/**
 * DEPRECATED: acceptReservation saltaba directo a in_progress sin validar exclusividad.
 * Dejar para compatibilidad; lanza error siempre para detectar usos residuales en UI.
 */
export const acceptReservation = async (_reservationId: string) => {
  throw new Error('acceptReservation deprecated: usa acceptReservationExclusive');
};

// --- NUEVA LÓGICA DE EXCLUSIVIDAD ---
// Un proveedor solo puede tener UNA reserva activa (status confirmed | in_progress) a la vez.
// Guardamos un sentinel en users/{providerId}.activeReservationId.
// Aceptar: transacción que verifica que la reserva está pending y que el proveedor no tiene otra.
// Liberación: al completar o cancelar se limpia el sentinel si coincide.

export const acceptReservationExclusive = async (reservationId: string, providerId: string) => {
  
    await runTransaction(db, async (tx) => {
      const resRef = doc(db, 'reservations', reservationId);
      const userRef = doc(db, 'users', providerId);
      const resSnap = await tx.get(resRef as any);
      if (!resSnap.exists()) throw new Error('Reserva no encontrada');
      const resData = resSnap.data() as any;
      const currentStatus = resData.status || 'pending';
      if (currentStatus !== 'pending') throw new Error('La reserva ya no está pendiente');
      const alreadyAssigned = resData.providerId && resData.providerId !== providerId;
      if (alreadyAssigned) throw new Error('La reserva fue asignada a otro proveedor');

      const userSnap = await tx.get(userRef as any);
      const userData = userSnap.exists() ? (userSnap.data() as any) : {};
      const activeReservationId = userData.activeReservationId || null;
      if (activeReservationId && activeReservationId !== reservationId) {
        throw new Error('Ya tienes otra reserva activa. Debes finalizarla o cancelarla antes de aceptar una nueva.');
      }

      // Actualizar reserva -> confirmed (flujo: luego proveedor presiona "Iniciar" para in_progress)
      tx.update(resRef as any, {
        providerId,
        status: 'confirmed',
        assignedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Crear / actualizar perfil de usuario con sentinel
      if (userSnap.exists()) {
        tx.update(userRef as any, { activeReservationId: reservationId, providerActiveAssignedAt: serverTimestamp(), updatedAt: serverTimestamp() });
      } else {
        tx.set(userRef as any, { activeReservationId: reservationId, providerActiveAssignedAt: serverTimestamp(), createdAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });
      }

      // Notificación al cliente
      const clientId = resData.userId || null;
      if (clientId) {
        tx.set(doc(collection(db, 'notifications')), {
          to: clientId,
          title: 'Tu servicio fue aceptado',
            body: 'Un proveedor aceptó tu servicio.',
          data: { reservationId, providerId },
          read: false,
          createdAt: serverTimestamp(),
        } as any);
      }
    });
  
};

// Limpia el sentinel si todavía apunta a esa reserva (se usa al completar/cancelar)
export const clearActiveReservationForProvider = async (providerId: string, reservationId: string) => {
  if (!providerId) return;
  try {
    await runTransaction(db, async (tx) => {
      const userRef = doc(db, 'users', providerId);
      const snap = await tx.get(userRef as any);
      if (!snap.exists()) return; // nada que limpiar
      const data = snap.data() as any;
      if (data.activeReservationId === reservationId) {
        tx.update(userRef as any, { activeReservationId: null, updatedAt: serverTimestamp() });
      }
    });
  } catch (e) {
    console.warn('clearActiveReservationForProvider error', e);
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
    // Liberar sentinel si corresponde (proveedor marcó como finalizado antes de confirmación del cliente)
    try { await clearActiveReservationForProvider(providerId, reservationId); } catch(e){ console.warn('finishService clear sentinel', e); }
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
export const confirmCompletion = async (reservationId: string, options?: { paymentInfo?: any; paymentMethod?: 'card' | 'cash'; breakdown?: any; markPaid?: boolean }) => {
  try {
    const ref = doc(db, 'reservations', reservationId);
    let providerId: string | null = null;
    let updated = false;
    let becamePaid = false; // bandera para crear transacción luego
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref as any);
      if (!snap.exists()) throw new Error('Reservation not found');
      const data = snap.data() as any;
      providerId = data.providerId || null;
      const currentPaymentStatus = data.paymentStatus || 'unpaid';
      const currentStatus = data.status || 'pending';
      // Idempotencia: si ya está pagado no hacemos nada.
      if (currentPaymentStatus === 'paid') {
        return; // nada que modificar
      }
      const update: any = { updatedAt: serverTimestamp() };
      // Si aún no está marcada como completada, marcarla.
      if (currentStatus !== 'completed') {
        update.status = 'completed';
      }
      update.finalState = 'completed';
      if (options?.paymentInfo) update.paymentInfo = options.paymentInfo;
      if (options?.paymentMethod) update.paymentMethod = options.paymentMethod;
      if (options?.breakdown) update.paymentBreakdown = options.breakdown;
      if (options?.paymentMethod === 'cash') {
        // cash puede quedar pendiente a menos que explícitamente se marque pagado
        update.paymentStatus = options.markPaid ? 'paid' : 'pending';
        if (options.markPaid) becamePaid = true;
      } else if (options?.paymentMethod === 'card') {
        update.paymentStatus = 'paid';
        becamePaid = true;
      } else if (!options?.paymentMethod && !data.paymentMethod) {
        // fallback: si no se envía método, mantener o establecer unpaid
        update.paymentStatus = currentPaymentStatus;
      }
      tx.update(ref as any, update);
      updated = true;
    });
    // Limpiar sentinel sólo si actualizamos algo y se completó pago/estado
    if (updated && providerId) {
      try { await clearActiveReservationForProvider(providerId, reservationId); } catch (e) { console.warn('confirmCompletion clear sentinel', e); }
    }
    // Crear transacción si pasó a pagado
    if (becamePaid) {
      try { await ensureTransactionForPaidReservation(reservationId); } catch(e){ console.warn('ledger creation (confirmCompletion)', e); }
    }
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

export const updateReservation = async (reservationId: string, updates: Partial<Reservation>) => {
  try {
    await updateDoc(doc(db, 'reservations', reservationId), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.error('updateReservation error', err);
    throw err;
  }
};

// Obtener una reserva puntual (lectura única)
export const getReservationById = async (reservationId: string): Promise<Reservation | null> => {
  try {
    if (!reservationId) return null;
    const ref = doc(db, 'reservations', reservationId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return { id: snap.id, ...(snap.data() as Reservation) };
  } catch (err) {
    console.error('getReservationById error', err);
    throw err;
  }
};

// Transición para pagos en efectivo: pasar de pending -> paid de forma idempotente
export const markCashPaymentAsPaid = async (reservationId: string, actorProviderId: string) => {
  try {
    let becamePaid = false;
    await runTransaction(db, async (tx) => {
      const ref = doc(db, 'reservations', reservationId);
      const snap = await tx.get(ref as any);
      if (!snap.exists()) throw new Error('Reservation not found');
      const data = snap.data() as any;
      if (data.providerId !== actorProviderId) throw new Error('No autorizado');
      const method = data.paymentMethod || 'cash';
      if (method !== 'cash') throw new Error('La reserva no es de efectivo');
      const current = data.paymentStatus || 'unpaid';
      if (current === 'paid') return; // idempotente
      if (current !== 'pending' && current !== 'unpaid') throw new Error('Estado de pago inválido');
      tx.update(ref as any, { paymentStatus: 'paid', updatedAt: serverTimestamp(), paidAt: serverTimestamp() });
      becamePaid = true;
    });
    if (becamePaid) {
      try { await ensureTransactionForPaidReservation(reservationId); } catch(e){ console.warn('ledger creation (cashPaid)', e); }
    }
  } catch (err) {
    console.error('markCashPaymentAsPaid error', err);
    throw err;
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
  listenProviderLocation,
  listenMessages,
  sendMessage,
  cancelReservation,
  cancelReservationAtomic,
  acceptReservation,
  acceptReservationExclusive,
  clearActiveReservationForProvider,
  confirmCompletion,
  markCashPaymentAsPaid,
  ensureTransactionForPaidReservation,
  listTransactionsForProvider,
  listTransactionsForClient,
  aggregateProviderStats,
  aggregateClientStats,
  saveRating,
  sendInAppNotification,
  // threads
  getOrCreateThread,
  sendThreadMessage,
  updateReservation,
  appendReservationEvent,
  listThreadsForUser,
  listenThreadMessages,
  getReservationById,
};

export default defaultExport;

