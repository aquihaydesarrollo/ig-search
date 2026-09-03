import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

const FONDOS = ['bg-lime', 'bg-lilac', 'bg-cream', 'bg-mint', 'bg-pink', 'bg-coral'];

export default async function Competencia() {
  const perfiles = await query<any>(
    `SELECT handle, seguidores, num_publicaciones, ultima_publicacion,
            engagement_medio, frecuencia_semanal
       FROM perfiles_ig WHERE es_competidor = 1
      ORDER BY seguidores DESC NULLS LAST`,
  );

  const mejores = await query<any>(
    `SELECT p.handle, p.texto, p.permalink, p.likes, p.comentarios, p.publicada_en, p.tipo
       FROM publicaciones p
       JOIN perfiles_ig pf ON pf.handle = p.handle
      WHERE pf.es_competidor = 1 AND p.publicada_en > datetime('now','-30 days')
      ORDER BY (COALESCE(p.likes,0) + COALESCE(p.comentarios,0) * 3) DESC
      LIMIT 12`,
  );

  return (
    <div className="space-y-12">
      <section>
        <p className="eyebrow mb-4">Vigilancia</p>
        <h1 className="text-3xl sm:text-display font-normal">Competencia local.</h1>
      </section>

      {perfiles.length === 0 ? (
        <section className="bg-cream p-6 sm:p-8 rounded-lg space-y-3">
          <h2 className="text-headline">Sin competidores configurados.</h2>
          <p className="text-body text-ink/70 max-w-2xl">
            Añade sus perfiles de Instagram en <code className="font-mono">config/radar.json</code> y
            ejecuta el barrido. Deben ser cuentas profesionales públicas, y hace falta el token de Meta.
          </p>
        </section>
      ) : (
        <section className="grid gap-4 sm:grid-cols-2">
          {perfiles.map((p, i) => {
            const dias = p.ultima_publicacion
              ? Math.floor((Date.now() - new Date(p.ultima_publicacion).getTime()) / 86_400_000)
              : null;
            return (
              <div key={p.handle} className={`${FONDOS[i % FONDOS.length]} rounded-lg p-6`}>
                <a href={`https://instagram.com/${p.handle}`} target="_blank" rel="noopener noreferrer"
                   className="text-card-title font-bold hover:underline">
                  @{p.handle}
                </a>
                <div className="grid grid-cols-3 gap-4 mt-6">
                  <Metrica valor={p.seguidores ?? '—'} etiqueta="seguidores" />
                  <Metrica valor={p.engagement_medio != null ? `${p.engagement_medio}%` : '—'} etiqueta="engagement" />
                  <Metrica valor={p.frecuencia_semanal ?? '—'} etiqueta="posts/sem" />
                </div>
                <p className="caption mt-6">
                  {dias != null ? `Última publicación hace ${dias} días` : 'Sin publicaciones recientes'}
                  {' · '}{p.num_publicaciones ?? 0} en total
                </p>
              </div>
            );
          })}
        </section>
      )}

      {mejores.length > 0 && (
        <section className="space-y-6">
          <div>
            <p className="eyebrow mb-3">Últimos 30 días</p>
            <h2 className="text-headline">Lo que mejor les está funcionando.</h2>
          </div>

          <div className="border-t border-hairline">
            {mejores.map((m) => (
              <article key={m.permalink} className="border-b border-hairline py-5 flex gap-6 items-start">
                <div className="w-20 shrink-0 text-right">
                  <div className="text-card-title font-bold">{m.likes ?? 0}</div>
                  <div className="caption">me gusta</div>
                  <div className="text-body-sm text-ink/60 mt-2">{m.comentarios ?? 0} coment.</div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="tag bg-lilac">@{m.handle}</span>
                    <span className="caption">{m.tipo}</span>
                    <span className="caption">{new Date(m.publicada_en).toLocaleDateString('es-ES')}</span>
                  </div>
                  <p className="text-body-sm text-ink/70 mt-2 line-clamp-2">
                    {m.texto?.slice(0, 220) ?? 'Sin texto'}
                  </p>
                </div>
                {m.permalink && (
                  <a href={m.permalink} target="_blank" rel="noopener noreferrer" className="pill-secondary shrink-0">
                    Ver
                  </a>
                )}
              </article>
            ))}
          </div>

          <div className="bg-surface-soft rounded-md p-5">
            <p className="text-body-sm text-ink/70">
              Abre un post para ver quién comenta: son negocios locales interesados en marketing.
              La API oficial de Meta no permite extraer esa lista automáticamente.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}

function Metrica({ valor, etiqueta }: { valor: number | string; etiqueta: string }) {
  return (
    <div>
      <div className="text-card-title font-bold leading-none">{valor}</div>
      <div className="font-mono text-caption uppercase tracking-[0.6px] text-ink/50 mt-2">{etiqueta}</div>
    </div>
  );
}
