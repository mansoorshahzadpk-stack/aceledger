import type { CurrencyCode } from "@/lib/format";
import { CURRENCY_SYMBOLS } from "@/lib/format";

export type DocTemplate = "classic" | "modern" | "compact";

interface DocInput {
  template: DocTemplate;
  title: string;
  number: string;
  date: string;
  due_date?: string | null;
  currency: CurrencyCode;
  business: { name?: string | null; address?: string | null; phone?: string | null };
  counterparty: { label: string; name?: string | null; address?: string | null; phone?: string | null };
  items: Array<{ description: string; quantity: number | string; unit_price: number | string; line_total: number | string }>;
  subtotal: number | string;
  tax: number | string;
  total: number | string;
  notes?: string | null;
  status?: string;
}

function money(n: number | string, c: CurrencyCode) {
  const v = typeof n === "string" ? parseFloat(n) : n;
  return `${CURRENCY_SYMBOLS[c]} ${(Number.isFinite(v) ? v : 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function escapeHtml(s?: string | null) {
  return (s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

export function buildDocumentHtml(d: DocInput): string {
  const items = d.items.map((it) => `
    <tr>
      <td>${escapeHtml(it.description)}</td>
      <td style="text-align:right">${it.quantity}</td>
      <td style="text-align:right">${money(it.unit_price, d.currency)}</td>
      <td style="text-align:right">${money(it.line_total, d.currency)}</td>
    </tr>`).join("");

  const styles = {
    classic: `
      body { font-family: Georgia, 'Times New Roman', serif; color:#1a1a1a; padding:48px; }
      h1 { font-size: 28px; margin: 0 0 4px; letter-spacing: 1px; text-transform: uppercase; }
      .top { display:flex; justify-content:space-between; border-bottom: 3px double #1a1a1a; padding-bottom:16px; margin-bottom:24px; }
      .biz { text-align:right; font-size:13px; }
      .parties { display:grid; grid-template-columns:1fr 1fr; gap:24px; margin-bottom:24px; font-size:13px; }
      .label { font-size:10px; text-transform:uppercase; letter-spacing:1px; color:#555; margin-bottom:4px; }
      table { width:100%; border-collapse:collapse; font-size:13px; }
      th { text-align:left; background:#f5f1ea; padding:10px; border-bottom:2px solid #1a1a1a; }
      td { padding:10px; border-bottom:1px solid #ddd; }
      .totals { margin-top:16px; margin-left:auto; width:280px; font-size:13px; }
      .totals .row { display:flex; justify-content:space-between; padding:6px 0; }
      .totals .grand { border-top:2px solid #1a1a1a; font-size:16px; font-weight:bold; }
    `,
    modern: `
      body { font-family: -apple-system, 'Segoe UI', sans-serif; color:#0f172a; padding:56px; }
      h1 { font-size:40px; font-weight:200; margin:0; letter-spacing:-1px; }
      .top { display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:48px; }
      .num { color:#64748b; font-size:13px; margin-top:8px; }
      .biz { text-align:right; font-size:12px; color:#475569; }
      .parties { display:grid; grid-template-columns:1fr 1fr; gap:32px; margin-bottom:32px; font-size:13px; }
      .label { font-size:10px; text-transform:uppercase; letter-spacing:2px; color:#94a3b8; margin-bottom:6px; }
      table { width:100%; border-collapse:collapse; font-size:13px; }
      th { text-align:left; padding:12px 8px; border-bottom:1px solid #e2e8f0; font-weight:500; color:#64748b; text-transform:uppercase; font-size:11px; letter-spacing:1px; }
      td { padding:14px 8px; border-bottom:1px solid #f1f5f9; }
      .totals { margin-top:24px; margin-left:auto; width:280px; font-size:13px; }
      .totals .row { display:flex; justify-content:space-between; padding:8px 0; }
      .totals .grand { border-top:2px solid #0f172a; margin-top:8px; padding-top:12px; font-size:20px; font-weight:600; }
    `,
    compact: `
      body { font-family: 'Helvetica Neue', Arial, sans-serif; color:#111; padding:24px; font-size:11px; }
      h1 { font-size:18px; margin:0; }
      .top { display:flex; justify-content:space-between; border-bottom:2px solid #111; padding-bottom:8px; margin-bottom:12px; }
      .biz { text-align:right; font-size:10px; }
      .parties { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px; font-size:10px; }
      .label { font-size:9px; text-transform:uppercase; color:#666; }
      table { width:100%; border-collapse:collapse; font-size:11px; }
      th { text-align:left; padding:4px 6px; background:#f0f0f0; border:1px solid #ccc; font-size:10px; }
      td { padding:4px 6px; border:1px solid #ddd; }
      .totals { margin-top:8px; margin-left:auto; width:220px; font-size:11px; }
      .totals .row { display:flex; justify-content:space-between; padding:2px 0; }
      .totals .grand { border-top:1px solid #111; padding-top:4px; font-weight:bold; }
    `,
  }[d.template];

  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(d.title)} ${escapeHtml(d.number)}</title>
  <style>${styles} @media print { @page { margin: 12mm; } }</style></head><body>
  <div class="top">
    <div>
      <h1>${escapeHtml(d.title)}</h1>
      <div class="num">No. ${escapeHtml(d.number)} · ${escapeHtml(d.date)}${d.status ? ` · ${escapeHtml(d.status.toUpperCase())}` : ""}</div>
    </div>
    <div class="biz">
      <div style="font-weight:600">${escapeHtml(d.business.name || "Your Business")}</div>
      <div>${escapeHtml(d.business.address || "")}</div>
      <div>${escapeHtml(d.business.phone || "")}</div>
    </div>
  </div>
  <div class="parties">
    <div>
      <div class="label">${escapeHtml(d.counterparty.label)}</div>
      <div style="font-weight:600">${escapeHtml(d.counterparty.name || "")}</div>
      <div>${escapeHtml(d.counterparty.address || "")}</div>
      <div>${escapeHtml(d.counterparty.phone || "")}</div>
    </div>
    <div style="text-align:right">
      <div class="label">Date</div><div>${escapeHtml(d.date)}</div>
      ${d.due_date ? `<div class="label" style="margin-top:8px">Due</div><div>${escapeHtml(d.due_date)}</div>` : ""}
    </div>
  </div>
  <table>
    <thead><tr><th>Description</th><th style="text-align:right">Qty</th><th style="text-align:right">Unit price</th><th style="text-align:right">Amount</th></tr></thead>
    <tbody>${items}</tbody>
  </table>
  <div class="totals">
    <div class="row"><span>Subtotal</span><span>${money(d.subtotal, d.currency)}</span></div>
    <div class="row"><span>Tax</span><span>${money(d.tax, d.currency)}</span></div>
    <div class="row grand"><span>Total</span><span>${money(d.total, d.currency)}</span></div>
  </div>
  ${d.notes ? `<div style="margin-top:32px; font-size:11px; color:#666; border-top:1px solid #eee; padding-top:12px"><div class="label">Notes</div>${escapeHtml(d.notes)}</div>` : ""}
  </body></html>`;
}

export function renderDocument(d: DocInput) {
  const html = buildDocumentHtml(d);
  const w = window.open("", "_blank", "width=900,height=1100");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
  setTimeout(() => { w.focus(); w.print(); }, 300);
}
