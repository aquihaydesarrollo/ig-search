#!/usr/bin/env node
/**
 * Convierte el token temporal del Explorador de la API en uno permanente.
 *
 * Necesita en .env.local:
 *   META_APP_ID, META_APP_SECRET  (los da el portal de Meta al crear la app)
 *   META_ACCESS_TOKEN             (el token corto que copias del Explorador)
 *
 * Uso: npm run token
 *
 * El token de pagina que devuelve no caduca mientras no cambies la contrasena
 * de Facebook ni retires los permisos de la app.
 */
import { cargarEntorno } from './_env.mjs';
cargarEntorno();

const VERSION = process.env.META_API_VERSION || 'v23.0';
const { META_APP_ID, META_APP_SECRET, META_ACCESS_TOKEN } = process.env;

if (!META_APP_ID || !META_APP_SECRET || !META_ACCESS_TOKEN) {
  console.error('Faltan variables en .env.local. Necesito:');
  console.error('  META_APP_ID       (portal de Meta > Configuracion de la app)');
  console.error('  META_APP_SECRET   (mismo sitio, boton "Mostrar")');
  console.error('  META_ACCESS_TOKEN (token corto del Explorador de la API)');
  process.exit(1);
}

async function graph(ruta, params) {
  const url = new URL(`https://graph.facebook.com/${VERSION}/${ruta}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data?.error?.message ?? `HTTP ${res.status}`);
  return data;
}

try {
  // 1. Token de usuario de larga duracion (60 dias)
  console.log('1/3  Alargando el token de usuario...');
  const largo = await graph('oauth/access_token', {
    grant_type: 'fb_exchange_token',
    client_id: META_APP_ID,
    client_secret: META_APP_SECRET,
    fb_exchange_token: META_ACCESS_TOKEN,
  });

  // 2. Token de pagina derivado: no caduca
  console.log('2/3  Buscando tus paginas de Facebook...');
  const paginas = await graph('me/accounts', {
    fields: 'id,name,access_token',
    access_token: largo.access_token,
  });

  if (!paginas.data?.length) {
    console.error('\nEse token no da acceso a ninguna pagina de Facebook.');
    console.error('Al generarlo, marca los permisos pages_show_list e instagram_basic.');
    process.exit(1);
  }

  // 3. Localizar la pagina con Instagram vinculado
  console.log('3/3  Localizando la cuenta de Instagram...');
  let elegida = null;
  for (const pagina of paginas.data) {
    const detalle = await graph(pagina.id, {
      fields: 'instagram_business_account{id,username}',
      access_token: pagina.access_token,
    });
    if (detalle.instagram_business_account?.id) {
      elegida = { ...pagina, ig: detalle.instagram_business_account };
      break;
    }
  }

  if (!elegida) {
    console.error('\nNinguna de tus paginas tiene Instagram vinculado.');
    console.error('Paginas encontradas:', paginas.data.map((p) => p.name).join(', '));
    console.error('\nVincula el Instagram a la pagina desde: Configuracion de la pagina > Instagram');
    process.exit(1);
  }

  console.log('\n=========================================================');
  console.log('  Pagina   :', elegida.name);
  console.log('  Instagram: @' + elegida.ig.username);
  console.log('=========================================================\n');
  console.log('Pega estas dos lineas en tu .env.local, sustituyendo las que haya:\n');
  console.log('META_ACCESS_TOKEN=' + elegida.access_token);
  console.log('META_IG_USER_ID=' + elegida.ig.id);
  console.log('\nEse token de pagina no caduca. No lo compartas con nadie.');
} catch (err) {
  console.error('\nError:', err.message);
  console.error('\nSi dice que el token ha caducado, vuelve al Explorador de la API,');
  console.error('genera uno nuevo y actualiza META_ACCESS_TOKEN en .env.local.');
  process.exit(1);
}
