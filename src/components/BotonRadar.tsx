'use client';

import { useState, useTransition } from 'react';
import { lanzarRadar } from '@/app/acciones';

export default function BotonRadar({ texto = 'Ejecutar barrido ahora' }: { texto?: string }) {
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [pendiente, startTransition] = useTransition();

  function lanzar() {
    startTransition(async () => {
      const r = await lanzarRadar();
      setMensaje(r.mensaje);
      setError(!r.ok);
    });
  }

  return (
    <div className="space-y-2">
      <button
        onClick={lanzar}
        disabled={pendiente}
        className="boton bg-brand text-white hover:opacity-90 disabled:opacity-50"
      >
        {pendiente ? 'Lanzando…' : texto}
      </button>
      {mensaje && (
        <p className={`text-sm ${error ? 'text-warn' : 'text-ok'}`}>{mensaje}</p>
      )}
    </div>
  );
}
