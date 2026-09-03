import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
// El paquete es CommonJS: la importacion por defecto funciona tanto en
// el empaquetado de Next como al ejecutar los scripts con node a secas.
import sqlite3 from 'node-sqlite3-wasm';
import { ESQUEMA_SQL } from './esquema.ts';

const { Database } = sqlite3;
type Database = InstanceType<typeof Database>;

/**
 * SQLite compilado a WebAssembly.
 *
 * Se eligio frente a better-sqlite3 porque este ultimo es un modulo nativo
 * que hay que compilar con node-gyp, y muchos alojamientos compartidos
 * (Hostinger entre ellos) no traen Python, asi que la instalacion falla.
 * Esta version no compila nada y escribe el mismo fichero .db de siempre.
 */

declare global {
  // eslint-disable-next-line no-var
  var _igSearchDb: Database | undefined;
}

/**
 * Ruta del fichero de base de datos.
 *
 * Por defecto va a la carpeta personal del usuario, NO a la del proyecto.
 * Muchos alojamientos (Hostinger entre ellos) despliegan cada version en
 * un directorio nuevo, asi que cualquier fichero dentro del proyecto se
 * pierde en la siguiente actualizacion. La carpeta personal sobrevive.
 *
 * DATABASE_FILE permite fijar otra ruta si hiciera falta.
 */
/** Ruta de la conexion realmente abierta, una vez resuelta. */
let rutaEnUso: string | null = null;

export function rutasBaseDatos(): string[] {
  if (process.env.DATABASE_FILE) return [process.env.DATABASE_FILE];

  const rutas = [
    // Carpeta visible, la preferida: los administradores de archivos ocultan
    // las que empiezan por punto.
    path.join(os.homedir(), 'ig-search', 'igsearch.db'),
    // Ubicacion antigua, por si ya hay datos ahi
    path.join(os.homedir(), '.ig-search', 'igsearch.db'),
    // Ultimo recurso: junto a la aplicacion. Se pierde al desplegar, pero
    // permite arrancar cuando las otras estan bloqueadas o sin permisos.
    path.join(process.cwd(), 'data', 'igsearch.db'),
  ];

  // Si solo existe la antigua, se usa esa para no perder los datos
  try {
    if (!fs.existsSync(/*turbopackIgnore: true*/ rutas[0]) && fs.existsSync(/*turbopackIgnore: true*/ rutas[1])) {
      return [rutas[1], rutas[0], rutas[2]];
    }
  } catch { /* ignorar */ }

  return rutas;
}

/** Ruta en uso: la de la conexion abierta, o la primera candidata. */
export function rutaBaseDatos(): string {
  return rutaEnUso ?? rutasBaseDatos()[0];
}

export function baseDatosExiste(): boolean {
  // Ruta dinamica a proposito: la decide DATABASE_FILE en produccion
  return fs.existsSync(/*turbopackIgnore: true*/ rutaBaseDatos());
}

function abrir(ruta: string): Database {
  const db = new Database(ruta);
  db.run('PRAGMA foreign_keys = ON');
  db.run('PRAGMA busy_timeout = 5000');
  // La aplicacion se crea su propia base de datos la primera vez, sin
  // necesidad de consola en el servidor. CREATE TABLE IF NOT EXISTS, asi que
  // ejecutarlo en cada arranque no altera los datos existentes.
  db.exec(ESQUEMA_SQL);
  return db;
}

/**
 * Aparta un fichero de base de datos ilegible para poder empezar de cero.
 * Si tiene contenido se conserva con otro nombre en lugar de borrarlo: podria
 * contener datos recuperables. Si esta vacio no hay nada que guardar.
 */
function apartarBaseDatosRota(ruta: string): string | null {
  try {
    const tam = fs.statSync(ruta).size;
    if (tam === 0) {
      fs.unlinkSync(ruta);
      return null;
    }
    const destino = `${ruta}.roto`;
    try { fs.rmSync(destino, { force: true }); } catch { /* ignorar */ }
    fs.renameSync(ruta, destino);
    return destino;
  } catch {
    return null;
  }
}

/** Borra los ficheros auxiliares que SQLite deja al lado de la base de datos. */
function limpiarAuxiliares(ruta: string) {
  for (const sufijo of ['-wal', '-shm', '-journal']) {
    try { fs.rmSync(ruta + sufijo, { force: true }); } catch { /* ignorar */ }
  }
}

/** Intenta abrir una ruta concreta, reparandola si hace falta. */
function intentarRuta(ruta: string): Database | null {
  try {
    fs.mkdirSync(/*turbopackIgnore: true*/ path.dirname(ruta), { recursive: true });
  } catch {
    return null; // sin permisos para crear la carpeta
  }

  try {
    return abrir(ruta);
  } catch {
    // Un fichero vacio, corrupto o con un bloqueo olvidado dejaba la
    // aplicacion entera fuera de servicio, con error 500 en todas las paginas.
    limpiarAuxiliares(ruta);
    try {
      return abrir(ruta);
    } catch {
      // Sigue sin abrir: se aparta el fichero y se crea uno nuevo
      apartarBaseDatosRota(ruta);
      limpiarAuxiliares(ruta);
      try {
        return abrir(ruta);
      } catch {
        return null; // esta ruta no sirve, se probara la siguiente
      }
    }
  }
}

export function getDb(): Database {
  if (!global._igSearchDb) {
    const rutas = rutasBaseDatos();
    const fallos: string[] = [];

    for (const ruta of rutas) {
      const db = intentarRuta(ruta);
      if (db) {
        global._igSearchDb = db;
        rutaEnUso = ruta;
        return db;
      }
      fallos.push(ruta);
    }

    throw new Error(
      `No se pudo abrir ninguna base de datos. Rutas probadas: ${fallos.join(', ')}`,
    );
  }
  return global._igSearchDb;
}

/** Ejecuta el esquema. Idempotente. Lo hace ya getDb(); se mantiene para los scripts. */
export function crearEsquema(): void {
  getDb();
}

/** true si el esquema existe y ya se ha guardado algun negocio. */
export function tieneDatos(): boolean {
  try {
    const fila = getDb().get('SELECT count(*) AS n FROM negocios') as { n: number } | undefined;
    return (fila?.n ?? 0) > 0;
  } catch {
    return false;
  }
}

export async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  return getDb().all(sql, params) as T[];
}

export async function queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  return (getDb().get(sql, params) as T | undefined) ?? null;
}

/** Ejecuta una sentencia de escritura y devuelve cuantas filas cambiaron. */
export async function run(sql: string, params: any[] = []): Promise<{ cambios: number; id: number }> {
  const r = getDb().run(sql, params);
  return { cambios: r.changes, id: Number(r.lastInsertRowid) };
}

/** Convierte booleanos de JavaScript en los enteros que espera SQLite. */
export function aEntero(valor: boolean | null | undefined): number | null {
  if (valor === null || valor === undefined) return null;
  return valor ? 1 : 0;
}
