// Sistema de permisos para OpMap

export type Role = 'admin' | 'sales_manager' | 'contract_manager' | 'data_manager' | 'viewer' | 'user'

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
    'territories:manage'
  ],
  sales_manager: [
    'dashboard:view',
    'map:view',
    'hospitals:view',  // Solo ver hospitales, NO editar
    'kams:view',       // Puede ver KAMs
    'zones:view',      // Puede ver zonas
    'contracts:view',  // Solo ver contratos, NO editar
    'territories:view'  // Solo ver territorios, NO gestionar
  ],
  contract_manager: [
    'map:view',
    'hospitals:view',
    'hospitals:edit',  // Puede editar hospitales (incluyendo doctores)
    'contracts:view',
    'contracts:edit',
    'contracts:delete',
    'providers:view',
    'providers:edit'  // Puede gestionar proveedores
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
    'territories:manage'  // Puede gestionar asignaciones forzadas
  ],
  viewer: [
    'map:view',
    'hospitals:view'
  ],
  user: [
    'map:view',
    'hospitals:view'
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
  
  if (permissions.includes('kams:view')) {
    menu.push({ name: 'KAMs', href: '/kams', icon: 'users' })
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
    user: 'Usuario'
  }
  
  return titles[role] || 'Usuario'
}