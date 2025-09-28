// Servicio Firestore para almacenar métodos de pago (simples) por usuario.
// Migrado a la API modular (getFirestore/collection/doc/addDoc) para evitar deprecaciones.
// ADVERTENCIA: No almacenar PAN completo en producción. Use tokenización (Stripe, Braintree, etc.).
import { getFirestore, collection, doc, addDoc, getDocs, deleteDoc, serverTimestamp } from '@react-native-firebase/firestore';
const db = getFirestore();

export interface PaymentMethod {
  id?: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  holderName: string;
  createdAt?: any;
}

export async function addPaymentMethod(userId: string, method: Omit<PaymentMethod,'id'|'createdAt'>) : Promise<string> {
  if (!userId) throw new Error('userId requerido');
  const colRef = collection(db, 'users', userId, 'paymentMethods');
  const ref = await addDoc(colRef, { ...method, createdAt: serverTimestamp() });
  return ref.id;
}

export async function listPaymentMethods(userId: string): Promise<PaymentMethod[]> {
  if (!userId) return [];
  const colRef = collection(db, 'users', userId, 'paymentMethods');
  const snap = await getDocs(colRef as any);
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
}

export async function removePaymentMethod(userId: string, methodId: string): Promise<void> {
  if (!userId || !methodId) return;
  const ref = doc(db, 'users', userId, 'paymentMethods', methodId);
  await deleteDoc(ref as any);
}
