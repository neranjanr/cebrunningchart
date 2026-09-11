/**
 * Ledger Calculations - pure functions for Dual-Side Physical Book Ledger View (Issue 6)
 * Seams:
 * - Fuel economy propagation (forward until overridden) rounded to 1 decimal
 * - Consumption & balance formulas (rounded to 1 decimal)
 * - Daily aggregation from trips
 */
import type { BookPage, Trip } from '@/types';
import { roundToOneDecimal } from './tripCalculations';
import { calculateConsumed, calculateBalance, getDistinctDates } from './pagination';

export const DEFAULT_FUEL_ECONOMY = 10.5;

export interface LedgerDay {
  dayIndex: number; // 1..4
  date: string; // YYYY-MM-DD
  dayLabel: string; // e.g., "Mon 21 Oct"
  startKm: number;
  endKm: number;
  distance: number;
  fuelEconomy: number;
  economySource: 'explicit' | 'inherited' | 'fallback';
  fuelPosition: number;
  drawn: number;
  fuelOrderNo: string; // aggregated, empty if none
  fuelOrderDate: string; // date of first drawn entry if any
  consumed: number;
  balance: number;
}

export interface LedgerSummary {
  totalDistance: number;
  totalDrawn: number;
  totalConsumed: number;
  finalBalance: number;
  weightedEconomy: number; // totalDistance / totalConsumed rounded 1 dec, or 0
}

/**
 * Propagate fuel economy forward.
 * - raw: array per day in chronological order, null/undefined means inherit.
 * - fallback: economy to use if first entry is missing.
 * Values rounded to 1 decimal.
 */
export function propagateFuelEconomy(
  raw: (number | null | undefined)[],
  fallback: number = DEFAULT_FUEL_ECONOMY
): number[] {
  const normalizedFallback = roundToOneDecimal(fallback);
  const result: number[] = [];
  let current = normalizedFallback;
  let hasExplicitBefore = false;
  // If first raw is explicit, use it; else use fallback
  for (let i = 0; i < raw.length; i++) {
    const v = raw[i];
    if (v !== null && v !== undefined && !isNaN(Number(v)) && Number(v) > 0) {
      current = roundToOneDecimal(Number(v));
      hasExplicitBefore = true;
      result.push(current);
    } else {
      // No override on this day -> inherit previous
      // If no explicit before and i==0, current is fallback already
      result.push(roundToOneDecimal(current));
    }
  }
  return result;
}

export function getTripsForPage(trips: Trip[], pageId: string): Trip[] {
  return trips.filter((t) => t.page_id === pageId);
}

function shortDayLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const daysShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${daysShort[date.getDay()]} ${d} ${monthsShort[m - 1]}`;
}

export function computeLedgerDays(params: {
  page: BookPage;
  trips: Trip[];
  economies?: (number | null | undefined)[];
  fallbackEconomy?: number;
}): LedgerDay[] {
  const { page, trips, economies, fallbackEconomy } = params;
  const tripsForPage = getTripsForPage(trips, page.id);
  if (tripsForPage.length === 0) return [];

  const distinctDates = getDistinctDates(tripsForPage); // sorted

  // Map raw economies to distinctDates order
  // If economies length != distinct length, slice/pad with nulls
  const raw: (number | null | undefined)[] = [];
  for (let i = 0; i < distinctDates.length; i++) {
    if (economies && i < economies.length) raw.push(economies[i]);
    else raw.push(null);
  }

  const propagated = propagateFuelEconomy(raw, fallbackEconomy ?? DEFAULT_FUEL_ECONOMY);

  const days: LedgerDay[] = [];
  let prevBalance = roundToOneDecimal(page.start_fuel_balance);

  for (let i = 0; i < distinctDates.length; i++) {
    const date = distinctDates[i];
    const dayTrips = tripsForPage
      .filter((t) => t.date === date)
      .sort((a, b) => a.trip_index - b.trip_index || a.start_km - b.start_km);

    // Determine start/end km from trip sequence (1-decimal)
    const startKm = roundToOneDecimal(dayTrips[0].start_km);
    const endKm = roundToOneDecimal(dayTrips[dayTrips.length - 1].end_km);
    const distance = roundToOneDecimal(
      dayTrips.reduce((sum, t) => sum + roundToOneDecimal(t.trip_distance), 0)
    );
    // Alternative: end - start; but trips may have gaps? Use sum for robustness. Both should match continuous trips.
    // For validation, use sum; spec example matches sum.

    const econ = propagated[i];
    const rawVal = raw[i];
    let economySource: LedgerDay['economySource'];
    if (rawVal !== null && rawVal !== undefined && Number(rawVal) > 0) economySource = 'explicit';
    else if (i === 0 && (rawVal === null || rawVal === undefined) && fallbackEconomy !== undefined) economySource = 'fallback';
    else if (i === 0 && (rawVal === null || rawVal === undefined)) economySource = 'fallback';
    else economySource = 'inherited';

    const drawn = roundToOneDecimal(
      dayTrips.reduce((sum, t) => sum + roundToOneDecimal(t.fuel_pumped_amount ?? 0), 0)
    );
    const orderNos = dayTrips
      .filter((t) => t.fuel_order_no && t.fuel_order_no.trim() !== '')
      .map((t) => t.fuel_order_no!.trim());
    const fuelOrderNo = orderNos.join(', ');
    const fuelOrderDate = drawn > 0 ? date : '';

    const fuelPosition = roundToOneDecimal(prevBalance);
    const consumed = calculateConsumed(distance, econ);
    const balance = calculateBalance(fuelPosition, drawn, consumed);

    days.push({
      dayIndex: i + 1,
      date,
      dayLabel: shortDayLabel(date),
      startKm,
      endKm,
      distance,
      fuelEconomy: econ,
      economySource,
      fuelPosition,
      drawn,
      fuelOrderNo,
      fuelOrderDate,
      consumed,
      balance,
    });

    prevBalance = balance;
  }

  return days;
}

export function computeLedgerSummary(days: LedgerDay[]): LedgerSummary {
  if (days.length === 0) {
    return {
      totalDistance: 0,
      totalDrawn: 0,
      totalConsumed: 0,
      finalBalance: 0,
      weightedEconomy: 0,
    };
  }
  const totalDistance = roundToOneDecimal(days.reduce((s, d) => s + d.distance, 0));
  const totalDrawn = roundToOneDecimal(days.reduce((s, d) => s + d.drawn, 0));
  const totalConsumed = roundToOneDecimal(days.reduce((s, d) => s + d.consumed, 0));
  const finalBalance = roundToOneDecimal(days[days.length - 1].balance);
  const weightedEconomy =
    totalConsumed > 0 ? roundToOneDecimal(totalDistance / totalConsumed) : 0;
  return {
    totalDistance,
    totalDrawn,
    totalConsumed,
    finalBalance,
    weightedEconomy,
  };
}

/**
 * Group trips by date for Side 1 rendering (includes per-day subtotals)
 */
export interface DayGroup {
  date: string;
  dayLabel: string;
  dayIndex: number;
  trips: Trip[];
  startKm: number;
  endKm: number;
  distance: number;
  officialKm: number;
  privateKm: number;
}

export function groupTripsByDateForSide1(trips: Trip[], pageId: string): DayGroup[] {
  const forPage = getTripsForPage(trips, pageId);
  if (forPage.length === 0) return [];
  const distinct = getDistinctDates(forPage);
  return distinct.map((date, idx) => {
    const dayTrips = forPage
      .filter((t) => t.date === date)
      .sort((a, b) => a.trip_index - b.trip_index);
    const startKm = roundToOneDecimal(dayTrips[0].start_km);
    const endKm = roundToOneDecimal(dayTrips[dayTrips.length - 1].end_km);
    const distance = roundToOneDecimal(dayTrips.reduce((s, t) => s + roundToOneDecimal(t.trip_distance), 0));
    const officialKm = roundToOneDecimal(
      dayTrips.filter((t) => t.trip_type === 'Official').reduce((s, t) => s + roundToOneDecimal(t.trip_distance), 0)
    );
    const privateKm = roundToOneDecimal(
      dayTrips.filter((t) => t.trip_type === 'Private').reduce((s, t) => s + roundToOneDecimal(t.trip_distance), 0)
    );
    return {
      date,
      dayLabel: shortDayLabel(date),
      dayIndex: idx + 1,
      trips: dayTrips,
      startKm,
      endKm,
      distance,
      officialKm,
      privateKm,
    };
  });
}
