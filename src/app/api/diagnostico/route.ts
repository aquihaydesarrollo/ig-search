import { NextResponse } from 'next/server';
import fs from 'node:fs';
import { rutasCandidatas } from '@/lib/ajustes';
import { rutaBaseDatos } from '@/lib/db';

export const dynamic = 'force-dynamic';

const CLAVES = [
  'PANEL_PASSWORD',
  'RADAR_CRON_SECRET',
  'META_ACCESS_TOKEN',
  'META_IG_USER_ID',
] as const;

/**
 * Diagnostico de configuracion. No pide contrasena a proposito: sirve
 * justamente para cuando la contrasena no deja entrar.
 *
 * NUNCA devuelve valores, solo de donde sale cada ajuste y si el fichero
 * se puede leer. Asi se ve si hay dos ficheros, si el JSON esta roto o si
 * una variable de entorno esta pisando al fichero.
 */
export async function GET() {
  const ficheros = rutasCandidatas().map((ruta) => {
    const info: Record<string, unknown> = { ruta };
    try {
      if (!fs.existsSync(ruta)) {
        info.existe = false;
        return info;
      }
      info.existe = true;
      const bruto = fs.readFileSync(ruta, 'utf8');
      info.bytes = bruto.length;
      try {
        const datos = JSON.parse(bruto);
        info.jsonValido = true;
        info.clavesDefinidas = Object.keys(datos).filter(
          (k) => typeof datos[k] === 'string' && datos[k].trim(),
        );
        const vacias = Object.keys(datos).filter(
          (k) => typeof datos[k] !== 'string' || !datos[k].trim(),
        );
        if (vacias.length) info.clavesVacias = vacias;
      } catch (err: any) {
        info.jsonValido = false;
        info.errorJson = String(err?.message ?? err);
        // Fallos tipicos de los editores del administrador de archivos
        const pistas: string[] = [];
        if (/[“”‘’]/.test(bruto)) {
          pistas.push('El fichero tiene comillas curvas (“ ”). JSON necesita comillas rectas (").');
        }
        if (/,\s*[}\]]/.test(bruto)) pistas.push('Hay una coma de más antes de } o ].');
        if (bruto.charCodeAt(0) === 0xfeff) pistas.push('El fichero empieza con una marca BOM invisible.');
        if (pistas.length) info.pistas = pistas;
      }
    } catch (err: any) {
      info.existe = 'no se puede leer';
      info.error = String(err?.message ?? err);
    }
    return info;
  });

  // De donde sale cada ajuste, sin revelar ningun valor
  const origen: Record<string, string> = {};
  for (const clave of CLAVES) {
    const delEntorno = process.env[clave];
    if (delEntorno && delEntorno.trim()) {
      origen[clave] = 'variable de entorno (manda sobre los ficheros)';
      continue;
    }
    const fichero = ficheros.find(
      (f) => Array.isArray(f.clavesDefinidas) && (f.clavesDefinidas as string[]).includes(clave),
    );
    origen[clave] = fichero ? `fichero: ${fichero.ruta}` : 'sin definir';
  }

  const passwordDefinida = origen.PANEL_PASSWORD !== 'sin definir';

  return NextResponse.json({
    passwordDefinida,
    resumen: passwordDefinida
      ? `El panel pide contraseña y la toma de: ${origen.PANEL_PASSWORD}`
      : 'No hay contraseña definida: el panel está abierto.',
    origenDeCadaAjuste: origen,
    ficherosDeAjustes: ficheros,
    baseDatos: { ruta: rutaBaseDatos(), existe: fs.existsSync(rutaBaseDatos()) },
    carpetaDeTrabajo: process.cwd(),
  }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
