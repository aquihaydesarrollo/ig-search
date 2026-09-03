import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function Metricas() {
  const dias = await query<any>(
    `SELECT fecha, seguidores, alcance, visitas_perfil, clics_web, interacciones
       FROM metricas_propias ORDER BY fecha DESC LIMIT 30`,
  );

  const acciones = await query<any>(
    `SELECT tipo, SUM(hecha) AS hechas, count(*) AS total
       FROM tareas_diarias WHERE fecha > date('now','-30 days')
      GROUP BY tipo ORDER BY total DESC`,
  );

  const hoy = dias[0];
  const hace7 = dias.find((d: any) =>
    (new Date(dias[0]?.fecha).getTime() - new Date(d.fecha).getTime()) / 86_400_000 >= 7);
  const crecimiento = hoy && hace7 ? (hoy.seguidores ?? 0) - (hace7.seguidores ?? 0) : null;

  return (
    <div className="space-y-12">
      <section>
        <p className="eyebrow mb-4">Tu cuenta</p>
        <h1 className="text-3xl sm:text-display font-normal">Métricas.</h1>
      </section>

      {dias.length === 0 ? (
        <section className="bg-cream p-6 sm:p-8 rounded-lg space-y-3">
          <h2 className="text-headline">Aún no hay métricas.</h2>
          <p className="text-body text-ink/70 max-w-2xl">
            Hacen falta las credenciales de Meta. Rellena{' '}
            <code className="font-mono">META_ACCESS_TOKEN</code> y{' '}
            <code className="font-mono">META_IG_USER_ID</code>, y ejecuta el barrido.
          </p>
        </section>
      ) : (
        <>
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Tarjeta valor={hoy.seguidores ?? '—'} etiqueta="seguidores" fondo="bg-lilac"
                     extra={crecimiento != null ? `${crecimiento >= 0 ? '+' : ''}${crecimiento} en 7 días` : undefined} />
            <Tarjeta valor={hoy.alcance ?? '—'} etiqueta="alcance del día" fondo="bg-lime" />
            <Tarjeta valor={hoy.visitas_perfil ?? '—'} etiqueta="visitas al perfil" fondo="bg-cream" />
            <Tarjeta valor={hoy.interacciones ?? '—'} etiqueta="interacciones" fondo="bg-mint" />
          </section>

          <section>
            <p className="eyebrow mb-4">Últimos 30 días</p>
            <div className="overflow-x-auto border-t border-hairline">
              <table className="w-full text-body-sm min-w-[520px]">
                <thead>
                  <tr className="border-b border-hairline text-left">
                    {['Fecha', 'Seguidores', 'Alcance', 'Visitas', 'Clics web'].map((h) => (
                      <th key={h} className="py-3 font-mono text-caption uppercase tracking-[0.6px] text-ink/50">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dias.map((d: any) => (
                    <tr key={d.fecha} className="border-b border-hairline-soft">
                      <td className="py-2.5">{new Date(d.fecha).toLocaleDateString('es-ES')}</td>
                      <td>{d.seguidores ?? '—'}</td>
                      <td>{d.alcance ?? '—'}</td>
                      <td>{d.visitas_perfil ?? '—'}</td>
                      <td>{d.clics_web ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {acciones.length > 0 && (
        <section className="bg-navy text-inverse-ink p-6 sm:p-8 rounded-lg">
          <p className="font-mono text-eyebrow uppercase tracking-[0.54px] text-inverse-ink/60 mb-5">
            Acciones completadas · 30 días
          </p>
          <div className="flex flex-wrap gap-x-12 gap-y-5">
            {acciones.map((a: any) => (
              <div key={a.tipo}>
                <div className="text-headline">{a.hechas ?? 0}<span className="text-inverse-ink/40"> / {a.total}</span></div>
                <div className="font-mono text-caption uppercase tracking-[0.6px] text-inverse-ink/60 mt-1">
                  {a.tipo}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Tarjeta({ valor, etiqueta, fondo, extra }: {
  valor: number | string; etiqueta: string; fondo: string; extra?: string;
}) {
  return (
    <div className={`${fondo} rounded-lg p-6`}>
      <div className="text-headline leading-none">{valor}</div>
      <div className="eyebrow mt-3 text-ink/60">{etiqueta}</div>
      {extra && <div className="text-body-sm text-ink/70 mt-2">{extra}</div>}
    </div>
  );
}
