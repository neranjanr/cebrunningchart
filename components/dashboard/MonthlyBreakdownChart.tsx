'use client';

import React from 'react';
import type { MonthlyBreakdown } from '@/lib/dashboardCalculations';

interface Props {
  data: MonthlyBreakdown[];
}

export function MonthlyBreakdownChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="bg-paper-sheet rounded-xl border border-rule-line p-6 text-center">
        <p className="text-sm text-on-surface-variant">No monthly data yet. Add trips to see breakdown.</p>
      </div>
    );
  }

  const maxTotal = Math.max(...data.map((d) => d.totalKm), 1);

  return (
    <div className="bg-paper-sheet rounded-xl border border-rule-line shadow-sm p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold tracking-tight text-on-surface">Monthly Breakdown</h3>
        <span className="text-[10px] font-semibold tracking-widest uppercase text-on-surface-variant">Official vs Private (KM)</span>
      </div>

      <div className="flex flex-col gap-3">
        {data.map((m) => {
          const officialWidth = m.totalKm > 0 ? (m.officialKm / m.totalKm) * 100 : 0;
          const privateWidth = m.totalKm > 0 ? (m.privateKm / m.totalKm) * 100 : 0;
          const barWidth = (m.totalKm / maxTotal) * 100;
          return (
            <div key={m.monthKey} data-testid={`monthly-row-${m.monthKey}`} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-on-surface">{m.monthLabel}</span>
                <span className="text-xs font-mono font-semibold text-on-surface-variant">
                  {m.totalKm.toFixed(1)} KM • {m.tripCount} trips • {m.pageCount} pages
                </span>
              </div>
              <div className="w-full h-5 bg-paper-gutter rounded-full overflow-hidden flex" style={{ width: `${Math.max(20, barWidth)}%` }}>
                {m.officialKm > 0 && (
                  <div className="h-full bg-trip-official flex items-center justify-center" style={{ width: `${officialWidth}%` }} title={`Official ${m.officialKm.toFixed(1)} KM`}>
                    {officialWidth > 18 && <span className="text-[9px] font-bold text-white tracking-widest">OFF {m.officialKm.toFixed(1)}</span>}
                  </div>
                )}
                {m.privateKm > 0 && (
                  <div className="h-full bg-trip-private flex items-center justify-center" style={{ width: `${privateWidth}%` }} title={`Private ${m.privateKm.toFixed(1)} KM`}>
                    {privateWidth > 18 && <span className="text-[9px] font-bold text-white tracking-widest">PRIV {m.privateKm.toFixed(1)}</span>}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3 text-[10px] font-semibold tracking-widest uppercase text-on-surface-variant">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-trip-official inline-block" /> Off {m.officialKm.toFixed(1)}</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-trip-private inline-block" /> Priv {m.privateKm.toFixed(1)}</span>
                {m.fuelDrawn > 0 && <span className="ml-auto text-trip-official">+{m.fuelDrawn.toFixed(1)} L drawn</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Table fallback for precise values */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-paper-gutter text-on-surface-variant text-[10px] font-semibold tracking-widest uppercase">
              <th className="py-1.5 px-2 rounded-l">Month</th>
              <th className="py-1.5 px-2 text-right">Official</th>
              <th className="py-1.5 px-2 text-right">Private</th>
              <th className="py-1.5 px-2 text-right">Total</th>
              <th className="py-1.5 px-2 text-right">Trips</th>
              <th className="py-1.5 px-2 text-right rounded-r">Fuel Drawn</th>
            </tr>
          </thead>
          <tbody className="font-mono text-on-surface">
            {data.map((m) => (
              <tr key={`tbl-${m.monthKey}`} className="border-t border-rule-line hover:bg-paper-ledger">
                <td className="py-1.5 px-2 font-semibold">{m.monthLabel}</td>
                <td className="py-1.5 px-2 text-right text-trip-official font-bold">{m.officialKm.toFixed(1)}</td>
                <td className="py-1.5 px-2 text-right text-trip-private font-bold">{m.privateKm.toFixed(1)}</td>
                <td className="py-1.5 px-2 text-right font-bold">{m.totalKm.toFixed(1)}</td>
                <td className="py-1.5 px-2 text-right">{m.tripCount}</td>
                <td className="py-1.5 px-2 text-right">{m.fuelDrawn.toFixed(1)} L</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
