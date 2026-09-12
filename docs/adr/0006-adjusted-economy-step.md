# Adjusted Fuel Economy — ±0.1 step, badge, and revert-by-inherited

Fuel Economy per Day Group is stepped ±0.1 from the existing displayed value (not from 0), clamped 0.1–50 and rounded to 1 decimal (`lib/fuelEconomyStore.ts`, `lib/ledgerCalculations.ts:46 propagateFuelEconomy`). A Day Group with an explicit override (`economySource==='explicit'`) shows an "Adjusted" badge with × clear; typing the inherited value auto-deletes the override so the badge disappears and the day re-inherits and recomputes downstream `Consumed`/`Balance`.

Considered stepping from 0 or using a dropdown of presets — rejected because user explicitly requires incremental tuning from current value (e.g., 8→7→6→7). Considered persisting Adjusted as a separate boolean flag — rejected; derived from `raw[dayIdx]!=null && raw!=inherited` keeps store minimal.

