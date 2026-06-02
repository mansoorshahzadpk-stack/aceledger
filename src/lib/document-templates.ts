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
  discount?: number | string | null;
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
  return `<span${color}>${CURRENCY_SYMBOLS[c]}&nbsp;&nbsp;${sign}${abs}</span>`;
}
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
function formatPrintMath(val: number | string): string {
  const sVal = String(val).trim();
  if (sVal.includes("=")) {
    const parts = sVal.split("=");
    const expr = parts[0].trim();
    const resVal = parseFloat(parts[parts.length - 1].trim());
    const formattedRes = isNaN(resVal)
      ? parts[parts.length - 1].trim()
      : resVal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    return `<span style="font-size: 0.85em; color: #6b7280; font-weight: normal; font-family: monospace;">${escapeHtml(expr)}</span> <span style="color: #9ca3af; font-family: monospace;">=</span> <span style="font-weight: 500;">${formattedRes}</span>`;
  }

  const numericVal = num(val);
  const formattedRes = numericVal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `<span>${formattedRes}</span>`;
}

function qtyStr(it: DocItem) {
  const qStr = formatPrintMath(it.quantity);
  return it.unit ? `${qStr} ${escapeHtml(it.unit)}` : qStr;
}
function rateStr(it: DocItem) {
  return formatPrintMath(it.unit_price);
}
function amtStr(it: DocItem) {
  return num(it.line_total).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function itemMeta(it: DocItem) {
  const meta: string[] = [];
  if (it.grn_ref) meta.push(`GRN : ${escapeHtml(it.grn_ref)}`);
  if (it.vehicle_ref) meta.push(`Veh : ${escapeHtml(it.vehicle_ref)}`);
  return meta;
}

/* =====================================================================
   ACE DESIGN — original clean layout, balance-due card, blue accent
   ===================================================================== */
function acelogTemplate(d: DocInput): string {
  const ship = num(d.shipping);
  const tax = num(d.tax);
  const discount = num(d.discount);
  const items = d.items.map((it, idx) => {
    const meta = itemMeta(it);
    return `
      <tr>
        <td class="num">${idx + 1}</td>
        <td>
          <div class="item-name">${escapeHtml(it.description)}</div>
          ${meta.length ? `<div class="item-meta">${meta.join("<br/>")}</div>` : ""}
        </td>
        <td class="qty">${qtyStr(it)}</td>
        <td class="rate">${rateStr(it)}</td>
        <td class="amt">${amtStr(it)}</td>
      </tr>`;
  }).join("");

  const logo = d.business.logo_url
    ? `<img src="${escapeHtml(d.business.logo_url)}" alt="logo" style="max-height:108px;max-width:300px;object-fit:contain;display:block;margin-bottom:10px;" />`
    : "";
  const balanceDue = d.showBalanceDue !== false && d.title.toLowerCase().includes("invoice");

  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(d.title)} ${escapeHtml(d.number)}</title>
<style>
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
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
  .biz .name { font-weight: 600; color: #1a1a1a; font-size: 26px; margin-bottom: 4px; }
  .meta { display: flex; justify-content: space-between; gap: 24px; margin: 8px 0 24px; }
  .bill-to .label { color: #6b7b8c; font-size: 11px; margin-bottom: 4px; }
  .bill-to .name { font-weight: 600; color: #1a1a1a; font-size: 13px; }
  .meta-right { text-align: right; font-size: 12px; color: #444; }
  .meta-right .lbl { color: #6b7b8c; margin-right: 8px; }
  table.items { width: 100%; border-collapse: collapse; margin-top: 8px; }
  table.items thead th { background: #2c3e50; color: #fff; text-align: left; padding: 10px 12px; font-weight: 500; font-size: 11px; letter-spacing: 0.5px; }
  table.items thead th.qty, table.items thead th.rate, table.items thead th.amt { text-align: right; }
  table.items thead th.num { text-align: center; width: 36px; }
  table.items tbody td { padding: 12px; border-bottom: 1px solid #e8ecf0; vertical-align: top; }
  table.items tbody td.num { text-align: center; color: #6b7b8c; }
  table.items tbody td.qty, table.items tbody td.rate, table.items tbody td.amt { text-align: right; font-variant-numeric: tabular-nums; }
  .item-name { font-weight: 500; color: #1a1a1a; }
  .item-meta { color: #6b7b8c; font-size: 11px; margin-top: 4px; line-height: 1.5; }
  .totals { margin-left: auto; margin-top: 14px; width: 320px; font-size: 12px; }
  .totals .row { display: flex; justify-content: space-between; padding: 6px 12px; }
  .totals .grand { background: #f3f6f9; padding: 12px; border-radius: 4px; margin-top: 6px; }
  .totals .grand .lbl { font-weight: 600; color: #1a1a1a; font-size: 13px; }
  .totals .grand .val { font-weight: 700; color: #1a1a1a; font-size: 15px; }
  .notes { margin-top: 32px; padding-top: 14px; border-top: 1px solid #e8ecf0; }
  .notes .label { color: #6b7b8c; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
  .status-chip { display: inline-block; margin-left: 8px; padding: 2px 8px; border-radius: 10px; font-size: 10px; text-transform: uppercase; background: #e8ecf0; color: #4a4a4a; }
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
      <div><span class="lbl">${escapeHtml(d.title)} Date :</span>${escapeHtml(fmtDate(d.date))}</div>
      ${d.due_date ? `<div><span class="lbl">Due Date :</span>${escapeHtml(fmtDate(d.due_date))}</div>` : ""}
    </div>
  </div>
  <table class="items">
    <thead><tr><th class="num">#</th><th>Item &amp; Description</th><th class="qty">Qty</th><th class="rate">Rate</th><th class="amt">Amount</th></tr></thead>
    <tbody>${items}</tbody>
  </table>
  <div class="totals">
    <div class="row"><span>Sub Total</span><span>${money(d.subtotal, d.currency)}</span></div>
    ${tax !== 0 ? `<div class="row"><span>Tax</span><span>${money(tax, d.currency)}</span></div>` : ""}
    ${ship !== 0 ? `<div class="row"><span>Shipping / Freight</span><span>${money(ship, d.currency)}</span></div>` : ""}
    ${discount !== 0 ? `<div class="row"><span>Discount</span><span>${money(-discount, d.currency)}</span></div>` : ""}
    <div class="row grand"><span class="lbl">Total</span><span class="val">${money(d.total, d.currency)}</span></div>
  </div>
  ${d.notes ? `<div class="notes"><div class="label">Notes</div><div>${escapeHtml(d.notes)}</div></div>` : ""}
</body></html>`;
}

/* =====================================================================
   CLASSIC — formal serif letterhead, centered masthead, ruled tables
   ===================================================================== */
function classicTemplate(d: DocInput): string {
  const ship = num(d.shipping);
  const tax = num(d.tax);
  const discount = num(d.discount);
  const items = d.items.map((it, idx) => {
    const meta = itemMeta(it);
    return `<tr>
      <td class="num">${idx + 1}.</td>
      <td><div class="iname">${escapeHtml(it.description)}</div>${meta.length ? `<div class="imeta">${meta.join(" &nbsp;·&nbsp; ")}</div>` : ""}</td>
      <td class="qty">${qtyStr(it)}</td>
      <td class="rate">${rateStr(it)}</td>
      <td class="amt">${amtStr(it)}</td>
    </tr>`;
  }).join("");
  const logo = d.business.logo_url
    ? `<img src="${escapeHtml(d.business.logo_url)}" alt="logo" style="max-height:80px;margin:0 auto 10px;display:block;" />`
    : "";

  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(d.title)} ${escapeHtml(d.number)}</title>
<style>
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: 'Garamond', 'Hoefler Text', Georgia, 'Times New Roman', serif; color: #1a1a1a; background: #fafaf7; padding: 56px 64px; font-size: 12.5px; line-height: 1.55; }
  .masthead { text-align: center; padding-bottom: 18px; border-bottom: 3px double #1a1a1a; margin-bottom: 28px; }
  .biz .name { font-size: 26px; font-weight: 700; letter-spacing: 6px; text-transform: uppercase; margin-bottom: 6px; }
  .biz .sub { font-size: 11px; color: #555; letter-spacing: 1px; text-transform: uppercase; }
  .title-row { text-align: center; margin-bottom: 24px; }
  .title-row h1 { margin: 0; font-size: 22px; font-weight: 400; letter-spacing: 8px; text-transform: uppercase; color: #1a1a1a; }
  .title-row .sub { font-size: 11px; color: #555; margin-top: 4px; font-style: italic; letter-spacing: 2px; }
  .meta { display: flex; justify-content: space-between; gap: 32px; margin-bottom: 24px; }
  .meta .box { flex: 1; border: 1px solid #cfc9bd; padding: 14px 18px; }
  .meta .lbl { font-size: 10px; text-transform: uppercase; letter-spacing: 2px; color: #7a7468; margin-bottom: 6px; }
  .meta .name { font-weight: 700; font-size: 14px; margin-bottom: 4px; }
  .meta .dates { font-size: 12px; }
  .meta .dates div { display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px dotted #cfc9bd; }
  .meta .dates div:last-child { border: 0; }
  table.items { width: 100%; border-collapse: collapse; margin-top: 8px; border-top: 2px solid #1a1a1a; border-bottom: 2px solid #1a1a1a; }
  table.items thead th { padding: 10px 8px; font-size: 10px; text-transform: uppercase; letter-spacing: 2px; font-weight: 600; border-bottom: 1px solid #1a1a1a; text-align: left; }
  table.items thead th.qty, table.items thead th.rate, table.items thead th.amt { text-align: right; }
  table.items thead th.num { width: 30px; text-align: left; }
  table.items tbody td { padding: 12px 8px; border-bottom: 1px solid #e6e1d4; vertical-align: top; }
  table.items tbody td.qty, table.items tbody td.rate, table.items tbody td.amt { text-align: right; font-variant-numeric: tabular-nums; }
  table.items tbody td.num { color: #7a7468; }
  .iname { font-style: italic; font-size: 13px; }
  .imeta { color: #7a7468; font-size: 10.5px; margin-top: 3px; font-style: normal; }
  .totals { margin-left: auto; width: 320px; margin-top: 18px; font-size: 12.5px; }
  .totals .row { display: flex; justify-content: space-between; padding: 5px 0; }
  .totals .grand { border-top: 1px solid #1a1a1a; border-bottom: 3px double #1a1a1a; padding: 10px 0; margin-top: 8px; font-weight: 700; font-size: 15px; text-transform: uppercase; letter-spacing: 2px; }
  .notes { margin-top: 36px; padding-top: 16px; border-top: 1px solid #cfc9bd; font-style: italic; font-size: 12px; color: #4a4a4a; }
  .notes .lbl { font-style: normal; text-transform: uppercase; letter-spacing: 2px; font-size: 10px; color: #7a7468; margin-bottom: 4px; }
  .foot { text-align: center; margin-top: 40px; font-size: 10px; color: #7a7468; letter-spacing: 3px; text-transform: uppercase; }
  @media print { @page { margin: 14mm; } body { padding: 0; } }
</style></head>
<body>
  <div class="masthead">
    ${logo}
    <div class="biz"><div class="name">${escapeHtml(d.business.name || "Your Business")}</div>
      <div class="sub">${escapeHtml(d.business.address || "").replace(/\n/g, " &nbsp;·&nbsp; ")}${d.business.phone ? ` &nbsp;·&nbsp; ${escapeHtml(d.business.phone)}` : ""}</div>
    </div>
  </div>
  <div class="title-row">
    <h1>${escapeHtml(d.title)}</h1>
    <div class="sub">№ ${escapeHtml(d.number)}${d.status ? ` — ${escapeHtml(d.status)}` : ""}</div>
  </div>
  <div class="meta">
    <div class="box">
      <div class="lbl">${escapeHtml(d.counterparty.label)}</div>
      <div class="name">${escapeHtml(d.counterparty.name || "")}</div>
      <div>${escapeHtml(d.counterparty.address || "").replace(/\n/g, "<br/>")}</div>
      <div>${escapeHtml(d.counterparty.phone || "")}</div>
    </div>
    <div class="box dates">
      <div class="lbl">Particulars</div>
      <div><span>${escapeHtml(d.title)} Date</span><span>${escapeHtml(fmtDate(d.date))}</span></div>
      ${d.due_date ? `<div><span>Due Date</span><span>${escapeHtml(fmtDate(d.due_date))}</span></div>` : ""}
      <div><span>Currency</span><span>${escapeHtml(d.currency)}</span></div>
    </div>
  </div>
  <table class="items">
    <thead><tr><th class="num">#</th><th>Description</th><th class="qty">Quantity</th><th class="rate">Rate</th><th class="amt">Amount</th></tr></thead>
    <tbody>${items}</tbody>
  </table>
  <div class="totals">
    <div class="row"><span>Subtotal</span><span>${money(d.subtotal, d.currency)}</span></div>
    ${tax !== 0 ? `<div class="row"><span>Tax</span><span>${money(tax, d.currency)}</span></div>` : ""}
    ${ship !== 0 ? `<div class="row"><span>Shipping</span><span>${money(ship, d.currency)}</span></div>` : ""}
    ${discount !== 0 ? `<div class="row"><span>Discount</span><span>${money(-discount, d.currency)}</span></div>` : ""}
    <div class="row grand"><span>Total</span><span>${money(d.total, d.currency)}</span></div>
  </div>
  ${d.notes ? `<div class="notes"><div class="lbl">Remarks</div>${escapeHtml(d.notes)}</div>` : ""}
  <div class="foot">— Thank you for your business —</div>
</body></html>`;
}

/* =====================================================================
   MODERN — blue-red gradient header band, floating card, elegant layout
   ===================================================================== */
function modernTemplate(d: DocInput): string {
  const ship = num(d.shipping);
  const tax = num(d.tax);
  const discount = num(d.discount);
  const items = d.items.map((it) => {
    const meta = itemMeta(it);
    return `<tr>
      <td class="desc">
        <div class="iname">${escapeHtml(it.description)}</div>
        ${meta.length ? `<div class="imeta">${meta.join(" &nbsp;·&nbsp; ")}</div>` : ""}
      </td>
      <td class="qty">${qtyStr(it)}</td>
      <td class="cost">${rateStr(it)}</td>
      <td class="subtotal">${amtStr(it)}</td>
    </tr>`;
  }).join("");

  const logo = d.business.logo_url
    ? `<img src="${escapeHtml(d.business.logo_url)}" alt="logo" style="max-height:56px;max-width:200px;object-fit:contain;display:block;margin-bottom:8px;margin-left:auto;" />`
    : "";

  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(d.title)} ${escapeHtml(d.number)}</title>
<style>
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1f2937; background: #f9fafb; margin: 0; padding: 0; font-size: 11px; line-height: 1.5; }
  .hero { background: linear-gradient(135deg, #1e3a8a, #3b82f6, #ef4444); color: #ffffff; padding: 48px 48px 64px 48px; }
  .hero-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 32px; }
  .hero-left { flex: 1; }
  .hero-right { text-align: right; min-width: 240px; }
  .doc-title { font-size: 40px; font-weight: 800; letter-spacing: -1px; margin: 0 0 6px; text-transform: uppercase; color: #ffffff; line-height: 1; }
  .doc-number { font-size: 16px; font-weight: 600; color: rgba(255, 255, 255, 0.9); }
  .doc-date { font-size: 11px; color: rgba(255, 255, 255, 0.8); margin-top: 4px; }
  .biz-info { font-size: 11px; color: rgba(255, 255, 255, 0.9); line-height: 1.4; margin-top: 6px; }
  .biz-info .name { font-weight: 800; font-size: 18px; color: #ffffff; margin-bottom: 4px; }
  .container { padding: 0 48px 48px 48px; position: relative; }
  .floating-card { background: #ffffff; border-radius: 8px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05); border: 1px solid rgba(0, 0, 0, 0.03); padding: 24px; margin-top: -32px; display: flex; justify-content: space-between; gap: 32px; margin-bottom: 32px; }
  .card-col-left { flex: 1; }
  .card-col-right { min-width: 200px; text-align: right; border-left: 1px solid #f3f4f6; padding-left: 32px; }
  .lbl { font-size: 9px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; margin-bottom: 6px; }
  .counterparty-name { font-weight: 700; font-size: 13px; color: #111827; margin-bottom: 2px; }
  .counterparty-addr { color: #4b5563; line-height: 1.4; }
  .particulars-table { margin-left: auto; border-collapse: collapse; font-size: 11px; text-align: right; }
  .particulars-table td { padding: 3px 0; }
  .particulars-table td.lbl { font-weight: bold; color: #6b7280; text-transform: uppercase; padding-right: 16px; text-align: right; margin-bottom: 0; }
  .particulars-table td.val { color: #111827; }
  table.items { width: 100%; border-collapse: separate; border-spacing: 0; margin-top: 16px; border-radius: 6px; overflow: hidden; border: 1px solid #e5e7eb; background: #ffffff; }
  table.items thead th { background: #1e3a8a; color: #ffffff; text-align: left; padding: 12px 16px; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; border: none; }
  table.items thead th.qty, table.items thead th.cost, table.items thead th.subtotal { text-align: right; }
  table.items tbody td { padding: 14px 16px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
  table.items tbody tr:last-child td { border-bottom: none; }
  table.items tbody td.qty, table.items tbody td.cost, table.items tbody td.subtotal { text-align: right; font-variant-numeric: tabular-nums; }
  .iname { font-weight: 600; color: #111827; }
  .imeta { color: #6b7280; font-size: 9.5px; margin-top: 4px; }
  .summary-container { display: flex; justify-content: flex-end; margin-top: 24px; }
  .totals { width: 300px; }
  .totals-table { width: 300px; border-collapse: collapse; font-size: 11px; }
  .totals-table td { padding: 6px 12px; }
  .totals-table td.lbl { text-align: left; color: #4b5563; }
  .totals-table td.val { text-align: right; font-variant-numeric: tabular-nums; color: #111827; }
  .totals-table tr.grand-row td { padding: 0; }
  .grand-badge { background: #ef4444; color: #ffffff; border-radius: 6px; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; margin-top: 8px; font-weight: bold; font-size: 14px; }
  .grand-badge .lbl { color: rgba(255, 255, 255, 0.9); font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0; }
  .grand-badge .val { color: #ffffff; font-size: 16px; font-weight: 800; font-variant-numeric: tabular-nums; }
  .notes-section { margin-top: 32px; background: #ffffff; border-radius: 6px; border: 1px solid #e5e7eb; padding: 16px 20px; max-width: 600px; }
  .notes-section .lbl { font-size: 9px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; margin-bottom: 6px; }
  .notes-body { font-size: 10.5px; color: #4b5563; line-height: 1.45; white-space: pre-wrap; }
  .footer-decor { margin-top: 48px; height: 8px; background: linear-gradient(135deg, #1e3a8a, #3b82f6, #ef4444); border-radius: 4px; }
  @media print { @page { margin: 0; size: A4; } body { background: #fff; } }
</style></head>
<body>
  <div class="hero">
    <div class="hero-row">
      <div class="hero-left">
        <h1 class="doc-title">${escapeHtml(d.title)}</h1>
        <div class="doc-number">№ ${escapeHtml(d.number)}</div>
        <div class="doc-date">Date: ${escapeHtml(fmtDate(d.date))}</div>
      </div>
      <div class="hero-right">
        ${logo}
        <div class="biz-info">
          <div class="name">${escapeHtml(d.business.name || "Your Business")}</div>
          <div>${escapeHtml(d.business.address || "").replace(/\n/g, "<br/>")}</div>
          ${d.business.phone ? `<div>Phone: ${escapeHtml(d.business.phone)}</div>` : ""}
        </div>
      </div>
    </div>
  </div>

  <div class="container">
    <div class="floating-card">
      <div class="card-col-left">
        <div class="lbl">${escapeHtml(d.counterparty.label)}</div>
        <div class="counterparty-name">${escapeHtml(d.counterparty.name || "")}</div>
        <div class="counterparty-addr">${escapeHtml(d.counterparty.address || "").replace(/\n/g, "<br/>")}</div>
        ${d.counterparty.phone ? `<div style="margin-top: 4px; color: #4b5563;">Phone: ${escapeHtml(d.counterparty.phone)}</div>` : ""}
      </div>
      <div class="card-col-right">
        <div class="lbl">Particulars</div>
        <table class="particulars-table">
          <tr><td class="lbl">Due Date:</td><td class="val">${d.due_date ? escapeHtml(fmtDate(d.due_date)) : "—"}</td></tr>
          <tr><td class="lbl">Currency:</td><td class="val">${escapeHtml(d.currency)}</td></tr>
        </table>
      </div>
    </div>

    <table class="items">
      <thead>
        <tr>
          <th>Description</th>
          <th class="qty">Qty</th>
          <th class="cost">Cost</th>
          <th class="subtotal">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        ${items}
      </tbody>
    </table>

    <div class="summary-container">
      <div class="totals">
        <table class="totals-table">
          <tr><td class="lbl">Subtotal</td><td class="val">${money(d.subtotal, d.currency)}</td></tr>
          ${tax !== 0 ? `<tr><td class="lbl">Tax</td><td class="val">${money(tax, d.currency)}</td></tr>` : ""}
          ${ship !== 0 ? `<tr><td class="lbl">Shipping</td><td class="val">${money(ship, d.currency)}</td></tr>` : ""}
          ${discount !== 0 ? `<tr><td class="lbl">Discount</td><td class="val">${money(-discount, d.currency)}</td></tr>` : ""}
          <tr class="grand-row">
            <td colspan="2">
              <div class="grand-badge">
                <span class="lbl">Total</span>
                <span class="val">${money(d.total, d.currency)}</span>
              </div>
            </td>
          </tr>
        </table>
      </div>
    </div>

    ${d.notes ? `
      <div class="notes-section">
        <div class="lbl">Notes &amp; Remarks</div>
        <div class="notes-body">${escapeHtml(d.notes)}</div>
      </div>
    ` : ""}

    <div class="footer-decor"></div>
  </div>
</body></html>`;
}


/* =====================================================================
   SIMPLE — elegant single-column grayscale template with grouped details
   ===================================================================== */
function compactTemplate(d: DocInput): string {
  const ship = num(d.shipping);
  const tax = num(d.tax);
  const discount = num(d.discount);
  const items = d.items.map((it, idx) => {
    const meta = itemMeta(it);
    return `<tr>
      <td class="desc">
        <span class="num">${idx + 1}.</span> <span class="iname">${escapeHtml(it.description)}</span>
        ${meta.length ? `<div class="imeta">${meta.join(" &nbsp;·&nbsp; ")}</div>` : ""}
      </td>
      <td class="rate">${rateStr(it)}</td>
      <td class="qty">${qtyStr(it)}</td>
      <td class="amt">${amtStr(it)}</td>
    </tr>`;
  }).join("");

  const logo = d.business.logo_url
    ? `<img src="${escapeHtml(d.business.logo_url)}" alt="logo" style="max-height:80px;max-width:240px;object-fit:contain;display:block;" />`
    : "";

  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(d.title)} ${escapeHtml(d.number)}</title>
<style>
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #111; background: #fff; padding: 40px 48px; font-size: 11px; line-height: 1.45; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; gap: 24px; }
  .header .left { flex: 1; }
  .header .right { text-align: right; }
  .doc-title { font-size: 28px; font-weight: 800; color: #000; margin: 0 0 4px; letter-spacing: 0.5px; text-transform: uppercase; }
  .meta-container { display: flex; justify-content: space-between; margin-bottom: 32px; gap: 40px; }
  .meta-left { flex: 1; }
  .meta-left .lbl { font-size: 9px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; color: #666; margin-bottom: 6px; }
  .meta-left .name { font-weight: 700; font-size: 13px; color: #000; margin-bottom: 2px; }
  .meta-left .addr { color: #333; line-height: 1.4; }
  .meta-right { min-width: 220px; text-align: right; }
  .meta-table { margin-left: auto; border-collapse: collapse; font-size: 11px; }
  .meta-table td { padding: 3px 0; }
  .meta-table td.lbl { font-weight: bold; text-transform: uppercase; color: #555; text-align: right; padding-right: 16px; }
  .meta-table td.val { text-align: right; font-weight: normal; color: #000; }
  .meta-table tr.highlight td.val { font-weight: bold; }
  .biz-info { font-size: 11px; color: #333; line-height: 1.4; margin-top: 6px; }
  .biz-info .name { font-weight: 700; font-size: 14px; color: #000; margin-bottom: 2px; }
  table.items { width: 100%; border-collapse: collapse; margin-top: 16px; margin-bottom: 24px; }
  table.items thead th { text-align: left; padding: 10px 8px; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; font-weight: bold; color: #000; border-bottom: 1.5px solid #000; }
  table.items thead th.qty, table.items thead th.rate, table.items thead th.amt { text-align: right; }
  table.items tbody td { padding: 10px 8px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
  table.items tbody td.qty, table.items tbody td.rate, table.items tbody td.amt { text-align: right; font-variant-numeric: tabular-nums; }
  .iname { font-weight: 600; color: #000; }
  .num { color: #666; font-weight: normal; margin-right: 4px; }
  .imeta { color: #555; font-size: 9.5px; margin-top: 3px; }
  .totals-container { display: flex; justify-content: flex-end; margin-bottom: 40px; }
  .totals-table { width: 280px; border-collapse: collapse; font-size: 11px; }
  .totals-table td { padding: 6px 8px; }
  .totals-table td.lbl { text-align: left; color: #444; }
  .totals-table td.val { text-align: right; font-variant-numeric: tabular-nums; }
  .totals-table tr.grand { border-top: 1.5px solid #000; border-bottom: 3px double #000; font-weight: bold; font-size: 13px; }
  .totals-table tr.grand td { padding: 8px 8px; color: #000; }
  .notes-container { margin-top: 20px; }
  .notes-container .lbl { font-size: 9px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; color: #666; margin-bottom: 6px; }
  .notes-container .notes-body { font-size: 10.5px; color: #333; line-height: 1.45; white-space: pre-wrap; }
  @media print { @page { margin: 12mm; } body { padding: 0; } }
</style></head>
<body>
  <div class="header">
    <div class="left">
      <h1 class="doc-title">${escapeHtml(d.title)}</h1>
      <div class="biz-info">
        <div class="name">${escapeHtml(d.business.name || "Your Business")}</div>
        <div>${escapeHtml(d.business.address || "").replace(/\n/g, "<br/>")}</div>
        ${d.business.phone ? `<div>Phone: ${escapeHtml(d.business.phone)}</div>` : ""}
      </div>
    </div>
    <div class="right">
      ${logo}
    </div>
  </div>

  <div class="meta-container">
    <div class="meta-left">
      <div class="lbl">${escapeHtml(d.counterparty.label)}</div>
      <div class="name">${escapeHtml(d.counterparty.name || "")}</div>
      <div class="addr">${escapeHtml(d.counterparty.address || "").replace(/\n/g, "<br/>")}</div>
      ${d.counterparty.phone ? `<div style="margin-top: 4px;">Phone: ${escapeHtml(d.counterparty.phone)}</div>` : ""}
    </div>
    <div class="meta-right">
      <table class="meta-table">
        <tr class="highlight"><td class="lbl">${escapeHtml(d.title)} No:</td><td class="val">${escapeHtml(d.number)}</td></tr>
        <tr><td class="lbl">Date:</td><td class="val">${escapeHtml(fmtDate(d.date))}</td></tr>
        ${d.due_date ? `<tr><td class="lbl">Due Date:</td><td class="val">${escapeHtml(fmtDate(d.due_date))}</td></tr>` : ""}
        <tr><td class="lbl">Currency:</td><td class="val">${escapeHtml(d.currency)}</td></tr>
      </table>
    </div>
  </div>

  <table class="items">
    <thead>
      <tr>
        <th>Description</th>
        <th class="rate">Rate</th>
        <th class="qty">Qty</th>
        <th class="amt">Total</th>
      </tr>
    </thead>
    <tbody>
      ${items}
    </tbody>
  </table>

  <div class="totals-container">
    <table class="totals-table">
      <tr><td class="lbl">Subtotal</td><td class="val">${money(d.subtotal, d.currency)}</td></tr>
      ${tax !== 0 ? `<tr><td class="lbl">Tax</td><td class="val">${money(tax, d.currency)}</td></tr>` : ""}
      ${ship !== 0 ? `<tr><td class="lbl">Shipping / Freight</td><td class="val">${money(ship, d.currency)}</td></tr>` : ""}
      ${discount !== 0 ? `<tr><td class="lbl">Discount</td><td class="val">${money(-discount, d.currency)}</td></tr>` : ""}
      <tr class="grand"><td class="lbl">Total</td><td class="val">${money(d.total, d.currency)}</td></tr>
    </table>
  </div>

  ${d.notes ? `
    <div class="notes-container">
      <div class="lbl">Payment Info / Notes</div>
      <div class="notes-body">${escapeHtml(d.notes)}</div>
    </div>
  ` : ""}
</body></html>`;
}

export function buildDocumentHtml(d: DocInput): string {
  switch (d.template) {
    case "classic": return classicTemplate(d);
    case "modern":  return modernTemplate(d);
    case "compact": return compactTemplate(d);
    default:        return acelogTemplate(d);
  }
}

function injectToolbar(html: string, filename: string): string {
  const fnameJson = JSON.stringify(filename);
  const CDN = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.2/html2pdf.bundle.min.js";
  const onclick =
    "(function(){" +
      "var bar=document.querySelector('.doc-toolbar');" +
      "function waitImgs(){" +
        "var imgs=Array.prototype.slice.call(document.images||[]);" +
        "return Promise.all(imgs.map(function(img){" +
          "if(img.complete&&img.naturalWidth>0){return img.decode?img.decode().catch(function(){}):Promise.resolve();}" +
          "return new Promise(function(res){" +
            "var done=false;function fin(){if(done)return;done=true;res();}" +
            "img.addEventListener('load',function(){(img.decode?img.decode().catch(function(){}):Promise.resolve()).then(fin);});" +
            "img.addEventListener('error',fin);" +
            "setTimeout(fin,6000);" +
          "});" +
        "}));" +
      "}" +
      "function run(){try{" +
        "if(bar)bar.style.display='none';" +
        "var opt={margin:10,filename:" + fnameJson + "," +
          "image:{type:'jpeg',quality:0.95}," +
          "html2canvas:{scale:2,useCORS:true,allowTaint:false,backgroundColor:'#ffffff',imageTimeout:15000}," +
          "jsPDF:{unit:'mm',format:'a4',orientation:'portrait'}," +
          "pagebreak:{mode:['css','legacy']}};" +
        "waitImgs().then(function(){return window.html2pdf().set(opt).from(document.body).save();})" +
          ".then(function(){if(bar)bar.style.display='';})" +
          ".catch(function(e){if(bar)bar.style.display='';alert('PDF failed: '+(e&&e.message||e));window.print();});" +
      "}catch(e){if(bar)bar.style.display='';alert('PDF failed: '+e.message);window.print();}}" +
      "if(window.html2pdf){run();return;}" +
      "var s=document.createElement('script');s.src='" + CDN + "';" +
      "s.onload=run;s.onerror=function(){alert('Could not load PDF library. Using Print instead.');window.print();};" +
      "document.head.appendChild(s);" +
    "})()";
  const toolbar = `
<style>
  .doc-toolbar { position: sticky; top: 0; z-index: 9999; display: flex; gap: 8px; justify-content: flex-end;
    padding: 10px 16px; background: #1a1a1a; box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
  .doc-toolbar button { font: 500 13px/1 -apple-system, Segoe UI, Inter, Arial, sans-serif;
    padding: 9px 14px; border-radius: 6px; border: 0; cursor: pointer;
    background: #ffffff; color: #1a1a1a; }
  .doc-toolbar button.dl { background: #2b8acb; color: #fff; }
  @media print { .doc-toolbar { display: none !important; } }
</style>
<div class="doc-toolbar">
  <button type="button" class="dl" onclick="${escapeHtml(onclick)}">Download PDF</button>
  <button type="button" onclick="window.print()">Print / Save as PDF</button>
</div>`;
  if (html.includes("<body>")) return html.replace("<body>", `<body>${toolbar}`);
  return toolbar + html;
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPadOS 13+ reports as Mac; detect via touch points
  return ua.includes("Mac") && typeof document !== "undefined" && (navigator as any).maxTouchPoints > 1;
}

async function fetchAsDataUrl(url: string): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(url, { mode: "cors", signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(typeof fr.result === "string" ? fr.result : null);
      fr.onerror = () => resolve(null);
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function renderDocument(d: DocInput) {
  const safeName = `${d.title}-${d.number}`.replace(/[^a-z0-9\-_. ]+/gi, "_").trim() || "document";
  const filename = `${safeName}.pdf`;

  let input = d;
  const logoUrl = d.business.logo_url;
  if (logoUrl && /^https?:\/\//i.test(logoUrl)) {
    const dataUrl = await fetchAsDataUrl(logoUrl);
    if (dataUrl) {
      input = { ...d, business: { ...d.business, logo_url: dataUrl } };
    }
  }

  let html = buildDocumentHtml(input);
  html = injectToolbar(html, filename);

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  if (isIOS()) {
    // iOS Safari/Chrome: navigate current tab so the share sheet → Save to Files works reliably.
    window.location.href = url;
  } else {
    const w = window.open(url, "_blank");
    if (!w) {
      // Popup blocked — fall back to same-tab navigation.
      window.location.href = url;
    }
  }

  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
