import { query, queryOne, rutaBaseDatos } from '@/lib/db';
import { getConfig } from '@/lib/config';
import { ajuste, rutaAjustes } from '@/lib/ajustes';
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

      {!ajuste('PANEL_PASSWORD') && (
        <AvisoConfiguracion
          color="bg-coral"
          mensaje="Este panel es público"
          detalle={`Cualquiera con la dirección puede ver tus leads.\n\nDefine PANEL_PASSWORD como variable de entorno (en Hostinger: Website Dashboard → Environment variables), o crea el fichero ${rutaAjustes()} con {"PANEL_PASSWORD": "tu-contraseña"}.`}
        />
      )}

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

      <section className="border-t border-hairline-soft pt-6 space-y-1">
        <p className="caption break-all">Base de datos: {rutaBaseDatos()}</p>
        {ultima && (
          <p className="caption">
            Último barrido: {ultima.iniciada_en} · {ultima.estado} · {ultima.negocios_nuevos} nuevos
            · {ultima.webs_auditadas} webs auditadas
          </p>
        )}
        {ultima?.error && (
          <p className="text-body-sm text-ink/60 mt-2">Avisos: {ultima.error}</p>
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
