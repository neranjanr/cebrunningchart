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

**Integer KM**: Odometer values (Start KM, End KM, Trip Distance) stored and displayed as whole kilometres with no decimals; fuel values retain 1 decimal.
_Avoid_: Decimal odometer, 1-dec km

### Auth & Access

**Super Admin**: The single bootstrap account (Neranjan) authenticated by password, must change password on first login, and solely manages the Allowed Email list.
_Avoid_: Admin, owner

**Allowed Email**: A Gmail address on the SSO allow-list defined by the Super Admin; only these addresses can sign in via Google OAuth, others see only the Landing page.
_Avoid_: Whitelisted user, approved account

**Landing**: The public unauthenticated entry page showing login (Super Admin password + Google SSO) and no ledger data.
_Avoid_: Homepage, login screen

### UX & Operations

**Help Page**: Authenticated reference at `/help` explaining trip entry reciprocals, pagination rules, fuel formulas, import template, and auth roles.
_Avoid_: Guide, docs

**Trip Import**: Bulk creation of Trips from an Excel file validated pre-flight against essential fields and pagination rules before any write.
_Avoid_: Data import, upload

**Estimated Start Time**: Suggested Start Time derived as End Time − (Distance / 20 km/h), ceiled to the nearest 5 minutes; auto-filled only when Start Time is empty and editable.
_Avoid_: Calculated start, inferred start

**Global Search**: Header search that live-filters all Trips across all Pages by date, places visited, fuel order no, type, and KM substrings, showing filtered count and summed distances.
_Avoid_: Finder, lookup

**Continuity Break**: A ledger gap where Page N End KM ≠ Page N+1 Start KM or End Fuel Balance ≠ next Start Fuel Balance, surfaced as an alert banner with optional recalculation.
_Avoid_: Mismatch, discontinuity error

**Transposed Side 2**: Side 2 Fuel Economy & Position tables rendered with days as columns to mirror the physical book's landscape layout, matching Side 1 column orientation.
_Avoid_: Rotated tables, flipped view
