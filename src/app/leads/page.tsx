import { query, baseDatosExiste } from '@/lib/db';
import { SECTORES } from '@/lib/osm';
import EstadoLead from '@/components/EstadoLead';
import AvisoConfiguracion from '@/components/AvisoConfiguracion';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ estado?: string; sector?: string }>;
}

const ESTADOS = ['nuevo', 'contactado', 'en_conversacion', 'cliente', 'descartado', 'todos'];

export default async function Leads({ searchParams }: Props) {
  if (!baseDatosExiste()) {
    return <AvisoConfiguracion mensaje="Falta crear la base de datos" detalle="Ejecuta: npm run db:init" />;
  }

  const { estado = 'nuevo', sector } = await searchParams;

  const filas = await query<any>(
    `SELECT n.id, n.nombre, n.sector, n.web, n.telefono, n.osm_url, n.instagram_tag,
            l.score, l.motivos, l.estado,
            a.instagram_handle, a.tecnologia, a.accesible, a.tiene_web,
            p.seguidores, p.ultima_publicacion
       FROM leads l
       JOIN negocios n ON n.id = l.negocio_id
       LEFT JOIN auditorias_web a ON a.negocio_id = n.id
       LEFT JOIN perfiles_ig p ON p.negocio_id = n.id
      WHERE (? = 'todos' OR l.estado = ?)
        AND (? IS NULL OR n.sector = ?)
      ORDER BY l.score DESC, n.nombre
      LIMIT 200`,
    [estado, estado, sector ?? null, sector ?? null],
  );

  const sectores = await query<{ sector: string }>(
    `SELECT DISTINCT sector FROM negocios WHERE sector IS NOT NULL ORDER BY sector`,
  );

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Leads detectados</h1>

      <div className="flex gap-2 flex-wrap text-sm">
        {ESTADOS.map((e) => (
          <a key={e} href={`/leads?estado=${e}${sector ? `&sector=${encodeURIComponent(sector)}` : ''}`}
             className={`boton border border-line ${e === estado ? 'bg-brand text-white' : 'bg-panel text-muted hover:text-white'}`}>
            {e.replace('_', ' ')}
          </a>
        ))}
      </div>

      {sectores.length > 0 && (
        <div className="flex gap-2 flex-wrap text-xs">
          <a href={`/leads?estado=${estado}`} className={`boton ${!sector ? 'bg-line text-white' : 'text-muted hover:text-white'}`}>
            todos los sectores
          </a>
          {sectores.map((s) => (
            <a key={s.sector} href={`/leads?estado=${estado}&sector=${encodeURIComponent(s.sector)}`}
               className={`boton ${sector === s.sector ? 'bg-line text-white' : 'text-muted hover:text-white'}`}>
              {SECTORES[s.sector]?.nombre ?? s.sector}
            </a>
          ))}
        </div>
      )}

      {filas.length === 0 ? (
        <div className="tarjeta text-center py-10 text-muted">Sin leads con este filtro.</div>
      ) : (
        <div className="space-y-2">
          {filas.map((f) => {
            let motivos: string[] = [];
            try { motivos = JSON.parse(f.motivos ?? '[]'); } catch { motivos = []; }
            const handle = f.instagram_tag ?? f.instagram_handle;

            return (
              <div key={f.id} className="tarjeta">
                <div className="flex items-start gap-4">
                  <div className="text-center shrink-0 w-14">
                    <div className={`text-2xl font-bold ${f.score >= 50 ? 'text-brand' : f.score >= 30 ? 'text-warn' : 'text-muted'}`}>
                      {f.score}
                    </div>
                    <div className="etiqueta">score</div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <h2 className="font-medium">{f.nombre}</h2>
                      <span className="text-xs text-muted">{SECTORES[f.sector]?.nombre ?? f.sector}</span>
                      {f.tecnologia && <span className="text-xs text-muted">· {f.tecnologia}</span>}
                    </div>

                    <ul className="mt-2 space-y-0.5">
                      {motivos.map((m, i) => <li key={i} className="text-sm text-muted">· {m}</li>)}
                    </ul>

                    <div className="flex gap-3 mt-3 text-xs flex-wrap">
                      {handle && (
                        <a href={`https://instagram.com/${handle}`} target="_blank" rel="noopener noreferrer"
                           className="text-brand hover:underline">
                          @{handle}{f.seguidores ? ` · ${f.seguidores} seg.` : ''}
                        </a>
                      )}
                      {f.web && (
                        <a href={f.web} target="_blank" rel="noopener noreferrer" className="text-muted hover:text-white">web</a>
                      )}
                      {f.telefono && <a href={`tel:${f.telefono}`} className="text-muted hover:text-white">{f.telefono}</a>}
                      {f.osm_url && (
                        <a href={f.osm_url} target="_blank" rel="noopener noreferrer" className="text-muted hover:text-white">mapa</a>
                      )}
                    </div>
                  </div>

                  <EstadoLead negocioId={f.id} estadoActual={f.estado} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
