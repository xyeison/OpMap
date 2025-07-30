// Sistema de permisos para OpMap

export type Role = 'admin' | 'sales_manager' | 'contract_manager' | 'data_manager' | 'viewer' | 'user'

export type Permission = 
  | 'dashboard:view'
  | 'map:view'
  | 'hospitals:view'
  | 'hospitals:edit'
  | 'kams:view'
  | 'kams:edit'
  | 'contracts:view'
  | 'contracts:edit'
  | 'recalculate:simple'
  | 'recalculate:complete'
  | 'diagnostics:view'
  | 'users:manage'

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
    'recalculate:simple',
    'recalculate:complete',
    'diagnostics:view',
    'users:manage'
  ],
  sales_manager: [
    'dashboard:view',
    'map:view',
    'hospitals:view',
    'kams:view',
    'kams:edit',
    'contracts:view',
    'recalculate:simple'
  ],
  contract_manager: [
    'map:view',
    'hospitals:view',  // Solo ver hospitales, NO editar
    'contracts:view',
    'contracts:edit'
  ],
  data_manager: [
    'map:view',
    'hospitals:view',
    'hospitals:edit',
    'kams:view',
    'kams:edit'
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
  if (permissions.includes('contracts:view')) routes.push('/contracts')
  if (permissions.includes('diagnostics:view')) routes.push('/diagnostics')
  if (permissions.includes('users:manage')) routes.push('/users')
  
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
  
  if (permissions.includes('map:view')) {
    menu.push({ name: 'Mapa', href: '/map', icon: 'map' })
  }
  
  if (permissions.includes('hospitals:view')) {
    menu.push({ name: 'Hospitales', href: '/hospitals', icon: 'building' })
  }
  
  if (permissions.includes('kams:view')) {
    menu.push({ name: 'KAMs', href: '/kams', icon: 'users' })
  }
  
  if (permissions.includes('contracts:view')) {
    menu.push({ name: 'Contratos', href: '/contracts', icon: 'document' })
  }
  
  if (permissions.includes('diagnostics:view')) {
    menu.push({ name: 'Diagnóstico', href: '/diagnostics', icon: 'chart' })
  }
  
  if (permissions.includes('users:manage')) {
    menu.push({ name: 'Usuarios', href: '/users', icon: 'user-group' })
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