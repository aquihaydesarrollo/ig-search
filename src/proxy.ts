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
export function proxy(req: NextRequest) {
  const password = ajuste('PANEL_PASSWORD');
  if (!password) return NextResponse.next();

  // Acceso de la tarea programada
  const secreto = ajuste('RADAR_CRON_SECRET');
  if (secreto && req.headers.get('x-radar-secret') === secreto) {
    return NextResponse.next();
  }

  const cabecera = req.headers.get('authorization') ?? '';
  if (cabecera.startsWith('Basic ')) {
    try {
      const descifrado = atob(cabecera.slice(6));
      const separador = descifrado.indexOf(':');
      if (separador !== -1 && iguales(descifrado.slice(separador + 1), password)) {
        return NextResponse.next();
      }
    } catch {
      // cabecera mal formada: se pide de nuevo
    }
  }

  return new NextResponse('Acceso restringido', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="IG Search", charset="UTF-8"' },
  });
}

/** Comparacion en tiempo constante para no filtrar la contrasena. */
function iguales(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diferencia = 0;
  for (let i = 0; i < a.length; i++) diferencia |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diferencia === 0;
}

// El proxy de Next 16 siempre corre en Node, asi que puede leer el fichero
// de ajustes del disco sin configuracion adicional.
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
