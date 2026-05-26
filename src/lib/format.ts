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
  }).format(Math.abs(safe));
  const sign = safe < 0 ? "-" : "";
  // wide gap between currency symbol and amount for legibility
  return `${sign}${CURRENCY_SYMBOLS[currency]}\u00A0\u00A0${formatted}`;
}

/** dd/mm/yyyy — primary date format across the app */
export function formatDate(d: string | Date | null | undefined) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "—";
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/** ISO yyyy-mm-dd — for <input type="date"> values */
export function toInputDate(d: string | Date | null | undefined) {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}
