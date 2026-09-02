/**
 * Auditoria de la web del negocio.
 * Paso 1 (barato): peticion HTTP directa -> estado, HTTPS, responsive, tiempo, handle de Instagram.
 * Paso 2 (caro, opcional): PageSpeed Insights para los leads mejor puntuados.
 */

export interface AuditoriaWeb {
  tieneWeb: boolean;
  accesible: boolean | null;
  codigoHttp: number | null;
  https: boolean | null;
  responsive: boolean | null;
  segundosCarga: number | null;
  puntuacionPsi: number | null;
  titulo: string | null;
  instagramHandle: string | null;
  notas: string | null;
}

const VACIA: AuditoriaWeb = {
  tieneWeb: false,
  accesible: null,
  codigoHttp: null,
  https: null,
  responsive: null,
  segundosCarga: null,
  puntuacionPsi: null,
  titulo: null,
  instagramHandle: null,
  notas: null,
};

const HANDLES_IGNORADOS = new Set([
  'p', 'reel', 'reels', 'explore', 'stories', 'tv', 'accounts', 'about',
  'developer', 'legal', 'directory', 'instagram',
]);

export function extraerHandleInstagram(html: string): string | null {
  const re = /instagram\.com\/(?:#!\/)?([A-Za-z0-9_.]{2,30})/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const handle = m[1].replace(/\.$/, '').toLowerCase();
    if (!HANDLES_IGNORADOS.has(handle)) return handle;
  }
  return null;
}

export async function auditarWeb(url: string | null): Promise<AuditoriaWeb> {
  if (!url) return { ...VACIA };

  const resultado: AuditoriaWeb = { ...VACIA, tieneWeb: true };
  resultado.https = url.startsWith('https://');

  const inicio = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; IgSearchBot/1.0; +https://aquihaymarketing.es)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    resultado.segundosCarga = Number(((Date.now() - inicio) / 1000).toFixed(2));
    resultado.codigoHttp = res.status;
    resultado.accesible = res.ok;
    resultado.https = res.url.startsWith('https://');

    if (res.ok) {
      const html = (await res.text()).slice(0, 400_000);
      resultado.responsive = /<meta[^>]+name=["']viewport["']/i.test(html);
      resultado.titulo = html.match(/<title[^>]*>([^<]{1,200})<\/title>/i)?.[1]?.trim() ?? null;
      resultado.instagramHandle = extraerHandleInstagram(html);
    }
  } catch (err: any) {
    resultado.accesible = false;
    resultado.segundosCarga = Number(((Date.now() - inicio) / 1000).toFixed(2));
    resultado.notas = err?.name === 'AbortError' ? 'Tiempo de espera agotado (>15s)' : String(err?.message ?? err).slice(0, 200);
  } finally {
    clearTimeout(timeout);
  }

  return resultado;
}

/** PageSpeed Insights (movil). Lento: ~15-30s por URL. Usar solo en los mejores leads. */
export async function puntuacionPageSpeed(url: string): Promise<number | null> {
  const apiKey = process.env.GOOGLE_PAGESPEED_API_KEY;
  if (!apiKey) return null;

  const endpoint = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
  endpoint.searchParams.set('url', url);
  endpoint.searchParams.set('strategy', 'mobile');
  endpoint.searchParams.set('category', 'performance');
  endpoint.searchParams.set('key', apiKey);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);
    const res = await fetch(endpoint, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = await res.json();
    const score = data?.lighthouseResult?.categories?.performance?.score;
    return typeof score === 'number' ? Math.round(score * 100) : null;
  } catch {
    return null;
  }
}
