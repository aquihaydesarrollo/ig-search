import type { Config } from 'tailwindcss';

/**
 * Sistema de diseno basado en DESIGN.md (Figma).
 * Marco monocromo blanco y negro, interrumpido por bloques pastel.
 * Sin sombras ni degradados: el color y la tipografia hacen el trabajo.
 */
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#000000',
        canvas: '#ffffff',
        'inverse-canvas': '#000000',
        'inverse-ink': '#ffffff',
        hairline: '#e6e6e6',
        'hairline-soft': '#f1f1f1',
        'surface-soft': '#f7f7f5',
        lime: '#dceeb1',
        lilac: '#c5b0f4',
        cream: '#f4ecd6',
        pink: '#efd4d4',
        mint: '#c8e6cd',
        coral: '#f3c9b6',
        navy: '#1f1d3d',
        magenta: '#ff3d8b',
        success: '#1ea64a',
      },
      fontFamily: {
        sans: ['"SF Pro Display"', 'Inter', 'system-ui', '-apple-system', 'Helvetica', 'sans-serif'],
        mono: ['"SF Mono"', 'Menlo', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        xs: '2px',
        sm: '6px',
        md: '8px',
        lg: '24px',
        xl: '32px',
        pill: '50px',
      },
      spacing: {
        section: '96px',
      },
      fontSize: {
        // Escala del sistema, con interletraje negativo en los tamanos grandes
        'display-lg': ['64px', { lineHeight: '1.1', letterSpacing: '-0.96px' }],
        'display':    ['44px', { lineHeight: '1.05', letterSpacing: '-1.1px' }],
        headline:     ['26px', { lineHeight: '1.35', letterSpacing: '-0.26px' }],
        'card-title': ['20px', { lineHeight: '1.35', letterSpacing: '-0.2px' }],
        body:         ['16px', { lineHeight: '1.5', letterSpacing: '-0.14px' }],
        'body-sm':    ['14px', { lineHeight: '1.5', letterSpacing: '-0.1px' }],
        eyebrow:      ['12px', { lineHeight: '1.3', letterSpacing: '0.54px' }],
        caption:      ['11px', { lineHeight: '1.2', letterSpacing: '0.6px' }],
      },
    },
  },
  plugins: [],
} satisfies Config;
