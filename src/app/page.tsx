import { query, queryOne, rutaBaseDatos } from '@/lib/db';
import { getConfig } from '@/lib/config';
import { ajuste, rutasCandidatas, ajustesExisten } from '@/lib/ajustes';
import { SECTORES } from '@/lib/osm';
import TareaFila, { type Tarea } from '@/components/TareaFila';
import AvisoConfiguracion from '@/components/AvisoConfiguracion';
import BotonRadar from '@/components/BotonRadar';

export const dynamic = 'force-dynamic';

export default async function Hoy() {
  const cfg = getConfig();

  const filas = await query<any>(
    `SELECT t.id, t.tipo, t.handle, t.enlace, t.contexto, t.hecha,
            n.nombre, n.sector, n.telefono, l.motivos
       FROM tareas_diarias t
       LEFT JOIN negocios n ON n.id = t.negocio_id
       LEFT JOIN leads l ON l.negocio_id = t.negocio_id
      WHERE t.fecha = date('now')
      ORDER BY t.hecha ASC, l.score DESC, t.id ASC`,
  );

  const tareas: Tarea[] = filas.map((f) => {
    let motivos: string[] = [];
    try { motivos = JSON.parse(f.motivos ?? '[]'); } catch { motivos = []; }
    return {
      ...f,
      hecha: Boolean(f.hecha),
      sector: f.sector ? (SECTORES[f.sector]?.nombre ?? f.sector) : null,
      motivos,
    };
  });

  const ultima = await queryOne<any>(
    `SELECT iniciada_en, estado, negocios_nuevos, webs_auditadas, error
       FROM ejecuciones ORDER BY id DESC LIMIT 1`,
  );

  const stats = await queryOne<any>(
    `SELECT
       (SELECT count(*) FROM negocios) AS negocios,
       (SELECT count(*) FROM leads WHERE estado = 'nuevo' AND score >= 40) AS calientes,
       (SELECT count(*) FROM tareas_diarias WHERE fecha = date('now') AND hecha = 1) AS hechas`,
  );

  const pendientes = tareas.filter((t) => !t.hecha).length;
  const vacia = (stats?.negocios ?? 0) === 0;

  return (
    <div className="space-y-12">
      {/* Titular editorial */}
      <section>
        <p className="eyebrow mb-4">Tareas de hoy</p>
        <h1 className="text-3xl sm:text-display font-normal max-w-3xl">
          {pendientes > 0
            ? `${pendientes} acciones pendientes.`
            : tareas.length > 0
              ? 'Todo hecho por hoy.'
              : 'Sin lista todavía.'}
        </h1>
        {pendientes > 0 && (
          <p className="text-body text-ink/60 mt-4">
            Unos {Math.max(Math.round(pendientes * 1.2), 5)} minutos de trabajo.
          </p>
        )}
      </section>

      {/* Cifras en bloques pastel */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Cifra valor={stats?.negocios ?? 0} etiqueta="negocios rastreados" fondo="bg-lime" />
        <Cifra valor={stats?.calientes ?? 0} etiqueta="leads calientes" fondo="bg-lilac" />
        <Cifra valor={stats?.hechas ?? 0} etiqueta="acciones hechas hoy" fondo="bg-cream" />
      </section>

      {vacia && (
        <section className="bg-lime p-6 sm:p-8 rounded-lg space-y-4">
          <p className="eyebrow">Primer paso</p>
          <h2 className="text-headline max-w-2xl">Todavía no hay ningún negocio.</h2>
          <p className="text-body text-ink/70 max-w-2xl">
            El primer barrido buscará negocios de {cfg.ciudad} en OpenStreetMap y auditará sus
            webs. Tarda entre 15 y 25 minutos porque OpenStreetMap limita las consultas.
          </p>
          <BotonRadar texto="Ejecutar el primer barrido" />
        </section>
      )}

      <AvisoConfiguracion
        color="bg-coral"
        mensaje="Este panel es público"
        detalle={'La contraseña está desactivada en el código: cualquiera con la dirección puede ver tus leads. Para reactivarla, pon AUTENTICACION_ACTIVA a true en src/proxy.ts y define PANEL_PASSWORD. Abre /api/diagnostico para ver de dónde toma cada ajuste este servidor.'}
      />

      {tareas.length > 0 && (
        <section className="card py-0">
          {tareas.map((t) => <TareaFila key={t.id} tarea={t} />)}
        </section>
      )}

      {/* Limites de seguridad */}
      <section className="bg-navy text-inverse-ink p-6 sm:p-8 rounded-lg">
        <p className="font-mono text-eyebrow uppercase tracking-[0.54px] text-inverse-ink/60 mb-4">
          Límites diarios de seguridad
        </p>
        <div className="flex flex-wrap gap-x-12 gap-y-4 mb-5">
          <Limite valor={cfg.limitesDiarios.comentarios} etiqueta="comentarios" />
          <Limite valor={cfg.limitesDiarios.likes} etiqueta="likes" />
          <Limite valor={cfg.limitesDiarios.seguimientos} etiqueta="seguimientos" />
        </div>
        <p className="text-body-sm text-inverse-ink/70 max-w-2xl leading-relaxed">
          Muy por debajo de los umbrales de Instagram, a propósito. Las acciones las haces tú
          desde la app; aquí solo se registran.
        </p>
      </section>

      {!vacia && (
        <section className="card space-y-4">
          <p className="eyebrow">Barrido manual</p>
          <p className="text-body text-ink/70 max-w-2xl">
            Normalmente lo lanza la tarea programada cada noche. Puedes forzarlo aquí.
          </p>
          <BotonRadar />
        </section>
      )}

      {/* Rutas reales de este servidor, para no tener que adivinarlas */}
      <section className="bg-surface-soft rounded-lg p-6 sm:p-8 space-y-5">
        <p className="eyebrow">Dónde va cada cosa</p>

        <div>
          <p className="text-body-sm font-medium mb-1">Base de datos</p>
          <code className="text-body-sm font-mono break-all text-ink/70">{rutaBaseDatos()}</code>
        </div>

        <div>
          <p className="text-body-sm font-medium mb-1">
            Ajustes {ajustesExisten() ? '· fichero encontrado' : '· ningún fichero todavía'}
          </p>
          <p className="text-body-sm text-ink/60 mb-2">
            Crea un <code className="font-mono">ajustes.json</code> en cualquiera de estas rutas.
            Se usa la primera que exista:
          </p>
          <ol className="space-y-1">
            {rutasCandidatas().map((r) => (
              <li key={r} className="text-body-sm font-mono break-all text-ink/70">
                <span className="text-ink/35 mr-2">—</span>{r}
              </li>
            ))}
          </ol>
          <pre className="mt-3 bg-canvas border border-hairline rounded-md p-4 text-body-sm
                          font-mono overflow-x-auto">{`{
  "PANEL_PASSWORD": "tu contraseña",
  "RADAR_CRON_SECRET": "cadena aleatoria"
}`}</pre>
          <p className="text-body-sm text-ink/60 mt-3">
            Alternativa: las mismas claves como variables de entorno. En Hostinger están en
            Website Dashboard → Environment variables. Las variables mandan sobre el fichero.
          </p>
        </div>

        {ultima && (
          <div className="border-t border-hairline pt-4">
            <p className="caption">
              Último barrido: {ultima.iniciada_en} · {ultima.estado} · {ultima.negocios_nuevos} nuevos
              · {ultima.webs_auditadas} webs auditadas
            </p>
            {ultima.error && (
              <p className="text-body-sm text-ink/60 mt-2">Avisos: {ultima.error}</p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function Cifra({ valor, etiqueta, fondo }: { valor: number; etiqueta: string; fondo: string }) {
  return (
    <div className={`${fondo} rounded-lg p-6`}>
      <div className="text-5xl sm:text-display-lg font-normal leading-none">{valor}</div>
      <div className="eyebrow mt-3 text-ink/60">{etiqueta}</div>
    </div>
  );
}

function Limite({ valor, etiqueta }: { valor: number; etiqueta: string }) {
  return (
    <div>
      <div className="text-headline">{valor}</div>
      <div className="font-mono text-caption uppercase tracking-[0.6px] text-inverse-ink/60 mt-1">
        {etiqueta}
      </div>
    </div>
  );
}
