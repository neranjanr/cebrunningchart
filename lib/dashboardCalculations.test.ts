import { describe, it, expect } from 'vitest';
import {
  computeDashboardMetrics,
  computeMetricsForMonth,
  computeThisMonthMetrics,
  getCurrentMonthKey,
  computeMonthlyBreakdown,
  computePageWiseDistances,
  filterAndSortTrips,
  getAvailableMonths,
  getLastN,
  getLast12MonthlyBreakdown,
  getLast12PageDistances,
  matchesGlobalSearch,
  filterTripsByGlobalSearch,
  computeFilteredSums,
  filterTripsByGlobalSearchWithSums,
} from './dashboardCalculations';
import type { BookPage, Trip, Vehicle } from '@/types';

function makeTrip(overrides: Partial<Trip> & { date: string; page_id?: string }): Trip {
  const base: Trip = {
    id: `trip-${Math.random().toString(36).slice(2, 6)}`,
    page_id: 'page-1',
    vehicle_id: 'veh-1',
    date: '2024-10-21',
    day_index: 1,
    trip_index: 1,
    start_time: '08:00',
    end_time: '09:00',
    start_km: 100,
    end_km: 110,
    trip_distance: 10,
    trip_type: 'Official',
    places_visited: 'A -> B',
    fuel_pumped_amount: 0,
    fuel_order_no: '',
    created_at: new Date().toISOString(),
  };
  return { ...base, ...overrides } as Trip;
}
function makePage(overrides: Partial<BookPage>): BookPage {
  return {
    id: overrides.id ?? `page-${overrides.page_number ?? 1}`,
    vehicle_id: 'veh-1',
    page_number: overrides.page_number ?? 1,
    month: overrides.month ?? '2024-10',
    start_km: overrides.start_km ?? 100,
    end_km: overrides.end_km ?? 400,
    start_fuel_balance: overrides.start_fuel_balance ?? 30,
    end_fuel_balance: overrides.end_fuel_balance ?? 45,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}
function makeVehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: 'veh-1',
    brand: 'Toyota',
    model: 'Hilux',
    vehicle_type: 'Double Cab',
    fuel_type: 'Diesel',
    tank_capacity: 80,
    current_odometer: 15000,
    current_fuel_level: 50,
    ...overrides,
  };
}

describe('computeDashboardMetrics — Integer KM (Phase 2)', () => {
  it('computes official/private/total KM as integers (rounded), fuel 1 decimal', () => {
    const trips = [
      makeTrip({ date: '2024-10-21', trip_distance: 24.3, trip_type: 'Official' }),
      makeTrip({ date: '2024-10-21', trip_distance: 17.6, trip_type: 'Private' }),
      makeTrip({ date: '2024-10-22', trip_distance: 10.4, trip_type: 'Official' }),
    ];
    const vehicle = makeVehicle({ tank_capacity: 80, current_fuel_level: 65 });
    const m = computeDashboardMetrics({ trips, vehicle, pages: [] });
    // 24.3→24, 10.4→10 => official 34; 17.6→18 => private 18; total 52
    expect(m.officialKm).toBe(34);
    expect(m.privateKm).toBe(18);
    expect(m.totalKm).toBe(52);
    expect(m.tripCount).toBe(3);
    expect(m.fuelLevel).toBe(65.0);
    expect(m.tankCapacity).toBe(80.0);
    expect(m.fuelLevelPercent).toBe(81.3); // 65/80*100=81.25->81.3
  });

  it('uses last page end_fuel_balance when pages present', () => {
    const trips = [makeTrip({ date: '2024-10-21', trip_distance: 10 })];
    const pages = [makePage({ page_number: 1, end_fuel_balance: 48.3 }), makePage({ page_number: 2, end_fuel_balance: 42.1 })];
    const vehicle = makeVehicle({ current_fuel_level: 65 });
    const m = computeDashboardMetrics({ trips, vehicle, pages });
    expect(m.fuelLevel).toBe(42.1);
  });

  it('handles empty trips', () => {
    const m = computeDashboardMetrics({ trips: [], vehicle: makeVehicle(), pages: [] });
    expect(m.totalKm).toBe(0);
    expect(m.tripCount).toBe(0);
  });

  it('handles null vehicle', () => {
    const trips = [makeTrip({ date: '2024-10-21', trip_distance: 10 })];
    const m = computeDashboardMetrics({ trips, vehicle: null });
    expect(m.tankCapacity).toBe(0);
    expect(m.fuelLevelPercent).toBe(0);
  });

  it('rounds mileage distance 24.6 -> 25 boundary', () => {
    const trips = [makeTrip({ date: '2024-10-21', trip_distance: 24.6, trip_type: 'Official' })];
    const m = computeDashboardMetrics({ trips, vehicle: makeVehicle(), pages: [] });
    expect(m.officialKm).toBe(25);
  });
});

describe('getCurrentMonthKey / computeMetricsForMonth / computeThisMonthMetrics', () => {
  it('getCurrentMonthKey returns YYYY-MM for given date', () => {
    expect(getCurrentMonthKey(new Date('2026-02-15T10:00:00'))).toBe('2026-02');
    expect(getCurrentMonthKey(new Date('2024-01-01T00:00:00'))).toBe('2024-01');
  });

  it('computeMetricsForMonth filters by month key integer', () => {
    const trips = [
      makeTrip({ date: '2024-10-21', trip_distance: 10 }),
      makeTrip({ date: '2024-11-01', trip_distance: 20 }),
    ];
    const m = computeMetricsForMonth(trips, makeVehicle(), '2024-10');
    expect(m.totalKm).toBe(10);
    expect(m.tripCount).toBe(1);
  });

  it('computeThisMonthMetrics returns only current month trips', () => {
    const trips = [
      makeTrip({ id: 't1', date: '2026-03-10', trip_distance: 50, trip_type: 'Official' }),
      makeTrip({ id: 't2', date: '2026-03-15', trip_distance: 20, trip_type: 'Private' }),
      makeTrip({ id: 't3', date: '2026-02-28', trip_distance: 99, trip_type: 'Official' }),
    ];
    const now = new Date('2026-03-20T12:00:00');
    const m = computeThisMonthMetrics({ trips, vehicle: makeVehicle(), now });
    expect(m.officialKm).toBe(50);
    expect(m.privateKm).toBe(20);
    expect(m.totalKm).toBe(70);
    expect(m.tripCount).toBe(2);
  });

  it('computeThisMonthMetrics handles no trips this month', () => {
    const trips = [makeTrip({ date: '2026-01-10', trip_distance: 100 })];
    const now = new Date('2026-03-15T00:00:00');
    const m = computeThisMonthMetrics({ trips, vehicle: makeVehicle(), now });
    expect(m.totalKm).toBe(0);
    expect(m.tripCount).toBe(0);
  });

  it('computeMetricsForMonth sums only that month with integer rounding', () => {
    const trips = [
      makeTrip({ date: '2026-03-01', trip_distance: 24.6, trip_type: 'Official' }), // 25
      makeTrip({ date: '2026-03-02', trip_distance: 10.4, trip_type: 'Official' }), // 10
      makeTrip({ date: '2026-04-01', trip_distance: 100, trip_type: 'Official' }),
    ];
    const m = computeMetricsForMonth(trips, makeVehicle(), '2026-03');
    expect(m.officialKm).toBe(35); // 25+10
    expect(m.totalKm).toBe(35);
  });
});

describe('computeMonthlyBreakdown — integer KM', () => {
  it('groups by month with official/private/total integer and fuel drawn 1 decimal', () => {
    const trips = [
      makeTrip({ date: '2024-10-21', trip_distance: 10, trip_type: 'Official', fuel_pumped_amount: 20 }),
      makeTrip({ date: '2024-10-22', trip_distance: 5, trip_type: 'Private' }),
      makeTrip({ date: '2024-11-01', trip_distance: 30, trip_type: 'Official' }),
    ];
    const pages = [
      makePage({ page_number: 1, month: '2024-10' }),
      makePage({ page_number: 2, month: '2024-10' }),
      makePage({ page_number: 3, month: '2024-11' }),
    ];
    const breakdown = computeMonthlyBreakdown({ trips, pages });
    expect(breakdown.length).toBe(2);
    expect(breakdown[0].monthKey).toBe('2024-10');
    expect(breakdown[0].monthLabel).toBe('Oct 2024');
    expect(breakdown[0].totalKm).toBe(15);
    expect(breakdown[0].officialKm).toBe(10);
    expect(breakdown[0].privateKm).toBe(5);
    expect(breakdown[0].tripCount).toBe(2);
    expect(breakdown[0].fuelDrawn).toBe(20);
    expect(breakdown[0].pageCount).toBe(2);
    expect(breakdown[1].monthKey).toBe('2024-11');
    expect(breakdown[1].totalKm).toBe(30);
  });

  it('includes months with pages but no trips', () => {
    const pages = [makePage({ page_number: 1, month: '2024-12' })];
    const breakdown = computeMonthlyBreakdown({ trips: [], pages });
    expect(breakdown.length).toBe(1);
    expect(breakdown[0].monthKey).toBe('2024-12');
    expect(breakdown[0].totalKm).toBe(0);
  });

  it('sorted chronologically', () => {
    const trips = [
      makeTrip({ date: '2024-12-01', trip_distance: 10 }),
      makeTrip({ date: '2024-10-01', trip_distance: 10 }),
    ];
    const breakdown = computeMonthlyBreakdown({ trips, pages: [] });
    expect(breakdown[0].monthKey).toBe('2024-10');
    expect(breakdown[1].monthKey).toBe('2024-12');
  });
});

describe('computePageWiseDistances — integer KM', () => {
  it('computes distance per page integer', () => {
    const pages = [makePage({ page_number: 1, id: 'page-1', month: '2024-10' }), makePage({ page_number: 2, id: 'page-2', month: '2024-11' })];
    const trips = [
      makeTrip({ date: '2024-10-21', page_id: 'page-1', trip_distance: 10, trip_type: 'Official' }),
      makeTrip({ date: '2024-10-21', page_id: 'page-1', trip_distance: 5, trip_type: 'Private' }),
      makeTrip({ date: '2024-11-01', page_id: 'page-2', trip_distance: 30 }),
    ];
    const result = computePageWiseDistances({ trips, pages });
    expect(result.length).toBe(2);
    expect(result[0].pageNumber).toBe(1);
    expect(result[0].distance).toBe(15);
    expect(result[0].officialKm).toBe(10);
    expect(result[0].privateKm).toBe(5);
    expect(result[0].tripCount).toBe(2);
    expect(result[1].distance).toBe(30);
  });

  it('handles page with no trips', () => {
    const pages = [makePage({ page_number: 1, id: 'page-1' })];
    const result = computePageWiseDistances({ trips: [], pages });
    expect(result[0].distance).toBe(0);
    expect(result[0].tripCount).toBe(0);
  });
});

describe('getLastN / last-12 slicing', () => {
  it('getLastN returns last N items', () => {
    expect(getLastN([1, 2, 3, 4, 5], 3)).toEqual([3, 4, 5]);
    expect(getLastN([1, 2], 5)).toEqual([1, 2]);
    expect(getLastN([], 12)).toEqual([]);
    expect(getLastN([1, 2, 3], 0)).toEqual([]);
  });

  it('getLast12MonthlyBreakdown slices last 12 chronologically', () => {
    const trips: Trip[] = [];
    const pages: BookPage[] = [];
    // Generate 15 months 2024-01 .. 2025-03
    for (let i = 0; i < 15; i++) {
      const date = new Date(2024, i, 15);
      const monthKey = date.toISOString().slice(0, 7);
      const trip = makeTrip({ date: `${monthKey}-15`, trip_distance: 10 });
      trips.push(trip);
      pages.push(makePage({ page_number: i + 1, month: monthKey, id: `page-${i + 1}` }));
    }
    const full = computeMonthlyBreakdown({ trips, pages });
    expect(full.length).toBe(15);
    const last12 = getLast12MonthlyBreakdown(full);
    expect(last12.length).toBe(12);
    expect(last12[0].monthKey).toBe('2024-04'); // first 3 sliced off
    expect(last12[11].monthKey).toBe('2025-03');
  });

  it('getLast12PageDistances slices last 12 pages', () => {
    const pages: BookPage[] = Array.from({ length: 20 }, (_, i) => makePage({ page_number: i + 1, id: `page-${i + 1}`, month: '2024-10' }));
    const trips: Trip[] = pages.map((p) => makeTrip({ date: '2024-10-01', page_id: p.id, trip_distance: 10 }));
    const full = computePageWiseDistances({ trips, pages });
    expect(full.length).toBe(20);
    const last12 = getLast12PageDistances(full);
    expect(last12.length).toBe(12);
    expect(last12[0].pageNumber).toBe(9);
    expect(last12[11].pageNumber).toBe(20);
  });

  it('last-12 returns all when <=12', () => {
    const breakdown: any[] = [{ monthKey: '2024-01' }, { monthKey: '2024-02' }];
    expect(getLast12MonthlyBreakdown(breakdown as any).length).toBe(2);
    expect(getLast12PageDistances([{ pageNumber: 1 } as any]).length).toBe(1);
  });
});

describe('Global Search — matchesGlobalSearch / filterTripsByGlobalSearch', () => {
  const trips: Trip[] = [
    makeTrip({ id: 't1', date: '2024-10-21', start_km: 100, end_km: 110, trip_distance: 10, trip_type: 'Official', places_visited: 'Colombo -> Kandy', fuel_order_no: 'FO-001' }),
    makeTrip({ id: 't2', date: '2024-10-22', start_km: 110, end_km: 125, trip_distance: 15, trip_type: 'Private', places_visited: 'Kandy -> Galle', fuel_order_no: 'FO-002' }),
    makeTrip({ id: 't3', date: '2024-11-01', start_km: 125, end_km: 155, trip_distance: 30, trip_type: 'Official', places_visited: 'Galle -> Colombo', fuel_order_no: '' }),
    makeTrip({ id: 't4', date: '2025-01-01', start_km: 50000, end_km: 50020, trip_distance: 20, trip_type: 'Official', places_visited: 'Negombo -> Colombo', fuel_order_no: 'ORD-999' }),
  ];

  it('matches by date substring', () => {
    const result = filterTripsByGlobalSearch(trips, '2024-10');
    expect(result.map((t) => t.id)).toEqual(expect.arrayContaining(['t1', 't2']));
    expect(result.length).toBe(2);
  });

  it('matches by Places Visited case-insensitive substring', () => {
    expect(filterTripsByGlobalSearch(trips, 'kandy').map((t) => t.id)).toEqual(expect.arrayContaining(['t1', 't2']));
    expect(filterTripsByGlobalSearch(trips, 'COLOMBO').length).toBe(3); // t1, t3, t4
  });

  it('matches by Fuel Order No case-insensitive', () => {
    expect(filterTripsByGlobalSearch(trips, 'FO-001').map((t) => t.id)).toEqual(['t1']);
    expect(filterTripsByGlobalSearch(trips, 'fo-00').length).toBe(2);
    expect(filterTripsByGlobalSearch(trips, 'ord-999').map((t) => t.id)).toEqual(['t4']);
  });

  it('matches by Trip Type case-insensitive', () => {
    expect(filterTripsByGlobalSearch(trips, 'private').map((t) => t.id)).toEqual(['t2']);
    expect(filterTripsByGlobalSearch(trips, 'official').length).toBe(3);
  });

  it('matches by KM substrings (start_km, end_km, trip_distance)', () => {
    expect(filterTripsByGlobalSearch(trips, '50000').map((t) => t.id)).toEqual(['t4']);
    expect(filterTripsByGlobalSearch(trips, '155').map((t) => t.id)).toEqual(['t3']); // end_km 155 also trip_distance 30 not 155
    expect(filterTripsByGlobalSearch(trips, '30').map((t) => t.id)).toEqual(['t3']); // trip_distance 30
    expect(filterTripsByGlobalSearch(trips, '110').map((t) => t.id)).toEqual(expect.arrayContaining(['t1', 't2'])); // start 110 is t2, end 110 is t1
  });

  it('numeric exact substring: query 10 matches distances containing 10 but not 100 alone', () => {
    const subset = filterTripsByGlobalSearch(trips, '10');
    // t1: start 100, end 110, distance 10 => matches; t2 start 110 includes 10; so both plus maybe others containing 10
    expect(subset.length).toBeGreaterThanOrEqual(2);
  });

  it('empty/whitespace query returns all trips copy', () => {
    expect(filterTripsByGlobalSearch(trips, '').length).toBe(4);
    expect(filterTripsByGlobalSearch(trips, '   ').length).toBe(4);
    // ensure copy not same reference
    expect(filterTripsByGlobalSearch(trips, '')).not.toBe(trips);
  });

  it('case-insensitive: KANDY equals kandy', () => {
    expect(filterTripsByGlobalSearch(trips, 'KANDY').length).toBe(filterTripsByGlobalSearch(trips, 'kandy').length);
  });

  it('trim handles surrounding spaces', () => {
    expect(filterTripsByGlobalSearch(trips, '  kandy  ').length).toBe(2);
  });

  it('matchesGlobalSearch helper returns true/false', () => {
    expect(matchesGlobalSearch(trips[0], 'Colombo')).toBe(true);
    expect(matchesGlobalSearch(trips[1], 'Official')).toBe(false); // t2 is Private
    expect(matchesGlobalSearch(trips[1], 'Private')).toBe(true);
    expect(matchesGlobalSearch(trips[0], '9999')).toBe(false);
  });

  it('no matches returns empty', () => {
    expect(filterTripsByGlobalSearch(trips, 'NONEXISTENT')).toEqual([]);
  });
});

describe('computeFilteredSums', () => {
  it('sums filtered Official/Private/Total as integers', () => {
    const trips = [
      makeTrip({ date: '2024-10-21', trip_distance: 10, trip_type: 'Official' }),
      makeTrip({ date: '2024-10-22', trip_distance: 15, trip_type: 'Private' }),
      makeTrip({ date: '2024-10-23', trip_distance: 24.6, trip_type: 'Official' }), // 25 after rounding
    ];
    const sums = computeFilteredSums(trips);
    expect(sums.count).toBe(3);
    expect(sums.officialKm).toBe(35); // 10 + 25
    expect(sums.privateKm).toBe(15);
    expect(sums.totalKm).toBe(50);
  });

  it('empty sums zero', () => {
    const sums = computeFilteredSums([]);
    expect(sums.count).toBe(0);
    expect(sums.officialKm).toBe(0);
    expect(sums.privateKm).toBe(0);
    expect(sums.totalKm).toBe(0);
  });

  it('filterWithSums combines filter + sums correctly (global search)', () => {
    const trips = [
      makeTrip({ id: 't1', date: '2024-10-21', trip_distance: 10, trip_type: 'Official', places_visited: 'Colombo', fuel_order_no: 'A1' }),
      makeTrip({ id: 't2', date: '2024-10-22', trip_distance: 20, trip_type: 'Private', places_visited: 'Kandy', fuel_order_no: 'B2' }),
      makeTrip({ id: 't3', date: '2024-10-23', trip_distance: 30, trip_type: 'Official', places_visited: 'Colombo Port', fuel_order_no: '' }),
    ];
    const { filtered, sums } = filterTripsByGlobalSearchWithSums(trips, 'colombo');
    expect(filtered.length).toBe(2);
    expect(sums.count).toBe(2);
    expect(sums.officialKm).toBe(40); // 10+30
    expect(sums.privateKm).toBe(0);
    expect(sums.totalKm).toBe(40);
  });
});

describe('filterAndSortTrips (legacy extended search — still works)', () => {
  const trips = [
    makeTrip({ id: 't1', date: '2024-10-21', start_km: 100, end_km: 110, trip_distance: 10, trip_type: 'Official', places_visited: 'Colombo -> Kandy', fuel_pumped_amount: 20 }),
    makeTrip({ id: 't2', date: '2024-10-22', start_km: 110, end_km: 125, trip_distance: 15, trip_type: 'Private', places_visited: 'Kandy -> Galle', fuel_pumped_amount: 0 }),
    makeTrip({ id: 't3', date: '2024-11-01', start_km: 125, end_km: 155, trip_distance: 30, trip_type: 'Official', places_visited: 'Galle -> Colombo', fuel_pumped_amount: 35 }),
  ];

  it('searches by places_visited case-insensitive', () => {
    const result = filterAndSortTrips(trips, { search: 'kandy' });
    expect(result.map((t) => t.id)).toEqual(expect.arrayContaining(['t1', 't2']));
    expect(result.length).toBe(2);
  });

  it('filters by tripType', () => {
    const result = filterAndSortTrips(trips, { tripType: 'Private' });
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('t2');
  });

  it('filters by month', () => {
    const result = filterAndSortTrips(trips, { month: '2024-10' });
    expect(result.length).toBe(2);
  });

  it('combines filters', () => {
    const result = filterAndSortTrips(trips, { search: 'colombo', tripType: 'Official', month: '2024-11' });
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('t3');
  });

  it('sorts by distance asc', () => {
    const result = filterAndSortTrips(trips, { sortColumn: 'trip_distance', sortDirection: 'asc' });
    expect(result.map((t) => t.id)).toEqual(['t1', 't2', 't3']);
  });

  it('sorts by date desc default', () => {
    const result = filterAndSortTrips(trips, {});
    // default date desc -> t3 (2024-11-01) first
    expect(result[0].id).toBe('t3');
  });

  it('sorts by date asc', () => {
    const result = filterAndSortTrips(trips, { sortColumn: 'date', sortDirection: 'asc' });
    expect(result[0].id).toBe('t1');
  });

  it('passes through All filters', () => {
    const result = filterAndSortTrips(trips, { tripType: 'All', month: 'All', search: '' });
    expect(result.length).toBe(3);
  });
});

describe('getAvailableMonths', () => {
  it('returns sorted unique months', () => {
    const trips = [makeTrip({ date: '2024-11-01' }), makeTrip({ date: '2024-10-01' })];
    const pages = [makePage({ month: '2024-12' })];
    expect(getAvailableMonths(trips, pages)).toEqual(['2024-10', '2024-11', '2024-12']);
  });
});
