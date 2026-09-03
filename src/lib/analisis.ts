import type { PerfilPublico } from './meta.ts';

/**
 * Analisis de una cuenta de Instagram a partir de sus publicaciones publicas.
 *
 * Todo se calcula con lo que devuelve Business Discovery de la API oficial:
 * seguidores, y de cada publicacion su texto, tipo, fecha, me gusta y
 * comentarios. No hay acceso a alcance, guardados ni compartidos de cuentas
 * ajenas: eso Meta solo lo da de la cuenta propia.
 */

export interface PublicacionAnalizada {
  id: string;
  tipo: string;
  texto: string | null;
  permalink: string | null;
  fecha: string;
  likes: number;
  comentarios: number;
  interacciones: number;
  /** Veces por encima de la mediana de la cuenta. 3 = triplica lo normal. */
  factorViral: number;
  hashtags: number;
  longitudTexto: number;
}

export interface AnalisisFormato {
  tipo: string;
  nombre: string;
  publicaciones: number;
  porcentaje: number;
  interaccionesMedia: number;
  engagementMedio: number | null;
}

export interface Analisis {
  handle: string;
  seguidores: number | null;
  publicacionesTotales: number | null;
  biografia: string | null;
  web: string | null;

  analizadas: number;
  desde: string | null;
  hasta: string | null;

  engagementMedio: number | null;
  /** Sobre la mediana: no lo distorsiona una publicacion viral suelta. */
  engagementTipico: number | null;
  interaccionesMedia: number;
  interaccionesMediana: number;
  ratioComentarios: number;

  publicacionesPorSemana: number | null;
  diasDesdeUltima: number | null;
  mejorDia: { dia: string; interaccionesMedia: number; publicaciones: number } | null;
  mejorFranja: { franja: string; interaccionesMedia: number; publicaciones: number } | null;

  formatos: AnalisisFormato[];
  formatoGanador: AnalisisFormato | null;

  hashtagsPorPublicacion: number;
  longitudTextoMedia: number;
  hashtagsFrecuentes: Array<{ etiqueta: string; veces: number }>;

  virales: PublicacionAnalizada[];
  flojas: PublicacionAnalizada[];
  tendencia: { primeras: number; ultimas: number; variacion: number } | null;

  conclusiones: string[];
}

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const NOMBRE_FORMATO: Record<string, string> = {
  IMAGE: 'Imagen',
  VIDEO: 'Vídeo o reel',
  CAROUSEL_ALBUM: 'Carrusel',
};

function mediana(valores: number[]): number {
  if (valores.length === 0) return 0;
  const orden = [...valores].sort((a, b) => a - b);
  const medio = Math.floor(orden.length / 2);
  return orden.length % 2 ? orden[medio] : (orden[medio - 1] + orden[medio]) / 2;
}

function media(valores: number[]): number {
  return valores.length ? valores.reduce((a, b) => a + b, 0) / valores.length : 0;
}

function redondear(n: number, decimales = 1): number {
  const f = 10 ** decimales;
  return Math.round(n * f) / f;
}

/** Hora y dia en la zona horaria de Espana, no en la del servidor. */
function enHorarioEspanol(fecha: Date): { dia: number; hora: number } {
  const partes = new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid',
    weekday: 'short',
    hour: 'numeric',
    hour12: false,
  }).formatToParts(fecha);

  const hora = Number(partes.find((p) => p.type === 'hour')?.value ?? 0);
  // El dia de la semana se obtiene comparando con la fecha local del servidor
  const iso = new Date(fecha.toLocaleString('en-US', { timeZone: 'Europe/Madrid' }));
  return { dia: iso.getDay(), hora };
}

function franjaHoraria(hora: number): string {
  if (hora < 7) return 'Madrugada (00-07)';
  if (hora < 12) return 'Mañana (07-12)';
  if (hora < 15) return 'Mediodía (12-15)';
  if (hora < 19) return 'Tarde (15-19)';
  if (hora < 22) return 'Noche (19-22)';
  return 'Última hora (22-24)';
}

function extraerHashtags(texto: string | null): string[] {
  if (!texto) return [];
  return (texto.match(/#[\p{L}\p{N}_]{2,40}/gu) ?? []).map((h) => h.toLowerCase());
}

export function analizar(perfil: PerfilPublico): Analisis {
  const posts = perfil.publicaciones
    .filter((p) => p.publicadaEn)
    .map((p) => ({
      id: p.id,
      tipo: p.tipo ?? 'IMAGE',
      texto: p.texto,
      permalink: p.permalink,
      fecha: p.publicadaEn!,
      likes: p.likes ?? 0,
      comentarios: p.comentarios ?? 0,
      interacciones: (p.likes ?? 0) + (p.comentarios ?? 0),
      hashtags: extraerHashtags(p.texto).length,
      longitudTexto: (p.texto ?? '').length,
    }))
    .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

  const base: Analisis = {
    handle: perfil.handle,
    seguidores: perfil.seguidores,
    publicacionesTotales: perfil.numPublicaciones,
    biografia: perfil.biografia,
    web: perfil.webPerfil,
    analizadas: posts.length,
    desde: null, hasta: null,
    engagementMedio: null, engagementTipico: null, interaccionesMedia: 0, interaccionesMediana: 0, ratioComentarios: 0,
    publicacionesPorSemana: null, diasDesdeUltima: null, mejorDia: null, mejorFranja: null,
    formatos: [], formatoGanador: null,
    hashtagsPorPublicacion: 0, longitudTextoMedia: 0, hashtagsFrecuentes: [],
    virales: [], flojas: [], tendencia: null,
    conclusiones: [],
  };

  if (posts.length === 0) {
    base.conclusiones.push('La cuenta no tiene publicaciones públicas que analizar.');
    return base;
  }

  const interacciones = posts.map((p) => p.interacciones);
  const med = mediana(interacciones);
  const prom = media(interacciones);

  base.hasta = posts[0].fecha;
  base.desde = posts[posts.length - 1].fecha;
  base.interaccionesMedia = Math.round(prom);
  base.interaccionesMediana = Math.round(med);

  const totalLikes = posts.reduce((a, p) => a + p.likes, 0);
  const totalComentarios = posts.reduce((a, p) => a + p.comentarios, 0);
  base.ratioComentarios = totalLikes + totalComentarios > 0
    ? redondear((totalComentarios / (totalLikes + totalComentarios)) * 100, 1)
    : 0;

  if (perfil.seguidores && perfil.seguidores > 0) {
    base.engagementMedio = redondear((prom / perfil.seguidores) * 100, 2);
    // La mediana representa mejor lo que consigue una publicacion normal:
    // una sola viral dispara la media y da una imagen falsa de la cuenta.
    base.engagementTipico = redondear((med / perfil.seguidores) * 100, 2);
  }

  // --- Ritmo de publicacion ---------------------------------------------
  const msPrimera = new Date(base.desde!).getTime();
  const msUltima = new Date(base.hasta!).getTime();
  const semanas = Math.max((msUltima - msPrimera) / (1000 * 60 * 60 * 24 * 7), 0.5);
  base.publicacionesPorSemana = redondear(posts.length / semanas, 1);
  base.diasDesdeUltima = Math.floor((Date.now() - msUltima) / 86_400_000);

  // --- Mejor dia y franja -------------------------------------------------
  const porDia = new Map<number, number[]>();
  const porFranja = new Map<string, number[]>();
  for (const p of posts) {
    const { dia, hora } = enHorarioEspanol(new Date(p.fecha));
    (porDia.get(dia) ?? porDia.set(dia, []).get(dia)!).push(p.interacciones);
    const f = franjaHoraria(hora);
    (porFranja.get(f) ?? porFranja.set(f, []).get(f)!).push(p.interacciones);
  }

  // Solo se tienen en cuenta los que tengan al menos dos publicaciones
  const diasValidos = [...porDia.entries()].filter(([, v]) => v.length >= 2);
  if (diasValidos.length) {
    const mejor = diasValidos.sort((a, b) => media(b[1]) - media(a[1]))[0];
    base.mejorDia = {
      dia: DIAS[mejor[0]],
      interaccionesMedia: Math.round(media(mejor[1])),
      publicaciones: mejor[1].length,
    };
  }

  const franjasValidas = [...porFranja.entries()].filter(([, v]) => v.length >= 2);
  if (franjasValidas.length) {
    const mejor = franjasValidas.sort((a, b) => media(b[1]) - media(a[1]))[0];
    base.mejorFranja = {
      franja: mejor[0],
      interaccionesMedia: Math.round(media(mejor[1])),
      publicaciones: mejor[1].length,
    };
  }

  // --- Formatos -----------------------------------------------------------
  const porTipo = new Map<string, typeof posts>();
  for (const p of posts) {
    if (!porTipo.has(p.tipo)) porTipo.set(p.tipo, []);
    porTipo.get(p.tipo)!.push(p);
  }

  base.formatos = [...porTipo.entries()]
    .map(([tipo, lista]) => {
      // Mediana por formato: un solo exito no debe coronar a todo un formato
      const inter = mediana(lista.map((p) => p.interacciones));
      return {
        tipo,
        nombre: NOMBRE_FORMATO[tipo] ?? tipo,
        publicaciones: lista.length,
        porcentaje: Math.round((lista.length / posts.length) * 100),
        interaccionesMedia: Math.round(inter),
        engagementMedio: perfil.seguidores
          ? redondear((inter / perfil.seguidores) * 100, 2)
          : null,
      };
    })
    .sort((a, b) => b.interaccionesMedia - a.interaccionesMedia);

  // Solo se corona un formato si tiene respaldo suficiente
  base.formatoGanador = base.formatos.find((f) => f.publicaciones >= 2) ?? null;

  // --- Texto y hashtags ---------------------------------------------------
  base.hashtagsPorPublicacion = redondear(media(posts.map((p) => p.hashtags)), 1);
  base.longitudTextoMedia = Math.round(media(posts.map((p) => p.longitudTexto)));

  const cuenta = new Map<string, number>();
  for (const p of posts) {
    for (const h of new Set(extraerHashtags(p.texto))) {
      cuenta.set(h, (cuenta.get(h) ?? 0) + 1);
    }
  }
  base.hashtagsFrecuentes = [...cuenta.entries()]
    .filter(([, veces]) => veces >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([etiqueta, veces]) => ({ etiqueta, veces }));

  // --- Viralidad ----------------------------------------------------------
  const conFactor: PublicacionAnalizada[] = posts.map((p) => ({
    ...p,
    factorViral: med > 0 ? redondear(p.interacciones / med, 2) : 0,
  }));

  base.virales = [...conFactor].sort((a, b) => b.interacciones - a.interacciones).slice(0, 5);
  base.flojas = [...conFactor].sort((a, b) => a.interacciones - b.interacciones).slice(0, 3);

  // --- Tendencia ----------------------------------------------------------
  if (posts.length >= 6) {
    // Medianas y no medias: si no, una sola publicacion viral en una mitad
    // inventa una tendencia que no existe.
    const mitad = Math.floor(posts.length / 2);
    const recientes = mediana(posts.slice(0, mitad).map((p) => p.interacciones));
    const antiguas = mediana(posts.slice(mitad).map((p) => p.interacciones));
    base.tendencia = {
      ultimas: Math.round(recientes),
      primeras: Math.round(antiguas),
      variacion: antiguas > 0 ? redondear(((recientes - antiguas) / antiguas) * 100, 0) : 0,
    };
  }

  base.conclusiones = redactarConclusiones(base);
  return base;
}

/** Traduce los numeros a frases accionables. */
function redactarConclusiones(a: Analisis): string[] {
  const c: string[] = [];

  const eng = a.engagementTipico ?? a.engagementMedio;
  if (eng != null) {
    if (eng >= 3) c.push(`Engagement típico del ${eng}%: muy alto, su audiencia responde.`);
    else if (eng >= 1) c.push(`Engagement típico del ${eng}%: sano para su tamaño.`);
    else c.push(`Engagement típico del ${eng}%: bajo, publica pero no le interactúan.`);

    if (a.engagementMedio != null && a.engagementMedio >= eng * 1.8) {
      c.push('La media sube mucho por encima de lo normal: tiene alguna publicación disparada que no representa su día a día.');
    }
  }

  if (a.diasDesdeUltima != null && a.diasDesdeUltima > 30) {
    c.push(`Lleva ${a.diasDesdeUltima} días sin publicar: cuenta abandonada.`);
  } else if (a.publicacionesPorSemana != null) {
    if (a.publicacionesPorSemana >= 4) c.push(`Publica ${a.publicacionesPorSemana} veces por semana: ritmo alto.`);
    else if (a.publicacionesPorSemana >= 1.5) c.push(`Publica ${a.publicacionesPorSemana} veces por semana: ritmo constante.`);
    else c.push(`Publica ${a.publicacionesPorSemana} veces por semana: poca frecuencia.`);
  }

  if (a.formatoGanador && a.formatos.length > 1) {
    const peor = a.formatos[a.formatos.length - 1];
    if (peor.interaccionesMedia > 0 && a.formatoGanador.interaccionesMedia / peor.interaccionesMedia >= 1.5) {
      c.push(
        `${a.formatoGanador.nombre} le funciona ${redondear(a.formatoGanador.interaccionesMedia / peor.interaccionesMedia, 1)} veces mejor que ${peor.nombre.toLowerCase()}.`,
      );
    }
  }

  if (a.mejorDia) c.push(`Su mejor día es el ${a.mejorDia.dia.toLowerCase()}, con ${a.mejorDia.interaccionesMedia} interacciones de media.`);
  if (a.mejorFranja) c.push(`Su mejor franja: ${a.mejorFranja.franja.toLowerCase()}.`);

  if (a.tendencia) {
    if (a.tendencia.variacion >= 20) c.push(`Va a más: sus últimas publicaciones rinden un ${a.tendencia.variacion}% mejor que las anteriores.`);
    else if (a.tendencia.variacion <= -20) c.push(`Va a menos: sus últimas publicaciones rinden un ${Math.abs(a.tendencia.variacion)}% peor.`);
    else c.push('Rendimiento estable entre sus publicaciones recientes y las anteriores.');
  }

  const viral = a.virales[0];
  if (viral && viral.factorViral >= 2) {
    c.push(`Su publicación estrella multiplica por ${viral.factorViral} lo que consigue de normal: merece la pena ver qué hizo distinto.`);
  }

  if (a.ratioComentarios >= 8) c.push(`${a.ratioComentarios}% de las interacciones son comentarios: genera conversación, no solo likes.`);
  else if (a.ratioComentarios <= 2) c.push(`Solo el ${a.ratioComentarios}% son comentarios: recibe likes pasivos.`);

  if (a.hashtagsPorPublicacion >= 15) c.push(`Usa ${a.hashtagsPorPublicacion} hashtags por publicación: estrategia de alcance por etiquetas.`);
  else if (a.hashtagsPorPublicacion <= 2) c.push('Apenas usa hashtags: confía en el alcance del algoritmo.');

  if (a.longitudTextoMedia >= 500) c.push('Textos largos: apuesta por contenido que se lee, no solo se ve.');
  else if (a.longitudTextoMedia <= 80) c.push('Textos muy cortos: el peso lo lleva la imagen.');

  return c;
}
