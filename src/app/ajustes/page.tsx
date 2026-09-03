import { ajuste, rutasCandidatas } from '@/lib/ajustes';
import { rutaBaseDatos } from '@/lib/db';
import FormularioInstagram from '@/components/FormularioInstagram';
import FormularioAcceso from '@/components/FormularioAcceso';

export const dynamic = 'force-dynamic';

const PASOS: Array<[string, string]> = [
  ['Cuenta profesional vinculada',
   'Tu Instagram debe ser cuenta de empresa o creador Y estar vinculado a una página de Facebook. Se comprueba desde la app de Instagram: Configuración → Tipo de cuenta y herramientas.'],
  ['Crear la app en Meta',
   'developers.facebook.com → Mis apps → Crear app. Pon un nombre y tu correo. Cuando pregunte para qué es, elige la opción de gestionar contenido o páginas de Instagram; si no la ves, elige «Otro» y luego tipo «Empresa».'],
  ['Elegir el acceso con Facebook',
   'IMPORTANTE: si te da a elegir entre «Instagram API con inicio de sesión de Instagram» y «con inicio de sesión de Facebook», elige la de FACEBOOK. La otra no permite analizar cuentas ajenas.'],
  ['Copiar identificador y clave',
   'Dentro de la app: Configuración → Básica. Ahí están el identificador de la app y la clave secreta, con un botón «Mostrar».'],
  ['Generar el token temporal',
   'Ve al Explorador de la API. Arriba a la derecha selecciona tu app. En permisos añade estos cinco: pages_show_list, pages_read_engagement, instagram_basic, instagram_manage_insights y business_management. Pulsa «Generar token de acceso» y acepta.'],
  ['Pegarlo aquí abajo',
   'Los tres datos en el formulario. El token temporal caduca en un par de horas, pero al conectar se convierte solo en uno permanente.'],
];

const PERMISOS = [
  ['pages_show_list', 'ver tus páginas de Facebook'],
  ['pages_read_engagement', 'saber qué Instagram tiene vinculado cada página'],
  ['instagram_basic', 'leer perfiles y publicaciones'],
  ['instagram_manage_insights', 'tus métricas y las de cuentas ajenas'],
  ['business_management', 'páginas que pertenecen a un Business Manager'],
];

const FALLOS: Array<[string, string]> = [
  ['«El token no da acceso a ninguna página»',
   'Al generar el token no marcaste pages_show_list, o no aceptaste la página en la ventana de permisos. Vuelve al Explorador y genera otro.'],
  ['«Ninguna de tus páginas tiene Instagram vinculado»',
   'La cuenta no está unida a la página. Se arregla desde la configuración de la página de Facebook, apartado Instagram.'],
  ['«Error validating access token»',
   'El token temporal ya caducó: duran una o dos horas. Genera uno nuevo y vuelve a conectar.'],
  ['Análisis dice que no puede leer una cuenta',
   'Esa cuenta es personal o privada. La API de Meta solo expone cuentas profesionales públicas.'],
];

export default async function Ajustes() {
  const conectado = Boolean(ajuste('META_ACCESS_TOKEN') && ajuste('META_IG_USER_ID'));
  const tienePassword = Boolean(ajuste('PANEL_PASSWORD'));

  return (
    <div className="space-y-12">
      <section>
        <p className="eyebrow mb-4">Configuración</p>
        <h1 className="text-3xl sm:text-display font-normal">Ajustes.</h1>
      </section>

      {/* --- Instagram ---------------------------------------------------- */}
      <section className="space-y-6">
        <div className="flex items-baseline gap-3 flex-wrap">
          <h2 className="text-headline">Conectar Instagram</h2>
          <span className={`tag ${conectado ? 'bg-lime' : 'bg-coral'}`}>
            {conectado ? 'Conectado' : 'Sin conectar'}
          </span>
        </div>

        <div className="bg-cream rounded-lg p-6 sm:p-8">
          <p className="eyebrow mb-4">Cómo conseguir el token</p>
          <ol className="space-y-4">
            {PASOS.map(([titulo, texto], i) => (
              <li key={titulo} className="flex gap-4">
                <span className="font-mono text-body-sm text-ink/40 shrink-0 pt-0.5">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div>
                  <p className="text-body-sm font-medium">{titulo}</p>
                  <p className="text-body-sm text-ink/70 mt-0.5 leading-relaxed">{texto}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="flex gap-2 mt-6 flex-wrap">
            <a href="https://developers.facebook.com/apps/" target="_blank" rel="noopener noreferrer"
               className="pill-secondary">Abrir Meta for Developers</a>
            <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener noreferrer"
               className="pill-secondary">Abrir el Explorador de la API</a>
          </div>
          <div className="mt-6 pt-6 border-t border-ink/10">
            <p className="text-body-sm font-medium mb-3">Los cinco permisos y para qué sirve cada uno</p>
            <ul className="space-y-1.5">
              {PERMISOS.map(([permiso, para]) => (
                <li key={permiso} className="text-body-sm text-ink/70">
                  <code className="font-mono text-ink">{permiso}</code> — {para}
                </li>
              ))}
            </ul>
          </div>

          <p className="text-body-sm text-ink/60 mt-5">
            Al usar solo tu propia cuenta, la app puede quedarse en modo desarrollo:
            no hace falta pasar la revisión de Meta, que llevaría semanas.
          </p>
        </div>

        <div className="card">
          <FormularioInstagram conectado={conectado} />
        </div>
      </section>

      {/* --- Si algo falla ------------------------------------------------ */}
      <section className="space-y-4">
        <h2 className="text-headline">Si algo falla</h2>
        <div className="border-t border-hairline">
          {FALLOS.map(([error, solucion]) => (
            <div key={error} className="border-b border-hairline py-4">
              <p className="text-body-sm font-medium">{error}</p>
              <p className="text-body-sm text-ink/70 mt-1 leading-relaxed">{solucion}</p>
            </div>
          ))}
        </div>
      </section>

      {/* --- Acceso ------------------------------------------------------- */}
      <section className="space-y-6">
        <h2 className="text-headline">Acceso al panel</h2>
        <div className="card">
          <FormularioAcceso tienePassword={tienePassword} />
        </div>
        <p className="text-body-sm text-ink/60">
          Guardar la contraseña aquí no la activa todavía: el candado está desactivado
          en el código, en <code className="font-mono">src/proxy.ts</code>. Así no puedes
          quedarte fuera si algo va mal. Cuando compruebes que la contraseña queda bien
          guardada, se activa y listo.
        </p>
      </section>

      {/* --- Rutas -------------------------------------------------------- */}
      <section className="bg-surface-soft rounded-lg p-6 sm:p-8 space-y-4">
        <p className="eyebrow">Dónde guarda las cosas</p>
        <div>
          <p className="text-body-sm font-medium mb-1">Base de datos</p>
          <code className="text-body-sm font-mono break-all text-ink/70">{rutaBaseDatos()}</code>
        </div>
        <div>
          <p className="text-body-sm font-medium mb-1">Ajustes</p>
          <p className="text-body-sm text-ink/60 mb-2">
            Se escriben en la primera de estas rutas donde se pueda:
          </p>
          {rutasCandidatas().map((r) => (
            <p key={r} className="text-body-sm font-mono break-all text-ink/70">
              <span className="text-ink/35 mr-2">—</span>{r}
            </p>
          ))}
        </div>
        <p className="text-body-sm text-ink/60">
          Para ver el estado completo: <code className="font-mono">/api/diagnostico</code>
        </p>
      </section>
    </div>
  );
}
