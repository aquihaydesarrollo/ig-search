export default function AvisoConfiguracion({ mensaje, detalle }: { mensaje: string; detalle?: string }) {
  return (
    <div className="tarjeta border-warn/50 bg-warn/10 space-y-2">
      <p className="font-medium">{mensaje}</p>
      {detalle && <p className="text-sm text-muted whitespace-pre-line">{detalle}</p>}
    </div>
  );
}
