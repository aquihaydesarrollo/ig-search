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
export function rutaBaseDatos(): string {
  if (process.env.DATABASE_FILE) return process.env.DATABASE_FILE;

  // Carpeta visible en los administradores de archivos, que suelen ocultar
  // las que empiezan por punto.
  const preferida = path.join(os.homedir(), 'ig-search', 'igsearch.db');
  const antigua = path.join(os.homedir(), '.ig-search', 'igsearch.db');

  // Si ya hay una base de datos en la ubicacion antigua, se sigue usando
  try { if (fs.existsSync(antigua) && !fs.existsSync(preferida)) return antigua; } catch { /* ignorar */ }
  return preferida;
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

export function getDb(): Database {
  if (!global._igSearchDb) {
    const ruta = rutaBaseDatos();
    fs.mkdirSync(path.dirname(ruta), { recursive: true });

    try {
      global._igSearchDb = abrir(ruta);
    } catch (err) {
      // Un fichero vacio o corrupto dejaba la aplicacion entera fuera de
      // servicio: cada pagina devolvia un error 500 sin explicacion. Se aparta
      // y se crea una base de datos nueva.
      apartarBaseDatosRota(ruta);
      // Los ficheros auxiliares de SQLite tambien pueden estar corruptos
      for (const sufijo of ['-wal', '-shm', '-journal']) {
        try { fs.rmSync(ruta + sufijo, { force: true }); } catch { /* ignorar */ }
      }
      global._igSearchDb = abrir(ruta);
    }
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
