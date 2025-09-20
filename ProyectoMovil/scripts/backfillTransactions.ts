// Script de backfill: genera transacciones faltantes para reservas pagadas.
// Ejecutar en contexto de app (RN) llamando esta función desde un debug screen o temporalmente.
// Requiere que reglas permitan lectura y creación de transactions (ya ajustado).

import { getFirestore, collection, getDocs, query, where } from '@react-native-firebase/firestore';
import { ensureTransactionForPaidReservation } from '../src/services/firestoreService';

export async function backfillTransactions(limitBatch = 200) {
  const db = getFirestore();
  const qPaid = query(collection(db, 'reservations'), where('paymentStatus', '==', 'paid'));
  const snap = await getDocs(qPaid as any);
  let created = 0;
  for (const docSnap of snap.docs.slice(0, limitBatch)) {
    try { await ensureTransactionForPaidReservation(docSnap.id); created++; } catch(e){ console.warn('backfill reservation', docSnap.id, e); }
  }
  return created;
}

// Ejemplo de uso temporal:
// backfillTransactions().then(c => console.log('Transacciones creadas', c));
