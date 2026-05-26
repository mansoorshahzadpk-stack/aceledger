# Plan: Delete actions, company logo, fix nav bugs, products catalog

## 1. Fix broken buttons (Log GRN, New Invoice, Open, etc.)

**Root cause:** `_authenticated.vendors.tsx` / `_authenticated.clients.tsx` / `_authenticated.invoices.tsx` each have child routes (`$id`, `new`, `grn.new`), which makes TanStack Router treat them as **layout routes**. Layout routes must render `<Outlet />` for children to appear. Since they render list UI instead, navigating to `/vendors/grn/new` re-renders the vendors list and nothing changes — looks like the button is dead.

**Fix:** Rename each list file to its `.index.tsx` counterpart so it becomes a pure leaf route:

- `_authenticated.vendors.tsx` → `_authenticated.vendors.index.tsx`
- `_authenticated.clients.tsx` → `_authenticated.clients.index.tsx`
- `_authenticated.invoices.tsx` → `_authenticated.invoices.index.tsx`

Update each `createFileRoute("/_authenticated/vendors")` → `("/_authenticated/vendors/")`. The router tree regenerates automatically.

## 2. Delete selected vendors and clients

On the Vendors list and Clients list:
- Add a leading checkbox column + a "Select all" checkbox in the header.
- When ≥1 row is selected, show a destructive "Delete selected (N)" button above the table.
- Confirmation via `AlertDialog`: "This will permanently delete N vendor(s) and all related GRNs and payments. Continue?"
- Delete order (no FK cascades in current schema): `vendor_payments` → `vendor_grns` → `vendors` (clients: `client_payments` → `invoice_items` for each invoice → `invoices` → `invoice_amendments` → `clients`). All scoped by `user_id` via RLS.
- Invalidate React Query caches on success; toast confirms count deleted.

## 3. Company logo on Invoices & GRN

**Storage:** Create a public storage bucket `business-assets` (migration) with policies allowing each user to upload/update/delete only files under their own `{user_id}/...` prefix; public read.

**Settings page:** Add a "Company logo" card with file picker (PNG/JPG ≤ 2 MB). Uploads to `business-assets/{user_id}/logo.{ext}`. Persist public URL in `app_settings.business_logo_url` (new column, nullable text). Show current logo with a Remove button.

**Document templates:** Update `src/lib/document-templates.ts` so `DocInput.business` accepts `logo_url`. Render the logo (max-height 64px, left side of the header) in all three templates — classic, modern, compact — alongside business name/address.

**Pass-through:** Every place that calls `renderDocument(...)` (vendor GRN detail, invoice detail) already loads `app_settings`; include `business_logo_url` in the `business` object.

## 4. Products catalog

**New table** `products` (migration):
- `id`, `user_id`, `name` (text, required), `sku` (text, nullable), `description` (text, nullable), `unit` (text, default `"pcs"`), `default_price` (numeric, default 0), `default_tax_rate` (numeric, default 0), `active` (bool, default true), `created_at`, `updated_at`.
- RLS: `auth.uid() = user_id` for all ops. Trigger for `updated_at`.

**New route** `/_authenticated/products/index.tsx`:
- Table of products with name, SKU, unit, default price (in active currency), active toggle.
- "New product" dialog (same shape as vendor dialog) — add/edit/delete with confirmation.
- Bulk-select + delete (same pattern as #2).

**Sidebar/bottom-nav entry:** Add "Products" with `Package` icon in `src/components/AppShell.tsx`.

**Invoice line-item integration** (`_authenticated.invoices.new.tsx` and `_authenticated.invoices.$id.tsx` edit mode):
- Each line item gets a "Select product…" combobox (shadcn `Command` inside `Popover`) listing active products by name + SKU.
- Choosing a product fills `description`, `unit_price`, and `unit` (line item description prepends unit). User can still edit fields freely afterward.
- Optional free-text description stays supported (no product selected).
- Demo seed adds ~6 sample products and uses them on some seeded invoices.

## Technical notes

- All migrations through `supabase--migration` (one for `business_logo_url` + storage bucket, one for `products`).
- Logo upload via `supabase.storage.from('business-assets').upload(...)` with `upsert: true`.
- Products combobox: lazy-load with `useQuery(['products-active'])`, debounce filter client-side (small list).
- File renames in step 1 are pure moves — no logic changes; routeTree regenerates on next dev/build.
- No changes to balance math, posted-invoice amendment flow, or currency/theme system.

## Out of scope

- Per-product inventory tracking (stock on hand).
- Logo cropping/resizing UI (browser uploads as-is; CSS caps render size).
- Bulk delete on invoices/GRNs (separate request if needed).