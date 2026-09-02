/**
 * Auditoria de la web del negocio. Analisis propio, sin servicios externos.
 * Sustituye a PageSpeed Insights para no depender de Google.
 */

export interface AuditoriaWeb {
  tieneWeb: boolean;
  accesible: boolean | null;
  codigoHttp: number | null;
  https: boolean | null;
  responsive: boolean | null;
  segundosCarga: number | null;
  pesoKb: number | null;
  tecnologia: string | null;
  plantillaBarata: boolean | null;
  anioCopyright: number | null;
  titulo: string | null;
  instagramHandle: string | null;
  problemas: string[];
  notas: string | null;
}

const VACIA: AuditoriaWeb = {
  tieneWeb: false, accesible: null, codigoHttp: null, https: null, responsive: null,
  segundosCarga: null, pesoKb: null, tecnologia: null, plantillaBarata: null,
  anioCopyright: null, titulo: null, instagramHandle: null, problemas: [], notas: null,
};

const HANDLES_IGNORADOS = new Set([
  'p', 'reel', 'reels', 'explore', 'stories', 'tv', 'accounts', 'about',
  'developer', 'legal', 'directory', 'instagram',
]);

/** Creadores de webs de plantilla: senal de que el negocio se la hizo el mismo. */
const PLANTILLAS: Array<[RegExp, string]> = [
  [/wix\.com|_wixCssImports|wixstatic/i, 'Wix'],
  [/squarespace/i, 'Squarespace'],
  [/jimdo/i, 'Jimdo'],
  [/godaddy|websitebuilder\.godaddy/i, 'GoDaddy Website Builder'],
  [/webnode/i, 'Webnode'],
  [/weebly/i, 'Weebly'],
  [/1and1|ionos.*mywebsite/i, 'IONOS MyWebsite'],
  [/blogspot\.com|blogger\.com/i, 'Blogger'],
  [/sitesgoogle|sites\.google\.com/i, 'Google Sites'],
];

const CMS: Array<[RegExp, string]> = [
  [/wp-content|wp-includes|wordpress/i, 'WordPress'],
  [/Shopify\.theme|cdn\.shopify/i, 'Shopify'],
  [/prestashop/i, 'PrestaShop'],
  [/joomla/i, 'Joomla'],
  [/drupal/i, 'Drupal'],
];

export function extraerHandleInstagram(html: string): string | null {
  const re = /instagram\.com\/(?:#!\/)?([A-Za-z0-9_.]{2,30})/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const handle = m[1].replace(/\.$/, '').toLowerCase();
    if (!HANDLES_IGNORADOS.has(handle)) return handle;
  }
  return null;
}

/** Ultimo anio que aparece en un aviso de copyright. Delata webs abandonadas. */
export function anioCopyright(html: string): number | null {
  const anioActual = new Date().getFullYear();
  const re = /(?:©|&copy;|copyright)[^0-9]{0,40}((?:19|20)\d{2})(?:\s*[-–—]\s*((?:19|20)\d{2}))?/gi;
  let mayor: number | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const anio = Number(m[2] ?? m[1]);
    if (anio >= 1995 && anio <= anioActual + 1 && (mayor === null || anio > mayor)) mayor = anio;
  }
  return mayor;
}

function detectarTecnologia(html: string): { tecnologia: string | null; plantilla: boolean } {
  for (const [re, nombre] of PLANTILLAS) if (re.test(html)) return { tecnologia: nombre, plantilla: true };
  for (const [re, nombre] of CMS) if (re.test(html)) return { tecnologia: nombre, plantilla: false };
  return { tecnologia: null, plantilla: false };
}

export async function auditarWeb(url: string | null): Promise<AuditoriaWeb> {
  if (!url) return { ...VACIA, problemas: ['Sin web'] };

  const r: AuditoriaWeb = { ...VACIA, tieneWeb: true, problemas: [] };
  const inicio = Date.now();
  const controller = new AbortController();
  const temporizador = setTimeout(() => controller.abort(), 20_000);

  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; IgSearchBot/1.0; +https://aquihaymarketing.es)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });

    r.segundosCarga = Number(((Date.now() - inicio) / 1000).toFixed(2));
    r.codigoHttp = res.status;
    r.accesible = res.ok;
    // res.url puede venir vacio; en ese caso vale la URL que pedimos
    r.https = (res.url || url).startsWith('https://');

    if (!res.ok) {
      r.problemas.push(`La web devuelve error ${res.status}`);
      return r;
    }

    const html = (await res.text()).slice(0, 600_000);
    r.pesoKb = Math.round(Buffer.byteLength(html, 'utf8') / 1024);
    r.responsive = /<meta[^>]+name=["']viewport["']/i.test(html);
    r.titulo = html.match(/<title[^>]*>([^<]{1,200})<\/title>/i)?.[1]?.trim() ?? null;
    r.instagramHandle = extraerHandleInstagram(html);
    r.anioCopyright = anioCopyright(html);

    const tec = detectarTecnologia(html);
    r.tecnologia = tec.tecnologia;
    r.plantillaBarata = tec.plantilla;

    // --- Problemas detectados -------------------------------------------
    if (!r.https) r.problemas.push('Sin certificado de seguridad (HTTPS)');
    if (!r.responsive) r.problemas.push('Sin version movil');
    if (r.segundosCarga > 4) r.problemas.push(`Tarda ${r.segundosCarga}s en responder`);
    if (r.pesoKb > 500) r.problemas.push(`HTML muy pesado (${r.pesoKb} KB)`);
    if (tec.plantilla) r.problemas.push(`Hecha con ${tec.tecnologia}, plantilla generica`);

    const anioActual = new Date().getFullYear();
    if (r.anioCopyright && anioActual - r.anioCopyright >= 2) {
      r.problemas.push(`Pie de pagina con copyright de ${r.anioCopyright}: web sin tocar`);
    }
    if (!r.titulo) r.problemas.push('Sin titulo en la pagina (mal para Google)');
    else if (r.titulo.length < 15) r.problemas.push(`Titulo pobre: "${r.titulo}"`);
    if (!/<meta[^>]+name=["']description["']/i.test(html)) {
      r.problemas.push('Sin meta descripcion (mal para Google)');
    }
    if (/<frameset|<font |bgcolor=/i.test(html)) r.problemas.push('HTML anticuado');
    if (/\.swf["']|application\/x-shockwave-flash/i.test(html)) r.problemas.push('Usa Flash, tecnologia muerta');
  } catch (err: any) {
    r.accesible = false;
    r.segundosCarga = Number(((Date.now() - inicio) / 1000).toFixed(2));
    if (err?.name === 'AbortError') {
      r.notas = 'Tiempo de espera agotado (>20s)';
      r.problemas.push('La web no responde en 20 segundos');
    } else {
      r.notas = String(err?.message ?? err).slice(0, 200);
      r.problemas.push('La web no carga');
    }
  } finally {
    clearTimeout(temporizador);
  }

  return r;
}
