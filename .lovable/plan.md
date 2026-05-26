## Goal

Make Classic, Modern, and Compact document templates visually distinct from Ace Design (and from each other) — different layouts, typographic systems, and color palettes — rather than the current shared Ace Design layout with only font/padding/accent overrides. Rename labels to drop the "Ace Design —" prefix.

## 1. Refactor `src/lib/document-templates.ts`

Replace the single `acelog` base + `VARIANT_OVERRIDES` injection model with four self-contained template functions, each returning its own full HTML/CSS:

- `acelogTemplate(d)` — unchanged (current Ace Design layout).
- `classicTemplate(d)` — formal traditional invoice
  - Serif typography (Georgia / Playfair-style fallback stack)
  - Centered masthead: company name (large, all-caps, letter-spaced) above a thin double-rule divider
  - Document title centered under the rule; number + dates in a small right-aligned block
  - Bill-to in a bordered box, left-aligned
  - Items table with classic ruled borders (top + bottom rules, no header fill), all-caps small header labels
  - Totals right-aligned with a double underline on grand total
  - Palette: deep ink `#1a1a1a` on `#fafaf7` cream, hairline rules `#cfc9bd`, no accent color
- `modernTemplate(d)` — bold editorial / Awwwards feel
  - Sans display (Inter / Söhne-style stack) with heavy weight contrast
  - Full-bleed colored header band (deep emerald `#0d4f3c` on cream) containing logo + huge doc title set in 64px, doc number right-aligned in light weight
  - Two-column meta strip below header: Bill To (left) / Date + Due (right), separated by generous whitespace, no boxes
  - Items rendered as borderless rows with thick bottom dividers, line-total in oversized tabular numerals
  - Totals: right-aligned, grand total in a dark pill (`#0d4f3c` bg, cream text) sized large
  - Generous 64px padding, lots of negative space
  - Palette: emerald `#0d4f3c`, cream `#f7f4ed`, charcoal `#1a1a1a`, muted `#7a7468`
- `compactTemplate(d)` — dense single-page receipt style
  - Mono-leaning sans (system-ui + JetBrains-Mono-ish stack for numbers)
  - 20px page padding, 10px base font, tight 1.2 line-height
  - Single-row header: logo (small) + company block (left), doc title + number + date inline (right) — all in one band
  - Bill-to as a one-line inline block
  - Items table with zebra striping (`#f6f6f6`), no outer border, minimal cell padding (4px 8px)
  - Totals inline at bottom-right in a tight 2-col grid (no card)
  - Palette: near-black `#111` on white, slate accent `#475569`, zebra `#f6f6f6`

Shared helpers (`money`, `fmtDate`, `escapeHtml`, `num`) remain at module scope and are reused by all four templates. Negative-sign-with-amount logic and `.biz .name { font-size: 26px }` for the company name carry into every template's CSS.

`buildDocumentHtml` becomes a simple dispatch:

```ts
switch (d.template) {
  case "classic": return classicTemplate(d);
  case "modern":  return modernTemplate(d);
  case "compact": return compactTemplate(d);
  default:        return acelogTemplate(d);
}
```

Remove `VARIANT_OVERRIDES` and the `base.replace("</style>", ...)` injection.

## 2. Rename labels in `src/routes/_authenticated.settings.tsx`

Template picker options become: `Ace Design`, `Classic`, `Modern`, `Compact` (no "Ace Design —" prefix on the three variants). Underlying enum values (`acelog`, `classic`, `modern`, `compact`) unchanged, so no DB migration is required.

## Out of scope

- No changes to invoice data, totals math, currency formatting rules, themes, sidebar, or auth.
- No new template values added to the enum.
