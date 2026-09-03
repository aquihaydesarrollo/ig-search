'use server';

import { perfilPublico, estadisticasPerfil } from '@/lib/meta';
import { analizar, type Analisis } from '@/lib/analisis';
import { run } from '@/lib/db';
import { ajuste } from '@/lib/ajustes';

export interface RespuestaAnalisis {
  ok: boolean;
  mensaje?: string;
  analisis?: Analisis;
}

/** Analiza una cuenta pública y guarda lo obtenido para poder compararla luego. */
export async function analizarCuenta(handle: string): Promise<RespuestaAnalisis> {
  const limpio = handle.trim().replace(/^@/, '').replace(/\/+$/, '')
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '');

  if (!/^[A-Za-z0-9_.]{1,30}$/.test(limpio)) {
    return { ok: false, mensaje: 'Ese nombre de usuario no es válido.' };
  }

  if (!ajuste('META_ACCESS_TOKEN') || !ajuste('META_IG_USER_ID')) {
    return {
      ok: false,
      mensaje: 'Falta conectar Instagram. Ve a Ajustes y conecta tu cuenta primero.',
    };
  }

  try {
    const perfil = await perfilPublico(limpio, 50);
    if (!perfil) {
      return {
        ok: false,
        mensaje: `No se pudo leer @${limpio}. Solo funciona con cuentas profesionales públicas: ` +
                 'las personales y las privadas no las expone la API de Meta.',
      };
    }

    const analisis = analizar(perfil);
    await guardar(perfil, analisis);
    return { ok: true, analisis };
  } catch (err: any) {
    return { ok: false, mensaje: String(err?.message ?? err) };
  }
}

async function guardar(
  perfil: NonNullable<Awaited<ReturnType<typeof perfilPublico>>>,
  analisis: Analisis,
) {
  const stats = estadisticasPerfil(perfil);

  await run(
    `INSERT INTO perfiles_ig
       (handle, seguidores, num_publicaciones, biografia, web_perfil,
        ultima_publicacion, engagement_medio, frecuencia_semanal, revisado_en)
     VALUES (?,?,?,?,?,?,?,?, datetime('now'))
     ON CONFLICT(handle) DO UPDATE SET
       seguidores = excluded.seguidores, num_publicaciones = excluded.num_publicaciones,
       biografia = excluded.biografia, web_perfil = excluded.web_perfil,
       ultima_publicacion = excluded.ultima_publicacion,
       engagement_medio = excluded.engagement_medio,
       frecuencia_semanal = excluded.frecuencia_semanal,
       revisado_en = datetime('now')`,
    [perfil.handle, perfil.seguidores, perfil.numPublicaciones, perfil.biografia,
     perfil.webPerfil, stats.ultimaPublicacion,
     analisis.engagementTipico ?? analisis.engagementMedio, analisis.publicacionesPorSemana],
  );

  for (const post of perfil.publicaciones) {
    await run(
      `INSERT INTO publicaciones (id, handle, tipo, texto, permalink, likes, comentarios, publicada_en)
       VALUES (?,?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET likes = excluded.likes, comentarios = excluded.comentarios`,
      [post.id, perfil.handle, post.tipo, post.texto, post.permalink,
       post.likes, post.comentarios, post.publicadaEn],
    );
  }
}
