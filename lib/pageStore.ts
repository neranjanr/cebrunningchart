import { BookPage } from '@/types';
import { supabase, isSupabaseConfigured } from './supabase/client';
import { getVehicleProfile } from './vehicleStore';
import { roundToOneDecimal } from './tripCalculations';
import { getNextPageStartKm, getNextPageStartFuel, getMonthKey } from './pagination';

const LOCAL_STORAGE_KEY = 'fleetledger_book_pages';

function readLocalPages(): BookPage[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored) as BookPage[];
  } catch {
    return [];
  }
}

function writeLocalPages(pages: BookPage[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(pages));
}

export async function getPages(): Promise<BookPage[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.from('book_pages').select('*').order('page_number', { ascending: true });
      if (data && !error) return data as BookPage[];
    } catch (e) {
      console.warn('Failed to fetch pages from Supabase, falling back to local storage', e);
    }
  }
  return readLocalPages();
}

export async function getNextPageStartKmAsync(): Promise<number> {
  const pages = await getPages();
  if (pages.length > 0) {
    const last = [...pages].sort((a, b) => a.page_number - b.page_number)[pages.length - 1];
    return roundToOneDecimal(last.end_km);
  }
  const vehicle = await getVehicleProfile();
  return roundToOneDecimal(vehicle.current_odometer);
}

export async function getNextPageStartFuelAsync(): Promise<number> {
  const pages = await getPages();
  if (pages.length > 0) {
    const last = [...pages].sort((a, b) => a.page_number - b.page_number)[pages.length - 1];
    return roundToOneDecimal(last.end_fuel_balance);
  }
  const vehicle = await getVehicleProfile();
  return roundToOneDecimal(vehicle.current_fuel_level);
}

export async function ensurePageForAssignment(vehicleId: string, newTripDate: string): Promise<BookPage> {
  const pages = await getPages();
  const monthKey = getMonthKey(newTripDate);

  // If no pages, create page 1 with continuity from vehicle
  if (pages.length === 0) {
    const vehicle = await getVehicleProfile();
    const newPage: BookPage = {
      id: `page-1`,
      vehicle_id: vehicleId,
      page_number: 1,
      month: monthKey,
      start_km: roundToOneDecimal(vehicle.current_odometer),
      end_km: roundToOneDecimal(vehicle.current_odometer),
      start_fuel_balance: roundToOneDecimal(vehicle.current_fuel_level),
      end_fuel_balance: roundToOneDecimal(vehicle.current_fuel_level),
      created_at: new Date().toISOString(),
    };
    await savePage(newPage);
    return newPage;
  }

  // Pages already exist; caller will decide via assignPageForNewTrip whether new page is needed.
  // This helper just returns current pages snapshot; creation is handled in tripStore via pagination assign.
  // Keeping for potential external use.
  return pages[pages.length - 1];
}

export async function savePage(page: BookPage): Promise<BookPage> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.from('book_pages').upsert([page]).select().single();
      if (data && !error) return data as BookPage;
    } catch (e) {
      console.warn('Failed to save page to Supabase, falling back to local storage', e);
    }
  }
  const pages = readLocalPages();
  const idx = pages.findIndex((p) => p.id === page.id);
  if (idx >= 0) {
    pages[idx] = page;
  } else {
    pages.push(page);
  }
  // keep sorted by page_number
  pages.sort((a, b) => a.page_number - b.page_number);
  writeLocalPages(pages);
  return page;
}

export async function createNextPage(
  currentPage: BookPage,
  newTripDate: string,
  vehicleId: string
): Promise<BookPage> {
  const pages = await getPages();
  const nextNumber = currentPage.page_number + 1;
  // Continuity: start values come from previous page's end values
  const startKm = roundToOneDecimal(currentPage.end_km);
  const startFuel = roundToOneDecimal(currentPage.end_fuel_balance);
  const newPage: BookPage = {
    id: `page-${nextNumber}`,
    vehicle_id: vehicleId,
    page_number: nextNumber,
    month: getMonthKey(newTripDate),
    start_km: startKm,
    end_km: startKm, // will be updated as trips are added
    start_fuel_balance: startFuel,
    end_fuel_balance: startFuel,
    created_at: new Date().toISOString(),
  };
  // Also ensure pages list includes new page
  // Check if Supabase has pages with gaps - just append
  return savePage(newPage);
}

export async function updatePageEndValues(pageId: string, endKm: number, endFuel: number): Promise<void> {
  const pages = await getPages();
  const page = pages.find((p) => p.id === pageId);
  if (!page) return;
  page.end_km = roundToOneDecimal(endKm);
  page.end_fuel_balance = roundToOneDecimal(endFuel);
  await savePage(page);
}

export function clearPages(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  }
}

// Re-export helpers for convenience
export { getNextPageStartKm, getNextPageStartFuel };
