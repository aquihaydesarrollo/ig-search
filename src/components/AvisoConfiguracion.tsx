export default function AvisoConfiguracion({
  mensaje,
  detalle,
  color = 'bg-cream',
}: {
  mensaje: string;
  detalle?: string;
  color?: string;
}) {
  return (
    <div className={`${color} rounded-lg p-6 space-y-2`}>
      <p className="text-card-title font-bold">{mensaje}</p>
      {detalle && (
        <p className="text-body-sm text-ink/70 whitespace-pre-line leading-relaxed">{detalle}</p>
      )}
    </div>
  );
}
