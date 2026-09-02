/**
 * Currencies a company can be billed in.
 *
 * Deliberately a short, curated list rather than every ISO 4217 code or an npm
 * package: only these are worth offering, the payment providers must accept
 * whatever is chosen, and the backend keeps a matching list. A free-text
 * currency box is what let "Pakistani Rupee" reach the billing tables and
 * break checkout, so every place a currency is chosen uses this list.
 *
 * The flag is a plain emoji — no image assets, no dependency, and it renders
 * on every platform the admin panel runs on.
 */
export interface CurrencyOption {
  /** ISO 4217 code — the value stored and sent to the payment provider. */
  code: string;
  /** English name, shown beside the code. */
  name: string;
  symbol: string;
  flag: string;
}

export const CURRENCIES: CurrencyOption[] = [
  { code: 'EUR', name: 'Euro',              symbol: '€',  flag: '🇪🇺' },
  { code: 'GBP', name: 'British Pound',     symbol: '£',  flag: '🇬🇧' },
  { code: 'USD', name: 'US Dollar',         symbol: '$',  flag: '🇺🇸' },
  { code: 'CHF', name: 'Swiss Franc',       symbol: 'Fr', flag: '🇨🇭' },
  { code: 'SEK', name: 'Swedish Krona',     symbol: 'kr', flag: '🇸🇪' },
  { code: 'NOK', name: 'Norwegian Krone',   symbol: 'kr', flag: '🇳🇴' },
  { code: 'DKK', name: 'Danish Krone',      symbol: 'kr', flag: '🇩🇰' },
  { code: 'PLN', name: 'Polish Złoty',      symbol: 'zł', flag: '🇵🇱' },
  { code: 'CZK', name: 'Czech Koruna',      symbol: 'Kč', flag: '🇨🇿' },
  { code: 'RON', name: 'Romanian Leu',      symbol: 'lei', flag: '🇷🇴' },
  { code: 'HUF', name: 'Hungarian Forint',  symbol: 'Ft', flag: '🇭🇺' },
  { code: 'CAD', name: 'Canadian Dollar',   symbol: '$',  flag: '🇨🇦' },
  { code: 'AUD', name: 'Australian Dollar', symbol: '$',  flag: '🇦🇺' },
  { code: 'AED', name: 'UAE Dirham',        symbol: 'د.إ', flag: '🇦🇪' },
  { code: 'SAR', name: 'Saudi Riyal',       symbol: '﷼',  flag: '🇸🇦' },
  { code: 'PKR', name: 'Pakistani Rupee',   symbol: '₨',  flag: '🇵🇰' },
  { code: 'INR', name: 'Indian Rupee',      symbol: '₹',  flag: '🇮🇳' },
  { code: 'TRY', name: 'Turkish Lira',      symbol: '₺',  flag: '🇹🇷' },
  { code: 'JPY', name: 'Japanese Yen',      symbol: '¥',  flag: '🇯🇵' },
];

export const DEFAULT_CURRENCY = 'EUR';

export function findCurrency(code: string | null | undefined): CurrencyOption | undefined {
  if (!code) return undefined;
  const wanted = code.trim().toUpperCase();
  return CURRENCIES.find((c) => c.code === wanted);
}

/** "🇬🇧 GBP — British Pound (£)", for a plain <option> label. */
export function currencyLabel(c: CurrencyOption): string {
  return `${c.flag} ${c.code} — ${c.name} (${c.symbol})`;
}

/**
 * Normalises a stored value to a code from this list.
 *
 * Existing records may hold a display name typed before the field became a
 * list, so those are recognised rather than silently reset.
 */
export function normaliseCurrency(value: string | null | undefined): string {
  const raw = String(value ?? '').trim();
  if (!raw) return DEFAULT_CURRENCY;

  const byCode = findCurrency(raw);
  if (byCode) return byCode.code;

  const lower = raw.toLowerCase();
  const byName = CURRENCIES.find(
    (c) => c.name.toLowerCase() === lower || c.symbol === raw
  );
  if (byName) return byName.code;

  // "EUR (€)" and similar.
  const match = raw.toUpperCase().match(/\b[A-Z]{3}\b/g) ?? [];
  for (const m of match) {
    const hit = findCurrency(m);
    if (hit) return hit.code;
  }

  return DEFAULT_CURRENCY;
}
