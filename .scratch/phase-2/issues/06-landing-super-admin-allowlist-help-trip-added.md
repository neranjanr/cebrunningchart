# 06: Landing, Super Admin SSO Allow-List, Help & Trip Added UX

**What to build:** Landing login as the only unauthenticated view, Super Admin (Neranjan / SupAd@2000 hashed, forced change on first login) managing the Gmail allow-list, and Google SSO gated by that allow-list; authenticated Help Page at /help; and Trip Added toast plus redirect to Dashboard on save. End-to-end: visitor sees only Landing, Super Admin logs in with bootstrap password and is forced to change it, adds Gmail to allow-list, that Gmail can SSO and see ledger, non-allowed Gmail is rejected to Landing, every Trip save shows Trip Added toast and redirects to Dashboard, Help is visible only after login. Parent: #9

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Unauthenticated sees only Landing (login with Super Admin password + Google SSO buttons); all other routes behind authenticated guard
- [ ] Super Admin bootstrap hashed, first login redirects to password change until completed; only Super Admin can CRUD allow-list at /settings/access
- [ ] Google SSO callback checks allow-list; non-allowed rejected with 'Not authorized — contact admin' and stays on Landing
- [ ] Help Page authenticated at /help, header ? link, 8 sections (Book Opening, reciprocals, time estimation, import template, pagination rules, fuel formula, renumber, auth roles)
- [ ] Trip save shows Trip Added toast (~2s) then redirects to Dashboard; import success shows N trips added then redirects

