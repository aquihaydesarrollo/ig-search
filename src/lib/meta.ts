/**
 * Instagram Graph API (oficial de Meta).
 *
 * Lo que SI permite y usamos aqui:
 *   - Metricas propias de la cuenta (insights)
 *   - Business Discovery: datos publicos de otras cuentas de empresa por usuario
 *   - Lectura y respuesta de comentarios, publicacion de contenido (fases posteriores)
 *
 * Lo que NO permite y por tanto no se intenta:
 *   - Dar "me gusta", seguir o dejar de seguir cuentas
 *   - Listar los seguidores o comentaristas de una cuenta ajena
 */

import { ajuste } from './ajustes.ts';

const BASE = 'https://graph.facebook.com';

function apiVersion() {
  return ajuste('META_API_VERSION') || 'v23.0';
}

function token() {
  const t = ajuste('META_ACCESS_TOKEN');
  if (!t) throw new Error('Falta META_ACCESS_TOKEN');
  return t;
}

async function graph<T = any>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${BASE}/${apiVersion()}/${path.replace(/^\//, '')}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('access_token', token());

  const res = await fetch(url, { cache: 'no-store' });
  const data = await res.json();
  if (!res.ok || data.error) {
    const msg = data?.error?.message ?? `HTTP ${res.status}`;
    throw new Error(`Meta API: ${msg}`);
  }
  return data as T;
}

/** Localiza la cuenta de Instagram Business vinculada al token. */
export async function descubrirCuenta(): Promise<{ pageId: string; pageName: string; igUserId: string; igUsername: string } | null> {
  const paginas = await graph<{ data: Array<{ id: string; name: string }> }>('me/accounts', {
    fields: 'id,name',
  });

  for (const pagina of paginas.data ?? []) {
    const detalle = await graph<any>(pagina.id, { fields: 'instagram_business_account{id,username}' });
    const ig = detalle.instagram_business_account;
    if (ig?.id) {
      return { pageId: pagina.id, pageName: pagina.name, igUserId: ig.id, igUsername: ig.username };
    }
  }
  return null;
}

function igUserId() {
  const id = ajuste('META_IG_USER_ID');
  if (!id) throw new Error('Falta META_IG_USER_ID (ejecuta: npm run radar -- --whoami)');
  return id;
}

export interface MetricasPropias {
  seguidores: number | null;
  alcance: number | null;
  visitasPerfil: number | null;
  clicsWeb: number | null;
  interacciones: number | null;
}

/** Metricas del dia de la cuenta propia. Tolera metricas retiradas por Meta. */
export async function metricasPropias(): Promise<MetricasPropias> {
  const perfil = await graph<any>(igUserId(), { fields: 'followers_count,media_count,username' });

  const salida: MetricasPropias = {
    seguidores: perfil.followers_count ?? null,
    alcance: null,
    visitasPerfil: null,
    clicsWeb: null,
    interacciones: null,
  };

  // Metricas de serie temporal
  try {
    const serie = await graph<any>(`${igUserId()}/insights`, {
      metric: 'reach',
      period: 'day',
    });
    salida.alcance = serie.data?.[0]?.values?.at(-1)?.value ?? null;
  } catch { /* metrica no disponible para esta cuenta */ }

  // Metricas de valor total
  for (const [metrica, campo] of [
    ['profile_views', 'visitasPerfil'],
    ['website_clicks', 'clicsWeb'],
    ['total_interactions', 'interacciones'],
  ] as const) {
    try {
      const r = await graph<any>(`${igUserId()}/insights`, {
        metric: metrica,
        period: 'day',
        metric_type: 'total_value',
      });
      (salida as any)[campo] = r.data?.[0]?.total_value?.value ?? null;
    } catch { /* metrica no disponible */ }
  }

  return salida;
}

export interface PerfilPublico {
  handle: string;
  seguidores: number | null;
  numPublicaciones: number | null;
  biografia: string | null;
  webPerfil: string | null;
  publicaciones: Array<{
    id: string;
    tipo: string | null;
    texto: string | null;
    permalink: string | null;
    likes: number | null;
    comentarios: number | null;
    publicadaEn: string | null;
  }>;
}

/**
 * Business Discovery: datos publicos de una cuenta de empresa/creador ajena.
 * Devuelve null si la cuenta no existe, es privada o no es profesional.
 */
export async function perfilPublico(handle: string, limitePublicaciones = 12): Promise<PerfilPublico | null> {
  const limpio = handle.replace(/^@/, '').trim();
  const campos =
    `business_discovery.username(${limpio}){followers_count,media_count,biography,website,` +
    `media.limit(${limitePublicaciones}){id,caption,media_type,permalink,like_count,comments_count,timestamp}}`;

  try {
    const data = await graph<any>(igUserId(), { fields: campos });
    const bd = data.business_discovery;
    if (!bd) return null;

    return {
      handle: limpio,
      seguidores: bd.followers_count ?? null,
      numPublicaciones: bd.media_count ?? null,
      biografia: bd.biography ?? null,
      webPerfil: bd.website ?? null,
      publicaciones: (bd.media?.data ?? []).map((m: any) => ({
        id: m.id,
        tipo: m.media_type ?? null,
        texto: m.caption ?? null,
        permalink: m.permalink ?? null,
        likes: m.like_count ?? null,
        comentarios: m.comments_count ?? null,
        publicadaEn: m.timestamp ?? null,
      })),
    };
  } catch {
    return null;
  }
}

/** Engagement medio y ritmo de publicacion a partir de las publicaciones recientes. */
export function estadisticasPerfil(perfil: PerfilPublico) {
  const posts = perfil.publicaciones.filter((p) => p.publicadaEn);
  if (posts.length === 0) {
    return { engagementMedio: null, frecuenciaSemanal: null, ultimaPublicacion: null };
  }

  const fechas = posts.map((p) => new Date(p.publicadaEn!).getTime()).sort((a, b) => b - a);
  const ultimaPublicacion = new Date(fechas[0]).toISOString();

  const interacciones = posts.reduce((acc, p) => acc + (p.likes ?? 0) + (p.comentarios ?? 0), 0);
  const engagementMedio =
    perfil.seguidores && perfil.seguidores > 0
      ? Number((interacciones / posts.length / perfil.seguidores * 100).toFixed(3))
      : null;

  const semanas = Math.max((fechas[0] - fechas[fechas.length - 1]) / (1000 * 60 * 60 * 24 * 7), 0.5);
  const frecuenciaSemanal = Number((posts.length / semanas).toFixed(2));

  return { engagementMedio, frecuenciaSemanal, ultimaPublicacion };
}


/**
 * Convierte el token temporal del Explorador de la API en uno permanente.
 *
 * El token que da el Explorador dura una o dos horas. Se cambia por uno de
 * usuario de larga duracion y, a partir de ese, por el token de la pagina de
 * Facebook, que no caduca mientras no se cambie la contrasena ni se retiren
 * los permisos de la aplicacion.
 */
export interface TokenPermanente {
  tokenPagina: string;
  igUserId: string;
  igUsername: string;
  paginaNombre: string;
}

export async function obtenerTokenPermanente(
  appId: string,
  appSecret: string,
  tokenCorto: string,
): Promise<TokenPermanente> {
  const version = process.env.META_API_VERSION || 'v23.0';

  async function llamar(ruta: string, params: Record<string, string>) {
    const url = new URL(`${BASE}/${version}/${ruta}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const res = await fetch(url, { cache: 'no-store' });
    const datos = await res.json();
    if (!res.ok || datos.error) throw new Error(datos?.error?.message ?? `HTTP ${res.status}`);
    return datos;
  }

  // 1. Token de usuario de larga duracion
  const largo = await llamar('oauth/access_token', {
    grant_type: 'fb_exchange_token',
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: tokenCorto,
  });

  // 2. Paginas de Facebook accesibles con ese token
  const paginas = await llamar('me/accounts', {
    fields: 'id,name,access_token',
    access_token: largo.access_token,
  });

  if (!paginas.data?.length) {
    throw new Error(
      'El token no da acceso a ninguna página de Facebook. ' +
      'Al generarlo marca los permisos pages_show_list e instagram_basic.',
    );
  }

  // 3. Pagina que tenga Instagram vinculado
  for (const pagina of paginas.data) {
    const detalle = await llamar(pagina.id, {
      fields: 'instagram_business_account{id,username}',
      access_token: pagina.access_token,
    });
    const ig = detalle.instagram_business_account;
    if (ig?.id) {
      return {
        tokenPagina: pagina.access_token,
        igUserId: ig.id,
        igUsername: ig.username,
        paginaNombre: pagina.name,
      };
    }
  }

  const nombres = paginas.data.map((p: any) => p.name).join(', ');
  throw new Error(
    `Ninguna de tus páginas tiene Instagram vinculado. Páginas encontradas: ${nombres}. ` +
    'Vincúlalo desde la configuración de la página de Facebook.',
  );
}
