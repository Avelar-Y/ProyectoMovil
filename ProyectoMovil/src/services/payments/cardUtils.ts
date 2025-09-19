// Utilidades para validación de tarjetas
// NOTA: No almacenar PAN completo en Firestore en producción.

export type CardBrand = 'visa' | 'mastercard' | 'amex' | 'diners' | 'discover' | 'jcb' | 'unknown';

export interface ParsedCard {
  brand: CardBrand;
  last4: string;
  bin: string; // primeros 6 (no almacenar en prod si no se tokeniza)
  validLuhn: boolean;
  expMonth: number;
  expYear: number;
}

export function detectBrand(number: string): CardBrand {
  const n = number.replace(/\D/g, '');
  if (/^4[0-9]{6,}$/.test(n)) return 'visa';
  if (/^(5[1-5][0-9]{5,}|2(2[2-9][0-9]{3,}|[3-6][0-9]{4,}|7[01][0-9]{3,}|720[0-9]{2,}))$/.test(n)) return 'mastercard';
  if (/^3[47][0-9]{5,}$/.test(n)) return 'amex';
  if (/^3(0[0-5]|[68][0-9])[0-9]{4,}$/.test(n)) return 'diners';
  if (/^6(?:011|5[0-9]{2})[0-9]{3,}$/.test(n)) return 'discover';
  if (/^(?:2131|1800|35\d{3})\d{3,}$/.test(n)) return 'jcb';
  return 'unknown';
}

export function luhnCheck(number: string): boolean {
  const arr = number.replace(/\D/g, '').split('').reverse().map(d => parseInt(d, 10));
  if (arr.length < 12) return false; // longitud mínima razonable
  let sum = 0;
  for (let i = 0; i < arr.length; i++) {
    let digit = arr[i];
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

export function parseExpiry(exp: string): { month: number; year: number } | null {
  const cleaned = exp.replace(/\s/g, '');
  const m = cleaned.match(/^([0-9]{1,2})\/?([0-9]{2,4})$/);
  if (!m) return null;
  let month = parseInt(m[1], 10);
  let year = parseInt(m[2], 10);
  if (year < 100) year += 2000;
  if (month < 1 || month > 12) return null;
  if (year < 2000 || year > 2100) return null;
  return { month, year };
}

export function parseCard(number: string, expiry: string): ParsedCard | null {
  const n = number.replace(/\s|-/g, '');
  if (!/^[0-9]{12,19}$/.test(n)) return null;
  const brand = detectBrand(n);
  const luhn = luhnCheck(n);
  const exp = parseExpiry(expiry);
  if (!exp) return null;
  return {
    brand,
    last4: n.slice(-4),
    bin: n.slice(0,6),
    validLuhn: luhn,
    expMonth: exp.month,
    expYear: exp.year,
  };
}

export function maskCard(number: string): string {
  const n = number.replace(/\D/g, '');
  if (n.length < 4) return n.replace(/\d/g, '*');
  return n.slice(0,0) + n.slice(-4).padStart(n.length, '*');
}
