import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

const ESTADOS = ['nuevo', 'contactado', 'en_conversacion', 'cliente', 'descartado'];

export async function POST(req: Request) {
  const { negocioId, estado, nota } = await req.json();
  if (typeof negocioId !== 'string' || !ESTADOS.includes(estado)) {
    return NextResponse.json({ error: 'Parametros invalidos' }, { status: 400 });
  }

  await query(
    `UPDATE leads SET estado = $2, nota = COALESCE($3, nota) WHERE negocio_id = $1`,
    [negocioId, estado, nota ?? null],
  );
  return NextResponse.json({ ok: true });
}
