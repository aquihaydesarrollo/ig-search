#!/usr/bin/env node
/** Crea el esquema de base de datos. Idempotente: se puede ejecutar las veces que haga falta. */
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const envFile = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envFile)) {
  for (const linea of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = linea.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

if (!process.env.DATABASE_URL) {
  console.error('ERROR: falta DATABASE_URL. Copia .env.example a .env.local y rellena los valores.');
  process.exit(1);
}

const sql = fs.readFileSync(path.join(process.cwd(), 'db', 'schema.sql'), 'utf8');
const cliente = new pg.Client({ connectionString: process.env.DATABASE_URL });

await cliente.connect();
await cliente.query(sql);
await cliente.end();

console.log('Base de datos lista.');
