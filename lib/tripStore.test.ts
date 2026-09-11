import { describe, it, expect, beforeEach } from 'vitest';
import { getTrips, saveTrip, getLastEndKm, clearTrips } from './tripStore';
import { DEFAULT_VEHICLE } from './vehicleStore';

describe('tripStore', () => {
  beforeEach(() => {
    localStorage.clear();
    clearTrips(); // ensure clean state
  });

  it('returns empty array when no trips stored', async () => {
    const trips = await getTrips();
    expect(trips).toEqual([]);
  });

  it('getLastEndKm returns vehicle odometer when no trips', async () => {
    const endKm = await getLastEndKm();
    expect(endKm).toBe(DEFAULT_VEHICLE.current_odometer);
  });

  it('saves trip and retrieval works', async () => {
    const trip = await saveTrip({
      date: '2024-10-21',
      start_time: '08:15',
      end_time: '09:10',
      start_km: 142684.2,
      end_km: 142708.5,
      trip_distance: 24.3,
      trip_type: 'Official',
      places_visited: 'HQ Fleet Yard -> Regional Port Customs',
      fuel_pumped_amount: 0,
      fuel_order_no: '',
    });

    expect(trip.id).toBeDefined();
    expect(trip.trip_distance).toBe(24.3);

    const trips = await getTrips();
    expect(trips.length).toBe(1);
    expect(trips[0].end_km).toBe(142708.5);
  });

  it('getLastEndKm returns last trip end_km after saving', async () => {
    await saveTrip({
      date: '2024-10-21',
      start_time: '08:15',
      end_time: '09:10',
      start_km: 142684.2,
      end_km: 142708.5,
      trip_distance: 24.3,
      trip_type: 'Official',
      places_visited: 'HQ',
    });

    await saveTrip({
      date: '2024-10-21',
      start_time: '11:30',
      end_time: '12:20',
      start_km: 142708.5,
      end_km: 142729.5,
      trip_distance: 21.0,
      trip_type: 'Official',
      places_visited: 'Port',
    });

    const lastEnd = await getLastEndKm();
    expect(lastEnd).toBe(142729.5);
  });

  it('clears trips', async () => {
    await saveTrip({
      date: '2024-10-21',
      start_time: '08:15',
      end_time: '09:10',
      start_km: 100,
      end_km: 110,
      trip_distance: 10,
      trip_type: 'Official',
      places_visited: 'A -> B',
    });
    clearTrips();
    const trips = await getTrips();
    expect(trips.length).toBe(0);
  });
});
