'use client';

import { useState, useTransition } from 'react';
import { conectarInstagram, comprobarInstagram, desconectarInstagram } from '@/app/ajustes/acciones';

export default function FormularioInstagram({ conectado }: { conectado: boolean }) {
  const [appId, setAppId] = useState('');
  const [appSecret, setAppSecret] = useState('');
  const [token, setToken] = useState('');
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pendiente, startTransition] = useTransition();

  function accion(fn: () => Promise<{ ok: boolean; mensaje: string }>) {
    setAviso(null);
    startTransition(async () => {
      const r = await fn();
      setAviso({ ok: r.ok, texto: r.mensaje });
      if (r.ok) { setAppSecret(''); setToken(''); }
    });
  }

  return (
    <div className="space-y-5">
      {conectado && (
        <div className="bg-lime rounded-md p-4 flex items-center justify-between gap-4 flex-wrap">
          <p className="text-body-sm font-medium">Instagram conectado.</p>
          <div className="flex gap-2">
            <button onClick={() => accion(comprobarInstagram)} disabled={pendiente}
                    className="pill-sm border border-ink/20 hover:bg-canvas">Comprobar</button>
            <button onClick={() => accion(desconectarInstagram)} disabled={pendiente}
                    className="pill-sm border border-ink/20 hover:bg-canvas">Desconectar</button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <Campo etiqueta="Identificador de la app" ayuda="Meta for Developers → tu app → Configuración → Básica"
               valor={appId} alCambiar={setAppId} />
        <Campo etiqueta="Clave secreta de la app" ayuda="Mismo sitio, botón «Mostrar»"
               valor={appSecret} alCambiar={setAppSecret} secreto />
        <Campo etiqueta="Token temporal" secreto valor={token} alCambiar={setToken}
               ayuda="Explorador de la API → Generar token de acceso. Caduca en un par de horas: se convierte en permanente al guardar." />
      </div>

      <button onClick={() => accion(() => conectarInstagram(appId, appSecret, token))}
              disabled={pendiente} className="pill-primary">
        {pendiente ? 'Conectando…' : conectado ? 'Volver a conectar' : 'Conectar Instagram'}
      </button>

      {aviso && (
        <div className={`rounded-md p-4 ${aviso.ok ? 'bg-lime' : 'bg-coral'}`}>
          <p className="text-body-sm">{aviso.texto}</p>
        </div>
      )}

      <p className="text-body-sm text-ink/60">
        El identificador y la clave secreta solo se usan para la conversión: no se guardan.
        Del token permanente que resulta no se muestra nunca el valor.
      </p>
    </div>
  );
}

function Campo({ etiqueta, ayuda, valor, alCambiar, secreto }: {
  etiqueta: string; ayuda: string; valor: string;
  alCambiar: (v: string) => void; secreto?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-body-sm font-medium">{etiqueta}</span>
      <span className="block text-body-sm text-ink/55 mt-0.5 mb-2">{ayuda}</span>
      <input
        type={secreto ? 'password' : 'text'}
        value={valor}
        onChange={(e) => alCambiar(e.target.value)}
        autoComplete="off"
        spellCheck={false}
        className="w-full rounded-md border border-hairline bg-canvas px-4 py-3
                   font-mono text-body-sm focus:border-ink focus:outline-none"
      />
    </label>
  );
}
