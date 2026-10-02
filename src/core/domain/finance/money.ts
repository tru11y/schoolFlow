export const CURRENCIES = {
  FCFA: { exponent: 0, symbol: "FCFA", label: "Franc CFA (FCFA)" },
  EUR: { exponent: 2, symbol: "€", label: "Euro (EUR)" },
  USD: { exponent: 2, symbol: "$", label: "Dollar américain (USD)" },
  CAD: { exponent: 2, symbol: "$ CA", label: "Dollar canadien (CAD)" },
} as const;

export type CurrencyCode = keyof typeof CURRENCIES;
export const CURRENCY_CODES = Object.keys(CURRENCIES) as [CurrencyCode, ...CurrencyCode[]];

export const isCurrency = (v: string): v is CurrencyCode => v in CURRENCIES;

/** Amounts are stored in minor units; the exponent depends on the currency (FCFA has none). */
export const toMinorUnits = (major: number, currency: CurrencyCode): number =>
  Math.round(major * 10 ** CURRENCIES[currency].exponent);

const NBSP = " ";

/**
 * "12 000 FCFA" / "120,00 €". `code` style prints the ISO-like code instead of the symbol
 * (needed for PDFs, whose standard fonts lack some symbols).
 */
export function formatMoney(minor: number, currency: string, style: "symbol" | "code" = "symbol"): string {
  const cfg = isCurrency(currency) ? CURRENCIES[currency] : CURRENCIES.EUR;
  const code = isCurrency(currency) ? currency : "EUR";
  const major = minor / 10 ** cfg.exponent;
  const [int = "0", frac] = major.toFixed(cfg.exponent).split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  const number = frac ? `${grouped},${frac}` : grouped;
  return `${number}${NBSP}${style === "code" ? code : cfg.symbol}`;
}
