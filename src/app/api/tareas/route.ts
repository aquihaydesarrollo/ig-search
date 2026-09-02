import { NextResponse } from 'next/server';
import { run } from '@/lib/db';

export async function POST(req: Request) {
  const { id, hecha } = await req.json();
  if (typeof id !== 'number' || typeof hecha !== 'boolean') {
    return NextResponse.json({ error: 'Parametros invalidos' }, { status: 400 });
  }
  await run(
    `UPDATE tareas_diarias SET hecha = ?, hecha_en = CASE WHEN ? THEN datetime('now') ELSE NULL END WHERE id = ?`,
    [hecha ? 1 : 0, hecha ? 1 : 0, id],
  );
  return NextResponse.json({ ok: true });
}
