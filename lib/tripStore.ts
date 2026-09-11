import { Trip, BookPage } from '@/types';
import { supabase, isSupabaseConfigured } from './supabase/client';
import { getVehicleProfile, saveVehicleProfile, DEFAULT_VEHICLE } from './vehicleStore';
import { assignPageForNewTrip, calculateConsumed, calculateBalance } from './pagination';
import { getPages, savePage, createNextPage, updatePageEndValues } from './pageStore';
import { getMonthKey } from './pagination';
import { roundToOneDecimal, roundToIntegerKm } from './tripCalculations';

const LOCAL_STORAGE_KEY = 'fleetledger_trips';

export interface TripInput {
  date: string;
  start_time: string; // may be "" (optional); Estimated Start Time fills when empty
  end_time: string;
  start_km: number; // Integer KM
  end_km: number; // Integer KM
  trip_distance: number; // Integer KM
  trip_type: 'Official' | 'Private';
  places_visited: string;
  fuel_pumped_amount?: number;
  fuel_order_no?: string;
  fuel_order_date?: string;
}

function readLocalTrips(): Trip[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored) as Trip[];
  } catch {
    return [];
  }
}

function writeLocalTrips(trips: Trip[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(trips));
}

export async function getTrips(): Promise<Trip[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.from('trips').select('*').order('created_at', { ascending: true });
      if (data && !error) {
        return data as Trip[];
      }
    } catch (e) {
      console.warn('Failed to fetch trips from Supabase, falling back to local storage', e);
    }
  }
  return readLocalTrips();
}

export async function getLastEndKm(): Promise<number> {
  const trips = await getTrips();
  if (trips.length > 0) {
    // Last trip by insertion order (or by highest end_km if needed)
    const last = trips[trips.length - 1];
    return last.end_km;
  }
  // Fallback to vehicle odometer
  try {
    const vehicle = await getVehicleProfile();
    return vehicle.current_odometer;
  } catch {
    return DEFAULT_VEHICLE.current_odometer;
  }
}

export async function saveTrip(input: TripInput): Promise<Trip> {
  const vehicle = await getVehicleProfile();
  // Load pages and trips for pagination assignment
  const pages: BookPage[] = await getPages();
  const tripsLocal = readLocalTrips();
  // For Supabase fallback, also consider remote trips if configured? Use local snapshot + remote via getTrips()
  // Use combined view: if Supabase configured, fetch remote, else local
  let allTrips: Trip[];
  if (isSupabaseConfigured && supabase) {
    try {
      const remote = await getTrips();
      // Merge union of remote and local to avoid losing unsynced trips (deduplicate by id)
      const seen = new Set(remote.map((t) => t.id));
      const localOnly = tripsLocal.filter((t) => !seen.has(t.id));
      allTrips = [...remote, ...localOnly];
    } catch {
      allTrips = tripsLocal;
    }
  } else {
    allTrips = tripsLocal;
  }

  let targetPage: BookPage | null = null;
  let dayIndex = 1;
  let tripIndex = 1;
  let pageId = '';

  if (pages.length === 0) {
    // Create initial page 1 with vehicle continuity (fuel balance includes pumped minus consumed)
    const defaultEconomy = 10.5;
    const consumed = calculateConsumed(roundToIntegerKm(input.trip_distance), defaultEconomy);
    const initialFuelEnd = calculateBalance(
      roundToOneDecimal(vehicle.current_fuel_level),
      roundToOneDecimal(input.fuel_pumped_amount ?? 0),
      consumed
    );
    const initialPage: BookPage = {
      id: `page-1`,
      vehicle_id: vehicle.id,
      page_number: 1,
      month: getMonthKey(input.date),
      start_km: roundToIntegerKm(vehicle.current_odometer),
      end_km: roundToIntegerKm(input.end_km),
      start_fuel_balance: roundToOneDecimal(vehicle.current_fuel_level),
      end_fuel_balance: initialFuelEnd,
      created_at: new Date().toISOString(),
    };
    await savePage(initialPage);
    targetPage = initialPage;
    pageId = initialPage.id;
    dayIndex = 1;
    tripIndex = 1;
  } else {
    const assignment = assignPageForNewTrip({ pages, trips: allTrips, newTripDate: input.date });

    if ('allowed' in assignment && assignment.allowed === false) {
      throw new Error(`Cannot add trip: ${assignment.reason} limit reached for ${input.date}`);
    }

    const assign = assignment as { pageNumber: number; pageId: string; dayIndex: number; tripIndex: number; requiresNewPage: boolean; reason?: string };

    if (assign.requiresNewPage) {
      // Need to create new page with continuity from last page
      const current = [...pages].sort((a, b) => a.page_number - b.page_number)[pages.length - 1];
      const newPage = await createNextPage(current, input.date, vehicle.id);
      // Update end values to reflect this first trip on new page (carry forward fuel with consumption)
      const defaultEconomy = 10.5;
      const consumed = calculateConsumed(roundToIntegerKm(input.trip_distance), defaultEconomy);
      newPage.end_km = roundToIntegerKm(input.end_km);
      newPage.end_fuel_balance = calculateBalance(
        roundToOneDecimal(newPage.start_fuel_balance),
        roundToOneDecimal(input.fuel_pumped_amount ?? 0),
        consumed
      );
      await savePage(newPage);
      targetPage = newPage;
      pageId = newPage.id;
      dayIndex = 1;
      tripIndex = 1;
    } else {
      // Existing page
      targetPage = pages.find((p) => p.id === assign.pageId) || pages[pages.length - 1];
      pageId = targetPage.id;
      dayIndex = assign.dayIndex;
      tripIndex = assign.tripIndex;
      // Update page end values for continuity forward
      const newEndKm = roundToIntegerKm(input.end_km);
      const fuelPumped = roundToOneDecimal(input.fuel_pumped_amount ?? 0);
      const defaultEconomy = 10.5;
      const consumed = calculateConsumed(roundToIntegerKm(input.trip_distance), defaultEconomy);
      const newEndFuel = calculateBalance(roundToOneDecimal(targetPage.end_fuel_balance), fuelPumped, consumed);
      await updatePageEndValues(targetPage.id, newEndKm, newEndFuel);
      targetPage.end_km = newEndKm;
      targetPage.end_fuel_balance = newEndFuel;
    }
  }

  const newTrip: Trip = {
    id: `trip-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    page_id: pageId,
    vehicle_id: vehicle.id,
    date: input.date,
    day_index: dayIndex,
    trip_index: tripIndex,
    start_time: input.start_time ?? '',
    end_time: input.end_time,
    start_km: roundToIntegerKm(input.start_km),
    end_km: roundToIntegerKm(input.end_km),
    trip_distance: roundToIntegerKm(input.trip_distance),
    trip_type: input.trip_type,
    places_visited: input.places_visited,
    fuel_pumped_amount: input.fuel_pumped_amount ?? 0,
    fuel_order_no: input.fuel_order_no ?? '',
    created_at: new Date().toISOString(),
  };

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.from('trips').insert([newTrip]).select().single();
      if (data && !error) {
        await saveVehicleProfile({ current_odometer: roundToIntegerKm(input.end_km) });
        await saveVehicleProfile({ current_fuel_level: roundToOneDecimal(targetPage!.end_fuel_balance) });
        return data as Trip;
      }
    } catch (e) {
      console.warn('Failed to save trip to Supabase, saving to local storage', e);
    }
  }

  const updated = [...readLocalTrips(), newTrip];
  writeLocalTrips(updated);

  try {
    await saveVehicleProfile({ current_odometer: roundToIntegerKm(input.end_km) });
    await saveVehicleProfile({ current_fuel_level: roundToOneDecimal(targetPage!.end_fuel_balance) });
  } catch (e) {
    console.warn('Failed to update vehicle odometer', e);
  }

  return newTrip;
}

export function clearTrips(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  }
}
