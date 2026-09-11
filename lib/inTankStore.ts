/**
 * In-Tank per Day Group persistence (localStorage fallback)
 * Stores In-Tank fuel per pageId -> dayIndex -> litres (default 0)
 */
const KEY_PREFIX = 'fleetledger_in_tank_';

function keyForPage(pageId: string): string {
  return `${KEY_PREFIX}${pageId}`;
}

export function getInTanksForPage(pageId: string): (number | null)[] {
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

export function saveInTanksForPage(pageId: string, inTanks: (number | null)[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(keyForPage(pageId), JSON.stringify(inTanks));
}

export function clearInTanksForPage(pageId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(keyForPage(pageId));
}

export function normalizeInTank(value: number | null | undefined): number {
  if (value === null || value === undefined || isNaN(Number(value))) return 0;
  const n = Number(value);
  if (n < 0) return 0;
  return Math.round(n * 10) / 10;
}
