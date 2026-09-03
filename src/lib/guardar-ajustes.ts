import fs from 'node:fs';
import path from 'node:path';
import { rutasCandidatas, type Clave } from './ajustes.ts';

/**
 * Escritura del fichero de ajustes.
 *
 * Se hace desde la aplicacion en lugar de a mano porque editar JSON en el
 * administrador de archivos del alojamiento resulto poco fiable: el fichero
 * llego a guardarse vacio y dejo el panel inaccesible.
 */

export interface ResultadoGuardado {
  ok: boolean;
  ruta?: string;
  error?: string;
}

/** Devuelve la primera ruta en la que se pueda escribir de verdad. */
function primeraRutaEscribible(): { ruta: string; error?: string } | { ruta: null; error: string } {
  const fallos: string[] = [];

  for (const ruta of rutasCandidatas()) {
    try {
      fs.mkdirSync(/*turbopackIgnore: true*/ path.dirname(ruta), { recursive: true });
      // Comprobacion real: se escribe y se borra un fichero temporal
      const prueba = ruta + '.prueba';
      fs.writeFileSync(/*turbopackIgnore: true*/ prueba, 'x');
      fs.rmSync(prueba, { force: true });
      return { ruta };
    } catch (err: any) {
      fallos.push(`${ruta}: ${String(err?.message ?? err)}`);
    }
  }

  return { ruta: null, error: `Ninguna ruta permite escribir. ${fallos.join(' | ')}` };
}

/** Mezcla los valores nuevos con los que ya hubiera y guarda el fichero. */
export function guardarAjustes(nuevos: Partial<Record<Clave, string>>): ResultadoGuardado {
  const destino = primeraRutaEscribible();
  if (!destino.ruta) return { ok: false, error: destino.error };

  let actuales: Record<string, unknown> = {};
  try {
    if (fs.existsSync(/*turbopackIgnore: true*/ destino.ruta)) {
      const bruto = fs.readFileSync(/*turbopackIgnore: true*/ destino.ruta, 'utf8').trim();
      if (bruto) actuales = JSON.parse(bruto);
    }
  } catch {
    // Fichero ilegible o JSON roto: se sustituye por uno correcto
    actuales = {};
  }

  for (const [clave, valor] of Object.entries(nuevos)) {
    if (valor === undefined) continue;
    if (valor === '') delete actuales[clave];      // cadena vacia = borrar la clave
    else actuales[clave] = valor.trim();
  }

  try {
    // Escritura atomica: primero un temporal y luego se renombra, para que un
    // corte a medias no deje el fichero vacio.
    const temporal = destino.ruta + '.tmp';
    fs.writeFileSync(/*turbopackIgnore: true*/ temporal, JSON.stringify(actuales, null, 2) + '\n', 'utf8');
    fs.renameSync(temporal, destino.ruta);

    // Se comprueba que lo escrito se puede volver a leer
    const releido = JSON.parse(fs.readFileSync(/*turbopackIgnore: true*/ destino.ruta, 'utf8'));
    if (typeof releido !== 'object' || releido === null) {
      return { ok: false, error: 'El fichero se guardó pero no se puede leer' };
    }

    // Los cambios deben verse al momento, sin esperar a que caduque la cache
    for (const [clave, valor] of Object.entries(nuevos)) {
      if (valor) process.env[clave] = valor.trim();
      else delete process.env[clave];
    }

    return { ok: true, ruta: destino.ruta };
  } catch (err: any) {
    return { ok: false, error: String(err?.message ?? err) };
  }
}
