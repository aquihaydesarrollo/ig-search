'use client';

import { useState, useTransition } from 'react';
import { analizarCuenta } from '@/app/analisis/acciones';
import type { Analisis } from '@/lib/analisis';

const FONDOS = ['bg-lime', 'bg-lilac', 'bg-cream', 'bg-mint'];

export default function InformeAnalisis({ sugerencias }: { sugerencias: string[] }) {
  const [handle, setHandle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [a, setA] = useState<Analisis | null>(null);
  const [pendiente, startTransition] = useTransition();

  function analizar(objetivo?: string) {
    const h = (objetivo ?? handle).trim();
    if (!h) return;
    setHandle(h); setError(null);
    startTransition(async () => {
      const r = await analizarCuenta(h);
      if (r.ok && r.analisis) { setA(r.analisis); setError(null); }
      else { setA(null); setError(r.mensaje ?? 'No se pudo analizar.'); }
    });
  }

  return (
    <div className="space-y-10">
      <div className="card space-y-4">
        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-[220px] flex items-center rounded-md border border-hairline
                          bg-canvas focus-within:border-ink">
            <span className="pl-4 font-mono text-body-sm text-ink/40">@</span>
            <input
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && analizar()}
              placeholder="usuario_de_instagram"
              autoComplete="off" spellCheck={false}
              className="w-full bg-transparent px-2 py-3 font-mono text-body-sm outline-none"
            />
          </div>
          <button onClick={() => analizar()} disabled={pendiente} className="pill-primary">
            {pendiente ? 'Analizando…' : 'Analizar'}
          </button>
        </div>

        {sugerencias.length > 0 && (
          <div className="flex gap-2 flex-wrap items-center">
            <span className="caption">Tu competencia:</span>
            {sugerencias.map((s) => (
              <button key={s} onClick={() => analizar(s)} disabled={pendiente}
                      className="tag bg-surface-soft hover:bg-hairline">@{s}</button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="bg-coral rounded-lg p-6">
          <p className="text-body-sm">{error}</p>
        </div>
      )}

      {a && <Informe a={a} />}
    </div>
  );
}

function Informe({ a }: { a: Analisis }) {
  return (
    <div className="space-y-10">
      {/* Cabecera */}
      <section>
        <p className="eyebrow mb-3">Informe de cuenta</p>
        <h2 className="text-3xl sm:text-display font-normal">@{a.handle}</h2>
        {a.biografia && <p className="text-body text-ink/60 mt-3 max-w-2xl">{a.biografia}</p>}
        <p className="caption mt-3">
          {a.analizadas} publicaciones analizadas
          {a.desde && ` · desde ${new Date(a.desde).toLocaleDateString('es-ES')}`}
        </p>
      </section>

      {/* Cifras clave */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Cifra fondo="bg-lilac" valor={a.seguidores?.toLocaleString('es-ES') ?? '—'} etiqueta="seguidores" />
        <Cifra fondo="bg-lime" valor={a.engagementTipico != null ? `${a.engagementTipico}%` : '—'}
               etiqueta="engagement típico" pie="mediana, no la media" />
        <Cifra fondo="bg-cream" valor={a.publicacionesPorSemana ?? '—'} etiqueta="posts por semana" />
        <Cifra fondo="bg-mint" valor={a.interaccionesMediana.toLocaleString('es-ES')}
               etiqueta="interacciones normales" pie={`media: ${a.interaccionesMedia.toLocaleString('es-ES')}`} />
      </section>

      {/* Conclusiones */}
      {a.conclusiones.length > 0 && (
        <section className="bg-navy text-inverse-ink rounded-lg p-6 sm:p-8">
          <p className="font-mono text-eyebrow uppercase tracking-[0.54px] text-inverse-ink/60 mb-5">
            Lectura del informe
          </p>
          <ul className="space-y-3">
            {a.conclusiones.map((c, i) => (
              <li key={i} className="flex gap-3 text-body leading-relaxed">
                <span className="text-inverse-ink/35 shrink-0">—</span><span>{c}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Formatos */}
      {a.formatos.length > 0 && (
        <section className="space-y-4">
          <h3 className="text-headline">Qué formato le funciona</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            {a.formatos.map((f, i) => (
              <div key={f.tipo} className={`${FONDOS[i % FONDOS.length]} rounded-lg p-6`}>
                <p className="text-card-title font-bold">{f.nombre}</p>
                <p className="text-3xl mt-3 leading-none">{f.interaccionesMedia.toLocaleString('es-ES')}</p>
                <p className="eyebrow mt-2 text-ink/60">interacciones típicas</p>
                <p className="text-body-sm text-ink/70 mt-4">
                  {f.publicaciones} publicaciones · {f.porcentaje}% del feed
                  {f.engagementMedio != null && ` · ${f.engagementMedio}% engagement`}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Momento */}
      {(a.mejorDia || a.mejorFranja || a.tendencia) && (
        <section className="grid gap-4 sm:grid-cols-3">
          {a.mejorDia && (
            <Bloque titulo="Mejor día" valor={a.mejorDia.dia}
                    pie={`${a.mejorDia.interaccionesMedia} interacciones de media · ${a.mejorDia.publicaciones} publicaciones`} />
          )}
          {a.mejorFranja && (
            <Bloque titulo="Mejor franja" valor={a.mejorFranja.franja}
                    pie={`${a.mejorFranja.interaccionesMedia} interacciones de media`} />
          )}
          {a.tendencia && (
            <Bloque titulo="Tendencia"
                    valor={`${a.tendencia.variacion >= 0 ? '+' : ''}${a.tendencia.variacion}%`}
                    pie={`Últimas ${a.tendencia.ultimas} frente a ${a.tendencia.primeras} anteriores`} />
          )}
        </section>
      )}

      {/* Virales */}
      {a.virales.length > 0 && (
        <section className="space-y-4">
          <h3 className="text-headline">Lo que más le ha funcionado</h3>
          <div className="border-t border-hairline">
            {a.virales.map((p) => (
              <article key={p.id} className="border-b border-hairline py-5 flex gap-5 items-start">
                <div className={`shrink-0 w-20 rounded-md py-3 text-center
                                ${p.factorViral >= 2 ? 'bg-lilac' : 'bg-surface-soft'}`}>
                  <div className="text-card-title font-bold leading-none">×{p.factorViral}</div>
                  <div className="font-mono text-caption uppercase tracking-[0.6px] text-ink/50 mt-1.5">
                    sobre lo normal
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex gap-3 flex-wrap items-center">
                    <span className="tag bg-surface-soft">{p.tipo === 'VIDEO' ? 'Vídeo' : p.tipo === 'CAROUSEL_ALBUM' ? 'Carrusel' : 'Imagen'}</span>
                    <span className="caption">{new Date(p.fecha).toLocaleDateString('es-ES')}</span>
                    <span className="caption">{p.likes.toLocaleString('es-ES')} me gusta · {p.comentarios} comentarios</span>
                  </div>
                  <p className="text-body-sm text-ink/70 mt-2 line-clamp-2">{p.texto ?? 'Sin texto'}</p>
                </div>
                {p.permalink && p.permalink !== '#' && (
                  <a href={p.permalink} target="_blank" rel="noopener noreferrer"
                     className="pill-secondary shrink-0 hidden sm:inline-flex">Ver</a>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Texto y hashtags */}
      <section className="bg-surface-soft rounded-lg p-6 sm:p-8 space-y-5">
        <p className="eyebrow">Cómo escribe</p>
        <div className="flex flex-wrap gap-x-12 gap-y-4">
          <Dato valor={a.hashtagsPorPublicacion} etiqueta="hashtags por publicación" />
          <Dato valor={a.longitudTextoMedia} etiqueta="caracteres de texto" />
          <Dato valor={`${a.ratioComentarios}%`} etiqueta="son comentarios" />
        </div>
        {a.hashtagsFrecuentes.length > 0 && (
          <div>
            <p className="text-body-sm font-medium mb-2">Hashtags que repite</p>
            <div className="flex gap-2 flex-wrap">
              {a.hashtagsFrecuentes.map((h) => (
                <span key={h.etiqueta} className="tag bg-canvas border border-hairline">
                  {h.etiqueta} · {h.veces}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function Cifra({ valor, etiqueta, fondo, pie }: {
  valor: string | number; etiqueta: string; fondo: string; pie?: string;
}) {
  return (
    <div className={`${fondo} rounded-lg p-6`}>
      <div className="text-3xl leading-none">{valor}</div>
      <div className="eyebrow mt-3 text-ink/60">{etiqueta}</div>
      {pie && <div className="text-body-sm text-ink/55 mt-1">{pie}</div>}
    </div>
  );
}

function Bloque({ titulo, valor, pie }: { titulo: string; valor: string; pie: string }) {
  return (
    <div className="card">
      <p className="eyebrow">{titulo}</p>
      <p className="text-card-title font-bold mt-3">{valor}</p>
      <p className="text-body-sm text-ink/60 mt-2">{pie}</p>
    </div>
  );
}

function Dato({ valor, etiqueta }: { valor: string | number; etiqueta: string }) {
  return (
    <div>
      <div className="text-card-title font-bold">{valor}</div>
      <div className="font-mono text-caption uppercase tracking-[0.6px] text-ink/50 mt-1">{etiqueta}</div>
    </div>
  );
}
