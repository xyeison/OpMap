'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useUser } from '@/contexts/UserContext'
import { usePermissions } from '@/hooks/usePermissions'
import { useTema } from '@/hooks/useTema'
import { esAppDeCampo } from '@/lib/app-campo'
import { alternarGrupo, gruposAbiertosAlEntrar } from '@/lib/menu-acordeon'
import { agruparMenu, getHomeRoute, getRoleTitle, opcionActiva, type NavigationItem } from '@/lib/permissions'
import type { PreferenciaTema } from '@/lib/tema'
import { useMapHeaderTitle } from '@/components/mapHeaderStore'

// El armazón de OpMap con el diseño de la app de campo (etapa 1, dueño 2026-10-30; spec
// docs/specs/2026-10-30-diseno-web-etapa-1.md): la barra de arriba y el menú con los colores de la app (lib/tema.ts) y el
// tema de cada persona. El menú va en acordeón: cada grupo se abre y se cierra con su título; las opciones sueltas van
// siempre a la vista. En el celular y en el Mapa el menú es un cajón; fuera del Mapa, en escritorio, va fijo a la
// izquierda y el contenido se corre. En el Mapa la barra conserva su alto (48 px en el celular): el mapa no cambia.
export default function NavigationWithPermissions() {
  const { user, logout } = useUser()
  const { role, navigationMenu, loading } = usePermissions()
  const { preferencia, elegir } = useTema()
  const [isOpen, setIsOpen] = useState(false)
  // ?tab= de la página abierta: distingue ADRES de Compras públicas (las dos en /inteligencia)
  const [busqueda, setBusqueda] = useState('')
  // Grupos abiertos; null = como al entrar (abierto el de la página abierta)
  const [abiertos, setAbiertos] = useState<string[] | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()
  // En /map la cabecera es compacta en móvil (48 px) y muestra la línea: "OpMap · <línea>"
  const isMap = pathname === '/map'
  const mapTitle = useMapHeaderTitle()
  const topOffset = isMap ? 'top-12 md:top-16' : 'top-16'
  // Fuera del Mapa, en escritorio (lg), el menú va fijo; en el Mapa sigue de cajón para no taparlo
  const fijo = !isMap

  // Cerrar menú al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Cerrar menú al cambiar de ruta
  useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  // Menú visible: el orden, los grupos y los textos salen de getNavigationMenu (lib/permissions.ts), cada opción con su
  // permiso (dueño, 2026-10-29: Terceros, Empleados, Inteligencia de Mercado y Configuración son títulos). El logo lleva
  // a la página de inicio del rol.
  const menuItems: NavigationItem[] = navigationMenu
  const secciones = agruparMenu(menuItems)
  const activa = opcionActiva(menuItems, pathname, busqueda)
  const inicio = getHomeRoute(role) ?? '/'
  const visibles = abiertos ?? gruposAbiertosAlEntrar(secciones, activa)
  // Al llegar a una página de un grupo cerrado (por un enlace de la página), su grupo se abre; los demás quedan igual
  const grupoDeLaPagina = gruposAbiertosAlEntrar(secciones, activa)[0] ?? null
  useEffect(() => {
    if (!grupoDeLaPagina) return
    setAbiertos(antes => (antes === null || antes.includes(grupoDeLaPagina) ? antes : [...antes, grupoDeLaPagina]))
  }, [grupoDeLaPagina])
  // El nombre de la página en la barra del celular (en escritorio lo dice el menú fijo); en el Mapa, la línea
  const titulo = isMap ? mapTitle : menuItems.find(item => item.href === activa)?.name

  if (!user) return null

  return (
    <>
      <Suspense fallback={null}>
        <PestanaActual alCambiar={setBusqueda} />
      </Suspense>
      {/* Con el menú fijo, el contenido (el <main> del layout) se corre a su derecha en escritorio */}
      {fijo && <style>{'@media (min-width: 1024px) { [data-contenido-principal] { padding-left: 18rem; } }'}</style>}

      {/* Barra de arriba, fija: blanca (negra en oscuro) */}
      <nav className="fixed top-0 left-0 right-0 bg-fondo text-texto border-b border-borde z-[9999]">
        <div className={`flex justify-between items-center ${isMap ? 'h-12 md:h-16 px-2 md:px-4' : 'h-16 px-4'}`}>
          <div className={`flex items-center min-w-0 ${isMap ? 'gap-1 md:gap-3' : 'gap-3'}`}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setIsOpen(!isOpen)
              }}
              className={`relative z-[10000] inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-relleno text-texto transition-colors hover:bg-borde-fuerte ${fijo ? 'lg:hidden' : ''}`}
              aria-label={isOpen ? 'Cerrar menú' : 'Abrir menú'}
              aria-expanded={isOpen}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                {isOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
            <Link href={inicio} className={`font-bold text-texto ${isMap ? 'text-lg md:text-2xl flex-shrink-0' : 'text-2xl'}`}>
              OpMap
            </Link>
            {titulo && (
              <span className={`min-w-0 truncate text-sm font-medium text-texto-suave ${isMap ? 'md:hidden' : 'lg:hidden'}`}>
                <span aria-hidden="true">·</span> {titulo}
              </span>
            )}
          </div>

          {/* Quién es (la inicial); en escritorio, con el menú fijo, lo dice el pie del menú */}
          <div
            className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-acento text-sm font-bold text-sobre-acento ${fijo ? 'lg:hidden' : ''}`}
            title={user.full_name}
            aria-hidden="true"
          >
            {user.full_name?.charAt(0).toUpperCase()}
          </div>
        </div>
      </nav>

      {/* El menú: cajón en el celular y en el Mapa; fijo a la izquierda en escritorio fuera del Mapa. lg:z-40: debajo de
          las ventanas de las páginas (z-50 o más), que en escritorio no deben quedar tapadas por él */}
      <div
        ref={menuRef}
        className={`fixed ${topOffset} left-0 bottom-0 w-72 bg-superficie text-texto border-r border-borde transform transition-transform duration-300 ease-in-out z-[9998] ${
          isOpen ? 'translate-x-0 visible pointer-events-auto shadow-xl' : '-translate-x-full invisible pointer-events-none'
        } ${fijo ? 'lg:z-40 lg:translate-x-0 lg:visible lg:pointer-events-auto lg:shadow-none' : ''}`}
      >
        <div className="flex flex-col h-full">
          <div className="flex-1 min-h-0 overflow-y-auto px-3 py-4">
            {loading ? (
              <div className="flex items-center justify-center py-8 text-texto-inactivo">
                <svg className="animate-spin h-8 w-8" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-label="Cargando menú">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
            ) : (
              // Un <div> y no <nav>: globals.css fija todo <nav> (position: fixed) y la lista dejaba de desplazarse,
              // así que en pantallas bajas las últimas opciones (Configuración) quedaban cortadas.
              <div className="space-y-1" role="navigation" aria-label="Menú principal" data-menu-principal>
                {secciones.map((seccion, indice) => {
                  const opciones = seccion.items.map(item => (
                    <OpcionMenu key={item.href} item={item} activa={item.href === activa} onElegir={() => setIsOpen(false)} />
                  ))
                  if (!seccion.grupo) {
                    // Opción suelta después de un grupo: separada para que no parezca parte de él
                    const trasGrupo = indice > 0 && secciones[indice - 1].grupo !== null
                    return <div key={seccion.items[0].href} className={`space-y-1 ${trasGrupo ? 'pt-2' : ''}`}>{opciones}</div>
                  }
                  // Grupo en acordeón: su título lo abre y lo cierra
                  const grupo = seccion.grupo
                  const abierto = visibles.includes(grupo)
                  const tituloId = `menu-grupo-${indice}`
                  const listaId = `menu-grupo-${indice}-opciones`
                  return (
                    <div key={grupo} className="pt-2">
                      <button
                        type="button"
                        id={tituloId}
                        onClick={() => setAbiertos(alternarGrupo(visibles, grupo))}
                        aria-expanded={abierto}
                        aria-controls={listaId}
                        className="flex w-full min-h-[44px] items-center justify-between rounded-lg px-3 text-xs font-bold uppercase tracking-wide text-texto-suave transition-colors hover:bg-superficie-suave"
                      >
                        <span>{grupo}</span>
                        <svg className={`h-4 w-4 transition-transform ${abierto ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      <div id={listaId} role="group" aria-labelledby={tituloId} hidden={!abierto} className="space-y-1">
                        {opciones}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Al pie: el tema de cada persona (Claro, Oscuro o Automático), quién es y salir */}
          <div className="border-t border-borde px-3 py-4 space-y-3">
            <div>
              <div id="menu-tema" className="px-1 pb-1.5 text-xs font-medium text-texto-suave">
                Tema
              </div>
              <div role="group" aria-labelledby="menu-tema" className="grid grid-cols-3 gap-1 rounded-xl bg-relleno p-1">
                {([['claro', 'Claro'], ['oscuro', 'Oscuro'], ['auto', 'Automático']] as Array<[PreferenciaTema, string]>).map(([valor, texto]) => (
                  <button
                    key={valor}
                    type="button"
                    aria-pressed={preferencia === valor}
                    onClick={() => elegir(valor)}
                    className={`min-h-[44px] rounded-lg px-1 text-sm font-medium transition-colors ${
                      preferencia === valor ? 'bg-acento text-sobre-acento' : 'text-texto hover:bg-superficie-suave'
                    }`}
                  >
                    {texto}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3 px-1">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-acento text-sm font-bold text-sobre-acento" aria-hidden="true">
                {user.full_name?.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold text-texto">{user.full_name}</div>
                <div className="truncate text-xs text-texto-suave">{role && getRoleTitle(role)}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={logout}
              className="flex w-full min-h-[44px] items-center justify-center gap-2 rounded-lg bg-relleno text-sm font-medium text-texto transition-colors hover:bg-borde-fuerte"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>

      {/* Fondo oscuro con el cajón abierto (con el menú fijo en escritorio no hace falta) */}
      {isOpen && (
        <div className={`fixed inset-0 ${topOffset} bg-black/50 z-[9997] ${fijo ? 'lg:hidden' : ''}`} onClick={() => setIsOpen(false)} />
      )}

      {/* Espaciador para el contenido */}
      <div className={isMap ? 'h-12 md:h-16' : 'h-16'} />
    </>
  )
}

// La pestaña de la página abierta (?tab=) para marcar su opción: ADRES y Compras públicas comparten /inteligencia y la
// página cambia de pestaña con history.replaceState, que Next 14.2 refleja en useSearchParams. En su propio Suspense:
// sin él, useSearchParams sacaría de la generación estática a todas las páginas.
function PestanaActual({ alCambiar }: { alCambiar: (busqueda: string) => void }) {
  const busqueda = useSearchParams()?.toString() ?? ''
  useEffect(() => {
    alCambiar(busqueda)
  }, [busqueda, alCambiar])
  return null
}

// Opción del menú: icono y nombre; la de la página abierta en negro (blanco en oscuro), como lo elegido en la app. Al
// elegirla se cierra el cajón (también entre ADRES y Compras públicas, que comparten la ruta y no cierran el menú al
// cambiar de página)
function OpcionMenu({ item, activa, onElegir }: { item: NavigationItem; activa: boolean; onElegir: () => void }) {
  const Icon = getIconForRoute(item.href)
  const clase = `flex min-h-[44px] items-center gap-3 rounded-lg px-3 transition-colors ${
    activa ? 'bg-acento text-sobre-acento' : 'text-texto hover:bg-superficie-suave'
  }`
  const contenido = (
    <>
      <Icon className="w-5 h-5 flex-shrink-0" />
      <span className="font-medium">{item.name}</span>
    </>
  )
  // La app de campo (Agendamiento, /campo) no es una página de Next: se abre como página completa
  if (esAppDeCampo(item.href)) {
    return (
      <a href={item.href} onClick={onElegir} className={clase}>
        {contenido}
      </a>
    )
  }
  return (
    <Link href={item.href} onClick={onElegir} aria-current={activa ? 'page' : undefined} className={clase}>
      {contenido}
    </Link>
  )
}

// Función helper para obtener iconos según la ruta (sin ?tab=)
function getIconForRoute(href: string) {
  const icons: { [key: string]: React.FC<{ className?: string }> } = {
    '/map': MapIcon,
    '/hospitals': HospitalIcon,
    '/kams': UsersIcon,
    '/lines': LinesIcon,
    '/executives': ExecutivesIcon,
    '/inteligencia': IntelligenceIcon,
    '/terceros': TercerosIcon, // Cuentas clave (Fase 6 F1: cuentas, sedes y contactos)
    '/medicos': TercerosIcon, // "Próximamente"
    '/aseguradoras': CompanyIcon, // "Próximamente"
    '/lideres': ExecutivesIcon, // "Próximamente"
    '/calendario': CalendarioIcon, // Fase 7 F2: festivos, días de empresa y de ciudad, días libres
    '/campo/agenda': CalendarioIcon, // Agendamiento de la líder (la app de campo, 2026-10-30)
    '/configuracion': ConfiguracionIcon, // Fase 7 F2: configuración de visitas
    '/contracts': DocumentIcon,
    '/providers': ProvidersIcon,
    '/visits': CalendarIcon,
    '/users': UserGroupIcon,
    '/mi-empresa': CompanyIcon,
    '/compliance': ComplianceIcon,
  }
  
  return icons[href.split('?')[0]] || DefaultIcon
}

// Iconos SVG como componentes

// Fase 7 F2: calendario con un día marcado (festivos, días de empresa y de ciudad, días libres)
const CalendarioIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2zM3 11h18" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 16l2 2 4-4" />
  </svg>
)

// Fase 7 F2: controles deslizantes (configuración de visitas: metas, qué cuenta, personas, general)
const ConfiguracionIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
  </svg>
)

// Fase 6 F1: tarjeta de identificación (terceros: cuentas y médicos)
const TercerosIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
  </svg>
)

const MapIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
  </svg>
)

const HospitalIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
)

const UsersIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
)

const DocumentIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
)

const CalendarIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
)

const UserGroupIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
)

const CompanyIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
)

const ComplianceIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
  </svg>
)

const ProvidersIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
)

const LinesIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
  </svg>
)

const ExecutivesIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
  </svg>
)

const IntelligenceIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
)

const DefaultIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)