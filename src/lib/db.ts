import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

declare global {
  // eslint-disable-next-line no-var
  var _igSearchDb: Database.Database | undefined;
}

/**
 * Ruta del fichero de base de datos.
 * Se puede mover fuera de la carpeta de despliegue con DATABASE_FILE
 * para que no se pierda al actualizar la aplicacion.
 */
export function rutaBaseDatos(): string {
  return process.env.DATABASE_FILE || path.join(process.cwd(), 'data', 'igsearch.db');
}

export function baseDatosExiste(): boolean {
  // Ruta dinamica a proposito: la decide DATABASE_FILE en produccion
  return fs.existsSync(/*turbopackIgnore: true*/ rutaBaseDatos());
}

export function getDb(): Database.Database {
  if (!global._igSearchDb) {
    const ruta = rutaBaseDatos();
    fs.mkdirSync(path.dirname(ruta), { recursive: true });
    const db = new Database(ruta);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.pragma('busy_timeout = 5000');
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
  const stmt = getDb().prepare(sql);
  return (stmt.reader ? stmt.all(...params) : (stmt.run(...params), [])) as T[];
}

export async function queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  const filas = await query<T>(sql, params);
  return filas[0] ?? null;
}

/** Ejecuta una sentencia de escritura y devuelve cuantas filas cambiaron. */
export async function run(sql: string, params: any[] = []): Promise<{ cambios: number; id: number | bigint }> {
  const r = getDb().prepare(sql).run(...params);
  return { cambios: r.changes, id: r.lastInsertRowid };
}

/** Convierte los enteros 0/1 de SQLite en booleanos de JavaScript. */
export function bool(valor: unknown): boolean | null {
  if (valor === null || valor === undefined) return null;
  return Boolean(valor);
}

/** Convierte booleanos de JavaScript en los enteros que espera SQLite. */
export function aEntero(valor: boolean | null | undefined): number | null {
  if (valor === null || valor === undefined) return null;
  return valor ? 1 : 0;
}
