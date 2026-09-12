import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';

async function validateSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get('session_token')?.value;
  if (!token) return false;
  const { rows } = await query('SELECT 1 FROM sessions WHERE token = $1 AND expires_at > NOW()', [token]);
  return rows.length > 0;
}

export async function GET() {
  if (!(await validateSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { rows } = await query('SELECT * FROM vehicles LIMIT 1');
  return NextResponse.json(rows[0] ?? null);
}

export async function PUT(request: NextRequest) {
  if (!(await validateSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await request.json();
  const { rows: existing } = await query('SELECT id FROM vehicles LIMIT 1');

  if (existing.length > 0) {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    for (const [key, val] of Object.entries(body)) {
      if (key === 'id' || key === 'created_at') continue;
      fields.push(`${key} = $${idx}`);
      values.push(val);
      idx++;
    }
    fields.push(`updated_at = NOW()`);
    values.push(existing[0].id);
    await query(`UPDATE vehicles SET ${fields.join(', ')} WHERE id = $${idx}`, values);
    const { rows } = await query('SELECT * FROM vehicles WHERE id = $1', [existing[0].id]);
    return NextResponse.json(rows[0]);
  } else {
    const keys = Object.keys(body).filter(k => k !== 'id' && k !== 'created_at');
    const vals = keys.map(k => body[k]);
    const placeholders = keys.map((_, i) => `$${i + 1}`);
    const { rows } = await query(
      `INSERT INTO vehicles (${keys.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
      vals
    );
    return NextResponse.json(rows[0]);
  }
}
