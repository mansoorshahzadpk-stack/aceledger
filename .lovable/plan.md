## Fix invoice/document rendering on iOS

The current `renderDocument` in `src/lib/document-templates.ts` calls `window.open("", "_blank")`, writes HTML into the new window, and auto-triggers `window.print()`. On mobile iOS (Safari and Chrome) this pattern is unreliable: popups get blocked, `document.write` into a blank window often produces a stuck `about:blank`, and the silent auto-print breaks instead of giving the user a way to save the file.

### Change

Rewrite only the `renderDocument` function (no template/markup changes):

1. Build the HTML string as today via `buildDocumentHtml(d)`.
2. Inject a small toolbar at the top of the HTML (`Print / Save as PDF` button + `Download` link, hidden via `@media print`) so the user always has an explicit, tappable save action — no auto-print.
3. Wrap the HTML in a `Blob([html], { type: "text/html" })` and create a URL with `URL.createObjectURL(blob)`.
4. Detect iOS (`/iPad|iPhone|iPod/.test(navigator.userAgent)` plus iPadOS check) and:
   - **iOS**: navigate the **current tab** to the blob URL (`window.location.href = url`). This reliably renders the document and lets the user use the iOS share sheet → "Save to Files" / "Print". Also expose a same-page `<a href={blobUrl} download="<title>-<number>.html">` so Chrome iOS users get an explicit download affordance.
   - **Desktop / Android**: `window.open(url, "_blank")` so it opens in a new tab without `document.write`. The injected Print button handles printing.
5. Revoke the object URL after a delay (`setTimeout(() => URL.revokeObjectURL(url), 60_000)`) to avoid memory leaks while still letting the new tab load it.
6. Remove the `setTimeout(... w.print())` auto-print call.

### Files touched

- `src/lib/document-templates.ts` — only the `renderDocument` export at the bottom (and a tiny helper to inject the toolbar). No call sites change; every caller (`invoices`, `vendors/grn`, etc.) keeps working.

### Out of scope

- No changes to invoice/GRN templates, styling, or call sites.
- No new dependency (no `jsPDF`); the document remains printable HTML, which iOS Files can save as PDF via the share sheet — matching what the user asked for.