'use client';

import React, { useState } from 'react';
import type { BookPage, Trip, Vehicle } from '@/types';
import { generateExcelBuffer, getExportFileName } from '@/lib/excelExport';
import { getFuelEconomiesForPage } from '@/lib/fuelEconomyStore';

interface Props {
  pages: BookPage[];
  trips: Trip[];
  vehicle: Vehicle | null;
  label?: string;
  className?: string;
  variant?: 'primary' | 'secondary';
}

export function ExcelExportButton({ pages, trips, vehicle, label = 'Export Mirror (.xlsx)', className, variant = 'primary' }: Props) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleExport = async () => {
    try {
      setIsGenerating(true);
      // Build fuel economies map from localStorage per page
      const fuelEconomiesByPage: Record<string, (number | null)[]> = {};
      for (const page of pages) {
        const economies = getFuelEconomiesForPage(page.id);
        if (economies && economies.length > 0) {
          fuelEconomiesByPage[page.id] = economies;
        }
      }

      const buffer = await generateExcelBuffer({ pages, trips, vehicle, fuelEconomiesByPage });
      const blob = new Blob([buffer as any], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = getExportFileName(vehicle);
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Excel export failed', e);
    } finally {
      setIsGenerating(false);
    }
  };

  const baseClasses =
    variant === 'primary'
      ? 'bg-slate-surface text-on-primary hover:bg-primary'
      : 'bg-paper-sheet border border-rule-line text-on-surface hover:bg-paper-gutter';

  return (
    <button
      type="button"
      data-testid="export-mirror-button"
      onClick={handleExport}
      disabled={isGenerating}
      aria-label="Export book-mirror Excel"
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold shadow-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${baseClasses} ${className ?? ''}`}
    >
      <span className="text-trip-official">{isGenerating ? '⏳' : '⬇'}</span>
      {isGenerating ? 'Generating...' : label}
    </button>
  );
}
