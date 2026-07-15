# Ace Ledger - Workspace Rules

This file documents the workspace configurations and rules to ensure compatibility with our subdirectory deployment layout on Hostinger.

## 1. Subdirectory Deployment Routing (`.htaccess`)
- The application is deployed in the `/client/` subdirectory on Hostinger (under `public_html/client/`).
- The `public/.htaccess` file must **always** have its `RewriteBase` set to `/client/` (i.e., `RewriteBase /client/`). Never reset or revert it to `RewriteBase /`. This ensures that deep links to React Router sub-routes resolve correctly to `/client/index.html`.

## 2. API Endpoint Prefixing
- All frontend fetch requests targeting the backend PHP API routes must be explicitly prefixed with `/client` (e.g., `/client/api/export/ledger/index.php`) so that they route to the active deployment directory instead of looking at the root directory.
