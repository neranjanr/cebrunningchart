import { describe, it, expect } from 'vitest';
import {
  computeDashboardMetrics,
  computeMetricsForMonth,
  computeMonthlyBreakdown,
  computePageWiseDistances,
  filterAndSortTrips,
  getAvailableMonths,
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

describe('computeDashboardMetrics', () => {
  it('computes official/private/total KM rounded to 1 decimal', () => {
    const trips = [
      makeTrip({ date: '2024-10-21', trip_distance: 24.3, trip_type: 'Official' }),
      makeTrip({ date: '2024-10-21', trip_distance: 17.3, trip_type: 'Private' }),
      makeTrip({ date: '2024-10-22', trip_distance: 10, trip_type: 'Official' }),
    ];
    const vehicle = makeVehicle({ tank_capacity: 80, current_fuel_level: 65 });
    const m = computeDashboardMetrics({ trips, vehicle, pages: [] });
    expect(m.officialKm).toBe(34.3);
    expect(m.privateKm).toBe(17.3);
    expect(m.totalKm).toBe(51.6);
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
});

describe('computeMetricsForMonth', () => {
  it('filters by month key', () => {
    const trips = [
      makeTrip({ date: '2024-10-21', trip_distance: 10 }),
      makeTrip({ date: '2024-11-01', trip_distance: 20 }),
    ];
    const m = computeMetricsForMonth(trips, makeVehicle(), '2024-10');
    expect(m.totalKm).toBe(10);
    expect(m.tripCount).toBe(1);
  });
});

describe('computeMonthlyBreakdown', () => {
  it('groups by month with official/private/total and fuel drawn', () => {
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

describe('computePageWiseDistances', () => {
  it('computes distance per page', () => {
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

describe('filterAndSortTrips', () => {
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
