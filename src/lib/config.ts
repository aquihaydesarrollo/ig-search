import fs from 'node:fs';
import path from 'node:path';

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

export function getConfig(): RadarConfig {
  if (cache) return cache;
  const file = path.join(process.cwd(), 'config', 'radar.json');
  cache = JSON.parse(fs.readFileSync(file, 'utf8')) as RadarConfig;
  return cache;
}
