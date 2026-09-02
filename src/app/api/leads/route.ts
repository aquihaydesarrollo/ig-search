import { NextResponse } from 'next/server';
import { run } from '@/lib/db';

const ESTADOS = ['nuevo', 'contactado', 'en_conversacion', 'cliente', 'descartado'];

export async function POST(req: Request) {
  const { negocioId, estado, nota } = await req.json();
  if (typeof negocioId !== 'string' || !ESTADOS.includes(estado)) {
    return NextResponse.json({ error: 'Parametros invalidos' }, { status: 400 });
  }
  await run(`UPDATE leads SET estado = ?, nota = COALESCE(?, nota) WHERE negocio_id = ?`,
    [estado, nota ?? null, negocioId]);
  return NextResponse.json({ ok: true });
}
