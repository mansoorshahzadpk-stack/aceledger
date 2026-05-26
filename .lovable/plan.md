## Replace "Modern Minimalist" template

Rewrite `modernTemplate(d)` in `src/lib/document-templates.ts` to match the attached reference. Ace Design, Classic, and Compact stay untouched.

### Visual spec (from the reference image)

- Background: soft warm light-grey (`#eef0f1`) with subtle gradient.
- Header row: logo + business name on the left (existing 26px name), business address/phone/email right-aligned in the top-right as small grey text.
- Big serif "Invoice" wordmark (~64px, bold serif like Playfair Display / Georgia) on the left below the header.
- Under the wordmark: "Invoice to:" label + bold counterparty name in uppercase + address/phone/email lines.
- Right side: light-blue (`#bcdcee`) callout card with a small left-pointing tail, containing:
  - "Date:" + formatted issue date (bold)
  - "Invoice No:" + invoice number (bold)
  - Small blue tick/slash glyphs as bullets (use a CSS `::before` with a rotated rule, no external assets).
- Items table: borderless, with a single dark hairline under the header row and a thin light divider between rows. Columns: **Item Description** (left, bold title + small grey subtext if `grn_ref`/`vehicle_ref` present), **Unit Price** (centred), **Quantity** (centred), **Price** (right, bold). Currency rendered through existing `money()` helper (negative-sign-with-amount preserved).
- Bottom band: full-bleed light-blue (`#bcdcee`) strip starting after the items.
  - Inside the band, a row with: **Basic Information** (account/transaction lines from business settings if available, else notes), **Due Date** (bold, formatted), **VAT/Tax** (label uses "Tax" — value = tax amount), **Due Amount** (large bold total in deep blue `#1f6fa8`).
  - Thin dark hairline above this row, matching the reference.
- Typography: Playfair Display (or Georgia fallback) for "Invoice" wordmark and totals; Inter/system sans for everything else. Keep `.biz .name { font-size: 26px }`.
- Print-safe: use `@page` margins already used by other templates; ensure background colour bands print via `-webkit-print-color-adjust: exact`.

### Data mapping

- Header business block ← `d.business` (name, address, phone, email if present).
- "Invoice to" block ← `d.counterparty` (name uppercased via CSS, then address / phone / email).
- Date card ← `d.date` via `fmtDate`, `d.number`.
- Items table ← `d.items` (description + optional `grn_ref`/`vehicle_ref` as muted subtext under description, `unit_price`, `quantity`, `line_total`). Use `money()` for currency.
- Bottom band:
  - Basic Information: show `d.business.account_no` / `d.business.transaction_no` if present, otherwise fall back to `d.notes` (truncated).
  - Due Date: `fmtDate(d.due_date)` or "—".
  - Tax: `money(d.tax)` (label kept as "Tax (VAT)" so it stays accurate regardless of jurisdiction).
  - Due Amount: `money(d.total)` rendered large in accent blue.

### Out of scope

- No changes to Ace Design, Classic, or Compact templates.
- No changes to `money()`, `fmtDate`, settings UI labels, themes, or DB.
- No new asset files — the blue callout tail and tick glyphs are pure CSS.

### Files touched

- `src/lib/document-templates.ts` — rewrite `modernTemplate(d)` only.
