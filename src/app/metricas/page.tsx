import { query, baseDatosExiste } from '@/lib/db';
import AvisoConfiguracion from '@/components/AvisoConfiguracion';

export const dynamic = 'force-dynamic';

export default async function Metricas() {
  if (!baseDatosExiste()) {
    return <AvisoConfiguracion mensaje="Falta crear la base de datos" detalle="Ejecuta: npm run db:init" />;
  }

  const dias = await query<any>(
    `SELECT fecha, seguidores, alcance, visitas_perfil, clics_web, interacciones
       FROM metricas_propias ORDER BY fecha DESC LIMIT 30`,
  );

  const acciones = await query<any>(
    `SELECT tipo, SUM(hecha) AS hechas, count(*) AS total
       FROM tareas_diarias
      WHERE fecha > date('now','-30 days')
      GROUP BY tipo ORDER BY total DESC`,
  );

  const hoy = dias[0];
  const hace7 = dias.find((d: any) => {
    const diff = (new Date(dias[0]?.fecha).getTime() - new Date(d.fecha).getTime()) / 86_400_000;
    return diff >= 7;
  });
  const crecimiento = hoy && hace7 ? (hoy.seguidores ?? 0) - (hace7.seguidores ?? 0) : null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Métricas de la cuenta</h1>

      {dias.length === 0 ? (
        <div className="tarjeta text-muted">
          Aún no hay métricas. Configura las credenciales de Meta en <code className="text-white">.env.local</code>{' '}
          y ejecuta el radar.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Tarjeta valor={hoy.seguidores ?? '—'} etiqueta="seguidores"
                     extra={crecimiento != null ? `${crecimiento >= 0 ? '+' : ''}${crecimiento} en 7 días` : undefined} />
            <Tarjeta valor={hoy.alcance ?? '—'} etiqueta="alcance (día)" />
            <Tarjeta valor={hoy.visitas_perfil ?? '—'} etiqueta="visitas al perfil" />
            <Tarjeta valor={hoy.interacciones ?? '—'} etiqueta="interacciones" />
          </div>

          <div className="tarjeta overflow-x-auto">
            <p className="etiqueta mb-3">Últimos 30 días</p>
            <table className="w-full text-sm">
              <thead className="text-muted text-xs">
                <tr className="text-left">
                  <th className="pb-2">Fecha</th><th>Seguidores</th><th>Alcance</th>
                  <th>Visitas perfil</th><th>Clics web</th>
                </tr>
              </thead>
              <tbody>
                {dias.map((d: any) => (
                  <tr key={d.fecha} className="border-t border-line">
                    <td className="py-1.5">{new Date(d.fecha).toLocaleDateString('es-ES')}</td>
                    <td>{d.seguidores ?? '—'}</td>
                    <td>{d.alcance ?? '—'}</td>
                    <td>{d.visitas_perfil ?? '—'}</td>
                    <td>{d.clics_web ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {acciones.length > 0 && (
        <div className="tarjeta">
          <p className="etiqueta mb-3">Acciones completadas (30 días)</p>
          <div className="space-y-1.5">
            {acciones.map((a: any) => (
              <div key={a.tipo} className="flex justify-between text-sm">
                <span className="capitalize">{a.tipo}</span>
                <span className="text-muted">{a.hechas} de {a.total}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Tarjeta({ valor, etiqueta, extra }: { valor: number | string; etiqueta: string; extra?: string }) {
  return (
    <div className="tarjeta">
      <div className="text-2xl font-semibold">{valor}</div>
      <div className="etiqueta mt-0.5">{etiqueta}</div>
      {extra && <div className="text-xs text-ok mt-1">{extra}</div>}
    </div>
  );
}
