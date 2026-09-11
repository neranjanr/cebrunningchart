# Fuel closing formula includes In-Tank fuel

Closing Balance is now `Position + In-Tank + Drawn − Consumed`, where In-Tank defaults to 0 per Day Group unless typed on the first Trip of the day (`lib/ledgerCalculations.ts:138`). Position is the prior day's Closing Balance carried forward; Drawn is pumped fuel for the day.

This replaces the previous `position + drawn - consumed` (`lib/pagination.ts:45`) and the `Vehicle.current_fuel_level` profile field (`types/index.ts:10`), which is removed. In-Tank is a day-header input, not per-trip, and is included in continuity checks.

