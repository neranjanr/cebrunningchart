'use client';

import React, { useMemo, useState } from 'react';
import type { Trip, BookPage } from '@/types';
import {
  filterAndSortTrips,
  getAvailableMonths,
  type SortColumn,
  type SortDirection,
  filterTripsByGlobalSearch,
  computeFilteredSums,
} from '@/lib/dashboardCalculations';
import { computeGlobalSeq } from '@/lib/ledgerCalculations';
import { useGlobalSearch } from '@/lib/globalSearchContext';
import { detectTripGaps } from '@/lib/continuityAlerts';

interface Props {
  trips: Trip[];
  pages: BookPage[];
  title?: string;
  compact?: boolean;
}

export function AllTripsMasterTable({ trips, pages, title = 'All Trips Master Table', compact = false }: Props) {
  const [search, setSearch] = useState('');
  const [tripType, setTripType] = useState<'All' | 'Official' | 'Private'>('All');
  const [month, setMonth] = useState<string>('All');
  const [sortColumn, setSortColumn] = useState<SortColumn>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const { globalQuery } = useGlobalSearch();

  const availableMonths = useMemo(() => getAvailableMonths(trips, pages), [trips, pages]);

  const filtered = useMemo(() => {
    const globallyFiltered = globalQuery.trim() !== '' ? filterTripsByGlobalSearch(trips, globalQuery) : trips;
    return filterAndSortTrips(globallyFiltered, { search, tripType, month, sortColumn, sortDirection });
  }, [trips, globalQuery, search, tripType, month, sortColumn, sortDirection]);

  const sums = useMemo(() => computeFilteredSums(filtered), [filtered]);

  // Global chronological sequence 1..T (independent of page, for cross-Book traceability)
  const globalSeqMap = useMemo(() => computeGlobalSeq(trips), [trips]);

  // Detect trip-level KM gaps
  const tripKmGaps = useMemo(() => detectTripGaps(trips), [trips]);

  // Set of trip IDs with KM gaps (the trip whose Start KM doesn't match previous End KM)
  const tripKmGapIds = useMemo(() => new Set(tripKmGaps.filter((g) => g.kind === 'km').map((g) => g.tripId)), [tripKmGaps]);

  const handleSort = (col: SortColumn) => {
    if (sortColumn === col) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(col);
      setSortDirection(col === 'date' ? 'desc' : 'asc');
    }
  };

  const SortIcon = ({ col }: { col: SortColumn }) => {
    if (sortColumn !== col) return <span className="text-rule-line-strong ml-1">↕</span>;
    return <span className="ml-1 text-telemetry-cyan">{sortDirection === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div className="bg-paper-sheet rounded-xl border border-rule-line shadow-sm flex flex-col">
      <div className="p-4 flex flex-col gap-3 border-b border-rule-line">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h3 className="text-sm font-bold tracking-tight text-on-surface">{title}</h3>
          <span className="text-xs font-mono text-on-surface-variant" data-testid="master-visible-count">
            Showing {filtered.length} of {trips.length} trips
          </span>
        </div>
        {globalQuery && (
          <div data-testid="global-filter-active" className="text-xs font-mono text-telemetry-cyan">
            Global filter: &quot;{globalQuery}&quot; • {filtered.length} matched
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-2">
          <div className="flex-1 relative">
            <input
              aria-label="Search trips"
              placeholder="Search places, date, distance, order no..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 pr-8 border border-rule-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-telemetry-cyan/30 focus:border-telemetry-cyan"
            />
            {search && (
              <button
                aria-label="Clear search"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface text-sm"
              >
                ✕
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <select
              aria-label="Filter by trip type"
              value={tripType}
              onChange={(e) => setTripType(e.target.value as typeof tripType)}
              className="px-3 py-2 border border-rule-line rounded-lg text-sm bg-paper-sheet focus:outline-none focus:ring-2 focus:ring-telemetry-cyan/30"
            >
              <option value="All">All Types</option>
              <option value="Official">Official</option>
              <option value="Private">Private</option>
            </select>
            <select
              aria-label="Filter by month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="px-3 py-2 border border-rule-line rounded-lg text-sm bg-paper-sheet focus:outline-none focus:ring-2 focus:ring-telemetry-cyan/30"
            >
              <option value="All">All Months</option>
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className={`overflow-auto ${compact ? 'max-h-[420px]' : 'max-h-[560px]'}`}>
        <table className="w-full text-left text-[13px]">
          <thead className="sticky top-0 bg-paper-gutter z-10">
            <tr className="text-[11px] font-bold tracking-widest uppercase text-on-surface-variant border-b border-rule-line-strong">
              <th className="py-2 px-3 whitespace-nowrap border-r border-rule-line">
                <button onClick={() => handleSort('date')} className="flex items-center hover:text-on-surface">
                  Date <SortIcon col="date" />
                </button>
              </th>
              <th className="py-2 px-2 border-r border-rule-line">Day</th>
              <th className="py-2 px-2 text-center border-r border-rule-line">#</th>
              <th className="py-2 px-2 border-r border-rule-line">Time</th>
              <th className="py-2 px-2 text-right border-r border-rule-line">
                <button onClick={() => handleSort('start_km')} className="flex items-center ml-auto hover:text-on-surface">
                  Start KM <SortIcon col="start_km" />
                </button>
              </th>
              <th className="py-2 px-2 text-right border-r border-rule-line">
                <button onClick={() => handleSort('end_km')} className="flex items-center ml-auto hover:text-on-surface">
                  End KM <SortIcon col="end_km" />
                </button>
              </th>
              <th className="py-2 px-2 text-right border-r border-rule-line">
                <button onClick={() => handleSort('trip_distance')} className="flex items-center ml-auto hover:text-on-surface">
                  Dist <SortIcon col="trip_distance" />
                </button>
              </th>
              <th className="py-2 px-2 border-r border-rule-line">
                <button onClick={() => handleSort('trip_type')} className="flex items-center hover:text-on-surface">
                  Type <SortIcon col="trip_type" />
                </button>
              </th>
              <th className="py-2 px-3 border-r border-rule-line">
                <button onClick={() => handleSort('places_visited')} className="flex items-center hover:text-on-surface">
                  Places Visited <SortIcon col="places_visited" />
                </button>
              </th>
              <th className="py-2 px-2 text-right border-r border-rule-line">
                <button onClick={() => handleSort('fuel_pumped_amount')} className="flex items-center ml-auto hover:text-on-surface">
                  Fuel <SortIcon col="fuel_pumped_amount" />
                </button>
              </th>
              <th className="py-2 px-2 border-r border-rule-line">Order No</th>
              <th className="py-2 px-2">Page</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule-line">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={12} className="py-12 text-center text-sm text-on-surface-variant">
                  No trips match your search and filters.
                </td>
              </tr>
            ) : (
              filtered.map((t) => {
                const hasKmGap = tripKmGapIds.has(t.id);
                return (
                <tr key={t.id} data-testid={`trip-row-${t.id}`} className="hover:bg-paper-ledger font-medium">
                  <td className="py-2.5 px-3 whitespace-nowrap font-mono text-xs border-r border-rule-line">{t.date}</td>
                  <td className="py-2.5 px-2 text-xs font-semibold text-on-surface-variant border-r border-rule-line">{t.day_index}</td>
                  <td className="py-2.5 px-2 text-center font-mono text-xs border-r border-rule-line">{globalSeqMap.get(t.id) ?? '-'}</td>
                  <td className="py-2.5 px-2 whitespace-nowrap font-mono text-xs border-r border-rule-line">
                    {t.start_time}–{t.end_time}
                  </td>
                  <td className={`py-2.5 px-2 text-right font-mono text-xs border-r border-rule-line ${hasKmGap ? 'bg-red-100 font-bold' : ''}`} title={hasKmGap ? `KM Gap: previous trip End KM does not match this Start KM` : undefined}>{Math.round(t.start_km)}</td>
                  <td className="py-2.5 px-2 text-right font-mono text-xs border-r border-rule-line">{Math.round(t.end_km)}</td>
                  <td className="py-2.5 px-2 text-right font-mono text-xs font-bold border-r border-rule-line">{Math.round(t.trip_distance)}</td>
                  <td className="py-2.5 px-2 border-r border-rule-line">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase ${t.trip_type === 'Official' ? 'bg-surface-container-highest text-trip-official' : 'bg-surface-container text-trip-private'}`}>
                      {t.trip_type}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 max-w-[220px] truncate border-r border-rule-line" title={t.places_visited}>
                    {t.places_visited}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono text-xs border-r border-rule-line">{(t.fuel_pumped_amount ?? 0) > 0 ? `${(t.fuel_pumped_amount ?? 0).toFixed(1)} L` : '-'}</td>
                  <td className="py-2.5 px-2 text-xs font-mono text-on-surface-variant border-r border-rule-line">{t.fuel_order_no || '-'}</td>
                  <td className="py-2.5 px-2 text-xs font-mono">{t.page_id.replace('page-', 'P')}</td>
                </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="p-3 bg-paper-gutter rounded-b-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11px] font-semibold tracking-widest uppercase text-on-surface-variant border-t border-rule-line" data-testid="master-footer-sums">
        <span data-testid="master-footer-count">
          {filtered.length} rows • Sorted by {sortColumn} ({sortDirection})
        </span>
        <span data-testid="master-footer-distances" className="font-mono normal-case tracking-normal text-xs font-bold">
          Official {sums.officialKm} KM • Private {sums.privateKm} KM • Total {sums.totalKm} KM
        </span>
        <span className="hidden sm:inline">Scroll to view all • Search & filters active</span>
      </div>
    </div>
  );
}
