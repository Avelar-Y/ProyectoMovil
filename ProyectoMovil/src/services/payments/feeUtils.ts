import { APP_COMMISSION_PERCENT } from '@env';

export interface PaymentBreakdown {
  currency: string;            // 'HNL'
  base: number;                // precio del servicio
  bookingFee: number;          // comisión fija de reservación (aplica en ambos métodos si se define)
  processingPercent: number;   // % sólo para tarjeta
  processingAmount: number;    // monto % para tarjeta
  total: number;               // total que paga el cliente
  providerReceives: number;    // lo que recibe el proveedor
  method: 'card' | 'cash';
}

// Reglas solicitadas:
// - Moneda: HNL.
// - Si método = cash: sólo se cobra la comisión de reservación (bookingFee). No hay porcentaje adicional.
// - Si método = card: bookingFee + porcentaje (APP_COMMISSION_PERCENT) sobre base.
// - El proveedor recibe siempre el base (precio listado), no se le descuenta bookingFee ni processing.
// - bookingFee configurable aquí (puede extraerse de env si se desea).
const BOOKING_FEE_HNL = 5; // Comisión fija ejemplo (HNL). Ajustar según negocio.

export function computePaymentBreakdown(base: number, method: 'card' | 'cash'): PaymentBreakdown {
  const safeBase = +(base || 0).toFixed(2);
  const pct = parseFloat(APP_COMMISSION_PERCENT || '0') || 0;
  const processingPercent = method === 'card' ? pct : 0;
  const processingAmount = method === 'card' ? +(safeBase * processingPercent / 100).toFixed(2) : 0;
  const bookingFee = BOOKING_FEE_HNL; // siempre aplicada (puedes condicionar si sólo para efectivo)
  const total = +(safeBase + bookingFee + processingAmount).toFixed(2);
  const providerReceives = safeBase; // proveedor no asume las comisiones
  return {
    currency: 'HNL',
    base: safeBase,
    bookingFee,
    processingPercent,
    processingAmount,
    total,
    providerReceives,
    method,
  };
}
