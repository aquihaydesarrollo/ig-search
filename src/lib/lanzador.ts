import { ejecutarRadar } from './radar.ts';
import { queryOne } from './db.ts';

/** Evita que se solapen dos barridos dentro del mismo proceso. */
let enCurso = false;

export interface ResultadoLanzamiento {
  ok: boolean;
  mensaje: string;
}

/**
 * Lanza el barrido en segundo plano y devuelve el control al momento.
 *
 * Un barrido completo tarda entre 15 y 25 minutos, muy por encima de lo que
 * aguanta una peticion HTTP en un alojamiento compartido. Por eso ni el panel
 * ni la tarea programada esperan a que termine: el progreso queda en la tabla
 * ejecuciones y se consulta recargando el panel.
 */
export async function lanzarBarrido(): Promise<ResultadoLanzamiento> {
  if (enCurso) {
    return { ok: false, mensaje: 'Ya hay un barrido en marcha. Recarga en unos minutos.' };
  }

  const abierta = await queryOne<{ n: number }>(
    `SELECT count(*) AS n FROM ejecuciones
      WHERE estado = 'en_curso' AND iniciada_en > datetime('now','-1 hour')`,
  );
  if ((abierta?.n ?? 0) > 0) {
    return { ok: false, mensaje: 'Ya hay un barrido en marcha. Recarga en unos minutos.' };
  }

  enCurso = true;
  void ejecutarRadar()
    .catch(() => { /* el error queda registrado en la tabla ejecuciones */ })
    .finally(() => { enCurso = false; });

  return {
    ok: true,
    mensaje: 'Barrido lanzado. Tarda entre 15 y 25 minutos; ve recargando esta página.',
  };
}
