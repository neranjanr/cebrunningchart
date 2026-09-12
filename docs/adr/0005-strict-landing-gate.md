# Strict Landing Gate — no data before auth

All routes except Landing hard-redirect to `/login` when unauthenticated, before any ledger or vehicle data fetch; session expiry also redirects with toast. `ProtectedRoute` wraps `/ledger`, `/trips`, `/dashboard`, `/trips/new`, `/help`.

Considered allowing `/help` public, but "don't show any data unless logged in — show app only after logged in" requires treating help content as part of the app surface. Alternative was soft gate (render Landing in place at same URL) but hard redirect prevents deep-link leakage and ensures no Supabase query fires unauthenticated.

