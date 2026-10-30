'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useUser } from '@/contexts/UserContext'
import { usePermissions } from '@/hooks/usePermissions'
import { esAppDeCampo } from '@/lib/app-campo'
import { agruparMenu, getHomeRoute, getRoleTitle, opcionActiva, type NavigationItem } from '@/lib/permissions'
import { useMapHeaderTitle } from '@/components/mapHeaderStore'

export default function NavigationWithPermissions() {
  const { user, logout } = useUser()
  const { role, navigationMenu, loading } = usePermissions()
  const [isOpen, setIsOpen] = useState(false)
  // ?tab= de la página abierta al abrir el menú: distingue ADRES de Compras públicas (las dos en /inteligencia)
  const [busqueda, setBusqueda] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()
  // En /map la cabecera es compacta en móvil (48 px) y muestra la línea: "OpMap · <línea>"
  const isMap = pathname === '/map'
  const mapTitle = useMapHeaderTitle()
  const topOffset = isMap ? 'top-12 md:top-16' : 'top-16'
  
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

  if (!user) return null
  
  return (
    <>
      {/* Barra de navegación fija */}
      <nav className="fixed top-0 left-0 right-0 bg-white border-b border-gray-200 z-[9999]">
        <div className={`container mx-auto flex justify-between items-center ${isMap ? 'h-12 md:h-16 px-2 md:px-4' : 'h-16 px-4'}`}>
          {/* Logo y título */}
          <div className={`flex items-center min-w-0 ${isMap ? 'gap-1 md:gap-3' : 'gap-3'}`}>
            <button
              onClick={(e) => {
                e.stopPropagation()
                if (!isOpen) setBusqueda(window.location.search)
                setIsOpen(!isOpen)
              }}
              className={`hover:bg-gray-100 rounded-lg transition-colors relative z-[10000] ${isMap ? 'p-2.5 md:p-2' : 'p-2'}`}
              aria-label={isOpen ? 'Cerrar menú' : 'Abrir menú'}
              aria-expanded={isOpen}
            >
              <svg 
                className="w-6 h-6 text-gray-700" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                {isOpen ? (
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M6 18L18 6M6 6l12 12" 
                  />
                ) : (
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M4 6h16M4 12h16M4 18h16" 
                  />
                )}
              </svg>
            </button>
            <Link
              href={inicio}
              className={`font-bold text-gray-900 hover:text-gray-700 transition-colors ${isMap ? 'text-lg md:text-2xl flex-shrink-0' : 'text-2xl'}`}
            >
              OpMap
            </Link>
            {isMap && mapTitle && (
              <span className="md:hidden min-w-0 truncate text-sm font-medium text-gray-600">
                <span aria-hidden="true">·</span> {mapTitle}
              </span>
            )}
          </div>

          {/* Información del usuario */}
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-medium text-gray-900">{user.full_name}</div>
              <div className="text-xs text-gray-500">{role && getRoleTitle(role)}</div>
            </div>
            <button
              onClick={logout}
              aria-label="Cerrar sesión"
              className={`bg-gray-900 text-white hover:bg-black rounded-lg text-sm font-medium transition-all hover:shadow-md ${isMap ? 'inline-flex items-center justify-center h-11 w-11 sm:h-auto sm:w-auto sm:px-4 sm:py-2' : 'px-4 py-2'}`}
            >
              <span className="hidden sm:inline">Cerrar sesión</span>
              <svg className="w-5 h-5 sm:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </nav>

      {/* Menú lateral deslizante */}
      <div 
        ref={menuRef}
        className={`fixed ${topOffset} left-0 bottom-0 bg-white border-r border-gray-100 w-72 transform transition-transform duration-300 ease-in-out z-[9998] shadow-xl overflow-hidden ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ 
          // En /map el alto lo dan top y bottom (la cabecera cambia de alto entre móvil y escritorio)
          ...(isMap ? {} : { height: 'calc(100vh - 4rem)' }),
          visibility: isOpen ? 'visible' : 'hidden',
          pointerEvents: isOpen ? 'auto' : 'none'
        }}
      >
        <div className="flex flex-col h-full">
          <div className="px-4 py-6 flex-1 min-h-0 overflow-y-auto">
            {/* Header del menú */}
            <div className="mb-6 pb-4 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-900 mb-1">Navegación</h3>
              <p className="text-xs text-gray-500">
                {loading ? 'Cargando menú...' : `${menuItems.length} opciones disponibles`}
              </p>
            </div>

          {/* Enlaces del menú */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <svg className="animate-spin h-8 w-8 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
                  return <div key={seccion.items[0].href} className={trasGrupo ? 'pt-3' : ''}>{opciones}</div>
                }
                const tituloId = `menu-grupo-${indice}`
                return (
                  <div key={seccion.grupo} role="group" aria-labelledby={tituloId} className={indice > 0 ? 'pt-3' : ''}>
                    <div id={tituloId} className="px-4 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      {seccion.grupo}
                    </div>
                    <div className="space-y-1">{opciones}</div>
                  </div>
                )
              })}
            </div>
          )}
          </div>

          {/* Información del usuario en móvil - Fuera del scroll */}
          <div className="border-t border-gray-100 p-6 mt-auto sm:hidden bg-gray-50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-900 rounded-full flex items-center justify-center shadow-md">
                <span className="text-white font-semibold text-sm">
                  {user.full_name?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-gray-900">{user.full_name}</div>
                <div className="text-xs text-gray-500">{role && getRoleTitle(role)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Overlay oscuro cuando el menú está abierto */}
      {isOpen && (
        <div 
          className={`fixed inset-0 ${topOffset} bg-black bg-opacity-50 z-[9997]`}
          onClick={() => setIsOpen(false)}
          style={{ pointerEvents: 'auto' }}
        />
      )}

      {/* Espaciador para el contenido */}
      <div className={isMap ? 'h-12 md:h-16' : 'h-16'} />
    </>
  )
}

// Opción del menú: icono y nombre; la activa en negro con flecha. Al elegirla se cierra el menú (también entre ADRES y
// Compras públicas, que comparten la ruta y no cierran el menú al cambiar de página)
function OpcionMenu({ item, activa, onElegir }: { item: NavigationItem; activa: boolean; onElegir: () => void }) {
  const Icon = getIconForRoute(item.href)
  const clase = `flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all ${
    activa ? 'bg-gray-900 text-white shadow-md' : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
  }`
  const contenido = (
    <>
      <Icon className="w-5 h-5" />
      <span className="font-medium">{item.name}</span>
      {activa && (
        <svg className="w-4 h-4 ml-auto" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
        </svg>
      )}
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