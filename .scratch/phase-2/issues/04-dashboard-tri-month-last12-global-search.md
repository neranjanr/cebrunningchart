# 04: Dashboard Tri-Month Metrics, Last-12 & Global Search

**What to build:** Dashboard shows Official Distance (This Month), Private Mileage (This Month), Total (This Month) as Integer KM, monthly and Page-wise breakdowns default to last 12 entries with a More button opening a scrollable modal of all months/pages, and a header Global Search that live-filters all Trips (date, Places Visited, Fuel Order No, Trip Type, KM substrings) with filtered count and summed Official/Private/Total. End-to-end: manager opens Dashboard, sees This-Month trio integers, clicks More to scroll full history, types in header search and sees master table filter live with summed footer. Parent: #9

**Blocked by:** 01 - Trip Reciprocals, Integer KM & Estimated Start Time, 02 - Chronological Page Renumbering & Book Opening, 03 - Ledger Fuel Model, In-Tank & Transposed Side 2

**Status:** ready-for-agent

- [ ] Dashboard cards compute This-Month (YYYY-MM = today) Official/Private/Total as integer KM
- [ ] Monthly and Page-wise tables show last 12 by default; More opens modal (max-height, sticky header, scrollable) with full data and same integer/mono formatting
- [ ] Global Search input in header (Dashboard + Ledger) debounced ~200ms, case-insensitive substring on listed fields, numeric exact, filters master table in place
- [ ] Filtered footer shows count + summed Official/Private/Total distances of filtered result
- [ ] Tests at the Dashboard/Search seam cover This-Month calc, last-12 slicing, modal data, and search matching/sums

