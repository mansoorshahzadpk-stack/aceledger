# Add Forgot Password Flow

Add a "Forgot password?" link on the sign-in form that lets users request a password reset email, and a new page where they set a new password after clicking the email link.

## Changes

1. **`src/routes/login.tsx`** — On the "Sign in" tab, add a "Forgot password?" link below the password field. Clicking it opens a small inline view (or dialog) with an email input and a "Send reset link" button that calls:

   ```ts
   supabase.auth.resetPasswordForEmail(email, {
     redirectTo: `${window.location.origin}/reset-password`,
   });
   ```

   Show a toast on success/error.

2. **New `src/routes/reset-password.tsx`** — Public route (not under `_authenticated`). Renders a form with "New password" + "Confirm password" fields. On submit calls `supabase.auth.updateUser({ password })`. On success, shows a toast and navigates to `/`. Handles the `type=recovery` session that Supabase establishes from the email link, and shows an error state if there is no recovery session.

3. **SEO/meta** — Add `head()` with title + description for the new route, matching the project's existing pattern.

## Notes

- Uses Supabase's built-in default reset email (no custom email template work needed). The user can later request branded reset emails if desired.
- No database changes required.
- No changes to existing Google sign-in or sign-up flows.
