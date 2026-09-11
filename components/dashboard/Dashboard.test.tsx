import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MetricCards } from './MetricCards';
import { MonthlyBreakdownChart } from './MonthlyBreakdownChart';
import { PageWiseChart } from './PageWiseChart';
import { AllTripsMasterTable } from './AllTripsMasterTable';
import type { BookPage, Trip } from '@/types';

function makeTrip(overrides: Partial<Trip> & { date: string }): Trip {
  const base: Trip = {
    id: `trip-${Math.random().toString(36).slice(2, 6)}`,
    page_id: 'page-1',
    vehicle_id: 'veh-1',
    date: '2024-10-21',
    day_index: 1,
    trip_index: 1,
    start_time: '08:00',
    end_time: '09:00',
    start_km: 100,
    end_km: 110,
    trip_distance: 10,
    trip_type: 'Official',
    places_visited: 'A -> B',
    fuel_pumped_amount: 0,
    fuel_order_no: '',
    created_at: new Date().toISOString(),
  };
  return { ...base, ...overrides } as Trip;
}
function makePage(overrides: Partial<BookPage>): BookPage {
  return {
    id: `page-${overrides.page_number ?? 1}`,
    vehicle_id: 'veh-1',
    page_number: 1,
    month: '2024-10',
    start_km: 100,
    end_km: 400,
    start_fuel_balance: 30,
    end_fuel_balance: 45,
    ...overrides,
  } as BookPage;
}

describe('Dashboard components', () => {
  it('MetricCards displays Official, Private, Total KM and fuel level', () => {
    render(
      <MetricCards
        metrics={{
          officialKm: 120.5,
          privateKm: 30.2,
          totalKm: 150.7,
          tripCount: 5,
          fuelLevel: 48.3,
          tankCapacity: 80,
          fuelLevelPercent: 60.4,
        }}
      />
    );
    expect(screen.getByTestId('metric-official')).toHaveTextContent('120.5 KM');
    expect(screen.getByTestId('metric-private')).toHaveTextContent('30.2 KM');
    expect(screen.getByTestId('metric-total')).toHaveTextContent('150.7 KM');
    expect(screen.getByTestId('metric-fuel')).toHaveTextContent('48.3 L');
    expect(screen.getByTestId('metric-fuel')).toHaveTextContent('60.4%');
  });

  it('MonthlyBreakdownChart renders monthly rows', () => {
    render(
      <MonthlyBreakdownChart
        data={[
          { monthKey: '2024-10', monthLabel: 'Oct 2024', officialKm: 100, privateKm: 20, totalKm: 120, tripCount: 4, fuelDrawn: 35, pageCount: 2 },
          { monthKey: '2024-11', monthLabel: 'Nov 2024', officialKm: 50, privateKm: 10, totalKm: 60, tripCount: 2, fuelDrawn: 0, pageCount: 1 },
        ]}
      />
    );
    expect(screen.getByTestId('monthly-row-2024-10')).toBeInTheDocument();
    expect(screen.getByTestId('monthly-row-2024-11')).toBeInTheDocument();
    expect(screen.getAllByText('Oct 2024').length).toBeGreaterThanOrEqual(1);
  });

  it('PageWiseChart renders bars per page', () => {
    render(
      <PageWiseChart
        data={[
          { pageNumber: 1, month: '2024-10', monthLabel: 'Oct 2024', distance: 120, officialKm: 100, privateKm: 20, tripCount: 4 },
          { pageNumber: 2, month: '2024-11', monthLabel: 'Nov 2024', distance: 60, officialKm: 50, privateKm: 10, tripCount: 2 },
        ]}
      />
    );
    expect(screen.getByTestId('page-bar-1')).toBeInTheDocument();
    expect(screen.getByTestId('page-bar-2')).toBeInTheDocument();
  });

  it('AllTripsMasterTable supports searching, sorting, filtering', () => {
    const trips: Trip[] = [
      makeTrip({ id: 't1', date: '2024-10-21', trip_type: 'Official', places_visited: 'Colombo -> Kandy', trip_distance: 10 }),
      makeTrip({ id: 't2', date: '2024-10-22', trip_type: 'Private', places_visited: 'Kandy -> Galle', trip_distance: 15 }),
      makeTrip({ id: 't3', date: '2024-11-01', trip_type: 'Official', places_visited: 'Galle -> Colombo', trip_distance: 30 }),
    ];
    const pages: BookPage[] = [makePage({ page_number: 1, id: 'page-1', month: '2024-10' })];
    render(<AllTripsMasterTable trips={trips} pages={pages} />);

    // Initially all 3 visible
    expect(screen.getAllByTestId(/^trip-row-/).length).toBe(3);

    // Search filters
    const searchInput = screen.getByLabelText('Search trips');
    fireEvent.change(searchInput, { target: { value: 'kandy' } });
    expect(screen.getAllByTestId(/^trip-row-/).length).toBe(2);

    // Clear search, filter by Private
    fireEvent.change(searchInput, { target: { value: '' } });
    const typeSelect = screen.getByLabelText('Filter by trip type');
    fireEvent.change(typeSelect, { target: { value: 'Private' } });
    expect(screen.getAllByTestId(/^trip-row-/).length).toBe(1);
    expect(screen.getByTestId('trip-row-t2')).toBeInTheDocument();

    // Reset to All types, filter by month
    fireEvent.change(typeSelect, { target: { value: 'All' } });
    const monthSelect = screen.getByLabelText('Filter by month');
    fireEvent.change(monthSelect, { target: { value: '2024-11' } });
    expect(screen.getAllByTestId(/^trip-row-/).length).toBe(1);
    expect(screen.getByTestId('trip-row-t3')).toBeInTheDocument();

    // Test sorting by distance asc
    fireEvent.change(monthSelect, { target: { value: 'All' } });
    // Click Dist header to sort asc (first click asc, second desc). Initial is date desc, so clicking trip_distance will set asc first
    fireEvent.click(screen.getByText(/Dist/));
    const rows = screen.getAllByTestId(/^trip-row-/);
    // After sorting asc by distance, order should be t1 (10), t2 (15), t3 (30)
    expect(rows[0].getAttribute('data-testid')).toBe('trip-row-t1');
  });
});
