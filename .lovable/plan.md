
# B2B Ledger & Accounts Management App — Build Plan

A responsive desktop + mobile web app for a raw material supply business: vendor inflow, client outflow with draft/posted invoice workflow, weekly installment tracking, multi-currency, theming, and customizable document templates.

## Tech & Backend
- TanStack Start + React + Tailwind + shadcn/ui (already scaffolded)
- Enable **Lovable Cloud** for database, auth, and storage (vendor/client/invoice data, audit logs, PDFs)
- Auth: email/password; all data scoped per user via RLS
- PDF generation client-side via `jspdf` + `jspdf-autotable`
- State for global UI (currency, theme, doc template) in a settings table + React context

## Database Schema (Lovable Cloud)

```text
profiles(id, user_id, display_name)
user_roles(id, user_id, role)                    -- admin/user
app_settings(user_id PK, currency, theme, default_doc_template)

vendors(id, user_id, name, contact, phone, email, address, opening_balance, created_at)
vendor_grns(id, user_id, vendor_id, grn_number, material, quantity, unit, unit_price,
            total_amount, grn_date, doc_template, notes)
vendor_payments(id, user_id, vendor_id, amount, payment_date, method, reference, notes)

clients(id, user_id, name, contact, phone, email, address, opening_balance, created_at)
invoices(id, user_id, client_id, invoice_number, status [draft|posted],
         issue_date, due_date, subtotal, tax, total, doc_template, notes,
         posted_at, current_version)
invoice_items(id, invoice_id, description, quantity, unit_price, line_total)
invoice_amendments(id, invoice_id, user_id, reason, previous_total, new_total, created_at)
client_payments(id, user_id, client_id, invoice_id NULL, amount, payment_date,
                method [cash|bank|cheque|mobile], reference, notes)
```

RLS: every table filtered by `auth.uid() = user_id`. Roles in separate `user_roles` table with `has_role()` security-definer function.

Derived balances (computed in server functions, not stored):
- Vendor owed = Σ GRN totals − Σ vendor_payments + opening_balance
- Client outstanding = Σ posted invoice totals − Σ client_payments + opening_balance

## Modules & Routes

```text
/                          Executive Dashboard
/vendors                   Vendor list + add/edit
/vendors/$id               Vendor detail: GRNs, payments, balance ledger
/vendors/grn/new           Log Goods Received form
/clients                   Client list + add/edit
/clients/$id               Client detail: invoices, payments, balance, "Log Weekly Installment"
/invoices                  All invoices (filter draft/posted)
/invoices/new              Create invoice (saves as draft by default)
/invoices/$id              View/edit invoice + amendment history + PDF export
/settings                  Global Settings (currency, theme, doc template designer)
/login                     Auth
```

Layout shell:
- Desktop (≥ md): collapsible **Sidebar** (shadcn `sidebar`) with sections: Dashboard, Vendors, Clients, Invoices, Settings
- Mobile (< md): fixed **bottom navigation bar** (5 icons: Dashboard, Vendors, Clients, Invoices, More)
- Header: currency badge, theme toggle, user menu

## Global Configuration

1. **Multi-currency** — `app_settings.currency` ∈ {PKR ₨, USD $, EUR €}. `useCurrency()` hook + `formatMoney(n)` helper used everywhere money displays.
2. **Themes** — three modes via `data-theme` on `<html>`:
   - `light` (clean), `dark`, `contrast` (high-contrast yellow-on-black for outdoor)
   - Tokens defined in `src/styles.css` using `oklch` under `:root`, `.dark`, `[data-theme="contrast"]`
   - Toggle in header + persisted to `app_settings`
3. **Document Designer** — 3 PDF templates: Classic Professional, Modern Minimalist, Compact/High-Density. Selectable globally (default) and per-document at export time. Template chosen at invoice/GRN level overrides global.

## Module 1 — Vendor Management
- Vendor CRUD table
- GRN form: vendor dropdown, material, qty, unit, unit price (auto-calc total), date, doc template, notes
- Vendor detail page: balance card, GRN ledger, payments ledger, "Log Payment" dialog
- PDF download for individual GRN using selected template

## Module 2 — Client Management & Weekly Ledger
- Client CRUD table
- **Invoice workflow:**
  - Create → saved as `draft` (editable freely, balance unaffected, payment logging disabled)
  - "Post Invoice" button → status `posted`, sets `posted_at`, adds to outstanding balance
  - Editing posted invoice → modal **requires reason text (min 5 chars)** → writes row to `invoice_amendments` with previous/new totals → increments `current_version` → updates client balance
  - Amendment history panel on invoice detail
- PDF export with per-invoice template selector
- **"Log Weekly Installment"** button on each client row + client detail:
  - Dialog: Date, Amount, Payment Method (Cash/Bank/Cheque/Mobile), Reference, optional invoice
  - Disabled if client has only draft invoices (no posted balance)
  - On submit: insert `client_payments`, balance recalculates, toast confirmation

## Module 3 — Executive Dashboard
Top cards (in active currency):
- Total Outstanding Due from Industries (Σ posted invoices − Σ client payments)
- Total Money Owed to Vendors (Σ GRNs − Σ vendor payments)
- This Week's Collections (Σ client_payments in last 7 days)

Below:
- Scrollable "Recent Weekly Collections" table (client name, date, amount, method)
- Mini chart: 8-week collection trend (Recharts)

## Mock Data
Server fn `seedDemoData()` inserts: 4 vendors, 6 clients, 8 GRNs, 12 invoices (mix of draft/posted), 20 client payments spread over last 6 weeks. Triggered by a "Load Demo Data" button on Settings (only when tables empty).

## Build Order
1. Enable Lovable Cloud + create all tables/RLS via migration
2. Auth + protected `_authenticated` layout + responsive shell (sidebar/bottom-nav)
3. Settings page (currency, theme, doc templates) + `useSettings` context
4. Dashboard with KPI cards + recent collections (with seed data)
5. Vendor module (list, detail, GRN, payments) + PDF
6. Client module + invoice draft/post workflow + amendment audit + weekly installment
7. PDF document templates (3 variants) wired to GRN & invoice export
8. Polish: high-contrast theme tuning, mobile bottom nav, empty states

## Design Direction
Professional finance/ERP feel — neutral slate base, single saturated accent (emerald for inflows, rose for outflows), generous whitespace on desktop, denser tap targets on mobile. Inter for UI, JetBrains Mono for figures. Will confirm palette after approval.

---

**Confirm to proceed** and I'll start with Cloud setup + schema + dashboard shell.
