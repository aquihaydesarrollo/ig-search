import fs from 'node:fs';
import path from 'node:path';

/** Carga .env.local en process.env sin dependencias externas. */
export function cargarEntorno() {
  for (const nombre of ['.env.local', '.env']) {
    const fichero = path.join(process.cwd(), nombre);
    if (!fs.existsSync(fichero)) continue;
    for (const linea of fs.readFileSync(fichero, 'utf8').split('\n')) {
      const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && m[2] && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
      }
    }
  }
}
