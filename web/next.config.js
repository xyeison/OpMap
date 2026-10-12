/** @type {import('next').NextConfig} */

// Cabeceras de seguridad aplicadas a todas las rutas (páginas y API)
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // GPS y micrófono solo para el propio sitio: la app de visita los necesita para reportar
  // (spec docs/specs/2026-10-12-app-de-visita-opmap.md). La cámara sigue cerrada.
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=(self)' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
]

const nextConfig = {
  reactStrictMode: true,
  // No se usa next/image: se desactiva el optimizador para no exponer /_next/image
  images: {
    unoptimized: true,
  },
  // Aumentar el timeout para generación estática
  staticPageGenerationTimeout: 180,
  experimental: {
    // pdf.js (importador del REPS, lib/reps-pdf.ts) se carga desde node_modules en el servidor, sin bundle
    serverComponentsExternalPackages: ['pdfjs-dist'],
    // ...y se incluye explícitamente en la función de Vercel (se carga con import() dinámico)
    outputFileTracingIncludes: {
      '/api/hospitals/import/preview': [
        './node_modules/pdfjs-dist/legacy/build/pdf.mjs',
        './node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs',
        './node_modules/pdfjs-dist/package.json',
      ],
    },
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      {
        // Rutas API sin caché, EXCEPTO /api/geojson/*, que define su propio Cache-Control
        // (los polígonos son estáticos y públicos; cachearlos evita cientos de invocaciones por carga)
        source: '/api/:path((?!geojson(?:/|$)).*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, must-revalidate',
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig
