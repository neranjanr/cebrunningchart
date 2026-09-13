# Railway Deployment Manual — RunningChart (Single-Operator, Persistent Postgres)

> Single-platform, free, persistent. Hosting + DB in one Railway project (ADR-0009/0010). Next.js 16 via NIXPACKS, Postgres plugin, no Supabase.

## 1. What this deploys

- **App:** Next.js 16 (`railway.json:4` NIXPACKS, `startCommand: npm run build && npm run start`, healthcheck `/:6`).
- **DB:** Railway Managed Postgres (volume-backed, survives redeploys). Schema `supabase/schema.sql:1` — core ledger (`vehicles`, `book_pages`, `trips`, `fuel_logs`) + auth (`super_admin`, `sessions` with 30d absolute + 7d idle sliding per `CONTEXT.md:73`).
- **Auth:** Single `Super Admin` (Neranjan) → password (bcrypt) + TOTP via Google Authenticator + single-use 64-char Recovery Code (`lib/authAccess.ts:1`). No Google SSO / allow-list.

Free tier: Railway $5 credit/mo. This app (<10k Trips) uses ~50–200 MB DB + ~0.1 vCPU, fits comfortably.

---

## 2. One-time setup (Railway Dashboard)

### 2.1 Create project

1. https://railway.app → **New Project → Deploy from GitHub repo** → select `neranjanr/cebrunningchart` (or current repo).
2. Railway auto-detects `railway.json:1`. Keep defaults: builder NIXPACKS, deploy on push to `main`.

### 2.2 Add Postgres

1. In project canvas → **+ New → Database → PostgreSQL** (managed, not self-hosted).
2. Wait for provisioning. Open Postgres service → **Variables** tab → copy `DATABASE_URL` (postgres://...). Railway auto-injects `DATABASE_URL` into linked services — verify App service → **Variables → DATABASE_URL** references `${{Postgres.DATABASE_URL}}`. If not, add reference manually (**+ New Variable → Add Reference**).
3. Keep `PG*` vars private (Railway generates). Do not expose publicly.

### 2.3 Environment variables (App service → Variables)

| Variable | Value | Notes |
|---|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | Auto-ref, required by `lib/db.ts:4` `pg.Pool`. |
| `TOTP_ENCRYPTION_KEY` | 64-char hex **or** 32-char string | AES-256-GCM key for `lib/authAccess.ts:36` `encryptTOTPSecret`. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` . **Do not rotate without re-encrypting** `super_admin.totp_secret_encrypted`. |
| `NODE_ENV` | `production` | Railway sets automatically on deploy; `lib/db.ts:5` enables SSL `rejectUnauthorized: false`. |

> Do **not** set `NEXT_PUBLIC_*` Supabase vars — removed per ADR-0009.

### 2.4 Apply schema

Option A — Railway Postgres Query tab:
1. Postgres service → **Data → Query** → paste entire `supabase/schema.sql:1` and run. First run creates `pgcrypto` extension, all tables, `super_admin` seed (`Neranjan` bootstrap), `sessions`, indexes, and disables legacy RLS (`line 109-112`).

Option B — Local psql:
```bash
# install railway CLI, then
railway link   # select project
railway run psql $DATABASE_URL -f supabase/schema.sql
```

Verify:
```sql
\dt                    -- vehicles, book_pages, trips, fuel_logs, super_admin, sessions
select * from super_admin;  -- 1 row, Neranjan, totp_enabled=false, must_change_password=true
```

If migrating from old Supabase: dump `vehicles/book_pages/trips/fuel_logs` via `pg_dump` and restore into Railway Postgres; `super_admin`/`sessions` are new — do not copy `auth.users`.

---

## 3. Deploy

Push to `main` triggers NIXPACKS build → `npm run build && npm run start` (`railway.json:8`). Check **Deployments → View Logs**:

- Expected: `✓ Compiled successfully`, `Generating static pages (16/16)`, `Listening on 0.0.0.0:$PORT`.
- Healthcheck hits `/` (`railway.json:9`). If failing, check `DATABASE_URL` reachable; app falls back to localStorage but will 500 on `sessions` insert.

Assign domain: App service → **Settings → Networking → Generate Domain** (`*.up.railway.app`). Optional: **Custom Domain** → add CNAME.

---

## 4. First login (bootstrap → TOTP → Recovery Code)

1. Visit `https://<railway-domain>/`.
2. **Landing** (`components/Landing.tsx:1`) shows only Super Admin login + Recovery link (no Google SSO).
3. Login as `Neranjan` / `SupAd@2000` (bootstrap from `lib/authAccess.ts:10`). Server at `app/api/auth/route.ts:14` (`action=login`) verifies via `verifyPassword` (SHA fallback) and returns `mustChangePassword=true` with 10-min `super_admin_recovery` session.
4. Redirect forced to `/change-password` (`components/ProtectedRoute.tsx:6`). Change password (≥6 chars) → POST `action=change-password` → bcrypt hash replaces seed.
5. Auto-triggers `action=setup-totp` → `generateTOTPSecret` → `buildTOTPURI` (`otpauth://totp/RunningChart:Neranjan?...`) → `encryptTOTPSecret` with `TOTP_ENCRYPTION_KEY` → stored `super_admin.totp_secret_encrypted`. QR data URL via `qrcode` returned → displayed at `app/change-password/page.tsx:102` (`testid=totp-qr`).
6. Scan QR in **Google Authenticator** → enter 6-digit code → `action=verify-totp-setup` (`lib/authAccess.ts:71` `verifyTOTP` window ±1) → marks `totp_enabled=true`, generates Recovery Code `generateRecoveryCode` 64-hex grouped `8×8` (≈256-bit), bcrypt hash → `recovery_code_hash`.
7. **Save Recovery Code** (`app/change-password/page.tsx:80`) — shown **once**, copy + Download `.txt`. Check box `I have saved` (`ack-saved-checkbox`) → `action=confirm-recovery-saved` promotes recovery session to full 30d session (`SESSION_ABSOLUTE_MS` in `route.ts:8`). Code is single-use; next `/recovery` burns `recovery_code_used_at`.

Subsequent logins: `username + password + 6-digit TOTP` (`components/Landing.tsx:7` toggles TOTP field after `totpRequired`). Missing TOTP → `401 TOTP required`.

---

## 5. Recovery flow (TOTP lost)

1. Landing → **Lost access to Authenticator? Use Recovery Code** (`/recovery`, `app/recovery/page.tsx:1`).
2. Paste 64-char code (dashes optional, trimmed) → `action=recovery` (`route.ts:64`) → `verifyRecoveryCode` (bcrypt) → burns `recovery_code_used_at`, deletes all `sessions`, creates 10-min recovery session.
3. Forced to `/change-password` → reset password + re-enroll TOTP (new secret + new Recovery Code). Old code invalid.

If Recovery Code also lost: manual DB reset required (no email fallback by design per ADR-0010):
```sql
-- on Railway Postgres
update super_admin set totp_enabled=false, totp_secret_encrypted=null, recovery_code_hash=null, recovery_code_used_at=null where username='Neranjan';
delete from sessions;
-- then redeploy or set new TOTP_ENCRYPTION_KEY if compromised
```

---

## 6. Local development against Railway

```bash
npm install
# link env
railway variables --service <app-service>  # copy DATABASE_URL + TOTP_ENCRYPTION_KEY
# .env.local
# DATABASE_URL=postgres://...
# TOTP_ENCRYPTION_KEY=<64-hex>

npm run dev          # Next.js dev --webpack (package.json:6)
npm test             # vitest (244 tests)
npm run build        # production check (must pass useSearchParams Suspense)
```

To use Railway's DB locally without CLI:
```bash
railway run --service <app-service> npm run dev
```

---

## 7. Operations

### Health & logs
- **Deployments** tab shows build/runtime logs, restart policy `ON_FAILURE ×3` (`railway.json:11`).
- Healthcheck `GET /` must 200; if Postgres down, `lib/db.ts:9` `pool.query` throws but app still renders Landing (session check fails → redirects).

### Backup
- Railway Postgres → **Backups** (daily automated on paid, manual dump on free):
```bash
railway run pg_dump $DATABASE_URL > backup-$(date +%F).sql
```
- Recovery codes are hashed — not restorable. Re-enroll TOTP after restore if `super_admin` restored with `recovery_code_used_at` set.

### Rotation
- **TOTP_ENCRYPTION_KEY:** generate new 64-hex, decrypt all `totp_secret_encrypted` with old key (offline script), re-encrypt with new key, update Railway variable, redeploy. Not needed unless leaked.
- **Password:** `/change-password` while authenticated; invalidates? Currently keeps session but revokes on next recovery. To force logout: `delete from sessions`.

### Scaling
- NIXPACKS builds on `npm run build` OOM? Increase service memory in **Settings → Resources** (default 512 MB sufficient).
- Postgres storage: free ~0.5–1 GB; monitor **Metrics → Disk**.

---

## 8. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `DATABASE_URL is not set` or `ECONNREFUSED` | Reference not linked | App Variables → Add Reference → `DATABASE_URL = ${{Postgres.DATABASE_URL}}` |
| `No crypto for encryption` / TOTP setup 500 | Missing `TOTP_ENCRYPTION_KEY` | Set 64-hex, redeploy |
| Login loops to `/change-password` | `must_change_password=true` or `totp_enabled=false` | Complete password change + TOTP verify + recovery save; check `select must_change_password, totp_enabled from super_admin` |
| `Invalid TOTP code` always | Clock skew >90s | Sync device/NTP; Railway server uses UTC; `verifyTOTP` allows ±1 window (90s) |
| `Recovery code already used` | Single-use burned | Generate new via successful TOTP re-enrollment; or manual DB clear above |
| `/change-password` build error `missing-suspense-with-csr-bailout` | `useSearchParams` without Suspense | Already fixed in `app/change-password/page.tsx:1` (`Suspense` wrapper); do not remove |

---

## 9. References

- `railway.json:1` deploy spec
- `supabase/schema.sql:1` canonical schema (apply verbatim)
- `lib/db.ts:1` `pg.Pool` single `DATABASE_URL`
- `lib/authAccess.ts:1` crypto seam (bcrypt, otpauth, AES-GCM)
- `app/api/auth/route.ts:1` session logic (30d absolute + 7d idle)
- `CONTEXT.md:62` Auth & Access glossary
- `docs/adr/0009` + `docs/adr/0010` decisions
- `docs/manuals/railway.md` (this file) — keep in `docs/manuals/` per project docs layout.

