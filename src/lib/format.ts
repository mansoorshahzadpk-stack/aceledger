export type CurrencyCode =
  | "PKR"
  | "INR"
  | "BDT"
  | "AED"
  | "LKR"
  | "USD"
  | "EUR"
  | "GBP"
  | "SAR"
  | "CNY";

export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  PKR: "₨",
  INR: "₹",
  BDT: "৳",
  AED: "د.إ",
  LKR: "Rs",
  USD: "$",
  EUR: "€",
  GBP: "£",
  SAR: "﷼",
  CNY: "¥",
};

export const CURRENCY_LABELS: Record<CurrencyCode, string> = {
  PKR: "Pakistan – Rupee (₨)",
  INR: "India – Rupee (₹)",
  BDT: "Bangladesh – Taka (৳)",
  AED: "UAE – Dirham (د.إ)",
  LKR: "Sri Lanka – Rupee (Rs)",
  USD: "United States – Dollar ($)",
  EUR: "Eurozone – Euro (€)",
  GBP: "United Kingdom – Pound (£)",
  SAR: "Saudi Arabia – Riyal (﷼)",
  CNY: "China – Yuan (¥)",
};

export function formatMoney(value: number | string | null | undefined, currency: CurrencyCode = "PKR") {
  const n = typeof value === "string" ? parseFloat(value) : value ?? 0;
  const safe = Number.isFinite(n) ? n : 0;
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safe);
  return `${CURRENCY_SYMBOLS[currency]} ${formatted}`;
}

export function formatDate(d: string | Date | null | undefined) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}
