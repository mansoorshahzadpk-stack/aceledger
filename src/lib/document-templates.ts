import type { CurrencyCode } from "@/lib/format";
import { CURRENCY_SYMBOLS } from "@/lib/format";

export type DocTemplate = "acelog" | "classic" | "modern" | "compact";

interface DocItem {
  description: string;
  quantity: number | string;
  unit_price: number | string;
  line_total: number | string;
  unit?: string | null;
  grn_ref?: string | null;
  vehicle_ref?: string | null;
}

interface DocInput {
  template: DocTemplate;
  title: string;
  number: string;
  date: string;
  due_date?: string | null;
  currency: CurrencyCode;
  business: { name?: string | null; address?: string | null; phone?: string | null; logo_url?: string | null };
  counterparty: { label: string; name?: string | null; address?: string | null; phone?: string | null };
  items: Array<DocItem>;
  subtotal: number | string;
  tax: number | string;
  shipping?: number | string;
  total: number | string;
  notes?: string | null;
  status?: string;
  showBalanceDue?: boolean;
}

function num(n: number | string | null | undefined) {
  const v = typeof n === "string" ? parseFloat(n) : n ?? 0;
  return Number.isFinite(v as number) ? (v as number) : 0;
}
function money(n: number | string | null | undefined, c: CurrencyCode) {
  const v = num(n);
  const abs = Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const sign = v < 0 ? "-" : "";
  const color = v < 0 ? ' style="color:#c0392b"' : "";
  // Sign sits with the amount, not the currency symbol (e.g. Rs  -5,500.00)
  return `<span${color}>${CURRENCY_SYMBOLS[c]}&nbsp;&nbsp;${sign}${abs}</span>`;
}
/** dd/mm/yyyy formatting for printed documents */
function fmtDate(d: string | null | undefined) {
  if (!d) return "";
  const date = new Date(d);
  if (isNaN(date.getTime())) return String(d);
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}
function escapeHtml(s?: string | null) {
  return (s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function acelogTemplate(d: DocInput): string {
  const ship = num(d.shipping);
  const tax = num(d.tax);
  const items = d.items.map((it, idx) => {
    const meta: string[] = [];
    if (it.grn_ref) meta.push(`GRN : ${escapeHtml(it.grn_ref)}`);
    if (it.vehicle_ref) meta.push(`Veh : ${escapeHtml(it.vehicle_ref)}`);
    const qtyStr = it.unit
      ? `${num(it.quantity).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${escapeHtml(it.unit)}`
      : `${num(it.quantity).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return `
      <tr>
        <td class="num">${idx + 1}</td>
        <td>
          <div class="item-name">${escapeHtml(it.description)}</div>
          ${meta.length ? `<div class="item-meta">${meta.join("<br/>")}</div>` : ""}
        </td>
        <td class="qty">${qtyStr}</td>
        <td class="rate">${num(it.unit_price).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td class="amt">${num(it.line_total).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      </tr>`;
  }).join("");

  const logo = d.business.logo_url
    ? `<img src="${escapeHtml(d.business.logo_url)}" alt="logo" style="max-height:108px;max-width:300px;object-fit:contain;display:block;margin-bottom:10px;" />`
    : "";

  const balanceDue = d.showBalanceDue !== false && d.title.toLowerCase().includes("invoice");

  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(d.title)} ${escapeHtml(d.number)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #2c2c2c; padding: 40px; font-size: 12px; line-height: 1.45; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; gap: 24px; }
  .head .left { flex: 1; }
  .head .right { text-align: right; min-width: 240px; }
  h1.doc-title { font-size: 36px; font-weight: 300; color: #1a1a1a; margin: 0 0 6px; letter-spacing: 1px; }
  .doc-number { font-size: 18px; color: #4a90c2; font-weight: 500; letter-spacing: 0.5px; }
  .balance-box { margin-top: 14px; background: #f3f6f9; border-radius: 4px; padding: 12px 16px; text-align: right; }
  .balance-box .label { font-size: 10px; color: #6b7b8c; text-transform: uppercase; letter-spacing: 1px; }
  .balance-box .amt { font-size: 22px; font-weight: 600; color: #1a1a1a; margin-top: 2px; }
  .biz { font-size: 12px; color: #444; line-height: 1.5; }
  .biz .name { font-weight: 600; color: #1a1a1a; font-size: 13px; margin-bottom: 2px; }
  .meta { display: flex; justify-content: space-between; gap: 24px; margin: 8px 0 24px; }
  .bill-to { font-size: 12px; }
  .bill-to .label { color: #6b7b8c; font-size: 11px; margin-bottom: 4px; }
  .bill-to .name { font-weight: 600; color: #1a1a1a; font-size: 13px; }
  .meta-right { text-align: right; font-size: 12px; color: #444; }
  .meta-right .row { margin-bottom: 2px; }
  .meta-right .lbl { color: #6b7b8c; margin-right: 8px; }
  table.items { width: 100%; border-collapse: collapse; margin-top: 8px; }
  table.items thead th { background: #2c3e50; color: #fff; text-align: left; padding: 10px 12px; font-weight: 500; font-size: 11px; letter-spacing: 0.5px; }
  table.items thead th.qty, table.items thead th.rate, table.items thead th.amt { text-align: right; }
  table.items thead th.num { text-align: center; width: 36px; }
  table.items tbody td { padding: 12px; border-bottom: 1px solid #e8ecf0; vertical-align: top; }
  table.items tbody td.num { text-align: center; color: #6b7b8c; }
  table.items tbody td.qty, table.items tbody td.rate, table.items tbody td.amt { text-align: right; font-variant-numeric: tabular-nums; }
  table.items tbody td.amt { font-weight: 500; }
  .item-name { font-weight: 500; color: #1a1a1a; }
  .item-meta { color: #6b7b8c; font-size: 11px; margin-top: 4px; line-height: 1.5; }
  .totals { margin-left: auto; margin-top: 14px; width: 320px; font-size: 12px; }
  .totals .row { display: flex; justify-content: space-between; padding: 6px 12px; }
  .totals .row .lbl { color: #4a4a4a; }
  .totals .row .val { font-variant-numeric: tabular-nums; }
  .totals .grand { background: #f3f6f9; padding: 12px; border-radius: 4px; margin-top: 6px; }
  .totals .grand .lbl { font-weight: 600; color: #1a1a1a; font-size: 13px; }
  .totals .grand .val { font-weight: 700; color: #1a1a1a; font-size: 15px; }
  .notes { margin-top: 32px; padding-top: 14px; border-top: 1px solid #e8ecf0; }
  .notes .label { color: #6b7b8c; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
  .notes .content { font-size: 12px; color: #444; white-space: pre-wrap; }
  .status-chip { display: inline-block; margin-left: 8px; padding: 2px 8px; border-radius: 10px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; background: #e8ecf0; color: #4a4a4a; }
  @media print { @page { margin: 12mm; } body { padding: 0; } }
</style></head>
<body>
  <div class="head">
    <div class="left">
      ${logo}
      <div class="biz">
        <div class="name">${escapeHtml(d.business.name || "Your Business")}</div>
        <div>${escapeHtml(d.business.address || "").replace(/\n/g, "<br/>")}</div>
        <div>${escapeHtml(d.business.phone || "")}</div>
      </div>
    </div>
    <div class="right">
      <h1 class="doc-title">${escapeHtml(d.title)}${d.status ? `<span class="status-chip">${escapeHtml(d.status)}</span>` : ""}</h1>
      <div class="doc-number">${escapeHtml(d.number)}</div>
      ${balanceDue ? `<div class="balance-box"><div class="label">Balance Due</div><div class="amt">${money(d.total, d.currency)}</div></div>` : ""}
    </div>
  </div>

  <div class="meta">
    <div class="bill-to">
      <div class="label">${escapeHtml(d.counterparty.label)}</div>
      <div class="name">${escapeHtml(d.counterparty.name || "")}</div>
      <div style="color:#444">${escapeHtml(d.counterparty.address || "").replace(/\n/g, "<br/>")}</div>
      <div style="color:#444">${escapeHtml(d.counterparty.phone || "")}</div>
    </div>
    <div class="meta-right">
      <div class="row"><span class="lbl">${escapeHtml(d.title)} Date :</span>${escapeHtml(fmtDate(d.date))}</div>
      ${d.due_date ? `<div class="row"><span class="lbl">Due Date :</span>${escapeHtml(fmtDate(d.due_date))}</div>` : ""}
    </div>
  </div>

  <table class="items">
    <thead>
      <tr>
        <th class="num">#</th>
        <th>Item &amp; Description</th>
        <th class="qty">Qty</th>
        <th class="rate">Rate</th>
        <th class="amt">Amount</th>
      </tr>
    </thead>
    <tbody>${items}</tbody>
  </table>

  <div class="totals">
    <div class="row"><span class="lbl">Sub Total</span><span class="val">${money(d.subtotal, d.currency)}</span></div>
    ${tax !== 0 ? `<div class="row"><span class="lbl">Tax</span><span class="val">${money(tax, d.currency)}</span></div>` : ""}
    ${ship !== 0 ? `<div class="row"><span class="lbl">Shipping / Freight</span><span class="val">${money(ship, d.currency)}</span></div>` : ""}
    <div class="row grand"><span class="lbl">Total</span><span class="val">${money(d.total, d.currency)}</span></div>
  </div>

  ${d.notes ? `<div class="notes"><div class="label">Notes</div><div class="content">${escapeHtml(d.notes)}</div></div>` : ""}
</body></html>`;
}

export function buildDocumentHtml(d: DocInput): string {
  // Default to the acelog template for any unknown / legacy value
  if (d.template !== "classic" && d.template !== "modern" && d.template !== "compact") {
    return acelogTemplate(d);
  }
  // Legacy templates: simplified fallback that still includes shipping
  const ship = num(d.shipping);
  const tax = num(d.tax);
  const items = d.items.map((it, idx) => `
    <tr>
      <td style="text-align:center">${idx + 1}</td>
      <td>${escapeHtml(it.description)}${it.grn_ref ? `<br/><span style="color:#666;font-size:11px">GRN : ${escapeHtml(it.grn_ref)}</span>` : ""}${it.vehicle_ref ? `<br/><span style="color:#666;font-size:11px">Veh : ${escapeHtml(it.vehicle_ref)}</span>` : ""}</td>
      <td style="text-align:right">${num(it.quantity).toLocaleString("en-US", { minimumFractionDigits: 2 })}${it.unit ? ` ${escapeHtml(it.unit)}` : ""}</td>
      <td style="text-align:right">${money(it.unit_price, d.currency)}</td>
      <td style="text-align:right">${money(it.line_total, d.currency)}</td>
    </tr>`).join("");
  const logo = d.business.logo_url ? `<img src="${escapeHtml(d.business.logo_url)}" alt="logo" style="max-height:96px;max-width:270px;object-fit:contain;margin-bottom:8px" />` : "";

  const fontMap = {
    classic: "Georgia, 'Times New Roman', serif",
    modern: "-apple-system, 'Segoe UI', sans-serif",
    compact: "'Helvetica Neue', Arial, sans-serif",
  } as const;
  const pad = d.template === "compact" ? "24px" : d.template === "modern" ? "56px" : "48px";
  const fs = d.template === "compact" ? "11px" : "13px";

  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(d.title)} ${escapeHtml(d.number)}</title>
  <style>
    body { font-family: ${fontMap[d.template]}; color:#1a1a1a; padding:${pad}; font-size:${fs}; }
    h1 { font-size:28px; margin:0 0 4px; }
    .top { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #1a1a1a; padding-bottom:12px; margin-bottom:20px; gap:24px; }
    .biz { text-align:right; font-size:12px; }
    .parties { display:grid; grid-template-columns:1fr 1fr; gap:24px; margin-bottom:20px; }
    .label { font-size:10px; text-transform:uppercase; letter-spacing:1px; color:#666; }
    table { width:100%; border-collapse:collapse; }
    th { text-align:left; background:#f0f0f0; padding:8px; border-bottom:1px solid #ccc; }
    td { padding:8px; border-bottom:1px solid #eee; vertical-align:top; }
    .totals { margin-top:16px; margin-left:auto; width:280px; }
    .totals .row { display:flex; justify-content:space-between; padding:4px 0; }
    .totals .grand { border-top:2px solid #1a1a1a; padding-top:8px; font-weight:bold; font-size:15px; }
    @media print { @page { margin: 12mm; } }
  </style></head><body>
  <div class="top">
    <div>${logo}<h1>${escapeHtml(d.title)}</h1><div style="color:#666">No. ${escapeHtml(d.number)} · ${escapeHtml(fmtDate(d.date))}${d.status ? ` · ${escapeHtml(d.status.toUpperCase())}` : ""}</div></div>
    <div class="biz"><div style="font-weight:600">${escapeHtml(d.business.name || "Your Business")}</div><div>${escapeHtml(d.business.address || "")}</div><div>${escapeHtml(d.business.phone || "")}</div></div>
  </div>
  <div class="parties">
    <div><div class="label">${escapeHtml(d.counterparty.label)}</div><div style="font-weight:600">${escapeHtml(d.counterparty.name || "")}</div><div>${escapeHtml(d.counterparty.address || "")}</div><div>${escapeHtml(d.counterparty.phone || "")}</div></div>
    <div style="text-align:right"><div class="label">Date</div><div>${escapeHtml(fmtDate(d.date))}</div>${d.due_date ? `<div class="label" style="margin-top:8px">Due</div><div>${escapeHtml(fmtDate(d.due_date))}</div>` : ""}</div>
  </div>
  <table>
    <thead><tr><th style="width:30px;text-align:center">#</th><th>Description</th><th style="text-align:right">Qty</th><th style="text-align:right">Rate</th><th style="text-align:right">Amount</th></tr></thead>
    <tbody>${items}</tbody>
  </table>
  <div class="totals">
    <div class="row"><span>Subtotal</span><span>${money(d.subtotal, d.currency)}</span></div>
    ${tax !== 0 ? `<div class="row"><span>Tax</span><span>${money(tax, d.currency)}</span></div>` : ""}
    ${ship !== 0 ? `<div class="row"><span>Shipping / Freight</span><span>${money(ship, d.currency)}</span></div>` : ""}
    <div class="row grand"><span>Total</span><span>${money(d.total, d.currency)}</span></div>
  </div>
  ${d.notes ? `<div style="margin-top:24px;font-size:11px;color:#666;border-top:1px solid #eee;padding-top:12px"><div class="label">Notes</div>${escapeHtml(d.notes)}</div>` : ""}
  </body></html>`;
}

export function renderDocument(d: DocInput) {
  const html = buildDocumentHtml(d);
  const w = window.open("", "_blank", "width=900,height=1100");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
  setTimeout(() => { w.focus(); w.print(); }, 400);
}
