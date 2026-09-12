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
  const { rows } = await query('SELECT * FROM book_pages ORDER BY page_number ASC');
  return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
  if (!(await validateSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await request.json();
  const { rows } = await query(
    `INSERT INTO book_pages (id, vehicle_id, page_number, month, start_km, end_km, start_fuel_balance, end_fuel_balance)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [body.id, body.vehicle_id, body.page_number, body.month,
     body.start_km, body.end_km, body.start_fuel_balance, body.end_fuel_balance]
  );
  return NextResponse.json(rows[0]);
}

export async function PUT(request: NextRequest) {
  if (!(await validateSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await request.json();
  const { id, ...fields } = body;
  if (!id) return NextResponse.json({ error: 'Missing page id' }, { status: 400 });

  const setClauses: string[] = [];
  const values: unknown[] = [];
  let idx = 1;
  for (const [key, val] of Object.entries(fields)) {
    setClauses.push(`${key} = $${idx}`);
    values.push(val);
    idx++;
  }
  values.push(id);
  const { rows } = await query(
    `UPDATE book_pages SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  return NextResponse.json(rows[0] ?? null);
}
