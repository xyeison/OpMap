'use client'

// /inicio: la cuadrícula de módulos del rol, tipo iPhone (dueño, 2026-10-31: "se abre el inicio de módulos, así como el
// iPhone: los cuadritos de los módulos con unos íconos, así tal cual"; spec
// docs/specs/2026-10-31-diseno-unificado-vista-de-modulos.md, etapa 2a; decisión
// docs/decisiones/2026-10-31-inicio-de-modulos-tipo-iphone.md). Las mismas opciones, el mismo orden y los mismos permisos
// que el menú (bloquesDeInicio sobre getNavigationMenu): las sueltas (Agendamiento, Mapa, Calendario, Zonas, Líneas)
// primero, sin título; cada grupo con el suyo. Agendamiento abre la app de campo como página completa (<a>), como en el
// menú; la app trae el botón "OpMap" que vuelve aquí. Página rehecha: data-sigue-tema (lib/tema.ts).
import Link from 'next/link'
import ProtectedRoute from '@/components/ProtectedRoute'
import { getIconForRoute } from '@/components/NavigationWithPermissions'
import { useUser } from '@/contexts/UserContext'
import { usePermissions } from '@/hooks/usePermissions'
import { esAppDeCampo } from '@/lib/app-campo'
import { bloquesDeInicio, getRoleTitle, type NavigationItem } from '@/lib/permissions'

export default function InicioPage() {
  return (
    <ProtectedRoute>
      <Inicio />
    </ProtectedRoute>
  )
}

function Inicio() {
  const { user } = useUser()
  const { role, loading, navigationMenu } = usePermissions()
  const bloques = bloquesDeInicio(navigationMenu)
  const nombre = user?.full_name?.trim().split(/\s+/)[0] ?? ''

  return (
    <div data-sigue-tema className="min-h-screen bg-fondo text-texto">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-7">
          <h1 className="text-[30px] leading-9 font-bold tracking-[-0.6px]">{nombre ? `Hola, ${nombre}` : 'Hola'}</h1>
          {role ? <p className="mt-1 text-[15px] leading-5 text-texto-suave">{getRoleTitle(role)}</p> : null}
        </header>

        {loading ? <p className="text-texto-suave">Cargando…</p> : null}
        {!loading && bloques.length === 0 ? (
          <div className="rounded-xl border border-borde bg-superficie p-5">
            <p className="font-medium">Tu usuario todavía no tiene ninguna opción.</p>
            <p className="mt-1 text-[15px] text-texto-suave">Pide al administrador que revise tu rol.</p>
          </div>
        ) : null}

        {bloques.map((bloque, i) => (
          <section key={bloque.grupo ?? `sueltas-${i}`} aria-label={bloque.grupo ?? 'Módulos'} className="mb-8">
            {bloque.grupo ? <h2 className="mb-3 text-[13px] font-bold uppercase tracking-wide text-texto-suave">{bloque.grupo}</h2> : null}
            <ul className="grid grid-cols-3 gap-x-2 gap-y-5 sm:grid-cols-4 lg:grid-cols-6">
              {bloque.items.map(item => (
                <li key={item.href}>
                  <Modulo item={item} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}

/** Un módulo: el ícono en un cuadro redondeado (como una app del iPhone) y el nombre debajo. */
function Modulo({ item }: { item: NavigationItem }) {
  const Icon = getIconForRoute(item.href)
  const clase =
    'group flex min-h-[44px] flex-col items-center gap-2 rounded-xl px-1 py-2 text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-acento'
  const contenido = (
    <>
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-relleno text-texto transition-colors group-hover:bg-borde-fuerte group-active:bg-borde-fuerte">
        <Icon className="h-8 w-8" />
      </span>
      <span className="break-words text-[13px] font-medium leading-4 text-texto">{item.name}</span>
    </>
  )
  // La app de campo (Agendamiento, /campo) no es una página de Next: se abre como página completa
  if (esAppDeCampo(item.href)) {
    return (
      <a href={item.href} className={clase}>
        {contenido}
      </a>
    )
  }
  return (
    <Link href={item.href} className={clase}>
      {contenido}
    </Link>
  )
}
