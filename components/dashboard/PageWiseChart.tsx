'use client';

import React from 'react';
import type { PageDistance } from '@/lib/dashboardCalculations';

interface Props {
  data: PageDistance[];
}

export function PageWiseChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="bg-paper-sheet rounded-xl border border-rule-line p-6 text-center">
        <p className="text-sm text-on-surface-variant">No pages yet. Distance per page will appear here.</p>
      </div>
    );
  }

  const maxDistance = Math.max(...data.map((d) => d.distance), 1);

  return (
    <div className="bg-paper-sheet rounded-xl border border-rule-line shadow-sm p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold tracking-tight text-on-surface">Page-wise Distance Visualization</h3>
        <span className="text-[10px] font-semibold tracking-widest uppercase text-on-surface-variant">{data.length} pages</span>
      </div>

      <div className="flex items-end gap-1.5 h-40 px-1 overflow-x-auto">
        {data.map((p) => {
          const heightPct = (p.distance / maxDistance) * 100;
          return (
            <div key={p.pageNumber} data-testid={`page-bar-${p.pageNumber}`} className="flex flex-col items-center gap-1 min-w-[40px] flex-1">
              <span className="text-[10px] font-mono font-bold text-on-surface">{p.distance.toFixed(1)}</span>
              <div className="w-full flex flex-col justify-end items-center gap-0" style={{ height: '100px' }}>
                <div
                  className="w-full rounded-t bg-slate-surface flex flex-col overflow-hidden"
                  style={{ height: `${Math.max(6, heightPct)}%` }}
                  title={`Page ${p.pageNumber} • ${p.monthLabel} • Total ${p.distance.toFixed(1)} KM (Off ${p.officialKm.toFixed(1)} / Priv ${p.privateKm.toFixed(1)}) • ${p.tripCount} trips`}
                >
                  {p.privateKm > 0 && p.distance > 0 && (
                    <div className="w-full bg-trip-private" style={{ height: `${(p.privateKm / p.distance) * 100}%` }} />
                  )}
                  {p.officialKm > 0 && p.distance > 0 && (
                    <div className="w-full bg-trip-official flex-1" />
                  )}
                  {p.distance === 0 && <div className="w-full h-full bg-paper-gutter border border-dashed border-rule-line" />}
                </div>
              </div>
              <span className="text-[10px] font-bold text-on-surface">P{p.pageNumber}</span>
              <span className="text-[9px] font-semibold tracking-widest uppercase text-on-surface-variant">{p.monthLabel}</span>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-4 justify-center text-[10px] font-semibold tracking-widest uppercase text-on-surface-variant">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-trip-official inline-block" /> Official</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-trip-private inline-block" /> Private</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-slate-surface inline-block" /> Total stacked</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-paper-gutter text-on-surface-variant text-[10px] font-semibold tracking-widest uppercase">
              <th className="py-1.5 px-2 rounded-l">Page</th>
              <th className="py-1.5 px-2">Month</th>
              <th className="py-1.5 px-2 text-right">Distance</th>
              <th className="py-1.5 px-2 text-right">Official</th>
              <th className="py-1.5 px-2 text-right">Private</th>
              <th className="py-1.5 px-2 text-right rounded-r">Trips</th>
            </tr>
          </thead>
          <tbody className="font-mono text-on-surface">
            {data.map((p) => (
              <tr key={`tbl-p-${p.pageNumber}`} className="border-t border-rule-line hover:bg-paper-ledger">
                <td className="py-1.5 px-2 font-bold">P{p.pageNumber}</td>
                <td className="py-1.5 px-2">{p.monthLabel}</td>
                <td className="py-1.5 px-2 text-right font-bold">{p.distance.toFixed(1)}</td>
                <td className="py-1.5 px-2 text-right text-trip-official">{p.officialKm.toFixed(1)}</td>
                <td className="py-1.5 px-2 text-right text-trip-private">{p.privateKm.toFixed(1)}</td>
                <td className="py-1.5 px-2 text-right">{p.tripCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
