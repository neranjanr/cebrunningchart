'use client';

/**
 * Auth & Access seam (Phase 2 #06)
 * Pure functions for Super Admin, allow-list, SSO gating.
 * Storage helpers use localStorage with fallbacks for SSR/test.
 */

export const SUPER_ADMIN_USERNAME = 'Neranjan';
export const BOOTSTRAP_PASSWORD_PLAIN = 'SupAd@2000';
export const BOOTSTRAP_PASSWORD_HASH = '3eec12103e18ed4b583491fd33733ab1e0c94a20aaf6c45b9515996066f7bd69'; // SHA-256 hex

const ALLOWED_EMAILS_KEY = 'fleetledger_allowed_emails';
const SUPER_ADMIN_KEY = 'fleetledger_super_admin_state';

export interface SuperAdminState {
  passwordHash: string;
  mustChangePassword: boolean;
}

// ---------------------------------------------------------------------------
// Hashing (SHA-256 hex)
// ---------------------------------------------------------------------------

export async function hashPassword(password: string): Promise<string> {
  const normalized = password ?? '';
  // Browser SubtleCrypto
  if (typeof window !== 'undefined' && window.crypto && (window.crypto as any).subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(normalized);
    const buf = await (window.crypto as any).subtle.digest('SHA-256', data);
    const arr = Array.from(new Uint8Array(buf));
    return arr.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Node fallback (vitest / SSR)
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodeCrypto: any = typeof require !== 'undefined' ? require('crypto') : null;
    if (nodeCrypto) {
      return nodeCrypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
    }
  } catch {
    // ignore
  }
  // Fallback simple (not secure but deterministic for tests without crypto)
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash * 31 + normalized.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16);
}

export async function verifyPassword(password: string, expectedHash: string): Promise<boolean> {
  const h = await hashPassword(password);
  return h.toLowerCase() === expectedHash.toLowerCase();
}

// ---------------------------------------------------------------------------
// Super Admin helpers
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
  const updated: SuperAdminState = { passwordHash: newHash, mustChangePassword: false };
  setSuperAdminState(updated);
  return { success: true };
}

// ---------------------------------------------------------------------------
// Allow-list helpers
// ---------------------------------------------------------------------------

export function normalizeEmail(email: string): string {
  return (email ?? '').trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  const e = normalizeEmail(email);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

export function getAllowedEmails(): string[] {
  if (typeof window === 'undefined') return [];
  const raw = window.localStorage.getItem(ALLOWED_EMAILS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map((e: string) => normalizeEmail(e)).filter(Boolean);
    return [];
  } catch {
    return [];
  }
}

export function setAllowedEmails(emails: string[]): string[] {
  const normalized = Array.from(new Set(emails.map(normalizeEmail).filter((e) => isValidEmail(e))));
  if (typeof window !== 'undefined') window.localStorage.setItem(ALLOWED_EMAILS_KEY, JSON.stringify(normalized));
  return normalized;
}

export function addAllowedEmail(email: string): { emails: string[]; added: boolean; error?: string } {
  const norm = normalizeEmail(email);
  if (!isValidEmail(norm)) return { emails: getAllowedEmails(), added: false, error: 'Invalid email' };
  const current = getAllowedEmails();
  if (current.includes(norm)) return { emails: current, added: false, error: 'Already allowed' };
  const updated = [...current, norm];
  setAllowedEmails(updated);
  return { emails: updated, added: true };
}

export function removeAllowedEmail(email: string): { emails: string[]; removed: boolean } {
  const norm = normalizeEmail(email);
  const current = getAllowedEmails();
  if (!current.includes(norm)) return { emails: current, removed: false };
  const updated = current.filter((e) => e !== norm);
  setAllowedEmails(updated);
  return { emails: updated, removed: true };
}

export function isAllowedEmail(email: string, allowList?: string[]): boolean {
  const norm = normalizeEmail(email);
  const list = allowList ?? getAllowedEmails();
  return list.includes(norm);
}

// ---------------------------------------------------------------------------
// SSO gating
// ---------------------------------------------------------------------------

export interface SsoCheckResult {
  allowed: boolean;
  reason?: string;
}

export function canGoogleUserSignIn(email: string | null | undefined, allowList?: string[]): SsoCheckResult {
  if (!email) return { allowed: false, reason: 'Not authorized — contact admin' };
  const norm = normalizeEmail(email);
  const list = allowList ?? getAllowedEmails();
  if (list.length === 0) {
    // If no allow-list configured, deny by default (gated)
    return { allowed: false, reason: 'Not authorized — contact admin' };
  }
  if (isAllowedEmail(norm, list)) return { allowed: true };
  return { allowed: false, reason: 'Not authorized — contact admin' };
}

// ---------------------------------------------------------------------------
// Role helpers
// ---------------------------------------------------------------------------

export type UserRole = 'super_admin' | 'allowed_user' | 'guest';

export function getUserRole(user: { email?: string | null; user_metadata?: any; app_metadata?: any } | null): UserRole {
  if (!user) return 'guest';
  const email = user.email ?? user.user_metadata?.email;
  if (email && normalizeEmail(email) === normalizeEmail(`${SUPER_ADMIN_USERNAME}@super.admin`.toLowerCase())) {
    // super admin via email placeholder? actual super admin uses username, not email
  }
  // Super admin is identified by custom session flag (isSuperAdmin)
  if ((user as any).isSuperAdmin || (user as any).user_metadata?.role === 'super_admin') return 'super_admin';
  if (email && isAllowedEmail(email)) return 'allowed_user';
  return 'guest';
}
