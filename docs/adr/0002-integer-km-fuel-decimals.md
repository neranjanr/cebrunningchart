# Integer kilometres, 1-decimal fuel

Odometer values (Start KM, End KM, Trip Distance) are stored and displayed as whole kilometres with no decimal points; fuel values (Position, In-Tank, Drawn, Consumed, Closing Balance, Economy) remain rounded to 1 decimal.

The original spec (`docs/SPEC.md:39`, `lib/tripCalculations.ts:6` `roundToOneDecimal`) used 1-decimal KM to mirror odometer tenths, but Phase 2 stakeholders require book-matching integers. Existing 1-dec rows will be migrated by `Math.round`; distance remains `end - start` integer, reciprocal calcs (`lib/tripCalculations.ts:10`) switch to integer.

