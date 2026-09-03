import fs from 'node:fs';
import path from 'node:path';
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
 * En produccion conviene situarlo fuera de la carpeta de despliegue
 * con DATABASE_FILE para que no se pierda al actualizar la aplicacion.
 */
export function rutaBaseDatos(): string {
  return process.env.DATABASE_FILE || path.join(process.cwd(), 'data', 'igsearch.db');
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
  }
  return global._igSearchDb;
}

/** Ejecuta el esquema. Idempotente. */
export function crearEsquema(): void {
  const sql = fs.readFileSync(path.join(process.cwd(), 'db', 'schema.sql'), 'utf8');
  getDb().exec(sql);
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
