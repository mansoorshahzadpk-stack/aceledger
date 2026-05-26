export type CurrencyCode = "PKR" | "USD" | "EUR";

export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  PKR: "₨",
  USD: "$",
  EUR: "€",
};

export const CURRENCY_LABELS: Record<CurrencyCode, string> = {
  PKR: "Pakistani Rupee (₨)",
  USD: "US Dollar ($)",
  EUR: "Euro (€)",
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
