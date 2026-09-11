# Chronological page renumbering on retroactive insertion

When a Trip is inserted with a date earlier than the current earliest Page (e.g., book starts 2026-01-01 at 50,000 km page 1, then 2025-01-01 data arrives), we sort all Pages chronologically and renumber 1..N sequentially, cascading `page_number`, `page_id` (`page-<n>`) and `Trip.page_id` references, keeping dates immutable and recalculating fuel balances forward from the Book Opening.

Considered reserving a gap (old page 1 → 100+) to preserve old print numbers, but gaps break `validateOdometerContinuity`/`validateFuelContinuity` (`lib/pagination.ts:96`) and confuse Excel export and pagination maths. A configurable print offset can be added later if needed.

