/**
 * Dashboard Analytics - pure functions for Issue 7
 * Seams:
 * - Summary metric cards (Official, Private, Total KM, estimated fuel level)
 * - Monthly breakdown (Official/Private/Total per YYYY-MM)
 * - Page-wise distance visualization
 * - All Trips Master Table filter/search/sort
 */
import type { BookPage, Trip, Vehicle } from '@/types';
import { roundToOneDecimal } from './tripCalculations';

export interface DashboardMetrics {
  officialKm: number;
  privateKm: number;
  totalKm: number;
  tripCount: number;
  fuelLevel: number;
  tankCapacity: number;
  fuelLevelPercent: number;
}

export interface MonthlyBreakdown {
  monthKey: string; // YYYY-MM
  monthLabel: string; // e.g., "Oct 2024"
  officialKm: number;
  privateKm: number;
  totalKm: number;
  tripCount: number;
  fuelDrawn: number;
  pageCount: number;
}

export interface PageDistance {
  pageNumber: number;
  month: string;
  monthLabel: string;
  distance: number;
  officialKm: number;
  privateKm: number;
  tripCount: number;
}

export type SortColumn = 'date' | 'start_km' | 'end_km' | 'trip_distance' | 'trip_type' | 'places_visited' | 'fuel_pumped_amount';
export type SortDirection = 'asc' | 'desc';

export interface FilterOptions {
  search?: string;
  tripType?: 'All' | 'Official' | 'Private';
  month?: string; // YYYY-MM or 'All'
  sortColumn?: SortColumn;
  sortDirection?: SortDirection;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMonthLabel(monthKey: string): string {
  if (!monthKey || !monthKey.includes('-')) return monthKey;
  const [y, m] = monthKey.split('-');
  const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const idx = parseInt(m, 10) - 1;
  return `${monthsShort[idx] ?? m} ${y}`;
}

function sumDistance(trips: Trip[]): number {
  return roundToOneDecimal(trips.reduce((s, t) => s + roundToOneDecimal(t.trip_distance), 0));
}



// ---------------------------------------------------------------------------
// Summary metric cards
// ---------------------------------------------------------------------------

export function computeDashboardMetrics(params: {
  trips: Trip[];
  vehicle: Vehicle | null;
  pages?: BookPage[];
}): DashboardMetrics {
  const { trips, vehicle, pages } = params;
  const officialKm = roundToOneDecimal(
    trips.filter((t) => t.trip_type === 'Official').reduce((s, t) => s + roundToOneDecimal(t.trip_distance), 0)
  );
  const privateKm = roundToOneDecimal(
    trips.filter((t) => t.trip_type === 'Private').reduce((s, t) => s + roundToOneDecimal(t.trip_distance), 0)
  );
  const totalKm = roundToOneDecimal(officialKm + privateKm);
  const tripCount = trips.length;

  let fuelLevel: number;
  if (pages && pages.length > 0) {
    const last = [...pages].sort((a, b) => a.page_number - b.page_number)[pages.length - 1];
    fuelLevel = roundToOneDecimal(last.end_fuel_balance);
  } else if (vehicle) {
    fuelLevel = roundToOneDecimal(vehicle.current_fuel_level ?? 0);
  } else {
    fuelLevel = 0;
  }
  const tankCapacity = vehicle ? roundToOneDecimal(vehicle.tank_capacity ?? 0) : 0;
  const fuelLevelPercent = tankCapacity > 0 ? roundToOneDecimal(Math.min(100, Math.max(0, (fuelLevel / tankCapacity) * 100))) : 0;

  return { officialKm, privateKm, totalKm, tripCount, fuelLevel, tankCapacity, fuelLevelPercent };
}

export function computeMetricsForMonth(trips: Trip[], vehicle: Vehicle | null, monthKey: string, pages?: BookPage[]): DashboardMetrics {
  const filtered = trips.filter((t) => t.date.slice(0, 7) === monthKey);
  return computeDashboardMetrics({ trips: filtered, vehicle, pages });
}

// ---------------------------------------------------------------------------
// Monthly breakdown
// ---------------------------------------------------------------------------

export function computeMonthlyBreakdown(params: { trips: Trip[]; pages: BookPage[] }): MonthlyBreakdown[] {
  const { trips, pages } = params;
  const monthKeys = new Set<string>();
  for (const t of trips) monthKeys.add(t.date.slice(0, 7));
  for (const p of pages) monthKeys.add(p.month);
  const sortedKeys = Array.from(monthKeys).sort();

  return sortedKeys.map((key) => {
    const monthTrips = trips.filter((t) => t.date.slice(0, 7) === key);
    const monthPages = pages.filter((p) => p.month === key);
    const officialKm = roundToOneDecimal(
      monthTrips.filter((t) => t.trip_type === 'Official').reduce((s, t) => s + roundToOneDecimal(t.trip_distance), 0)
    );
    const privateKm = roundToOneDecimal(
      monthTrips.filter((t) => t.trip_type === 'Private').reduce((s, t) => s + roundToOneDecimal(t.trip_distance), 0)
    );
    const totalKm = roundToOneDecimal(officialKm + privateKm);
    const fuelDrawn = roundToOneDecimal(monthTrips.reduce((s, t) => s + roundToOneDecimal(t.fuel_pumped_amount ?? 0), 0));
    return {
      monthKey: key,
      monthLabel: formatMonthLabel(key),
      officialKm,
      privateKm,
      totalKm,
      tripCount: monthTrips.length,
      fuelDrawn,
      pageCount: monthPages.length,
    };
  });
}

// ---------------------------------------------------------------------------
// Page-wise distance
// ---------------------------------------------------------------------------

export function computePageWiseDistances(params: { trips: Trip[]; pages: BookPage[] }): PageDistance[] {
  const { trips, pages } = params;
  const sortedPages = [...pages].sort((a, b) => a.page_number - b.page_number);
  return sortedPages.map((page) => {
    const pageTrips = trips.filter((t) => t.page_id === page.id);
    const distance = sumDistance(pageTrips);
    const officialKm = roundToOneDecimal(
      pageTrips.filter((t) => t.trip_type === 'Official').reduce((s, t) => s + roundToOneDecimal(t.trip_distance), 0)
    );
    const privateKm = roundToOneDecimal(
      pageTrips.filter((t) => t.trip_type === 'Private').reduce((s, t) => s + roundToOneDecimal(t.trip_distance), 0)
    );
    return {
      pageNumber: page.page_number,
      month: page.month,
      monthLabel: formatMonthLabel(page.month),
      distance,
      officialKm,
      privateKm,
      tripCount: pageTrips.length,
    };
  });
}

// ---------------------------------------------------------------------------
// Master Table filter/search/sort
// ---------------------------------------------------------------------------

export function filterAndSortTrips(trips: Trip[], opts: FilterOptions): Trip[] {
  let result = [...trips];

  if (opts.tripType && opts.tripType !== 'All') {
    result = result.filter((t) => t.trip_type === opts.tripType);
  }

  if (opts.month && opts.month !== 'All') {
    result = result.filter((t) => t.date.slice(0, 7) === opts.month);
  }

  if (opts.search && opts.search.trim() !== '') {
    const q = opts.search.trim().toLowerCase();
    result = result.filter((t) => {
      return (
        t.places_visited.toLowerCase().includes(q) ||
        t.trip_type.toLowerCase().includes(q) ||
        t.date.toLowerCase().includes(q) ||
        t.start_time.toLowerCase().includes(q) ||
        t.end_time.toLowerCase().includes(q) ||
        String(t.start_km).includes(q) ||
        String(t.end_km).includes(q) ||
        String(t.trip_distance).includes(q) ||
        (t.fuel_order_no ?? '').toLowerCase().includes(q)
      );
    });
  }

  const column = opts.sortColumn ?? 'date';
  const dir = opts.sortDirection ?? 'desc';

  result.sort((a, b) => {
    let cmp = 0;
    switch (column) {
      case 'date':
        cmp = a.date.localeCompare(b.date);
        if (cmp === 0) cmp = a.start_time.localeCompare(b.start_time);
        if (cmp === 0) cmp = a.trip_index - b.trip_index;
        break;
      case 'start_km':
        cmp = a.start_km - b.start_km;
        break;
      case 'end_km':
        cmp = a.end_km - b.end_km;
        break;
      case 'trip_distance':
        cmp = a.trip_distance - b.trip_distance;
        break;
      case 'trip_type':
        cmp = a.trip_type.localeCompare(b.trip_type);
        break;
      case 'places_visited':
        cmp = a.places_visited.localeCompare(b.places_visited);
        break;
      case 'fuel_pumped_amount':
        cmp = (a.fuel_pumped_amount ?? 0) - (b.fuel_pumped_amount ?? 0);
        break;
      default:
        cmp = a.date.localeCompare(b.date);
    }
    return dir === 'asc' ? cmp : -cmp;
  });

  return result;
}

export function getAvailableMonths(trips: Trip[], pages: BookPage[]): string[] {
  const set = new Set<string>();
  for (const t of trips) set.add(t.date.slice(0, 7));
  for (const p of pages) set.add(p.month);
  return Array.from(set).sort();
}

export function getDistinctTripTypes(): Array<'Official' | 'Private'> {
  return ['Official', 'Private'];
}
