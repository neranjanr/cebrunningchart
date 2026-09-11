# Running Chart Web Application - Specification

**Author:** Neranjan Rathnayake (github.com/neranjanr)  
**Credits:** OpenCode, Alacrity, MattPocock tools, Gemini, DeepSeek, and other stacks used in this app.

## 1. Overview
A digital counterpart to a physical running chart logbook with a dedicated dashboard, analytics, unified trip history, vehicle profiling, Google authentication, and book-mimicking Excel export.

---

## 2. Core Data Models

### A. Vehicle Profile
- **Fields:** Vehicle Brand, Model, Vehicle Type, Fuel Type, Current Odometer, Current Fuel Level.

### B. Trip Record (Side 1 of Book Page)
- **Constraints:** Up to 4 days per page, up to 13 trips per day. New month forces a new page.
- **Fields:**
  - `Date` (Auto-selected today, editable; app automatically displays the day of the week, e.g., Monday).
  - `Day Index` (1 to 4)
  - `Trip Index` (1 to 13 per day)
  - `Start Time` (Default: now - 1 hr, editable)
  - `End Time` (Default: now, editable)
  - `Start KM` (Default: last KM in DB, highlighted if manually overridden)
  - `End KM` / `Trip Distance` (Reciprocal calculation: entering one computes the other)
  - `Trip Type` (Official [Default] or Private)
  - `Places Visited`
  - `Fuel Pumped Amount` & `Fuel Order No` (optional per trip)

### C. Fuel Economy & Consumption (Side 2 - Table 1)
- **Fields:**
  - `Date / Day` (1 to 4)
  - `Start KM of Day`, `End KM of Day`, `Distance Travelled`
  - `Fuel Economy (km/liter)`: Entered manually per day. Defaults to previous day's value (or last entered value). If modified, the new value propagates to subsequent days until changed again. Rounded to 1 decimal place.

### D. Fuel Position & Balance (Side 2 - Table 2)
- **Fields:**
  - `Fuel Position`: Fuel level left at start of day (Page N Day 1 start fuel = Page N-1 end fuel balance).
  - `In-Tank Gallon`: Available fuel in tank.
  - `Drawn`: Pumped amount.
  - `Fuel Order No & Date` (if pumped).
  - `Consumed Amount`: Calculated as (Distance Travelled on day / Fuel Economy).
  - `Balance`: Calculated fuel balance at end of day (rounded to 1 decimal place).

---

## 3. Pagination & Continuity Rules
- **Page Boundaries:** Maximum 4 days per page; maximum 13 trips per day. A new month always starts on a fresh page.
- **Odometer Continuity:** End KM of Page $N$ = Start KM of Page $N+1$.
- **Fuel Continuity:** End fuel balance of Page $N$ = Fuel position of Page $N+1$ (Day 1 start).
- **Rounding:** All distances, fuel amounts, and calculations are rounded to 1 decimal point.

---

## 4. Application Views & Pages

### 1. Dashboard / Reports Tab
- **Summary Metric Cards:** Current month Official KM | Private KM | Total KM. Current Mileage & Estimated Fuel Level.
- **Monthly Analytics:** Monthly Official, Private, and Total KM breakdown table and graphical chart.
- **Page-wise Visualization:** Distance per book page visualization chart/bars.
- **Additional Indicators:** Average fuel economy (km/L), total fuel pumped this month, cost/efficiency estimates.
- **Date helper:** Selecting any date instantly displays the corresponding day of the week.

### 2. Trip Entry Page
- Form with auto-defaults (Date + day of week, End Time = current time, Start KM from last DB record with highlight).
- Reciprocal calculation between End KM and Trip Distance.
- Reciprocal time calculation: End Time defaults to current time; entering Trip Duration calculates Start Time (End Time - Duration), and entering Start Time calculates Trip Duration.
- Official/Private selector (Default: Official).
- Fuel drawn amount & fuel order number fields.

### 3. All Trips Summary Page
- A unified, scrollable table view listing all recorded trips across pages with sorting and filtering options.

### 4. Book Pages View
- Visual dual-side layout mimicking the physical book (Trip log table on left, Fuel Economy & Fuel Position tables on right) with page-flipping navigation.

### 5. Vehicle Profile & Settings
- Manage vehicle brand, model, type, and fuel type.

### 6. Authentication & Export
- Google Sign-On authentication.
- Export to Excel as a structured single sheet mirroring the physical book layout.
