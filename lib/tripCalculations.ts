/**
 * Trip calculation engines - pure functions for odometer and time reciprocals.
 * Seams for TDD: odometer (Start + Distance = End), time (End - Duration = Start), day-of-week.
 */

export function roundToOneDecimal(n: number): number {
  return Math.round(n * 10) / 10;
}

export function calculateTripDistance(startKm: number, endKm: number): number {
  return roundToOneDecimal(endKm - startKm);
}

export function calculateEndKm(startKm: number, distance: number): number {
  return roundToOneDecimal(startKm + distance);
}

export function calculateStartKm(endKm: number, distance: number): number {
  return roundToOneDecimal(endKm - distance);
}

export function formatDateISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getTodayDateString(): string {
  return formatDateISO(new Date());
}

export function getDayOfWeek(dateString: string): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  // Parse as local date to avoid UTC offset issues
  // dateString is expected YYYY-MM-DD
  const [y, m, d] = dateString.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return days[date.getDay()];
}

export function getCurrentTimeString(): string {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  return `${h}:${min}`;
}

export function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr || !timeStr.includes(':')) {
    const n = Number(timeStr);
    return isNaN(n) ? 0 : n;
  }
  const [hStr, mStr] = timeStr.split(':');
  const h = parseInt(hStr, 10) || 0;
  const m = parseInt(mStr, 10) || 0;
  return h * 60 + m;
}

export function formatMinutesToTime(totalMinutes: number): string {
  // Normalize to 0-1439 inclusive, handling negatives and overflow (wraps around midnight)
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function calculateDurationMinutes(startTime: string, endTime: string): number {
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);
  let diff = end - start;
  if (diff < 0) diff += 1440; // overnight span
  return diff;
}

export function calculateStartTimeFromEndAndDuration(endTime: string, durationMinutes: number): string {
  const end = parseTimeToMinutes(endTime);
  return formatMinutesToTime(end - durationMinutes);
}

export function calculateEndTimeFromStartAndDuration(startTime: string, durationMinutes: number): string {
  const start = parseTimeToMinutes(startTime);
  return formatMinutesToTime(start + durationMinutes);
}

export function parseDurationToMinutes(durationStr: string): number {
  if (!durationStr || durationStr.trim() === '') return 0;
  const trimmed = durationStr.trim();
  if (trimmed.includes(':')) {
    const [hStr, mStr] = trimmed.split(':');
    const h = parseInt(hStr, 10) || 0;
    const m = parseInt(mStr, 10) || 0;
    return h * 60 + m;
  }
  const n = Number(trimmed);
  return isNaN(n) ? 0 : Math.round(n);
}

export function formatDurationMinutes(durationMinutes: number): string {
  const normalized = Math.max(0, durationMinutes);
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
