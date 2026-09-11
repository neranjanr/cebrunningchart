import { describe, it, expect } from 'vitest';
import {
  propagateFuelEconomy,
  computeLedgerDays,
  computeLedgerSummary,
  groupTripsByDateForSide1,
  DEFAULT_FUEL_ECONOMY,
} from './ledgerCalculations';
import type { BookPage, Trip } from '@/types';

function makeTrip(overrides: Partial<Trip> & { date: string; page_id: string }): Trip {
  const base: Trip = {
    id: `trip-${Math.random().toString(36).slice(2, 6)}`,
    vehicle_id: overrides.vehicle_id ?? 'veh-1',
    page_id: overrides.page_id,
    date: overrides.date,
    day_index: overrides.day_index ?? 1,
    trip_index: overrides.trip_index ?? 1,
    start_time: overrides.start_time ?? '08:00',
    end_time: overrides.end_time ?? '09:00',
    start_km: overrides.start_km ?? 100,
    end_km: overrides.end_km ?? 110,
    trip_distance: overrides.trip_distance ?? 10,
    trip_type: overrides.trip_type ?? 'Official',
    places_visited: overrides.places_visited ?? 'A -> B',
    fuel_pumped_amount: overrides.fuel_pumped_amount ?? 0,
    fuel_order_no: overrides.fuel_order_no ?? '',
    created_at: overrides.created_at ?? new Date().toISOString(),
  };
  return base;
}

function makePage(overrides: Partial<BookPage>): BookPage {
  return {
    id: overrides.id ?? `page-${overrides.page_number ?? 1}`,
    vehicle_id: 'veh-1',
    page_number: overrides.page_number ?? 1,
    month: overrides.month ?? '2024-10',
    start_km: overrides.start_km ?? 100,
    end_km: overrides.end_km ?? 400,
    start_fuel_balance: overrides.start_fuel_balance ?? 31.4,
    end_fuel_balance: overrides.end_fuel_balance ?? 48.3,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('propagateFuelEconomy', () => {
  it('propagates forward, inheriting previous until overridden', () => {
    const raw: (number | null)[] = [10.5, null, 10.8, null];
    expect(propagateFuelEconomy(raw, 10.5)).toEqual([10.5, 10.5, 10.8, 10.8]);
  });
  it('uses fallback for first null', () => {
    expect(propagateFuelEconomy([null, null], 10.5)).toEqual([10.5, 10.5]);
    expect(propagateFuelEconomy([null, 10.8], 10.5)).toEqual([10.5, 10.8]);
  });
  it('rounds to 1 decimal', () => {
    expect(propagateFuelEconomy([10.55, null], 10.5)).toEqual([10.6, 10.6]);
  });
  it('handles empty array', () => {
    expect(propagateFuelEconomy([])).toEqual([]);
  });
  it('handles all explicit overrides', () => {
    expect(propagateFuelEconomy([10.5, 10.6, 10.7])).toEqual([10.5, 10.6, 10.7]);
  });
});

describe('computeLedgerDays - sample page 14 data', () => {
  const page = makePage({
    id: 'page-14',
    page_number: 14,
    month: '2024-10',
    start_km: 142684.2,
    end_km: 142875.0,
    start_fuel_balance: 31.4,
    end_fuel_balance: 48.3,
  });

  // Build trips matching sample UI: Day1 3 trips, Day2 4 trips, Day3 2 trips, Day4 1 trip
  const trips: Trip[] = [
    // Day 1: Mon 2024-10-21, distance 62.6
    makeTrip({ date: '2024-10-21', page_id: 'page-14', trip_index: 1, start_km: 142684.2, end_km: 142708.5, trip_distance: 24.3 }),
    makeTrip({ date: '2024-10-21', page_id: 'page-14', trip_index: 2, start_km: 142708.5, end_km: 142729.5, trip_distance: 21.0 }),
    makeTrip({ date: '2024-10-21', page_id: 'page-14', trip_index: 3, start_km: 142729.5, end_km: 142746.8, trip_distance: 17.3, trip_type: 'Private' }),
    // Day 2: Tue 2024-10-22 distance 65.2, includes fuel pumped 35
    makeTrip({ date: '2024-10-22', page_id: 'page-14', trip_index: 1, start_km: 142746.8, end_km: 142765.2, trip_distance: 18.4, fuel_pumped_amount: 35.0, fuel_order_no: '#FO-88912' }),
    makeTrip({ date: '2024-10-22', page_id: 'page-14', trip_index: 2, start_km: 142765.2, end_km: 142782.0, trip_distance: 16.8 }),
    makeTrip({ date: '2024-10-22', page_id: 'page-14', trip_index: 3, start_km: 142782.0, end_km: 142799.6, trip_distance: 17.6 }),
    makeTrip({ date: '2024-10-22', page_id: 'page-14', trip_index: 4, start_km: 142799.6, end_km: 142812.0, trip_distance: 12.4 }),
    // Day 3: Wed 23 Oct distance 38.4
    makeTrip({ date: '2024-10-23', page_id: 'page-14', trip_index: 1, start_km: 142812.0, end_km: 142833.2, trip_distance: 21.2 }),
    makeTrip({ date: '2024-10-23', page_id: 'page-14', trip_index: 2, start_km: 142833.2, end_km: 142850.4, trip_distance: 17.2 }),
    // Day 4: Thu 24 Oct distance 24.6
    makeTrip({ date: '2024-10-24', page_id: 'page-14', trip_index: 1, start_km: 142850.4, end_km: 142875.0, trip_distance: 24.6 }),
  ];

  it('computes daily aggregates, consumption and balance rounded to 1 decimal', () => {
    const economies = [10.5, null, 10.8, null];
    const days = computeLedgerDays({ page, trips, economies });

    expect(days.length).toBe(4);

    // Day 1
    expect(days[0].date).toBe('2024-10-21');
    expect(days[0].startKm).toBe(142684.2);
    expect(days[0].endKm).toBe(142746.8);
    expect(days[0].distance).toBe(62.6);
    expect(days[0].fuelEconomy).toBe(10.5);
    expect(days[0].fuelPosition).toBe(31.4);
    expect(days[0].drawn).toBe(0.0);
    expect(days[0].consumed).toBe(6.0); // 62.6/10.5 = 5.96 ->6.0
    expect(days[0].balance).toBe(25.4); // 31.4-6.0

    // Day 2 inherits 10.5, pumped 35.0
    expect(days[1].fuelEconomy).toBe(10.5);
    expect(days[1].distance).toBe(65.2);
    expect(days[1].fuelPosition).toBe(25.4);
    expect(days[1].drawn).toBe(35.0);
    expect(days[1].fuelOrderNo).toBe('#FO-88912');
    expect(days[1].consumed).toBe(6.2); // 65.2/10.5=6.209 ->6.2
    expect(days[1].balance).toBe(54.2); // 25.4+35-6.2

    // Day 3 adjusted to 10.8
    expect(days[2].fuelEconomy).toBe(10.8);
    expect(days[2].distance).toBe(38.4);
    expect(days[2].fuelPosition).toBe(54.2);
    expect(days[2].consumed).toBe(3.6); // 38.4/10.8=3.55 ->3.6
    expect(days[2].balance).toBe(50.6);

    // Day 4 inherits 10.8
    expect(days[3].fuelEconomy).toBe(10.8);
    expect(days[3].distance).toBe(24.6);
    expect(days[3].fuelPosition).toBe(50.6);
    expect(days[3].consumed).toBe(2.3); // 24.6/10.8=2.27 ->2.3
    expect(days[3].balance).toBe(48.3);
    expect(days[3].economySource).toBe('inherited');
  });

  it('computes ledger summary totals matching sample', () => {
    const days = computeLedgerDays({ page, trips, economies: [10.5, null, 10.8, null] });
    const summary = computeLedgerSummary(days);
    expect(summary.totalDistance).toBe(190.8);
    expect(summary.totalDrawn).toBe(35.0);
    expect(summary.totalConsumed).toBe(18.1); // 6.0+6.2+3.6+2.3
    expect(summary.finalBalance).toBe(48.3);
    expect(summary.weightedEconomy).toBe(10.5); // 190.8/18.1=10.54 ->10.5
  });

  it('handles empty trips', () => {
    const empty = computeLedgerDays({ page, trips: [], economies: [] });
    expect(empty).toEqual([]);
    expect(computeLedgerSummary(empty)).toEqual({
      totalDistance: 0,
      totalDrawn: 0,
      totalConsumed: 0,
      finalBalance: 0,
      weightedEconomy: 0,
    });
  });

  it('uses fallback economy when no economies provided', () => {
    const days = computeLedgerDays({ page, trips: trips.filter((t) => t.date === '2024-10-21') });
    expect(days[0].fuelEconomy).toBe(DEFAULT_FUEL_ECONOMY);
  });
});

describe('groupTripsByDateForSide1', () => {
  it('groups trips per day with subtotals', () => {
    const page = makePage({ id: 'p1', start_fuel_balance: 30 });
    const trips = [
      makeTrip({ date: '2024-10-21', page_id: 'p1', trip_index: 1, trip_distance: 10, trip_type: 'Official' }),
      makeTrip({ date: '2024-10-21', page_id: 'p1', trip_index: 2, trip_distance: 5, trip_type: 'Private' }),
      makeTrip({ date: '2024-10-22', page_id: 'p1', trip_index: 1, trip_distance: 7 }),
    ];
    const groups = groupTripsByDateForSide1(trips, 'p1');
    expect(groups.length).toBe(2);
    expect(groups[0].distance).toBe(15.0);
    expect(groups[0].officialKm).toBe(10.0);
    expect(groups[0].privateKm).toBe(5.0);
    expect(groups[1].distance).toBe(7.0);
  });
});
