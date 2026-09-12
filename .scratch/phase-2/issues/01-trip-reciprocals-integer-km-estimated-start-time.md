# 01: Trip Reciprocals, Integer KM & Estimated Start Time

**What to build:** Make the Trip entry form store and display odometer as Integer KM (no decimals), keep fuel at 1 decimal, auto-suggest Estimated Start Time as End Time − (Trip Distance / 20 km/h) ceiled to nearest 5 minutes only when Start Time is empty, provide an explicit Auto button to recompute on demand, default End Time to now (overrideable), and allow saving a Trip without Start Time. End-to-end: user enters End KM → Distance integer auto-derived, enters End Time + Distance → Start Time suggested, can override or leave blank, saves, sees persisted integer KM on reload. Parent: #9

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Start KM, End KM, Trip Distance round and display as integers; fuel values still 1 decimal; existing 1-dec rows migrated by round
- [ ] Distance computed as round(end − start); entering End KM derives Distance and vice versa
- [ ] Estimated Start Time computed as ceil((distance/20)*60 /5)*5 only when Start Time empty; Auto button recomputes even when filled; manual edits never auto-clobbered
- [ ] End Time defaults to present time on form load and remains overrideable; empty Start Time persists as null/"" and does not block save
- [ ] Tests at the Trip calculation seam cover integer reciprocals, ceiling cases (e.g., 27→30, exact 20→20, 0→no estimate), and nullable Start Time

