// Servicio Firestore para almacenar métodos de pago (simples) por usuario.
// ADVERTENCIA: No almacenar PAN completo en producción. Use tokenización (Stripe, Braintree, etc.).
// Adaptado al mismo patrón que firestoreService usando @react-native-firebase/firestore
import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
const db = firestore();

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
  const col = db.collection('users').doc(userId).collection('paymentMethods');
  const ref = await col.add({ ...method, createdAt: firestore.FieldValue.serverTimestamp() });
  return ref.id;
}

export async function listPaymentMethods(userId: string): Promise<PaymentMethod[]> {
  if (!userId) return [];
  const col = db.collection('users').doc(userId).collection('paymentMethods');
  const snap = await col.get();
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
}

export async function removePaymentMethod(userId: string, methodId: string): Promise<void> {
  if (!userId || !methodId) return;
  await db.collection('users').doc(userId).collection('paymentMethods').doc(methodId).delete();
}
