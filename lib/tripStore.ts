import { Trip } from '@/types';
import { supabase, isSupabaseConfigured } from './supabase/client';
import { getVehicleProfile, saveVehicleProfile, DEFAULT_VEHICLE } from './vehicleStore';

const LOCAL_STORAGE_KEY = 'fleetledger_trips';

export interface TripInput {
  date: string;
  start_time: string;
  end_time: string;
  start_km: number;
  end_km: number;
  trip_distance: number;
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
  const tripsLocal = readLocalTrips();

  const newTrip: Trip = {
    id: `trip-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    page_id: 'local-page-1',
    vehicle_id: vehicle.id,
    date: input.date,
    day_index: 1,
    trip_index: tripsLocal.length + 1,
    start_time: input.start_time,
    end_time: input.end_time,
    start_km: input.start_km,
    end_km: input.end_km,
    trip_distance: input.trip_distance,
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
        // Also update vehicle odometer in Supabase via local saveVehicleProfile logic will fallback
        await saveVehicleProfile({ current_odometer: input.end_km });
        return data as Trip;
      }
    } catch (e) {
      console.warn('Failed to save trip to Supabase, saving to local storage', e);
    }
  }

  const updated = [...tripsLocal, newTrip];
  writeLocalTrips(updated);

  // Update local vehicle odometer continuity
  try {
    await saveVehicleProfile({ current_odometer: input.end_km });
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
