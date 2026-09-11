/**
 * Fuel Economy per-page persistence (localStorage fallback)
 * Stores raw economy overrides per pageId -> (dayIndex -> economy)
 */
const KEY_PREFIX = 'fleetledger_fuel_economy_';

function keyForPage(pageId: string): string {
  return `${KEY_PREFIX}${pageId}`;
}

export function getFuelEconomiesForPage(pageId: string): (number | null)[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(keyForPage(pageId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as (number | null)[];
    return [];
  } catch {
    return [];
  }
}

export function saveFuelEconomiesForPage(pageId: string, economies: (number | null)[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(keyForPage(pageId), JSON.stringify(economies));
}

export function clearFuelEconomiesForPage(pageId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(keyForPage(pageId));
}
