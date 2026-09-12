import { describe, it, expect } from 'vitest';
import { generateAllTripsBuffer, parseAllTripsWorkbook } from './allTripsWorkbook';
import type { Trip } from '@/types';

describe('allTripsWorkbook', () => {
  it('generates and parses workbook round-trip correctly', async () => {
    const mockTrips: Trip[] = [
      {
        id: 't1',
        vehicle_id: 'veh-1',
        page_id: 'page-1',
        day_index: 1,
        trip_index: 1,
        date: '2026-01-01',
        start_km: 50000,
        end_km: 50050,
        trip_distance: 50,
        start_time: '08:00',
        end_time: '09:00',
        trip_type: 'Official',
        places_visited: 'HQ to Branch',
        fuel_pumped_amount: 15.5,
        fuel_order_no: 'PO-100',
      },
    ];

    const buf = await generateAllTripsBuffer(mockTrips, { brand: 'Toyota', model: 'Camry' });
    expect(buf).toBeDefined();

    const parseRes = await parseAllTripsWorkbook(buf);
    if (!parseRes.valid) {
      console.log('Import errors:', parseRes.errors);
    }
    expect(parseRes.valid).toBe(true);
    expect(parseRes.trips).toHaveLength(1);
    expect(parseRes.trips[0].date).toBe('2026-01-01');
    expect(parseRes.trips[0].start_km).toBe(50000);
    expect(parseRes.trips[0].end_km).toBe(50050);
  });

  it('validates missing essential fields on import', async () => {
    // Generate buffer with missing End Time or Places Visited
    // Or parse empty/invalid buffer
    const badBuf = new ArrayBuffer(10);
    const parseRes = await parseAllTripsWorkbook(badBuf);
    expect(parseRes.valid).toBe(false);
    expect(parseRes.errors.length).toBeGreaterThan(0);
  });
});
