'use client';

import { useState, useTransition } from 'react';

/** Cada tipo de accion vive en su propio bloque de color pastel. */
const ETIQUETAS: Record<string, { texto: string; fondo: string }> = {
  comentar: { texto: 'Comentar', fondo: 'bg-lilac' },
  seguir:   { texto: 'Seguir',   fondo: 'bg-lime' },
  like:     { texto: 'Like',     fondo: 'bg-mint' },
  revisar:  { texto: 'Revisar',  fondo: 'bg-coral' },
};

export interface Tarea {
  id: number;
  tipo: string;
  handle: string | null;
  enlace: string | null;
  contexto: string | null;
  hecha: boolean;
  nombre?: string | null;
  sector?: string | null;
  telefono?: string | null;
  motivos?: string[];
}

export default function TareaFila({ tarea }: { tarea: Tarea }) {
  const [hecha, setHecha] = useState(tarea.hecha);
  const [pendiente, startTransition] = useTransition();
  const etiqueta = ETIQUETAS[tarea.tipo] ?? { texto: tarea.tipo, fondo: 'bg-surface-soft' };
  const motivos = tarea.motivos ?? [];

  function alternar() {
    const nuevo = !hecha;
    setHecha(nuevo);
    startTransition(async () => {
      await fetch('/api/tareas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: tarea.id, hecha: nuevo }),
      });
    });
  }

  return (
    <div
      className={`border-b border-hairline last:border-0 py-6 flex gap-4 sm:gap-5 items-start
                  ${hecha ? 'opacity-40' : ''}`}
    >
      <button
        onClick={alternar}
        disabled={pendiente}
        aria-label={hecha ? 'Marcar como pendiente' : 'Marcar como hecha'}
        className={`mt-1 h-6 w-6 shrink-0 rounded-full border transition-colors
                    ${hecha ? 'bg-ink border-ink text-canvas' : 'border-hairline hover:border-ink'}`}
      >
        {hecha && (
          <svg viewBox="0 0 20 20" fill="none" className="h-full w-full p-1">
            <path d="M4 10.5 8 14.5 16 6" stroke="currentColor" strokeWidth="2.4"
                  strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className={`tag ${etiqueta.fondo}`}>{etiqueta.texto}</span>
          <h3 className="text-card-title font-bold">{tarea.nombre ?? tarea.handle ?? 'Sin nombre'}</h3>
          {tarea.sector && <span className="caption">{tarea.sector}</span>}
        </div>

        {motivos.length > 0 ? (
          <ul className="mt-3 space-y-1">
            {motivos.map((m, i) => (
              <li key={i} className="text-body-sm text-ink/70 flex gap-2">
                <span className="text-ink/30">—</span>
                <span>{m}</span>
              </li>
            ))}
          </ul>
        ) : (
          tarea.contexto && <p className="text-body-sm text-ink/70 mt-3">{tarea.contexto}</p>
        )}

        <div className="flex gap-2 mt-4 flex-wrap">
          {tarea.handle && (
            <a href={`https://instagram.com/${tarea.handle}`} target="_blank" rel="noopener noreferrer"
               className="tag bg-lilac hover:bg-lilac/70">@{tarea.handle}</a>
          )}
          {tarea.telefono && (
            <a href={`tel:${tarea.telefono}`} className="tag bg-mint hover:bg-mint/70">{tarea.telefono}</a>
          )}
          {!tarea.handle && (
            <span className="tag bg-surface-soft">Sin Instagram · búscalo o llama</span>
          )}
          {tarea.enlace && (
            <a href={tarea.enlace} target="_blank" rel="noopener noreferrer"
               className="tag border border-hairline hover:bg-surface-soft sm:hidden">
              Abrir
            </a>
          )}
        </div>
      </div>

      {tarea.enlace && (
        <a href={tarea.enlace} target="_blank" rel="noopener noreferrer"
           className="pill-secondary shrink-0 hidden sm:inline-flex">
          Abrir
        </a>
      )}
    </div>
  );
}
