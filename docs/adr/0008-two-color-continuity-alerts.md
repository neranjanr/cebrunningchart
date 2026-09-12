# Two-color Continuity Alerts — page + trip, persistent, non-dismissible

Gaps are surfaced at two levels: Page-to-Page (`Page N End KM != N+1 Start KM`, `End Fuel != next Start Fuel`) annotated in RED (KM) / AMBER (Fuel) near the next Page header plus inline cell highlights; and Trip-to-Trip inside All Trips (`Trip N End KM != N+1 Start KM`, Day Group fuel position gaps) with same two colors inline. A persistent banner/drawer lists every violation (page/trip, expected vs actual, color-coded, "Jump to" links) on Ledger, All Trips and Dashboard, survives refresh, and only clears when gaps are fixed or missing records added — no auto-recalc, not dismissible.

Considered single-color or auto-fix on detection — rejected; user requires two distinct colors and that alerts "do not reset or clear till gaps are fixed, or records are added." Validated via `lib/pagination.ts:101 validateOdometerContinuity/validateFuelContinuity` plus new trip-level detectors.

