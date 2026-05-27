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
function qtyStr(it: DocItem) {
  const q = num(it.quantity).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return it.unit ? `${q} ${escapeHtml(it.unit)}` : q;
}
function rateStr(it: DocItem) {
  return num(it.unit_price).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
  * { box-sizing: border-box; }
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
    <div class="row grand"><span>Total</span><span>${money(d.total, d.currency)}</span></div>
  </div>
  ${d.notes ? `<div class="notes"><div class="lbl">Remarks</div>${escapeHtml(d.notes)}</div>` : ""}
  <div class="foot">— Thank you for your business —</div>
</body></html>`;
}

/* =====================================================================
   MODERN — emerald editorial header band, oversized type, generous whitespace
   ===================================================================== */
function modernTemplate(d: DocInput): string {
  const ship = num(d.shipping);
  const tax = num(d.tax);
  const items = d.items.map((it) => {
    const meta = itemMeta(it);
    return `<tr>
      <td class="desc">
        <div class="iname">${escapeHtml(it.description)}</div>
        ${meta.length ? `<div class="imeta">${meta.join(" &nbsp;·&nbsp; ")}</div>` : ""}
      </td>
      <td class="qty">${qtyStr(it)}</td>
      <td class="rate">${rateStr(it)}</td>
      <td class="amt">${amtStr(it)}</td>
    </tr>`;
  }).join("");

  const logo = d.business.logo_url
    ? `<img src="${escapeHtml(d.business.logo_url)}" alt="logo" style="max-height:56px;max-width:200px;object-fit:contain;display:block;margin-bottom:14px;" />`
    : "";

  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(d.title)} ${escapeHtml(d.number)}</title>
<style>
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: -apple-system, 'Segoe UI', Inter, Arial, sans-serif; color: #1a1a1a; background: #ffffff; margin: 0; padding: 0; font-size: 12.5px; line-height: 1.55; }
  .hero { background: #bcdcee; color: #1a2330; padding: 56px 64px 48px; }
  .hero .row { display: flex; justify-content: space-between; align-items: flex-end; gap: 48px; }
  .hero .biz .name { font-size: 26px; font-weight: 800; letter-spacing: -0.5px; line-height: 1.1; }
  .hero .biz .sub { font-size: 12px; opacity: 0.8; margin-top: 8px; line-height: 1.7; max-width: 340px; }
  .hero .doc { text-align: right; }
  .hero .doc .title { font-size: 56px; font-weight: 800; letter-spacing: -2px; line-height: 1; text-transform: lowercase; }
  .hero .doc .num { font-size: 13px; opacity: 0.8; margin-top: 10px; letter-spacing: 1px; }
  .hero .doc .status { display: inline-block; margin-left: 8px; padding: 2px 10px; border: 1px solid rgba(26,35,48,0.35); border-radius: 999px; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; }
  .meta { padding: 36px 64px 12px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 40px; }
  .meta .lbl { font-size: 10px; text-transform: uppercase; letter-spacing: 2px; color: #6b7280; margin-bottom: 8px; }
  .meta .name { font-weight: 700; font-size: 15px; color: #1a1a1a; margin-bottom: 4px; }
  .meta .v { font-size: 12px; color: #4a4a4a; line-height: 1.7; }
  .items-wrap { padding: 24px 64px 0; }
  table.items { width: 100%; border-collapse: collapse; }
  table.items thead th { text-align: left; padding: 16px 0; font-size: 10px; text-transform: uppercase; letter-spacing: 2px; color: #6b7280; font-weight: 600; border-bottom: 2px solid #2b8acb; }
  table.items thead th.qty, table.items thead th.rate, table.items thead th.amt { text-align: right; }
  table.items tbody td { padding: 20px 0; border-bottom: 1px solid #e5e7eb; vertical-align: top; font-variant-numeric: tabular-nums; }
  table.items tbody td.qty, table.items tbody td.rate, table.items tbody td.amt { text-align: right; }
  .iname { font-size: 14px; font-weight: 600; color: #1a1a1a; }
  .imeta { color: #6b7280; font-size: 11px; margin-top: 4px; }
  .totals-wrap { display: flex; justify-content: flex-end; padding: 28px 64px 56px; }
  .totals { width: 340px; }
  .totals .row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 13px; color: #4a4a4a; }
  .totals .grand { margin-top: 12px; background: #2b8acb; color: #fff; padding: 18px 22px; border-radius: 999px; display: flex; justify-content: space-between; align-items: center; }
  .totals .grand .lbl { font-size: 11px; text-transform: uppercase; letter-spacing: 2px; opacity: 0.85; }
  .totals .grand .val { font-size: 20px; font-weight: 800; letter-spacing: -0.5px; }
  .notes { padding: 0 64px 56px; }
  .notes .lbl { font-size: 10px; text-transform: uppercase; letter-spacing: 2px; color: #6b7280; margin-bottom: 8px; }
  .notes .body { font-size: 12.5px; color: #4a4a4a; line-height: 1.7; max-width: 560px; }
  @media print { @page { margin: 0; size: A4; } }
</style></head>
<body>
  <div class="hero">
    <div class="row">
      <div class="biz">
        ${logo}
        <div class="name">${escapeHtml(d.business.name || "Your Business")}</div>
        <div class="sub">
          ${escapeHtml(d.business.address || "").replace(/\n/g, "<br/>")}
          ${d.business.phone ? `<br/>${escapeHtml(d.business.phone)}` : ""}
        </div>
      </div>
      <div class="doc">
        <div class="title">${escapeHtml(d.title)}</div>
        <div class="num">№ ${escapeHtml(d.number)}${d.status ? `<span class="status">${escapeHtml(d.status)}</span>` : ""}</div>
      </div>
    </div>
  </div>

  <div class="meta">
    <div>
      <div class="lbl">${escapeHtml(d.counterparty.label)}</div>
      <div class="name">${escapeHtml(d.counterparty.name || "")}</div>
      <div class="v">${escapeHtml(d.counterparty.address || "").replace(/\n/g, "<br/>")}</div>
      <div class="v">${escapeHtml(d.counterparty.phone || "")}</div>
    </div>
    <div>
      <div class="lbl">${escapeHtml(d.title)} Date</div>
      <div class="v">${escapeHtml(fmtDate(d.date))}</div>
    </div>
    <div>
      ${d.due_date ? `<div class="lbl">Due Date</div><div class="v">${escapeHtml(fmtDate(d.due_date))}</div>` : `<div class="lbl">Currency</div><div class="v">${escapeHtml(d.currency)}</div>`}
    </div>
  </div>

  <div class="items-wrap">
    <table class="items">
      <thead><tr><th>Description</th><th class="qty">Qty</th><th class="rate">Rate</th><th class="amt">Amount</th></tr></thead>
      <tbody>${items}</tbody>
    </table>
  </div>

  <div class="totals-wrap">
    <div class="totals">
      <div class="row"><span>Subtotal</span><span>${money(d.subtotal, d.currency)}</span></div>
      ${tax !== 0 ? `<div class="row"><span>Tax</span><span>${money(tax, d.currency)}</span></div>` : ""}
      ${ship !== 0 ? `<div class="row"><span>Shipping</span><span>${money(ship, d.currency)}</span></div>` : ""}
      <div class="grand"><span class="lbl">Total</span><span class="val">${money(d.total, d.currency)}</span></div>
    </div>
  </div>

  ${d.notes ? `<div class="notes"><div class="lbl">Notes</div><div class="body">${escapeHtml(d.notes).replace(/\n/g, "<br/>")}</div></div>` : ""}
</body></html>`;
}


/* =====================================================================
   COMPACT — dense receipt, zebra rows, tight typography
   ===================================================================== */
function compactTemplate(d: DocInput): string {
  const ship = num(d.shipping);
  const tax = num(d.tax);
  const items = d.items.map((it, idx) => {
    const meta = itemMeta(it);
    return `<tr>
      <td class="num">${idx + 1}</td>
      <td><span class="iname">${escapeHtml(it.description)}</span>${meta.length ? ` <span class="imeta">(${meta.join(" · ")})</span>` : ""}</td>
      <td class="qty">${qtyStr(it)}</td>
      <td class="rate">${rateStr(it)}</td>
      <td class="amt">${amtStr(it)}</td>
    </tr>`;
  }).join("");
  const logo = d.business.logo_url
    ? `<img src="${escapeHtml(d.business.logo_url)}" alt="logo" style="max-height:36px;max-width:120px;object-fit:contain;vertical-align:middle;margin-right:8px;" />`
    : "";

  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(d.title)} ${escapeHtml(d.number)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: ui-sans-serif, system-ui, 'Segoe UI', Arial, sans-serif; color: #111; padding: 20px 24px; font-size: 10.5px; line-height: 1.35; }
  .mono, .qty, .rate, .amt, .num, .totals .val { font-family: ui-monospace, 'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace; font-variant-numeric: tabular-nums; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 8px; border-bottom: 2px solid #111; margin-bottom: 10px; gap: 16px; }
  .top .left { display: flex; align-items: center; }
  .biz .name { font-size: 26px; font-weight: 700; line-height: 1; }
  .biz .sub { font-size: 9.5px; color: #475569; margin-top: 2px; }
  .top .right { text-align: right; font-size: 10px; }
  .top .right .title { font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
  .top .right .num { font-size: 11px; color: #475569; }
  .top .right .meta { font-size: 9.5px; color: #475569; margin-top: 2px; }
  .inline-bill { background: #f6f6f6; padding: 6px 10px; margin-bottom: 8px; font-size: 10px; border-left: 3px solid #475569; }
  .inline-bill .lbl { color: #475569; text-transform: uppercase; font-size: 9px; letter-spacing: 1px; margin-right: 6px; }
  .inline-bill .name { font-weight: 700; }
  table.items { width: 100%; border-collapse: collapse; margin-top: 4px; }
  table.items thead th { background: #111; color: #fff; text-align: left; padding: 4px 8px; font-size: 9px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; }
  table.items thead th.qty, table.items thead th.rate, table.items thead th.amt { text-align: right; }
  table.items thead th.num { width: 24px; text-align: center; }
  table.items tbody td { padding: 4px 8px; vertical-align: top; }
  table.items tbody tr:nth-child(even) td { background: #f6f6f6; }
  table.items tbody td.num { text-align: center; color: #475569; }
  table.items tbody td.qty, table.items tbody td.rate, table.items tbody td.amt { text-align: right; }
  .iname { font-weight: 600; }
  .imeta { color: #475569; font-size: 9.5px; }
  .totals-wrap { display: flex; justify-content: flex-end; margin-top: 8px; }
  .totals { display: grid; grid-template-columns: auto auto; column-gap: 24px; row-gap: 2px; font-size: 10.5px; }
  .totals .lbl { color: #475569; text-align: right; }
  .totals .val { text-align: right; }
  .totals .grand-lbl { font-weight: 700; color: #111; border-top: 1px solid #111; padding-top: 4px; margin-top: 2px; text-align: right; }
  .totals .grand-val { font-weight: 700; color: #111; border-top: 1px solid #111; padding-top: 4px; margin-top: 2px; font-size: 12px; text-align: right; }
  .notes { margin-top: 10px; padding: 6px 8px; background: #f6f6f6; font-size: 9.5px; border-left: 3px solid #475569; }
  .notes .lbl { color: #475569; text-transform: uppercase; letter-spacing: 1px; font-size: 9px; margin-right: 6px; }
  @media print { @page { margin: 8mm; } body { padding: 0; } }
</style></head>
<body>
  <div class="top">
    <div class="left">
      ${logo}
      <div class="biz">
        <div class="name">${escapeHtml(d.business.name || "Your Business")}</div>
        <div class="sub">${escapeHtml((d.business.address || "").replace(/\n/g, ", "))}${d.business.phone ? ` · ${escapeHtml(d.business.phone)}` : ""}</div>
      </div>
    </div>
    <div class="right">
      <div class="title">${escapeHtml(d.title)}${d.status ? ` · ${escapeHtml(d.status)}` : ""}</div>
      <div class="num">${escapeHtml(d.number)}</div>
      <div class="meta">${escapeHtml(fmtDate(d.date))}${d.due_date ? ` · due ${escapeHtml(fmtDate(d.due_date))}` : ""}</div>
    </div>
  </div>
  <div class="inline-bill">
    <span class="lbl">${escapeHtml(d.counterparty.label)}</span>
    <span class="name">${escapeHtml(d.counterparty.name || "")}</span>
    ${d.counterparty.address ? ` · ${escapeHtml((d.counterparty.address || "").replace(/\n/g, ", "))}` : ""}
    ${d.counterparty.phone ? ` · ${escapeHtml(d.counterparty.phone)}` : ""}
  </div>
  <table class="items">
    <thead><tr><th class="num">#</th><th>Description</th><th class="qty">Qty</th><th class="rate">Rate</th><th class="amt">Amount</th></tr></thead>
    <tbody>${items}</tbody>
  </table>
  <div class="totals-wrap">
    <div class="totals">
      <div class="lbl">Subtotal</div><div class="val">${money(d.subtotal, d.currency)}</div>
      ${tax !== 0 ? `<div class="lbl">Tax</div><div class="val">${money(tax, d.currency)}</div>` : ""}
      ${ship !== 0 ? `<div class="lbl">Shipping</div><div class="val">${money(ship, d.currency)}</div>` : ""}
      <div class="grand-lbl">TOTAL</div><div class="grand-val">${money(d.total, d.currency)}</div>
    </div>
  </div>
  ${d.notes ? `<div class="notes"><span class="lbl">Notes</span>${escapeHtml(d.notes)}</div>` : ""}
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
      "function run(){try{" +
        "if(bar)bar.style.display='none';" +
        "var opt={margin:10,filename:" + fnameJson + "," +
          "image:{type:'jpeg',quality:0.95}," +
          "html2canvas:{scale:2,useCORS:true,backgroundColor:'#ffffff'}," +
          "jsPDF:{unit:'mm',format:'a4',orientation:'portrait'}," +
          "pagebreak:{mode:['css','legacy']}};" +
        "window.html2pdf().set(opt).from(document.body).save().then(function(){if(bar)bar.style.display='';}).catch(function(e){if(bar)bar.style.display='';alert('PDF failed: '+e.message);window.print();});" +
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

export function renderDocument(d: DocInput) {
  const safeName = `${d.title}-${d.number}`.replace(/[^a-z0-9\-_. ]+/gi, "_").trim() || "document";
  const filename = `${safeName}.html`;
  let html = buildDocumentHtml(d);
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
