## Problem
Mobile PDF downloads (html2pdf.js → html2canvas) render without the logo. The logo lives at a Supabase storage URL; even with `useCORS:true`, html2canvas often taints/skips cross-origin images inside a `blob:` document because the `<img>` has no `crossorigin` attribute set before load and the blob origin differs from the storage origin.

## Fix
Pre-fetch the logo once in `renderDocument()` and inline it as a base64 `data:` URI before building the HTML. The PDF generator then sees a same-document image with no CORS involved.

### Changes — `src/lib/document-templates.ts` only

1. Add a small async helper `fetchAsDataUrl(url)`:
   - `fetch(url, { mode: 'cors' })` → `blob()` → `FileReader.readAsDataURL`.
   - Returns `null` on any failure (network, CORS, timeout ~5s).

2. Change `renderDocument` to `async`:
   - If `d.business.logo_url` exists and is `http(s):`, await `fetchAsDataUrl` and replace `d.business.logo_url` with the data URI (fallback to original URL on failure, so desktop print still works).
   - Then proceed with existing `buildDocumentHtml` + `injectToolbar` + blob/open logic unchanged.

3. No template HTML changes needed — all 4 templates already render `<img src="${logo_url}">`. Data URIs work as `src` directly.

4. Keep the existing `html2pdf` options (`useCORS:true`, `scale:2`) as a safety net.

### Call sites
`renderDocument` is invoked from invoice and GRN pages without awaiting. Switching it to `async` is non-breaking — the floating promise just resolves slightly later (after the logo fetch, ~tens of ms). No call-site edits required.

### Out of scope
- No template, settings, DB, or other route changes.
- Desktop "Print / Save as PDF" path unchanged (it already worked).
