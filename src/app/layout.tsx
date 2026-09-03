import './globals.css';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'IG Search — Aquí Hay Marketing',
  description: 'Radar diario de leads locales y asistente de Instagram',
};

const NAV = [
  { href: '/', label: 'Hoy' },
  { href: '/leads', label: 'Leads' },
  { href: '/competencia', label: 'Competencia' },
  { href: '/metricas', label: 'Métricas' },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen flex flex-col overflow-x-hidden">
        {/* Franja negra: marca el tono editorial del sistema */}
        <div className="bg-inverse-canvas text-inverse-ink">
          <div className="mx-auto max-w-6xl px-5 sm:px-6 h-9 flex items-center">
            <p className="font-mono text-caption uppercase tracking-[0.6px]">
              Radar de leads locales · Murcia
            </p>
          </div>
        </div>

        <header className="border-b border-hairline">
          <div className="mx-auto max-w-6xl px-5 sm:px-6 py-3 flex flex-col sm:flex-row sm:h-14
                          sm:items-center sm:justify-between gap-3">
            <Link href="/" className="text-card-title font-bold tracking-[-0.2px] shrink-0">
              IG Search
            </Link>
            <nav className="flex gap-1 flex-wrap">
              {NAV.map((item) => (
                <Link key={item.href} href={item.href}
                      className="pill-sm shrink-0 hover:bg-surface-soft">
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-6xl w-full min-w-0 px-5 sm:px-6 py-10 sm:py-12 flex-1">{children}</main>

        <footer className="border-t border-hairline-soft mt-section">
          <div className="mx-auto max-w-6xl px-5 sm:px-6 py-10">
            <p className="caption">Aquí Hay Marketing · aquihaymarketing.es</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
