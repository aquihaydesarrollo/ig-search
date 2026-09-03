'use client';

import { useState, useTransition } from 'react';
import { guardarAcceso } from '@/app/ajustes/acciones';

export default function FormularioAcceso({ tienePassword }: { tienePassword: boolean }) {
  const [password, setPassword] = useState('');
  const [cron, setCron] = useState('');
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pendiente, startTransition] = useTransition();

  function guardar() {
    setAviso(null);
    startTransition(async () => {
      const r = await guardarAcceso(password, cron);
      setAviso({ ok: r.ok, texto: r.mensaje });
      if (r.ok) { setPassword(''); setCron(''); }
    });
  }

  return (
    <div className="space-y-5">
      <p className="text-body-sm text-ink/60">
        Estado actual: {tienePassword
          ? 'hay una contraseña guardada.'
          : 'no hay contraseña guardada.'}
      </p>

      <label className="block">
        <span className="text-body-sm font-medium">Contraseña del panel</span>
        <span className="block text-body-sm text-ink/55 mt-0.5 mb-2">
          Déjalo vacío y guarda para borrarla.
        </span>
        <input type="text" value={password} onChange={(e) => setPassword(e.target.value)}
               autoComplete="off" spellCheck={false}
               className="w-full rounded-md border border-hairline bg-canvas px-4 py-3
                          font-mono text-body-sm focus:border-ink focus:outline-none" />
      </label>

      <label className="block">
        <span className="text-body-sm font-medium">Secreto de la tarea programada</span>
        <span className="block text-body-sm text-ink/55 mt-0.5 mb-2">
          Solo lo necesita el barrido nocturno automático.
        </span>
        <input type="text" value={cron} onChange={(e) => setCron(e.target.value)}
               autoComplete="off" spellCheck={false}
               className="w-full rounded-md border border-hairline bg-canvas px-4 py-3
                          font-mono text-body-sm focus:border-ink focus:outline-none" />
      </label>

      <button onClick={guardar} disabled={pendiente} className="pill-primary">
        {pendiente ? 'Guardando…' : 'Guardar'}
      </button>

      {aviso && (
        <div className={`rounded-md p-4 ${aviso.ok ? 'bg-lime' : 'bg-coral'}`}>
          <p className="text-body-sm break-all">{aviso.texto}</p>
        </div>
      )}
    </div>
  );
}
