/**
 * Formatting shared by the admin panel, the A4 document engine and the
 * server-side emails — no "server-only" here, the same rules have to apply
 * in the browser (PDF rendering) and on the server (email copy), or the PDF
 * and the email would disagree on a date or an amount.
 */

export type DocLocale = "en" | "fa";

export const CURRENCIES = ["EUR", "USD", "GBP", "CHF", "AED"] as const;

export function isDocLocale(value: unknown): value is DocLocale {
  return value === "en" || value === "fa";
}

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

/** Latin digits → Persian digits (fa only). Leaves everything else untouched. */
export function localizeDigits(text: string, locale: DocLocale): string {
  if (locale !== "fa") return text;
  return text.replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]);
}

export function formatNumber(value: number, locale: DocLocale): string {
  return value.toLocaleString(locale === "fa" ? "fa-IR" : "en-US");
}

/** Cents → "€12,500.00" / "۱۲٬۵۰۰ €". Unknown currency codes fall back to "12,500 XYZ" instead of throwing. */
export function formatMoney(cents: number, currency: string, locale: DocLocale): string {
  const amount = cents / 100;
  const fractionDigits = Number.isInteger(amount) ? 0 : 2;
  try {
    return new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(amount);
  } catch {
    return `${formatNumber(amount, locale)} ${currency}`;
  }
}

/** Calendar date — Persian (Jalaali) calendar for fa documents, day-month-year for en. UTC so server and browser print the same day. */
export function formatDate(iso: string | Date | null | undefined, locale: DocLocale): string {
  if (!iso) return "—";
  const date = typeof iso === "string" ? new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso) : iso;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale === "fa" ? "fa-IR-u-ca-persian" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** Date + time in UTC, labelled — used for acceptance timestamps, where the PDF must show exactly the instant stored in the database. */
export function formatDateTimeUtc(iso: string | null | undefined, locale: DocLocale): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const text = new Intl.DateTimeFormat(locale === "fa" ? "fa-IR-u-ca-persian" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(date);
  return `${text} UTC`;
}

// -----------------------------------------------------------------------------
// Amount in words — contracts state the fee "in figures and in words".
// -----------------------------------------------------------------------------

const EN_ONES = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen",
];
const EN_TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const EN_SCALES = ["", "thousand", "million", "billion", "trillion"];

function enUnder1000(n: number): string {
  const parts: string[] = [];
  if (n >= 100) {
    parts.push(`${EN_ONES[Math.floor(n / 100)]} hundred`);
    n %= 100;
  }
  if (n >= 20) {
    parts.push(n % 10 ? `${EN_TENS[Math.floor(n / 10)]}-${EN_ONES[n % 10]}` : EN_TENS[Math.floor(n / 10)]);
  } else if (n > 0) {
    parts.push(EN_ONES[n]);
  }
  return parts.join(" ");
}

const FA_ONES = ["صفر", "یک", "دو", "سه", "چهار", "پنج", "شش", "هفت", "هشت", "نه", "ده",
  "یازده", "دوازده", "سیزده", "چهارده", "پانزده", "شانزده", "هفده", "هجده", "نوزده"];
const FA_TENS = ["", "", "بیست", "سی", "چهل", "پنجاه", "شصت", "هفتاد", "هشتاد", "نود"];
const FA_HUNDREDS = ["", "صد", "دویست", "سیصد", "چهارصد", "پانصد", "ششصد", "هفتصد", "هشتصد", "نهصد"];
const FA_SCALES = ["", "هزار", "میلیون", "میلیارد", "تریلیون"];

function faUnder1000(n: number): string {
  const parts: string[] = [];
  if (n >= 100) {
    parts.push(FA_HUNDREDS[Math.floor(n / 100)]);
    n %= 100;
  }
  if (n >= 20) {
    parts.push(FA_TENS[Math.floor(n / 10)]);
    if (n % 10) parts.push(FA_ONES[n % 10]);
  } else if (n > 0) {
    parts.push(FA_ONES[n]);
  }
  return parts.join(" و ");
}

export function integerToWords(value: number, locale: DocLocale): string {
  let n = Math.floor(Math.abs(value));
  if (n === 0) return locale === "fa" ? FA_ONES[0] : EN_ONES[0];

  const groups: string[] = [];
  let scale = 0;
  while (n > 0 && scale < EN_SCALES.length) {
    const chunk = n % 1000;
    if (chunk) {
      const words = locale === "fa" ? faUnder1000(chunk) : enUnder1000(chunk);
      const scaleWord = locale === "fa" ? FA_SCALES[scale] : EN_SCALES[scale];
      groups.unshift(scaleWord ? `${words} ${scaleWord}` : words);
    }
    n = Math.floor(n / 1000);
    scale += 1;
  }
  return groups.join(locale === "fa" ? " و " : " ");
}

const CURRENCY_WORDS: Record<string, { en: string; fa: string }> = {
  EUR: { en: "euros", fa: "یورو" },
  USD: { en: "US dollars", fa: "دلار آمریکا" },
  GBP: { en: "pounds sterling", fa: "پوند استرلینگ" },
  CHF: { en: "Swiss francs", fa: "فرانک سوئیس" },
  AED: { en: "UAE dirhams", fa: "درهم امارات" },
};

/** 1250000 cents, EUR → "twelve thousand five hundred euros" / "دوازده هزار و پانصد یورو". */
export function amountInWords(cents: number, currency: string, locale: DocLocale): string {
  const whole = Math.floor(cents / 100);
  const fraction = Math.round(cents % 100);
  const unit = CURRENCY_WORDS[currency]?.[locale] ?? currency;
  const base = `${integerToWords(whole, locale)} ${unit}`;
  if (!fraction) return base;
  return locale === "fa"
    ? `${base} و ${integerToWords(fraction, locale)} صدم`
    : `${base} and ${fraction}/100`;
}

/** Days between an ISO timestamp and now, floored, never negative. */
export function daysSince(iso: string | null | undefined): number {
  if (!iso) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
}
