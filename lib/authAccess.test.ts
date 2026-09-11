import { describe, it, expect, beforeEach } from 'vitest';
import {
  BOOTSTRAP_PASSWORD_HASH,
  SUPER_ADMIN_USERNAME,
  hashPassword,
  verifyPassword,
  isSuperAdminUsername,
  getSuperAdminState,
  setSuperAdminState,
  clearSuperAdminState,
  validateSuperAdminCredentials,
  changeSuperAdminPassword,
  normalizeEmail,
  isValidEmail,
  getAllowedEmails,
  setAllowedEmails,
  addAllowedEmail,
  removeAllowedEmail,
  isAllowedEmail,
  canGoogleUserSignIn,
} from './authAccess';

describe('authAccess — Super Admin & Allow-list seam (Phase 2 #06)', () => {
  beforeEach(() => {
    localStorage.clear();
    clearSuperAdminState();
  });

  it('hashPassword produces bootstrap hash for SupAd@2000', async () => {
    const h = await hashPassword('SupAd@2000');
    expect(h.toLowerCase()).toBe(BOOTSTRAP_PASSWORD_HASH.toLowerCase());
  });

  it('verifyPassword matches bootstrap', async () => {
    expect(await verifyPassword('SupAd@2000', BOOTSTRAP_PASSWORD_HASH)).toBe(true);
    expect(await verifyPassword('wrong', BOOTSTRAP_PASSWORD_HASH)).toBe(false);
  });

  it('isSuperAdminUsername strict case-sensitive Neranjan', () => {
    expect(isSuperAdminUsername('Neranjan')).toBe(true);
    expect(isSuperAdminUsername('neranjan')).toBe(false);
    expect(isSuperAdminUsername(' Neranjan ')).toBe(true); // trims
    expect(isSuperAdminUsername('Admin')).toBe(false);
  });

  it('getSuperAdminState defaults to bootstrap hashed + mustChange true', () => {
    const s = getSuperAdminState();
    expect(s.passwordHash.toLowerCase()).toBe(BOOTSTRAP_PASSWORD_HASH.toLowerCase());
    expect(s.mustChangePassword).toBe(true);
  });

  it('validateSuperAdminCredentials success with bootstrap and mustChange flag', async () => {
    const res = await validateSuperAdminCredentials('Neranjan', 'SupAd@2000');
    expect(res.valid).toBe(true);
    expect(res.mustChangePassword).toBe(true);
  });

  it('validateSuperAdminCredentials fails for wrong password or username', async () => {
    expect((await validateSuperAdminCredentials('Neranjan', 'wrong')).valid).toBe(false);
    expect((await validateSuperAdminCredentials('Wrong', 'SupAd@2000')).valid).toBe(false);
    expect((await validateSuperAdminCredentials('', '')).valid).toBe(false);
  });

  it('changeSuperAdminPassword succeeds, clears mustChange, new password verifies', async () => {
    const ok = await changeSuperAdminPassword('SupAd@2000', 'NewPass123');
    expect(ok.success).toBe(true);
    const state = getSuperAdminState();
    expect(state.mustChangePassword).toBe(false);
    expect(await verifyPassword('NewPass123', state.passwordHash)).toBe(true);
    expect(await verifyPassword('SupAd@2000', state.passwordHash)).toBe(false);
    // validate with new password
    const res = await validateSuperAdminCredentials('Neranjan', 'NewPass123');
    expect(res.valid).toBe(true);
    expect(res.mustChangePassword).toBe(false);
  });

  it('changeSuperAdminPassword fails when current incorrect or new too short', async () => {
    const r1 = await changeSuperAdminPassword('wrong', 'NewPass123');
    expect(r1.success).toBe(false);
    expect(r1.error).toMatch(/Current password incorrect/);
    const r2 = await changeSuperAdminPassword('SupAd@2000', 'short');
    expect(r2.success).toBe(false);
    expect(r2.error).toMatch(/at least 6/);
  });

  it('allow-list normalize and validation', () => {
    expect(normalizeEmail(' Test@Example.COM ')).toBe('test@example.com');
    expect(isValidEmail('user@gmail.com')).toBe(true);
    expect(isValidEmail('bad')).toBe(false);
    expect(isValidEmail('user@')).toBe(false);
  });

  it('getAllowedEmails empty by default, setAllowedEmails dedups and normalizes', () => {
    expect(getAllowedEmails()).toEqual([]);
    const out = setAllowedEmails(['A@Gmail.com', 'a@gmail.com', 'B@gmail.com', 'invalid']);
    expect(out).toEqual(['a@gmail.com', 'b@gmail.com']);
    expect(getAllowedEmails()).toEqual(['a@gmail.com', 'b@gmail.com']);
  });

  it('addAllowedEmail case-insensitive dedup, invalid rejected', () => {
    const r1 = addAllowedEmail('Driver@gmail.com');
    expect(r1.added).toBe(true);
    expect(r1.emails).toContain('driver@gmail.com');
    const r2 = addAllowedEmail('driver@GMAIL.com');
    expect(r2.added).toBe(false);
    expect(r2.error).toMatch(/Already allowed/);
    const r3 = addAllowedEmail('bad-email');
    expect(r3.added).toBe(false);
    expect(r3.error).toMatch(/Invalid/);
  });

  it('removeAllowedEmail', () => {
    setAllowedEmails(['a@gmail.com', 'b@gmail.com']);
    const r1 = removeAllowedEmail('A@GMAIL.COM');
    expect(r1.removed).toBe(true);
    expect(r1.emails).toEqual(['b@gmail.com']);
    const r2 = removeAllowedEmail('nonexistent@gmail.com');
    expect(r2.removed).toBe(false);
  });

  it('isAllowedEmail case-insensitive', () => {
    setAllowedEmails(['allowed@gmail.com']);
    expect(isAllowedEmail('ALLOWED@GMAIL.COM')).toBe(true);
    expect(isAllowedEmail('other@gmail.com')).toBe(false);
    expect(isAllowedEmail('allowed@gmail.com', ['allowed@gmail.com'])).toBe(true);
    expect(isAllowedEmail('', [])).toBe(false);
  });

  it('canGoogleUserSignIn gated: allowed when in list, denied otherwise, empty list denies', () => {
    setAllowedEmails(['allowed@gmail.com']);
    expect(canGoogleUserSignIn('allowed@gmail.com').allowed).toBe(true);
    expect(canGoogleUserSignIn('ALLOWED@GMAIL.COM').allowed).toBe(true);
    const denied = canGoogleUserSignIn('other@gmail.com');
    expect(denied.allowed).toBe(false);
    expect(denied.reason).toBe('Not authorized — contact admin');
    expect(canGoogleUserSignIn(null).allowed).toBe(false);
    expect(canGoogleUserSignIn(null).reason).toBe('Not authorized — contact admin');
    // empty allow-list denies even allowed user if list empty
    setAllowedEmails([]);
    expect(canGoogleUserSignIn('allowed@gmail.com').allowed).toBe(false);
  });

  it('canGoogleUserSignIn uses provided list param not storage', () => {
    const list = ['a@gmail.com'];
    expect(canGoogleUserSignIn('a@gmail.com', list).allowed).toBe(true);
    expect(canGoogleUserSignIn('b@gmail.com', list).allowed).toBe(false);
  });

  it('super admin password hashed storage: setSuperAdminState persists', async () => {
    const h = await hashPassword('CustomPass999');
    setSuperAdminState({ passwordHash: h, mustChangePassword: false });
    const s = getSuperAdminState();
    expect(s.passwordHash).toBe(h);
    expect(s.mustChangePassword).toBe(false);
  });
});
