// Sistema de permisos para OpMap

export type Role =
  | 'admin'
  | 'sales_manager'
  | 'contract_manager'
  | 'data_manager'
  | 'viewer'
  | 'user'
  | 'line_leader'          // Fase 2: líder de negocio; desde el 2026-10-29 solo consulta (no asigna ni ajusta)
  | 'commercial_director'  // Fase 2: dirección comercial (ve y ajusta todas las líneas; con el admin, los únicos que asignan)
  | 'hr'                   // Fase 7 F2: recursos humanos (calendario y días libres; aprueba en bloque)

export type Permission =
  | 'dashboard:view'
  | 'map:view'
  | 'hospitals:view'
  | 'hospitals:edit'
  | 'kams:view'
  | 'kams:edit'
  // Sin zones:view ni zones:edit: las Regiones (tabla zones) se quitaron de la web el 2026-10-14
  | 'contracts:view'
  | 'contracts:edit'
  | 'contracts:delete'
  | 'providers:view'
  | 'providers:edit'
  | 'recalculate:simple'
  | 'recalculate:complete'
  | 'users:manage'
  | 'visits:view'
  | 'visits:manage'
  | 'territories:view'
  | 'territories:manage'
  | 'lines:view'       // Fase 1: líneas de negocio (Sustitutos óseos, Reemplazo articular...)
  | 'lines:edit'
  | 'executives:view'  // Fase 1: ejecutivas comerciales (personas)
  | 'executives:edit'
  // Traspaso (spec 2026-10-12): pasar en un paso las líneas, la zona, los ajustes manuales, el nombre del territorio
  // y los médicos de un Ejecutivo Comercial a otra persona, a una nueva o a una vacante (y darlo de baja). Solo admin
  // y commercial_director: son los únicos que tienen a la vez equipo, cobertura y visitantes.
  | 'executives:transfer'
  // Zonas por línea (spec 2026-10-23): dar o quitar una línea a un Ejecutivo Comercial o vacante que vive en la Zona
  // (PUT/DELETE /api/executives/[id]/lineas/[lineId]). Desde el 2026-10-29 solo admin y commercial_director: la
  // líder de negocio es de consulta (docs/decisiones/2026-10-29-solo-admin-y-direccion-asignan.md).
  | 'executives:lines'
  | 'coverage:view'    // Fase 2: cobertura por línea (la API limita a las líneas del usuario)
  | 'coverage:edit'    // Fase 2: recalcular y ajustes manuales (admin y commercial_director desde el 2026-10-29)
  | 'map:all-lines'    // Fase 2: ver el mapa de cualquier línea (la vista "Zonas" es de map:view desde 2026-10-14)
  | 'territory:view'           // Fase 2b: anexo de territorio por ejecutivo comercial (la API limita por línea/ejecutivo)
  | 'territory:snapshot'       // Fase 2b: guardar versiones inmutables del anexo (admin y commercial_director)
  | 'municipalities:recompute' // Fase 2b: recalcular municipality_zone con la caché (sin Google)
  | 'intelligence:view'        // Fase 3: inteligencia de giros ADRES (/inteligencia, GET /api/intelligence/giros)
  // Procesos de SECOP II sin contrato (radar comercial, spec 2026-10-25): la sección de las tarjetas del mapa y la tarjeta de
  // la ficha. Los roles con intelligence:view y, además, los Ejecutivos Comerciales (sales_manager), que siguen sin ver
  // las compras de SECOP ni /inteligencia. Nunca suma a las compras.
  | 'secop:procesos'
  | 'kams:bogota-config'       // PR 3: Bogotá hacia afuera (k celdas, corredores, tope único). Solo admin
  | 'fuentes:manage'           // PR 7: panel "Fuentes de datos" (estado y "Actualizar ahora") y lista vigilada de SECOP. Solo admin
  // Seguimiento de las líderes en /lideres (dueño, 2026-10-29, docs/decisiones/2026-10-29-historico-tracker-lideres.md):
  // ver y cargar el histórico del Excel "Tracker Líderes". Admin y commercial_director; las líderes no se ven entre ellas.
  | 'lideres:seguimiento'
  | 'terceros:view'            // Fase 6 F1: ver cuentas, sedes, médicos (sin documento) y contactos (/terceros)
  | 'terceros:create'          // Fase 6 F1: crear cuentas, sedes, médicos y contactos
  | 'terceros:manage'          // Fase 6 F1: editar o desactivar, ver documentos, confirmar sedes, marcar cliente y modalidad
  | 'visitantes:manage'        // Fase 6 F1: asignar y terminar visitantes de un médico (admin y commercial_director desde el 2026-10-29)
  | 'visits:config'            // Fase 7 F2: ver y cambiar la configuración de visitas, subtipos y la cuota de cualquiera (/configuracion)
  | 'calendar:manage'          // Fase 7 F2: días de empresa y de ciudad, cargar festivos, anular días del calendario
  | 'daysoff:approve'          // Fase 7 F2: ver todos los días libres, aprobar o rechazar en bloque, registrar o anular por otra persona
  | 'daysoff:view'             // Fase 7 F2: ver, sin aprobar, los días libres de las ejecutivas de SUS líneas (lo limita la API)
  | 'visits:report'            // Fase 7 F2: lo propio de un Ejecutivo Comercial: sus días libres y su cuota (usuario enlazado a una ejecutiva)

// Definición de permisos por rol
export const rolePermissions: Record<Role, Permission[]> = {
  admin: [
    'dashboard:view',
    'map:view',
    'hospitals:view',
    'hospitals:edit',
    'kams:view',
    'kams:edit',
    'contracts:view',
    'contracts:edit',
    'contracts:delete',
    'providers:view',
    'providers:edit',
    'recalculate:simple',
    'recalculate:complete',
    'users:manage',
    'visits:view',
    'visits:manage',
    'territories:view',
    'territories:manage',
    'lines:view',
    'lines:edit',
    'executives:view',
    'executives:edit',
    'executives:transfer',
    'executives:lines',
    'lideres:seguimiento',
    'coverage:view',
    'coverage:edit',
    'map:all-lines',
    'territory:view',
    'territory:snapshot',
    'municipalities:recompute',
    'intelligence:view',
    'secop:procesos',
    'kams:bogota-config',
    'fuentes:manage',
    'terceros:view',
    'terceros:create',
    'terceros:manage',
    'visitantes:manage',
    'visits:config',
    'calendar:manage',
    'daysoff:approve',
    'daysoff:view',
    'visits:report'
  ],
  sales_manager: [
    'dashboard:view',
    'map:view',
    'hospitals:view',  // Solo ver hospitales, NO editar
    'kams:view',       // Puede ver KAMs
    'contracts:view',  // Solo ver contratos, NO editar
    'territories:view',  // Solo ver territorios, NO gestionar
    'lines:view',        // lines:edit solo admin y commercial_director (desde el 2026-10-29)
    'executives:view',
    'coverage:view',     // Solo las líneas que lleva como ejecutiva (GET /api/me/lines)
    'territory:view',    // Solo el anexo de su(s) ejecutivo(s) enlazado(s)
    'terceros:view',     // Fase 6 F1: terceros (cuentas, sedes, médicos sin documento, contactos)
    'terceros:create',
    'secop:procesos',    // Radar de procesos de SECOP II sin contrato (2026-10-25); sin intelligence:view: ni compras ni /inteligencia
    'visits:report'      // Fase 7 F2: sus días libres y su cuota (si su usuario está enlazado a una ejecutiva)
  ],
  // Líder de negocio: SOLO CONSULTA desde el 2026-10-29 (dueño: "eso tiene que pasar por el administrador o por el
  // director comercial"; docs/decisiones/2026-10-29-solo-admin-y-direccion-asignan.md). Ya no edita su línea, su
  // cobertura, sus anexos ni los visitantes: asignar Ejecutivos a líneas y Zonas es del administrador y la dirección.
  // Sigue con terceros:create y visits:report porque, si también es Ejecutiva Comercial (Yineth), reporta visitas en la
  // app y ahí registra el médico, la cuenta o la sede que falte.
  line_leader: [
    'dashboard:view',
    'map:view',
    'hospitals:view',
    'kams:view',
    'contracts:view',
    'territories:view',
    'lines:view',
    'executives:view',
    'coverage:view',
    'territory:view',
    'intelligence:view',
    'secop:procesos',
    'terceros:view',
    'terceros:create',   // Solo para la app de visita (registrar lo que falte al reportar)
    'daysoff:view',      // Fase 7 F2: ve (sin aprobar) los días libres de las ejecutivas de SUS líneas
    'visits:report'      // Fase 7 F2: sus días libres y su cuota (si también es ejecutiva)
  ],
  // Director comercial: todo lo de ver + gestionar líneas, equipo y cobertura de todas las líneas; con el administrador,
  // el único que asigna Ejecutivos Comerciales a líneas y Zonas (dueño, 2026-10-29). Sin users:manage ni
  // recalculate:complete.
  commercial_director: [
    'dashboard:view',
    'map:view',
    'hospitals:view',
    'kams:view',
    'contracts:view',
    'providers:view',
    'visits:view',
    'territories:view',
    'lines:view',
    'lines:edit',
    'executives:view',
    'executives:edit',
    'executives:transfer', // Traspaso de un Ejecutivo Comercial a otra persona, una nueva o una vacante
    'executives:lines',    // Dar o quitar cualquier línea a un Ejecutivo Comercial o vacante desde Zonas
    'lideres:seguimiento', // Seguimiento de las líderes (/lideres) y carga del Excel "Tracker Líderes"
    'coverage:view',
    'coverage:edit',
    'map:all-lines',
    'territory:view',
    'territory:snapshot',
    'intelligence:view',
    'secop:procesos',
    'terceros:view',
    'terceros:create',
    'terceros:manage',
    'visitantes:manage',
    'visits:config',     // Fase 7 F2: configuración de visitas (metas, conteo, personas, general, subtipos)
    'calendar:manage',
    'daysoff:approve',   // además su rol debe estar en aprobacion_dias_libres.aprueban (lo exige la API)
    'visits:report'
  ],
  // Fase 7 F2: recursos humanos. Calendario (festivos, días de empresa y de ciudad) y días libres de todos
  // (aprueba en bloque si su rol está en aprobacion_dias_libres.aprueban). Sin mapa ni dashboard.
  hr: [
    'lines:view',
    'executives:view',
    'calendar:manage',
    'daysoff:approve'
  ],
  contract_manager: [
    'map:view',
    'hospitals:view',
    'hospitals:edit',  // Puede editar hospitales (incluyendo doctores)
    'contracts:view',
    'contracts:edit',
    'contracts:delete',
    'providers:view',
    'providers:edit',  // Puede gestionar proveedores
    'lines:view',
    'executives:view'
  ],
  data_manager: [
    'map:view',
    'hospitals:view',
    'hospitals:edit',
    'kams:view',
    'kams:edit',
    'visits:view',
    'visits:manage',
    'territories:view',
    'territories:manage',  // Puede gestionar asignaciones forzadas
    'recalculate:complete', // Recálculo completo tras cambiar territorios/asignaciones forzadas
    'lines:view',
    'executives:view',
    'executives:edit',      // Gestiona el equipo comercial (ejecutivas y sus líneas)
    'coverage:view',
    'map:all-lines',
    'territory:view',
    'intelligence:view',
    'secop:procesos',
    'terceros:view',
    'terceros:create',
    'terceros:manage'
  ],
  viewer: [
    'map:view',
    'hospitals:view',
    'lines:view',
    'executives:view',
    'coverage:view',
    'map:all-lines',
    'territory:view',
    'intelligence:view',
    'secop:procesos',
    'terceros:view'
  ],
  user: [
    'map:view',
    'hospitals:view',
    'lines:view',
    'executives:view'
  ]
}

// Fase 7 F2: cualquiera de estos permisos abre /calendario (cada pestaña pide el suyo)
export const PERMISOS_CALENDARIO: readonly Permission[] = [
  'calendar:manage',
  'daysoff:approve',
  'daysoff:view',
  'visits:report'
]

// Menú de la web (dueño, 2026-10-14): Municipios ya no va en el menú principal sino dentro de Configuración.
// Configuración se abre con cualquiera de estos permisos y cada sección pide el suyo (seccionesConfiguracion).
// La sección "Asignación" (Recalcular asignaciones y Calcular rutas) vivía en el antiguo dashboard de "/", que pedía
// dashboard:view además de recalculate:*: se piden los dos, para que nadie gane estas herramientas al mudarlas
// (data_manager tiene recalculate:complete pero no dashboard:view y no las veía). Hoy todo rol con recalculate:*
// tiene también territories:view.
export const PERMISOS_CONFIGURACION: readonly Permission[] = [
  'visits:config',
  'territories:view',
  'recalculate:simple',
  'recalculate:complete'
]

export type SeccionConfiguracion = 'visitas' | 'municipios' | 'asignacion'

/** Asignación: los mismos permisos que tenía en el antiguo dashboard (dashboard:view y recalculate:*). */
export function puedeVerAsignacion(role: Role | undefined): boolean {
  return (
    hasPermission(role, 'dashboard:view') &&
    (hasPermission(role, 'recalculate:simple') || hasPermission(role, 'recalculate:complete'))
  )
}

/** Secciones de /configuracion que ve el rol, en el orden en que salen: Visitas, Municipios, Asignación. */
export function seccionesConfiguracion(role: Role | undefined): SeccionConfiguracion[] {
  if (!role) return []
  const secciones: SeccionConfiguracion[] = []
  if (hasPermission(role, 'visits:config')) secciones.push('visitas')
  if (hasPermission(role, 'territories:view')) secciones.push('municipios')
  if (puedeVerAsignacion(role)) secciones.push('asignacion')
  return secciones
}

// Función para verificar si un rol tiene un permiso específico
export function hasPermission(role: Role | undefined, permission: Permission): boolean {
  if (!role) return false
  
  // Admin siempre tiene todos los permisos
  if (role === 'admin') return true
  
  return rolePermissions[role]?.includes(permission) || false
}

// Función para obtener todas las rutas permitidas para un rol
export function getAllowedRoutes(role: Role | undefined): string[] {
  if (!role) return ['/login']
  
  const routes: string[] = []
  const permissions = rolePermissions[role] || []
  
  // Siempre permitir logout y perfil
  routes.push('/logout', '/profile')
  
  // Mapear permisos a rutas. Sin dashboard (dueño, 2026-10-14): "/" solo lleva a getHomeRoute; dashboard:view
  // sigue en los roles pero ya no abre nada. Sin /zones: las Regiones se quitaron de la web el 2026-10-14 (la tabla
  // zones sigue en la base, sin uso).
  if (permissions.includes('map:view')) routes.push('/map')
  if (permissions.includes('hospitals:view')) routes.push('/hospitals', '/hospitals/[id]')
  if (permissions.includes('kams:view')) routes.push('/kams')
  if (permissions.includes('contracts:view')) routes.push('/contracts')
  if (permissions.includes('providers:view')) routes.push('/providers', '/providers/[id]')
  if (permissions.includes('users:manage')) routes.push('/users')
  if (permissions.includes('visits:view')) routes.push('/visits')
  if (permissions.includes('territories:view')) routes.push('/territories', '/territories/[id]')
  if (permissions.includes('lines:view')) routes.push('/lines')            // Fase 1
  if (permissions.includes('executives:view')) routes.push('/executives')  // Fase 1
  if (permissions.includes('intelligence:view')) routes.push('/inteligencia') // Fase 3: giros ADRES
  if (permissions.includes('terceros:view')) routes.push('/terceros', '/medicos', '/aseguradoras') // Cuentas clave y "Próximamente"
  if (permissions.includes('executives:view')) routes.push('/lideres')      // Líderes de negocio ("Próximamente")
  if (PERMISOS_CONFIGURACION.some(permiso => permissions.includes(permiso))) routes.push('/configuracion') // visitas, municipios y asignación
  if (PERMISOS_CALENDARIO.some(permiso => permissions.includes(permiso))) routes.push('/calendario') // Fase 7 F2

  return routes
}

// Función para obtener el menú de navegación según el rol
export interface NavigationItem {
  name: string
  // Ruta de la página; puede llevar ?tab= (Compras públicas abre /inteligencia en su pestaña)
  href: string
  icon: string
  // Título del grupo ("Terceros", "Empleados", "Inteligencia de Mercado", "Configuración"); sin grupo, opción suelta
  grupo?: string
}

// Menú por grupos (dueño, 2026-10-29, docs/specs/2026-10-29-menu-por-grupos.md): Mapa; Terceros (IPS, Cuentas clave,
// Médicos, Aseguradoras y Proveedores); Empleados (Ejecutivos Comerciales y Líderes de negocio); Calendario, Zonas y
// Líneas; Inteligencia de Mercado (ADRES, Compras públicas, Contratos y Cumplimiento); Configuración (Mi Empresa,
// Usuarios, Visita VMO y Parámetros). Médicos, Aseguradoras y Líderes de negocio abren "Próximamente". Sin Dashboard,
// sin Municipios (está en Parámetros) y sin Regiones. Cada opción sale solo con su permiso.
export function getNavigationMenu(role: Role | undefined): NavigationItem[] {
  if (!role) return []

  const menu: NavigationItem[] = []
  const permissions = rolePermissions[role] || []
  const tiene = (permiso: Permission) => permissions.includes(permiso)
  const gestionaContratos = tiene('contracts:edit') || role === 'admin'

  if (tiene('map:view')) menu.push({ name: 'Mapa', href: '/map', icon: 'map' })

  // Terceros. Cuentas clave (/terceros) son hoy las cuentas de la app de visita (las IPS); el dueño explicará el resto
  const TERCEROS = 'Terceros'
  if (tiene('hospitals:view')) menu.push({ name: 'IPS', href: '/hospitals', icon: 'building', grupo: TERCEROS })
  if (tiene('terceros:view')) {
    menu.push({ name: 'Cuentas clave', href: '/terceros', icon: 'users', grupo: TERCEROS })
    menu.push({ name: 'Médicos', href: '/medicos', icon: 'users', grupo: TERCEROS })
    menu.push({ name: 'Aseguradoras', href: '/aseguradoras', icon: 'building', grupo: TERCEROS })
  }
  if (tiene('providers:view')) menu.push({ name: 'Proveedores', href: '/providers', icon: 'providers', grupo: TERCEROS })

  const EMPLEADOS = 'Empleados'
  if (tiene('executives:view')) {
    menu.push({ name: 'Ejecutivos Comerciales', href: '/executives', icon: 'executives', grupo: EMPLEADOS })
    menu.push({ name: 'Líderes de negocio', href: '/lideres', icon: 'executives', grupo: EMPLEADOS })
  }

  // Fase 7 F2: calendario (festivos, días de empresa y de ciudad) y días libres
  if (PERMISOS_CALENDARIO.some(permiso => tiene(permiso))) menu.push({ name: 'Calendario', href: '/calendario', icon: 'calendar' })
  // Cada fila de kams es una Zona (las rutas siguen siendo /kams)
  if (tiene('kams:view')) menu.push({ name: 'Zonas', href: '/kams', icon: 'users' })
  if (tiene('lines:view')) menu.push({ name: 'Líneas', href: '/lines', icon: 'lines' })

  // Fase 3 y 5: giros ADRES y compras públicas son pestañas de /inteligencia
  const INTELIGENCIA = 'Inteligencia de Mercado'
  if (tiene('intelligence:view')) {
    menu.push({ name: 'ADRES', href: '/inteligencia', icon: 'intelligence', grupo: INTELIGENCIA })
    menu.push({ name: 'Compras públicas', href: '/inteligencia?tab=secop', icon: 'intelligence', grupo: INTELIGENCIA })
  }
  if (tiene('contracts:view')) menu.push({ name: 'Contratos', href: '/contracts', icon: 'document', grupo: INTELIGENCIA })
  if (gestionaContratos) menu.push({ name: 'Cumplimiento', href: '/compliance', icon: 'clipboard', grupo: INTELIGENCIA })

  // Al final: Mi Empresa, Usuarios, Visita VMO (importar el Excel) y Parámetros (visitas, municipios y asignación)
  const CONFIGURACION = 'Configuración'
  if (gestionaContratos) menu.push({ name: 'Mi Empresa', href: '/mi-empresa', icon: 'building', grupo: CONFIGURACION })
  if (tiene('users:manage')) menu.push({ name: 'Usuarios', href: '/users', icon: 'user-group', grupo: CONFIGURACION })
  if (tiene('visits:view')) menu.push({ name: 'Visita VMO', href: '/visits', icon: 'location', grupo: CONFIGURACION })
  if (PERMISOS_CONFIGURACION.some(permiso => tiene(permiso))) {
    menu.push({ name: 'Parámetros', href: '/configuracion', icon: 'settings', grupo: CONFIGURACION })
  }

  return menu
}

/** Secciones del menú en su orden: cada grupo con sus opciones seguidas, y cada opción suelta como sección sin título. */
export function agruparMenu(items: readonly NavigationItem[]): Array<{ grupo: string | null; items: NavigationItem[] }> {
  const secciones: Array<{ grupo: string | null; items: NavigationItem[] }> = []
  for (const item of items) {
    const ultima = secciones[secciones.length - 1]
    if (item.grupo && ultima?.grupo === item.grupo) ultima.items.push(item)
    else secciones.push({ grupo: item.grupo ?? null, items: [item] })
  }
  return secciones
}

/**
 * Opción del menú que corresponde a la página abierta (ruta y su ?tab=). Entre opciones de la misma ruta (ADRES y
 * Compras públicas en /inteligencia) gana la de la pestaña abierta; si ninguna la nombra, la que no lleva pestaña.
 * Municipios (/territories) vive en Parámetros (/configuracion).
 */
export function opcionActiva(items: readonly NavigationItem[], pathname: string | null, search: string): string | null {
  const ruta = pathname?.startsWith('/territories') ? '/configuracion' : pathname
  const deLaRuta = items.filter(item => item.href.split('?')[0] === ruta)
  if (deLaRuta.length === 0) return null
  const pestanaDe = (consulta: string) => new URLSearchParams(consulta).get('tab')
  const pestana = pestanaDe(search)
  const conPestana = deLaRuta.find(item => pestana !== null && pestanaDe(item.href.split('?')[1] ?? '') === pestana)
  const sinPestana = deLaRuta.find(item => !item.href.includes('?'))
  return (conPestana ?? sinPestana ?? deLaRuta[0]).href
}

/**
 * Página de inicio del rol: "/" (y el logo de OpMap) llevan al Mapa si el rol lo tiene; si no, a Calendario (recursos
 * humanos); si no, a la primera opción de su menú. null si el rol no tiene ninguna opción.
 */
export function getHomeRoute(role: Role | undefined): string | null {
  const rutas = getNavigationMenu(role).map(item => item.href)
  return rutas.find(ruta => ruta === '/map') ?? rutas.find(ruta => ruta === '/calendario') ?? rutas[0] ?? null
}

// Función para obtener el título del rol en español
export function getRoleTitle(role: Role): string {
  const titles: Record<Role, string> = {
    admin: 'Administrador',
    sales_manager: 'Ejecutivo comercial',
    contract_manager: 'Contratos',
    data_manager: 'Datos',
    viewer: 'Visualizador',
    user: 'Usuario',
    line_leader: 'Líder de negocio',
    commercial_director: 'Director comercial',
    hr: 'Recursos humanos'
  }
  
  return titles[role] || 'Usuario'
}