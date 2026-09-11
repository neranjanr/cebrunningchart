import { describe, it, expect, beforeEach } from 'vitest';
import { DEFAULT_VEHICLE, getVehicleProfile, saveVehicleProfile } from './vehicleStore';

describe('Vehicle Store', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('provides default vehicle when nothing stored', async () => {
    const profile = await getVehicleProfile();
    expect(profile.brand).toBe('Toyota');
    expect(profile.model).toBe('Hilux');
    expect(profile.tank_capacity).toBe(80.0);
  });

  it('saves and retrieves vehicle profile from localStorage', async () => {
    await saveVehicleProfile({ brand: 'Ford', model: 'Ranger', current_odometer: 15000.0 });
    const profile = await getVehicleProfile();
    expect(profile.brand).toBe('Ford');
    expect(profile.model).toBe('Ranger');
    expect(profile.current_odometer).toBe(15000.0);
  });
});
