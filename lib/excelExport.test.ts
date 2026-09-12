import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { generateBookMirrorWorkbook, generateExcelBuffer, getExportFileName } from './excelExport';
import type { BookPage, Trip, Vehicle } from '@/types';

function makeVehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: 'veh-1',
    brand: 'Toyota',
    model: 'Hilux',
    vehicle_type: 'Double Cab',
    fuel_type: 'Diesel',
    tank_capacity: 65.0,
    current_odometer: 12500.0,
    current_fuel_level: 48.3,
    ...overrides,
  };
}
function makePage(overrides: Partial<BookPage>): BookPage {
  return {
    id: overrides.id ?? `page-${overrides.page_number ?? 1}`,
    vehicle_id: 'veh-1',
    page_number: overrides.page_number ?? 1,
    month: overrides.month ?? '2024-10',
    start_km: overrides.start_km ?? 142684.2,
    end_km: overrides.end_km ?? 142875.0,
    start_fuel_balance: overrides.start_fuel_balance ?? 31.4,
    end_fuel_balance: overrides.end_fuel_balance ?? 48.3,
    ...overrides,
  };
}
function makeTrip(overrides: Partial<Trip> & { date: string; page_id: string }): Trip {
  const { page_id, date, ...rest } = overrides as any;
  return {
    id: (overrides as any).id ?? `trip-${Math.random().toString(36).slice(2, 6)}`,
    vehicle_id: (overrides as any).vehicle_id ?? 'veh-1',
    page_id,
    date,
    day_index: (overrides as any).day_index ?? 1,
    trip_index: (overrides as any).trip_index ?? 1,
    start_time: (overrides as any).start_time ?? '08:00',
    end_time: (overrides as any).end_time ?? '09:00',
    start_km: (overrides as any).start_km ?? 100,
    end_km: (overrides as any).end_km ?? 110,
    trip_distance: (overrides as any).trip_distance ?? 10,
    trip_type: (overrides as any).trip_type ?? 'Official',
    places_visited: (overrides as any).places_visited ?? 'A -> B',
    fuel_pumped_amount: (overrides as any).fuel_pumped_amount ?? 0,
    fuel_order_no: (overrides as any).fuel_order_no ?? '',
    ...rest,
  } as Trip;
}

describe('getExportFileName', () => {
  it('produces filename with vehicle and date', () => {
    const v = makeVehicle({ brand: 'Toyota', model: 'Hilux' });
    const name = getExportFileName(v, '2024-10-24');
    expect(name).toMatch(/Toyota_Hilux/);
    expect(name).toMatch(/2024-10-24/);
    expect(name.endsWith('.xlsx')).toBe(true);
  });
  it('falls back when vehicle null', () => {
    expect(getExportFileName(null, '2024-10-24')).toBe('RunningChart_2024-10-24.xlsx');
  });
});

describe('generateBookMirrorWorkbook', () => {
  const vehicle = makeVehicle();
  const page14 = makePage({
    id: 'page-14',
    page_number: 14,
    month: '2024-10',
    start_km: 142684.2,
    end_km: 142875.0,
    start_fuel_balance: 31.4,
    end_fuel_balance: 48.3,
  });
  const trips: Trip[] = [
    makeTrip({ id: 't1', date: '2024-10-21', page_id: 'page-14', trip_index: 1, start_km: 142684.2, end_km: 142708.5, trip_distance: 24.3, places_visited: 'HQ Fleet Yard -> Regional Port Customs' }),
    makeTrip({ id: 't2', date: '2024-10-21', page_id: 'page-14', trip_index: 2, start_km: 142708.5, end_km: 142729.5, trip_distance: 21.0 }),
    makeTrip({ id: 't3', date: '2024-10-21', page_id: 'page-14', trip_index: 3, start_km: 142729.5, end_km: 142746.8, trip_distance: 17.3, trip_type: 'Private', places_visited: 'North Cargo -> Driver Quarters' }),
    makeTrip({ id: 't4', date: '2024-10-22', page_id: 'page-14', trip_index: 1, start_km: 142746.8, end_km: 142765.2, trip_distance: 18.4, fuel_pumped_amount: 35.0, fuel_order_no: '#FO-88912' }),
    makeTrip({ id: 't5', date: '2024-10-22', page_id: 'page-14', trip_index: 2, start_km: 142765.2, end_km: 142782.0, trip_distance: 16.8 }),
    makeTrip({ id: 't6', date: '2024-10-22', page_id: 'page-14', trip_index: 3, start_km: 142782.0, end_km: 142799.6, trip_distance: 17.6 }),
    makeTrip({ id: 't7', date: '2024-10-22', page_id: 'page-14', trip_index: 4, start_km: 142799.6, end_km: 142812.0, trip_distance: 12.4 }),
    makeTrip({ id: 't8', date: '2024-10-23', page_id: 'page-14', trip_index: 1, start_km: 142812.0, end_km: 142833.2, trip_distance: 21.2 }),
    makeTrip({ id: 't9', date: '2024-10-23', page_id: 'page-14', trip_index: 2, start_km: 142833.2, end_km: 142850.4, trip_distance: 17.2 }),
    makeTrip({ id: 't10', date: '2024-10-24', page_id: 'page-14', trip_index: 1, start_km: 142850.4, end_km: 142875.0, trip_distance: 24.6 }),
  ];

  it('creates single sheet with physical book layout headers', () => {
    const wb = generateBookMirrorWorkbook({ pages: [page14], trips, vehicle });
    expect(wb.worksheets.length).toBe(1);
    expect(wb.worksheets[0].name).toMatch(/Book/);
    const sheet = wb.worksheets[0];
    // collect all cell string values
    const allValues: string[] = [];
    sheet.eachRow((row) => {
      row.eachCell((cell) => {
        if (cell.value !== null && cell.value !== undefined) allValues.push(String(cell.value));
      });
    });
    const joined = allValues.join(' | ');
    expect(joined).toContain('RUNNING CHART');
    expect(joined).toContain('SIDE 1');
    expect(joined).toContain('Start KM');
    expect(joined).toContain('End KM');
    expect(joined).toContain('Trip Distance');
    expect(joined).toContain('TABLE 1');
    expect(joined).toContain('Fuel Economy');
    expect(joined).toContain('TABLE 2');
    expect(joined).toContain('Closing Balance');
  });

  it('contains trip rows with correct integer distances', () => {
    const wb = generateBookMirrorWorkbook({ pages: [page14], trips, vehicle });
    const sheet = wb.worksheets[0];
    const allValues: string[] = [];
    sheet.eachRow((row) => {
      row.eachCell((cell) => {
        if (cell.value !== null && cell.value !== undefined) allValues.push(String(cell.value));
      });
    });
    const joined = allValues.join(' | ');
    // Check distances appear (24.3 rounds to 24)
    expect(joined).toContain('24');
    expect(joined).toContain('35.0');
    expect(joined).toContain('HQ Fleet Yard');
  });

  it('includes daily fuel economy propagation and consumption/balance calcs', () => {
    const wb = generateBookMirrorWorkbook({
      pages: [page14],
      trips,
      vehicle,
      fuelEconomiesByPage: { 'page-14': [10.5, null, 10.8, null] },
    });
    const sheet = wb.worksheets[0];
    const allValues: string[] = [];
    const numericValues: number[] = [];
    sheet.eachRow((row) => {
      row.eachCell((cell) => {
        if (cell.value !== null && cell.value !== undefined) {
          allValues.push(String(cell.value));
          if (typeof cell.value === 'number') numericValues.push(cell.value);
          // Also check formatted text if available
          if ((cell as any).text && typeof (cell as any).text === 'string') allValues.push((cell as any).text);
        }
      });
    });
    const joined = allValues.join(' | ');
    // Consumed and balance from ledgerCalculations with Integer KM: Day1 consumed 5.9, balance 25.5; Day4 balance 48.5
    const has59 = joined.includes('5.9') || numericValues.includes(5.9);
    expect(has59).toBe(true);
    expect(joined).toContain('25.5');
    expect(joined).toContain('48.5');
    expect(joined).toContain('10.5');
    expect(joined).toContain('10.8');
  });

  it('includes page grand totals and continuity stamp', () => {
    const wb = generateBookMirrorWorkbook({ pages: [page14], trips, vehicle });
    const sheet = wb.worksheets[0];
    const allValues: string[] = [];
    sheet.eachRow((row) => {
      row.eachCell((cell) => {
        if (cell.value !== null && cell.value !== undefined) allValues.push(String(cell.value));
      });
    });
    const joined = allValues.join(' | ');
    expect(joined).toContain('190');
    expect(joined).toContain('Continuity');
    expect(joined).toContain('142875');
  });

  it('handles multiple pages with continuity', () => {
    const page15 = makePage({ id: 'page-15', page_number: 15, month: '2024-10', start_km: 142875.0, end_km: 142900.0, start_fuel_balance: 48.3, end_fuel_balance: 46.0 });
    const trips2 = [
      makeTrip({ id: 't11', date: '2024-10-25', page_id: 'page-15', trip_index: 1, start_km: 142875.0, end_km: 142900.0, trip_distance: 25.0 }),
    ];
    const wb = generateBookMirrorWorkbook({ pages: [page14, page15], trips: [...trips, ...trips2], vehicle });
    const sheet = wb.worksheets[0];
    const allValues: string[] = [];
    sheet.eachRow((row) => {
      row.eachCell((cell) => {
        if (cell.value !== null && cell.value !== undefined) allValues.push(String(cell.value));
      });
    });
    const joined = allValues.join(' | ');
    expect(joined).toContain('PAGE 14');
    expect(joined).toContain('PAGE 15');
    expect(joined).toContain('142900.0');
  });

  it('handles empty pages/trips gracefully', () => {
    const wb = generateBookMirrorWorkbook({ pages: [], trips: [], vehicle });
    expect(wb.worksheets.length).toBe(1);
    const sheet = wb.worksheets[0];
    const allValues: string[] = [];
    sheet.eachRow((row) => {
      row.eachCell((cell) => {
        if (cell.value !== null && cell.value !== undefined) allValues.push(String(cell.value));
      });
    });
    const joined = allValues.join(' | ');
    expect(joined).toContain('RUNNING CHART');
    expect(joined).toContain('No pages');
  });
});

describe('generateExcelBuffer', () => {
  it('produces non-empty xlsx buffer with PK header', async () => {
    const vehicle = makeVehicle();
    const page = makePage({ id: 'page-1', page_number: 1, month: '2024-10', start_km: 100, end_km: 120, start_fuel_balance: 30, end_fuel_balance: 28 });
    const trips = [makeTrip({ id: 't1', date: '2024-10-21', page_id: 'page-1', trip_index: 1, start_km: 100, end_km: 110, trip_distance: 10, places_visited: 'Test Route' })];
    const buffer = await generateExcelBuffer({ pages: [page], trips, vehicle });
    expect(buffer.byteLength).toBeGreaterThan(1000);
    const header = Buffer.from(buffer.slice(0, 2)).toString('utf-8');
    expect(header).toBe('PK');
    // Verify readable back
    const wb2 = new ExcelJS.Workbook();
    await wb2.xlsx.load(buffer as any);
    expect(wb2.worksheets.length).toBe(1);
    const sheet = wb2.worksheets[0];
    let found = false;
    sheet.eachRow((row) => {
      row.eachCell((cell) => {
        if (String(cell.value).includes('Test Route')) found = true;
      });
    });
    expect(found).toBe(true);
  });
});
