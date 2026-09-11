import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExcelExportButton } from './ExcelExportButton';
import * as excelExport from '@/lib/excelExport';

vi.mock('@/lib/fuelEconomyStore', () => ({
  getFuelEconomiesForPage: vi.fn(() => []),
}));

describe('ExcelExportButton', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders export button with default label', () => {
    render(<ExcelExportButton pages={[]} trips={[]} vehicle={null} />);
    expect(screen.getByTestId('export-mirror-button')).toBeInTheDocument();
    expect(screen.getByText(/Export Mirror/i)).toBeInTheDocument();
  });

  it('triggers download on click calling generateExcelBuffer', async () => {
    const spy = vi.spyOn(excelExport, 'generateExcelBuffer').mockResolvedValue(new ArrayBuffer(8) as any);
    vi.spyOn(excelExport, 'getExportFileName').mockReturnValue('Test_Hilux_2024-10-24.xlsx');

    // @ts-ignore mock
    global.URL.createObjectURL = vi.fn(() => 'blob:url');
    // @ts-ignore mock
    global.URL.revokeObjectURL = vi.fn();
    // @ts-ignore
    global.Blob = vi.fn();

    const vehicle = { id: 'veh-1', brand: 'Test', model: 'Hilux', vehicle_type: 'Cab', fuel_type: 'Diesel', tank_capacity: 65, current_odometer: 100, current_fuel_level: 30 } as any;

    render(<ExcelExportButton pages={[]} trips={[]} vehicle={vehicle} />);
    const btn = screen.getByTestId('export-mirror-button');
    fireEvent.click(btn);

    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ vehicle }));
    expect(excelExport.getExportFileName).toHaveBeenCalled();
  });

  it('disables while generating', async () => {
    let resolve: (v: ArrayBuffer) => void;
    const promise = new Promise<ArrayBuffer>((res) => (resolve = res));
    vi.spyOn(excelExport, 'generateExcelBuffer').mockReturnValue(promise as any);

    render(<ExcelExportButton pages={[]} trips={[]} vehicle={null} />);
    const btn = screen.getByTestId('export-mirror-button') as HTMLButtonElement;
    fireEvent.click(btn);
    expect(btn.disabled).toBe(true);
    expect(screen.getByText(/Generating/)).toBeInTheDocument();
    resolve!(new ArrayBuffer(8) as any);
    await waitFor(() => expect(btn.disabled).toBe(false));
  });
});
