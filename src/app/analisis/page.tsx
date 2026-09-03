import { getConfig } from '@/lib/config';
import { ajuste } from '@/lib/ajustes';
import { query } from '@/lib/db';
import InformeAnalisis from '@/components/InformeAnalisis';

export const dynamic = 'force-dynamic';

export default async function Analisis() {
  const cfg = getConfig();
  const conectado = Boolean(ajuste('META_ACCESS_TOKEN') && ajuste('META_IG_USER_ID'));

  const analizadas = await query<{ handle: string }>(
    `SELECT handle FROM perfiles_ig ORDER BY revisado_en DESC LIMIT 12`,
  );

  const sugerencias = [
    ...cfg.competidores,
    ...analizadas.map((a) => a.handle),
  ].filter((h, i, todos) => todos.indexOf(h) === i).slice(0, 10);

  return (
    <div className="space-y-10">
      <section>
        <p className="eyebrow mb-4">Inteligencia</p>
        <h1 className="text-3xl sm:text-display font-normal">Analizar una cuenta.</h1>
        <p className="text-body text-ink/60 mt-4 max-w-2xl">
          Engagement real, ritmo de publicación, qué formato le funciona, mejores días y horas,
          qué publicaciones se le dispararon y por cuánto. Sirve para tu competencia, para un
          cliente antes de la propuesta, o para ti misma.
        </p>
      </section>

      {!conectado ? (
        <div className="bg-coral rounded-lg p-6 sm:p-8 space-y-3">
          <p className="text-card-title font-bold">Falta conectar Instagram</p>
          <p className="text-body-sm text-ink/70 max-w-2xl">
            El análisis usa la API oficial de Meta, así que necesita tu token. Se configura en
            un minuto desde la pestaña Ajustes.
          </p>
          <a href="/ajustes" className="pill-primary">Ir a Ajustes</a>
        </div>
      ) : (
        <InformeAnalisis sugerencias={sugerencias} />
      )}

      <section className="bg-surface-soft rounded-lg p-6 sm:p-8 space-y-3">
        <p className="eyebrow">Qué se puede ver y qué no</p>
        <p className="text-body-sm text-ink/70 max-w-3xl leading-relaxed">
          Solo funciona con <strong>cuentas profesionales públicas</strong>: las personales y las
          privadas no las expone la API de Meta. De una cuenta ajena se ven seguidores, número de
          publicaciones, y de cada publicación su texto, formato, fecha, me gusta y comentarios.
        </p>
        <p className="text-body-sm text-ink/70 max-w-3xl leading-relaxed">
          No se ven alcance, impresiones, guardados, compartidos ni datos de sus seguidores: eso
          Meta solo lo da de tu propia cuenta. Tampoco se puede sacar la lista de quién les sigue
          ni de quién les comenta.
        </p>
      </section>
    </div>
  );
}
