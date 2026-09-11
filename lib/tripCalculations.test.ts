import { describe, it, expect } from 'vitest';
import {
  roundToOneDecimal,
  calculateTripDistance,
  calculateEndKm,
  calculateStartKm,
  getDayOfWeek,
  formatDateISO,
  getTodayDateString,
  getCurrentTimeString,
  parseTimeToMinutes,
  formatMinutesToTime,
  calculateDurationMinutes,
  calculateStartTimeFromEndAndDuration,
  calculateEndTimeFromStartAndDuration,
  parseDurationToMinutes,
  formatDurationMinutes,
} from './tripCalculations';

describe('roundToOneDecimal', () => {
  it('rounds to 1 decimal place', () => {
    expect(roundToOneDecimal(10.05)).toBe(10.1);
    expect(roundToOneDecimal(10.04)).toBe(10.0);
    expect(roundToOneDecimal(142.6842)).toBe(142.7);
  });

  it('handles integers', () => {
    expect(roundToOneDecimal(10)).toBe(10.0);
  });
});

describe('Odometer reciprocal engine: Start + Distance = End', () => {
  it('calculates distance from start and end', () => {
    expect(calculateTripDistance(142684.2, 142708.5)).toBe(24.3);
    expect(calculateTripDistance(142708.5, 142729.5)).toBe(21.0);
    expect(calculateTripDistance(100, 100)).toBe(0.0);
  });

  it('calculates end km from start and distance', () => {
    expect(calculateEndKm(142684.2, 24.3)).toBe(142708.5);
    expect(calculateEndKm(142708.5, 21.0)).toBe(142729.5);
    expect(calculateEndKm(100, 0)).toBe(100.0);
  });

  it('calculates start km from end and distance', () => {
    expect(calculateStartKm(142708.5, 24.3)).toBe(142684.2);
    expect(calculateStartKm(142729.5, 21.0)).toBe(142708.5);
  });

  it('handles rounding to 1 decimal', () => {
    // 10.05 + 10.04 should be consistent with rounding rules
    expect(calculateTripDistance(100.04, 110.05)).toBe(10.0); // (110.05-100.04)=10.01 -> 10.0
    expect(calculateEndKm(100.05, 10.04)).toBe(110.1); // 110.09 -> 110.1
  });

  it('supports reciprocal consistency', () => {
    const start = 12500.0;
    const distance = 34.7;
    const end = calculateEndKm(start, distance);
    expect(calculateTripDistance(start, end)).toBe(distance);
    expect(calculateStartKm(end, distance)).toBe(start);
  });
});

describe('Day of week display', () => {
  it('returns correct day of week for known dates', () => {
    // 2024-10-21 is Monday
    expect(getDayOfWeek('2024-10-21')).toBe('Monday');
    expect(getDayOfWeek('2024-10-22')).toBe('Tuesday');
    expect(getDayOfWeek('2024-10-23')).toBe('Wednesday');
    expect(getDayOfWeek('2024-10-24')).toBe('Thursday');
    expect(getDayOfWeek('2024-10-20')).toBe('Sunday');
  });

  it('handles today date string format', () => {
    const today = getTodayDateString();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Day of week should be valid
    expect(['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']).toContain(getDayOfWeek(today));
  });

  it('formatDateISO formats Date correctly', () => {
    const d = new Date(2024, 9, 21); // Month 0-indexed: 9 = October
    expect(formatDateISO(d)).toBe('2024-10-21');
  });
});

describe('Time reciprocal engine: End - Duration = Start', () => {
  it('parses HH:MM to minutes', () => {
    expect(parseTimeToMinutes('08:15')).toBe(495);
    expect(parseTimeToMinutes('00:00')).toBe(0);
    expect(parseTimeToMinutes('23:59')).toBe(1439);
    expect(parseTimeToMinutes('09:10')).toBe(550);
  });

  it('formats minutes to HH:MM', () => {
    expect(formatMinutesToTime(495)).toBe('08:15');
    expect(formatMinutesToTime(0)).toBe('00:00');
    expect(formatMinutesToTime(1439)).toBe('23:59');
    expect(formatMinutesToTime(550)).toBe('09:10');
  });

  it('wraps around midnight correctly (negative or >1440)', () => {
    expect(formatMinutesToTime(-30)).toBe('23:30'); // -30 = 23:30 previous day
    expect(formatMinutesToTime(1440)).toBe('00:00');
    expect(formatMinutesToTime(1500)).toBe('01:00');
  });

  it('calculates duration from start and end times', () => {
    expect(calculateDurationMinutes('08:15', '09:10')).toBe(55);
    expect(calculateDurationMinutes('16:40', '17:25')).toBe(45);
    expect(calculateDurationMinutes('08:00', '08:00')).toBe(0);
  });

  it('handles overnight duration (end next day)', () => {
    // e.g., 23:50 to 00:10 next day = 20 minutes
    expect(calculateDurationMinutes('23:50', '00:10')).toBe(20);
  });

  it('calculates start time from end and duration', () => {
    expect(calculateStartTimeFromEndAndDuration('09:10', 55)).toBe('08:15');
    expect(calculateStartTimeFromEndAndDuration('17:25', 45)).toBe('16:40');
    // overnight backward: end 00:10 with 20 min duration -> start 23:50
    expect(calculateStartTimeFromEndAndDuration('00:10', 20)).toBe('23:50');
  });

  it('calculates end time from start and duration', () => {
    expect(calculateEndTimeFromStartAndDuration('08:15', 55)).toBe('09:10');
    expect(calculateEndTimeFromStartAndDuration('16:40', 45)).toBe('17:25');
    expect(calculateEndTimeFromStartAndDuration('23:50', 20)).toBe('00:10');
  });

  it('parses duration string HH:MM or minutes numeric strings', () => {
    expect(parseDurationToMinutes('01:30')).toBe(90);
    expect(parseDurationToMinutes('00:55')).toBe(55);
    expect(parseDurationToMinutes('90')).toBe(90);
    expect(parseDurationToMinutes('1:05')).toBe(65);
    expect(parseDurationToMinutes('')).toBe(0);
  });

  it('formats duration minutes to HH:MM for display', () => {
    expect(formatDurationMinutes(55)).toBe('00:55');
    expect(formatDurationMinutes(90)).toBe('01:30');
    expect(formatDurationMinutes(0)).toBe('00:00');
  });

  it('supports reciprocal consistency for time', () => {
    const start = '08:15';
    const duration = 55;
    const end = calculateEndTimeFromStartAndDuration(start, duration);
    expect(end).toBe('09:10');
    expect(calculateDurationMinutes(start, end)).toBe(duration);
    expect(calculateStartTimeFromEndAndDuration(end, duration)).toBe(start);
  });

  it('getCurrentTimeString returns HH:MM format', () => {
    const t = getCurrentTimeString();
    expect(t).toMatch(/^\d{2}:\d{2}$/);
    const [h, m] = t.split(':').map(Number);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(23);
    expect(m).toBeGreaterThanOrEqual(0);
    expect(m).toBeLessThanOrEqual(59);
  });
});
