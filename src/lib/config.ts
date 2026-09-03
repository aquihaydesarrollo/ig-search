import fs from 'node:fs';
import path from 'node:path';
import configIncrustada from '../../config/radar.json';

export interface RadarConfig {
  ciudad: string;
  region: string;
  radioKm: number;
  coordenadas: { lat: number | null; lng: number | null };
  sectores: string[];
  sectoresPrioritarios: string[];
  competidores: string[];
  limitesDiarios: { comentarios: number; likes: number; seguimientos: number };
  scoring: Record<string, number>;
  umbrales: {
    diasIgAbandonado: number;
    engagementBajo: number;
    seguidoresNegocioActivo: number;
    leadsPorDia: number;
    maxWebsPorBarrido: number;
  };
}

let cache: RadarConfig | null = null;

/**
 * Configuracion del radar.
 *
 * Se incrusta la del repositorio para que no pueda faltar en el despliegue,
 * y se permite sobrescribirla con un config/radar.json en el servidor por si
 * hace falta ajustar la ciudad o los sectores sin volver a compilar.
 */
export function getConfig(): RadarConfig {
  if (cache) return cache;

  try {
    const enDisco = path.join(process.cwd(), 'config', 'radar.json');
    if (fs.existsSync(enDisco)) {
      cache = JSON.parse(fs.readFileSync(enDisco, 'utf8')) as RadarConfig;
      return cache;
    }
  } catch {
    // fichero ilegible o JSON invalido: se usa la configuracion incrustada
  }

  cache = configIncrustada as RadarConfig;
  return cache;
}
