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
      className="bg-ink border border-line rounded-lg text-xs px-2 py-1.5 shrink-0 cursor-pointer"
      aria-label="Estado del lead"
    >
      {ESTADOS.map((e) => (
        <option key={e} value={e}>{e.replace('_', ' ')}</option>
      ))}
    </select>
  );
}
