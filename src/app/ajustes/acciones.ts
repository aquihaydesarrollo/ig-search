'use server';

import { revalidatePath } from 'next/cache';
import { guardarAjustes } from '@/lib/guardar-ajustes';
import { obtenerTokenPermanente, descubrirCuenta } from '@/lib/meta';

export interface Respuesta {
  ok: boolean;
  mensaje: string;
}

/** Guarda la contrasena del panel y el secreto de la tarea programada. */
export async function guardarAcceso(
  password: string,
  cronSecret: string,
): Promise<Respuesta> {
  const r = guardarAjustes({
    PANEL_PASSWORD: password,
    RADAR_CRON_SECRET: cronSecret,
  });

  revalidatePath('/ajustes');
  if (!r.ok) return { ok: false, mensaje: `No se pudo guardar: ${r.error}` };

  return {
    ok: true,
    mensaje: password
      ? `Guardado en ${r.ruta}. La contraseña solo se pedirá cuando actives el candado.`
      : `Contraseña borrada. Guardado en ${r.ruta}.`,
  };
}

/**
 * Convierte el token temporal en permanente y lo guarda.
 * No se guardan el identificador ni la clave secreta de la app: solo hacen
 * falta para esta conversion.
 */
export async function conectarInstagram(
  appId: string,
  appSecret: string,
  tokenCorto: string,
): Promise<Respuesta> {
  if (!appId.trim() || !appSecret.trim() || !tokenCorto.trim()) {
    return { ok: false, mensaje: 'Faltan datos: hacen falta los tres campos.' };
  }

  try {
    const t = await obtenerTokenPermanente(appId.trim(), appSecret.trim(), tokenCorto.trim());
    const r = guardarAjustes({
      META_ACCESS_TOKEN: t.tokenPagina,
      META_IG_USER_ID: t.igUserId,
    });

    revalidatePath('/ajustes');
    revalidatePath('/');

    if (!r.ok) {
      return { ok: false, mensaje: `El token se obtuvo pero no se pudo guardar: ${r.error}` };
    }
    return {
      ok: true,
      mensaje: `Conectado con @${t.igUsername}, página "${t.paginaNombre}". Token permanente guardado.`,
    };
  } catch (err: any) {
    return { ok: false, mensaje: String(err?.message ?? err) };
  }
}

/** Comprueba que el token guardado sigue sirviendo. */
export async function comprobarInstagram(): Promise<Respuesta> {
  try {
    const cuenta = await descubrirCuenta();
    if (!cuenta) {
      return { ok: false, mensaje: 'El token ya no da acceso a ninguna cuenta de Instagram.' };
    }
    return { ok: true, mensaje: `Todo correcto: @${cuenta.igUsername} (${cuenta.pageName}).` };
  } catch (err: any) {
    return { ok: false, mensaje: String(err?.message ?? err) };
  }
}

/** Borra las credenciales de Meta. */
export async function desconectarInstagram(): Promise<Respuesta> {
  const r = guardarAjustes({ META_ACCESS_TOKEN: '', META_IG_USER_ID: '' });
  revalidatePath('/ajustes');
  return r.ok
    ? { ok: true, mensaje: 'Credenciales de Instagram borradas.' }
    : { ok: false, mensaje: `No se pudo guardar: ${r.error}` };
}
