import { query, queryOne, rutaBaseDatos } from '@/lib/db';
import { getConfig } from '@/lib/config';
import TareaFila, { type Tarea } from '@/components/TareaFila';
import AvisoConfiguracion from '@/components/AvisoConfiguracion';
import BotonRadar from '@/components/BotonRadar';

export const dynamic = 'force-dynamic';

export default async function Hoy() {
  const cfg = getConfig();

  const filas = await query<any>(
    `SELECT id, tipo, handle, enlace, contexto, hecha
       FROM tareas_diarias WHERE fecha = date('now') ORDER BY hecha ASC, id ASC`,
  );
  const tareas: Tarea[] = filas.map((f) => ({ ...f, hecha: Boolean(f.hecha) }));

  const ultima = await queryOne<any>(
    `SELECT iniciada_en, estado, negocios_nuevos, webs_auditadas, tareas_generadas, error
       FROM ejecuciones ORDER BY id DESC LIMIT 1`,
  );

  const stats = await queryOne<any>(
    `SELECT
       (SELECT count(*) FROM negocios) AS negocios,
       (SELECT count(*) FROM leads WHERE estado = 'nuevo' AND score >= 40) AS leads_calientes,
       (SELECT count(*) FROM tareas_diarias WHERE fecha = date('now') AND hecha = 1) AS hechas_hoy`,
  );

  const pendientes = tareas.filter((t) => !t.hecha).length;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Tareas de hoy</h1>
          <p className="text-muted text-sm mt-1">
            {pendientes > 0
              ? `${pendientes} acciones pendientes · unos ${Math.max(Math.round(pendientes * 1.2), 5)} minutos`
              : tareas.length > 0
                ? 'Todo hecho por hoy.'
                : 'Todavía no hay lista. Ejecuta el radar para generarla.'}
          </p>
        </div>
        <div className="flex gap-3 text-sm">
          <Dato valor={stats?.negocios ?? 0} etiqueta="negocios" />
          <Dato valor={stats?.leads_calientes ?? 0} etiqueta="leads calientes" />
          <Dato valor={stats?.hechas_hoy ?? 0} etiqueta="hechas hoy" />
        </div>
      </div>

      {(stats?.negocios ?? 0) === 0 && (
        <div className="tarjeta border-warn/50 bg-warn/10 space-y-3">
          <p className="font-medium">Todavía no hay ningún negocio</p>
          <p className="text-sm text-muted">
            El primer barrido buscará negocios de {cfg.ciudad} en OpenStreetMap y auditará sus
            webs. Tarda entre 15 y 25 minutos porque OpenStreetMap limita las consultas.
          </p>
          <BotonRadar texto="Ejecutar el primer barrido" />
        </div>
      )}

      {!process.env.PANEL_PASSWORD && (
        <AvisoConfiguracion
          mensaje="Este panel es público"
          detalle="Cualquiera con la dirección puede ver tus leads. Define la variable de entorno PANEL_PASSWORD para pedir contraseña al entrar."
        />
      )}

      {tareas.length > 0 && (
        <div className="space-y-2">
          {tareas.map((t) => <TareaFila key={t.id} tarea={t} />)}
        </div>
      )}

      <div className="tarjeta">
        <p className="etiqueta mb-2">Límites diarios de seguridad</p>
        <p className="text-sm text-muted">
          {cfg.limitesDiarios.comentarios} comentarios · {cfg.limitesDiarios.likes} likes ·{' '}
          {cfg.limitesDiarios.seguimientos} seguimientos. Muy por debajo de los umbrales de
          Instagram, a propósito. Las acciones las haces tú desde la app; aquí solo se registran.
        </p>
      </div>

      {(stats?.negocios ?? 0) > 0 && (
        <div className="tarjeta">
          <p className="etiqueta mb-2">Barrido manual</p>
          <p className="text-sm text-muted mb-3">
            Normalmente lo lanza la tarea programada cada noche. Puedes forzarlo aquí.
          </p>
          <BotonRadar />
        </div>
      )}

      <p className="text-xs text-muted">Base de datos: {rutaBaseDatos()}</p>

      {ultima && (
        <p className="text-xs text-muted">
          Último barrido: {ultima.iniciada_en} · estado {ultima.estado} ·{' '}
          {ultima.negocios_nuevos} negocios nuevos · {ultima.webs_auditadas} webs auditadas
          {ultima.error && <span className="text-warn"> · avisos: {ultima.error}</span>}
        </p>
      )}
    </div>
  );
}

function Dato({ valor, etiqueta }: { valor: number | string; etiqueta: string }) {
  return (
    <div className="tarjeta py-2 px-3 text-center min-w-[92px]">
      <div className="text-xl font-semibold">{valor}</div>
      <div className="etiqueta">{etiqueta}</div>
    </div>
  );
}
