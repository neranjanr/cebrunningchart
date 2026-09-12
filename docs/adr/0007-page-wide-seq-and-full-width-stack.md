# Page-Wide Trip Sequence and Full-Width Ledger Stack

Ledger Page View drops the dual-column folio (`grid xl:grid-cols-2`) for a single-column `grid-cols-1` stack: Table 1 (Trips Log) full-width on top, Table 2 (Fuel Economy & Consumption) full-width, Table 3 (Fuel Position & Balance) full-width beneath. Trips `#` is a derived continuous sequence 1..N per Page across Day Groups (not stored, recomputed as `flatMap dayGroups` sorted), replacing per-day 1..13 display; All Trips global sequence 1..T remains separate.

Considered persisting `page_seq` in DB — rejected; derived keeps `trip_index` per-day invariant (4/13/month) untouched and avoids migration. Considered keeping side-by-side for print — rejected; full-width improves scan and matches "place table 2 and 3 below that full width" request.

