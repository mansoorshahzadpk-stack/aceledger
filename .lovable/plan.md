Revert `modernTemplate(d)` in `src/lib/document-templates.ts` back to the emerald editorial design that existed before the light-blue invoice rewrite.

### What to revert
The latest rewrite (light-blue callout, serif "Invoice" wordmark, Playfair Display fonts, blue footer band) is replaced with the previous **emerald editorial** design:
- Full-bleed emerald `#0d4f3c` header band across the top
- Bold sans-serif typography (system/Inter)
- Two-column meta strip (business left, document details right) inside the emerald band
- Borderless items table with thick horizontal dividers
- Dark pill-style totals block
- Generous 64 px padding, editorial whitespace
- No external font imports (remove Playfair Display `<link>`)

### Files touched
- `src/lib/document-templates.ts` — rewrite `modernTemplate(d)` body (lines 275-411), remove Google Fonts `<link>` from the template string.

### Out of scope
Ace Design, Classic, and Compact templates remain untouched. `money()`, `fmtDate`, settings UI, themes, and DB are not changed.