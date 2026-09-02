import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(req: Request) {
  const { id, hecha } = await req.json();
  if (typeof id !== 'number' || typeof hecha !== 'boolean') {
    return NextResponse.json({ error: 'Parametros invalidos' }, { status: 400 });
  }

  await query(
    `UPDATE tareas_diarias SET hecha = $2, hecha_en = CASE WHEN $2 THEN now() ELSE NULL END WHERE id = $1`,
    [id, hecha],
  );
  return NextResponse.json({ ok: true });
}
