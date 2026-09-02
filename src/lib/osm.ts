/**
 * Descubrimiento de negocios locales via OpenStreetMap (API Overpass).
 * Gratis, sin cuenta ni clave. Sin dependencia de Google.
 *
 * A cambio de Google Places se pierden las valoraciones y resenas.
 * Las senales de "negocio que funciona" salen del telefono, el horario
 * publicado y, sobre todo, de los datos de Instagram (ver meta.ts).
 */

/**
 * Servidores de Overpass, en orden de preferencia.
 *
 * IMPORTANTE: solo instancias con la base de datos mundial.
 * Las regionales (overpass.osm.ch, overpass.osm.jp) responden HTTP 200
 * con cero resultados para consultas fuera de su pais, lo que parece
 * exito y deja la base de datos vacia sin dar ningun error.
 */
const MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

const REINTENTOS_POR_MIRROR = 3;
const ESPERA_MAXIMA_MS = 180_000;

/**
 * Catalogo de sectores -> etiquetas de OpenStreetMap.
 * Se usa para construir la consulta y tambien para clasificar cada
 * resultado sin volver a preguntar al servidor.
 */
export const SECTORES: Record<string, { nombre: string; tags: Array<[string, string]> }> = {
  clinicas_dentales:   { nombre: 'Clínicas dentales',            tags: [['amenity','dentist'], ['healthcare','dentist']] },
  restaurantes:        { nombre: 'Restaurantes',                 tags: [['amenity','restaurant']] },
  bares_cafeterias:    { nombre: 'Bares y cafeterías',           tags: [['amenity','cafe'], ['amenity','bar'], ['amenity','pub']] },
  hoteles:             { nombre: 'Hoteles y alojamientos',       tags: [['tourism','hotel'], ['tourism','guest_house'], ['tourism','apartment']] },
  inmobiliarias:       { nombre: 'Inmobiliarias',                tags: [['office','estate_agent']] },
  centros_esteticos:   { nombre: 'Centros de estética',          tags: [['shop','beauty'], ['shop','massage']] },
  peluquerias:         { nombre: 'Peluquerías y barberías',      tags: [['shop','hairdresser']] },
  talleres_coches:     { nombre: 'Talleres de coches',           tags: [['shop','car_repair'], ['shop','tyres']] },
  concesionarios:      { nombre: 'Concesionarios',               tags: [['shop','car']] },
  gimnasios:           { nombre: 'Gimnasios y centros deportivos', tags: [['leisure','fitness_centre'], ['leisure','sports_centre']] },
  asesorias:           { nombre: 'Asesorías y gestorías',        tags: [['office','accountant'], ['office','tax_advisor'], ['office','financial']] },
  abogados:            { nombre: 'Abogados',                     tags: [['office','lawyer']] },
  tiendas_ropa:        { nombre: 'Tiendas de ropa',              tags: [['shop','clothes'], ['shop','shoes']] },
  fisioterapia:        { nombre: 'Fisioterapia',                 tags: [['healthcare','physiotherapist']] },
  clinicas_medicas:    { nombre: 'Clínicas médicas',             tags: [['amenity','clinic'], ['healthcare','centre']] },
  veterinarios:        { nombre: 'Veterinarios',                 tags: [['amenity','veterinary']] },
  opticas:             { nombre: 'Ópticas',                      tags: [['shop','optician']] },
  panaderias:          { nombre: 'Panaderías y pastelerías',     tags: [['shop','bakery'], ['shop','pastry']] },
  floristerias:        { nombre: 'Floristerías',                 tags: [['shop','florist']] },
  joyerias:            { nombre: 'Joyerías',                     tags: [['shop','jewelry']] },
  muebles_decoracion:  { nombre: 'Muebles y decoración',         tags: [['shop','furniture'], ['shop','interior_decoration']] },
  reformas:            { nombre: 'Reformas y construcción',      tags: [['office','construction_company'], ['craft','builder']] },
  academias:           { nombre: 'Academias y autoescuelas',     tags: [['amenity','driving_school'], ['amenity','language_school'], ['office','educational_institution']] },
  guarderias:          { nombre: 'Guarderías',                   tags: [['amenity','kindergarten']] },
  ferreterias:         { nombre: 'Ferreterías',                  tags: [['shop','hardware'], ['shop','doityourself']] },
};

export interface Negocio {
  id: string;
  nombre: string;
  sector: string;
  direccion: string | null;
  telefono: string | null;
  web: string | null;
  osmUrl: string | null;
  instagramTag: string | null;
  tieneHorario: boolean;
  esCadena: boolean;
  lat: number | null;
  lng: number | null;
}

export interface BuscarOpts {
  /** Claves del catalogo SECTORES a buscar en una sola consulta. */
  sectores: string[];
  lat: number;
  lng: number;
  radioKm: number;
  timeoutMs?: number;
}

function construirConsulta(sectores: string[], lat: number, lng: number, radioKm: number) {
  const radio = Math.round(radioKm * 1000);
  const vistas = new Set<string>();
  const lineas: string[] = [];

  for (const clave of sectores) {
    for (const [k, v] of SECTORES[clave]?.tags ?? []) {
      const filtro = `["${k}"="${v}"]`;
      if (vistas.has(filtro)) continue;   // dos sectores pueden compartir etiqueta
      vistas.add(filtro);
      lineas.push(`  nwr${filtro}(around:${radio},${lat},${lng});`);
    }
  }

  return `[out:json][timeout:180];\n(\n${lineas.join('\n')}\n);\nout center tags;`;
}

/** Decide a que sector pertenece un resultado, respetando el orden pedido. */
function clasificar(tags: Record<string, string>, sectores: string[]): string | null {
  for (const clave of sectores) {
    for (const [k, v] of SECTORES[clave]?.tags ?? []) {
      if (tags[k] === v) return clave;
    }
  }
  return null;
}

/**
 * Normaliza el valor de la etiqueta contact:instagram de OSM, que puede venir
 * como URL completa, como @usuario o como usuario a secas.
 */
function limpiarHandle(valor: string | undefined): string | null {
  if (!valor) return null;
  const bruto = valor.split(';')[0].trim();
  if (!bruto) return null;

  // Primero la forma URL: hay que leer lo que va DESPUES de instagram.com/
  const url = bruto.match(/instagram\.com\/(?:#!\/)?@?([A-Za-z0-9_.]{2,30})/i);
  if (url) return normalizar(url[1]);

  // Si no es una URL, no debe contener barras ni protocolo
  if (/[:\/\s]/.test(bruto)) return null;

  const simple = bruto.match(/^@?([A-Za-z0-9_.]{2,30})$/);
  return simple ? normalizar(simple[1]) : null;
}

function normalizar(handle: string): string | null {
  const limpio = handle.toLowerCase().replace(/\.+$/, '');
  return limpio.length >= 2 ? limpio : null;
}

function normalizarWeb(tags: Record<string, string>): string | null {
  const bruto = tags['website'] || tags['contact:website'] || tags['url'] || null;
  if (!bruto) return null;
  const limpio = bruto.split(';')[0].trim();
  if (!limpio) return null;
  // Descarta enlaces que en realidad son perfiles de redes sociales
  if (/facebook\.com|instagram\.com|twitter\.com|linkedin\.com/i.test(limpio)) return null;
  return /^https?:\/\//i.test(limpio) ? limpio : `https://${limpio}`;
}

function componerDireccion(tags: Record<string, string>): string | null {
  const partes = [
    [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' '),
    tags['addr:postcode'],
    tags['addr:city'],
  ].filter(Boolean);
  return partes.length ? partes.join(', ') : null;
}

/**
 * Overpass limita el numero de consultas simultaneas por IP.
 * Su endpoint /api/status dice cuantos huecos quedan y cuando se libera
 * el siguiente. Esperar a que haya hueco evita los errores 429 y 504.
 */
async function esperarHueco(mirror: string): Promise<void> {
  const urlEstado = mirror.replace(/\/interpreter$/, '/status');
  try {
    const controller = new AbortController();
    const temporizador = setTimeout(() => controller.abort(), 15_000);
    const res = await fetch(urlEstado, { signal: controller.signal });
    clearTimeout(temporizador);
    if (!res.ok) return;

    const texto = await res.text();
    if (/\d+ slots? available now/i.test(texto)) return;

    const espera = texto.match(/Slot available after:.*?in (\d+) seconds?/i);
    if (espera) {
      const ms = Math.min((Number(espera[1]) + 2) * 1000, ESPERA_MAXIMA_MS);
      await new Promise((r) => setTimeout(r, ms));
    }
  } catch {
    // Si el estado no se puede consultar, se intenta la consulta igualmente
  }
}

/** Consulta Overpass con reintentos, pasando al siguiente servidor si falla. */
async function consultarOverpass(consulta: string, timeoutMs: number): Promise<any> {
  const fallos: string[] = [];

  for (const mirror of MIRRORS) {
    for (let intento = 1; intento <= REINTENTOS_POR_MIRROR; intento++) {
      await esperarHueco(mirror);

      const controller = new AbortController();
      const temporizador = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(mirror, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'IgSearch/1.0 (radar de leads locales; marketing@aquihaymarketing.es)',
          },
          body: new URLSearchParams({ data: consulta }),
          signal: controller.signal,
        });
        clearTimeout(temporizador);

        if (res.status === 429 || res.status === 502 || res.status === 504) {
          fallos.push(`${mirror} saturado (${res.status}), intento ${intento}`);
          if (intento < REINTENTOS_POR_MIRROR) await new Promise((r) => setTimeout(r, 20_000 * intento));
          continue;
        }
        if (!res.ok) {
          fallos.push(`${mirror} respondio ${res.status}`);
          break;
        }

        const datos = await res.json();
        if (!Array.isArray(datos.elements)) {
          fallos.push(`${mirror} devolvio una respuesta sin datos`);
          break;
        }
        return datos;
      } catch (err: any) {
        clearTimeout(temporizador);
        fallos.push(`${mirror}: ${err?.name === 'AbortError' ? 'sin respuesta a tiempo' : err?.message}`);
        if (intento < REINTENTOS_POR_MIRROR) await new Promise((r) => setTimeout(r, 15_000 * intento));
      }
    }
  }

  throw new Error(`Overpass no disponible. ${fallos.join('; ')}`);
}

/**
 * Busca en una sola consulta todos los sectores indicados.
 * Agrupar evita machacar el servidor publico con una peticion por sector.
 */
export async function buscarNegocios(opts: BuscarOpts): Promise<Negocio[]> {
  const sectores = opts.sectores.filter((clave) => SECTORES[clave]);
  if (sectores.length === 0) throw new Error('Ningun sector valido en la configuracion');

  const datos = await consultarOverpass(
    construirConsulta(sectores, opts.lat, opts.lng, opts.radioKm),
    opts.timeoutMs ?? 240_000,
  );

  const negocios: Negocio[] = [];
  const vistos = new Set<string>();

  for (const el of datos.elements ?? []) {
    const tags: Record<string, string> = el.tags ?? {};
    if (!tags['name']) continue;

    const id = `${el.type}/${el.id}`;
    if (vistos.has(id)) continue;
    vistos.add(id);

    const sector = clasificar(tags, sectores);
    if (!sector) continue;

    negocios.push({
      id,
      nombre: tags['name'],
      sector,
      direccion: componerDireccion(tags),
      telefono: tags['phone'] || tags['contact:phone'] || null,
      web: normalizarWeb(tags),
      osmUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
      instagramTag: limpiarHandle(tags['contact:instagram'] || tags['instagram']),
      tieneHorario: Boolean(tags['opening_hours']),
      esCadena: Boolean(tags['brand'] || tags['brand:wikidata']),
      lat: el.lat ?? el.center?.lat ?? null,
      lng: el.lon ?? el.center?.lon ?? null,
    });
  }

  return negocios;
}

/** Geocodifica una ciudad con Nominatim (OpenStreetMap). Tambien sin clave. */
export async function coordenadasDeCiudad(ciudad: string): Promise<{ lat: number; lng: number } | null> {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', ciudad);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'IgSearch/1.0 (marketing@aquihaymarketing.es)' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.[0]) return null;
    return { lat: Number(data[0].lat), lng: Number(data[0].lon) };
  } catch {
    return null;
  }
}
