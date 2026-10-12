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

export type Permission =
  | 'dashboard:view'
  | 'map:view'
  | 'hospitals:view'
  | 'hospitals:edit'
  | 'kams:view'
  | 'kams:edit'
  | 'zones:view'
  | 'zones:edit'
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
  | 'lines:view'       // Fase 1: líneas de negocio (PerOssal, Reemplazo articular...)
  | 'lines:edit'
  | 'executives:view'  // Fase 1: ejecutivas comerciales (personas)
  | 'executives:edit'
  | 'coverage:view'    // Fase 2: cobertura por línea (la API limita a las líneas del usuario)
  | 'coverage:edit'    // Fase 2: recalcular y ajustes manuales (line_leader solo en SU línea)
  | 'map:all-lines'    // Fase 2: ver el mapa de cualquier línea y la vista "Zonas"
  | 'territory:view'           // Fase 2b: anexo de territorio por ejecutivo comercial (la API limita por línea/ejecutivo)
  | 'territory:snapshot'       // Fase 2b: guardar versiones inmutables del anexo (line_leader solo SU línea)
  | 'municipalities:recompute' // Fase 2b: recalcular municipality_zone con la caché (sin Google)
  | 'intelligence:view'        // Fase 3: inteligencia de giros ADRES (/inteligencia, GET /api/intelligence/giros)
  | 'kams:bogota-config'       // PR 3: Bogotá hacia afuera (k celdas, corredores, tope único). Solo admin
  | 'fuentes:manage'           // PR 7: panel "Fuentes de datos" (estado y "Actualizar ahora") y lista vigilada de SECOP. Solo admin
  | 'terceros:view'            // Fase 6 F1: ver cuentas, sedes, médicos (sin documento) y contactos (/terceros)
  | 'terceros:create'          // Fase 6 F1: crear cuentas, sedes, médicos y contactos
  | 'terceros:manage'          // Fase 6 F1: editar o desactivar, ver documentos, confirmar sedes, marcar cliente y modalidad
  | 'visitantes:manage'        // Fase 6 F1: asignar y terminar visitantes de un médico (line_leader solo SUS líneas; lo limita la API)

// Definición de permisos por rol
export const rolePermissions: Record<Role, Permission[]> = {
  admin: [
    'dashboard:view',
    'map:view',
    'hospitals:view',
    'hospitals:edit',
    'kams:view',
    'kams:edit',
    'zones:view',
    'zones:edit',
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
    'coverage:view',
    'coverage:edit',
    'map:all-lines',
    'territory:view',
    'territory:snapshot',
    'municipalities:recompute',
    'intelligence:view',
    'kams:bogota-config',
    'fuentes:manage',
    'terceros:view',
    'terceros:create',
    'terceros:manage',
    'visitantes:manage'
  ],
  sales_manager: [
    'dashboard:view',
    'map:view',
    'hospitals:view',  // Solo ver hospitales, NO editar
    'kams:view',       // Puede ver KAMs
    'zones:view',      // Puede ver zonas
    'contracts:view',  // Solo ver contratos, NO editar
    'territories:view',  // Solo ver territorios, NO gestionar
    'lines:view',        // lines:edit es del rol line_leader (restringido a su línea)
    'executives:view',
    'coverage:view',     // Solo las líneas que lleva como ejecutiva (GET /api/me/lines)
    'territory:view',    // Solo el anexo de su(s) ejecutivo(s) enlazado(s)
    'terceros:view',     // Fase 6 F1: terceros (cuentas, sedes, médicos sin documento, contactos)
    'terceros:create'
  ],
  // Líder de línea: lo de sales_manager + editar su línea y su cobertura.
  // Las rutas /api/business-lines/** y /api/coverage/** restringen la edición a las líneas
  // donde business_lines.leader_user_id = el usuario.
  line_leader: [
    'dashboard:view',
    'map:view',
    'hospitals:view',
    'kams:view',
    'zones:view',
    'contracts:view',
    'territories:view',
    'lines:view',
    'lines:edit',
    'executives:view',
    'coverage:view',
    'coverage:edit',
    'territory:view',
    'territory:snapshot',
    'intelligence:view',
    'terceros:view',
    'terceros:create',
    'visitantes:manage'  // Solo en las líneas donde business_lines.leader_user_id = el usuario (lo limita la API)
  ],
  // Dirección comercial: todo lo de ver + gestionar líneas, equipo y cobertura de todas las líneas.
  // Sin users:manage ni recalculate:complete.
  commercial_director: [
    'dashboard:view',
    'map:view',
    'hospitals:view',
    'kams:view',
    'zones:view',
    'contracts:view',
    'providers:view',
    'visits:view',
    'territories:view',
    'lines:view',
    'lines:edit',
    'executives:view',
    'executives:edit',
    'coverage:view',
    'coverage:edit',
    'map:all-lines',
    'territory:view',
    'territory:snapshot',
    'intelligence:view',
    'terceros:view',
    'terceros:create',
    'terceros:manage',
    'visitantes:manage'
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
    'zones:view',
    'zones:edit',      // Puede editar zonas
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
    'terceros:view'
  ],
  user: [
    'map:view',
    'hospitals:view',
    'lines:view',
    'executives:view'
  ]
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
  
  // Mapear permisos a rutas
  if (permissions.includes('dashboard:view')) routes.push('/', '/dashboard')
  if (permissions.includes('map:view')) routes.push('/map')
  if (permissions.includes('hospitals:view')) routes.push('/hospitals', '/hospitals/[id]')
  if (permissions.includes('kams:view')) routes.push('/kams')
  if (permissions.includes('zones:view')) routes.push('/zones')
  if (permissions.includes('contracts:view')) routes.push('/contracts')
  if (permissions.includes('providers:view')) routes.push('/providers', '/providers/[id]')
  if (permissions.includes('users:manage')) routes.push('/users')
  if (permissions.includes('visits:view')) routes.push('/visits')
  if (permissions.includes('territories:view')) routes.push('/territories', '/territories/[id]')
  if (permissions.includes('lines:view')) routes.push('/lines')            // Fase 1
  if (permissions.includes('executives:view')) routes.push('/executives')  // Fase 1
  if (permissions.includes('intelligence:view')) routes.push('/inteligencia') // Fase 3: giros ADRES
  if (permissions.includes('terceros:view')) routes.push('/terceros')        // Fase 6 F1: cuentas y médicos
  
  return routes
}

// Función para obtener el menú de navegación según el rol
export function getNavigationMenu(role: Role | undefined) {
  if (!role) return []
  
  const menu = []
  const permissions = rolePermissions[role] || []
  
  if (permissions.includes('dashboard:view')) {
    menu.push({ name: 'Dashboard', href: '/', icon: 'home' })
  }
  
  // Municipios como segundo ítem después de Dashboard
  if (permissions.includes('territories:view')) {
    menu.push({ name: 'Municipios', href: '/territories', icon: 'map' })
  }
  
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
  
  if (permissions.includes('kams:view')) {
    menu.push({ name: 'Zonas', href: '/kams', icon: 'users' })
  }

  if (permissions.includes('zones:view')) {
    menu.push({ name: 'Zonas', href: '/zones', icon: 'location' })
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
  
  return menu
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
    commercial_director: 'Dirección comercial'
  }
  
  return titles[role] || 'Usuario'
}