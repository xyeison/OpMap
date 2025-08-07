import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import NavigationWithPermissions from '@/components/NavigationWithPermissions'

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
          <NavigationWithPermissions />
          <main className="min-h-screen bg-gradient-to-br from-white via-gray-50 to-white">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  )
}