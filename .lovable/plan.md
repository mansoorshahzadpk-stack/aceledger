## Fix: Download alert "URL.createObjectURL is not a function"

### Root cause
The rendered invoice document lives at a `blob:` URL on the Lovable preview origin. In that sandboxed browsing context, `URL.createObjectURL` is not exposed on the `URL` global, so the inline Download handler throws.

### Fix (only `src/lib/document-templates.ts`, only the `onclick` string in `injectToolbar`)
Replace the `Blob` + `URL.createObjectURL` path with a **base64 `data:` URL**, which is available in every browsing context and honors the anchor's `download` attribute:

```js
var html = '<!doctype html>\n' + document.documentElement.outerHTML;
var b64  = btoa(unescape(encodeURIComponent(html))); // UTF-8 safe for Rs, Urdu, etc.
var href = 'data:text/html;charset=utf-8;base64,' + b64;
var a = document.createElement('a');
a.href = href; a.download = <filename>;
document.body.appendChild(a); a.click(); a.remove();
```

Drop the `setTimeout(URL.revokeObjectURL, …)` line (no object URL to revoke). Keep the existing `try/catch` + `alert` wrapper. The outer `renderDocument` (parent-side blob + iOS-vs-desktop navigation) is unchanged — that runs in the React app where `createObjectURL` works.

### Files touched
- `src/lib/document-templates.ts` — only the `onclick` string built inside `injectToolbar`. No template, styling, call-site, or dependency changes.
