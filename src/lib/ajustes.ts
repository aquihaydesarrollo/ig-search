import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * Ajustes de la aplicacion.
 *
 * Se leen primero de las variables de entorno y, si no estan, de un fichero
 * ajustes.json. El fichero existe porque no todos los planes de alojamiento
 * dejan definir variables de entorno.
 *
 * Se buscan varias ubicaciones porque los administradores de archivos de los
 * alojamientos no siempre permiten subir por encima de public_html ni muestran
 * las carpetas que empiezan por punto.
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

/** Ubicaciones donde se busca ajustes.json, en orden de preferencia. */
export function rutasCandidatas(): string[] {
  const rutas: string[] = [];
  if (process.env.AJUSTES_FILE) rutas.push(process.env.AJUSTES_FILE);
  rutas.push(path.join(os.homedir(), 'ig-search', 'ajustes.json'));   // visible y persistente
  rutas.push(path.join(os.homedir(), '.ig-search', 'ajustes.json'));  // ubicacion antigua
  rutas.push(path.join(process.cwd(), 'ajustes.json'));               // junto a la aplicacion
  return rutas;
}

/** Ruta del fichero encontrado, o la recomendada si todavia no existe ninguno. */
export function rutaAjustes(): string {
  const rutas = rutasCandidatas();
  for (const ruta of rutas) {
    try { if (fs.existsSync(ruta)) return ruta; } catch { /* ignorar */ }
  }
  return rutas[0];
}

export function ajustesExisten(): boolean {
  return rutasCandidatas().some((ruta) => {
    try { return fs.existsSync(ruta); } catch { return false; }
  });
}

let cache: Record<string, string> | null = null;
let leidoEn = 0;

function leerFichero(): Record<string, string> {
  // Relee como mucho una vez por minuto: permite cambiar el fichero sin reiniciar
  if (cache && Date.now() - leidoEn < 60_000) return cache;

  const encontrados: Record<string, string> = {};
  for (const ruta of rutasCandidatas()) {
    try {
      const datos = JSON.parse(fs.readFileSync(ruta, 'utf8'));
      for (const clave of CLAVES) {
        const valor = datos?.[clave];
        // El primer fichero que define una clave manda
        if (typeof valor === 'string' && valor.trim() && !encontrados[clave]) {
          encontrados[clave] = valor.trim();
        }
      }
    } catch {
      // fichero inexistente o JSON invalido: se pasa al siguiente
    }
  }

  cache = encontrados;
  leidoEn = Date.now();
  return cache;
}

/** Valor de un ajuste: primero el entorno, luego el fichero. */
export function ajuste(clave: Clave): string | undefined {
  const delEntorno = process.env[clave];
  if (delEntorno && delEntorno.trim()) return delEntorno.trim();
  return leerFichero()[clave];
}
