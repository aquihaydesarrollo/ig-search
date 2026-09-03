import { ajuste, rutasCandidatas } from '@/lib/ajustes';
import { rutaBaseDatos } from '@/lib/db';
import FormularioInstagram from '@/components/FormularioInstagram';
import FormularioAcceso from '@/components/FormularioAcceso';

export const dynamic = 'force-dynamic';

const PASOS = [
  ['Cuenta profesional', 'Tu Instagram debe ser cuenta de empresa y estar vinculado a una página de Facebook.'],
  ['Crear la app', 'En developers.facebook.com → Mis apps → Crear app. Tipo «Otro», luego «Empresa». Ponle el nombre que quieras.'],
  ['Copiar las credenciales', 'Dentro de la app, Configuración → Básica. Ahí están el identificador y la clave secreta.'],
  ['Generar el token temporal', 'En el Explorador de la API, selecciona tu app arriba a la derecha, añade los permisos pages_show_list, pages_read_engagement, instagram_basic e instagram_manage_insights, y pulsa «Generar token de acceso».'],
  ['Pegarlo aquí abajo', 'Los tres datos en el formulario y a conectar. El token temporal se convierte solo en uno permanente.'],
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
          <p className="text-body-sm text-ink/60 mt-5">
            Al usar solo tu propia cuenta, la app puede quedarse en modo desarrollo:
            no hace falta pasar la revisión de Meta.
          </p>
        </div>

        <div className="card">
          <FormularioInstagram conectado={conectado} />
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
