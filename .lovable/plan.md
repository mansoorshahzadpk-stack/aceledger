Fix the Modern template logo visibility and swap the dark emerald color for light blue.

### Changes in `src/lib/document-templates.ts` — `modernTemplate(d)` only

1. **Logo visibility fix**: remove the `filter: brightness(0) invert(1)` from the logo `<img>` style — that filter forces the logo to pure white, which made it disappear on white-background uploads and clashed with the new light-blue band. Logo renders in its original colors.

2. **Color swap (emerald → light blue)**:
   - `.hero` background: `#0d4f3c` → `#bcdcee` (soft light blue)
   - `.hero` text color: `#fff` → `#1a2330` (dark navy for contrast on light blue)
   - `.hero .doc .status` border: `rgba(255,255,255,0.4)` → `rgba(26,35,48,0.35)`
   - `table.items thead th` bottom border: `#0d4f3c` → `#2b8acb` (deeper blue accent for the rule)
   - `.totals .grand` background: `#0d4f3c` → `#2b8acb`; keep white text/value for contrast on the pill

3. Everything else (layout, typography, padding, items table, totals structure, notes) stays as is. No changes to other templates or any other file.

### Out of scope
Ace Design, Classic, Compact, settings UI, themes, DB.