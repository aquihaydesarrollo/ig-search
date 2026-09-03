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
    <div className="space-y-3">
      <button onClick={lanzar} disabled={pendiente} className="pill-primary">
        {pendiente ? 'Lanzando…' : texto}
      </button>
      {mensaje && (
        <p className={`text-body-sm ${error ? 'text-ink/70' : 'text-success'}`}>{mensaje}</p>
      )}
    </div>
  );
}
