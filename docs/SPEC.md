# Running Chart Web Application - Specification

**Author:** Neranjan Rathnayake (github.com/neranjanr)  
**Credits:** OpenCode, Alacrity, MattPocock tools, Gemini, DeepSeek, and other stacks used in this app.

## Problem Statement

Fleet operators, drivers, and transport managers who maintain physical running chart logbooks face tedious manual arithmetic, high risk of odometer and fuel continuity errors across pages and month boundaries, lack real-time digital visibility into official vs. private mileage breakdowns, and struggle with laborious transcription when auditing or generating reports.

## Solution

A high-fidelity digital web application counterpart to the physical running chart logbook. It features Google Sign-In, vehicle profiling, quick trip data entry with smart reciprocal calculations (End KM ⟷ Trip Distance, End/Start Time ⟷ Trip Duration), automatic fuel economy propagation, dual-side physical book ledger views (Side 1 Trips Log + Side 2 Fuel Economy & Position Tables), a dedicated Dashboard & Analytics tab, a scrollable All Trips Master Table, and a book-mirror Excel export (.xlsx) capability.

## User Stories

1. As a driver, I want to authenticate using my Google account, so that my running chart data is securely associated with my profile.
2. As a transport manager, I want to create and configure a vehicle profile (Brand, Model, Type, Fuel Type, Tank Capacity), so that all logs adhere to specific vehicle specifications.
3. As a driver, I want the system to auto-select today's date and display the corresponding day of the week, so that I don't have to manually look up calendar days.
4. As a driver, I want the Start KM of a new trip to automatically default to the last recorded End KM in the database with visual highlighting, so that odometer continuity is never broken.
5. As a driver, I can manually override the Start KM if needed with clear visual indication, so that exceptional adjustments can be recorded.
6. As a driver, when I enter the Trip End KM, the system should automatically calculate the Trip Distance, and vice versa, so that manual math errors are prevented.
7. As a driver, when entering trip times, the End Time defaults to the current time, and entering Trip Duration automatically computes the Start Time, or entering Start Time calculates the Duration.
8. As a driver, I want to classify each trip as Official (default) or Private, so that official duties and private milages are distinctly tracked.
9. As a driver, I want to record places visited (route/purpose) and optional fuel pumped amount along with its Fuel Order Number and date, so that fuel inflows are tracked per trip.
10. As the system, I want to enforce strict physical book constraints (maximum 4 days per page, maximum 13 trips per day, and a new calendar month always forcing a new page), so that digital records mirror physical logbooks perfectly.
11. As a transport auditor, I want to view the dual-page physical book ledger (Side 1: Trips Log table, Side 2: Fuel Economy & Consumption + Fuel Position & Balance tables) with page navigation, so that I can inspect logs exactly as they appear in the physical book.
12. As a transport auditor, I want the system to automatically calculate daily fuel economy (km/L), propagate default economy values to subsequent days until modified, and compute fuel consumed and closing balance rounded to 1 decimal place.
13. As a transport auditor, I want End KM of Page N to automatically equal Start KM of Page N+1, and End Fuel Balance of Page N to equal Fuel Position of Page N+1 Day 1, so that strict ledger continuity is maintained.
14. As a manager, I want a dedicated Dashboard & Analytics tab showing current month Official KM, Private KM, Total KM, estimated fuel level, monthly breakdown charts with numerical values displayed for official and private km, and page-wise distance visualization.
15. As a manager, I want a scrollable All Trips Master Table to inspect, filter, and search all historical trips across all pages.
16. As a manager, I want to export running chart records and summaries to Excel (.xlsx) as a structured single sheet mirroring the physical book layout, so that I can easily print or archive records.
17. As a user, when I select any date in the date picker, the app should instantly show the correct day of the week.

## Implementation Decisions

- **Framework & Architecture:** Built with Next.js (App Router) and TypeScript, utilizing Tailwind CSS with a custom design system mirroring the physical ledger aesthetic (`sample ui.html`).
- **Backend & Database:** Supabase for PostgreSQL database management and Google OAuth authentication.
- **Pagination & Continuity Engine:** Client-side and server-side state logic enforcing the 4-day spread and 13 trips/day limits, automatic page rollover on month changes, and strict odometer/fuel carry-forward formulas.
- **Calculation Logic:** Reciprocal calculations for odometer (Start + Distance = End) and time (End - Duration = Start), with all values rounded to 1 decimal point. Fuel economy propagates forward until explicitly overridden.
- **Design Tokens:** Leveraged custom Tailwind colors (`paper-sheet`, `paper-ledger`, `slate-surface`, `telemetry-cyan`, `trip-official`, `trip-private`, etc.) and typography (Inter and JetBrains Mono for odometer/ledger cells).

## Testing Decisions

- **Test Scope:** Focus testing on external behavior of critical calculation engines, boundary validations, and continuity rules rather than internal implementation details.
- **Key Modules Tested:**
  - Odometer reciprocal math & boundary checks (max 4 days / 13 trips).
  - Time & duration reciprocal calculation logic.
  - Fuel economy propagation and balance consumption formulas (rounded to 1 decimal place).
  - Cross-page Odometer and Fuel carry-forward continuity (Page N End = Page N+1 Start).
- **Prior Art:** Existing web ledger and financial auditing calculation test patterns.

## Out of Scope

- Multi-tenant enterprise fleet dispatching and GPS hardware telemetry tracking.
- Native offline-first mobile app binaries (PWA web deployment is supported).
- Multi-currency fuel cost accounting (liters and fuel order numbers are tracked as specified).

## Further Notes

- To publish this specification to a local or remote issue tracker with triage labels, run `/setup-matt-pocock-skills` in your agent environment.
- The UI design strictly mirrors the layout defined in `docs/sample ui.html`.
