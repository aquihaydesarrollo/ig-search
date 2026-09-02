#!/usr/bin/env node
/**
 * Ejecuta el radar desde la linea de comandos.
 *   npm run radar             -> barrido completo
 *   npm run radar -- --whoami -> muestra la cuenta de Instagram vinculada al token
 */
import { cargarEntorno } from './_env.mjs';
cargarEntorno();

const args = process.argv.slice(2);

if (args.includes('--whoami')) {
  const { descubrirCuenta } = await import('../src/lib/meta.ts');
  const cuenta = await descubrirCuenta();
  if (!cuenta) {
    console.error('No se encontro ninguna cuenta de Instagram Business vinculada a este token.');
    console.error('Comprueba que la cuenta es profesional y esta unida a una pagina de Facebook.');
    process.exit(1);
  }
  console.log('Pagina de Facebook :', cuenta.pageName, `(${cuenta.pageId})`);
  console.log('Instagram          : @' + cuenta.igUsername);
  console.log('META_IG_USER_ID    :', cuenta.igUserId);
  console.log('\nCopia ese META_IG_USER_ID en tu .env.local');
  process.exit(0);
}

const { crearEsquema } = await import('../src/lib/db.ts');
crearEsquema();

const { ejecutarRadar } = await import('../src/lib/radar.ts');
const inicio = Date.now();
const resumen = await ejecutarRadar();
const minutos = ((Date.now() - inicio) / 60000).toFixed(1);

console.log('\n--- Radar completado en ' + minutos + ' min ---');
console.log('Negocios nuevos   :', resumen.negociosNuevos);
console.log('Webs auditadas    :', resumen.websAuditadas);
console.log('Perfiles de IG    :', resumen.perfilesIg);
console.log('Tareas generadas  :', resumen.tareasGeneradas);
if (resumen.avisos.length) {
  console.log('\nAvisos:');
  for (const a of resumen.avisos) console.log(' -', a);
}
process.exit(0);
