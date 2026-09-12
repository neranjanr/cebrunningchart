/**
  * All Trips Workbook Contract (Phase 3 #05 / Spec section 26-28)
  * Pure utilities for exporting and importing the All Trips master workbook.
  */
import ExcelJS from 'exceljs';
import type { Trip, BookPage } from '@/types';
import { roundToIntegerKm, roundToOneDecimal } from './tripCalculations';
import { assignPageForNewTrip, validateTripForPage, isBackdatedInsertion, renumberPagesChronologically, recalculatePageBalancesFromOpening, BookOpening } from './pagination';

export const ALL_TRIPS_HEADERS = [
  'Date',
  'Start KM',
  'End KM',
  'Distance',
  'Start Time',
  'End Time',
  'Type',
  'Places Visited',
  'Fuel Pumped',
  'Fuel Order No',
];

export function getAllTripsFileName(vehicle?: { brand: string; model: string } | null, dateStr?: string): string {
  const datePart = dateStr ?? new Date().toISOString().slice(0, 10);
  if (!vehicle) return `AllTrips_${datePart}.xlsx`;
  const safeBrand = vehicle.brand.replace(/\s+/g, '_');
  const safeModel = vehicle.model.replace(/\s+/g, '_');
  return `AllTrips_${safeBrand}_${safeModel}_${datePart}.xlsx`;
}

export function generateAllTripsWorkbook(trips: Trip[], vehicle?: { brand: string; model: string; registration_no?: string } | null): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'FleetLedger';
  workbook.created = new Date();
  const sheet = workbook.addWorksheet('All Trips', {
    properties: { tabColor: { argb: '0EA5E9' } },
  });

  sheet.columns = [
    { key: 'date', width: 12 },
    { key: 'startKm', width: 12 },
    { key: 'endKm', width: 12 },
    { key: 'distance', width: 12 },
    { key: 'startTime', width: 12 },
    { key: 'endTime', width: 12 },
    { key: 'type', width: 12 },
    { key: 'placesVisited', width: 28 },
    { key: 'fuelPumped', width: 14 },
    { key: 'fuelOrderNo', width: 16 },
  ];

  // Header row
  const headerRow = sheet.addRow(ALL_TRIPS_HEADERS);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } } as ExcelJS.Fill;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });
  headerRow.height = 18;

  const sortedTrips = [...trips].sort((a, b) => a.date.localeCompare(b.date) || a.start_km - b.start_km);

  for (const t of sortedTrips) {
    const row = sheet.addRow([
      t.date,
      roundToIntegerKm(t.start_km),
      roundToIntegerKm(t.end_km),
      roundToIntegerKm(t.trip_distance),
      t.start_time ?? '',
      t.end_time,
      t.trip_type ?? 'Official',
      t.places_visited,
      t.fuel_pumped_amount ? roundToOneDecimal(t.fuel_pumped_amount) : 0,
      t.fuel_order_no ?? '',
    ]);

    row.eachCell((cell, colNum) => {
      cell.font = { size: 9 };
      if (colNum === 2 || colNum === 3 || colNum === 4) {
        cell.numFmt = '0';
        cell.alignment = { horizontal: 'right' };
      } else if (colNum === 9) {
        cell.numFmt = '0.0';
        cell.alignment = { horizontal: 'right' };
      } else if (colNum === 1 || colNum === 5 || colNum === 6 || colNum === 7) {
        cell.alignment = { horizontal: 'center' };
      } else {
        cell.alignment = { horizontal: 'left' };
      }
    });
    row.height = 14;
  }

  sheet.pageSetup = {
    paperSize: 9,
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
  };

  return workbook;
}

export async function generateAllTripsBuffer(trips: Trip[], vehicle?: { brand: string; model: string; registration_no?: string } | null): Promise<ArrayBuffer> {
  const wb = generateAllTripsWorkbook(trips, vehicle);
  const buf = await wb.xlsx.writeBuffer();
  return buf as ArrayBuffer;
}

export interface ImportError {
  row: number;
  field: string;
  message: string;
}

export interface ImportParseResult {
  valid: boolean;
  trips: Partial<Trip>[];
  errors: ImportError[];
}

export async function parseAllTripsWorkbook(buffer: ArrayBuffer): Promise<ImportParseResult> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as any);
  } catch {
    return { valid: false, trips: [], errors: [{ row: 0, field: 'file', message: 'Invalid Excel file format (.xlsx required)' }] };
  }

  const sheet = workbook.getWorksheet('All Trips') || workbook.worksheets[0];
  if (!sheet) {
    return { valid: false, trips: [], errors: [{ row: 0, field: 'sheet', message: 'No sheet found in workbook' }] };
  }

  const errors: ImportError[] = [];
  const parsedTrips: Partial<Trip>[] = [];

  let headerRowIndex = 0;

  sheet.eachRow((row, rowIdx) => {
    if (headerRowIndex > 0) return;
    const vals: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell) => {
      vals.push(String(cell.value ?? ''));
    });
    if (vals.some(v => v.toLowerCase() === 'date')) {
      headerRowIndex = rowIdx;
    }
  });

  if (headerRowIndex === 0) headerRowIndex = 1;

  sheet.eachRow((row, rowIdx) => {
    if (rowIdx <= headerRowIndex) return;

    const getVal = (colIdx: number) => {
      const v = row.getCell(colIdx).value;
      if (v === null || v === undefined) return '';
      if (typeof v === 'object' && 'text' in v) return String((v as any).text).trim();
      if (typeof v === 'object' && 'result' in v) return String((v as any).result ?? '').trim();
      return String(v).trim();
    };

    const dateStr = getVal(1);
    const startKmStr = getVal(2);
    const endKmStr = getVal(3);

    const distanceStr = getVal(4);
    const startTimeStr = getVal(5);
    const endTimeStr = getVal(6);
    const typeStr = getVal(7) || 'Official';
    const placesVisited = getVal(8);
    const fuelPumpedStr = getVal(9);
    const fuelOrderNo = getVal(10);

    // Validate essential fields: Date, Start KM, End KM, End Time, Places Visited
    if (!dateStr) errors.push({ row: rowIdx, field: 'Date', message: 'Date is required (YYYY-MM-DD)' });
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) errors.push({ row: rowIdx, field: 'Date', message: `Invalid date format: ${dateStr} (expected YYYY-MM-DD)` });

    if (!startKmStr) errors.push({ row: rowIdx, field: 'Start KM', message: 'Start KM is required' });
    const startKm = parseInt(startKmStr, 10);
    if (isNaN(startKm)) errors.push({ row: rowIdx, field: 'Start KM', message: `Invalid Start KM: ${startKmStr}` });

    if (!endKmStr) errors.push({ row: rowIdx, field: 'End KM', message: 'End KM is required' });
    const endKm = parseInt(endKmStr, 10);
    if (isNaN(endKm)) errors.push({ row: rowIdx, field: 'End KM', message: `Invalid End KM: ${endKmStr}` });

    if (!isNaN(startKm) && !isNaN(endKm) && endKm < startKm) {
      errors.push({ row: rowIdx, field: 'End KM', message: `End KM (${endKm}) cannot be less than Start KM (${startKm})` });
    }

    let distance = distanceStr ? parseInt(distanceStr, 10) : NaN;
    if (isNaN(distance) && !isNaN(startKm) && !isNaN(endKm)) {
      distance = roundToIntegerKm(endKm - startKm);
    } else if (isNaN(distance)) {
      errors.push({ row: rowIdx, field: 'Distance', message: 'Distance could not be derived' });
    }

    if (!endTimeStr) errors.push({ row: rowIdx, field: 'End Time', message: 'End Time is required (HH:MM)' });

    if (!placesVisited) errors.push({ row: rowIdx, field: 'Places Visited', message: 'Places Visited is required' });

    const tripType = typeStr.toLowerCase().includes('priv') ? 'Private' : 'Official';
    const fuelPumped = fuelPumpedStr ? parseFloat(fuelPumpedStr) : 0;

    parsedTrips.push({
      date: dateStr,
      start_km: startKm,
      end_km: endKm,
      trip_distance: distance,
      start_time: startTimeStr || undefined,
      end_time: endTimeStr,
      trip_type: tripType,
      places_visited: placesVisited,
      fuel_pumped_amount: isNaN(fuelPumped) ? 0 : roundToOneDecimal(fuelPumped),
      fuel_order_no: fuelOrderNo || undefined,
    });
  });

  return {
    valid: errors.length === 0,
    trips: parsedTrips,
    errors,
  };
}
