# Super-admin-gated Google SSO via allow-list

Authentication is split: a single Super Admin (Neranjan / `SupAd@2000` hashed, must change on first login) signs in by password; all other users sign in via Google OAuth only if their Gmail is on an allow-list managed by the Super Admin at `/settings/access`. Unauthenticated visitors see only Landing (`/login`) and no ledger data; all other routes are behind `ProtectedRoute` (`lib/authContext.tsx:7`, `app/trips/new/page.tsx:7`). Google SSO is rejected with "Not authorized" when not allow-listed.

Supabase `profiles` stores `role`, `must_change_password`, and `allowed_emails`; the mock fallback in `lib/authContext.tsx:48` is retained only for local dev without Supabase keys.

