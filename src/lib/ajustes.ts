import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * Ajustes de la aplicacion.
 *
 * Se leen primero de las variables de entorno y, si no estan, de un fichero
 * ~/.ig-search/ajustes.json. El fichero existe porque no todos los planes de
 * alojamiento dejan definir variables de entorno, y ademas sobrevive a los
 * despliegues: se puede editar con el administrador de archivos.
 *
 *   {
 *     "PANEL_PASSWORD": "...",
 *     "RADAR_CRON_SECRET": "...",
 *     "META_ACCESS_TOKEN": "...",
 *     "META_IG_USER_ID": "..."
 *   }
 */

const CLAVES = [
  'PANEL_PASSWORD',
  'RADAR_CRON_SECRET',
  'META_ACCESS_TOKEN',
  'META_IG_USER_ID',
  'META_APP_ID',
  'META_APP_SECRET',
  'META_API_VERSION',
] as const;

export type Clave = (typeof CLAVES)[number];

export function rutaAjustes(): string {
  return process.env.AJUSTES_FILE || path.join(os.homedir(), '.ig-search', 'ajustes.json');
}

let cache: Record<string, string> | null = null;
let leidoEn = 0;

function leerFichero(): Record<string, string> {
  // Relee como mucho una vez por minuto: permite cambiar el fichero sin reiniciar
  if (cache && Date.now() - leidoEn < 60_000) return cache;

  try {
    const bruto = fs.readFileSync(rutaAjustes(), 'utf8');
    const datos = JSON.parse(bruto);
    cache = {};
    for (const clave of CLAVES) {
      const valor = datos?.[clave];
      if (typeof valor === 'string' && valor.trim()) cache[clave] = valor.trim();
    }
  } catch {
    cache = {};
  }

  leidoEn = Date.now();
  return cache;
}

/** Valor de un ajuste: primero el entorno, luego el fichero. */
export function ajuste(clave: Clave): string | undefined {
  const delEntorno = process.env[clave];
  if (delEntorno && delEntorno.trim()) return delEntorno.trim();
  return leerFichero()[clave];
}

/** Vuelca los ajustes del fichero en process.env, sin pisar lo que ya haya. */
export function cargarAjustes(): void {
  const datos = leerFichero();
  for (const [clave, valor] of Object.entries(datos)) {
    if (!process.env[clave]) process.env[clave] = valor;
  }
}
