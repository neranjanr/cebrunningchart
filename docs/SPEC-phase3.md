# Running Chart — Phase 3 Specification (Local)

**Author:** Neranjan Rathnayake (github.com/neranjanr)
**Credits:** OpenCode, Alacrity, MattPocock tools, Gemini, DeepSeek
**Status:** Local spec — grilling completed Sat 2026-09-12, Phase 2 Ticket 5 scope discarded entirely. Not published to GitHub tracker.

---

## Problem Statement

Phase 1–2 delivered a high-fidelity digital Book with Landing-gated SSO, integer KM, In-Tank fuel, chronological renumbering, Book Opening, and book-mirror Excel export. Phase 3 closes the remaining fidelity and audit gaps surfaced in triage:

- Ledger data must never leak before login — any direct URL paste today could flash data before `ProtectedRoute` resolves.
- Fuel Economy editing is coarse (no 0.1 stepping) and has no "adjusted vs inherited" signal; reverting to an inherited value leaves a stale override.
- Ledger Page View still uses the dual-column folio (Side 1 / Side 2 side-by-side) with per-day trip indexes (1..13), which mismatches the requested full-width stack and page-wide continuous numbering.
- All Trips has no first-class round-trip Excel contract — export and import use different templates and overwrite behaviour is ambiguous.
- KM fields still show `.0` decimals in places, and fuel/consume rounding is conflated with odometer display.
- Continuity gaps (page-to-page and trip-to-trip, odometer vs fuel) are checked but only as ephemeral banners with single-color treatment, easily dismissed and missed in print.

Phase 3 makes the Book strictly gated, auditable, and continuously self-checking, without changing pagination invariants (4 days / 13 trips / month rollover).

## Solution

Phase 3 is a local, non-breaking extension on top of Phase 1–2:

- **Strict Landing Gate** on every route before any data fetch.
- **Adjusted Fuel Economy** per Day Group with ±0.1 stepping from existing value, badge, and auto-revert on typing inherited value or × clear.
- **Ledger Full-Width Stack** (Table 1 full-width Trips Log; Tables 2 & 3 full-width fuel tables below) with derived **Page-Wide Trip Sequence** 1..N.
- **All Trips Workbook** contract — single sheet `All Trips`, header-row-first, append-only import, pre-flight all-or-nothing validation, integer KM `numFmt '0'` and fuel `numFmt '0.0'`.
- **Integer KM everywhere** for odometer display; fuel stays 1 decimal for `Consumed`/`Balance` maths.
- **Two-color Continuity Alerts** — RED for KM gaps, AMBER for Fuel gaps — at both Page-to-Page and Trip-to-Trip granularity, inline highlights + RED/ORANGE annotation near next Page/Trip, plus a persistent non-dismissible Alerts banner/drawer that survives refresh and only clears when gaps are fixed.

Phase 2 Ticket 5 is discarded entirely and replaced by this scope.

## User Stories

### Auth — Landing Gate (Q1, Q8)

18. As an unauthenticated visitor, I want any URL I paste (`/ledger`, `/trips`, `/dashboard`, `/help`, `/ledger?page=3`, `/trips/new`, deep links, browser back) to show **only Landing** (Super Admin password + Google SSO) and fetch **no** ledger/vehicle data, so that data never flashes before auth.
19. As an authenticated user whose session expires, I want an immediate toast "Session expired" and redirect to Landing, with no stale ledger visible.

### Fuel Economy — Adjusted marker + 0.1 step (Q2, Q3, Q9)

20. As a driver on the Ledger Page View, I want to adjust Fuel Economy for a Day Group by pressing up/down to step **±0.1 from the existing value** (not from 0), clamped 0.1–50, rounded to 1 decimal, saved per `pageId+dayIndex` and propagated forward until the next explicit override.
21. As a driver, I want an **"Adjusted" badge** (amber dot + label, plus × clear) on any Day Group where `economySource === 'explicit'`; when I type the inherited value (e.g., 8→7→6 then 6→7 where 7 is inherited), the explicit override is deleted, the badge disappears, and the day re-inherits — same effect as clicking ×.
22. As a driver, I want downstream days that inherit an overridden economy to recompute `Consumed`/`Balance` immediately without manual refresh.

### Ledger Layout — continuous numbering + full-width stack (Q4, Q10)

23. As an auditor on the Ledger Page View, I want Table 1 **Trips Log** to occupy **full width on top**, with Table 2 **Fuel Economy & Consumption** and Table 3 **Fuel Position & Balance** stacked **full-width beneath it** (no side-by-side folio), preserving print landscape and responsive stacking.
24. As an auditor, I want the Trips Log `#` column to show a **derived Page-Wide Trip Sequence 1..N** continuous across Day Groups for that Page (Day 1 trips 1–3, Day 2 starts at 4), not per-day 1..13; `trip_index` per day remains stored but not displayed there. Sorting is chronological by `date` then `trip_index` then `start_km`.
25. As an auditor, I want All Trips master table to show an independent global chronological sequence 1..T (not Page-Wide seq) for cross-Book traceability.

### All Trips Workbook — export + append import (Q5, Q11)

26. As a manager on All Trips, I want an **Export Excel** button that writes sheet `All Trips` with header row **exactly** `Date | Start KM | End KM | Distance | Start Time | End Time | Type | Places Visited | Fuel Pumped | Fuel Order No` (case-insensitive, order-enforced on import), Integer KM cells `numFmt '0'`, fuel cells `numFmt '0.0'`, file name `AllTrips_<vehicle>_<date>.xlsx`.
27. As a data clerk, I want to **Import Trips** via the same All Trips template (first row = header, all others = data), with pre-flight validation of essential fields (`Date, Start KM, End KM, End Time, Places Visited`), `End KM ≥ Start KM`, `Distance = round(End−Start)` auto-derived if blank, and pagination rules (4 days / 13 trips / month); on any row failure, abort with **no writes** and a row-numbered error report.
28. As a data clerk, I want successful imports to **append** — never overwrite existing trips — inserted chronologically, paginated via `assignPageForNewTrip`, and if backdated before the earliest Page, auto **renumber Pages 1..N chronologically + recalc continuity** in one transaction; duplicate detection by `date+start_km+end_km+end_time` skips with warning, not error; toast "N trips appended" + redirect to All Trips/Ledger.

### Integer KM Display (Q6, Q13)

29. As any user, I want **all odometer values** (`Start KM, End KM, Trip Distance, Page Start/End KM, Day Start/End KM`) **displayed as integers with no decimals** everywhere (UI tables, toasts, Excel KM columns), while `Consumed Fuel` and `Closing Balance` remain **1-decimal** for maths (`Consumed = Distance / Economy` rounded 1 dec, `Balance = Position + In-Tank + Drawn − Consumed` rounded 1 dec). Decimal KM input is accepted but **rounded on blur/save** via `Math.round`.

### Two-Color Continuity Gaps + Persistent Alerts (Q7, Q12)

30. As an auditor, I want **Page-to-Page gaps** detected: `Page N End KM != Page N+1 Start KM` (KM Gap) highlighted in **RED** near next Page's Start KM label ("⚠ KM Gap: expected 50200 got 50190") and `Page N End Fuel Balance != Page N+1 Start Fuel Balance` (Fuel Gap) highlighted in **AMBER/ORANGE** near next Page's Start Fuel label, with inline cell backgrounds (`bg-red-100` / `bg-amber-100`) and tooltips.
31. As an auditor, I want **Trip-to-Trip gaps** inside All Trips (chronological sort) detected: `Trip N End KM != Trip N+1 Start KM` → RED inline on violating `Start KM` cell; fuel-implied gaps (Day Group `Balance` vs next Day's `Position`, including In-Tank) → AMBER inline; same two-color rule.
32. As a manager, I want a **persistent Continuity Alert banner/drawer** visible on Ledger, All Trips, and Dashboard, listing every violation with page/trip, expected, actual, color-coded RED/AMBER, with "Jump to Page/Trip" links; **not dismissible**, survives refresh (recomputed on every data change), and only clears when gaps are fixed or missing records are added to close them; Alerts do not auto-recalculate/fix balances, they only warn until manual correction.
33. As an auditor, I want Alert counts surfaced (e.g., "3 KM Gaps · 1 Fuel Gap") and highlighted rows also printable with same colors.

## Implementation Decisions

- **Framework & Architecture:** Next.js App Router + TypeScript + Tailwind, existing tokens (paper-sheet, slate-surface) and JetBrains Mono for KM/fuel columns; Ledger switches from `grid xl:grid-cols-2` folio to single-column `grid-cols-1 gap-6` stack: T1 full-width, T2 full-width, T3 full-width; gutter/binding element hidden.
- **Auth Gate:** `ProtectedRoute` wraps all Ledger/Trips/Dashboard/Help/New-Trip pages + a client guard that `router.replace('/login')` before any `getPages/getTrips/getVehicleProfile` call when `!isAuthenticated`; `useAuth` expiry triggers toast + redirect; no Supabase query fires unauthenticated. Landing is the only public route.
- **Fuel Economy Store:** Reuse `lib/fuelEconomyStore.ts` + `lib/inTankStore.ts` (per `pageId` arrays aligned to `distinctDates` order). New handlers: `stepEconomy(dayIdx, +0.1/-0.1)` reads current propagated value if `raw==null`, otherwise `raw`, applies `clamp(round(value+delta,1),0.1,50)`, saves, recomputes `ledgerDays`. Badge: `economySource==='explicit'` → amber dot + "Adjusted" + × that sets `raw[dayIdx]=null`. Typing inherited value triggers same deletion (`if typed===propagatedInherited → null`). Propagation via `propagateFuelEconomy` in `lib/ledgerCalculations.ts:46`.
- **Continuous Numbering:** New derived `pageSeq` computed in `BookLedgerView`/`Side1TripsLog` as `flatTrips = dayGroups.flatMap(g=> g.trips) sorted` then `index+1`; `trip_index` per day remains stored for pagination invariants. All Trips table `globalSeq` is `sortedTrips.index+1` globally. No DB migration.
- **Integer KM Enforcement:** Centralize via `roundToIntegerKm` (Math.round) at save, display, and Excel generation; inputs of type `number` accept decimals but `onBlur` rounds; Excel KM columns `numFmt='0'` (changed from `'0.0'` in `lib/excelExport.ts:193`), fuel stays `'0.0'`; `trip_distance` stored as integer.
- **All Trips Workbook:** New seam `lib/allTripsWorkbook.ts` (pure): `generateAllTripsWorkbook(trips,pages)` writes sheet `All Trips` with 10 columns above; `parseAllTripsWorkbook(buffer)` validates header row case-insensitive order-enforced, maps to `Trip` partials, validates essential fields + 4/13/month via `validateTripForPage`/`validatePaginationConstraints`, returns `{valid, errors:[{row, field, message}]}`; import path in All Trips page shows row-numbered report and blocks write if any error. On success, trips are appended chronologically, paginated with `assignPageForNewTrip`, and if `isBackdatedInsertion` true, calls `renumberPagesChronologically` + `recalculatePageBalancesFromOpening`.
- **Gap Detection & Alerts:** Extend `lib/pagination.ts:101` validators to return `breaks` with `{pageNumber, expected, actual, kind:'km'|'fuel'}` at page level; new `lib/continuityAlerts.ts` pure helpers: `detectPageGaps(pages)->PageGap[]`, `detectTripGaps(sortedTrips)->TripGap[]`, `detectFuelGaps(days)->FuelGap[]`; colors `RED (#DC2626 / bg-red-100)` for `km`, `AMBER (#D97706 / bg-amber-100)` for `fuel`. Ledger `BookLedgerView` renders RED/ORANGE annotations adjacent to next Page header cells; `AllTripsMasterTable` renders inline cell highlights. Persistent `ContinuityAlertBanner` component reads from same detectors on every render, stored in memory (no localStorage dismiss), visible on Ledger/All Trips/Dashboard with Jump links (`setCurrentPageNumber` / scroll to row). No auto-recalc action — only surface.
- **Help Page:** Update `/help` (still gated per Landing Gate) to document All Trips Workbook template, ±0.1 stepping, Adjusted badge revert, integer KM rule, and gap color legend.

## Testing Decisions

- **What makes a good test:** Behaviour at highest seam — pure gap detectors, workbook round-trip, propagation & revert, panel rendering — not component wiring.
- **Which modules will be tested:**
  - Strict gate: unauthenticated direct route → redirect, no data fetch mock called; session expiry → toast+redirect.
  - Fuel economy: step ±0.1 from existing (not 0), clamp, 1-dec rounding, Adjusted badge appears on explicit and disappears on typed inherited or ×, inherited days recompute consumed/balance, propagation forward until next explicit.
  - Ledger layout: T1 full-width order T1→T2→T3, pageSeq 1..N derived regardless of day breaks, print stack preserved.
  - Integer KM: decimal input rounded on blur, display `toFixed(0)`/`numFmt '0'`, distance `end−start` integer, fuel still 1 dec.
  - All Trips Workbook: header validation (case-insensitive, order-enforced), distance auto-derive, 4/13/month pre-flight abort with row errors, append-only no overwrite, backdated renumber+recalc, duplicate skip with warning.
  - Continuity Alerts: page-level and trip-level KM (RED) vs Fuel (AMBER) detection, annotation near next Page/Trip, inline highlights, persistent banner survives state change until fixed, banner lists expected/actual and jump links, All Trips highlights trip gaps.
- **Prior Art:** Reuse `ledgerCalculations.test.ts`, `pagination.test.ts`, `excelExport.test.ts`, `fuelEconomyStore`, `pageStore.test.ts` patterns; avoid low-level component mocks.
- **Proposed seams (for confirmation — 6 seams):**
  1. Auth Gate (`lib/authContext`, `ProtectedRoute`, `app/** ProtectedRoute`)
  2. Fuel Economy Engine (`lib/ledgerCalculations.propagateFuelEconomy`, `lib/fuelEconomyStore`, Ledger step/revert handlers)
  3. Ledger Presentation (`components/ledger/BookLedgerView`, `Side1TripsLog` pageSeq, full-width stack)
  4. All Trips Workbook (`lib/allTripsWorkbook` parse/generate, import validation)
  5. Integer KM (`lib/tripCalculations.roundToIntegerKm`, Excel numFmt, input rounding)
  6. Continuity Alerts (`lib/pagination` + `lib/continuityAlerts`, banners & inline highlights)

## Out of Scope

- Multi-tenant fleet dispatching, GPS telemetry, cost accounting in multi-currency.
- Reserved-gap page numbering (configurable print offset may be added later if needed — ADR 0001).
- PWA offline binaries beyond web deployment.
- Auto-recalculation/fix of gaps (Phase 3 is alert-only; recalc is a future explicit action if requested).
- i18n/localization beyond current strings.

## Further Notes

- **Domain glossary** lives in `CONTEXT.md` — Phase 3 adds: `Landing Gate, Adjusted Fuel Economy, Page-Wide Trip Sequence, Integer KM (stricter display), KM Gap, Fuel Gap, Continuity Alert, All Trips Workbook, Ledger Full-Width Stack` (q.v.).
- **Decisions hard to reverse** to be recorded in `docs/adr/0005-strict-landing-gate.md`, `0006-adjusted-economy-step.md`, `0007-page-wide-seq-and-full-width-stack.md`, `0008-two-color-continuity-alerts.md` on implementation.
- **Phase 2 Ticket 5** discarded entirely — no carryover; this document replaces that ticket's scope.
- **Source references:** `CONTEXT.md:47` Integer KM, `lib/fuelEconomyStore.ts:1`, `lib/ledgerCalculations.ts:30` Fuel Position, `lib/pagination.ts:96` continuity checks, `components/ledger/BookLedgerView.tsx:179` folio grid, `app/ledger/page.tsx:36` ProtectedRoute, `lib/authAccess.ts:182` SSO gating, `lib/excelExport.ts:73` Book-Mirror workbook.

