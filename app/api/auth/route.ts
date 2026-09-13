import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { isSuperAdminUsername, verifyPassword, verifyTOTP, verifyRecoveryCode, hashPassword, hashRecoveryCode, generateRecoveryCode, generateTOTPSecret, buildTOTPURI, encryptTOTPSecret } from '@/lib/authAccess';

const SESSION_ABSOLUTE_MS = 30 * 24 * 60 * 60 * 1000; // 30d
const SESSION_IDLE_MS = 7 * 24 * 60 * 60 * 1000; // 7d
const RECOVERY_SESSION_MS = 10 * 60 * 1000; // 10 min

async function getSuperAdminRow() {
  try {
    const { rows } = await query('SELECT * FROM super_admin WHERE username = $1', ['Neranjan']);
    if (rows.length > 0) return rows[0];
  } catch { /* table may not exist in dev without DB */ }
  // fallback to bootstrap local state
  const { getSuperAdminState } = await import('@/lib/authAccess');
  const state = getSuperAdminState();
  return { username: 'Neranjan', password_hash: state.passwordHash, must_change_password: state.mustChangePassword, totp_secret_encrypted: null, totp_enabled: false, recovery_code_hash: null };
}

async function createSession(userRole: string, durationMs: number) {
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + durationMs).toISOString();
  const lastActiveAt = new Date().toISOString();
  try {
    await query('INSERT INTO sessions (token, user_role, expires_at, last_active_at) VALUES ($1, $2, $3, $4)', [token, userRole, expiresAt, lastActiveAt]);
  } catch {
    // if table missing in test, ignore
  }
  return { token, expiresAt, lastActiveAt };
}

async function validateSession(token: string) {
  try {
    const { rows } = await query(
      `SELECT * FROM sessions WHERE token = $1 AND expires_at > NOW() AND last_active_at > NOW() - INTERVAL '7 days'`,
      [token]
    );
    if (rows.length === 0) return null;
    // slide idle window
    await query('UPDATE sessions SET last_active_at = NOW() WHERE token = $1', [token]);
    return rows[0];
  } catch { return null; }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { action, username, password, totp, recoveryCode, newPassword, currentPassword } = body;

  if (action === 'login') {
    if (!isSuperAdminUsername(username)) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    const row = await getSuperAdminRow();
    const ok = await verifyPassword(password, row.password_hash);
    if (!ok) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });

    // Must change password before TOTP enrollment
    if (row.must_change_password) {
      const { token, expiresAt } = await createSession('super_admin_recovery', RECOVERY_SESSION_MS);
      const res = NextResponse.json({ success: true, mustChangePassword: true, totpRequired: false, recoverySession: true });
      res.cookies.set('session_token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: RECOVERY_SESSION_MS / 1000 });
      return res;
    }

    // TOTP required if enabled
    if (row.totp_enabled) {
      if (!totp) return NextResponse.json({ error: 'TOTP required', totpRequired: true }, { status: 401 });
      const valid = verifyTOTP(totp, row.totp_secret_encrypted);
      if (!valid) return NextResponse.json({ error: 'Invalid TOTP code', totpRequired: true }, { status: 401 });
    } else {
      // totp not yet enrolled -> force enrollment, create short recovery session
      const { token } = await createSession('super_admin_recovery', RECOVERY_SESSION_MS);
      const res = NextResponse.json({ success: true, mustEnrollTOTP: true, totpRequired: false });
      res.cookies.set('session_token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: RECOVERY_SESSION_MS / 1000 });
      return res;
    }

    const { token } = await createSession('super_admin', SESSION_ABSOLUTE_MS);
    const response = NextResponse.json({
      success: true,
      mustChangePassword: false,
      user: { id: 'super-admin-1', email: 'super-admin@fleetledger.local', isSuperAdmin: true, user_metadata: { username: 'Neranjan', role: 'super_admin', must_change_password: false } },
    });
    response.cookies.set('session_token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: SESSION_ABSOLUTE_MS / 1000 });
    return response;
  }

  if (action === 'setup-totp') {
    const cookieStore = await cookies();
    const token = cookieStore.get('session_token')?.value;
    // allow setup only with recovery session or authenticated
    const sess = token ? await validateSession(token) : null;
    if (!sess || !['super_admin', 'super_admin_recovery'].includes(sess.user_role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const secret = generateTOTPSecret();
    const uri = buildTOTPURI(secret);
    const encrypted = encryptTOTPSecret(secret);
    try {
      await query('UPDATE super_admin SET totp_secret_encrypted = $1, updated_at = NOW() WHERE username = $2', [encrypted, 'Neranjan']);
    } catch {}
    // also store in local fallback for dev without DB
    try { const { setSuperAdminState, getSuperAdminState } = await import('@/lib/authAccess'); const s = getSuperAdminState(); (s as any).totp_secret_encrypted = encrypted; setSuperAdminState(s as any); } catch {}
    // generate QR data URL via qrcode lib (lazy)
    let qrDataUrl: string | null = null;
    try { const QRCode = require('qrcode'); qrDataUrl = await QRCode.toDataURL(uri); } catch { qrDataUrl = null; }
    return NextResponse.json({ secret, uri, qrDataUrl });
  }

  if (action === 'verify-totp-setup') {
    const cookieStore = await cookies();
    const token = cookieStore.get('session_token')?.value;
    const sess = token ? await validateSession(token) : null;
    if (!sess) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const row = await getSuperAdminRow();
    if (!row.totp_secret_encrypted) return NextResponse.json({ error: 'No TOTP secret — call setup-totp first' }, { status: 400 });
    const valid = verifyTOTP(totp, row.totp_secret_encrypted);
    if (!valid) return NextResponse.json({ error: 'Invalid TOTP code' }, { status: 401 });
    // mark enabled and generate recovery code
    const recoveryCode = generateRecoveryCode();
    const recoveryHash = await hashRecoveryCode(recoveryCode);
    try {
      await query('UPDATE super_admin SET totp_enabled = true, totp_verified_at = NOW(), recovery_code_hash = $1, recovery_code_created_at = NOW(), recovery_code_used_at = null, updated_at = NOW() WHERE username = $2', [recoveryHash, 'Neranjan']);
    } catch {}
    // upgrade recovery session to full 30d session? keep short until user confirms saved
    return NextResponse.json({ success: true, recoveryCode, message: 'TOTP verified — save recovery code now' });
  }

  if (action === 'confirm-recovery-saved') {
    const cookieStore = await cookies();
    const token = cookieStore.get('session_token')?.value;
    const sess = token ? await validateSession(token) : null;
    if (!sess) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // promote to full session
    const { token: newToken } = await createSession('super_admin', SESSION_ABSOLUTE_MS);
    try { if (token) await query('DELETE FROM sessions WHERE token = $1', [token]); } catch {}
    const res = NextResponse.json({ success: true, user: { id: 'super-admin-1', isSuperAdmin: true, user_metadata: { username: 'Neranjan', role: 'super_admin' } } });
    res.cookies.set('session_token', newToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: SESSION_ABSOLUTE_MS / 1000 });
    return res;
  }

  if (action === 'recovery') {
    const code = recoveryCode ?? body.code ?? '';
    const row = await getSuperAdminRow();
    if (!row.recovery_code_hash) return NextResponse.json({ error: 'No recovery code set' }, { status: 400 });
    if (row.recovery_code_used_at) return NextResponse.json({ error: 'Recovery code already used' }, { status: 401 });
    const ok = await verifyRecoveryCode(code, row.recovery_code_hash);
    if (!ok) return NextResponse.json({ error: 'Invalid recovery code' }, { status: 401 });
    // burn code
    try { await query('UPDATE super_admin SET recovery_code_used_at = NOW(), updated_at = NOW() WHERE username = $1', ['Neranjan']); } catch {}
    // invalidate all existing sessions
    try { await query("DELETE FROM sessions WHERE user_role = 'super_admin'"); } catch {}
    const { token } = await createSession('super_admin_recovery', RECOVERY_SESSION_MS);
    const res = NextResponse.json({ success: true, recoverySession: true, message: 'Recovery verified — reset password and re-enroll TOTP' });
    res.cookies.set('session_token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: RECOVERY_SESSION_MS / 1000 });
    return res;
  }

  if (action === 'change-password') {
    const cookieStore = await cookies();
    const token = cookieStore.get('session_token')?.value;
    const sess = token ? await validateSession(token) : null;
    if (!sess) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const row = await getSuperAdminRow();
    const ok = await verifyPassword(currentPassword, row.password_hash);
    if (!ok) return NextResponse.json({ error: 'Current password incorrect' }, { status: 401 });
    if (!newPassword || newPassword.length < 6) return NextResponse.json({ error: 'New password must be at least 6 characters' }, { status: 400 });
    const newHash = await hashPassword(newPassword);
    try {
      await query('UPDATE super_admin SET password_hash = $1, must_change_password = false, recovery_code_used_at = null, updated_at = NOW() WHERE username = $2', [newHash, 'Neranjan']);
    } catch {}
    // also update fallback
    try { const { setSuperAdminState } = await import('@/lib/authAccess'); setSuperAdminState({ passwordHash: newHash, mustChangePassword: false }); } catch {}
    // if in recovery flow, keep recovery session; else keep existing session but update last_active
    return NextResponse.json({ success: true });
  }

  if (action === 'logout') {
    const cookieStore = await cookies();
    const token = cookieStore.get('session_token')?.value;
    if (token) { try { await query('DELETE FROM sessions WHERE token = $1', [token]); } catch {} }
    const response = NextResponse.json({ success: true });
    response.cookies.set('session_token', '', { maxAge: 0, path: '/' });
    return response;
  }

  if (action === 'session') {
    const cookieStore = await cookies();
    const token = cookieStore.get('session_token')?.value;
    if (!token) return NextResponse.json({ user: null });
    const sess = await validateSession(token);
    if (!sess) return NextResponse.json({ user: null });
    const row = await getSuperAdminRow();
    const isRecovery = sess.user_role === 'super_admin_recovery';
    return NextResponse.json({
      user: {
        id: 'super-admin-1',
        email: 'super-admin@fleetledger.local',
        isSuperAdmin: true,
        user_metadata: { username: 'Neranjan', role: isRecovery ? 'super_admin_recovery' : 'super_admin', must_change_password: row.must_change_password, totp_enabled: row.totp_enabled },
      },
      isRecoverySession: isRecovery,
    });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
