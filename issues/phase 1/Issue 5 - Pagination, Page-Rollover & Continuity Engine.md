# Issue 5: Pagination, Page-Rollover & Continuity Engine

**What to build:** Strict physical book pagination engine enforcing maximum 4 days per page, maximum 13 trips per day, automatic page rollover on calendar month changes, and cross-page odometer/fuel carry-forward continuity (Page N End KM = Page N+1 Start KM, Page N End Fuel = Page N+1 Start Fuel).

**Blocked by:** Issue 4

**Status:** ready-for-agent

- [ ] Page boundary validation (4 days / 13 trips limit per page).
- [ ] Month-change page rollover logic.
- [ ] Cross-page odometer and fuel carry-forward calculation engine.
