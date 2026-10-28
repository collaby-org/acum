/**
 * Regional pricing — the single source of truth.
 *
 * Isomorphic: runs on both server and client. No React hooks, and no
 * `document` access except behind `getUserRegion()`, which is a no-op on
 * the server (returns `DEFAULT`).
 *
 * Prices are stored in each currency's **smallest** unit (bani, pence,
 * cents, yen). Zero-decimal currencies (JPY, KRW, VND, IDR, CLP, COP) store
 * whole units and are NOT divided by 100 when formatted — see
 * `isZeroDecimalCurrency`.
 *
 * Tiers follow Netflix-style purchasing-parity pricing:
 *   Romania   — RON (cheaper, intentionally)
 *   UK        — GBP (£3.99 / £5.99)
 *   US        — USD ($4.99 / $7.99)
 *   Eurozone  — EUR (€4.99 / €7.99)
 *   DEFAULT   — EUR (€3.99 / €5.99) for anything unmapped
 */

/* ------------------------------------------------------------------ *
 * Types
 * ------------------------------------------------------------------ */

export type RegionCode =
  | "RO"
  | "GB"
  | "US"
  | "DE"
  | "FR"
  | "IT"
  | "ES"
  | "NL"
  | "BE"
  | "AT"
  | "PL"
  | "CZ"
  | "HU"
  | "BG"
  | "HR"
  | "SI"
  | "SK"
  | "LT"
  | "LV"
  | "EE"
  | "IE"
  | "PT"
  | "GR"
  | "MT"
  | "CY"
  | "FI"
  | "SE"
  | "DK"
  | "NO"
  | "CH"
  | "CA"
  | "AU"
  | "NZ"
  | "JP"
  | "BR"
  | "MX"
  | "AR"
  | "CL"
  | "CO"
  | "PE"
  | "UY"
  | "ZA"
  | "IN"
  | "SG"
  | "HK"
  | "TW"
  | "KR"
  | "PH"
  | "TH"
  | "VN"
  | "ID"
  | "MY"
  | "AE"
  | "SA"
  | "IL"
  | "TR"
  | "DEFAULT";

export type CurrencyCode =
  | "RON"
  | "GBP"
  | "USD"
  | "EUR"
  | "PLN"
  | "CZK"
  | "HUF"
  | "BGN"
  | "SEK"
  | "DKK"
  | "NOK"
  | "CHF"
  | "CAD"
  | "AUD"
  | "NZD"
  | "JPY"
  | "BRL"
  | "MXN"
  | "ARS"
  | "CLP"
  | "COP"
  | "PEN"
  | "UYU"
  | "ZAR"
  | "INR"
  | "SGD"
  | "HKD"
  | "TWD"
  | "KRW"
  | "PHP"
  | "THB"
  | "VND"
  | "IDR"
  | "MYR"
  | "AED"
  | "SAR"
  | "ILS"
  | "TRY";

/**
 * A plan tier that can be bought or given away. Kept as its own union so
 * a price lookup by plan id cannot silently resolve to the wrong tier —
 * `comp` and any other desk-only id are not tiers.
 */
export type PlanTier = "free" | "monthly" | "household" | "lifetime";

export interface RegionalPrice {
  /** In the currency's smallest unit (see module doc). */
  amount: number;
  currency: CurrencyCode;
  /** BCP-47 locale used for `Intl` formatting. */
  locale: string;
}

export type PlanPricing = Record<PlanTier, RegionalPrice>;

/* ------------------------------------------------------------------ *
 * Zero-decimal currencies
 *
 * These have no minor unit in practice: ¥500 is five hundred yen, not
 * fifty thousand. `formatRegionalPrice` divides by 100 for every other
 * currency, so the amount for these must already be whole units.
 * ------------------------------------------------------------------ */

const ZERO_DECIMAL: ReadonlySet<CurrencyCode> = new Set([
  "JPY",
  "KRW",
  "VND",
  "IDR",
  "CLP",
  "COP",
]);

export function isZeroDecimalCurrency(currency: CurrencyCode): boolean {
  return ZERO_DECIMAL.has(currency);
}

/* ------------------------------------------------------------------ *
 * Country → region
 * ------------------------------------------------------------------ */

export const COUNTRY_TO_REGION: Record<string, RegionCode> = {
  RO: "RO",
  GB: "GB",
  UK: "GB",
  US: "US",
  DE: "DE",
  FR: "FR",
  IT: "IT",
  ES: "ES",
  NL: "NL",
  BE: "BE",
  AT: "AT",
  PL: "PL",
  CZ: "CZ",
  HU: "HU",
  BG: "BG",
  HR: "HR",
  SI: "SI",
  SK: "SK",
  LT: "LT",
  LV: "LV",
  EE: "EE",
  IE: "IE",
  PT: "PT",
  GR: "GR",
  MT: "MT",
  CY: "CY",
  FI: "FI",
  SE: "SE",
  DK: "DK",
  NO: "NO",
  CH: "CH",
  CA: "CA",
  AU: "AU",
  NZ: "NZ",
  JP: "JP",
  BR: "BR",
  MX: "MX",
  AR: "AR",
  CL: "CL",
  CO: "CO",
  PE: "PE",
  UY: "UY",
  ZA: "ZA",
  IN: "IN",
  SG: "SG",
  HK: "HK",
  TW: "TW",
  KR: "KR",
  PH: "PH",
  TH: "TH",
  VN: "VN",
  ID: "ID",
  MY: "MY",
  AE: "AE",
  SA: "SA",
  IL: "IL",
  TR: "TR",
};

/* ------------------------------------------------------------------ *
 * Region → prices
 *
 * Every region carries the same four tiers. The eurozone shares one price
 * point but keeps its own locale so the price reads the way locals read it.
 * ------------------------------------------------------------------ */

export const REGIONAL_PRICING = {
  RO: {
    free: { amount: 0, currency: "RON", locale: "ro-RO" },
    monthly: { amount: 1999, currency: "RON", locale: "ro-RO" },
    household: { amount: 2999, currency: "RON", locale: "ro-RO" },
    lifetime: { amount: 19999, currency: "RON", locale: "ro-RO" },
  },
  GB: {
    free: { amount: 0, currency: "GBP", locale: "en-GB" },
    monthly: { amount: 399, currency: "GBP", locale: "en-GB" },
    household: { amount: 599, currency: "GBP", locale: "en-GB" },
    lifetime: { amount: 3999, currency: "GBP", locale: "en-GB" },
  },
  US: {
    free: { amount: 0, currency: "USD", locale: "en-US" },
    monthly: { amount: 499, currency: "USD", locale: "en-US" },
    household: { amount: 799, currency: "USD", locale: "en-US" },
    lifetime: { amount: 4999, currency: "USD", locale: "en-US" },
  },
  DE: {
    free: { amount: 0, currency: "EUR", locale: "de-DE" },
    monthly: { amount: 499, currency: "EUR", locale: "de-DE" },
    household: { amount: 799, currency: "EUR", locale: "de-DE" },
    lifetime: { amount: 4999, currency: "EUR", locale: "de-DE" },
  },
  FR: {
    free: { amount: 0, currency: "EUR", locale: "fr-FR" },
    monthly: { amount: 499, currency: "EUR", locale: "fr-FR" },
    household: { amount: 799, currency: "EUR", locale: "fr-FR" },
    lifetime: { amount: 4999, currency: "EUR", locale: "fr-FR" },
  },
  IT: {
    free: { amount: 0, currency: "EUR", locale: "it-IT" },
    monthly: { amount: 499, currency: "EUR", locale: "it-IT" },
    household: { amount: 799, currency: "EUR", locale: "it-IT" },
    lifetime: { amount: 4999, currency: "EUR", locale: "it-IT" },
  },
  ES: {
    free: { amount: 0, currency: "EUR", locale: "es-ES" },
    monthly: { amount: 499, currency: "EUR", locale: "es-ES" },
    household: { amount: 799, currency: "EUR", locale: "es-ES" },
    lifetime: { amount: 4999, currency: "EUR", locale: "es-ES" },
  },
  NL: {
    free: { amount: 0, currency: "EUR", locale: "nl-NL" },
    monthly: { amount: 499, currency: "EUR", locale: "nl-NL" },
    household: { amount: 799, currency: "EUR", locale: "nl-NL" },
    lifetime: { amount: 4999, currency: "EUR", locale: "nl-NL" },
  },
  BE: {
    free: { amount: 0, currency: "EUR", locale: "nl-BE" },
    monthly: { amount: 499, currency: "EUR", locale: "nl-BE" },
    household: { amount: 799, currency: "EUR", locale: "nl-BE" },
    lifetime: { amount: 4999, currency: "EUR", locale: "nl-BE" },
  },
  AT: {
    free: { amount: 0, currency: "EUR", locale: "de-AT" },
    monthly: { amount: 499, currency: "EUR", locale: "de-AT" },
    household: { amount: 799, currency: "EUR", locale: "de-AT" },
    lifetime: { amount: 4999, currency: "EUR", locale: "de-AT" },
  },
  PL: {
    free: { amount: 0, currency: "PLN", locale: "pl-PL" },
    monthly: { amount: 1999, currency: "PLN", locale: "pl-PL" },
    household: { amount: 2999, currency: "PLN", locale: "pl-PL" },
    lifetime: { amount: 19999, currency: "PLN", locale: "pl-PL" },
  },
  CZ: {
    free: { amount: 0, currency: "CZK", locale: "cs-CZ" },
    monthly: { amount: 12900, currency: "CZK", locale: "cs-CZ" },
    household: { amount: 19900, currency: "CZK", locale: "cs-CZ" },
    lifetime: { amount: 99900, currency: "CZK", locale: "cs-CZ" },
  },
  HU: {
    free: { amount: 0, currency: "HUF", locale: "hu-HU" },
    monthly: { amount: 199000, currency: "HUF", locale: "hu-HU" },
    household: { amount: 299000, currency: "HUF", locale: "hu-HU" },
    lifetime: { amount: 1990000, currency: "HUF", locale: "hu-HU" },
  },
  BG: {
    free: { amount: 0, currency: "BGN", locale: "bg-BG" },
    monthly: { amount: 999, currency: "BGN", locale: "bg-BG" },
    household: { amount: 1499, currency: "BGN", locale: "bg-BG" },
    lifetime: { amount: 9999, currency: "BGN", locale: "bg-BG" },
  },
  HR: {
    free: { amount: 0, currency: "EUR", locale: "hr-HR" },
    monthly: { amount: 499, currency: "EUR", locale: "hr-HR" },
    household: { amount: 799, currency: "EUR", locale: "hr-HR" },
    lifetime: { amount: 4999, currency: "EUR", locale: "hr-HR" },
  },
  SI: {
    free: { amount: 0, currency: "EUR", locale: "sl-SI" },
    monthly: { amount: 499, currency: "EUR", locale: "sl-SI" },
    household: { amount: 799, currency: "EUR", locale: "sl-SI" },
    lifetime: { amount: 4999, currency: "EUR", locale: "sl-SI" },
  },
  SK: {
    free: { amount: 0, currency: "EUR", locale: "sk-SK" },
    monthly: { amount: 499, currency: "EUR", locale: "sk-SK" },
    household: { amount: 799, currency: "EUR", locale: "sk-SK" },
    lifetime: { amount: 4999, currency: "EUR", locale: "sk-SK" },
  },
  LT: {
    free: { amount: 0, currency: "EUR", locale: "lt-LT" },
    monthly: { amount: 499, currency: "EUR", locale: "lt-LT" },
    household: { amount: 799, currency: "EUR", locale: "lt-LT" },
    lifetime: { amount: 4999, currency: "EUR", locale: "lt-LT" },
  },
  LV: {
    free: { amount: 0, currency: "EUR", locale: "lv-LV" },
    monthly: { amount: 499, currency: "EUR", locale: "lv-LV" },
    household: { amount: 799, currency: "EUR", locale: "lv-LV" },
    lifetime: { amount: 4999, currency: "EUR", locale: "lv-LV" },
  },
  EE: {
    free: { amount: 0, currency: "EUR", locale: "et-EE" },
    monthly: { amount: 499, currency: "EUR", locale: "et-EE" },
    household: { amount: 799, currency: "EUR", locale: "et-EE" },
    lifetime: { amount: 4999, currency: "EUR", locale: "et-EE" },
  },
  IE: {
    free: { amount: 0, currency: "EUR", locale: "en-IE" },
    monthly: { amount: 499, currency: "EUR", locale: "en-IE" },
    household: { amount: 799, currency: "EUR", locale: "en-IE" },
    lifetime: { amount: 4999, currency: "EUR", locale: "en-IE" },
  },
  PT: {
    free: { amount: 0, currency: "EUR", locale: "pt-PT" },
    monthly: { amount: 499, currency: "EUR", locale: "pt-PT" },
    household: { amount: 799, currency: "EUR", locale: "pt-PT" },
    lifetime: { amount: 4999, currency: "EUR", locale: "pt-PT" },
  },
  GR: {
    free: { amount: 0, currency: "EUR", locale: "el-GR" },
    monthly: { amount: 499, currency: "EUR", locale: "el-GR" },
    household: { amount: 799, currency: "EUR", locale: "el-GR" },
    lifetime: { amount: 4999, currency: "EUR", locale: "el-GR" },
  },
  MT: {
    free: { amount: 0, currency: "EUR", locale: "mt-MT" },
    monthly: { amount: 499, currency: "EUR", locale: "mt-MT" },
    household: { amount: 799, currency: "EUR", locale: "mt-MT" },
    lifetime: { amount: 4999, currency: "EUR", locale: "mt-MT" },
  },
  CY: {
    free: { amount: 0, currency: "EUR", locale: "el-CY" },
    monthly: { amount: 499, currency: "EUR", locale: "el-CY" },
    household: { amount: 799, currency: "EUR", locale: "el-CY" },
    lifetime: { amount: 4999, currency: "EUR", locale: "el-CY" },
  },
  FI: {
    free: { amount: 0, currency: "EUR", locale: "fi-FI" },
    monthly: { amount: 499, currency: "EUR", locale: "fi-FI" },
    household: { amount: 799, currency: "EUR", locale: "fi-FI" },
    lifetime: { amount: 4999, currency: "EUR", locale: "fi-FI" },
  },
  SE: {
    free: { amount: 0, currency: "SEK", locale: "sv-SE" },
    monthly: { amount: 4990, currency: "SEK", locale: "sv-SE" },
    household: { amount: 7990, currency: "SEK", locale: "sv-SE" },
    lifetime: { amount: 49990, currency: "SEK", locale: "sv-SE" },
  },
  DK: {
    free: { amount: 0, currency: "DKK", locale: "da-DK" },
    monthly: { amount: 3990, currency: "DKK", locale: "da-DK" },
    household: { amount: 5990, currency: "DKK", locale: "da-DK" },
    lifetime: { amount: 39990, currency: "DKK", locale: "da-DK" },
  },
  NO: {
    free: { amount: 0, currency: "NOK", locale: "nb-NO" },
    monthly: { amount: 4990, currency: "NOK", locale: "nb-NO" },
    household: { amount: 7990, currency: "NOK", locale: "nb-NO" },
    lifetime: { amount: 49990, currency: "NOK", locale: "nb-NO" },
  },
  CH: {
    free: { amount: 0, currency: "CHF", locale: "de-CH" },
    monthly: { amount: 499, currency: "CHF", locale: "de-CH" },
    household: { amount: 2499, currency: "CHF", locale: "de-CH" },
    lifetime: { amount: 14999, currency: "CHF", locale: "de-CH" },
  },
  CA: {
    free: { amount: 0, currency: "CAD", locale: "en-CA" },
    monthly: { amount: 699, currency: "CAD", locale: "en-CA" },
    household: { amount: 999, currency: "CAD", locale: "en-CA" },
    lifetime: { amount: 6499, currency: "CAD", locale: "en-CA" },
  },
  AU: {
    free: { amount: 0, currency: "AUD", locale: "en-AU" },
    monthly: { amount: 699, currency: "AUD", locale: "en-AU" },
    household: { amount: 999, currency: "AUD", locale: "en-AU" },
    lifetime: { amount: 6499, currency: "AUD", locale: "en-AU" },
  },
  NZ: {
    free: { amount: 0, currency: "NZD", locale: "en-NZ" },
    monthly: { amount: 799, currency: "NZD", locale: "en-NZ" },
    household: { amount: 1199, currency: "NZD", locale: "en-NZ" },
    lifetime: { amount: 7999, currency: "NZD", locale: "en-NZ" },
  },
  // JPY is zero-decimal: the amount IS the yen (¥499).
  JP: {
    free: { amount: 0, currency: "JPY", locale: "ja-JP" },
    monthly: { amount: 499, currency: "JPY", locale: "ja-JP" },
    household: { amount: 799, currency: "JPY", locale: "ja-JP" },
    lifetime: { amount: 4999, currency: "JPY", locale: "ja-JP" },
  },
  BR: {
    free: { amount: 0, currency: "BRL", locale: "pt-BR" },
    monthly: { amount: 2499, currency: "BRL", locale: "pt-BR" },
    household: { amount: 3999, currency: "BRL", locale: "pt-BR" },
    lifetime: { amount: 24999, currency: "BRL", locale: "pt-BR" },
  },
  MX: {
    free: { amount: 0, currency: "MXN", locale: "es-MX" },
    monthly: { amount: 8990, currency: "MXN", locale: "es-MX" },
    household: { amount: 13990, currency: "MXN", locale: "es-MX" },
    lifetime: { amount: 69990, currency: "MXN", locale: "es-MX" },
  },
  AR: {
    free: { amount: 0, currency: "ARS", locale: "es-AR" },
    monthly: { amount: 399900, currency: "ARS", locale: "es-AR" },
    household: { amount: 599900, currency: "ARS", locale: "es-AR" },
    lifetime: { amount: 2999900, currency: "ARS", locale: "es-AR" },
  },
  // CLP is zero-decimal: the amount IS the peso (CL$3990).
  CL: {
    free: { amount: 0, currency: "CLP", locale: "es-CL" },
    monthly: { amount: 3990, currency: "CLP", locale: "es-CL" },
    household: { amount: 5990, currency: "CLP", locale: "es-CL" },
    lifetime: { amount: 39990, currency: "CLP", locale: "es-CL" },
  },
  // COP is zero-decimal: the amount IS the peso (CO$19990).
  CO: {
    free: { amount: 0, currency: "COP", locale: "es-CO" },
    monthly: { amount: 19990, currency: "COP", locale: "es-CO" },
    household: { amount: 29990, currency: "COP", locale: "es-CO" },
    lifetime: { amount: 149990, currency: "COP", locale: "es-CO" },
  },
  PE: {
    free: { amount: 0, currency: "PEN", locale: "es-PE" },
    monthly: { amount: 1899, currency: "PEN", locale: "es-PE" },
    household: { amount: 2799, currency: "PEN", locale: "es-PE" },
    lifetime: { amount: 13999, currency: "PEN", locale: "es-PE" },
  },
  UY: {
    free: { amount: 0, currency: "UYU", locale: "es-UY" },
    monthly: { amount: 15990, currency: "UYU", locale: "es-UY" },
    household: { amount: 23990, currency: "UYU", locale: "es-UY" },
    lifetime: { amount: 99990, currency: "UYU", locale: "es-UY" },
  },
  ZA: {
    free: { amount: 0, currency: "ZAR", locale: "en-ZA" },
    monthly: { amount: 7990, currency: "ZAR", locale: "en-ZA" },
    household: { amount: 11990, currency: "ZAR", locale: "en-ZA" },
    lifetime: { amount: 59990, currency: "ZAR", locale: "en-ZA" },
  },
  IN: {
    free: { amount: 0, currency: "INR", locale: "en-IN" },
    monthly: { amount: 29900, currency: "INR", locale: "en-IN" },
    household: { amount: 44900, currency: "INR", locale: "en-IN" },
    lifetime: { amount: 279900, currency: "INR", locale: "en-IN" },
  },
  SG: {
    free: { amount: 0, currency: "SGD", locale: "en-SG" },
    monthly: { amount: 699, currency: "SGD", locale: "en-SG" },
    household: { amount: 999, currency: "SGD", locale: "en-SG" },
    lifetime: { amount: 6499, currency: "SGD", locale: "en-SG" },
  },
  HK: {
    free: { amount: 0, currency: "HKD", locale: "zh-HK" },
    monthly: { amount: 3899, currency: "HKD", locale: "zh-HK" },
    household: { amount: 5999, currency: "HKD", locale: "zh-HK" },
    lifetime: { amount: 38999, currency: "HKD", locale: "zh-HK" },
  },
  TW: {
    free: { amount: 0, currency: "TWD", locale: "zh-TW" },
    monthly: { amount: 14990, currency: "TWD", locale: "zh-TW" },
    household: { amount: 22990, currency: "TWD", locale: "zh-TW" },
    lifetime: { amount: 119990, currency: "TWD", locale: "zh-TW" },
  },
  // KRW is zero-decimal: the amount IS the won (₩5499).
  KR: {
    free: { amount: 0, currency: "KRW", locale: "ko-KR" },
    monthly: { amount: 5499, currency: "KRW", locale: "ko-KR" },
    household: { amount: 8499, currency: "KRW", locale: "ko-KR" },
    lifetime: { amount: 54999, currency: "KRW", locale: "ko-KR" },
  },
  PH: {
    free: { amount: 0, currency: "PHP", locale: "en-PH" },
    monthly: { amount: 24900, currency: "PHP", locale: "en-PH" },
    household: { amount: 37900, currency: "PHP", locale: "en-PH" },
    lifetime: { amount: 229900, currency: "PHP", locale: "en-PH" },
  },
  TH: {
    free: { amount: 0, currency: "THB", locale: "th-TH" },
    monthly: { amount: 16900, currency: "THB", locale: "th-TH" },
    household: { amount: 24900, currency: "THB", locale: "th-TH" },
    lifetime: { amount: 129900, currency: "THB", locale: "th-TH" },
  },
  // VND is zero-decimal: the amount IS the đồng (₫11990).
  VN: {
    free: { amount: 0, currency: "VND", locale: "vi-VN" },
    monthly: { amount: 11990, currency: "VND", locale: "vi-VN" },
    household: { amount: 17990, currency: "VND", locale: "vi-VN" },
    lifetime: { amount: 89990, currency: "VND", locale: "vi-VN" },
  },
  // IDR is zero-decimal: the amount IS the rupiah (Rp59990).
  ID: {
    free: { amount: 0, currency: "IDR", locale: "id-ID" },
    monthly: { amount: 59990, currency: "IDR", locale: "id-ID" },
    household: { amount: 89990, currency: "IDR", locale: "id-ID" },
    lifetime: { amount: 449990, currency: "IDR", locale: "id-ID" },
  },
  MY: {
    free: { amount: 0, currency: "MYR", locale: "ms-MY" },
    monthly: { amount: 2499, currency: "MYR", locale: "ms-MY" },
    household: { amount: 3499, currency: "MYR", locale: "ms-MY" },
    lifetime: { amount: 17499, currency: "MYR", locale: "ms-MY" },
  },
  AE: {
    free: { amount: 0, currency: "AED", locale: "en-AE" },
    monthly: { amount: 1999, currency: "AED", locale: "en-AE" },
    household: { amount: 2499, currency: "AED", locale: "en-AE" },
    lifetime: { amount: 14999, currency: "AED", locale: "en-AE" },
  },
  SA: {
    free: { amount: 0, currency: "SAR", locale: "ar-SA" },
    monthly: { amount: 1999, currency: "SAR", locale: "ar-SA" },
    household: { amount: 2499, currency: "SAR", locale: "ar-SA" },
    lifetime: { amount: 14999, currency: "SAR", locale: "ar-SA" },
  },
  IL: {
    free: { amount: 0, currency: "ILS", locale: "he-IL" },
    monthly: { amount: 1799, currency: "ILS", locale: "he-IL" },
    household: { amount: 2599, currency: "ILS", locale: "he-IL" },
    lifetime: { amount: 14999, currency: "ILS", locale: "he-IL" },
  },
  TR: {
    free: { amount: 0, currency: "TRY", locale: "tr-TR" },
    monthly: { amount: 14990, currency: "TRY", locale: "tr-TR" },
    household: { amount: 22990, currency: "TRY", locale: "tr-TR" },
    lifetime: { amount: 109990, currency: "TRY", locale: "tr-TR" },
  },
  DEFAULT: {
    free: { amount: 0, currency: "EUR", locale: "en-IE" },
    monthly: { amount: 399, currency: "EUR", locale: "en-IE" },
    household: { amount: 599, currency: "EUR", locale: "en-IE" },
    lifetime: { amount: 3999, currency: "EUR", locale: "en-IE" },
  },
} as const satisfies Record<RegionCode, PlanPricing>;

/* ------------------------------------------------------------------ *
 * Lookups
 * ------------------------------------------------------------------ */

export function getRegionCode(countryCode: string): RegionCode {
  return COUNTRY_TO_REGION[countryCode.toUpperCase()] || "DEFAULT";
}

export function getRegionalPricing(regionCode?: RegionCode): PlanPricing {
  const region = regionCode || "DEFAULT";
  return (
    (REGIONAL_PRICING as Record<string, PlanPricing>)[region] ??
    REGIONAL_PRICING.DEFAULT
  );
}

/* ------------------------------------------------------------------ *
 * Formatting
 * ------------------------------------------------------------------ */

/**
 * Format one price for display.
 *
 * "Gratuit" (Romanian — the product's language) for a zero amount; otherwise
 * an `Intl` currency string. Zero-decimal currencies are not divided by 100.
 * Fraction digits are left to `Intl`'s CLDR defaults: the forint reads
 * "199 000 Ft", not "199 000,00 Ft".
 */
export function formatRegionalPrice(price: RegionalPrice): string {
  if (price.amount === 0) return "Gratuit";

  const zeroDecimal = isZeroDecimalCurrency(price.currency);
  const major = zeroDecimal ? price.amount : price.amount / 100;

  return new Intl.NumberFormat(price.locale, {
    style: "currency",
    currency: price.currency,
  }).format(major);
}

/* ------------------------------------------------------------------ *
 * Region detection
 * ------------------------------------------------------------------ */

/**
 * A best-effort IANA-timezone → country map, used when the deployment does
 * not expose a geo cookie (local dev, self-hosted). One representative city
 * per country; not exhaustive, only enough to pick a currency.
 */
export function timezoneToCountry(timezone: string): string | null {
  const tzMap: Record<string, string> = {
    "Europe/Bucharest": "RO",
    "Europe/London": "GB",
    "America/New_York": "US",
    "America/Los_Angeles": "US",
    "America/Chicago": "US",
    "America/Denver": "US",
    "America/Toronto": "CA",
    "America/Vancouver": "CA",
    "Europe/Berlin": "DE",
    "Europe/Paris": "FR",
    "Europe/Rome": "IT",
    "Europe/Madrid": "ES",
    "Europe/Amsterdam": "NL",
    "Europe/Brussels": "BE",
    "Europe/Vienna": "AT",
    "Europe/Warsaw": "PL",
    "Europe/Prague": "CZ",
    "Europe/Budapest": "HU",
    "Europe/Sofia": "BG",
    "Europe/Zagreb": "HR",
    "Europe/Ljubljana": "SI",
    "Europe/Bratislava": "SK",
    "Europe/Vilnius": "LT",
    "Europe/Riga": "LV",
    "Europe/Tallinn": "EE",
    "Europe/Dublin": "IE",
    "Europe/Lisbon": "PT",
    "Europe/Athens": "GR",
    "Europe/Valletta": "MT",
    "Europe/Nicosia": "CY",
    "Europe/Helsinki": "FI",
    "Europe/Stockholm": "SE",
    "Europe/Copenhagen": "DK",
    "Europe/Oslo": "NO",
    "Europe/Zurich": "CH",
    "America/Mexico_City": "MX",
    "America/Sao_Paulo": "BR",
    "America/Argentina/Buenos_Aires": "AR",
    "America/Santiago": "CL",
    "America/Bogota": "CO",
    "America/Lima": "PE",
    "America/Montevideo": "UY",
    "Africa/Johannesburg": "ZA",
    "Asia/Kolkata": "IN",
    "Asia/Singapore": "SG",
    "Asia/Hong_Kong": "HK",
    "Asia/Taipei": "TW",
    "Asia/Seoul": "KR",
    "Asia/Manila": "PH",
    "Asia/Bangkok": "TH",
    "Asia/Ho_Chi_Minh": "VN",
    "Asia/Jakarta": "ID",
    "Asia/Kuala_Lumpur": "MY",
    "Asia/Dubai": "AE",
    "Asia/Riyadh": "SA",
    "Asia/Jerusalem": "IL",
    "Europe/Istanbul": "TR",
  };
  return tzMap[timezone] || null;
}

/**
 * The visitor's region, on the client.
 *
 * Priority: the deployment's geo cookie (Vercel sets `vercel-country`), then
 * the browser's timezone, then `DEFAULT`. Returns `DEFAULT` on the server —
 * server components that need a region should use `getRegionFromHeaders`.
 */
export function getUserRegion(): RegionCode {
  if (typeof window === "undefined") return "DEFAULT";

  const vercelCountry = document.cookie.match(/vercel-country=([^;]+)/)?.[1];
  if (vercelCountry) return getRegionCode(vercelCountry);

  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const country = timezoneToCountry(timezone);
    if (country) return getRegionCode(country);
  } catch {
    // A browser without `Intl` still gets the default.
  }

  return "DEFAULT";
}

/**
 * The region, on the server, from Vercel's geo headers.
 *
 * `x-vercel-ip-country` is the two-letter ISO code; fall back to `DEFAULT`.
 */
export function getRegionFromHeaders(headers: Headers): RegionCode {
  const country =
    headers.get("x-vercel-ip-country") ||
    headers.get("x-vercel-ip-country-region");
  return country ? getRegionCode(country) : "DEFAULT";
}
