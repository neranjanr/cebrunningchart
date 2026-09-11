import React from 'react';
import { render, screen } from '@testing-library/react';
import { AppShell } from './AppShell';
import { describe, it, expect, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

describe('AppShell Component', () => {
  it('renders navigation links and title correctly', () => {
    render(
      <AppShell>
        <div>Test Content</div>
      </AppShell>
    );

    expect(screen.getAllByText('FleetLedger').length).toBeGreaterThan(0);
    expect(screen.getByText('Audit Running Chart')).toBeInTheDocument();
    expect(screen.getByText('Dashboard & Analytics')).toBeInTheDocument();
    expect(screen.getByText('Physical Book Ledger (Dual-Page)')).toBeInTheDocument();
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });
});
