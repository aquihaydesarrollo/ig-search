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
      <body>
        <header className="border-b border-line bg-panel">
          <div className="mx-auto max-w-6xl px-5 py-3 flex items-center gap-6">
            <span className="font-semibold tracking-tight">
              IG<span className="text-brand">Search</span>
            </span>
            <nav className="flex gap-1 text-sm">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="px-3 py-1.5 rounded-lg text-muted hover:text-white hover:bg-line transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-5 py-6">{children}</main>
      </body>
    </html>
  );
}
