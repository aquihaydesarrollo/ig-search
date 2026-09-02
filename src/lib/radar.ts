import { getConfig } from './config.ts';
import { query, queryOne } from './db.ts';
import { buscarNegocios, coordenadasDeCiudad, type Negocio } from './places.ts';
import { auditarWeb, puntuacionPageSpeed } from './web-audit.ts';
import { perfilPublico, estadisticasPerfil, metricasPropias } from './meta.ts';
import { puntuar } from './scoring.ts';

export interface ResumenEjecucion {
  ejecucionId: number;
  negociosNuevos: number;
  websAuditadas: number;
  perfilesIg: number;
  tareasGeneradas: number;
  avisos: string[];
}

const PAUSA = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Ejecuta el barrido completo del radar. Pensado para correr una vez al dia. */
export async function ejecutarRadar(): Promise<ResumenEjecucion> {
  const cfg = getConfig();
  const avisos: string[] = [];

  const ejecucion = await queryOne<{ id: number }>(
    `INSERT INTO ejecuciones (estado) VALUES ('en_curso') RETURNING id`,
  );
  const ejecucionId = ejecucion!.id;

  const resumen: ResumenEjecucion = {
    ejecucionId,
    negociosNuevos: 0,
    websAuditadas: 0,
    perfilesIg: 0,
    tareasGeneradas: 0,
    avisos,
  };

  try {
    // 1. Coordenadas de la ciudad ---------------------------------------
    let { lat, lng } = cfg.coordenadas;
    if (lat == null || lng == null) {
      const coords = await coordenadasDeCiudad(`${cfg.ciudad}, ${cfg.region}`);
      if (coords) { lat = coords.lat; lng = coords.lng; }
      else avisos.push(`No se pudieron geolocalizar las coordenadas de ${cfg.ciudad}`);
    }

    // 2. Descubrir negocios por sector -----------------------------------
    for (const sector of cfg.sectores) {
      try {
        const encontrados = await buscarNegocios({
          sector,
          ciudad: cfg.ciudad,
          region: cfg.region,
          lat,
          lng,
          radioKm: cfg.radioKm,
        });
        resumen.negociosNuevos += await guardarNegocios(encontrados);
      } catch (err: any) {
        avisos.push(`Sector "${sector}": ${err.message}`);
      }
    }

    // 3. Auditar webs no revisadas (o revisadas hace mas de 30 dias) ------
    const pendientes = await query<{ id: string; web: string | null }>(
      `SELECT n.id, n.web
         FROM negocios n
         LEFT JOIN auditorias_web a ON a.negocio_id = n.id
        WHERE a.negocio_id IS NULL OR a.revisado_en < now() - interval '30 days'
        ORDER BY n.num_resenas DESC NULLS LAST
        LIMIT 120`,
    );

    for (const negocio of pendientes) {
      const auditoria = await auditarWeb(negocio.web);
      await query(
        `INSERT INTO auditorias_web
           (negocio_id, tiene_web, accesible, codigo_http, https, responsive,
            segundos_carga, titulo, instagram_handle, notas, revisado_en)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, now())
         ON CONFLICT (negocio_id) DO UPDATE SET
           tiene_web = EXCLUDED.tiene_web, accesible = EXCLUDED.accesible,
           codigo_http = EXCLUDED.codigo_http, https = EXCLUDED.https,
           responsive = EXCLUDED.responsive, segundos_carga = EXCLUDED.segundos_carga,
           titulo = EXCLUDED.titulo, instagram_handle = EXCLUDED.instagram_handle,
           notas = EXCLUDED.notas, revisado_en = now()`,
        [
          negocio.id, auditoria.tieneWeb, auditoria.accesible, auditoria.codigoHttp,
          auditoria.https, auditoria.responsive, auditoria.segundosCarga,
          auditoria.titulo, auditoria.instagramHandle, auditoria.notas,
        ],
      );
      resumen.websAuditadas++;
      await PAUSA(200);
    }

    // 4. Datos de Instagram de los negocios con handle detectado ----------
    if (process.env.META_ACCESS_TOKEN && process.env.META_IG_USER_ID) {
      const conHandle = await query<{ negocio_id: string; instagram_handle: string }>(
        `SELECT a.negocio_id, a.instagram_handle
           FROM auditorias_web a
           LEFT JOIN perfiles_ig p ON p.handle = a.instagram_handle
          WHERE a.instagram_handle IS NOT NULL
            AND (p.handle IS NULL OR p.revisado_en < now() - interval '14 days')
          LIMIT 80`,
      );

      for (const fila of conHandle) {
        try {
          const perfil = await perfilPublico(fila.instagram_handle);
          if (!perfil) continue;
          await guardarPerfil(perfil, fila.negocio_id, false);
          resumen.perfilesIg++;
          await PAUSA(400);
        } catch (err: any) {
          avisos.push(`Instagram @${fila.instagram_handle}: ${err.message}`);
        }
      }

      // 5. Competidores -------------------------------------------------
      for (const handle of cfg.competidores) {
        try {
          const perfil = await perfilPublico(handle, 25);
          if (perfil) { await guardarPerfil(perfil, null, true); await PAUSA(400); }
          else avisos.push(`Competidor @${handle}: no accesible (privado o no profesional)`);
        } catch (err: any) {
          avisos.push(`Competidor @${handle}: ${err.message}`);
        }
      }

      // 6. Metricas propias ---------------------------------------------
      try {
        const m = await metricasPropias();
        await query(
          `INSERT INTO metricas_propias (fecha, seguidores, alcance, visitas_perfil, clics_web, interacciones)
           VALUES (CURRENT_DATE,$1,$2,$3,$4,$5)
           ON CONFLICT (fecha) DO UPDATE SET
             seguidores = EXCLUDED.seguidores, alcance = EXCLUDED.alcance,
             visitas_perfil = EXCLUDED.visitas_perfil, clics_web = EXCLUDED.clics_web,
             interacciones = EXCLUDED.interacciones`,
          [m.seguidores, m.alcance, m.visitasPerfil, m.clicsWeb, m.interacciones],
        );
      } catch (err: any) {
        avisos.push(`Metricas propias: ${err.message}`);
      }
    } else {
      avisos.push('Sin credenciales de Meta: se omiten los datos de Instagram');
    }

    // 7. Recalcular puntuaciones -----------------------------------------
    await recalcularLeads();

    // 8. PageSpeed solo para los mejores leads ---------------------------
    await afinarConPageSpeed(20);
    await recalcularLeads();

    // 9. Generar la lista de tareas de hoy -------------------------------
    resumen.tareasGeneradas = await generarTareasDeHoy();

    await query(
      `UPDATE ejecuciones SET terminada_en = now(), estado = 'ok',
              negocios_nuevos = $2, webs_auditadas = $3, perfiles_ig = $4, tareas_generadas = $5,
              error = $6
        WHERE id = $1`,
      [ejecucionId, resumen.negociosNuevos, resumen.websAuditadas, resumen.perfilesIg,
       resumen.tareasGeneradas, avisos.length ? avisos.join(' | ').slice(0, 2000) : null],
    );
  } catch (err: any) {
    await query(
      `UPDATE ejecuciones SET terminada_en = now(), estado = 'error', error = $2 WHERE id = $1`,
      [ejecucionId, String(err?.message ?? err).slice(0, 2000)],
    );
    throw err;
  }

  return resumen;
}

async function guardarNegocios(negocios: Negocio[]): Promise<number> {
  let nuevos = 0;
  for (const n of negocios) {
    const res = await query<{ insertado: boolean }>(
      `INSERT INTO negocios
         (id, nombre, sector, direccion, telefono, web, google_maps_url,
          valoracion, num_resenas, lat, lng)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (id) DO UPDATE SET
         nombre = EXCLUDED.nombre, web = EXCLUDED.web, telefono = EXCLUDED.telefono,
         valoracion = EXCLUDED.valoracion, num_resenas = EXCLUDED.num_resenas,
         actualizado_en = now()
       RETURNING (xmax = 0) AS insertado`,
      [n.id, n.nombre, n.sector, n.direccion, n.telefono, n.web, n.googleMapsUrl,
       n.valoracion, n.numResenas, n.lat, n.lng],
    );
    if (res[0]?.insertado) nuevos++;
  }
  return nuevos;
}

async function guardarPerfil(
  perfil: Awaited<ReturnType<typeof perfilPublico>>,
  negocioId: string | null,
  esCompetidor: boolean,
) {
  if (!perfil) return;
  const stats = estadisticasPerfil(perfil);

  await query(
    `INSERT INTO perfiles_ig
       (handle, negocio_id, seguidores, num_publicaciones, biografia, web_perfil,
        ultima_publicacion, engagement_medio, frecuencia_semanal, es_competidor, revisado_en)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, now())
     ON CONFLICT (handle) DO UPDATE SET
       negocio_id = COALESCE(EXCLUDED.negocio_id, perfiles_ig.negocio_id),
       seguidores = EXCLUDED.seguidores, num_publicaciones = EXCLUDED.num_publicaciones,
       biografia = EXCLUDED.biografia, web_perfil = EXCLUDED.web_perfil,
       ultima_publicacion = EXCLUDED.ultima_publicacion,
       engagement_medio = EXCLUDED.engagement_medio,
       frecuencia_semanal = EXCLUDED.frecuencia_semanal,
       es_competidor = perfiles_ig.es_competidor OR EXCLUDED.es_competidor,
       revisado_en = now()`,
    [perfil.handle, negocioId, perfil.seguidores, perfil.numPublicaciones, perfil.biografia,
     perfil.webPerfil, stats.ultimaPublicacion, stats.engagementMedio, stats.frecuenciaSemanal,
     esCompetidor],
  );

  for (const post of perfil.publicaciones) {
    await query(
      `INSERT INTO publicaciones (id, handle, tipo, texto, permalink, likes, comentarios, publicada_en)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (id) DO UPDATE SET
         likes = EXCLUDED.likes, comentarios = EXCLUDED.comentarios`,
      [post.id, perfil.handle, post.tipo, post.texto, post.permalink,
       post.likes, post.comentarios, post.publicadaEn],
    );
  }
}

/** Recorre todos los negocios auditados y recalcula su puntuacion de oportunidad. */
export async function recalcularLeads(): Promise<number> {
  const cfg = getConfig();
  const filas = await query<any>(
    `SELECT n.id, n.sector, n.valoracion, n.num_resenas,
            a.tiene_web, a.accesible, a.https, a.responsive, a.segundos_carga, a.puntuacion_psi,
            p.seguidores AS ig_seguidores, p.ultima_publicacion AS ig_ultima, p.engagement_medio AS ig_engagement
       FROM negocios n
       JOIN auditorias_web a ON a.negocio_id = n.id
       LEFT JOIN perfiles_ig p ON p.negocio_id = n.id`,
  );

  for (const f of filas) {
    const { score, motivos } = puntuar(
      {
        sector: f.sector,
        valoracion: f.valoracion != null ? Number(f.valoracion) : null,
        numResenas: f.num_resenas,
        tieneWeb: f.tiene_web,
        accesible: f.accesible,
        https: f.https,
        responsive: f.responsive,
        segundosCarga: f.segundos_carga != null ? Number(f.segundos_carga) : null,
        puntuacionPsi: f.puntuacion_psi,
        igSeguidores: f.ig_seguidores,
        igUltimaPublicacion: f.ig_ultima ? new Date(f.ig_ultima).toISOString() : null,
        igEngagement: f.ig_engagement != null ? Number(f.ig_engagement) : null,
      },
      cfg,
    );

    await query(
      `INSERT INTO leads (negocio_id, score, motivos, calculado_en)
       VALUES ($1,$2,$3::jsonb, now())
       ON CONFLICT (negocio_id) DO UPDATE SET
         score = EXCLUDED.score, motivos = EXCLUDED.motivos, calculado_en = now()`,
      [f.id, score, JSON.stringify(motivos)],
    );
  }
  return filas.length;
}

/** Ejecuta PageSpeed solo sobre los mejores leads con web accesible aun sin medir. */
async function afinarConPageSpeed(limite: number) {
  if (!process.env.GOOGLE_PAGESPEED_API_KEY) return;

  const candidatos = await query<{ id: string; web: string }>(
    `SELECT n.id, n.web
       FROM leads l
       JOIN negocios n ON n.id = l.negocio_id
       JOIN auditorias_web a ON a.negocio_id = n.id
      WHERE a.accesible = true AND a.puntuacion_psi IS NULL AND n.web IS NOT NULL
      ORDER BY l.score DESC
      LIMIT $1`,
    [limite],
  );

  for (const c of candidatos) {
    const score = await puntuacionPageSpeed(c.web);
    if (score != null) {
      await query(`UPDATE auditorias_web SET puntuacion_psi = $2 WHERE negocio_id = $1`, [c.id, score]);
    }
    await PAUSA(1000);
  }
}

/** Construye la lista de acciones del dia respetando los limites configurados. */
export async function generarTareasDeHoy(): Promise<number> {
  const cfg = getConfig();

  const yaHay = await queryOne<{ n: string }>(
    `SELECT count(*)::text AS n FROM tareas_diarias WHERE fecha = CURRENT_DATE`,
  );
  if (Number(yaHay?.n ?? 0) > 0) return 0;

  const total = cfg.limitesDiarios.comentarios + cfg.limitesDiarios.seguimientos;

  const candidatos = await query<any>(
    `SELECT n.id, n.nombre, n.sector, n.valoracion, n.num_resenas, n.google_maps_url,
            l.score, l.motivos,
            a.instagram_handle,
            p.handle AS ig_handle, p.seguidores, p.ultima_publicacion,
            (SELECT permalink FROM publicaciones pub
              WHERE pub.handle = p.handle ORDER BY pub.publicada_en DESC LIMIT 1) AS ultimo_post
       FROM leads l
       JOIN negocios n ON n.id = l.negocio_id
       JOIN auditorias_web a ON a.negocio_id = n.id
       LEFT JOIN perfiles_ig p ON p.negocio_id = n.id
      WHERE l.estado = 'nuevo'
        AND NOT EXISTS (SELECT 1 FROM tareas_diarias t WHERE t.negocio_id = n.id)
      ORDER BY l.score DESC, n.num_resenas DESC NULLS LAST
      LIMIT $1`,
    [Math.max(total, cfg.umbrales.leadsPorDia)],
  );

  let creadas = 0;
  let comentarios = 0;
  let seguimientos = 0;

  for (const c of candidatos) {
    const handle = c.ig_handle ?? c.instagram_handle;
    const motivos: string[] = Array.isArray(c.motivos) ? c.motivos : [];
    const contexto = [
      `${c.nombre} (${c.sector ?? 'sin sector'})`,
      c.valoracion ? `${c.valoracion}★ con ${c.num_resenas} resenas` : null,
      ...motivos,
    ].filter(Boolean).join(' · ');

    if (handle && c.ultimo_post && comentarios < cfg.limitesDiarios.comentarios) {
      await crearTarea('comentar', c.id, handle, c.ultimo_post, contexto);
      comentarios++; creadas++;
    } else if (handle && seguimientos < cfg.limitesDiarios.seguimientos) {
      await crearTarea('seguir', c.id, handle, `https://instagram.com/${handle}`, contexto);
      seguimientos++; creadas++;
    } else if (!handle) {
      await crearTarea('revisar', c.id, null, c.google_maps_url, `${contexto} · Sin Instagram localizado: buscar a mano o contactar por telefono`);
      creadas++;
    }

    if (comentarios >= cfg.limitesDiarios.comentarios && seguimientos >= cfg.limitesDiarios.seguimientos) break;
  }

  return creadas;
}

async function crearTarea(
  tipo: string,
  negocioId: string | null,
  handle: string | null,
  enlace: string | null,
  contexto: string,
) {
  await query(
    `INSERT INTO tareas_diarias (fecha, tipo, negocio_id, handle, enlace, contexto)
     VALUES (CURRENT_DATE, $1, $2, $3, $4, $5)`,
    [tipo, negocioId, handle, enlace, contexto],
  );
}
