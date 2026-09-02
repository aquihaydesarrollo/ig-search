import { getConfig } from './config.ts';
import { query, queryOne, run, aEntero } from './db.ts';
import { buscarNegocios, coordenadasDeCiudad, SECTORES, type Negocio } from './osm.ts';
import { auditarWeb } from './web-audit.ts';
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

export async function ejecutarRadar(): Promise<ResumenEjecucion> {
  const cfg = getConfig();
  const avisos: string[] = [];

  const { id: ejecucionId } = await run(`INSERT INTO ejecuciones (estado) VALUES ('en_curso')`);

  const resumen: ResumenEjecucion = {
    ejecucionId: Number(ejecucionId),
    negociosNuevos: 0, websAuditadas: 0, perfilesIg: 0, tareasGeneradas: 0, avisos,
  };

  try {
    // 1. Coordenadas ------------------------------------------------------
    let { lat, lng } = cfg.coordenadas;
    if (lat == null || lng == null) {
      const coords = await coordenadasDeCiudad(`${cfg.ciudad}, ${cfg.region}`);
      if (coords) { lat = coords.lat; lng = coords.lng; }
      else throw new Error(`No se pudieron obtener las coordenadas de ${cfg.ciudad}`);
    }

    // 2. Descubrir negocios en OpenStreetMap ------------------------------
    // Una unica consulta con todos los sectores: Overpass es un servicio
    // publico gratuito y 23 peticiones seguidas hacen que deje de responder.
    const desconocidos = cfg.sectores.filter((s) => !SECTORES[s]);
    if (desconocidos.length) avisos.push(`Sectores desconocidos en la configuracion: ${desconocidos.join(', ')}`);

    const sectores = cfg.sectores.filter((s) => SECTORES[s]);
    try {
      const encontrados = await buscarNegocios({ sectores, lat, lng, radioKm: cfg.radioKm });
      resumen.negociosNuevos += await guardarNegocios(encontrados);
      if (encontrados.length === 0) avisos.push('OpenStreetMap no devolvio ningun negocio para esta zona');
    } catch (err: any) {
      avisos.push(`Descubrimiento de negocios: ${err.message}`);
    }

    // 3. Auditar webs -----------------------------------------------------
    const pendientes = await query<{ id: string; web: string | null }>(
      `SELECT n.id, n.web
         FROM negocios n
         LEFT JOIN auditorias_web a ON a.negocio_id = n.id
        WHERE a.negocio_id IS NULL OR a.revisado_en < datetime('now','-30 days')
        ORDER BY (n.web IS NOT NULL) DESC, n.nombre
        LIMIT ?`,
      [cfg.umbrales.maxWebsPorBarrido],
    );

    for (const negocio of pendientes) {
      const a = await auditarWeb(negocio.web);
      await run(
        `INSERT INTO auditorias_web
           (negocio_id, tiene_web, accesible, codigo_http, https, responsive, segundos_carga,
            peso_kb, tecnologia, plantilla_barata, anio_copyright, titulo, instagram_handle,
            problemas, notas, revisado_en)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, datetime('now'))
         ON CONFLICT(negocio_id) DO UPDATE SET
           tiene_web = excluded.tiene_web, accesible = excluded.accesible,
           codigo_http = excluded.codigo_http, https = excluded.https,
           responsive = excluded.responsive, segundos_carga = excluded.segundos_carga,
           peso_kb = excluded.peso_kb, tecnologia = excluded.tecnologia,
           plantilla_barata = excluded.plantilla_barata, anio_copyright = excluded.anio_copyright,
           titulo = excluded.titulo, instagram_handle = excluded.instagram_handle,
           problemas = excluded.problemas, notas = excluded.notas, revisado_en = datetime('now')`,
        [negocio.id, aEntero(a.tieneWeb), aEntero(a.accesible), a.codigoHttp, aEntero(a.https),
         aEntero(a.responsive), a.segundosCarga, a.pesoKb, a.tecnologia, aEntero(a.plantillaBarata),
         a.anioCopyright, a.titulo, a.instagramHandle, JSON.stringify(a.problemas), a.notas],
      );
      resumen.websAuditadas++;
      await PAUSA(150);
    }

    // 4. Instagram ---------------------------------------------------------
    if (process.env.META_ACCESS_TOKEN && process.env.META_IG_USER_ID) {
      const conHandle = await query<{ negocio_id: string; handle: string }>(
        `SELECT n.id AS negocio_id,
                COALESCE(n.instagram_tag, a.instagram_handle) AS handle
           FROM negocios n
           LEFT JOIN auditorias_web a ON a.negocio_id = n.id
           LEFT JOIN perfiles_ig p ON p.handle = COALESCE(n.instagram_tag, a.instagram_handle)
          WHERE COALESCE(n.instagram_tag, a.instagram_handle) IS NOT NULL
            AND (p.handle IS NULL OR p.revisado_en < datetime('now','-14 days'))
          LIMIT 80`,
      );

      for (const fila of conHandle) {
        try {
          const perfil = await perfilPublico(fila.handle);
          if (!perfil) continue;
          await guardarPerfil(perfil, fila.negocio_id, false);
          resumen.perfilesIg++;
          await PAUSA(400);
        } catch (err: any) {
          avisos.push(`Instagram @${fila.handle}: ${err.message}`);
        }
      }

      for (const handle of cfg.competidores) {
        try {
          const perfil = await perfilPublico(handle, 25);
          if (perfil) { await guardarPerfil(perfil, null, true); await PAUSA(400); }
          else avisos.push(`Competidor @${handle}: no accesible (privado o cuenta no profesional)`);
        } catch (err: any) {
          avisos.push(`Competidor @${handle}: ${err.message}`);
        }
      }

      try {
        const m = await metricasPropias();
        await run(
          `INSERT INTO metricas_propias (fecha, seguidores, alcance, visitas_perfil, clics_web, interacciones)
           VALUES (date('now'),?,?,?,?,?)
           ON CONFLICT(fecha) DO UPDATE SET
             seguidores = excluded.seguidores, alcance = excluded.alcance,
             visitas_perfil = excluded.visitas_perfil, clics_web = excluded.clics_web,
             interacciones = excluded.interacciones`,
          [m.seguidores, m.alcance, m.visitasPerfil, m.clicsWeb, m.interacciones],
        );
      } catch (err: any) {
        avisos.push(`Metricas propias: ${err.message}`);
      }
    } else {
      avisos.push('Sin credenciales de Meta: se omiten todos los datos de Instagram');
    }

    // 5. Puntuar y generar tareas -----------------------------------------
    await recalcularLeads();
    resumen.tareasGeneradas = await generarTareasDeHoy();

    await run(
      `UPDATE ejecuciones SET terminada_en = datetime('now'), estado = 'ok',
              negocios_nuevos = ?, webs_auditadas = ?, perfiles_ig = ?, tareas_generadas = ?, error = ?
        WHERE id = ?`,
      [resumen.negociosNuevos, resumen.websAuditadas, resumen.perfilesIg, resumen.tareasGeneradas,
       avisos.length ? avisos.join(' | ').slice(0, 2000) : null, resumen.ejecucionId],
    );
  } catch (err: any) {
    await run(
      `UPDATE ejecuciones SET terminada_en = datetime('now'), estado = 'error', error = ? WHERE id = ?`,
      [String(err?.message ?? err).slice(0, 2000), resumen.ejecucionId],
    );
    throw err;
  }

  return resumen;
}

async function guardarNegocios(negocios: Negocio[]): Promise<number> {
  let nuevos = 0;
  for (const n of negocios) {
    const existe = await queryOne(`SELECT 1 AS x FROM negocios WHERE id = ?`, [n.id]);
    await run(
      `INSERT INTO negocios
         (id, nombre, sector, direccion, telefono, web, osm_url, instagram_tag,
          tiene_horario, es_cadena, lat, lng)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET
         nombre = excluded.nombre, web = excluded.web, telefono = excluded.telefono,
         instagram_tag = excluded.instagram_tag, tiene_horario = excluded.tiene_horario,
         actualizado_en = datetime('now')`,
      [n.id, n.nombre, n.sector, n.direccion, n.telefono, n.web, n.osmUrl, n.instagramTag,
       aEntero(n.tieneHorario), aEntero(n.esCadena), n.lat, n.lng],
    );
    if (!existe) nuevos++;
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

  await run(
    `INSERT INTO perfiles_ig
       (handle, negocio_id, seguidores, num_publicaciones, biografia, web_perfil,
        ultima_publicacion, engagement_medio, frecuencia_semanal, es_competidor, revisado_en)
     VALUES (?,?,?,?,?,?,?,?,?,?, datetime('now'))
     ON CONFLICT(handle) DO UPDATE SET
       negocio_id = COALESCE(excluded.negocio_id, perfiles_ig.negocio_id),
       seguidores = excluded.seguidores, num_publicaciones = excluded.num_publicaciones,
       biografia = excluded.biografia, web_perfil = excluded.web_perfil,
       ultima_publicacion = excluded.ultima_publicacion,
       engagement_medio = excluded.engagement_medio,
       frecuencia_semanal = excluded.frecuencia_semanal,
       es_competidor = MAX(perfiles_ig.es_competidor, excluded.es_competidor),
       revisado_en = datetime('now')`,
    [perfil.handle, negocioId, perfil.seguidores, perfil.numPublicaciones, perfil.biografia,
     perfil.webPerfil, stats.ultimaPublicacion, stats.engagementMedio, stats.frecuenciaSemanal,
     aEntero(esCompetidor)],
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

export async function recalcularLeads(): Promise<number> {
  const cfg = getConfig();
  const filas = await query<any>(
    `SELECT n.id, n.sector, n.telefono, n.tiene_horario, n.es_cadena,
            a.tiene_web, a.accesible, a.problemas, a.plantilla_barata, a.anio_copyright,
            p.seguidores AS ig_seguidores, p.ultima_publicacion AS ig_ultima,
            p.engagement_medio AS ig_engagement
       FROM negocios n
       JOIN auditorias_web a ON a.negocio_id = n.id
       LEFT JOIN perfiles_ig p ON p.negocio_id = n.id`,
  );

  for (const f of filas) {
    let problemas: string[] = [];
    try { problemas = JSON.parse(f.problemas ?? '[]'); } catch { problemas = []; }

    const { score, motivos } = puntuar(
      {
        sector: f.sector,
        tieneWeb: Boolean(f.tiene_web),
        accesible: f.accesible === null ? null : Boolean(f.accesible),
        problemas,
        plantillaBarata: f.plantilla_barata === null ? null : Boolean(f.plantilla_barata),
        anioCopyright: f.anio_copyright,
        telefono: f.telefono,
        tieneHorario: Boolean(f.tiene_horario),
        esCadena: Boolean(f.es_cadena),
        igSeguidores: f.ig_seguidores,
        igUltimaPublicacion: f.ig_ultima,
        igEngagement: f.ig_engagement,
      },
      cfg,
    );

    await run(
      `INSERT INTO leads (negocio_id, score, motivos, calculado_en)
       VALUES (?,?,?, datetime('now'))
       ON CONFLICT(negocio_id) DO UPDATE SET
         score = excluded.score, motivos = excluded.motivos, calculado_en = datetime('now')`,
      [f.id, score, JSON.stringify(motivos)],
    );
  }
  return filas.length;
}

export async function generarTareasDeHoy(): Promise<number> {
  const cfg = getConfig();

  const yaHay = await queryOne<{ n: number }>(
    `SELECT count(*) AS n FROM tareas_diarias WHERE fecha = date('now')`,
  );
  if ((yaHay?.n ?? 0) > 0) return 0;

  const candidatos = await query<any>(
    `SELECT n.id, n.nombre, n.sector, n.telefono, n.osm_url,
            l.score, l.motivos,
            COALESCE(n.instagram_tag, a.instagram_handle) AS handle,
            p.seguidores,
            (SELECT permalink FROM publicaciones pub
              WHERE pub.handle = p.handle ORDER BY pub.publicada_en DESC LIMIT 1) AS ultimo_post
       FROM leads l
       JOIN negocios n ON n.id = l.negocio_id
       LEFT JOIN auditorias_web a ON a.negocio_id = n.id
       LEFT JOIN perfiles_ig p ON p.negocio_id = n.id
      WHERE l.estado = 'nuevo'
        AND NOT EXISTS (SELECT 1 FROM tareas_diarias t WHERE t.negocio_id = n.id)
      ORDER BY l.score DESC, n.nombre
      LIMIT ?`,
    [cfg.umbrales.leadsPorDia],
  );

  let creadas = 0, comentarios = 0, seguimientos = 0;

  for (const c of candidatos) {
    let motivos: string[] = [];
    try { motivos = JSON.parse(c.motivos ?? '[]'); } catch { motivos = []; }

    const nombreSector = SECTORES[c.sector]?.nombre ?? c.sector ?? 'sin sector';
    const contexto = [`${c.nombre} (${nombreSector})`, ...motivos].join(' · ');

    if (c.handle && c.ultimo_post && comentarios < cfg.limitesDiarios.comentarios) {
      await crearTarea('comentar', c.id, c.handle, c.ultimo_post, contexto);
      comentarios++; creadas++;
    } else if (c.handle && seguimientos < cfg.limitesDiarios.seguimientos) {
      await crearTarea('seguir', c.id, c.handle, `https://instagram.com/${c.handle}`, contexto);
      seguimientos++; creadas++;
    } else if (!c.handle) {
      const extra = c.telefono ? ` · Teléfono: ${c.telefono}` : '';
      await crearTarea('revisar', c.id, null, c.osm_url,
        `${contexto} · Sin Instagram localizado: búscalo a mano o llama${extra}`);
      creadas++;
    }

    if (comentarios >= cfg.limitesDiarios.comentarios && seguimientos >= cfg.limitesDiarios.seguimientos) break;
  }

  return creadas;
}

async function crearTarea(
  tipo: string, negocioId: string | null, handle: string | null,
  enlace: string | null, contexto: string,
) {
  await run(
    `INSERT INTO tareas_diarias (fecha, tipo, negocio_id, handle, enlace, contexto)
     VALUES (date('now'), ?, ?, ?, ?, ?)`,
    [tipo, negocioId, handle, enlace, contexto],
  );
}
