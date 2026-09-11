'use client';

import React from 'react';
import type { LedgerDay, LedgerSummary } from '@/lib/ledgerCalculations';
import { roundToOneDecimal } from '@/lib/tripCalculations';

interface Props {
  pageNumber: number;
  ledgerDays: LedgerDay[];
  summary: LedgerSummary;
  vehicleTankCapacity: number;
  rawEconomies: (number | null)[];
  onEconomyChange: (dayIndex: number, value: string) => void;
}

export function Side2FuelTables({ pageNumber, ledgerDays, summary, vehicleTankCapacity, rawEconomies, onEconomyChange }: Props) {
  if (ledgerDays.length === 0) {
    return (
      <div className="flex flex-col bg-paper-ledger p-2 md:p-3 rounded shadow-sm print:shadow-none print:border print:border-rule-line">
        <div className="flex items-center justify-between bg-slate-surface text-on-primary px-3 py-1 rounded mb-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold tracking-widest bg-primary-container text-telemetry-cyan px-1.5 py-0.5 rounded uppercase">SIDE 2</span>
            <span className="text-sm font-bold tracking-tight text-paper-sheet">FUEL & CONSUMPTION AUDIT TABLES</span>
          </div>
          <span className="text-[10px] font-semibold tracking-widest text-surface-container-highest uppercase">PAGE {pageNumber}-B BALANCE MATRIX</span>
        </div>
        <div className="py-12 text-center text-on-surface-variant text-sm">No fuel data — add trips to generate ledger.</div>
      </div>
    );
  }

  const fuelLevelPercent = vehicleTankCapacity > 0 ? Math.min(100, Math.max(0, (summary.finalBalance / vehicleTankCapacity) * 100)) : 0;

  return (
    <div className="flex flex-col bg-paper-ledger p-2 md:p-3 rounded shadow-sm print:shadow-none print:border print:border-rule-line gap-3">
      {/* Leaf Running Header */}
      <div className="flex items-center justify-between bg-slate-surface text-on-primary px-3 py-1 rounded">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold tracking-widest bg-primary-container text-telemetry-cyan px-1.5 py-0.5 rounded uppercase">SIDE 2</span>
          <span className="text-sm font-bold tracking-tight text-paper-sheet">FUEL & CONSUMPTION AUDIT TABLES</span>
        </div>
        <span className="text-[10px] font-semibold tracking-widest text-surface-container-highest uppercase">PAGE {pageNumber}-B BALANCE MATRIX</span>
      </div>

      {/* TABLE 1 */}
      <div>
        <div className="flex items-center justify-between bg-primary-container text-on-primary px-2 py-1 rounded-t">
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-telemetry-cyan">◈</span>
            <span className="text-[10px] font-bold tracking-widest uppercase text-paper-sheet">TABLE 1 • FUEL ECONOMY & CONSUMPTION ANALYSIS</span>
          </div>
          <span className="text-[10px] font-semibold tracking-widest uppercase text-surface-container-highest">Propagating Forward (1 Dec. Pl.)</span>
        </div>
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-on-surface">
            <thead>
              <tr className="bg-surface-container-high text-on-surface text-[10px] font-semibold tracking-widest uppercase">
                <th className="py-1 px-1.5 text-center w-12">Day</th>
                <th className="py-1 px-2 w-24">Date</th>
                <th className="py-1 px-2 text-right">Start KM</th>
                <th className="py-1 px-2 text-right">End KM</th>
                <th className="py-1 px-2 text-right">Daily Dist (KM)</th>
                <th className="py-1 px-2 text-right">Fuel Economy (km/L)</th>
              </tr>
            </thead>
            <tbody className="text-[13px] leading-[18px] font-medium">
              {ledgerDays.map((d, idx) => (
                <tr key={d.date} className={`${idx % 2 === 0 ? 'bg-paper-sheet' : 'bg-paper-ledger'} hover:bg-surface-container-low`}>
                  <td className="py-1.5 px-1.5 text-center font-bold">Day {d.dayIndex}</td>
                  <td className="py-1.5 px-2 text-[10px] font-semibold tracking-widest text-on-surface-variant">{d.dayLabel}</td>
                  <td className="py-1.5 px-2 text-right font-mono text-sm">{d.startKm.toFixed(1)}</td>
                  <td className="py-1.5 px-2 text-right font-mono text-sm">{d.endKm.toFixed(1)}</td>
                  <td className="py-1.5 px-2 text-right font-mono text-sm font-bold">{d.distance.toFixed(1)}</td>
                  <td className="py-1.5 px-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <input
                        aria-label={`Fuel Economy Day ${d.dayIndex}`}
                        type="number"
                        step="0.1"
                        placeholder={d.fuelEconomy.toFixed(1)}
                        value={rawEconomies[idx] !== null && rawEconomies[idx] !== undefined ? String(rawEconomies[idx]) : ''}
                        onChange={(e) => onEconomyChange(idx, e.target.value)}
                        className="w-16 px-1.5 py-0.5 border border-rule-line rounded text-right font-mono text-sm focus:ring-1 focus:ring-telemetry-cyan focus:outline-none print:border-none print:bg-transparent"
                      />
                      <span className={`text-[9px] font-bold tracking-widest uppercase px-1 rounded ${d.economySource === 'explicit' ? 'bg-surface-container-highest text-telemetry-cyan' : d.economySource === 'inherited' ? 'text-on-surface-variant' : 'text-on-surface-variant'}`}>
                        {d.economySource === 'explicit' ? 'Adjusted' : d.economySource === 'inherited' ? '(Inh.)' : '(Def.)'}
                      </span>
                    </div>
                    {/* Show propagated value when inherited */}
                    {d.economySource !== 'explicit' && (
                      <span className="text-[10px] font-mono text-on-surface-variant">{d.fuelEconomy.toFixed(1)}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-surface-container-high font-bold text-on-surface">
                <td colSpan={4} className="py-1 px-2 text-right text-[10px] font-semibold tracking-widest uppercase text-on-surface-variant">
                  Total Page Distance Tally:
                </td>
                <td className="py-1 px-2 text-right font-mono text-sm text-primary">{summary.totalDistance.toFixed(1)} KM</td>
                <td className="py-1 px-2 text-right font-mono text-sm text-trip-official">Weighted: {summary.weightedEconomy.toFixed(1)} km/L</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* TABLE 2 */}
      <div>
        <div className="flex items-center justify-between bg-primary-container text-on-primary px-2 py-1 rounded-t">
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-trip-official">●</span>
            <span className="text-[10px] font-bold tracking-widest uppercase text-paper-sheet">TABLE 2 • FUEL POSITION & BALANCE ACCOUNT</span>
          </div>
          <span className="text-[10px] font-semibold tracking-widest uppercase text-surface-container-highest">Audit Tank Rule (1 Dec. Pl.)</span>
        </div>
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-on-surface">
            <thead>
              <tr className="bg-surface-container-high text-on-surface text-[10px] font-semibold tracking-widest uppercase">
                <th className="py-1 px-1 text-center w-10">Day</th>
                <th className="py-1 px-1.5 text-right">Start Pos. (L)</th>
                <th className="py-1 px-1.5 text-right">In-Tank (L)</th>
                <th className="py-1 px-1.5 text-right">Pumped (L)</th>
                <th className="py-1 px-2">Order No / Date</th>
                <th className="py-1 px-1.5 text-right">Consumed (L)</th>
                <th className="py-1 px-2 text-right">Closing Balance</th>
              </tr>
            </thead>
            <tbody className="text-[13px] leading-[18px] font-medium">
              {ledgerDays.map((d, idx) => (
                <tr key={d.date} className={`${idx % 2 === 0 ? 'bg-paper-sheet' : 'bg-paper-ledger'} hover:bg-surface-container-low`}>
                  <td className="py-1.5 px-1 text-center font-bold">{d.dayIndex}</td>
                  <td className="py-1.5 px-1.5 text-right font-mono text-sm text-on-surface-variant">{d.fuelPosition.toFixed(1)}</td>
                  <td className="py-1.5 px-1.5 text-right font-mono text-sm">{d.fuelPosition.toFixed(1)}</td>
                  <td className={`py-1.5 px-1.5 text-right font-mono text-sm ${d.drawn > 0 ? 'text-trip-official font-bold' : 'text-on-surface-variant'}`}>
                    {d.drawn > 0 ? `+${d.drawn.toFixed(1)}` : '0.0'}
                  </td>
                  <td className="py-1.5 px-2 text-[10px] font-semibold tracking-widest">
                    {d.drawn > 0 ? (
                      <span className="text-on-surface font-semibold">{d.fuelOrderNo || '-'} {d.fuelOrderDate ? `(${d.fuelOrderDate.slice(5).replace('-','/')})` : ''}</span>
                    ) : (
                      <span className="text-on-surface-variant">-</span>
                    )}
                  </td>
                  <td className="py-1.5 px-1.5 text-right font-mono text-sm font-semibold">{d.consumed.toFixed(1)}</td>
                  <td className={`py-1.5 px-2 text-right font-mono text-sm font-bold ${idx === ledgerDays.length -1 ? 'text-telemetry-cyan' : d.drawn>0 ? 'text-trip-official' : 'text-on-surface'}`}>
                    {d.balance.toFixed(1)} L
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-surface-container-high font-bold text-on-surface">
                <td colSpan={3} className="py-1 px-1.5 text-right text-[10px] font-semibold tracking-widest uppercase text-on-surface-variant">
                  Page {pageNumber} Totals:
                </td>
                <td className="py-1 px-1.5 text-right font-mono text-sm text-trip-official font-bold">{summary.totalDrawn.toFixed(1)} L</td>
                <td className="py-1 px-2 text-[10px] font-semibold tracking-widest uppercase text-on-surface-variant">Total Inflow</td>
                <td className="py-1 px-1.5 text-right font-mono text-sm text-error font-bold">{summary.totalConsumed.toFixed(1)} L</td>
                <td className="py-1 px-2 text-right font-mono text-sm text-primary font-bold">{summary.finalBalance.toFixed(1)} L</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Fuel Tank Level State */}
      <div className="p-2 bg-paper-sheet rounded shadow-sm print:shadow-none print:border print:border-rule-line">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-bold tracking-widest uppercase text-on-surface">Fuel Tank Level State</span>
          <span className="font-mono text-sm font-bold text-telemetry-cyan">
            {summary.finalBalance.toFixed(1)} L / {vehicleTankCapacity.toFixed(1)} L ({roundToOneDecimal(fuelLevelPercent).toFixed(1)}%)
          </span>
        </div>
        <div className="w-full h-3 bg-paper-gutter rounded-full overflow-hidden flex">
          <div className="h-full bg-telemetry-cyan rounded-full" style={{ width: `${Math.min(100, fuelLevelPercent)}%` }} />
        </div>
        <div className="flex items-center justify-between mt-1 text-on-surface-variant text-[10px] font-semibold tracking-widest uppercase">
          <span>Reserve Limit: 10.0 L</span>
          <span>Formula: Consumed = Distance ÷ Econ</span>
          <span>Avail: {(vehicleTankCapacity - summary.finalBalance).toFixed(1)} L</span>
        </div>
      </div>

      {/* Continuity Stamp */}
      <div className="mt-auto p-3 bg-slate-surface text-on-primary rounded shadow-md flex flex-col gap-2 print:bg-white print:text-black print:border print:border-slate-400">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-trip-official">✔</span>
            <div className="flex flex-col">
              <span className="text-[10px] font-semibold tracking-widest uppercase text-surface-container-highest print:text-slate-600">CONTINUITY VERIFICATION STAMP</span>
              <span className="text-sm font-bold text-paper-sheet print:text-black">Page {pageNumber} Closed & Authenticated</span>
            </div>
          </div>
          <span className="text-[10px] font-bold tracking-widest uppercase bg-primary text-tertiary-fixed px-2 py-1 rounded print:bg-slate-200 print:text-black">
            Ready for Page {pageNumber + 1}
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2 bg-primary-container p-2 rounded print:bg-slate-100">
          <div className="flex flex-col">
            <span className="text-[10px] font-semibold tracking-widest uppercase text-on-primary-container">Carried Forward Odometer:</span>
            <span className="font-mono text-lg font-bold text-paper-sheet print:text-black">
              {ledgerDays[ledgerDays.length - 1]?.endKm.toFixed(1) ?? '-'} <span className="text-[10px] font-semibold tracking-widest text-tertiary-fixed">KM</span>
            </span>
            <span className="text-[11px] text-surface-container-highest print:text-slate-600">Identical to Page {pageNumber + 1} Day 1 Start KM</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-semibold tracking-widest uppercase text-on-primary-container">Carried Forward Fuel Stock:</span>
            <span className="font-mono text-lg font-bold text-telemetry-cyan">{summary.finalBalance.toFixed(1)} <span className="text-[10px] font-semibold tracking-widest text-tertiary-fixed">LITERS</span></span>
            <span className="text-[11px] text-surface-container-highest print:text-slate-600">Transferred to Page {pageNumber + 1} Opening Tank Balance</span>
          </div>
        </div>
      </div>
    </div>
  );
}
