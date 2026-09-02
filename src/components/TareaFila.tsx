'use client';

import { useState, useTransition } from 'react';

const ETIQUETAS: Record<string, { texto: string; color: string }> = {
  comentar: { texto: 'Comentar', color: 'bg-brand/20 text-brand border-brand/40' },
  seguir: { texto: 'Seguir', color: 'bg-ok/20 text-ok border-ok/40' },
  like: { texto: 'Like', color: 'bg-sky-500/20 text-sky-300 border-sky-500/40' },
  revisar: { texto: 'Revisar', color: 'bg-warn/20 text-warn border-warn/40' },
};

export interface Tarea {
  id: number;
  tipo: string;
  handle: string | null;
  enlace: string | null;
  contexto: string | null;
  hecha: boolean;
}

export default function TareaFila({ tarea }: { tarea: Tarea }) {
  const [hecha, setHecha] = useState(tarea.hecha);
  const [pendiente, startTransition] = useTransition();
  const etiqueta = ETIQUETAS[tarea.tipo] ?? { texto: tarea.tipo, color: 'bg-line text-muted border-line' };

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
    <div className={`tarjeta flex gap-4 items-start ${hecha ? 'opacity-45' : ''}`}>
      <input
        type="checkbox"
        checked={hecha}
        onChange={alternar}
        disabled={pendiente}
        className="mt-1 h-5 w-5 accent-brand cursor-pointer shrink-0"
        aria-label="Marcar como hecha"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs px-2 py-0.5 rounded border ${etiqueta.color}`}>{etiqueta.texto}</span>
          {tarea.handle && <span className="text-sm font-medium">@{tarea.handle}</span>}
        </div>
        {tarea.contexto && (
          <p className="text-sm text-muted mt-1.5 leading-relaxed">{tarea.contexto}</p>
        )}
      </div>
      {tarea.enlace && (
        <a
          href={tarea.enlace}
          target="_blank"
          rel="noopener noreferrer"
          className="boton bg-line hover:bg-brand hover:text-white shrink-0"
        >
          Abrir →
        </a>
      )}
    </div>
  );
}
