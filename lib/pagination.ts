/**
 * Pagination, Page-Rollover & Continuity Engine
 * Pure functions enforcing physical book constraints:
 * - Max 4 days per page
 * - Max 13 trips per day
 * - New month forces new page
 * - Cross-page odometer & fuel continuity
 */
import type { BookPage, Trip } from '@/types';
import { roundToOneDecimal, roundToIntegerKm } from './tripCalculations';

export const MAX_DAYS_PER_PAGE = 4;
export const MAX_TRIPS_PER_DAY = 13;

// ---------------------------------------------------------------------------
// Date / pagination helpers
// ---------------------------------------------------------------------------

export function getMonthKey(dateStr: string): string {
  // Expect YYYY-MM-DD, slice first 7 chars -> YYYY-MM
  return dateStr.slice(0, 7);
}

export function getDistinctDates(trips: Trip[]): string[] {
  const set = new Set<string>();
  for (const t of trips) set.add(t.date);
  return Array.from(set).sort();
}

export function countTripsForDate(trips: Trip[], date: string): number {
  let c = 0;
  for (const t of trips) if (t.date === date) c++;
  return c;
}

// ---------------------------------------------------------------------------
// Fuel calculations (rounded to 1 decimal)
// ---------------------------------------------------------------------------

export function calculateConsumed(distance: number, economy: number): number {
  if (!economy || economy <= 0 || !distance || distance <= 0) return 0;
  return roundToOneDecimal(distance / economy);
}

export function calculateBalance(previousBalance: number, drawn: number, consumed: number): number {
  return roundToOneDecimal(previousBalance + drawn - consumed);
}

// ---------------------------------------------------------------------------
// Page boundary validation
// ---------------------------------------------------------------------------

export interface ValidateResult {
  allowed: boolean;
  requiresNewPage: boolean;
  reason?: 'MAX_DAYS' | 'MONTH_ROLLOVER' | 'MAX_TRIPS_PER_DAY' | 'NEW_BOOK';
}

export function validateTripForPage(
  tripsOnCurrentPage: Trip[],
  currentPage: BookPage,
  newTripDate: string
): ValidateResult {
  const countForDate = countTripsForDate(tripsOnCurrentPage, newTripDate);
  if (countForDate >= MAX_TRIPS_PER_DAY) {
    return { allowed: false, requiresNewPage: false, reason: 'MAX_TRIPS_PER_DAY' };
  }

  const newMonth = getMonthKey(newTripDate);
  if (newMonth !== currentPage.month) {
    return { allowed: true, requiresNewPage: true, reason: 'MONTH_ROLLOVER' };
  }

  const distinct = getDistinctDates(tripsOnCurrentPage);
  const isNewDistinctDay = !distinct.includes(newTripDate);
  if (isNewDistinctDay && distinct.length >= MAX_DAYS_PER_PAGE) {
    return { allowed: true, requiresNewPage: true, reason: 'MAX_DAYS' };
  }

  return { allowed: true, requiresNewPage: false };
}

// ---------------------------------------------------------------------------
// Continuity checks
// ---------------------------------------------------------------------------

export interface ContinuityResult {
  isValid: boolean;
  breaks: Array<{ pageNumber: number; expected: number; actual: number }>;
}

function sortedPages(pages: BookPage[]): BookPage[] {
  return [...pages].sort((a, b) => a.page_number - b.page_number);
}

export function validateOdometerContinuity(pages: BookPage[]): ContinuityResult {
  const sorted = sortedPages(pages);
  const breaks: ContinuityResult['breaks'] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const cur = sorted[i];
    const next = sorted[i + 1];
    const expected = roundToIntegerKm(cur.end_km);
    const actual = roundToIntegerKm(next.start_km);
    if (expected !== actual) {
      breaks.push({ pageNumber: next.page_number, expected, actual });
    }
  }
  return { isValid: breaks.length === 0, breaks };
}

export function validateFuelContinuity(pages: BookPage[]): ContinuityResult {
  const sorted = sortedPages(pages);
  const breaks: ContinuityResult['breaks'] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const cur = sorted[i];
    const next = sorted[i + 1];
    const expected = roundToOneDecimal(cur.end_fuel_balance);
    const actual = roundToOneDecimal(next.start_fuel_balance);
    if (expected !== actual) {
      breaks.push({ pageNumber: next.page_number, expected, actual });
    }
  }
  return { isValid: breaks.length === 0, breaks };
}

export function getNextPageStartKm(pages: BookPage[], fallbackOdometer: number): number {
  if (pages.length === 0) return roundToIntegerKm(fallbackOdometer);
  const sorted = sortedPages(pages);
  return roundToIntegerKm(sorted[sorted.length - 1].end_km);
}

export function getNextPageStartFuel(pages: BookPage[], fallbackFuel: number): number {
  if (pages.length === 0) return roundToOneDecimal(fallbackFuel);
  const sorted = sortedPages(pages);
  return roundToOneDecimal(sorted[sorted.length - 1].end_fuel_balance);
}

// ---------------------------------------------------------------------------
// Page assignment integration
// ---------------------------------------------------------------------------

export interface PageAssignment {
  pageNumber: number;
  pageId: string;
  dayIndex: number;
  tripIndex: number;
  requiresNewPage: boolean;
  reason?: 'MAX_DAYS' | 'MONTH_ROLLOVER' | 'NEW_BOOK';
}

export type AssignResult =
  | PageAssignment
  | { allowed: false; reason: 'MAX_TRIPS_PER_DAY'; pageNumber?: number; dayIndex?: number; tripIndex?: number };

function tripsForPage(trips: Trip[], pageId: string): Trip[] {
  return trips.filter((t) => t.page_id === pageId);
}

function getCurrentPage(pages: BookPage[]): BookPage | null {
  if (pages.length === 0) return null;
  const sorted = sortedPages(pages);
  return sorted[sorted.length - 1];
}

export function assignPageForNewTrip(params: {
  pages: BookPage[];
  trips: Trip[];
  newTripDate: string;
}): AssignResult {
  const { pages, trips, newTripDate } = params;

  if (pages.length === 0) {
    return {
      pageNumber: 1,
      pageId: `page-1`,
      dayIndex: 1,
      tripIndex: 1,
      requiresNewPage: true,
      reason: 'NEW_BOOK',
    };
  }

  const currentPage = getCurrentPage(pages)!;
  const tripsOnCurrent = tripsForPage(trips, currentPage.id);

  // Check max trips per day first (on current page)
  const countForDate = countTripsForDate(tripsOnCurrent, newTripDate);
  if (countForDate >= MAX_TRIPS_PER_DAY) {
    const distinct = getDistinctDates(tripsOnCurrent);
    // Compute dayIndex for completeness (even when blocked)
    const sortedDistinct = [...distinct].sort();
    if (!sortedDistinct.includes(newTripDate)) {
      // shouldn't happen when blocked, but handle
      sortedDistinct.push(newTripDate);
      sortedDistinct.sort();
    }
    const dayIdx = sortedDistinct.indexOf(newTripDate) + 1;
    return {
      allowed: false,
      reason: 'MAX_TRIPS_PER_DAY',
      pageNumber: currentPage.page_number,
      dayIndex: dayIdx,
      tripIndex: countForDate + 1,
    } as AssignResult;
  }

  const validation = validateTripForPage(tripsOnCurrent, currentPage, newTripDate);

  if (validation.requiresNewPage) {
    const nextPageNumber = currentPage.page_number + 1;
    return {
      pageNumber: nextPageNumber,
      pageId: `page-${nextPageNumber}`,
      dayIndex: 1,
      tripIndex: 1,
      requiresNewPage: true,
      reason: validation.reason as 'MAX_DAYS' | 'MONTH_ROLLOVER',
    };
  }

  // Same page - compute dayIndex and tripIndex
  const distinct = getDistinctDates(tripsOnCurrent);
  const sortedDistinct = [...distinct].sort();
  // If newTripDate not yet in distinct, it will occupy next day slot
  let dayIndex: number;
  if (sortedDistinct.includes(newTripDate)) {
    dayIndex = sortedDistinct.indexOf(newTripDate) + 1;
  } else {
    // new date insertion: find position in chronological order
    const withNew = [...sortedDistinct, newTripDate].sort();
    dayIndex = withNew.indexOf(newTripDate) + 1;
  }

  const tripIndex = countForDate + 1;

  return {
    pageNumber: currentPage.page_number,
    pageId: currentPage.id,
    dayIndex,
    tripIndex,
    requiresNewPage: false,
  };
}
