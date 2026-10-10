/** @type {import('next').NextConfig} */

// Cabeceras de seguridad aplicadas a todas las rutas (páginas y API)
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
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
