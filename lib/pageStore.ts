import { BookPage, Trip } from '@/types';
import { supabase, isSupabaseConfigured } from './supabase/client';
import { getVehicleProfile } from './vehicleStore';
import { roundToOneDecimal, roundToIntegerKm } from './tripCalculations';
import {
  getNextPageStartKm,
  getNextPageStartFuel,
  getMonthKey,
  renumberPagesChronologically,
  recalculatePageBalancesFromOpening,
  getEarliestOverallDate,
} from './pagination';

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
    return roundToIntegerKm(last.end_km);
  }
  const vehicle = await getVehicleProfile();
  return roundToIntegerKm(vehicle.current_odometer ?? 0);
}

export async function getNextPageStartFuelAsync(): Promise<number> {
  const pages = await getPages();
  if (pages.length > 0) {
    const last = [...pages].sort((a, b) => a.page_number - b.page_number)[pages.length - 1];
    return roundToOneDecimal(last.end_fuel_balance);
  }
  const vehicle = await getVehicleProfile();
  // current_fuel_level deprecated; use 10L default if not present
  const fallbackFuel = (vehicle as any).current_fuel_level ?? 10;
  return roundToOneDecimal(fallbackFuel);
}

export async function ensurePageForAssignment(vehicleId: string, newTripDate: string): Promise<BookPage> {
  const pages = await getPages();
  const monthKey = getMonthKey(newTripDate);

  // If no pages, create page 1 with continuity from vehicle
  if (pages.length === 0) {
    const vehicle = await getVehicleProfile();
    const fallbackFuel = (vehicle as any).current_fuel_level ?? 10;
    const newPage: BookPage = {
      id: `page-1`,
      vehicle_id: vehicleId,
      page_number: 1,
      month: monthKey,
      start_km: roundToIntegerKm(vehicle.current_odometer ?? 0),
      end_km: roundToIntegerKm(vehicle.current_odometer ?? 0),
      start_fuel_balance: roundToOneDecimal(fallbackFuel),
      end_fuel_balance: roundToOneDecimal(fallbackFuel),
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
  const startKm = roundToIntegerKm(currentPage.end_km);
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
  page.end_km = roundToIntegerKm(endKm);
  page.end_fuel_balance = roundToOneDecimal(endFuel);
  await savePage(page);
}

export function clearPages(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  }
}

// ---------------------------------------------------------------------------
// Chronological renumbering & Book Opening recalc (Phase 2 Issue 02)
// ---------------------------------------------------------------------------

function writeLocalTripsForRenumber(trips: Trip[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('fleetledger_trips', JSON.stringify(trips));
}

function readLocalTripsForRenumber(): Trip[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem('fleetledger_trips');
  if (!stored) return [];
  try {
    return JSON.parse(stored) as Trip[];
  } catch {
    return [];
  }
}

/**
 * Chronologically sort pages by earliest trip date, renumber 1..N,
 * cascade page_number/page_id and Trip.page_id, keep dates immutable.
 * Then recalculate fuel balances forward from Book Opening (vehicle opening).
 * Persists pages and trips to storage and returns the new sets.
 */
export async function applyChronologicalRenumber(): Promise<{ pages: BookPage[]; trips: Trip[] }> {
  const pages = await getPages();
  // Read trips directly (avoid Supabase infinite loop for now, use local + remote merge)
  let trips: Trip[] = [];
  // Try to get trips via dynamic import to avoid circular dep
  try {
    const { getTrips } = await import('./tripStore');
    trips = await getTrips();
  } catch {
    trips = readLocalTripsForRenumber();
  }

  if (pages.length === 0) return { pages, trips };

  const { pages: renumberedPages, trips: renumberedTrips } = renumberPagesChronologically(pages, trips);

  // Recalculate balances from Book Opening
  const vehicle = await getVehicleProfile();
  const opening = {
    openingKm: roundToIntegerKm(vehicle.current_odometer ?? 0),
    openingFuel: roundToOneDecimal((vehicle as any).current_fuel_level ?? 10),
  };
  const recalculated = recalculatePageBalancesFromOpening({
    pages: renumberedPages,
    trips: renumberedTrips,
    opening,
  });

  // Persist pages
  if (isSupabaseConfigured && supabase) {
    try {
      // Supabase persistence for renumber: clear and re-upsert
      // For simplicity, local fallback only if supabase configured but we ignore remote renumber sync
      // Persist locally as well
      writeLocalPages(recalculated);
      writeLocalTripsForRenumber(renumberedTrips);
      return { pages: recalculated, trips: renumberedTrips };
    } catch (e) {
      console.warn('Failed to persist renumbered pages to Supabase', e);
    }
  }

  writeLocalPages(recalculated);
  writeLocalTripsForRenumber(renumberedTrips);
  return { pages: recalculated, trips: renumberedTrips };
}

/**
 * Check if a new trip date is back-dated and renumber is needed.
 * Returns true if renumber was applied.
 */
export async function maybeRenumberForBackdatedTrip(newTripDate: string): Promise<boolean> {
  const pages = await getPages();
  let trips: Trip[] = [];
  try {
    const { getTrips } = await import('./tripStore');
    trips = await getTrips();
  } catch {
    trips = readLocalTripsForRenumber();
  }
  const earliest = getEarliestOverallDate(pages, trips);
  if (earliest === null) return false;
  if (newTripDate < earliest) {
    await applyChronologicalRenumber();
    return true;
  }
  return false;
}

/**
 * Update Book Opening (vehicle opening odometer/fuel) and recalculate forward.
 * Call after editing vehicle profile opening values.
 */
export async function recalculateFromBookOpening(openingKm: number, openingFuel: number): Promise<BookPage[]> {
  const pages = await getPages();
  let trips: Trip[] = [];
  try {
    const { getTrips } = await import('./tripStore');
    trips = await getTrips();
  } catch {
    trips = readLocalTripsForRenumber();
  }
  if (pages.length === 0) return pages;

  // Ensure pages are chronologically sorted before recalc
  const { pages: renumbered, trips: renumberedTrips } = renumberPagesChronologically(pages, trips);
  const recalculated = recalculatePageBalancesFromOpening({
    pages: renumbered,
    trips: renumberedTrips,
    opening: {
      openingKm: roundToIntegerKm(openingKm),
      openingFuel: roundToOneDecimal(openingFuel),
    },
  });

  // Persist renumbered trips if renumber changed ids
  const idsChanged = renumbered.some((p, i) => p.id !== pages[i]?.id);
  if (idsChanged) {
    writeLocalTripsForRenumber(renumberedTrips);
  }

  writeLocalPages(recalculated);
  return recalculated;
}

// Re-export helpers for convenience
export { getNextPageStartKm, getNextPageStartFuel };
