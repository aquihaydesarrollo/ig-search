import { NextResponse } from 'next/server';
import { ejecutarRadar } from '@/lib/radar';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

/**
 * Endpoint que dispara el barrido nocturno.
 * Protegido con la cabecera x-radar-secret (valor en RADAR_CRON_SECRET).
 */
export async function POST(req: Request) {
  const secreto = process.env.RADAR_CRON_SECRET;
  if (!secreto || req.headers.get('x-radar-secret') !== secreto) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const resumen = await ejecutarRadar();
    return NextResponse.json({ ok: true, ...resumen });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 });
  }
}
