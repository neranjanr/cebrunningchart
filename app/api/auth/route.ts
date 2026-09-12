import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { verifyPassword, isSuperAdminUsername } from '@/lib/authAccess';

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { action, username, password } = body;

  if (action === 'login') {
    if (!isSuperAdminUsername(username)) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const { getSuperAdminState } = await import('@/lib/authAccess');
    const state = getSuperAdminState();
    const ok = await verifyPassword(password, state.passwordHash);
    if (!ok) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();
    await query('INSERT INTO sessions (token, user_role, expires_at) VALUES ($1, $2, $3)', [token, 'super_admin', expiresAt]);

    const response = NextResponse.json({
      success: true,
      mustChangePassword: state.mustChangePassword,
      user: {
        id: 'super-admin-1',
        email: 'super-admin@fleetledger.local',
        isSuperAdmin: true,
        user_metadata: { username: 'Neranjan', role: 'super_admin', must_change_password: state.mustChangePassword },
      },
    });

    response.cookies.set('session_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_DURATION_MS / 1000,
    });

    return response;
  }

  if (action === 'logout') {
    const cookieStore = await cookies();
    const token = cookieStore.get('session_token')?.value;
    if (token) {
      await query('DELETE FROM sessions WHERE token = $1', [token]);
    }
    const response = NextResponse.json({ success: true });
    response.cookies.set('session_token', '', { maxAge: 0, path: '/' });
    return response;
  }

  if (action === 'session') {
    const cookieStore = await cookies();
    const token = cookieStore.get('session_token')?.value;
    if (!token) return NextResponse.json({ user: null });

    const { rows } = await query('SELECT * FROM sessions WHERE token = $1 AND expires_at > NOW()', [token]);
    if (rows.length === 0) return NextResponse.json({ user: null });

    const { getSuperAdminState } = await import('@/lib/authAccess');
    const state = getSuperAdminState();
    return NextResponse.json({
      user: {
        id: 'super-admin-1',
        email: 'super-admin@fleetledger.local',
        isSuperAdmin: true,
        user_metadata: { username: 'Neranjan', role: 'super_admin', must_change_password: state.mustChangePassword },
      },
    });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
