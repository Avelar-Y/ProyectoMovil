// Utilidad de formateo monetario multi-divisa simple.
// Para HNL mostramos prefijo L y separadores locales.
// Para USD prefijo $ por compatibilidad. Extensible para más monedas.

interface FormatMoneyOptions {
  currency?: string; // 'HNL', 'USD', etc
  locale?: string;   // es-HN por defecto para HNL
  withSymbol?: boolean; // incluir símbolo
  maxDecimals?: number; // recorte máximo
}

const SYMBOLS: Record<string,string> = {
  HNL: 'L',
  USD: '$'
};

export function formatMoney(value: number | string | null | undefined, opts: FormatMoneyOptions = {}): string {
  if (value == null || value === '') return '';
  const num = typeof value === 'string' ? Number(value) : value;
  if (isNaN(num)) return '';
  const currency = (opts.currency || 'HNL').toUpperCase();
  const locale = opts.locale || (currency === 'HNL' ? 'es-HN' : 'en-US');
  const maxDecimals = opts.maxDecimals ?? 2;
  const symbol = SYMBOLS[currency] || currency + ' ';
  // Si es entero evita decimales; si tiene parte decimal limitada.
  const usedDecimals = Number.isInteger(num) ? 0 : Math.min(maxDecimals, 2);
  try {
    const formatted = new Intl.NumberFormat(locale, { minimumFractionDigits: usedDecimals, maximumFractionDigits: usedDecimals }).format(num);
    return opts.withSymbol === false ? formatted : `${symbol}${formatted}`;
  } catch {
    // Fallback simple
    return opts.withSymbol === false ? String(num) : `${symbol}${num}`;
  }
}

export function extractCurrencySymbol(currency: string | undefined): string {
  if(!currency) return '';
  return SYMBOLS[currency.toUpperCase()] || currency.toUpperCase();
}
