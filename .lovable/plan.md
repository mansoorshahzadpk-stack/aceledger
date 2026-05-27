## Goal

Make Settings → Document Designer the single source of truth for the invoice/GRN print template. Remove the per-document "Document template" selector from invoice and GRN pages. Every invoice and GRN renders using the currently selected default template; changing it in Settings instantly changes all documents.

## Changes

1. **`src/routes/_authenticated.invoices.new.tsx`**
   - Remove the `template` state and the "Document template" `<Field>`/`<Select>` block.
   - On insert, save `doc_template: settings.default_doc_template`.

2. **`src/routes/_authenticated.invoices.$id.tsx`**
   - Remove the `<Select>` for `form.doc_template` from the UI.
   - Stop persisting `doc_template` on save (keep whatever's in the row; the renderer will override).
   - When calling `renderDocument(...)`, pass `template: settings.default_doc_template` instead of `form.doc_template` so the print/preview always reflects the current Settings choice — including for older invoices.

3. **`src/routes/_authenticated.vendors.grn.new.tsx`**
   - Remove the `doc_template` `<Select>` from the form UI.
   - Keep storing `doc_template: settings.default_doc_template` on insert and drop the `useEffect` that synced it (no longer needed since there's no user-facing control).

4. **GRN view / print path** (same file or the vendor detail page): wherever `renderDocument` is invoked for a GRN, switch `template:` to `settings.default_doc_template` so existing GRNs also follow the Settings choice.

## Not changing

- Settings → Document Designer UI stays exactly as it is.
- `app_settings.default_doc_template` column and the existing `doc_template` columns on `invoices` / `vendor_grns` are left in place (no migration). The column simply becomes a historical record; the renderer ignores it in favor of the live Setting.
- `src/lib/document-templates.ts` and the recent download fix are untouched.

## Result

Users pick a template once in Settings. The invoice and GRN screens no longer show a template selector. Print/download from any invoice or GRN — old or new — uses the template currently selected in Settings.
