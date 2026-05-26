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
   MODERN — light-blue callout, serif "Invoice" wordmark, blue footer band
   ===================================================================== */
function modernTemplate(d: DocInput): string {
  const tax = num(d.tax);
  const items = d.items.map((it) => {
    const meta = itemMeta(it);
    return `<tr>
      <td class="desc"><div class="iname">${escapeHtml(it.description)}</div>${meta.length ? `<div class="imeta">${meta.join(" · ")}</div>` : ""}</td>
      <td class="unit">${CURRENCY_SYMBOLS[d.currency]}${rateStr(it)}</td>
      <td class="qty">${qtyStr(it)}</td>
      <td class="price">${CURRENCY_SYMBOLS[d.currency]}${amtStr(it)}</td>
    </tr>`;
  }).join("");

  const logo = d.business.logo_url
    ? `<img src="${escapeHtml(d.business.logo_url)}" alt="logo" style="max-height:42px;max-width:160px;object-fit:contain;" />`
    : `<div class="brandmark">◆</div>`;

  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(d.title)} ${escapeHtml(d.number)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800;900&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: Inter, -apple-system, 'Segoe UI', Arial, sans-serif; color: #1f2937; background: linear-gradient(180deg,#eef0f1 0%, #e7eaec 100%); margin: 0; padding: 0; font-size: 12px; line-height: 1.5; }
  .page { min-height: 100vh; display: flex; flex-direction: column; }
  .top { padding: 40px 56px 20px; display: flex; justify-content: space-between; align-items: flex-start; gap: 32px; }
  .brand { display: flex; align-items: center; gap: 10px; }
  .brand .brandmark { width: 36px; height: 36px; background: #cfe5f2; color: #2b8acb; display: inline-flex; align-items: center; justify-content: center; border-radius: 6px; font-size: 22px; }
  .biz .name { font-size: 26px; font-weight: 700; color: #2b8acb; letter-spacing: -0.5px; line-height: 1; }
  .contact { text-align: right; color: #5b6470; font-size: 11.5px; line-height: 1.7; }
  .hero { padding: 18px 56px 0; display: flex; justify-content: space-between; align-items: flex-start; gap: 32px; }
  .hero h1 { font-family: 'Playfair Display', Georgia, serif; font-size: 64px; font-weight: 900; color: #1a2330; margin: 0 0 18px; letter-spacing: -1px; line-height: 1; }
  .billto .lbl { font-size: 12px; color: #5b6470; margin-bottom: 4px; }
  .billto .name { font-weight: 700; font-size: 14px; color: #1a2330; letter-spacing: .5px; text-transform: uppercase; margin-bottom: 6px; }
  .billto .sub { font-size: 11.5px; color: #5b6470; line-height: 1.7; }
  .callout { position: relative; background: #bcdcee; padding: 22px 28px 22px 36px; min-width: 240px; border-radius: 2px; }
  .callout::before { content: ""; position: absolute; left: -12px; top: 28px; width: 0; height: 0; border-style: solid; border-width: 10px 12px 10px 0; border-color: transparent #bcdcee transparent transparent; }
  .callout .item { position: relative; padding-left: 22px; margin-bottom: 14px; }
  .callout .item:last-child { margin-bottom: 0; }
  .callout .item::before { content: ""; position: absolute; left: 0; top: 8px; width: 12px; height: 2px; background: #2b8acb; transform: rotate(-35deg); border-radius: 2px; }
  .callout .lbl { font-size: 12px; color: #2c3e50; }
  .callout .val { font-weight: 700; font-size: 14px; color: #1a2330; margin-top: 2px; }
  .items-wrap { padding: 60px 56px 28px; flex: 1; }
  table.items { width: 100%; border-collapse: collapse; }
  table.items thead th { text-align: left; padding: 12px 0 14px; font-size: 12px; font-weight: 700; color: #1a2330; border-bottom: 1.5px solid #1a2330; }
  table.items thead th.unit, table.items thead th.qty { text-align: center; }
  table.items thead th.price { text-align: right; }
  table.items tbody td { padding: 22px 0 22px; border-bottom: 1px solid #d9dde1; vertical-align: top; font-variant-numeric: tabular-nums; }
  table.items tbody td.unit, table.items tbody td.qty { text-align: center; color: #1a2330; }
  table.items tbody td.price { text-align: right; font-weight: 700; color: #1a2330; }
  .iname { font-size: 14px; font-weight: 600; color: #1a2330; margin-bottom: 2px; }
  .imeta { color: #7a8390; font-size: 11px; }
  .footband { background: #bcdcee; padding: 26px 56px 36px; margin-top: 24px; }
  .footband .rule { border-top: 1.5px solid #1a2330; padding-top: 14px; }
  .foot-row { display: grid; grid-template-columns: 1.4fr 1fr 1fr 1.2fr; gap: 24px; align-items: end; }
  .foot-row .h { font-size: 12px; font-weight: 700; color: #1a2330; margin-bottom: 10px; }
  .foot-row .v { font-size: 13px; color: #1a2330; }
  .foot-row .v strong { font-weight: 700; }
  .foot-row .due-amount { font-family: 'Playfair Display', Georgia, serif; font-size: 34px; font-weight: 800; color: #1f6fa8; text-align: right; letter-spacing: -0.5px; line-height: 1; }
  .foot-row .due-h { text-align: right; }
  @media print { @page { margin: 0; size: A4; } body { background: #eef0f1; } }
</style></head>
<body>
  <div class="page">
    <div class="top">
      <div class="brand">
        ${logo}
        <div class="biz"><div class="name">${escapeHtml(d.business.name || "Your Business")}</div></div>
      </div>
      <div class="contact">
        ${d.business.address ? `${escapeHtml(d.business.address).replace(/\n/g, "<br/>")}<br/>` : ""}
        ${d.business.phone ? `Phone: ${escapeHtml(d.business.phone)}` : ""}
      </div>
    </div>

    <div class="hero">
      <div>
        <h1>${escapeHtml(d.title)}</h1>
        <div class="billto">
          <div class="lbl">${escapeHtml(d.counterparty.label)}:</div>
          <div class="name">${escapeHtml(d.counterparty.name || "")}</div>
          <div class="sub">
            ${d.counterparty.address ? `${escapeHtml(d.counterparty.address).replace(/\n/g, "<br/>")}<br/>` : ""}
            ${d.counterparty.phone ? `Mobile: ${escapeHtml(d.counterparty.phone)}` : ""}
          </div>
        </div>
      </div>
      <div class="callout">
        <div class="item">
          <div class="lbl">Date:</div>
          <div class="val">${escapeHtml(fmtDate(d.date))}</div>
        </div>
        <div class="item">
          <div class="lbl">Invoice No:</div>
          <div class="val">${escapeHtml(d.number)}</div>
        </div>
      </div>
    </div>

    <div class="items-wrap">
      <table class="items">
        <thead><tr>
          <th class="desc">Item Description</th>
          <th class="unit">Unit Price</th>
          <th class="qty">Quantity</th>
          <th class="price">Price</th>
        </tr></thead>
        <tbody>${items}</tbody>
      </table>
    </div>

    <div class="footband">
      <div class="rule">
        <div class="foot-row">
          <div>
            <div class="h">Basic Information</div>
            <div class="v">${d.notes ? escapeHtml(d.notes).replace(/\n/g, "<br/>") : (d.business.phone ? escapeHtml(d.business.phone) : "—")}</div>
          </div>
          <div>
            <div class="h">Due Date</div>
            <div class="v"><strong>${d.due_date ? escapeHtml(fmtDate(d.due_date)) : "—"}</strong></div>
          </div>
          <div>
            <div class="h">Tax (VAT)</div>
            <div class="v">${money(tax, d.currency)}</div>
          </div>
          <div>
            <div class="h due-h">Due Amount</div>
            <div class="due-amount">${CURRENCY_SYMBOLS[d.currency]}${num(d.total).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
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

export function renderDocument(d: DocInput) {
  const html = buildDocumentHtml(d);
  const w = window.open("", "_blank", "width=900,height=1100");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
  setTimeout(() => { w.focus(); w.print(); }, 400);
}
