// Los papeles de color de la app (web/lib/tema.ts, los de mobile/lib/paleta.ts): cada uno lee su variable CSS, que cambia
// con el tema (data-tema en <html>). bg-fondo, text-texto-suave, bg-acento, text-sobre-acento, border-borde-control…
const PAPELES = [
  'fondo', 'superficie', 'superficie-suave', 'relleno', 'texto', 'texto-suave', 'texto-inactivo', 'borde', 'borde-fuerte',
  'acento', 'sobre-acento', 'peligro', 'fondo-peligro', 'exito', 'fondo-exito', 'alerta', 'fondo-alerta', 'info',
  'fondo-info', 'encabezado', 'sobre-encabezado', 'borde-control', 'agarradera',
]

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ...Object.fromEntries(PAPELES.map(papel => [papel, `var(--color-${papel})`])),
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
      },
    },
  },
  plugins: [],
}