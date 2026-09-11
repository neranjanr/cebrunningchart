import { describe, it, expect, beforeEach } from 'vitest';
import { saveTrip, clearTrips } from './tripStore';
import { getPages, clearPages } from './pageStore';
import { validateOdometerContinuity, validateFuelContinuity } from './pagination';
import { clearTrips as clearTripsAlias } from './tripStore';

describe('tripStore + pageStore integration - pagination continuity', () => {
  beforeEach(() => {
    localStorage.clear();
    clearTrips();
    clearPages();
  });

  it('creates new page on 5th distinct day (max 4 days per page)', async () => {
    // Save 4 trips on 4 distinct days on page 1
    for (let i = 21; i <= 24; i++) {
      const date = `2024-10-${String(i).padStart(2, '0')}`;
      await saveTrip({
        date,
        start_time: '08:00',
        end_time: '09:00',
        start_km: 100 + (i - 21) * 10,
        end_km: 110 + (i - 21) * 10,
        trip_distance: 10,
        trip_type: 'Official',
        places_visited: `Trip day ${i}`,
      });
    }
    let pages = await getPages();
    expect(pages.length).toBe(1);
    expect(pages[0].page_number).toBe(1);

    // 5th distinct day should create page 2
    await saveTrip({
      date: '2024-10-25',
      start_time: '08:00',
      end_time: '09:00',
      start_km: 140,
      end_km: 150,
      trip_distance: 10,
      trip_type: 'Official',
      places_visited: '5th day',
    });
    pages = await getPages();
    expect(pages.length).toBe(2);
    expect(pages[1].page_number).toBe(2);
    expect(pages[1].month).toBe('2024-10');
    // Odometer continuity: page1 end == page2 start
    const odo = validateOdometerContinuity(pages);
    expect(odo.isValid).toBe(true);
    const fuel = validateFuelContinuity(pages);
    expect(fuel.isValid).toBe(true);
  });

  it('forces new page on month rollover even with space left', async () => {
    await saveTrip({
      date: '2024-10-31',
      start_time: '08:00',
      end_time: '09:00',
      start_km: 100,
      end_km: 110,
      trip_distance: 10,
      trip_type: 'Official',
      places_visited: 'Oct end',
    });
    let pages = await getPages();
    expect(pages[0].month).toBe('2024-10');

    await saveTrip({
      date: '2024-11-01',
      start_time: '08:00',
      end_time: '09:00',
      start_km: 110,
      end_km: 120,
      trip_distance: 10,
      trip_type: 'Official',
      places_visited: 'Nov start',
    });
    pages = await getPages();
    expect(pages.length).toBe(2);
    expect(pages[1].month).toBe('2024-11');
    expect(pages[1].start_km).toBe(pages[0].end_km);
    expect(pages[1].start_fuel_balance).toBe(pages[0].end_fuel_balance);
  });

  it('blocks 14th trip on same day (max 13 trips per day)', async () => {
    for (let i = 1; i <= 13; i++) {
      await saveTrip({
        date: '2024-10-21',
        start_time: '08:00',
        end_time: '09:00',
        start_km: 100 + i,
        end_km: 101 + i,
        trip_distance: 1,
        trip_type: 'Official',
        places_visited: `Trip ${i}`,
      });
    }
    // 14th should throw
    await expect(
      saveTrip({
        date: '2024-10-21',
        start_time: '10:00',
        end_time: '11:00',
        start_km: 115,
        end_km: 116,
        trip_distance: 1,
        trip_type: 'Official',
        places_visited: '14th trip - should fail',
      })
    ).rejects.toThrow(/MAX_TRIPS_PER_DAY/);
  });

  it('maintains odometer and fuel continuity across multiple pages', async () => {
    // Create 2 pages via 5 days
    const dates = ['2024-10-21', '2024-10-22', '2024-10-23', '2024-10-24', '2024-10-25', '2024-10-26'];
    let km = 100;
    for (const d of dates) {
      await saveTrip({
        date: d,
        start_time: '08:00',
        end_time: '09:00',
        start_km: km,
        end_km: km + 10,
        trip_distance: 10,
        trip_type: 'Official',
        places_visited: `Day ${d}`,
        fuel_pumped_amount: d === '2024-10-23' ? 20 : 0,
      });
      km += 10;
    }
    const pages = await getPages();
    // 6 distinct days -> page1 has 4 days, page2 has 2 days => 2 pages
    expect(pages.length).toBe(2);
    expect(validateOdometerContinuity(pages).isValid).toBe(true);
    expect(validateFuelContinuity(pages).isValid).toBe(true);
  });

  it('assigns correct dayIndex and tripIndex', async () => {
    const trip1 = await saveTrip({
      date: '2024-10-21',
      start_time: '08:00',
      end_time: '09:00',
      start_km: 100,
      end_km: 110,
      trip_distance: 10,
      trip_type: 'Official',
      places_visited: 'A',
    });
    expect(trip1.day_index).toBe(1);
    expect(trip1.trip_index).toBe(1);

    const trip2 = await saveTrip({
      date: '2024-10-21',
      start_time: '10:00',
      end_time: '11:00',
      start_km: 110,
      end_km: 120,
      trip_distance: 10,
      trip_type: 'Official',
      places_visited: 'B',
    });
    expect(trip2.day_index).toBe(1);
    expect(trip2.trip_index).toBe(2);

    const trip3 = await saveTrip({
      date: '2024-10-22',
      start_time: '08:00',
      end_time: '09:00',
      start_km: 120,
      end_km: 130,
      trip_distance: 10,
      trip_type: 'Official',
      places_visited: 'Next day',
    });
    expect(trip3.day_index).toBe(2);
    expect(trip3.trip_index).toBe(1);
  });
});
