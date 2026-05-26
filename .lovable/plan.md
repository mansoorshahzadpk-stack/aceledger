
## Scope

Eight related changes across data model, document templates, and UI.

---

### 1. Freight / Shipping line (like tax)

- Add `shipping` numeric column to `invoices` (default 0). Total = subtotal + tax + shipping.
- New Invoice form: add a "Shipping / Freight" input next to Tax (supports negative values for freight deductions, matching the sample PDF).
- Invoice detail + PDF templates render the Shipping row in the totals block.
- Backward compatible: existing rows default to 0.

### 2. Rename "Products" → "Materials"

- Sidebar / bottom-nav label and icon stay; only the visible name and route path change to `/materials` (file: `_authenticated.materials.index.tsx`).
- Page title, dialog copy, empty states say "Material" / "Materials".
- Invoice picker label becomes "Select from materials". DB table `products` is left as-is internally (no risky data rename); only the UI is rebranded.

### 3. Redesign Invoice & GRN to match the uploaded sample

Rebuild `src/lib/document-templates.ts` with a new template `acelog` (set as default) that mirrors the sample:

- Top-right large "INVOICE" / "GRN" title, number under it
- Right-side "Balance Due" card with big amount (invoices only)
- Left-side company logo + business block
- "Bill To" block with client name + address
- Items table with columns: `#`, `Item & Description` (multi-line: material name, GRN ref, Vehicle ref), `Qty` (with unit), `Rate`, `Amount`
- Totals block: Sub Total, Tax, Shipping, Total
- Notes section at bottom
- Keep `classic` / `modern` / `compact` available; new one is default and matches the screenshot.

Add optional per-line fields `grn_ref` and `vehicle_ref` on `invoice_items` so a line can display "GRN: 03345 / Veh: XA 319" like the sample. Editable in the line-item card.

### 4. Fix GRN material dropdown

`_authenticated.vendors.grn.new.tsx` currently uses a plain `<Input>` for Material. Replace with the same Popover+Command picker used in invoices, sourced from the active Materials catalog. Also allow free-text entry for ad-hoc materials. Store `product_id` (nullable) on `vendor_grns` so we can link inventory.

### 5. Edit / Delete / Amend GRN and Invoices (with reasons)

- **Before posting (draft):** full edit + delete, no reason required.
- **After posting:** edit and delete both open a "Reason for change" dialog; reason is required.
- Reuse existing `invoice_amendments`; add a sibling `grn_amendments` table (`grn_id`, `reason`, `previous_total`, `new_total`, `action` enum: `edit` | `delete`).
- Add `Edit` and `Delete` actions on `/invoices/$id` and on the vendor GRN row in `/vendors/$id`. Deletes cascade payment/line cleanup as today.

### 6. Profit / Loss overview page

New route `/_authenticated.reports.pl.tsx` (sidebar entry "P&L").

- Filters: From date, To date, Group by: Day / Week / Month / Quarter / Year. Quick presets: This month, This quarter, This year.
- Revenue = sum of posted invoice totals in range (minus shipping if negative, per as-billed).
- Cost = sum of GRN `total_amount` in range.
- Gross profit = Revenue − Cost; margin %.
- Top KPI cards + a grouped table (period | revenue | cost | profit | margin) and a simple bar chart (Recharts).

### 7. 4-digit sequential numbering

- Add per-user sequences `invoice_seq` and `grn_seq` (a `doc_counters` table: `user_id`, `kind`, `last_value`).
- Postgres function `next_doc_number(kind text)` increments atomically and returns `INV-0001` / `GRN-0001` (zero-padded to 4, grows past 4 if exceeded).
- New Invoice + New GRN forms call the function on mount to suggest the next number; user can still override. Posting fills in the number if blank.
- Existing records keep their current numbers; new ones start at the next available 4-digit value.

### 8. Inventory page

New route `/_authenticated.inventory.tsx`.

- For each Material: `Received (GRN qty)`, `Delivered (invoiced qty)`, `On-hand`, `Avg cost`, `Inventory value`.
- Requires linking invoice lines to materials: add `product_id` (nullable) to `invoice_items`; the invoice line picker already pulls from materials — store the chosen `product_id`.
- GRN already gets `product_id` from change #4.
- On-hand = sum(GRN.qty for material) − sum(invoice_items.qty for material, posted only).
- Avg cost = weighted average from GRN lines for that material.
- Table sortable by on-hand; row click → drill-down listing source GRNs and consuming invoices.

---

## Technical notes

**Migrations (single batch):**
- `ALTER TABLE invoices ADD COLUMN shipping numeric NOT NULL DEFAULT 0;`
- `ALTER TABLE invoice_items ADD COLUMN product_id uuid, ADD COLUMN grn_ref text, ADD COLUMN vehicle_ref text;`
- `ALTER TABLE vendor_grns ADD COLUMN product_id uuid;`
- New `grn_amendments` table + RLS + GRANTs (mirrors `invoice_amendments`, adds `action` enum).
- New `doc_counters(user_id, kind, last_value)` + `next_doc_number(kind)` SECURITY DEFINER function + RLS + GRANTs.

**Files touched:**
- New: `_authenticated.materials.index.tsx` (rename of products), `_authenticated.reports.pl.tsx`, `_authenticated.inventory.tsx`
- Edited: `document-templates.ts`, `_authenticated.invoices.new.tsx`, `_authenticated.invoices.$id.tsx`, `_authenticated.vendors.grn.new.tsx`, `_authenticated.vendors.$id.tsx`, `AppShell.tsx`, `app-context.tsx`
- Deleted: `_authenticated.products.index.tsx`

**Out of scope:** currency/theme system, auth, existing balance math beyond adding `shipping` to total.
