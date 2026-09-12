import { describe, it, expect } from 'vitest';
import { detectPageGaps, detectTripGaps } from './continuityAlerts';
import type { BookPage, Trip } from '@/types';

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
});
