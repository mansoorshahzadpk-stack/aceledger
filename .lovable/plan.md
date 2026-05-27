## Goal
On mobile (iOS/Android), the "Download" button currently saves an `.html` file, which most phones can't open as a document. Make the download produce a real **PDF** file instead, while keeping the on-screen preview and "Print / Save as PDF" experience unchanged on desktop.

## Approach
Render the document HTML to a PDF on the client using `html2pdf.js` (wraps `html2canvas` + `jsPDF`). This avoids any backend/PDF service and works the same on iOS Safari, Android Chrome, and desktop. The user taps **Download** → gets `Invoice-INV-0001.pdf` saved through the normal browser/iOS share sheet.

## Changes

### 1. Add dependency
- `bun add html2pdf.js`

### 2. `src/lib/document-templates.ts` — change only the download path
- In `injectToolbar(...)`:
  - Replace the current base64 `data:text/html` download `onclick` with a handler that:
    1. Dynamically loads `html2pdf.js` from a CDN (`https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.2/html2pdf.bundle.min.js`) the first time it's clicked — needed because the toolbar is injected into a standalone HTML document (blob/data URL) that doesn't share our app's bundle.
    2. Hides the toolbar, calls `html2pdf().set({ margin: 10, filename, image: { type: 'jpeg', quality: 0.95 }, html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } }).from(document.body).save()`, then restores the toolbar.
    3. On any error, falls back to `window.print()` (the existing reliable path) and shows a brief alert.
  - Pass the filename as `${safeName}.pdf` (currently `.html`) to `injectToolbar`.
- Keep the "Print / Save as PDF" button as-is (desktop users who prefer the native print dialog still have it).
- `renderDocument(...)`: change `const filename = \`${safeName}.html\`` → `\`${safeName}.pdf\``. Leave the blob/open-tab navigation logic unchanged — the preview document itself is still HTML, only the **downloaded** file becomes a PDF.

### 3. No other files change
- No template, call-site, settings, or DB changes.
- No changes to print/preview flow, the recent Settings-only template selection, or the iOS-vs-desktop window-open logic.

## Notes / trade-offs
- `html2pdf.js` rasterises the page (image-in-PDF). Text won't be selectable, but layout, fonts, colors, and logos render exactly as shown. This is the most reliable cross-device approach without a server.
- The CDN script is fetched once per opened preview tab (~150 KB gzipped) and cached by the browser afterwards. If you'd rather bundle it with the app, we can swap the CDN load for a same-origin URL — but since the toolbar lives inside a blob document, the CDN route is simplest and works offline-after-first-load via HTTP cache.
- Multi-page invoices are handled automatically by `html2pdf.js` page-break logic.
