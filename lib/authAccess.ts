/**
 * Auth & Access seam (ADR-0009 / ADR-0010)
 * Single-operator: Super Admin + TOTP (Google Authenticator) + single-use Recovery Code
 * Hashing: bcrypt (cost 12), legacy SHA-256 fallback for bootstrap migration
 * TOTP: RFC 6238 30s ±1 via otpauth, secret encrypted AES-256-GCM at rest
 */

import * as bcrypt from 'bcryptjs';

export const SUPER_ADMIN_USERNAME = 'Neranjan';
export const BOOTSTRAP_PASSWORD_PLAIN = 'SupAd@2000';
export const BOOTSTRAP_PASSWORD_HASH = '3eec12103e18ed4b583491fd33733ab1e0c94a20aaf6c45b9515996066f7bd69'; // SHA-256 hex legacy

const SUPER_ADMIN_KEY = 'fleetledger_super_admin_state';

export interface SuperAdminState {
  passwordHash: string;
  mustChangePassword: boolean;
}

// ---------------------------------------------------------------------------
// Hashing — bcrypt primary, SHA-256 legacy fallback
// ---------------------------------------------------------------------------

async function sha256Hex(input: string): Promise<string> {
  const normalized = input ?? '';
  if (typeof window !== 'undefined' && (window as any).crypto?.subtle) {
    const enc = new TextEncoder();
    const buf = await (window as any).crypto.subtle.digest('SHA-256', enc.encode(normalized));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  try {
    const nodeCrypto: any = typeof require !== 'undefined' ? require('crypto') : null;
    if (nodeCrypto) return nodeCrypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
  } catch { /* ignore */ }
  let h = 0;
  for (let i = 0; i < normalized.length; i++) h = (h * 31 + normalized.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

export async function hashPassword(password: string): Promise<string> {
  const normalized = password ?? '';
  return bcrypt.hash(normalized, 12);
}

export async function verifyPassword(password: string, expectedHash: string): Promise<boolean> {
  const hash = expectedHash ?? '';
  // bcrypt hashes start with $2a$ / $2b$
  if (hash.startsWith('$2')) {
    try { return await bcrypt.compare(password ?? '', hash); } catch { return false; }
  }
  // legacy SHA-256 fallback (bootstrap)
  const sha = await sha256Hex(password ?? '');
  return sha.toLowerCase() === hash.toLowerCase();
}

// ---------------------------------------------------------------------------
// Super Admin helpers (localStorage fallback for tests / dev)
// ---------------------------------------------------------------------------

export function isSuperAdminUsername(username: string): boolean {
  return (username ?? '').trim() === SUPER_ADMIN_USERNAME;
}

export function getSuperAdminState(): SuperAdminState {
  if (typeof window === 'undefined') {
    return { passwordHash: BOOTSTRAP_PASSWORD_HASH, mustChangePassword: true };
  }
  const raw = window.localStorage.getItem(SUPER_ADMIN_KEY);
  if (!raw) {
    const init: SuperAdminState = { passwordHash: BOOTSTRAP_PASSWORD_HASH, mustChangePassword: true };
    window.localStorage.setItem(SUPER_ADMIN_KEY, JSON.stringify(init));
    return init;
  }
  try {
    const parsed = JSON.parse(raw) as SuperAdminState;
    if (!parsed.passwordHash) throw new Error('no hash');
    return parsed;
  } catch {
    const fallback: SuperAdminState = { passwordHash: BOOTSTRAP_PASSWORD_HASH, mustChangePassword: true };
    window.localStorage.setItem(SUPER_ADMIN_KEY, JSON.stringify(fallback));
    return fallback;
  }
}

export function setSuperAdminState(state: SuperAdminState): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SUPER_ADMIN_KEY, JSON.stringify(state));
}

export function clearSuperAdminState(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(SUPER_ADMIN_KEY);
}

export async function validateSuperAdminCredentials(username: string, password: string): Promise<{ valid: boolean; mustChangePassword: boolean }> {
  if (!isSuperAdminUsername(username)) return { valid: false, mustChangePassword: false };
  const state = getSuperAdminState();
  const ok = await verifyPassword(password, state.passwordHash);
  if (!ok) return { valid: false, mustChangePassword: false };
  return { valid: true, mustChangePassword: state.mustChangePassword };
}

export async function changeSuperAdminPassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
  const state = getSuperAdminState();
  const ok = await verifyPassword(currentPassword, state.passwordHash);
  if (!ok) return { success: false, error: 'Current password incorrect' };
  if (!newPassword || newPassword.length < 6) return { success: false, error: 'New password must be at least 6 characters' };
  const newHash = await hashPassword(newPassword);
  setSuperAdminState({ passwordHash: newHash, mustChangePassword: false });
  return { success: true };
}

// ---------------------------------------------------------------------------
// TOTP helpers — Google Authenticator (RFC 6238, 30s, ±1 window)
// ---------------------------------------------------------------------------

export function generateTOTPSecret(): string {
  // 20 bytes -> 32 base32 chars (160-bit, otpauth compatible)
  if (typeof window === 'undefined') {
    try {
      const nodeCrypto: any = typeof require !== 'undefined' ? require('crypto') : null;
      if (nodeCrypto) {
        const bytes = nodeCrypto.randomBytes(20);
        const { Secret } = require('otpauth');
        return new Secret({ bytes }).base32;
      }
    } catch { /* fallback */ }
  }
  // browser fallback: use otpauth Secret.fromBase32 random
  const { Secret } = require('otpauth');
  return new Secret().base32;
}

export function buildTOTPURI(secretBase32: string, username: string = SUPER_ADMIN_USERNAME): string {
  const { TOTP } = require('otpauth');
  const totp = new TOTP({
    issuer: 'RunningChart',
    label: username,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: secretBase32,
  });
  return totp.toString(); // otpauth://totp/...
}

export function getTOTPPEncryptionKey(): Buffer {
  const raw = process.env.TOTP_ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef01';
  // derive 32 bytes via sha256 if not 32
  if (raw.length === 64 && /^[0-9a-fA-F]+$/.test(raw)) return Buffer.from(raw.slice(0, 64), 'hex');
  if (raw.length >= 32) return Buffer.from(raw.slice(0, 32), 'utf8');
  const pad = raw.padEnd(32, '0');
  return Buffer.from(pad.slice(0, 32), 'utf8');
}

export function encryptTOTPSecret(plainBase32: string): string {
  const crypto: any = typeof require !== 'undefined' ? require('crypto') : null;
  if (!crypto) throw new Error('No crypto for encryption');
  const key = getTOTPPEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plainBase32, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

export function decryptTOTPSecret(encrypted: string): string {
  const crypto: any = typeof require !== 'undefined' ? require('crypto') : null;
  if (!crypto) throw new Error('No crypto for decryption');
  const [ivB64, tagB64, encB64] = encrypted.split(':');
  if (!ivB64 || !tagB64 || !encB64) throw new Error('Invalid encrypted secret');
  const key = getTOTPPEncryptionKey();
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const enc = Buffer.from(encB64, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString('utf8');
}

export function verifyTOTP(token: string, secretBase32OrEncrypted: string, window = 1): boolean {
  const { TOTP } = require('otpauth');
  let secret = secretBase32OrEncrypted;
  if (secret.includes(':')) {
    try { secret = decryptTOTPSecret(secret); } catch { return false; }
  }
  const totp = new TOTP({ issuer: 'RunningChart', label: SUPER_ADMIN_USERNAME, algorithm: 'SHA1', digits: 6, period: 30, secret });
  const delta = totp.validate({ token: (token ?? '').trim(), window });
  return delta !== null;
}

// ---------------------------------------------------------------------------
// Recovery Code — single-use 64-char (256-bit), grouped 8×8, bcrypt hash
// ---------------------------------------------------------------------------

export function generateRecoveryCode(): string {
  const crypto: any = typeof require !== 'undefined' ? require('crypto') : null;
  let hex: string;
  if (crypto) hex = crypto.randomBytes(32).toString('hex'); // 64 hex
  else {
    // browser fallback
    const arr = new Uint8Array(32);
    (window.crypto as any).getRandomValues(arr);
    hex = Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  // group 8×8 with dashes for readability, e.g. a1b2c3d4-e5f6... (64 +7 dashes)
  const groups = hex.match(/.{1,8}/g) ?? [hex];
  return groups.join('-');
}

export async function hashRecoveryCode(code: string): Promise<string> {
  return bcrypt.hash((code ?? '').trim(), 12);
}

export async function verifyRecoveryCode(code: string, hash: string): Promise<boolean> {
  if (!hash) return false;
  try { return await bcrypt.compare((code ?? '').trim(), hash); } catch { return false; }
}

// ---------------------------------------------------------------------------
// Deprecated allow-list / SSO seam — retained as stubs, no longer used
// CONTEXT.md: Allowed Email removed (ADR-0010). Kept for import compat.
// ---------------------------------------------------------------------------

export function normalizeEmail(email: string): string { return (email ?? '').trim().toLowerCase(); }
export function isValidEmail(email: string): boolean { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email)); }
export function getAllowedEmails(): string[] { return []; }
export function setAllowedEmails(_emails: string[]): string[] { return []; }
export function addAllowedEmail(_email: string): { emails: string[]; added: boolean; error?: string } {
  return { emails: [], added: false, error: 'Allowed Email removed — single-operator mode (ADR-0010)' };
}
export function removeAllowedEmail(_email: string): { emails: string[]; removed: boolean } {
  return { emails: [], removed: false };
}
export function isAllowedEmail(_email: string, _allowList?: string[]): boolean { return false; }
export interface SsoCheckResult { allowed: boolean; reason?: string; }
export function canGoogleUserSignIn(_email: string | null | undefined, _allowList?: string[]): SsoCheckResult {
  return { allowed: false, reason: 'Google SSO removed — use Super Admin + TOTP (ADR-0010)' };
}

// ---------------------------------------------------------------------------
// Role helpers
// ---------------------------------------------------------------------------
export type UserRole = 'super_admin' | 'guest';
export function getUserRole(user: { email?: string | null; user_metadata?: any; app_metadata?: any } | null): UserRole {
  if (!user) return 'guest';
  if ((user as any).isSuperAdmin || (user as any).user_metadata?.role === 'super_admin') return 'super_admin';
  return 'guest';
}
