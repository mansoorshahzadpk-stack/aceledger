## Fix: Download button on rendered invoice fails ("site can't be reached")

### Root cause
In `src/lib/document-templates.ts`, the toolbar's Download anchor points at a blob URL created in the **parent React app's window**. After the user navigates to that blob URL (current tab on iOS, new tab on desktop), the document is in a **different browsing context** with no access to the parent's blob registry — so clicking Download tries to load a blob URL that doesn't exist in this context, producing `ERR_FAILED` / "Check Internet connection". The Print button still works because it calls `window.print()` inside the same document.

### Change (only `src/lib/document-templates.ts`)

1. In `injectToolbar`, replace the Download `<a href="/__doc_blob__" download="…">` with a `<button>` whose inline `onclick` builds the blob **inside the rendered document itself**:
   - `const html = '<!doctype html>\n' + document.documentElement.outerHTML;`
   - `const blob = new Blob([html], { type: 'text/html' });`
   - `const url = URL.createObjectURL(blob);`
   - Create a temporary `<a href={url} download="<filename>.html">`, append, click, remove.
   - `setTimeout(() => URL.revokeObjectURL(url), 60_000);`
2. JSON-escape the filename when interpolating it into the inline handler so quotes/special chars can't break the HTML.
3. In `renderDocument`, drop the post-processing step that rewrote `/__doc_blob__` → parent-side blob URL. iOS current-tab navigation and desktop `window.open` keep working unchanged; the parent-side blob URL is only used for the initial render.
4. Keep the Print button (`window.print()`) and `@media print { .doc-toolbar { display: none } }` rule as-is.

### Files touched
- `src/lib/document-templates.ts` — `injectToolbar` + small cleanup in `renderDocument`.

### Out of scope
- Invoice/GRN template markup, styling, call sites, new PDF dependencies. "Save as PDF" continues to flow through Print → Save as PDF (desktop) or the iOS share sheet → Save to Files / Print to PDF.
