# 03: Ledger Fuel Model, In-Tank & Transposed Side 2

**What to build:** Revise Ledger fuel arithmetic to Closing = Position + In-Tank + Drawn − Consumed, with In-Tank default 0 per Day Group editable on the first Trip of the day, and render Side 2 Fuel Economy & Position tables Transposed (days as columns) to mirror the physical book. Make tables spacious and readable: JetBrains Mono for KM/fuel, strong grid lines, sticky headers, 13px body / 11px header, airy padding. End-to-end: user types In-Tank on Day 1 Trip, ledger shows Position, Drawn, Consumed, Closing per ADR formula, Side 2 orientation matches Side 1. Parent: #9

**Blocked by:** 01 - Trip Reciprocals, Integer KM & Estimated Start Time, 02 - Chronological Page Renumbering & Book Opening

**Status:** ready-for-agent

- [ ] In-Tank persisting per Day Group (not per Trip), default 0, editable; Closing computed as position+inTank+drawn−consumed rounded 1 decimal; Vehicle current_fuel_level removed, replaced by Registration No where needed
- [ ] Fuel Economy propagation (inherited/explicit/fallback 10.5) still works with new formula; ledger days show correct Closing after In-Tank
- [ ] Side 2 tables Transposed (or toggle) matching physical book landscape; both tables share column orientation with Side 1
- [ ] Ledger tables use monospace integers for KM, grid borders, sticky header, reduced font + spacious padding
- [ ] Tests at the Ledger seam cover In-Tank 0/typed, propagation, closing arithmetic, and Transposed totals

