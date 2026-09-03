import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
// El paquete es CommonJS: la importacion por defecto funciona tanto en
// el empaquetado de Next como al ejecutar los scripts con node a secas.
import sqlite3 from 'node-sqlite3-wasm';

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

export function getDb(): Database {
  if (!global._igSearchDb) {
    const ruta = rutaBaseDatos();
    fs.mkdirSync(path.dirname(ruta), { recursive: true });
    const db = new Database(ruta);
    db.run('PRAGMA foreign_keys = ON');
    db.run('PRAGMA busy_timeout = 5000');
    global._igSearchDb = db;

    // La aplicacion se crea su propia base de datos la primera vez.
    // Asi no hace falta acceso por consola al servidor, que en muchos
    // alojamientos compartidos no existe.
    const sql = fs.readFileSync(path.join(process.cwd(), 'db', 'schema.sql'), 'utf8');
    db.exec(sql);
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
