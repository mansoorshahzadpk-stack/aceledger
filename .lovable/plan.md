## 1. PDF: negative sign next to amount

In `src/lib/document-templates.ts` `money()`, render as `{symbol}\u00A0\u00A0{sign}{abs}` so the minus sits with the number (e.g. `Rs  -5,500.00`). Keep red color for negatives.

## 2. Company name on invoice — 2× larger

In `src/lib/document-templates.ts`, change `.biz .name` `font-size` from `13px` to `26px`. Apply to all template variants.

## 3. "B2B ACCOUNTS" subtitle visibility

In `src/components/AppShell.tsx` sidebar header, switch the subtitle to a higher-contrast token (`text-sidebar-foreground/80`) so it's legible on coloured themes.

## 4. Rename "coloured" → "Lavender" + add Maroon & Green themes

- Migration: extend `ui_theme` enum with `'lavender'`, `'maroon'`, `'green'`; backfill existing `'coloured'` rows to `'lavender'`.
- `src/lib/app-context.tsx`: update theme union to `light | dark | lavender | maroon | green`.
- `src/styles.css`: rename `[data-theme="coloured"]` block to `[data-theme="lavender"]`; add `[data-theme="maroon"]` (deep burgundy primary, warm gold accent, cream surfaces, subtle gradient) and `[data-theme="green"]` (deep forest primary, sage/mint accents, off-white surfaces, subtle gradient). Professional and elegant.
- `src/routes/_authenticated.settings.tsx`: theme selector lists Light, Dark, Lavender, Maroon, Green.

## 5. Rename document templates → "Ace Design" family

In `src/lib/document-templates.ts` and the settings template picker:

- `acelog` → "Ace Design"
- `classic` → "Classic"
- `modern` → "Modern"
- `compact` → "Compact"

Refactor `classic`/`modern`/`compact` to render via the `acelog` layout, overriding only font family, padding, and accent color so all variants share the Ace Design structure (header, totals, balance box, currency spacing, negative-red).

## Out of scope

No changes to invoice/GRN data, totals math, amendments logic, or auth.