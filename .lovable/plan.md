
## Add Google Sign-In to Login/Sign-Up

Currently the login page only supports email/password. I'll add a "Continue with Google" button to both the Sign in and Sign up tabs.

### Changes

1. **Enable Google as an auth provider** in Lovable Cloud (managed Google OAuth — no API keys needed from you).
2. **Update `src/routes/login.tsx`**:
   - Add a `Continue with Google` button above the email/password tabs, with a divider ("or") below it.
   - Wire it to the Lovable managed OAuth flow (`lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin })`).
   - Handle redirect/error states with toast feedback.
   - Keep existing email/password flow intact.

### Result

Users will see a Google sign-in button on the login screen that works for both sign-in and sign-up (Google OAuth handles both automatically — new users get an account, returning users sign in).
