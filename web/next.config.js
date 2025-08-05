/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: ['unpkg.com'],
  },
  // Aumentar el timeout para generación estática
  staticPageGenerationTimeout: 180,
  // Configurar las rutas API como dinámicas
  async headers() {
    return [
      {
        source: '/api/:path*',
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