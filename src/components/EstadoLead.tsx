'use client';

import { useState, useTransition } from 'react';

const ESTADOS = ['nuevo', 'contactado', 'en_conversacion', 'cliente', 'descartado'];

export default function EstadoLead({ negocioId, estadoActual }: { negocioId: string; estadoActual: string }) {
  const [estado, setEstado] = useState(estadoActual);
  const [pendiente, startTransition] = useTransition();

  function cambiar(nuevo: string) {
    setEstado(nuevo);
    startTransition(async () => {
      await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ negocioId, estado: nuevo }),
      });
    });
  }

  return (
    <select
      value={estado}
      onChange={(e) => cambiar(e.target.value)}
      disabled={pendiente}
      aria-label="Estado del lead"
      className="shrink-0 cursor-pointer rounded-pill border border-hairline bg-canvas
                 px-3.5 py-1.5 font-mono text-caption uppercase tracking-[0.6px]
                 hover:bg-surface-soft"
    >
      {ESTADOS.map((e) => (
        <option key={e} value={e}>{e.replace('_', ' ')}</option>
      ))}
    </select>
  );
}
