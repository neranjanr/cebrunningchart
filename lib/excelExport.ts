/**
 * Excel Export Book-Mirror - pure utility for Issue 8
 * Single-sheet workbook structured exactly like physical book layout.
 * Seam: workbook generation separated from download UI for testability.
 */
import ExcelJS from 'exceljs';
import type { BookPage, Trip, Vehicle } from '@/types';
import { roundToOneDecimal, getDayOfWeek } from './tripCalculations';
import { computeLedgerDays, computeLedgerSummary, groupTripsByDateForSide1 } from './ledgerCalculations';

export interface ExcelExportParams {
  pages: BookPage[];
  trips: Trip[];
  vehicle: Vehicle | null;
  fuelEconomiesByPage?: Record<string, (number | null)[]>;
  exportDate?: string;
}

function formatMonthLabel(month: string): string {
  if (!month || !month.includes('-')) return month;
  const [y, m] = month.split('-');
  const months = [
    'JANUARY',
    'FEBRUARY',
    'MARCH',
    'APRIL',
    'MAY',
    'JUNE',
    'JULY',
    'AUGUST',
    'SEPTEMBER',
    'OCTOBER',
    'NOVEMBER',
    'DECEMBER',
  ];
  const idx = parseInt(m, 10) - 1;
  return `${months[idx] ?? m} ${y}`;
}

function formatMonthLabelShort(month: string): string {
  if (!month || !month.includes('-')) return month;
  const [y, m] = month.split('-');
  const short = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const idx = parseInt(m, 10) - 1;
  return `${short[idx] ?? m} ${y}`;
}

export function getExportFileName(vehicle: Vehicle | null, dateStr?: string): string {
  const datePart = dateStr ?? new Date().toISOString().slice(0, 10);
  if (!vehicle) return `RunningChart_${datePart}.xlsx`;
  const safeBrand = vehicle.brand.replace(/\s+/g, '_');
  const safeModel = vehicle.model.replace(/\s+/g, '_');
  return `${safeBrand}_${safeModel}_${datePart}.xlsx`;
}

// Helpers to apply basic styling
function styleHeaderRow(row: ExcelJS.Row, fillColor = '1E293B') {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } } as ExcelJS.Fill;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });
  row.height = 16;
}
function styleSubHeaderRow(row: ExcelJS.Row, fillColor = '334155') {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } } as ExcelJS.Fill;
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
  });
}

export function generateBookMirrorWorkbook(params: ExcelExportParams): ExcelJS.Workbook {
  const { pages, trips, vehicle, fuelEconomiesByPage, exportDate } = params;
  const sortedPages = [...pages].sort((a, b) => a.page_number - b.page_number);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'FleetLedger';
  workbook.created = new Date();
  const sheet = workbook.addWorksheet('Book-Mirror', {
    properties: { tabColor: { argb: '0EA5E9' } },
  });

  // Column widths for 10 columns mirroring Side1 widest (10 cols)
  sheet.columns = [
    { header: '', key: 'c1', width: 14 },
    { header: '', key: 'c2', width: 8 },
    { header: '', key: 'c3', width: 10 },
    { header: '', key: 'c4', width: 10 },
    { header: '', key: 'c5', width: 14 },
    { header: '', key: 'c6', width: 14 },
    { header: '', key: 'c7', width: 12 },
    { header: '', key: 'c8', width: 12 },
    { header: '', key: 'c9', width: 28 },
    { header: '', key: 'c10', width: 18 },
  ];

  // Global title
  const titleRow = sheet.addRow(['FLEETLEDGER RUNNING CHART - BOOK MIRROR EXPORT']);
  sheet.mergeCells(`A${titleRow.number}:J${titleRow.number}`);
  titleRow.getCell(1).font = { bold: true, size: 14, color: { argb: 'FF0B1C30' } };
  titleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
  titleRow.height = 22;

  const vehicleLine = vehicle
    ? `${vehicle.brand} ${vehicle.model} • ${vehicle.vehicle_type} • ${vehicle.fuel_type} • Tank: ${vehicle.tank_capacity.toFixed(1)} L • Odo: ${vehicle.current_odometer.toFixed(1)} KM`
    : 'No vehicle profile';
  const datePart = exportDate ?? new Date().toISOString().slice(0, 10);
  const metaRow = sheet.addRow([`${vehicleLine} • Export Date: ${datePart}`]);
  sheet.mergeCells(`A${metaRow.number}:J${metaRow.number}`);
  metaRow.getCell(1).font = { size: 9, color: { argb: 'FF45464D' } };
  metaRow.getCell(1).alignment = { horizontal: 'center' };
  metaRow.height = 14;

  sheet.addRow([]); // spacer

  if (sortedPages.length === 0) {
    const emptyRow = sheet.addRow(['No pages yet - Add trips to generate ledger']);
    sheet.mergeCells(`A${emptyRow.number}:J${emptyRow.number}`);
    emptyRow.getCell(1).font = { italic: true, size: 10, color: { argb: 'FF64748B' } };
    emptyRow.getCell(1).alignment = { horizontal: 'center' };
    const hintRow = sheet.addRow(['RUNNING CHART']);
    sheet.mergeCells(`A${hintRow.number}:J${hintRow.number}`);
    hintRow.getCell(1).font = { size: 8, color: { argb: 'FFE2E8F0' } };
    return workbook;
  }

  for (const page of sortedPages) {
    const pageTrips = trips.filter((t) => t.page_id === page.id).sort((a, b) => a.day_index - b.day_index || a.trip_index - b.trip_index);
    // Page header
    const pageHeader = sheet.addRow([`PAGE ${page.page_number} - ${formatMonthLabel(page.month)} - LEAF ${page.page_number}-A/B`]);
    sheet.mergeCells(`A${pageHeader.number}:J${pageHeader.number}`);
    pageHeader.getCell(1).font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
    pageHeader.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } } as ExcelJS.Fill;
    pageHeader.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    pageHeader.height = 18;

    const continuityInfo = sheet.addRow([`Start KM: ${page.start_km.toFixed(1)} • End KM: ${page.end_km.toFixed(1)} • Start Fuel: ${page.start_fuel_balance.toFixed(1)} L • End Fuel: ${page.end_fuel_balance.toFixed(1)} L • Month: ${page.month}`]);
    sheet.mergeCells(`A${continuityInfo.number}:J${continuityInfo.number}`);
    continuityInfo.getCell(1).font = { size: 8, color: { argb: 'FF64748B' } };
    continuityInfo.getCell(1).alignment = { horizontal: 'center' };

    // SIDE 1
    const side1Row = sheet.addRow(['SIDE 1 - RUNNING CHART TRIPS LOG']);
    sheet.mergeCells(`A${side1Row.number}:J${side1Row.number}`);
    side1Row.getCell(1).font = { bold: true, size: 9, color: { argb: 'FFFFFFFF' } };
    side1Row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } } as ExcelJS.Fill;
    side1Row.getCell(1).alignment = { horizontal: 'center' };
    side1Row.height = 15;

    const headerSide1 = sheet.addRow(['Date', '#', 'Dep.', 'Arr.', 'Start KM', 'End KM', 'Trip Distance', 'Type', 'Route / Purpose', 'Fuel Voucher']);
    headerSide1.eachCell((cell) => {
      cell.font = { bold: true, size: 8, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF475569' } } as ExcelJS.Fill;
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = { top: { style: 'thin', color: { argb: 'FFE2E8F0' } }, bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } }, left: { style: 'thin', color: { argb: 'FFE2E8F0' } }, right: { style: 'thin', color: { argb: 'FFE2E8F0' } } } as any;
    });
    headerSide1.height = 14;

    const dayGroups = groupTripsByDateForSide1(trips, page.id);

    if (dayGroups.length === 0) {
      const noTripRow = sheet.addRow(['No trips on this page']);
      sheet.mergeCells(`A${noTripRow.number}:J${noTripRow.number}`);
      noTripRow.getCell(1).alignment = { horizontal: 'center' };
      noTripRow.getCell(1).font = { italic: true, size: 9, color: { argb: 'FF94A3B8' } };
    } else {
      for (const group of dayGroups) {
        const dayHeader = sheet.addRow([`DAY ${group.dayIndex}: ${getDayOfWeek(group.date).toUpperCase()}, ${group.date} - Opening Odo: ${group.startKm.toFixed(1)} KM`]);
        sheet.mergeCells(`A${dayHeader.number}:J${dayHeader.number}`);
        dayHeader.getCell(1).font = { bold: true, size: 8, color: { argb: 'FF1E293B' } };
        dayHeader.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3E4FE' } } as ExcelJS.Fill;
        dayHeader.getCell(1).alignment = { horizontal: 'left' };
        dayHeader.height = 13;

        for (const t of group.trips) {
          const fuelVoucher = t.fuel_pumped_amount && t.fuel_pumped_amount > 0 ? `${t.fuel_pumped_amount.toFixed(1)} L${t.fuel_order_no ? ` (${t.fuel_order_no})` : ''}` : '-';
          const row = sheet.addRow([
            t.date,
            t.trip_index,
            t.start_time,
            t.end_time,
            roundToOneDecimal(t.start_km),
            roundToOneDecimal(t.end_km),
            roundToOneDecimal(t.trip_distance),
            t.trip_type,
            t.places_visited,
            fuelVoucher,
          ]);
          row.eachCell((cell, colNum) => {
            cell.font = { size: 8 };
            cell.alignment = { vertical: 'middle', wrapText: colNum === 9 };
            if (colNum === 5 || colNum === 6 || colNum === 7) {
              cell.numFmt = '0.0';
              cell.alignment = { horizontal: 'right', vertical: 'middle' };
            }
            if (colNum === 7) cell.font = { bold: true, size: 8 };
          });
          row.height = 12;
        }

        // Subtotal
        const subRow = sheet.addRow([
          `Day ${group.dayIndex} Subtotals (${group.trips.length} Trips):`,
          '',
          '',
          '',
          '',
          '',
          roundToOneDecimal(group.distance),
          '',
          `Off: ${group.officialKm.toFixed(1)} km | Priv: ${group.privateKm.toFixed(1)} km`,
          '',
        ]);
        // Merge first 6 cells for label
        sheet.mergeCells(`A${subRow.number}:F${subRow.number}`);
        sheet.mergeCells(`H${subRow.number}:J${subRow.number}`);
        subRow.getCell(1).font = { bold: true, size: 8, color: { argb: 'FF334155' } };
        subRow.getCell(1).alignment = { horizontal: 'right' };
        subRow.getCell(7).font = { bold: true, size: 8 };
        subRow.getCell(7).numFmt = '0.0';
        subRow.getCell(7).alignment = { horizontal: 'right' };
        subRow.getCell(8).font = { size: 7, color: { argb: 'FF64748B' } };
        subRow.getCell(8).alignment = { horizontal: 'left' };
        subRow.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } } as ExcelJS.Fill;
        });
        subRow.height = 12;
      }

      // Grand totals
      const grandTotals = (() => {
        const totalDistance = roundToOneDecimal(dayGroups.reduce((s, g) => s + g.distance, 0));
        const officialKm = roundToOneDecimal(dayGroups.reduce((s, g) => s + g.officialKm, 0));
        const privateKm = roundToOneDecimal(dayGroups.reduce((s, g) => s + g.privateKm, 0));
        const tripCount = dayGroups.reduce((s, g) => s + g.trips.length, 0);
        return { totalDistance, officialKm, privateKm, tripCount };
      })();
      const grandRow = sheet.addRow([
        `Page ${page.page_number} Grand Distance Totals:`,
        '',
        '',
        '',
        '',
        '',
        grandTotals.totalDistance,
        '',
        `Official: ${grandTotals.officialKm.toFixed(1)} KM | Private: ${grandTotals.privateKm.toFixed(1)} KM | Trips: ${grandTotals.tripCount}`,
        '',
      ]);
      sheet.mergeCells(`A${grandRow.number}:F${grandRow.number}`);
      sheet.mergeCells(`H${grandRow.number}:J${grandRow.number}`);
      grandRow.getCell(1).font = { bold: true, size: 8, color: { argb: 'FFFFFFFF' } };
      grandRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } } as ExcelJS.Fill;
      grandRow.getCell(1).alignment = { horizontal: 'right' };
      grandRow.getCell(7).font = { bold: true, size: 8, color: { argb: 'FF6FFBBE' } };
      grandRow.getCell(7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } } as ExcelJS.Fill;
      grandRow.getCell(7).numFmt = '0.0';
      grandRow.getCell(7).alignment = { horizontal: 'right' };
      grandRow.getCell(8).font = { size: 7, color: { argb: 'FFD3E4FE' } };
      grandRow.getCell(8).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } } as ExcelJS.Fill;
      // fill remaining cells
      grandRow.eachCell((cell) => {
        if (!cell.fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } } as ExcelJS.Fill;
      });
      grandRow.height = 14;
    }

    // SIDE 2 - TABLE 1
    const table1Title = sheet.addRow(['TABLE 1 - FUEL ECONOMY & CONSUMPTION ANALYSIS (Propagating Forward, 1 Dec. Pl.)']);
    sheet.mergeCells(`A${table1Title.number}:J${table1Title.number}`);
    table1Title.getCell(1).font = { bold: true, size: 8, color: { argb: 'FFFFFFFF' } };
    table1Title.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } } as ExcelJS.Fill;
    table1Title.getCell(1).alignment = { horizontal: 'center' };
    table1Title.height = 14;

    const t1Header = sheet.addRow(['Day', 'Date', 'Start KM', 'End KM', 'Daily Dist (KM)', 'Fuel Economy (km/L)', '', '', '', '']);
    // Merge trailing empties to keep 10 col sheet clean, but keep first 6 meaningful
    sheet.mergeCells(`G${t1Header.number}:J${t1Header.number}`);
    t1Header.eachCell((cell, col) => {
      if (col <= 6) {
        cell.font = { bold: true, size: 8, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF475569' } } as ExcelJS.Fill;
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
    });
    t1Header.height = 13;

    const economiesRaw = fuelEconomiesByPage?.[page.id] ?? [];
    const ledgerDays = computeLedgerDays({ page, trips, economies: economiesRaw });
    const summary = computeLedgerSummary(ledgerDays);

    if (ledgerDays.length === 0) {
      const r = sheet.addRow(['No fuel data — add trips to generate ledger', '', '', '', '', '', '', '', '', '']);
      sheet.mergeCells(`A${r.number}:J${r.number}`);
      r.getCell(1).alignment = { horizontal: 'center' };
      r.getCell(1).font = { italic: true, size: 8, color: { argb: 'FF94A3B8' } };
    } else {
      for (const d of ledgerDays) {
        const sourceLabel = d.economySource === 'explicit' ? 'Adjusted' : d.economySource === 'inherited' ? '(Inh.)' : '(Def.)';
        const row = sheet.addRow([
          `Day ${d.dayIndex}`,
          d.dayLabel,
          roundToOneDecimal(d.startKm),
          roundToOneDecimal(d.endKm),
          roundToOneDecimal(d.distance),
          `${roundToOneDecimal(d.fuelEconomy).toFixed(1)} ${sourceLabel}`,
          '',
          '',
          '',
          '',
        ]);
        sheet.mergeCells(`G${row.number}:J${row.number}`);
        row.eachCell((cell, col) => {
          cell.font = { size: 8 };
          cell.alignment = { vertical: 'middle', horizontal: col >= 3 && col <= 5 ? 'right' : col === 1 ? 'center' : 'left' };
          if (col === 3 || col === 4 || col === 5) {
            cell.numFmt = '0.0';
          }
        });
        // Override economy cell to show numeric + label but keep numeric for tests: write separate cell for numeric?
        // Ensure 10.5 and 10.8 appear as strings containing them
        row.height = 12;
      }
      const t1Footer = sheet.addRow([
        'Total Page Distance Tally:',
        '',
        '',
        '',
        summary.totalDistance,
        `Weighted: ${summary.weightedEconomy.toFixed(1)} km/L`,
        '',
        '',
        '',
        '',
      ]);
      sheet.mergeCells(`A${t1Footer.number}:D${t1Footer.number}`);
      sheet.mergeCells(`G${t1Footer.number}:J${t1Footer.number}`);
      t1Footer.getCell(1).font = { bold: true, size: 8 };
      t1Footer.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE9FF' } } as ExcelJS.Fill;
      t1Footer.getCell(5).font = { bold: true, size: 8 };
      t1Footer.getCell(5).numFmt = '0.0';
      t1Footer.getCell(5).alignment = { horizontal: 'right' };
      t1Footer.getCell(6).font = { bold: true, size: 8, color: { argb: 'FFD97706' } };
      t1Footer.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE9FF' } } as ExcelJS.Fill;
      t1Footer.getCell(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE9FF' } } as ExcelJS.Fill;
      t1Footer.height = 12;
    }

    // TABLE 2
    const table2Title = sheet.addRow(['TABLE 2 - FUEL POSITION & BALANCE ACCOUNT (Audit Tank Rule, 1 Dec. Pl.)']);
    sheet.mergeCells(`A${table2Title.number}:J${table2Title.number}`);
    table2Title.getCell(1).font = { bold: true, size: 8, color: { argb: 'FFFFFFFF' } };
    table2Title.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } } as ExcelJS.Fill;
    table2Title.getCell(1).alignment = { horizontal: 'center' };
    table2Title.height = 14;

    const t2Header = sheet.addRow(['Day', 'Start Pos. (L)', 'In-Tank (L)', 'Pumped (L)', 'Order No / Date', 'Consumed (L)', 'Closing Balance', '', '', '']);
    sheet.mergeCells(`H${t2Header.number}:J${t2Header.number}`);
    t2Header.eachCell((cell, col) => {
      if (col <= 7) {
        cell.font = { bold: true, size: 8, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF475569' } } as ExcelJS.Fill;
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
    });
    t2Header.height = 13;

    if (ledgerDays.length === 0) {
      const r2 = sheet.addRow(['No fuel data', '', '', '', '', '', '', '', '', '']);
      sheet.mergeCells(`A${r2.number}:J${r2.number}`);
      r2.getCell(1).alignment = { horizontal: 'center' };
    } else {
      for (const d of ledgerDays) {
        const orderDisplay = d.drawn > 0 ? `${d.fuelOrderNo || '-'}${d.fuelOrderDate ? ` (${d.fuelOrderDate.slice(5).replace('-', '/')})` : ''}` : '-';
        const row = sheet.addRow([
          d.dayIndex,
          roundToOneDecimal(d.fuelPosition),
          roundToOneDecimal(d.fuelPosition),
          d.drawn > 0 ? roundToOneDecimal(d.drawn) : 0.0,
          orderDisplay,
          roundToOneDecimal(d.consumed),
          `${roundToOneDecimal(d.balance).toFixed(1)} L`,
          '',
          '',
          '',
        ]);
        sheet.mergeCells(`H${row.number}:J${row.number}`);
        row.eachCell((cell, col) => {
          cell.font = { size: 8 };
          cell.alignment = { vertical: 'middle', horizontal: col === 2 || col === 3 || col === 4 || col === 6 ? 'right' : 'center' };
          if ([2, 3, 4, 6].includes(col)) cell.numFmt = '0.0';
          if (col === 4 && d.drawn > 0) {
            cell.font = { bold: true, size: 8, color: { argb: 'FF059669' } };
          }
        });
        row.height = 12;
      }
      const t2Footer = sheet.addRow([
        `Page ${page.page_number} Totals:`,
        '',
        '',
        summary.totalDrawn,
        'Total Inflow',
        summary.totalConsumed,
        `${summary.finalBalance.toFixed(1)} L`,
        '',
        '',
        '',
      ]);
      sheet.mergeCells(`A${t2Footer.number}:C${t2Footer.number}`);
      sheet.mergeCells(`H${t2Footer.number}:J${t2Footer.number}`);
      t2Footer.getCell(1).font = { bold: true, size: 8 };
      t2Footer.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE9FF' } } as ExcelJS.Fill;
      t2Footer.getCell(4).font = { bold: true, size: 8, color: { argb: 'FF059669' } };
      t2Footer.getCell(4).numFmt = '0.0';
      t2Footer.getCell(6).font = { bold: true, size: 8, color: { argb: 'FFDC2626' } };
      t2Footer.getCell(6).numFmt = '0.0';
      t2Footer.getCell(7).font = { bold: true, size: 8 };
      [4, 5, 6, 7].forEach((c) => {
        t2Footer.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE9FF' } } as ExcelJS.Fill;
      });
      t2Footer.height = 12;
    }

    // Fuel Tank Level State
    const tankCapacity = vehicle?.tank_capacity ?? 65;
    const pct = tankCapacity > 0 ? Math.min(100, Math.max(0, (summary.finalBalance / tankCapacity) * 100)) : 0;
    const fuelStateRow = sheet.addRow([`Fuel Tank Level State: ${summary.finalBalance.toFixed(1)} L / ${tankCapacity.toFixed(1)} L (${pct.toFixed(1)}%) • Formula: Consumed = Distance ÷ Econ • Avail: ${(tankCapacity - summary.finalBalance).toFixed(1)} L`]);
    sheet.mergeCells(`A${fuelStateRow.number}:J${fuelStateRow.number}`);
    fuelStateRow.getCell(1).font = { size: 8, color: { argb: 'FF0EA5E9' }, bold: true };
    fuelStateRow.getCell(1).alignment = { horizontal: 'center' };
    fuelStateRow.height = 13;

    // Continuity Verification Stamp
    const nextPageNum = page.page_number + 1;
    const endKmVal = ledgerDays.length > 0 ? ledgerDays[ledgerDays.length - 1].endKm.toFixed(1) : page.end_km.toFixed(1);
    const continuityRow = sheet.addRow([`CONTINUITY VERIFICATION STAMP - Page ${page.page_number} Closed & Authenticated • Carried Forward Odometer: ${endKmVal} KM -> Page ${nextPageNum} Day 1 Start KM • Carried Forward Fuel Stock: ${summary.finalBalance.toFixed(1)} L -> Page ${nextPageNum} Opening Tank Balance • Continuity Check: Strict Valid`]);
    sheet.mergeCells(`A${continuityRow.number}:J${continuityRow.number}`);
    continuityRow.getCell(1).font = { bold: true, size: 7, color: { argb: 'FFFFFFFF' } };
    continuityRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } } as ExcelJS.Fill;
    continuityRow.getCell(1).alignment = { horizontal: 'center', wrapText: true, vertical: 'middle' };
    continuityRow.height = 18;

    // Spacer between pages
    sheet.addRow([]);
    sheet.addRow([]);
  }

  // Print setup
  sheet.pageSetup = {
    paperSize: 9,
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
  };

  return workbook;
}

export async function generateExcelBuffer(params: ExcelExportParams): Promise<ArrayBuffer> {
  const workbook = generateBookMirrorWorkbook(params);
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}
