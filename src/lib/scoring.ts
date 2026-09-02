import type { RadarConfig } from './config.ts';

export interface EntradaScoring {
  sector: string | null;
  valoracion: number | null;
  numResenas: number | null;
  tieneWeb: boolean;
  accesible: boolean | null;
  https: boolean | null;
  responsive: boolean | null;
  segundosCarga: number | null;
  puntuacionPsi: number | null;
  igSeguidores: number | null;
  igUltimaPublicacion: string | null;
  igEngagement: number | null;
}

export interface ResultadoScoring {
  score: number;
  motivos: string[];
}

/**
 * Puntua la oportunidad comercial de un negocio.
 * Cuanto mas alto, mas facil es venderle diseno web / redes sociales.
 */
export function puntuar(e: EntradaScoring, cfg: RadarConfig): ResultadoScoring {
  const p = cfg.scoring;
  const u = cfg.umbrales;
  const motivos: string[] = [];
  let score = 0;

  const negocioSerio =
    (e.numResenas ?? 0) >= u.resenasMinimas && (e.valoracion ?? 0) >= u.valoracionMinima;

  // --- Senales de la web -------------------------------------------------
  if (!e.tieneWeb) {
    score += p.sinWeb;
    motivos.push('No tiene web');
  } else if (e.accesible === false) {
    score += p.webRota;
    motivos.push('La web no carga o da error');
  } else {
    if (e.puntuacionPsi != null && e.puntuacionPsi < 50) {
      score += p.webLenta;
      motivos.push(`Web muy lenta en movil (PageSpeed ${e.puntuacionPsi}/100)`);
    } else if (e.segundosCarga != null && e.segundosCarga > u.segundosWebLenta) {
      score += p.webLenta;
      motivos.push(`Web lenta (${e.segundosCarga}s en cargar)`);
    }
    if (e.responsive === false) {
      score += p.webNoResponsive;
      motivos.push('Web sin version movil');
    }
    if (e.https === false) {
      score += p.sinHttps;
      motivos.push('Web sin certificado de seguridad (HTTPS)');
    }
  }

  // --- Senales de Instagram ---------------------------------------------
  if (e.igUltimaPublicacion) {
    const dias = Math.floor((Date.now() - new Date(e.igUltimaPublicacion).getTime()) / 86_400_000);
    if (dias > u.diasIgAbandonado) {
      if (negocioSerio) {
        score += p.buenasResenasIgAbandonado;
        motivos.push(`Buen negocio (${e.valoracion}★) pero Instagram parado hace ${dias} dias`);
      } else {
        score += Math.round(p.buenasResenasIgAbandonado / 2);
        motivos.push(`Instagram parado hace ${dias} dias`);
      }
    } else if (e.igEngagement != null && e.igEngagement < 1 && (e.igSeguidores ?? 0) > 300) {
      score += p.engagementBajo;
      motivos.push(`Publica pero casi no le interactuan (${e.igEngagement}% de engagement)`);
    }
  }

  // --- Senales del negocio ----------------------------------------------
  if (negocioSerio) {
    score += p.muchasResenas;
    motivos.push(`${e.numResenas} resenas con ${e.valoracion}★ en Google`);
  }

  if (e.sector && cfg.sectoresPrioritarios.includes(e.sector)) {
    score += p.sectorPrioritario;
    motivos.push('Sector prioritario');
  }

  return { score, motivos };
}
