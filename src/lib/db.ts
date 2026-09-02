import { Pool } from 'pg';

declare global {
  // eslint-disable-next-line no-var
  var _igSearchPool: Pool | undefined;
}

export function getPool(): Pool {
  if (!global._igSearchPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('Falta DATABASE_URL en el entorno');
    global._igSearchPool = new Pool({
      connectionString,
      ssl: connectionString.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
      max: 5,
    });
  }
  return global._igSearchPool;
}

export async function query<T = any>(text: string, params: any[] = []): Promise<T[]> {
  const res = await getPool().query(text, params);
  return res.rows as T[];
}

export async function queryOne<T = any>(text: string, params: any[] = []): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}
