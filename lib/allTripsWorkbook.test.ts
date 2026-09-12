import { describe, it, expect } from 'vitest';
import {
  generateAllTripsBuffer,
  parseAllTripsWorkbook,
  validateHeaders,
  validatePaginationForImport,
  importTripsFromWorkbook,
  getDuplicateKey,
  ALL_TRIPS_HEADERS,
} from './allTripsWorkbook';
import type { Trip, BookPage } from '@/types';
import type { BookOpening } from './pagination';

describe('allTripsWorkbook', () => {
  describe('generateAllTripsWorkbook', () => {
    it('generates and parses workbook round-trip correctly', async () => {
      const mockTrips: Trip[] = [
        {
          id: 't1',
          vehicle_id: 'veh-1',
          page_id: 'page-1',
          day_index: 1,
          trip_index: 1,
          date: '2026-01-01',
          start_km: 50000,
          end_km: 50050,
          trip_distance: 50,
          start_time: '08:00',
          end_time: '09:00',
          trip_type: 'Official',
          places_visited: 'HQ to Branch',
          fuel_pumped_amount: 15.5,
          fuel_order_no: 'PO-100',
        },
      ];

      const buf = await generateAllTripsBuffer(mockTrips, { brand: 'Toyota', model: 'Camry' });
      expect(buf).toBeDefined();

      const parseRes = await parseAllTripsWorkbook(buf);
      if (!parseRes.valid) {
        console.log('Import errors:', parseRes.errors);
      }
      expect(parseRes.valid).toBe(true);
      expect(parseRes.trips).toHaveLength(1);
      expect(parseRes.trips[0].date).toBe('2026-01-01');
      expect(parseRes.trips[0].start_km).toBe(50000);
      expect(parseRes.trips[0].end_km).toBe(50050);
    });

    it('validates missing essential fields on import', async () => {
      const badBuf = new ArrayBuffer(10);
      const parseRes = await parseAllTripsWorkbook(badBuf);
      expect(parseRes.valid).toBe(false);
      expect(parseRes.errors.length).toBeGreaterThan(0);
    });
  });

  describe('validateHeaders', () => {
    it('accepts exact match headers', () => {
      expect(validateHeaders(ALL_TRIPS_HEADERS)).toBe(true);
    });

    it('accepts case-insensitive headers', () => {
      const lowerCaseHeaders = ALL_TRIPS_HEADERS.map(h => h.toLowerCase());
      expect(validateHeaders(lowerCaseHeaders)).toBe(true);
    });

    it('accepts mixed case headers', () => {
      const mixedCaseHeaders = ['DATE', 'start km', 'END KM', 'distance', 'START TIME', 'end time', 'TYPE', 'PLACES VISITED', 'FUEL PUMPED', 'FUEL ORDER NO'];
      expect(validateHeaders(mixedCaseHeaders)).toBe(true);
    });

    it('rejects wrong order headers', () => {
      const wrongOrder = [...ALL_TRIPS_HEADERS].reverse();
      expect(validateHeaders(wrongOrder)).toBe(false);
    });

    it('rejects missing headers', () => {
      const missingHeaders = ALL_TRIPS_HEADERS.slice(0, 8);
      expect(validateHeaders(missingHeaders)).toBe(false);
    });

    it('rejects extra headers', () => {
      const extraHeaders = [...ALL_TRIPS_HEADERS, 'Extra'];
      expect(validateHeaders(extraHeaders)).toBe(false);
    });
  });

  describe('getDuplicateKey', () => {
    it('generates correct key from trip fields', () => {
      const trip: Partial<Trip> = {
        date: '2026-01-01',
        start_km: 50000,
        end_km: 50050,
        end_time: '09:00',
      };
      expect(getDuplicateKey(trip)).toBe('2026-01-01|50000|50050|09:00');
    });
  });

  describe('parseAllTripsWorkbook', () => {
    it('rejects workbook with wrong headers', async () => {
      const ExcelJS = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('All Trips');
      sheet.addRow(['Wrong', 'Headers', 'Here', 'And', 'More', 'Columns', 'Than', 'Expected', 'Ones', 'Tens']);
      sheet.addRow(['2026-01-01', '50000', '50050', '50', '08:00', '09:00', 'Official', 'HQ', '15.5', 'PO-100']);
      const buf = await workbook.xlsx.writeBuffer();
      const result = await parseAllTripsWorkbook(buf as ArrayBuffer);
      expect(result.valid).toBe(false);
      expect(result.errors[0].field).toBe('headers');
    });

    it('validates End KM >= Start KM', async () => {
      const ExcelJS = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('All Trips');
      sheet.addRow(ALL_TRIPS_HEADERS);
      sheet.addRow(['2026-01-01', '50050', '50000', '', '08:00', '09:00', 'Official', 'HQ', '15.5', 'PO-100']);
      const buf = await workbook.xlsx.writeBuffer();
      const result = await parseAllTripsWorkbook(buf as ArrayBuffer);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'End KM' && e.message.includes('cannot be less'))).toBe(true);
    });

    it('auto-derives distance when blank', async () => {
      const ExcelJS = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('All Trips');
      sheet.addRow(ALL_TRIPS_HEADERS);
      sheet.addRow(['2026-01-01', '50000', '50050', '', '08:00', '09:00', 'Official', 'HQ', '0', '']);
      const buf = await workbook.xlsx.writeBuffer();
      const result = await parseAllTripsWorkbook(buf as ArrayBuffer);
      expect(result.valid).toBe(true);
      expect(result.trips[0].trip_distance).toBe(50);
    });
  });

  describe('validatePaginationForImport', () => {
    const existingTrips: Trip[] = [];
    const existingPages: BookPage[] = [];

    it('allows valid import within pagination limits', () => {
      const importedTrips: Partial<Trip>[] = [
        { date: '2026-01-01', start_km: 50000, end_km: 50050, end_time: '09:00', places_visited: 'HQ' },
        { date: '2026-01-01', start_km: 50050, end_km: 50100, end_time: '10:00', places_visited: 'Branch' },
      ];
      const errors = validatePaginationForImport(existingTrips, existingPages, importedTrips);
      expect(errors).toHaveLength(0);
    });

    it('rejects import exceeding 13 trips per day', () => {
      const importedTrips: Partial<Trip>[] = [];
      for (let i = 0; i < 14; i++) {
        importedTrips.push({
          date: '2026-01-01',
          start_km: 50000 + i * 50,
          end_km: 50050 + i * 50,
          end_time: `${String(8 + i).padStart(2, '0')}:00`,
          places_visited: `Place ${i}`,
        });
      }
      const errors = validatePaginationForImport(existingTrips, existingPages, importedTrips);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].field).toBe('pagination');
    });

    it('allows 5 days across multiple pages (creates 2 pages)', () => {
      const importedTrips: Partial<Trip>[] = [];
      for (let d = 1; d <= 5; d++) {
        importedTrips.push({
          date: `2026-01-0${d}`,
          start_km: 50000 + (d - 1) * 100,
          end_km: 50050 + (d - 1) * 100,
          end_time: '09:00',
          places_visited: `Place ${d}`,
        });
      }
      const errors = validatePaginationForImport(existingTrips, existingPages, importedTrips);
      // 5 days is valid - it just requires 2 pages (4 days + 1 day)
      expect(errors).toHaveLength(0);
    });
  });

  describe('importTripsFromWorkbook', () => {
    const vehicleId = 'veh-1';
    const opening: BookOpening = { openingKm: 50000, openingFuel: 40 };

    it('appends trips chronologically', () => {
      const existingTrips: Trip[] = [];
      const existingPages: BookPage[] = [];
      const parsedTrips: Partial<Trip>[] = [
        { date: '2026-01-01', start_km: 50000, end_km: 50050, end_time: '09:00', places_visited: 'HQ' },
        { date: '2026-01-01', start_km: 50050, end_km: 50100, end_time: '10:00', places_visited: 'Branch' },
      ];

      const result = importTripsFromWorkbook({
        existingTrips,
        existingPages,
        parsedTrips,
        vehicleId,
        opening,
      });

      expect(result.success).toBe(true);
      expect(result.appendedCount).toBe(2);
      expect(result.trips).toHaveLength(2);
      expect(result.pages).toHaveLength(1);
      expect(result.trips[0].trip_index).toBe(1);
      expect(result.trips[1].trip_index).toBe(2);
    });

    it('skips duplicate trips with warning', () => {
      const existingTrips: Trip[] = [
        {
          id: 't1',
          vehicle_id: vehicleId,
          page_id: 'page-1',
          day_index: 1,
          trip_index: 1,
          date: '2026-01-01',
          start_km: 50000,
          end_km: 50050,
          trip_distance: 50,
          start_time: '08:00',
          end_time: '09:00',
          trip_type: 'Official',
          places_visited: 'HQ',
        },
      ];
      const existingPages: BookPage[] = [
        {
          id: 'page-1',
          vehicle_id: vehicleId,
          page_number: 1,
          month: '2026-01',
          start_km: 50000,
          end_km: 50050,
          start_fuel_balance: 40,
          end_fuel_balance: 35,
        },
      ];
      const parsedTrips: Partial<Trip>[] = [
        { date: '2026-01-01', start_km: 50000, end_km: 50050, end_time: '09:00', places_visited: 'HQ' },
        { date: '2026-01-01', start_km: 50050, end_km: 50100, end_time: '10:00', places_visited: 'Branch' },
      ];

      const result = importTripsFromWorkbook({
        existingTrips,
        existingPages,
        parsedTrips,
        vehicleId,
        opening,
      });

      expect(result.success).toBe(true);
      expect(result.appendedCount).toBe(1);
      expect(result.skippedDuplicates).toBe(1);
      expect(result.trips).toHaveLength(2);
    });

    it('creates new pages when pagination requires', () => {
      const existingTrips: Trip[] = [];
      const existingPages: BookPage[] = [];
      const parsedTrips: Partial<Trip>[] = [];

      // Add 5 different days (exceeds 4 days per page)
      for (let d = 1; d <= 5; d++) {
        parsedTrips.push({
          date: `2026-01-0${d}`,
          start_km: 50000 + (d - 1) * 100,
          end_km: 50050 + (d - 1) * 100,
          end_time: '09:00',
          places_visited: `Place ${d}`,
        });
      }

      const result = importTripsFromWorkbook({
        existingTrips,
        existingPages,
        parsedTrips,
        vehicleId,
        opening,
      });

      expect(result.success).toBe(true);
      expect(result.pages.length).toBeGreaterThan(1);
      expect(result.trips).toHaveLength(5);
    });

    it('handles backdated insertion with renumber', () => {
      // Existing trip on 2026-01-05
      const existingTrips: Trip[] = [
        {
          id: 't1',
          vehicle_id: vehicleId,
          page_id: 'page-1',
          day_index: 1,
          trip_index: 1,
          date: '2026-01-05',
          start_km: 50000,
          end_km: 50050,
          trip_distance: 50,
          start_time: '08:00',
          end_time: '09:00',
          trip_type: 'Official',
          places_visited: 'HQ',
        },
      ];
      const existingPages: BookPage[] = [
        {
          id: 'page-1',
          vehicle_id: vehicleId,
          page_number: 1,
          month: '2026-01',
          start_km: 50000,
          end_km: 50050,
          start_fuel_balance: 40,
          end_fuel_balance: 35,
        },
      ];

      // Import backdated trip on 2026-01-01
      const parsedTrips: Partial<Trip>[] = [
        { date: '2026-01-01', start_km: 49900, end_km: 49950, end_time: '09:00', places_visited: 'Early' },
      ];

      const result = importTripsFromWorkbook({
        existingTrips,
        existingPages,
        parsedTrips,
        vehicleId,
        opening,
      });

      expect(result.success).toBe(true);
      expect(result.appendedCount).toBe(1);
      // Pages should be renumbered: the backdated trip should be on page-1
      expect(result.pages.length).toBeGreaterThanOrEqual(1);
      expect(result.trips).toHaveLength(2);
    });

    it('returns success with zero appended when all duplicates', () => {
      const existingTrips: Trip[] = [
        {
          id: 't1',
          vehicle_id: vehicleId,
          page_id: 'page-1',
          day_index: 1,
          trip_index: 1,
          date: '2026-01-01',
          start_km: 50000,
          end_km: 50050,
          trip_distance: 50,
          start_time: '08:00',
          end_time: '09:00',
          trip_type: 'Official',
          places_visited: 'HQ',
        },
      ];
      const existingPages: BookPage[] = [
        {
          id: 'page-1',
          vehicle_id: vehicleId,
          page_number: 1,
          month: '2026-01',
          start_km: 50000,
          end_km: 50050,
          start_fuel_balance: 40,
          end_fuel_balance: 35,
        },
      ];
      const parsedTrips: Partial<Trip>[] = [
        { date: '2026-01-01', start_km: 50000, end_km: 50050, end_time: '09:00', places_visited: 'HQ' },
      ];

      const result = importTripsFromWorkbook({
        existingTrips,
        existingPages,
        parsedTrips,
        vehicleId,
        opening,
      });

      expect(result.success).toBe(true);
      expect(result.appendedCount).toBe(0);
      expect(result.skippedDuplicates).toBe(1);
    });
  });
});
