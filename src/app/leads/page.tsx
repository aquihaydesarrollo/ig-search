import { query } from '@/lib/db';
import { SECTORES } from '@/lib/osm';
import EstadoLead from '@/components/EstadoLead';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ estado?: string; sector?: string }>;
}

const ESTADOS = ['nuevo', 'contactado', 'en_conversacion', 'cliente', 'descartado', 'todos'];

/** El color del bloque de puntuacion indica lo caliente que esta el lead. */
function fondoScore(score: number): string {
  if (score >= 50) return 'bg-lilac';
  if (score >= 40) return 'bg-lime';
  if (score >= 25) return 'bg-cream';
  return 'bg-surface-soft';
}

export default async function Leads({ searchParams }: Props) {
  const { estado = 'nuevo', sector } = await searchParams;

  const filas = await query<any>(
    `SELECT n.id, n.nombre, n.sector, n.web, n.telefono, n.osm_url, n.instagram_tag,
            l.score, l.motivos, l.estado,
            a.instagram_handle, a.tecnologia,
            p.seguidores
       FROM leads l
       JOIN negocios n ON n.id = l.negocio_id
       LEFT JOIN auditorias_web a ON a.negocio_id = n.id
       LEFT JOIN perfiles_ig p ON p.negocio_id = n.id
      WHERE (? = 'todos' OR l.estado = ?)
        AND (? IS NULL OR n.sector = ?)
      ORDER BY l.score DESC, n.nombre
      LIMIT 200`,
    [estado, estado, sector ?? null, sector ?? null],
  );

  const sectores = await query<{ sector: string; n: number }>(
    `SELECT sector, count(*) AS n FROM negocios WHERE sector IS NOT NULL
      GROUP BY sector ORDER BY n DESC`,
  );

  return (
    <div className="space-y-10">
      <section>
        <p className="eyebrow mb-4">Oportunidades detectadas</p>
        <h1 className="text-3xl sm:text-display font-normal">
          {filas.length} {filas.length === 1 ? 'lead' : 'leads'}
        </h1>
      </section>

      <section className="space-y-4">
        <div className="flex gap-2 flex-wrap">
          {ESTADOS.map((e) => (
            <a
              key={e}
              href={`/leads?estado=${e}${sector ? `&sector=${encodeURIComponent(sector)}` : ''}`}
              className={e === estado
                ? 'pill-sm bg-ink text-canvas'
                : 'pill-sm border border-hairline hover:bg-surface-soft'}
            >
              {e.replace('_', ' ')}
            </a>
          ))}
        </div>

        {sectores.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            <a href={`/leads?estado=${estado}`}
               className={!sector ? 'tag bg-ink text-canvas' : 'tag bg-surface-soft hover:bg-hairline'}>
              todos
            </a>
            {sectores.map((s) => (
              <a key={s.sector}
                 href={`/leads?estado=${estado}&sector=${encodeURIComponent(s.sector)}`}
                 className={sector === s.sector ? 'tag bg-ink text-canvas' : 'tag bg-surface-soft hover:bg-hairline'}>
                {SECTORES[s.sector]?.nombre ?? s.sector} · {s.n}
              </a>
            ))}
          </div>
        )}
      </section>

      {filas.length === 0 ? (
        <div className="bg-cream rounded-lg p-12 text-center">
          <p className="text-headline">Sin leads con este filtro.</p>
        </div>
      ) : (
        <section className="border-t border-hairline">
          {filas.map((f) => {
            let motivos: string[] = [];
            try { motivos = JSON.parse(f.motivos ?? '[]'); } catch { motivos = []; }
            const handle = f.instagram_tag ?? f.instagram_handle;

            return (
              <article key={f.id} className="border-b border-hairline py-6 flex items-start gap-4 sm:gap-6">
                <div className={`${fondoScore(f.score)} rounded-md w-16 shrink-0 py-3 text-center`}>
                  <div className="text-headline leading-none">{f.score}</div>
                  <div className="font-mono text-caption uppercase tracking-[0.6px] text-ink/50 mt-1.5">
                    score
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <h2 className="text-card-title font-bold">{f.nombre}</h2>
                    <span className="caption">{SECTORES[f.sector]?.nombre ?? f.sector}</span>
                    {f.tecnologia && <span className="caption">· {f.tecnologia}</span>}
                    <div className="ml-auto">
                      <EstadoLead negocioId={f.id} estadoActual={f.estado} />
                    </div>
                  </div>

                  <ul className="mt-3 space-y-1">
                    {motivos.map((m, i) => (
                      <li key={i} className="text-body-sm text-ink/70 flex gap-2">
                        <span className="text-ink/30">—</span>
                        <span>{m}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="flex gap-2 mt-4 flex-wrap">
                    {handle && (
                      <a href={`https://instagram.com/${handle}`} target="_blank" rel="noopener noreferrer"
                         className="tag bg-lilac hover:bg-lilac/70">
                        @{handle}{f.seguidores ? ` · ${f.seguidores}` : ''}
                      </a>
                    )}
                    {f.web && (
                      <a href={f.web} target="_blank" rel="noopener noreferrer"
                         className="tag bg-surface-soft hover:bg-hairline">web</a>
                    )}
                    {f.telefono && (
                      <a href={`tel:${f.telefono}`} className="tag bg-mint hover:bg-mint/70">{f.telefono}</a>
                    )}
                    {f.osm_url && (
                      <a href={f.osm_url} target="_blank" rel="noopener noreferrer"
                         className="tag bg-surface-soft hover:bg-hairline">mapa</a>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
