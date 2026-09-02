import { query, baseDatosExiste } from '@/lib/db';
import AvisoConfiguracion from '@/components/AvisoConfiguracion';

export const dynamic = 'force-dynamic';

export default async function Competencia() {
  if (!baseDatosExiste()) {
    return <AvisoConfiguracion mensaje="Falta crear la base de datos" detalle="Ejecuta: npm run db:init" />;
  }

  const perfiles = await query<any>(
    `SELECT handle, seguidores, num_publicaciones, biografia, ultima_publicacion,
            engagement_medio, frecuencia_semanal, revisado_en
       FROM perfiles_ig
      WHERE es_competidor = 1
      ORDER BY seguidores DESC NULLS LAST`,
  );

  const mejores = await query<any>(
    `SELECT p.handle, p.texto, p.permalink, p.likes, p.comentarios, p.publicada_en, p.tipo
       FROM publicaciones p
       JOIN perfiles_ig pf ON pf.handle = p.handle
      WHERE pf.es_competidor = 1
        AND p.publicada_en > datetime('now','-30 days')
      ORDER BY (COALESCE(p.likes,0) + COALESCE(p.comentarios,0) * 3) DESC
      LIMIT 15`,
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Competencia local</h1>

      {perfiles.length === 0 ? (
        <div className="tarjeta text-muted">
          Sin competidores configurados. Añade sus perfiles de Instagram en{' '}
          <code className="text-white">config/radar.json</code> y ejecuta el radar.
          Deben ser cuentas profesionales públicas.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {perfiles.map((p) => {
            const dias = p.ultima_publicacion
              ? Math.floor((Date.now() - new Date(p.ultima_publicacion).getTime()) / 86_400_000)
              : null;
            return (
              <div key={p.handle} className="tarjeta">
                <a href={`https://instagram.com/${p.handle}`} target="_blank" rel="noopener noreferrer"
                   className="font-medium text-brand hover:underline">
                  @{p.handle}
                </a>
                <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                  <Metrica valor={p.seguidores ?? '—'} etiqueta="seguidores" />
                  <Metrica valor={p.engagement_medio != null ? `${p.engagement_medio}%` : '—'} etiqueta="engagement" />
                  <Metrica valor={p.frecuencia_semanal ?? '—'} etiqueta="posts/semana" />
                </div>
                <p className="text-xs text-muted mt-3">
                  {dias != null ? `Última publicación hace ${dias} días` : 'Sin publicaciones recientes'}
                  {' · '}{p.num_publicaciones ?? 0} publicaciones en total
                </p>
              </div>
            );
          })}
        </div>
      )}

      {mejores.length > 0 && (
        <div>
          <h2 className="text-lg font-medium mb-3">Lo que mejor les está funcionando (30 días)</h2>
          <div className="space-y-2">
            {mejores.map((m) => (
              <div key={m.permalink} className="tarjeta flex gap-4 items-start">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <span className="text-brand">@{m.handle}</span>
                    <span>{m.tipo}</span>
                    <span>{new Date(m.publicada_en).toLocaleDateString('es-ES')}</span>
                  </div>
                  <p className="text-sm mt-1.5 line-clamp-2 text-muted">
                    {m.texto?.slice(0, 220) ?? 'Sin texto'}
                  </p>
                </div>
                <div className="text-right shrink-0 text-xs text-muted">
                  <div className="text-white font-medium">{m.likes ?? 0} ♥</div>
                  <div>{m.comentarios ?? 0} coment.</div>
                </div>
                {m.permalink && (
                  <a href={m.permalink} target="_blank" rel="noopener noreferrer"
                     className="boton bg-line hover:bg-brand shrink-0">Ver →</a>
                )}
              </div>
            ))}
          </div>
          <p className="text-xs text-muted mt-3">
            Abre un post para ver quién comenta: son negocios locales interesados en marketing.
            La API oficial de Meta no permite extraer esa lista automáticamente.
          </p>
        </div>
      )}
    </div>
  );
}

function Metrica({ valor, etiqueta }: { valor: number | string; etiqueta: string }) {
  return (
    <div>
      <div className="font-semibold">{valor}</div>
      <div className="etiqueta">{etiqueta}</div>
    </div>
  );
}
