import { describe, it, expect } from 'vitest';
import {
  getPageEarliestDate,
  getEarliestOverallDate,
  isBackdatedInsertion,
  renumberPagesChronologically,
  recalculatePageBalancesFromOpening,
  validatePaginationConstraints,
  validateOdometerContinuity,
  validateFuelContinuity,
} from './pagination';
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
  return { ...base, ...overrides };
}

function makePage(overrides: Partial<BookPage>): BookPage {
  return {
    id: overrides.id ?? `page-${overrides.page_number ?? 1}`,
    vehicle_id: 'veh-1',
    page_number: overrides.page_number ?? 1,
    month: overrides.month ?? '2026-01',
    start_km: overrides.start_km ?? 50000,
    end_km: overrides.end_km ?? 50100,
    start_fuel_balance: overrides.start_fuel_balance ?? 10,
    end_fuel_balance: overrides.end_fuel_balance ?? 8,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('Chronological Page Renumbering & Book Opening (Issue 02)', () => {
  describe('getPageEarliestDate', () => {
    it('returns earliest trip date for page', () => {
      const page = makePage({ id: 'page-1', page_number: 1 });
      const trips = [
        makeTrip({ date: '2026-01-05', page_id: 'page-1' }),
        makeTrip({ date: '2026-01-03', page_id: 'page-1' }),
        makeTrip({ date: '2026-01-04', page_id: 'page-1' }),
      ];
      expect(getPageEarliestDate(page, trips)).toBe('2026-01-03');
    });
    it('falls back to month-01 when no trips', () => {
      const page = makePage({ id: 'page-1', month: '2025-12' });
      expect(getPageEarliestDate(page, [])).toBe('2025-12-01');
    });
  });

  describe('isBackdatedInsertion', () => {
    it('detects backdated trip earlier than earliest page', () => {
      const pages = [makePage({ id: 'page-1', page_number: 1, month: '2026-01' })];
      const trips = [makeTrip({ date: '2026-01-01', page_id: 'page-1' })];
      expect(isBackdatedInsertion(pages, trips, '2025-01-01')).toBe(true);
      expect(isBackdatedInsertion(pages, trips, '2026-01-02')).toBe(false);
      expect(isBackdatedInsertion(pages, trips, '2026-01-01')).toBe(false);
    });
  });

  describe('renumberPagesChronologically', () => {
    it('sorts pages chronologically and reassigns page_number/page_id sequentially, cascading Trip.page_id, dates never mutated', () => {
      // Book starts 2026-01-01 Page 1 at 50,000 km / 10 L, later 2025-01-01 trips inserted as new Page 2
      const page1 = makePage({ id: 'page-1', page_number: 1, month: '2026-01', start_km: 50000, end_km: 50100, start_fuel_balance: 10, end_fuel_balance: 9 });
      const page2 = makePage({ id: 'page-2', page_number: 2, month: '2025-01', start_km: 48000, end_km: 49000, start_fuel_balance: 8, end_fuel_balance: 7 });
      const trips = [
        makeTrip({ date: '2026-01-15', page_id: 'page-1', start_km: 50000, end_km: 50100, trip_distance: 100 }),
        makeTrip({ date: '2025-01-10', page_id: 'page-2', start_km: 48000, end_km: 48500, trip_distance: 500 }),
        makeTrip({ date: '2025-01-11', page_id: 'page-2', start_km: 48500, end_km: 49000, trip_distance: 500 }),
      ];
      const originalDates = trips.map((t) => t.date);

      const { pages: renumbered, trips: renumberedTrips } = renumberPagesChronologically([page1, page2], trips);

      // Pages sorted chronologically: 2025 page becomes page 1, 2026 page becomes page 2
      expect(renumbered[0].page_number).toBe(1);
      expect(renumbered[0].id).toBe('page-1');
      expect(renumbered[1].page_number).toBe(2);
      expect(renumbered[1].id).toBe('page-2');
      // The 2025 page should now be first
      expect(getPageEarliestDate(renumbered[0], renumberedTrips)).toBe('2025-01-10');
      expect(getPageEarliestDate(renumbered[1], renumberedTrips)).toBe('2026-01-15');

      // Trip page_id cascaded
      const trip2025 = renumberedTrips.filter((t) => t.date.startsWith('2025'));
      expect(trip2025.every((t) => t.page_id === 'page-1')).toBe(true);
      const trip2026 = renumberedTrips.filter((t) => t.date.startsWith('2026'));
      expect(trip2026.every((t) => t.page_id === 'page-2')).toBe(true);

      // Dates never mutated
      expect(renumberedTrips.map((t) => t.date).sort()).toEqual(originalDates.sort());
    });

    it('keeps dates immutable and handles already sorted pages (no change)', () => {
      const pages = [
        makePage({ id: 'page-1', page_number: 1, month: '2025-01' }),
        makePage({ id: 'page-2', page_number: 2, month: '2026-01' }),
      ];
      const trips = [
        makeTrip({ date: '2025-01-01', page_id: 'page-1' }),
        makeTrip({ date: '2026-01-01', page_id: 'page-2' }),
      ];
      const { pages: renumbered } = renumberPagesChronologically(pages, trips);
      expect(renumbered[0].page_number).toBe(1);
      expect(renumbered[1].page_number).toBe(2);
    });

    it('handles single page (no renumber needed)', () => {
      const pages = [makePage({ id: 'page-1', page_number: 1 })];
      const trips = [makeTrip({ date: '2026-01-01', page_id: 'page-1' })];
      const { pages: renumbered } = renumberPagesChronologically(pages, trips);
      expect(renumbered.length).toBe(1);
      expect(renumbered[0].page_number).toBe(1);
    });
  });

  describe('Book Opening editable and fuel balances recalculated forward', () => {
    it('recalculates fuel balances forward from Book Opening, limited to earliest Page forward', () => {
      // Page 1: 2025-01-01, 100 km, 0 drawn; Page 2: 2026-01-01, 100 km, 0 drawn; economy 10.5
      const pages = [
        makePage({ id: 'page-1', page_number: 1, month: '2025-01', start_km: 48000, end_km: 48100, start_fuel_balance: 10, end_fuel_balance: 5 }),
        makePage({ id: 'page-2', page_number: 2, month: '2026-01', start_km: 50000, end_km: 50100, start_fuel_balance: 5, end_fuel_balance: 0 }),
      ];
      const trips = [
        makeTrip({ date: '2025-01-01', page_id: 'page-1', trip_distance: 100, fuel_pumped_amount: 0, start_km: 48000, end_km: 48100 }),
        makeTrip({ date: '2026-01-01', page_id: 'page-2', trip_distance: 100, fuel_pumped_amount: 0, start_km: 50000, end_km: 50100 }),
      ];
      const opening = { openingKm: 48000, openingFuel: 10 };
      const recalculated = recalculatePageBalancesFromOpening({ pages, trips, opening, economy: 10.5 });

      // Page 1: start 48000, totalDistance 100 => consumed 9.5 (100/10.5=9.52->9.5), endFuel 10-9.5=0.5
      expect(recalculated[0].start_km).toBe(48000);
      expect(recalculated[0].start_fuel_balance).toBe(10);
      expect(recalculated[0].end_fuel_balance).toBe(0.5);

      // Page 2: start = prev end 0.5, consumed 9.5 => end -9.0 (0.5-9.5)
      expect(recalculated[1].start_km).toBe(recalculated[0].end_km);
      expect(recalculated[1].start_fuel_balance).toBe(0.5);
      // end_fuel = 0.5 +0 -9.5 = -9.0
      expect(recalculated[1].end_fuel_balance).toBe(-9.0);
    });

    it('re-editing Book Opening recalculates forward correctly (opening fuel change)', () => {
      const pages = [
        makePage({ id: 'page-1', page_number: 1, month: '2025-01', start_km: 48000, end_km: 48100, start_fuel_balance: 10, end_fuel_balance: 0.5 }),
        makePage({ id: 'page-2', page_number: 2, month: '2026-01', start_km: 48100, end_km: 48200, start_fuel_balance: 0.5, end_fuel_balance: -9.0 }),
      ];
      const trips = [
        makeTrip({ date: '2025-01-01', page_id: 'page-1', trip_distance: 100, fuel_pumped_amount: 0 }),
        makeTrip({ date: '2026-01-01', page_id: 'page-2', trip_distance: 100, fuel_pumped_amount: 20, start_km: 48100, end_km: 48200 }),
      ];
      // Re-enter opening fuel from 10 to 15
      const recalculated = recalculatePageBalancesFromOpening({ pages, trips, opening: { openingKm: 48000, openingFuel: 15 }, economy: 10.5 });
      expect(recalculated[0].start_fuel_balance).toBe(15);
      // Page1 end =15-9.5=5.5
      expect(recalculated[0].end_fuel_balance).toBe(5.5);
      // Page2 start 5.5, drawn 20, consumed 9.5 => 5.5+20-9.5=16.0
      expect(recalculated[1].start_fuel_balance).toBe(5.5);
      expect(recalculated[1].end_fuel_balance).toBe(16.0);
    });

    it('end-to-end: book starts 2026-01-01 Page 1 at 50000/10L, add 2025 trips, renumber, Opening re-entered', () => {
      // Initial book: Page 1 2026
      const initialPage = makePage({ id: 'page-1', page_number: 1, month: '2026-01', start_km: 50000, end_km: 50100, start_fuel_balance: 10, end_fuel_balance: 0.5 });
      const initialTrips = [makeTrip({ date: '2026-01-01', page_id: 'page-1', trip_distance: 100, fuel_pumped_amount: 0, start_km: 50000, end_km: 50100 })];

      // Later: 2025 trips inserted as Page 2 (simulating tripStore new page at end)
      const page2025a = makePage({ id: 'page-2', page_number: 2, month: '2025-01', start_km: 48000, end_km: 48100, start_fuel_balance: 8, end_fuel_balance: 7 });
      const trips2025 = [
        makeTrip({ date: '2025-01-01', page_id: 'page-2', trip_distance: 50, fuel_pumped_amount: 5, start_km: 48000, end_km: 48050 }),
        makeTrip({ date: '2025-01-02', page_id: 'page-2', trip_distance: 50, fuel_pumped_amount: 0, start_km: 48050, end_km: 48100 }),
      ];

      const allPages = [initialPage, page2025a];
      const allTrips = [...initialTrips, ...trips2025];

      // Renumber chronologically
      const { pages: renumbered, trips: renumberedTrips } = renumberPagesChronologically(allPages, allTrips);
      expect(renumbered[0].page_number).toBe(1);
      expect(getPageEarliestDate(renumbered[0], renumberedTrips)).toBe('2025-01-01');
      expect(renumbered[1].page_number).toBe(2);
      expect(getPageEarliestDate(renumbered[1], renumberedTrips)).toBe('2026-01-01');

      // Re-enter Opening Fuel as 12L on earliest page and recalc forward
      const opening = { openingKm: 48000, openingFuel: 12 };
      const recalculated = recalculatePageBalancesFromOpening({ pages: renumbered, trips: renumberedTrips, opening });

      // Ledger balances replay correctly: page1 start 12, distance 100 (50+50), drawn 5, consumed 9.5 => end 7.5
      expect(recalculated[0].start_fuel_balance).toBe(12);
      // page1 total distance 100, drawn 5, consumed 9.5 => 12+5-9.5=7.5
      expect(recalculated[0].end_fuel_balance).toBe(7.5);
      // page2 start 7.5, distance 100, drawn 0, consumed 9.5 => -2.0
      expect(recalculated[1].start_fuel_balance).toBe(7.5);
    });
  });

  describe('Pagination constraints still enforced during renumber', () => {
    it('flags violations if renumbered pages exceed 4 days', () => {
      const page = makePage({ id: 'page-1', page_number: 1, month: '2026-01' });
      const trips = [
        makeTrip({ date: '2026-01-01', page_id: 'page-1' }),
        makeTrip({ date: '2026-01-02', page_id: 'page-1' }),
        makeTrip({ date: '2026-01-03', page_id: 'page-1' }),
        makeTrip({ date: '2026-01-04', page_id: 'page-1' }),
        makeTrip({ date: '2026-01-05', page_id: 'page-1' }),
      ];
      const violations = validatePaginationConstraints([page], trips);
      expect(violations.length).toBe(1);
      expect(violations[0].violation).toContain('MAX_DAYS');
    });

    it('no violations for valid pages after renumber', () => {
      const pages = [
        makePage({ id: 'page-1', page_number: 1, month: '2025-01' }),
        makePage({ id: 'page-2', page_number: 2, month: '2026-01' }),
      ];
      const trips = [
        makeTrip({ date: '2025-01-01', page_id: 'page-1' }),
        makeTrip({ date: '2025-01-02', page_id: 'page-1' }),
        makeTrip({ date: '2026-01-01', page_id: 'page-2' }),
      ];
      const { pages: renumbered, trips: renumberedTrips } = renumberPagesChronologically(pages, trips);
      const violations = validatePaginationConstraints(renumbered, renumberedTrips);
      expect(violations.length).toBe(0);
    });
  });

  describe('Continuity invariants hold after renumber', () => {
    it('Page N End KM = Page N+1 Start KM and End Fuel = next Start Fuel after recalc', () => {
      const pages = [
        makePage({ id: 'page-2', page_number: 2, month: '2026-01', start_km: 50000, end_km: 50100, start_fuel_balance: 10, end_fuel_balance: 5 }),
        makePage({ id: 'page-1', page_number: 1, month: '2025-01', start_km: 49000, end_km: 49500, start_fuel_balance: 8, end_fuel_balance: 7 }),
      ];
      const trips = [
        makeTrip({ date: '2026-01-01', page_id: 'page-2', trip_distance: 100, fuel_pumped_amount: 0, start_km: 50000, end_km: 50100 }),
        makeTrip({ date: '2025-01-01', page_id: 'page-1', trip_distance: 50, fuel_pumped_amount: 5, start_km: 49000, end_km: 49050 }),
        makeTrip({ date: '2025-01-02', page_id: 'page-1', trip_distance: 50, fuel_pumped_amount: 0, start_km: 49050, end_km: 49100 }),
      ];
      const { pages: renumbered, trips: renumberedTrips } = renumberPagesChronologically(pages, trips);
      const opening = { openingKm: 49000, openingFuel: 10 };
      const recalculated = recalculatePageBalancesFromOpening({ pages: renumbered, trips: renumberedTrips, opening });

      const odo = validateOdometerContinuity(recalculated);
      const fuel = validateFuelContinuity(recalculated);
      expect(odo.isValid).toBe(true);
      expect(fuel.isValid).toBe(true);
      expect(odo.breaks).toEqual([]);
      expect(fuel.breaks).toEqual([]);
    });
  });
});
