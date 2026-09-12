# Running Chart

Digital counterpart to the physical vehicle running chart logbook. The system mirrors the book's pagination, continuity, and fuel arithmetic so a digital ledger prints and audits identically to the paper original.

## Language

### Core Ledger

**Book**: The complete sequence of Pages for one Vehicle, ordered chronologically by date.
_Avoid_: Ledger, logbook

**Page**: A single physical sheet holding at most 4 distinct dates and 13 Trips per date; a new calendar month always forces a new Page.
_Avoid_: Sheet, paper

**Trip**: One movement record from Start KM to End KM on a given Date, with Start/End Time, Places Visited, Trip Type, and optional fuel Drawn.
_Avoid_: Entry, log, row

**Vehicle**: The tracked asset defined by Brand, Model, Type, Fuel Type, Tank Capacity, and Registration No.
_Avoid_: Car, fleet unit

**Book Opening**: The initial odometer reading (Opening KM) and fuel in tank (Opening Fuel) that seeds Page 1; re-editable when retroactive older Pages are inserted.
_Avoid_: Starting balance, initial state

**Day Group**: All Trips sharing the same Date on a Page, numbered 1..4.
_Avoid_: Daily batch

### Fuel & Distance

**Fuel Economy**: Kilometres per litre for a Day Group, propagated forward until explicitly overridden; fallback 10.5 km/L.
_Avoid_: Mileage, efficiency

**Adjusted Fuel Economy**: A Day Group where Fuel Economy has an explicit override (stored per Page+Day, stepped ±0.1 from existing value, rounded to 1 decimal, clamped 0.1–50); rendered with an "Adjusted" badge; reverting to the inherited value deletes the override so the badge disappears and the Day inherits again.
_Avoid_: Custom economy, edited economy

**Fuel Position**: Fuel balance carried from the previous Day Group's Closing Balance; Page N+1 Day 1 inherits Page N's final Closing Balance.
_Avoid_: Opening fuel, previous balance

**In-Tank Fuel**: Fuel physically in the tank at the start of a Day Group before any Drawn fuel, default 0 unless typed.
_Avoid_: On-hand fuel, carried fuel

**Drawn Fuel**: Fuel pumped on the day, recorded per Trip as Fuel Pumped Amount with Fuel Order No.
_Avoid_: Filled fuel, pumped quantity

**Consumed Fuel**: Fuel used on the day, calculated as Distance / Fuel Economy, rounded to 1 decimal.
_Avoid_: Usage, burn

**Closing Balance**: Fuel remaining at end of a Day Group, calculated as Position + In-Tank + Drawn − Consumed, rounded to 1 decimal.
_Avoid_: Ending balance, remainder

**Integer KM**: Odometer values (Start KM, End KM, Trip Distance) stored and displayed as whole kilometres with no decimals (decimal input is rounded on blur/save, `numFmt '0'` in Excel); fuel values retain 1 decimal for consumption/balance maths.
_Avoid_: Decimal odometer, 1-dec km

**Page-Wide Trip Sequence**: Derived continuous numbering 1..N per Page across Day Groups for Ledger display (not stored, recomputed from chronological sort), replacing per-day trip_index; All Trips global sequence is separate 1..T chronologically across the Book.
_Avoid_: Day-local index, stored seq

**KM Gap**: Odometer discontinuity where a Page's End KM ≠ next Page's Start KM, or a Trip's End KM ≠ next Trip's Start KM (chronological sort); rendered in RED near the next Page/Trip's Start KM and as inline RED cell highlight.
_Avoid_: Mileage gap, odometer mismatch

**Fuel Gap**: Fuel discontinuity where a Page's End Fuel Balance ≠ next Page's Start Fuel Balance (or trip-implied fuel stock gap per Day Group); rendered in AMBER/ORANGE distinct from KM Gap, near next Page's Start Fuel and as inline AMBER cell highlight.
_Avoid_: Fuel mismatch, tank gap

### Auth & Access

**Super Admin**: The single bootstrap account (Neranjan) authenticated by password, must change password on first login, and solely manages the Allowed Email list.
_Avoid_: Admin, owner

**Allowed Email**: A Gmail address on the SSO allow-list defined by the Super Admin; only these addresses can sign in via Google OAuth, others see only the Landing page.
_Avoid_: Whitelisted user, approved account

**Landing**: The public unauthenticated entry page showing login (Super Admin password + Google SSO) and no ledger data.
_Avoid_: Homepage, login screen

**Landing Gate**: Strict auth guard where every route except Landing hard-redirects to Landing when unauthenticated, before any ledger or vehicle data fetch; no flash of data, session expiry also redirects with toast.
_Avoid_: Soft gate, lazy redirect

### UX & Operations

**Help Page**: Authenticated reference at `/help` explaining trip entry reciprocals, pagination rules, fuel formulas, import template, and auth roles.
_Avoid_: Guide, docs

**Trip Import**: Bulk creation of Trips from an Excel file validated pre-flight against essential fields and pagination rules before any write.
_Avoid_: Data import, upload

**Estimated Start Time**: Suggested Start Time derived as End Time − (Distance / 20 km/h), ceiled to the nearest 5 minutes; auto-filled only when Start Time is empty and editable.
_Avoid_: Calculated start, inferred start

**Global Search**: (Removed) Header search that previously live-filtered all Trips. Search is now available only within the All Trips Master Table section.
_Avoid_: Finder, lookup

**Continuity Break**: A ledger gap where Page N End KM ≠ Page N+1 Start KM or End Fuel Balance ≠ next Start Fuel Balance, surfaced as an alert banner with optional recalculation.
_Avoid_: Mismatch, discontinuity error

**Continuity Alert**: Persistent, non-dismissible banner/drawer listing every KM Gap (RED) and Fuel Gap (AMBER) at Page-to-Page and Trip-to-Trip levels; survives refresh, shows expected vs actual and jump-to-page/trip links, clears only when gaps are fixed or missing records are added to close them (no auto-recalc). Dashboard shows a compact alert bar ("Continuity Gaps Detected") with a "View All Trips" link; All Trips and Ledger pages show the full detailed alert.
_Avoid_: Toast alert, dismissible warning

**All Trips Workbook**: Excel file named per All Trips table with Sheet "All Trips" and header row `Date | Start KM | End KM | Distance | Start Time | End Time | Type | Places Visited | Fuel Pumped | Fuel Order No` (case-insensitive, order-enforced); export writes that sheet, import validates pre-flight and appends chronologically without overwriting.
_Avoid_: Book-Mirror sheet, generic export

**Transposed Side 2**: Side 2 Fuel Economy & Position tables rendered with days as columns to mirror the physical book's landscape layout, matching Side 1 column orientation.
_Avoid_: Rotated tables, flipped view

**Ledger Full-Width Stack**: Ledger Page View layout where Table 1 (Trips Log) occupies full width on top, with Table 2 (Fuel Economy & Consumption) and Table 3 (Fuel Position & Balance) stacked full-width beneath it, replacing the dual-column Side 1 / Side 2 folio; print and responsive rules preserve this stack.
_Avoid_: Side-by-side folio, two-column ledger
