import { Vehicle } from '@/types';
import { supabase, isSupabaseConfigured } from './supabase/client';

const LOCAL_STORAGE_KEY = 'fleetledger_vehicle_profile';

export const DEFAULT_VEHICLE: Vehicle = {
  id: 'default-vehicle-1',
  brand: 'Toyota',
  model: 'Hilux',
  vehicle_type: 'Double Cab',
  fuel_type: 'Diesel',
  tank_capacity: 80.0,
  current_odometer: 12500.0,
  current_fuel_level: 65.0,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export async function getVehicleProfile(): Promise<Vehicle> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.from('vehicles').select('*').limit(1).single();
      if (data && !error) {
        return data as Vehicle;
      }
    } catch (e) {
      console.warn('Failed to fetch vehicle from Supabase, falling back to local storage', e);
    }
  }

  // Fallback to localStorage
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored) as Vehicle;
      } catch (e) {
        console.error('Error parsing stored vehicle profile', e);
      }
    } else {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(DEFAULT_VEHICLE));
    }
  }

  return DEFAULT_VEHICLE;
}

export async function saveVehicleProfile(vehicle: Partial<Vehicle>): Promise<Vehicle> {
  const current = await getVehicleProfile();
  const updated: Vehicle = {
    ...current,
    ...vehicle,
    updated_at: new Date().toISOString(),
  };

  if (isSupabaseConfigured && supabase) {
    try {
      if (updated.id && updated.id !== 'default-vehicle-1') {
        const { data, error } = await supabase
          .from('vehicles')
          .update(updated)
          .eq('id', updated.id)
          .select()
          .single();
        if (data && !error) {
          return data as Vehicle;
        }
      } else {
        // Insert or upsert
        const { id, ...insertData } = updated;
        const { data, error } = await supabase
          .from('vehicles')
          .insert([insertData])
          .select()
          .single();
        if (data && !error) {
          return data as Vehicle;
        }
      }
    } catch (e) {
      console.warn('Failed to save vehicle to Supabase, saving to local storage', e);
    }
  }

  if (typeof window !== 'undefined') {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
  }

  return updated;
}
