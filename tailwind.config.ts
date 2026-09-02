import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0f1115',
        panel: '#171a21',
        line: '#262b36',
        muted: '#8b93a7',
        brand: '#ff5c35',
        ok: '#3ecf8e',
        warn: '#ffb020',
      },
    },
  },
  plugins: [],
} satisfies Config;
