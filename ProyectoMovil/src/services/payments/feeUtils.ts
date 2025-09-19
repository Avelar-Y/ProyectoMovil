import { APP_COMMISSION_PERCENT } from '@env';

export interface PaymentBreakdown {
  base: number;        // subtotal servicio
  commissionPercent: number; // porcentaje aplicado
  commissionAmount: number;  // monto comisión
  total: number;       // total cliente paga
  providerReceives: number;  // lo que recibe el proveedor
}

export function computePaymentBreakdown(base: number): PaymentBreakdown {
  const pct = parseFloat(APP_COMMISSION_PERCENT || '0') || 0;
  const commissionAmount = +(base * pct / 100).toFixed(2);
  const total = +(base + commissionAmount).toFixed(2);
  const providerReceives = +(base).toFixed(2); // modelo simple: proveedor recibe base
  return { base: +base.toFixed(2), commissionPercent: pct, commissionAmount, total, providerReceives };
}
