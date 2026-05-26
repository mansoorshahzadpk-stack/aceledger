# Implementation Plan

## 1. Rename "Weekly Installment" → "Payment Received"
- Update labels, buttons, dialog titles, toasts, and table headers in:
  - `src/routes/_authenticated.clients.index.tsx`
  - `src/routes/_authenticated.clients.$id.tsx`
- Keep underlying `client_payments` table name (internal only).

## 2. Amend invoice from Client page
- On client detail page, link each invoice row to the existing invoice detail page (amend/delete-after-post with reason already works there).
- Add inline "Amend" / "Delete" buttons on the invoice row for parity with the Invoices list.

## 3. Amend / Delete Payment Received (with reason)
- New table `payment_amendments` (user_id, payment_id, client_id, action [edit|delete], previous_amount, new_amount, reason) with RLS.
- Add Edit and Delete buttons on each payment row.
- Both open a dialog requiring a **Reason**; on submit, write an amendment row and update/delete the payment.

## 4. Audit / Amendments overview page
- New route `src/routes/_authenticated.amendments.tsx` showing a unified, filterable list across:
  - Posted GRNs (`grn_amendments`)
  - Invoices (`invoice_amendments`)
  - Payments Received (new `payment_amendments`)
- Columns: Date, Type, Document #, Action, Previous → New, Reason, link to source doc.
- Nav entry "Audit log" in `AppShell.tsx`.

## 5. Analytics page (graphs & charts) — date-range driven
- New route `src/routes/_authenticated.reports.analytics.tsx` using Recharts.
- **Top of page: two date pickers (From / To)** that drive every chart. Sensible default (e.g. last 90 days); quick-pick chips for "This month", "Last 30 days", "This year".
- All queries filter by the selected range. Charts:
  - Supplies received (GRN qty + value) over time
  - Invoiced revenue vs Payments received over time
  - Top vendors (payables) & top clients (receivables) within range
  - Inventory on hand by material (current snapshot)
  - Profit margin trend over the range
- Granularity (day / week / month) auto-picked from range length.
- Nav entry under Reports.

## 6. "Coloured" theme
- Extend theme options in settings and `app-context.tsx` to include `coloured` alongside `light` / `dark`.
- In `src/styles.css`, add `[data-theme="coloured"]` token set: tasteful multi-hue palette (deep indigo primary, teal accent, warm coral highlight, gradient surfaces). Uses oklch tokens + `--gradient-*` vars — no per-component color changes.
- Migration: add `coloured` value to `ui_theme` enum.

## 7. Date format dd/mm/yyyy on invoice
- Add `formatDateDMY` to `src/lib/format.ts`; use it in invoice screens and PDF/print template (`document-templates.ts`).

## 8. Invoice / GRN printout fixes (`src/lib/document-templates.ts`)
- Add explicit gap between currency code and amount (`Rs&nbsp;&nbsp;1,234.00`).
- Negative amounts rendered in red.
- Logo size 1.5× (≈ 64px → 96px height).

## Technical notes
- Migration creates `payment_amendments` (+ RLS + grants) and extends `ui_theme` enum.
- All CRUD via Supabase client; RLS pattern `auth.uid() = user_id`.
- Reuse existing Dialog/AlertDialog primitives.
- Date pickers use shadcn Calendar inside Popover.
- Routes added via file-based router; `routeTree.gen.ts` regenerates automatically.

## Out of scope
- No vendor-flow changes beyond surfacing existing GRN amendments in the audit page.
- No redesign of existing pages beyond the rename and new action buttons.
