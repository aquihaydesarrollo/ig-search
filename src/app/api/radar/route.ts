import { NextResponse } from 'next/server';
import { lanzarBarrido } from '@/lib/lanzador';
import { queryOne } from '@/lib/db';

export const dynamic = 'force-dynamic';

function autorizado(req: Request): boolean {
  const secreto = process.env.RADAR_CRON_SECRET;
  return Boolean(secreto) && req.headers.get('x-radar-secret') === secreto;
}

/** Lanza el barrido nocturno. Responde al momento; no espera a que termine. */
export async function POST(req: Request) {
  if (!autorizado(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const r = await lanzarBarrido();
  return NextResponse.json(r, { status: r.ok ? 202 : 409 });
}

/** Estado del ultimo barrido, para poder comprobarlo desde fuera. */
export async function GET(req: Request) {
  if (!autorizado(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const ultima = await queryOne<any>(
    `SELECT id, iniciada_en, terminada_en, estado, negocios_nuevos, webs_auditadas,
            perfiles_ig, tareas_generadas, error
       FROM ejecuciones ORDER BY id DESC LIMIT 1`,
  );
  return NextResponse.json(ultima ?? { estado: 'sin_ejecuciones' });
}
