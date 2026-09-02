import type { RadarConfig } from './config.ts';

export interface EntradaScoring {
  sector: string | null;
  tieneWeb: boolean;
  accesible: boolean | null;
  problemas: string[];
  plantillaBarata: boolean | null;
  anioCopyright: number | null;
  telefono: string | null;
  tieneHorario: boolean;
  esCadena: boolean;
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
 * Cuanto mas alto, mas facil es venderle diseno web o gestion de redes.
 *
 * Sin las resenas de Google, la senal de "negocio que funciona" sale del
 * telefono, el horario publicado y sobre todo de sus seguidores en Instagram.
 */
export function puntuar(e: EntradaScoring, cfg: RadarConfig): ResultadoScoring {
  const p = cfg.scoring;
  const u = cfg.umbrales;
  const motivos: string[] = [];
  let score = 0;

  // Negocio activo de verdad: tiene telefono y horario publicados, o presencia en IG
  const negocioActivo =
    (Boolean(e.telefono) && e.tieneHorario) || (e.igSeguidores ?? 0) >= u.seguidoresNegocioActivo;

  // --- Senales de la web -------------------------------------------------
  if (!e.tieneWeb) {
    score += p.sinWeb;
    motivos.push('No tiene web');
  } else if (e.accesible === false) {
    score += p.webRota;
    motivos.push('La web no carga o da error');
  } else {
    // Cada problema detectado suma, con tope para que no se dispare
    const suma = Math.min(e.problemas.length * p.porProblemaWeb, p.topeProblemasWeb);
    if (suma > 0) {
      score += suma;
      for (const problema of e.problemas.slice(0, 4)) motivos.push(problema);
      if (e.problemas.length > 4) motivos.push(`y ${e.problemas.length - 4} fallos mas en la web`);
    }
    if (e.plantillaBarata) {
      score += p.plantillaBarata;
      if (!motivos.some((m) => m.startsWith('Hecha con'))) motivos.push('Web de plantilla generica');
    }
  }

  // --- Senales de Instagram ---------------------------------------------
  if (e.igUltimaPublicacion) {
    const dias = Math.floor((Date.now() - new Date(e.igUltimaPublicacion).getTime()) / 86_400_000);
    if (dias > u.diasIgAbandonado) {
      score += p.igAbandonado;
      motivos.push(`Instagram parado hace ${dias} dias`);
    } else if (e.igEngagement != null && e.igEngagement < u.engagementBajo && (e.igSeguidores ?? 0) > 300) {
      score += p.engagementBajo;
      motivos.push(`Publica pero casi no le interactuan (${e.igEngagement}% de engagement)`);
    }
  }

  if ((e.igSeguidores ?? 0) >= u.seguidoresNegocioActivo && (!e.tieneWeb || e.accesible === false)) {
    score += p.audienciaSinWeb;
    motivos.push(`${e.igSeguidores} seguidores en Instagram y ninguna web donde mandarlos`);
  }

  // --- Senales del negocio ----------------------------------------------
  if (negocioActivo) {
    score += p.negocioActivo;
    motivos.push('Negocio en activo (datos de contacto y horario al dia)');
  }

  if (e.esCadena) {
    score += p.esCadena;
    motivos.push('Parece cadena o franquicia: probablemente decide otro');
  }

  if (e.sector && cfg.sectoresPrioritarios.includes(e.sector)) {
    score += p.sectorPrioritario;
    motivos.push('Sector prioritario');
  }

  return { score: Math.max(score, 0), motivos };
}
