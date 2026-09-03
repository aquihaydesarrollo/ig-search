import { NextResponse, type NextRequest } from 'next/server';
import { ajuste } from '@/lib/ajustes';

/**
 * Protege el panel con contrasena (autenticacion basica del navegador).
 *
 * Solo se activa si PANEL_PASSWORD esta definida. Sin ella el panel queda
 * abierto, y la pagina de inicio lo advierte de forma visible.
 *
 * La tarea programada nocturna llama a /api/radar con la cabecera
 * x-radar-secret, asi que esa ruta se deja pasar cuando el secreto coincide.
 */
/**
 * Interruptor de la contrasena del panel.
 *
 * Puesto en false a peticion expresa: la contrasena rechazaba la correcta y
 * bloqueaba el acceso. Con esto el panel abre siempre, sin importar lo que
 * haya en ajustes.json ni en las variables de entorno.
 *
 * ATENCION: mientras esto sea false el panel es PUBLICO. Cualquiera con la
 * direccion ve los leads. Volver a poner true cuando se resuelva.
 */
const AUTENTICACION_ACTIVA = false;

export function proxy(req: NextRequest) {
  if (!AUTENTICACION_ACTIVA) return NextResponse.next();

  // El diagnostico queda siempre abierto: sirve para cuando la contrasena
  // no deja entrar. No devuelve ningun valor, solo de donde sale cada ajuste.
  if (req.nextUrl.pathname === '/api/diagnostico') return NextResponse.next();

  const password = ajuste('PANEL_PASSWORD');
  if (!password) return NextResponse.next();

  // Acceso de la tarea programada
  const secreto = ajuste('RADAR_CRON_SECRET');
  if (secreto && req.headers.get('x-radar-secret') === secreto) {
    return NextResponse.next();
  }

  const cabecera = req.headers.get('authorization') ?? '';
  if (cabecera.startsWith('Basic ')) {
    const descifrado = descifrarBasic(cabecera.slice(6));
    if (descifrado !== null) {
      const separador = descifrado.indexOf(':');
      if (separador !== -1 && iguales(descifrado.slice(separador + 1), password)) {
        return NextResponse.next();
      }
    }
  }

  return new NextResponse('Acceso restringido', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="IG Search", charset="UTF-8"' },
  });
}

/**
 * Descifra la cabecera Basic respetando los acentos.
 *
 * atob() devuelve un byte por caracter, asi que una contrasena con ñ o tilde
 * llegaba partida en dos caracteres y nunca coincidia. Hay que reconstruir
 * los bytes y decodificarlos como UTF-8.
 */
function descifrarBasic(base64: string): string | null {
  try {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    return null;
  }
}

/** Comparacion en tiempo constante para no filtrar la contrasena. */
function iguales(a: string, b: string): boolean {
  // Se comparan los bytes UTF-8: dos textos distintos pueden representar el
  // mismo caracter acentuado de formas diferentes segun el teclado usado.
  const ba = new TextEncoder().encode(a.normalize('NFC'));
  const bb = new TextEncoder().encode(b.normalize('NFC'));
  if (ba.length !== bb.length) return false;
  let diferencia = 0;
  for (let i = 0; i < ba.length; i++) diferencia |= ba[i] ^ bb[i];
  return diferencia === 0;
}

// El proxy de Next 16 siempre corre en Node, asi que puede leer el fichero
// de ajustes del disco sin configuracion adicional.
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
