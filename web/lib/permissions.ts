// Sistema de permisos para OpMap

export type Role =
  | 'admin'
  | 'sales_manager'
  | 'contract_manager'
  | 'data_manager'
  | 'viewer'
  | 'user'
  | 'line_leader'          // Fase 2: líder de una línea de negocio (ajusta la cobertura de SU línea)
  | 'commercial_director'  // Fase 2: dirección comercial (ve y ajusta todas las líneas)
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
  // Zonas por línea (spec 2026-10-23): dar o quitar la propia línea a un Ejecutivo Comercial o vacante que vive en la
  // Zona (PUT/DELETE /api/executives/[id]/lineas/[lineId]); line_leader solo en su línea, lo limita la API.
  | 'executives:lines'
  | 'coverage:view'    // Fase 2: cobertura por línea (la API limita a las líneas del usuario)
  | 'coverage:edit'    // Fase 2: recalcular y ajustes manuales (line_leader solo en SU línea)
  | 'map:all-lines'    // Fase 2: ver el mapa de cualquier línea (la vista "Zonas" es de map:view desde 2026-10-14)
  | 'territory:view'           // Fase 2b: anexo de territorio por ejecutivo comercial (la API limita por línea/ejecutivo)
  | 'territory:snapshot'       // Fase 2b: guardar versiones inmutables del anexo (line_leader solo SU línea)
  | 'municipalities:recompute' // Fase 2b: recalcular municipality_zone con la caché (sin Google)
  | 'intelligence:view'        // Fase 3: inteligencia de giros ADRES (/inteligencia, GET /api/intelligence/giros)
  // Procesos de SECOP II sin contrato (radar comercial, spec 2026-10-25): la sección de las tarjetas del mapa y la tarjeta de
  // la ficha. Los roles con intelligence:view y, además, los Ejecutivos Comerciales (sales_manager), que siguen sin ver
  // las compras de SECOP ni /inteligencia. Nunca suma a las compras.
  | 'secop:procesos'
  | 'kams:bogota-config'       // PR 3: Bogotá hacia afuera (k celdas, corredores, tope único). Solo admin
  | 'fuentes:manage'           // PR 7: panel "Fuentes de datos" (estado y "Actualizar ahora") y lista vigilada de SECOP. Solo admin
  | 'terceros:view'            // Fase 6 F1: ver cuentas, sedes, médicos (sin documento) y contactos (/terceros)
  | 'terceros:create'          // Fase 6 F1: crear cuentas, sedes, médicos y contactos
  | 'terceros:manage'          // Fase 6 F1: editar o desactivar, ver documentos, confirmar sedes, marcar cliente y modalidad
  | 'visitantes:manage'        // Fase 6 F1: asignar y terminar visitantes de un médico (line_leader solo SUS líneas; lo limita la API)
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
    'lines:view',        // lines:edit es del rol line_leader (restringido a su línea)
    'executives:view',
    'coverage:view',     // Solo las líneas que lleva como ejecutiva (GET /api/me/lines)
    'territory:view',    // Solo el anexo de su(s) ejecutivo(s) enlazado(s)
    'terceros:view',     // Fase 6 F1: terceros (cuentas, sedes, médicos sin documento, contactos)
    'terceros:create',
    'secop:procesos',    // Radar de procesos de SECOP II sin contrato (2026-10-25); sin intelligence:view: ni compras ni /inteligencia
    'visits:report'      // Fase 7 F2: sus días libres y su cuota (si su usuario está enlazado a una ejecutiva)
  ],
  // Líder de línea: lo de sales_manager + editar su línea y su cobertura.
  // Las rutas /api/business-lines/** y /api/coverage/** restringen la edición a las líneas
  // donde business_lines.leader_user_id = el usuario.
  line_leader: [
    'dashboard:view',
    'map:view',
    'hospitals:view',
    'kams:view',
    'contracts:view',
    'territories:view',
    'lines:view',
    'lines:edit',
    'executives:view',
    'executives:lines',  // Dar o quitar SU línea a un Ejecutivo Comercial o vacante de la Zona (solo donde es líder; lo limita la API)
    'coverage:view',
    'coverage:edit',
    'territory:view',
    'territory:snapshot',
    'intelligence:view',
    'secop:procesos',
    'terceros:view',
    'terceros:create',
    'visitantes:manage', // Solo en las líneas donde business_lines.leader_user_id = el usuario (lo limita la API)
    'daysoff:view',      // Fase 7 F2: ve (sin aprobar) los días libres de las ejecutivas de SUS líneas
    'visits:report'      // Fase 7 F2: sus días libres y su cuota (si también es ejecutiva)
  ],
  // Dirección comercial: todo lo de ver + gestionar líneas, equipo y cobertura de todas las líneas.
  // Sin users:manage ni recalculate:complete.
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
  if (permissions.includes('terceros:view')) routes.push('/terceros')        // Fase 6 F1: cuentas y médicos
  if (PERMISOS_CONFIGURACION.some(permiso => permissions.includes(permiso))) routes.push('/configuracion') // visitas, municipios y asignación
  if (PERMISOS_CALENDARIO.some(permiso => permissions.includes(permiso))) routes.push('/calendario') // Fase 7 F2

  return routes
}

// Función para obtener el menú de navegación según el rol
export interface NavigationItem {
  name: string
  href: string
  icon: string
}

// Orden del menú (dueño, 2026-10-14): el Mapa es el menú principal y va primero; luego Hospitales, Terceros,
// Calendario, Zonas, Líneas, Ejecutivos Comerciales, Inteligencia, Contratos y el resto; Configuración al final.
// Sin Dashboard (los indicadores se generarán después), sin Municipios (está dentro de Configuración) y sin
// Regiones (/zones, de una versión anterior; quitadas el 2026-10-14). Cada ítem sale solo con su permiso; texto
// visible sin "KAM".
export function getNavigationMenu(role: Role | undefined): NavigationItem[] {
  if (!role) return []

  const menu: NavigationItem[] = []
  const permissions = rolePermissions[role] || []

  if (permissions.includes('map:view')) {
    menu.push({ name: 'Mapa', href: '/map', icon: 'map' })
  }

  if (permissions.includes('hospitals:view')) {
    menu.push({ name: 'Hospitales', href: '/hospitals', icon: 'building' })
  }

  // Fase 6 F1: terceros (cuentas con sus sedes, médicos y contactos)
  if (permissions.includes('terceros:view')) {
    menu.push({ name: 'Terceros', href: '/terceros', icon: 'users' })
  }

  // Fase 7 F2: calendario (festivos, días de empresa y de ciudad) y días libres
  if (PERMISOS_CALENDARIO.some(permiso => permissions.includes(permiso))) {
    menu.push({ name: 'Calendario', href: '/calendario', icon: 'calendar' })
  }

  // Cada fila de kams es una Zona (las rutas siguen siendo /kams)
  if (permissions.includes('kams:view')) {
    menu.push({ name: 'Zonas', href: '/kams', icon: 'users' })
  }

  if (permissions.includes('lines:view')) {
    menu.push({ name: 'Líneas', href: '/lines', icon: 'lines' })
  }

  if (permissions.includes('executives:view')) {
    menu.push({ name: 'Ejecutivos Comerciales', href: '/executives', icon: 'executives' })
  }

  // Fase 3 y 5: giros ADRES y compras públicas
  if (permissions.includes('intelligence:view')) {
    menu.push({ name: 'Inteligencia', href: '/inteligencia', icon: 'intelligence' })
  }

  if (permissions.includes('contracts:view')) {
    menu.push({ name: 'Contratos', href: '/contracts', icon: 'document' })
  }

  // Agregar Mi Empresa y Cumplimiento para roles que gestionan contratos
  if (permissions.includes('contracts:edit') || role === 'admin') {
    menu.push({ name: 'Mi Empresa', href: '/mi-empresa', icon: 'building' })
    menu.push({ name: 'Cumplimiento', href: '/compliance', icon: 'clipboard' })
  }

  if (permissions.includes('providers:view')) {
    menu.push({ name: 'Proveedores', href: '/providers', icon: 'providers' })
  }

  if (permissions.includes('users:manage')) {
    menu.push({ name: 'Usuarios', href: '/users', icon: 'user-group' })
  }

  if (permissions.includes('visits:view')) {
    menu.push({ name: 'Visitas', href: '/visits', icon: 'location' })
  }

  // Al final: configuración de visitas, Municipios y Asignación (cada sección con su permiso)
  if (PERMISOS_CONFIGURACION.some(permiso => permissions.includes(permiso))) {
    menu.push({ name: 'Configuración', href: '/configuracion', icon: 'settings' })
  }

  return menu
}

/**
 * Página de inicio del rol: "/" (y el logo de OpMap) llevan a la primera opción de su menú, que para quien tiene
 * map:view es /map; recursos humanos, sin mapa, va a /calendario. null si el rol no tiene ninguna opción.
 */
export function getHomeRoute(role: Role | undefined): string | null {
  return getNavigationMenu(role)[0]?.href ?? null
}

// Función para obtener el título del rol en español
export function getRoleTitle(role: Role): string {
  const titles: Record<Role, string> = {
    admin: 'Administrador',
    sales_manager: 'Ventas',
    contract_manager: 'Contratos',
    data_manager: 'Datos',
    viewer: 'Visualizador',
    user: 'Usuario',
    line_leader: 'Líder de línea',
    commercial_director: 'Dirección comercial',
    hr: 'Recursos humanos'
  }
  
  return titles[role] || 'Usuario'
}