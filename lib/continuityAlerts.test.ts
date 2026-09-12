import { describe, it, expect } from 'vitest';
import { detectPageGaps, detectTripGaps, detectDayGroupFuelGaps, type FuelGap } from './continuityAlerts';
import type { BookPage, Trip } from '@/types';
import type { LedgerDay } from '@/lib/ledgerCalculations';

describe('continuityAlerts', () => {
  it('detects page-to-page KM (RED) and Fuel (AMBER) gaps', () => {
    const pages: BookPage[] = [
      { id: 'p1', vehicle_id: 'v1', page_number: 1, month: '2026-01', start_km: 50000, end_km: 50200, start_fuel_balance: 10, end_fuel_balance: 25 },
      { id: 'p2', vehicle_id: 'v1', page_number: 2, month: '2026-01', start_km: 50190, end_km: 50400, start_fuel_balance: 24, end_fuel_balance: 30 },
    ] as any;

    const gaps = detectPageGaps(pages);
    expect(gaps).toHaveLength(2);
    expect(gaps.some((g) => g.kind === 'km' && g.pageNumber === 2)).toBe(true);
    expect(gaps.some((g) => g.kind === 'fuel' && g.pageNumber === 2)).toBe(true);
  });

  it('detects trip-to-trip KM gaps', () => {
    const trips: Trip[] = [
      { id: 't1', vehicle_id: 'v1', page_id: 'p1', day_index: 1, trip_index: 1, date: '2026-01-01', start_km: 50000, end_km: 50050, trip_distance: 50, start_time: '08:00', end_time: '09:00', trip_type: 'Official', places_visited: 'A' },
      { id: 't2', vehicle_id: 'v1', page_id: 'p1', day_index: 1, trip_index: 2, date: '2026-01-01', start_km: 50060, end_km: 50100, trip_distance: 40, start_time: '09:00', end_time: '10:00', trip_type: 'Official', places_visited: 'B' },
    ] as any;

    const gaps = detectTripGaps(trips);
    expect(gaps).toHaveLength(1);
    expect(gaps[0].kind).toBe('km');
    expect(gaps[0].expected).toBe(50050);
    expect(gaps[0].actual).toBe(50060);
  });

  it('no KM gaps when trips are continuous', () => {
    const trips: Trip[] = [
      { id: 't1', vehicle_id: 'v1', page_id: 'p1', day_index: 1, trip_index: 1, date: '2026-01-01', start_km: 50000, end_km: 50050, trip_distance: 50, start_time: '08:00', end_time: '09:00', trip_type: 'Official', places_visited: 'A' },
      { id: 't2', vehicle_id: 'v1', page_id: 'p1', day_index: 1, trip_index: 2, date: '2026-01-01', start_km: 50050, end_km: 50100, trip_distance: 50, start_time: '09:00', end_time: '10:00', trip_type: 'Official', places_visited: 'B' },
    ] as any;

    const gaps = detectTripGaps(trips);
    expect(gaps).toHaveLength(0);
  });
});

describe('detectDayGroupFuelGaps', () => {
  it('detects fuel gap between consecutive day groups when closing balance != next position', () => {
    const days: LedgerDay[] = [
      { dayIndex: 1, date: '2026-01-01', dayLabel: 'Thu 1 Jan', startKm: 50000, endKm: 50050, distance: 50, fuelEconomy: 10, economySource: 'fallback', fuelPosition: 10, inTank: 0, drawn: 0, fuelOrderNo: '', fuelOrderDate: '', consumed: 5, balance: 5 },
      { dayIndex: 2, date: '2026-01-02', dayLabel: 'Fri 2 Jan', startKm: 50050, endKm: 50100, distance: 50, fuelEconomy: 10, economySource: 'inherited', fuelPosition: 6, inTank: 0, drawn: 0, fuelOrderNo: '', fuelOrderDate: '', consumed: 5, balance: 1 },
    ] as any;

    const gaps = detectDayGroupFuelGaps(days);
    expect(gaps).toHaveLength(1);
    expect(gaps[0].kind).toBe('fuel');
    expect(gaps[0].expected).toBe(5);
    expect(gaps[0].actual).toBe(6);
    expect(gaps[0].date).toBe('2026-01-02');
  });

  it('no fuel gap when closing balance equals next position', () => {
    const days: LedgerDay[] = [
      { dayIndex: 1, date: '2026-01-01', dayLabel: 'Thu 1 Jan', startKm: 50000, endKm: 50050, distance: 50, fuelEconomy: 10, economySource: 'fallback', fuelPosition: 10, inTank: 0, drawn: 0, fuelOrderNo: '', fuelOrderDate: '', consumed: 5, balance: 5 },
      { dayIndex: 2, date: '2026-01-02', dayLabel: 'Fri 2 Jan', startKm: 50050, endKm: 50100, distance: 50, fuelEconomy: 10, economySource: 'inherited', fuelPosition: 5, inTank: 0, drawn: 0, fuelOrderNo: '', fuelOrderDate: '', consumed: 5, balance: 0 },
    ] as any;

    const gaps = detectDayGroupFuelGaps(days);
    expect(gaps).toHaveLength(0);
  });

  it('returns empty array for single day group', () => {
    const days: LedgerDay[] = [
      { dayIndex: 1, date: '2026-01-01', dayLabel: 'Thu 1 Jan', startKm: 50000, endKm: 50050, distance: 50, fuelEconomy: 10, economySource: 'fallback', fuelPosition: 10, inTank: 0, drawn: 0, fuelOrderNo: '', fuelOrderDate: '', consumed: 5, balance: 5 },
    ] as any;

    const gaps = detectDayGroupFuelGaps(days);
    expect(gaps).toHaveLength(0);
  });

  it('returns empty array for empty days', () => {
    const gaps = detectDayGroupFuelGaps([]);
    expect(gaps).toHaveLength(0);
  });
});
