'use client';

import React from 'react';
import type { DashboardMetrics } from '@/lib/dashboardCalculations';

interface Props {
  metrics: DashboardMetrics;
}

export function MetricCards({ metrics }: Props) {
  const cards = [
    {
      label: 'Official Distance',
      value: `${metrics.officialKm.toFixed(1)} KM`,
      sub: `${metrics.tripCount} trips tracked`,
      accent: 'text-trip-official',
      bg: 'bg-surface-container-highest',
      border: 'border-trip-official/20',
      testId: 'metric-official',
    },
    {
      label: 'Private Distance',
      value: `${metrics.privateKm.toFixed(1)} KM`,
      sub: 'Personal usage',
      accent: 'text-trip-private',
      bg: 'bg-surface-container',
      border: 'border-trip-private/20',
      testId: 'metric-private',
    },
    {
      label: 'Total Distance',
      value: `${metrics.totalKm.toFixed(1)} KM`,
      sub: 'Ledger-verified odometer span',
      accent: 'text-primary',
      bg: 'bg-slate-surface',
      textLight: true,
      border: 'border-slate-700',
      testId: 'metric-total',
    },
    {
      label: 'Estimated Fuel Level',
      value: `${metrics.fuelLevel.toFixed(1)} L`,
      sub: `${metrics.tankCapacity.toFixed(1)} L tank • ${metrics.fuelLevelPercent.toFixed(1)}%`,
      accent: 'text-telemetry-cyan',
      bg: 'bg-paper-sheet',
      border: 'border-rule-line',
      showFuelBar: true,
      testId: 'metric-fuel',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => (
        <div
          key={c.label}
          data-testid={c.testId}
          className={`rounded-xl p-4 border shadow-sm flex flex-col gap-2 ${c.bg} ${c.border} ${c.textLight ? 'text-on-primary' : 'text-on-surface'}`}
        >
          <span className={`text-[10px] font-bold tracking-widest uppercase ${c.textLight ? 'text-surface-container-highest' : 'text-on-surface-variant'}`}>{c.label}</span>
          <span className={`text-2xl font-bold font-mono tracking-tight ${c.textLight ? 'text-paper-sheet' : c.accent}`}>{c.value}</span>
          <span className={`text-xs ${c.textLight ? 'text-surface-container-highest/80' : 'text-on-surface-variant'}`}>{c.sub}</span>
          {c.showFuelBar && (
            <div className="mt-1">
              <div className="w-full h-2 bg-paper-gutter rounded-full overflow-hidden">
                <div className="h-full bg-telemetry-cyan rounded-full transition-all" style={{ width: `${Math.min(100, metrics.fuelLevelPercent)}%` }} />
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
