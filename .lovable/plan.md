## Goal
Make the business logo appear reliably in invoice and GRN PDFs generated from mobile devices (iOS and Android), without changing the existing desktop behavior.

## What I’ll change
1. Update the document preview toolbar’s PDF action so it waits for embedded images to finish loading/decoding before html2pdf starts rendering.
2. Add a mobile-safe image readiness step inside the injected document script so base64 logos are fully available before html2canvas snapshots the page.
3. Keep the existing logo inlining fallback in `renderDocument()` and preserve the current desktop print/download flow.

## Why this should fix it
The logo is already being converted to a data URL before the document is opened, which explains why desktop is now mostly fine. The remaining issue is likely timing on mobile browsers: html2pdf runs before the `<img>` in the blob document has fully decoded, so the PDF snapshot misses it. Waiting for image readiness before rendering is the smallest targeted fix.

## Files to update
- `src/lib/document-templates.ts`

## Technical details
- Add an inline helper in the injected toolbar script that:
  - finds document images,
  - waits for `img.complete` plus `img.decode()` when available,
  - falls back to `load`/`error` listeners with a short timeout.
- Call that helper before `window.html2pdf().set(opt).from(document.body).save()`.
- Optionally mark logo images with eager loading/async-decoding-friendly attributes if needed, but only inside the document HTML templates.

## Validation
- Re-test the same renderer path for both Invoice and Goods Received Note documents.
- Confirm the fix is scoped to mobile PDF generation and does not alter layout or desktop behavior.