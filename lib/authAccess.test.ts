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
  generateTOTPSecret,
  buildTOTPURI,
  encryptTOTPSecret,
  decryptTOTPSecret,
  verifyTOTP,
  generateRecoveryCode,
  hashRecoveryCode,
  verifyRecoveryCode,
  normalizeEmail,
  isValidEmail,
  getAllowedEmails,
  canGoogleUserSignIn,
} from './authAccess';

describe('authAccess — Super Admin + TOTP + Recovery (ADR-0010)', () => {
  beforeEach(() => {
    localStorage.clear();
    clearSuperAdminState();
  });

  it('hashPassword produces bcrypt hash that verifies', async () => {
    const h = await hashPassword('SupAd@2000');
    expect(h.startsWith('$2')).toBe(true);
    expect(await verifyPassword('SupAd@2000', h)).toBe(true);
    expect(await verifyPassword('wrong', h)).toBe(false);
  });

  it('verifyPassword still accepts legacy SHA bootstrap hash', async () => {
    expect(await verifyPassword('SupAd@2000', BOOTSTRAP_PASSWORD_HASH)).toBe(true);
    expect(await verifyPassword('wrong', BOOTSTRAP_PASSWORD_HASH)).toBe(false);
  });

  it('isSuperAdminUsername strict case-sensitive Neranjan', () => {
    expect(isSuperAdminUsername('Neranjan')).toBe(true);
    expect(isSuperAdminUsername('neranjan')).toBe(false);
    expect(isSuperAdminUsername(' Neranjan ')).toBe(true);
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

  it('TOTP secret generation + URI + encrypt/decrypt roundtrip', () => {
    const secret = generateTOTPSecret();
    expect(secret.length).toBeGreaterThanOrEqual(32);
    const uri = buildTOTPURI(secret);
    expect(uri.startsWith('otpauth://totp/')).toBe(true);
    expect(uri).toContain('RunningChart');
    const enc = encryptTOTPSecret(secret);
    expect(enc).toContain(':');
    const dec = decryptTOTPSecret(enc);
    expect(dec).toBe(secret);
  });

  it('verifyTOTP validates current token within ±1 window', () => {
    const { TOTP } = require('otpauth');
    const secret = generateTOTPSecret();
    const totp = new TOTP({ issuer: 'RunningChart', label: 'Neranjan', algorithm: 'SHA1', digits: 6, period: 30, secret });
    const token = totp.generate();
    expect(verifyTOTP(token, secret)).toBe(true);
    expect(verifyTOTP('000000', secret)).toBe(false);
    // encrypted secret also verifies
    const enc = encryptTOTPSecret(secret);
    expect(verifyTOTP(token, enc)).toBe(true);
  });

  it('Recovery Code is 64-hex grouped, hashes and verifies via bcrypt', async () => {
    const code = generateRecoveryCode();
    const hexOnly = code.replace(/-/g, '');
    expect(hexOnly.length).toBe(64);
    expect(/^[0-9a-f]+$/.test(hexOnly)).toBe(true);
    expect(code.split('-').length).toBe(8);
    const hash = await hashRecoveryCode(code);
    expect(hash.startsWith('$2')).toBe(true);
    expect(await verifyRecoveryCode(code, hash)).toBe(true);
    expect(await verifyRecoveryCode('wrong-code', hash)).toBe(false);
    expect(await verifyRecoveryCode(code, '')).toBe(false);
  });

  it('deprecated allow-list seam returns empty / removed error', () => {
    expect(normalizeEmail(' Test@Example.COM ')).toBe('test@example.com');
    expect(isValidEmail('user@gmail.com')).toBe(true);
    expect(getAllowedEmails()).toEqual([]);
    const denied = canGoogleUserSignIn('any@gmail.com');
    expect(denied.allowed).toBe(false);
    expect(denied.reason).toMatch(/Google SSO removed/);
  });

  it('super admin password hashed storage: setSuperAdminState persists bcrypt', async () => {
    const h = await hashPassword('CustomPass999');
    setSuperAdminState({ passwordHash: h, mustChangePassword: false });
    const s = getSuperAdminState();
    expect(s.passwordHash).toBe(h);
    expect(s.mustChangePassword).toBe(false);
  });
});
