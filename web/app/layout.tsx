import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'OpMap - Sistema de Asignación Territorial',
  description: 'Sistema inteligente para la asignación óptima de territorios comerciales',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <Providers>
          <nav className="bg-blue-600 text-white p-4">
            <div className="container mx-auto flex justify-between items-center">
              <h1 className="text-2xl font-bold">OpMap</h1>
              <div className="space-x-4">
                <a href="/" className="hover:text-blue-200">Dashboard</a>
                <a href="/kams" className="hover:text-blue-200">KAMs</a>
                <a href="/hospitals" className="hover:text-blue-200">Hospitales</a>
                <a href="/map" className="hover:text-blue-200">Mapa</a>
              </div>
            </div>
          </nav>
          <main className="min-h-screen bg-gray-50">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  )
}