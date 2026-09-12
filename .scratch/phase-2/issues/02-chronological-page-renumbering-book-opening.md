# 02: Chronological Page Renumbering & Book Opening

**What to build:** Make retroactive insertion chronological: when a Trip date precedes the earliest Page, sort all Pages by date, renumber 1..N sequentially, cascade page_number/page_id and Trip.page_id, keep dates immutable, and keep the Book Opening (Opening KM + Opening Fuel) editable in Vehicle Settings — re-editing recalculates fuel balances forward from the earliest Page only. End-to-end: book starts 2026-01-01 Page 1 at 50,000 km / 10 L, user adds 2025-01-01 Trips, they become Pages 1–2, old Page renumbered (no gap), Opening Fuel re-entered, ledger balances replay correctly. Parent: #9

**Blocked by:** 01 - Trip Reciprocals, Integer KM & Estimated Start Time

**Status:** ready-for-agent

- [ ] Pages sorted chronologically on any back-dated write; page_number and page_id reassigned 1..N; all Trip.page_id updated; dates never mutated
- [ ] Book Opening editable on first Page and re-editable after back-date; fuel balances recalculated forward from earliest Page (not full rebuild if not needed)
- [ ] Pagination constraints still enforced (4 days / 13 trips / month rollover) during renumber
- [ ] Continuity invariants hold after renumber: Page N End KM = Page N+1 Start KM, End Fuel = next Fuel Position
- [ ] Tests at the Pagination seam cover back-date insertion, sequential renumber, cascade, and Book Opening recalc

