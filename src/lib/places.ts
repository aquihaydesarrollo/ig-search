/**
 * Google Places API (New) - descubrimiento de negocios locales.
 * Documentacion: https://developers.google.com/maps/documentation/places/web-service/text-search
 */

const ENDPOINT = 'https://places.googleapis.com/v1/places:searchText';

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.nationalPhoneNumber',
  'places.websiteUri',
  'places.googleMapsUri',
  'places.rating',
  'places.userRatingCount',
  'places.location',
  'places.primaryTypeDisplayName',
  'nextPageToken',
].join(',');

export interface Negocio {
  id: string;
  nombre: string;
  sector: string;
  direccion: string | null;
  telefono: string | null;
  web: string | null;
  googleMapsUrl: string | null;
  valoracion: number | null;
  numResenas: number | null;
  lat: number | null;
  lng: number | null;
}

interface SearchOpts {
  sector: string;
  ciudad: string;
  region: string;
  lat?: number | null;
  lng?: number | null;
  radioKm?: number;
  maxPaginas?: number;
}

export async function buscarNegocios(opts: SearchOpts): Promise<Negocio[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error('Falta GOOGLE_PLACES_API_KEY');

  const resultados: Negocio[] = [];
  let pageToken: string | undefined;
  const maxPaginas = opts.maxPaginas ?? 3;

  for (let pagina = 0; pagina < maxPaginas; pagina++) {
    const body: Record<string, unknown> = {
      textQuery: `${opts.sector} en ${opts.ciudad}`,
      languageCode: 'es',
      regionCode: 'ES',
      pageSize: 20,
    };
    if (pageToken) body.pageToken = pageToken;
    if (opts.lat != null && opts.lng != null) {
      body.locationBias = {
        circle: {
          center: { latitude: opts.lat, longitude: opts.lng },
          radius: Math.min((opts.radioKm ?? 25) * 1000, 50000),
        },
      };
    }

    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const texto = await res.text();
      throw new Error(`Google Places ${res.status}: ${texto.slice(0, 300)}`);
    }

    const data = await res.json();
    for (const p of data.places ?? []) {
      resultados.push({
        id: p.id,
        nombre: p.displayName?.text ?? 'Sin nombre',
        sector: opts.sector,
        direccion: p.formattedAddress ?? null,
        telefono: p.nationalPhoneNumber ?? null,
        web: p.websiteUri ?? null,
        googleMapsUrl: p.googleMapsUri ?? null,
        valoracion: p.rating ?? null,
        numResenas: p.userRatingCount ?? null,
        lat: p.location?.latitude ?? null,
        lng: p.location?.longitude ?? null,
      });
    }

    pageToken = data.nextPageToken;
    if (!pageToken) break;
    // La API exige un pequeno margen antes de pedir la siguiente pagina
    await new Promise((r) => setTimeout(r, 1500));
  }

  return resultados;
}

/** Geocodifica una ciudad para poder sesgar las busquedas por radio. */
export async function coordenadasDeCiudad(ciudad: string): Promise<{ lat: number; lng: number } | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error('Falta GOOGLE_PLACES_API_KEY');

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.location,places.displayName',
    },
    body: JSON.stringify({ textQuery: ciudad, languageCode: 'es', regionCode: 'ES', pageSize: 1 }),
  });

  if (!res.ok) return null;
  const data = await res.json();
  const loc = data.places?.[0]?.location;
  return loc ? { lat: loc.latitude, lng: loc.longitude } : null;
}
