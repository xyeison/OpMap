import type { Metadata } from 'next'
import { DM_Sans } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import NavigationWithPermissions from '@/components/NavigationWithPermissions'
import { SCRIPT_TEMA_INICIAL, cssDeTemas } from '@/lib/tema'

// La letra de la app de campo (dirección A, tipo Uber; etapa 1 del diseño, dueño 2026-10-30)
const dmSans = DM_Sans({ subsets: ['latin'], weight: ['400', '500', '700'], display: 'swap' })

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
    <html lang="es" suppressHydrationWarning>
      <head>
        {/* El tema de cada persona (Claro, Oscuro o Automático) antes de pintar: sin destello blanco en oscuro */}
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA_INICIAL }} />
        <style dangerouslySetInnerHTML={{ __html: cssDeTemas() }} />
      </head>
      <body className={`${dmSans.className} bg-fondo text-texto`}>
        <Providers>
          <NavigationWithPermissions />
          {/* data-tema="claro": las páginas que esta etapa no rehace siguen en claro aunque el tema sea oscuro (spec,
              punto 5), con su texto oscuro aunque el del cuerpo sea claro; las rehechas llevan data-sigue-tema y
              siguen el tema de la persona (lib/tema.ts). Sin menú fijo (2026-10-31), nada corre el contenido. */}
          <main data-tema="claro" className="min-h-screen bg-gradient-to-br from-white via-gray-50 to-white text-texto">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  )
}