import { describe, it, expect } from 'vitest';
import {
  propagateFuelEconomy,
  computeLedgerDays,
  computeLedgerSummary,
  groupTripsByDateForSide1,
  computePageSeq,
  computeGlobalSeq,
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

    // Day 1 - Integer KM: 62
    expect(days[0].date).toBe('2024-10-21');
    expect(days[0].startKm).toBe(142684);
    expect(days[0].endKm).toBe(142747);
    expect(days[0].distance).toBe(62);
    expect(days[0].fuelEconomy).toBe(10.5);
    expect(days[0].fuelPosition).toBe(31.4);
    expect(days[0].drawn).toBe(0.0);
    expect(days[0].consumed).toBe(5.9); // 62/10.5 =5.90
    expect(days[0].balance).toBe(25.5); // 31.4-5.9

    // Day 2 inherits 10.5, pumped 35.0 - Integer KM: 65
    expect(days[1].fuelEconomy).toBe(10.5);
    expect(days[1].distance).toBe(65);
    expect(days[1].fuelPosition).toBe(25.5);
    expect(days[1].drawn).toBe(35.0);
    expect(days[1].fuelOrderNo).toBe('#FO-88912');
    expect(days[1].consumed).toBe(6.2); // 65/10.5=6.19 ->6.2
    expect(days[1].balance).toBe(54.3); // 25.5+35-6.2

    // Day 3 adjusted to 10.8 - Integer KM: 38
    expect(days[2].fuelEconomy).toBe(10.8);
    expect(days[2].distance).toBe(38);
    expect(days[2].fuelPosition).toBe(54.3);
    expect(days[2].consumed).toBe(3.5); // 38/10.8=3.51 ->3.5
    expect(days[2].balance).toBe(50.8);

    // Day 4 inherits 10.8 - Integer KM: 25
    expect(days[3].fuelEconomy).toBe(10.8);
    expect(days[3].distance).toBe(25);
    expect(days[3].fuelPosition).toBe(50.8);
    expect(days[3].consumed).toBe(2.3); // 25/10.8=2.31 ->2.3
    expect(days[3].balance).toBe(48.5);
    expect(days[3].economySource).toBe('inherited');
  });

  it('computes ledger summary totals matching sample', () => {
    const days = computeLedgerDays({ page, trips, economies: [10.5, null, 10.8, null] });
    const summary = computeLedgerSummary(days);
    expect(summary.totalDistance).toBe(190);
    expect(summary.totalDrawn).toBe(35.0);
    expect(summary.totalConsumed).toBe(17.9); // 5.9+6.2+3.5+2.3
    expect(summary.finalBalance).toBe(48.5);
    expect(summary.weightedEconomy).toBe(10.6); // 190/17.9=10.61 ->10.6
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

describe('computePageSeq', () => {
  it('returns 1..N page-wide sequence continuous across day groups', () => {
    const groups = [
      {
        date: '2024-10-21',
        dayLabel: 'Mon 21 Oct',
        dayIndex: 1,
        trips: [
          makeTrip({ date: '2024-10-21', page_id: 'p1', trip_index: 1 }),
          makeTrip({ date: '2024-10-21', page_id: 'p1', trip_index: 2 }),
          makeTrip({ date: '2024-10-21', page_id: 'p1', trip_index: 3 }),
        ],
        startKm: 100,
        endKm: 130,
        distance: 30,
        officialKm: 30,
        privateKm: 0,
      },
      {
        date: '2024-10-22',
        dayLabel: 'Tue 22 Oct',
        dayIndex: 2,
        trips: [
          makeTrip({ date: '2024-10-22', page_id: 'p1', trip_index: 1 }),
          makeTrip({ date: '2024-10-22', page_id: 'p1', trip_index: 2 }),
        ],
        startKm: 130,
        endKm: 155,
        distance: 25,
        officialKm: 25,
        privateKm: 0,
      },
    ];
    const seq = computePageSeq(groups);
    expect(seq).toEqual([1, 2, 3, 4, 5]);
  });

  it('returns empty array for empty day groups', () => {
    expect(computePageSeq([])).toEqual([]);
  });

  it('returns single-element array for one trip', () => {
    const groups = [
      {
        date: '2024-10-21',
        dayLabel: 'Mon 21 Oct',
        dayIndex: 1,
        trips: [makeTrip({ date: '2024-10-21', page_id: 'p1', trip_index: 1 })],
        startKm: 100,
        endKm: 110,
        distance: 10,
        officialKm: 10,
        privateKm: 0,
      },
    ];
    expect(computePageSeq(groups)).toEqual([1]);
  });
});

describe('computeGlobalSeq', () => {
  it('returns Map<tripId, seq> with independent global chronological sequence 1..T', () => {
    const trips = [
      makeTrip({ date: '2024-10-21', page_id: 'p1', trip_index: 1, start_km: 100, end_km: 110 }),
      makeTrip({ date: '2024-10-21', page_id: 'p1', trip_index: 2, start_km: 110, end_km: 120 }),
      makeTrip({ date: '2024-10-22', page_id: 'p1', trip_index: 1, start_km: 120, end_km: 135 }),
      makeTrip({ date: '2024-10-25', page_id: 'p2', trip_index: 1, start_km: 200, end_km: 215 }),
    ];
    const seq = computeGlobalSeq(trips);
    expect(seq.size).toBe(4);
    // Sorted: Oct 21 #1, Oct 21 #2, Oct 22 #1, Oct 25 #1
    expect(seq.get(trips[0].id)).toBe(1);
    expect(seq.get(trips[1].id)).toBe(2);
    expect(seq.get(trips[2].id)).toBe(3);
    expect(seq.get(trips[3].id)).toBe(4);
  });

  it('returns empty map for empty trips', () => {
    expect(computeGlobalSeq([]).size).toBe(0);
  });

  it('sorts chronologically by date then trip_index then start_km', () => {
    const t1 = makeTrip({ date: '2024-10-22', page_id: 'p1', trip_index: 1, start_km: 200, end_km: 210 });
    const t2 = makeTrip({ date: '2024-10-21', page_id: 'p1', trip_index: 2, start_km: 110, end_km: 120 });
    const t3 = makeTrip({ date: '2024-10-21', page_id: 'p1', trip_index: 1, start_km: 100, end_km: 110 });
    const seq = computeGlobalSeq([t1, t2, t3]);
    // Sorted: t3 (Oct 21 #1), t2 (Oct 21 #2), t1 (Oct 22 #1)
    expect(seq.get(t3.id)).toBe(1);
    expect(seq.get(t2.id)).toBe(2);
    expect(seq.get(t1.id)).toBe(3);
  });
});
