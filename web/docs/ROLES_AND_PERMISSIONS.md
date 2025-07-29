# Sistema de Roles y Permisos - OpMap

## Roles Definidos

### 1. **Admin** (Administrador del Sistema)
**Descripción**: Control total del sistema
**Permisos**:
- ✅ Ver Dashboard completo con estadísticas
- ✅ Ver Mapa
- ✅ Ver/Editar Hospitales
- ✅ Ver/Editar KAMs
- ✅ Ver/Editar Contratos
- ✅ Ejecutar recálculos del sistema
- ✅ Ver diagnósticos del sistema
- ✅ Gestionar usuarios
- ✅ Ver reportes

### 2. **Sales Manager** (Gerente de Ventas)
**Descripción**: Gestiona el equipo comercial y territorios
**Permisos**:
- ✅ Ver Dashboard con estadísticas
- ✅ Ver Mapa
- ✅ Ver Hospitales (solo lectura)
- ✅ Ver/Editar KAMs
- ✅ Ver Contratos
- ✅ Ejecutar recálculo de asignaciones
- ✅ Ver reportes
- ❌ Gestionar usuarios
- ❌ Editar hospitales

### 3. **Contract Manager** (Gestor de Contratos)
**Descripción**: Persona encargada de buscar y gestionar contratos
**Permisos**:
- ✅ Ver Mapa
- ✅ Ver/Editar Contratos
- ✅ Ver Hospitales (info básica)
- ✅ Ver KAMs (info básica)
- ❌ Dashboard
- ❌ Editar hospitales
- ❌ Editar KAMs
- ❌ Recálculos

### 4. **Data Manager** (Gestor de Datos)
**Descripción**: Actualiza información de hospitales y vendedores
**Permisos**:
- ✅ Ver Mapa
- ✅ Ver/Editar Hospitales
- ✅ Ver/Editar KAMs
- ✅ Ver asignaciones actuales
- ❌ Dashboard
- ❌ Contratos
- ❌ Recálculos
- ❌ Gestionar usuarios

### 5. **Viewer** (Solo Lectura)
**Descripción**: Usuario básico con acceso de consulta
**Permisos**:
- ✅ Ver Mapa
- ✅ Ver información básica de hospitales
- ❌ Editar cualquier dato
- ❌ Dashboard
- ❌ Contratos
- ❌ Recálculos

## Matriz de Permisos

| Funcionalidad | Admin | Sales Manager | Contract Manager | Data Manager | Viewer |
|--------------|-------|---------------|------------------|--------------|---------|
| Dashboard | ✅ | ✅ | ❌ | ❌ | ❌ |
| Mapa | ✅ | ✅ | ✅ | ✅ | ✅ |
| Ver Hospitales | ✅ | ✅ | ✅ | ✅ | ✅ |
| Editar Hospitales | ✅ | ❌ | ❌ | ✅ | ❌ |
| Ver KAMs | ✅ | ✅ | ✅ | ✅ | ❌ |
| Editar KAMs | ✅ | ✅ | ❌ | ✅ | ❌ |
| Ver Contratos | ✅ | ✅ | ✅ | ❌ | ❌ |
| Editar Contratos | ✅ | ❌ | ✅ | ❌ | ❌ |
| Recálculo Simple | ✅ | ✅ | ❌ | ❌ | ❌ |
| Recálculo Completo | ✅ | ❌ | ❌ | ❌ | ❌ |
| Diagnósticos | ✅ | ❌ | ❌ | ❌ | ❌ |
| Gestión Usuarios | ✅ | ❌ | ❌ | ❌ | ❌ |

## Navegación por Rol

### Admin
- Dashboard
- Mapa
- Hospitales
- KAMs
- Contratos
- Diagnóstico
- Usuarios

### Sales Manager
- Dashboard
- Mapa
- Hospitales (lectura)
- KAMs
- Contratos (lectura)

### Contract Manager
- Mapa
- Contratos
- Hospitales (búsqueda)

### Data Manager
- Mapa
- Hospitales
- KAMs

### Viewer
- Mapa

## Implementación Técnica

### 1. Base de Datos
```sql
-- Actualizar tabla users
ALTER TABLE users 
ADD COLUMN role VARCHAR(50) DEFAULT 'viewer';

-- Roles posibles
-- 'admin', 'sales_manager', 'contract_manager', 'data_manager', 'viewer'
```

### 2. Middleware de Autorización
```typescript
// lib/auth.ts
export const permissions = {
  admin: ['*'], // Acceso total
  sales_manager: ['dashboard', 'map', 'hospitals:read', 'kams:*', 'contracts:read', 'recalculate:simple'],
  contract_manager: ['map', 'contracts:*', 'hospitals:read', 'kams:read'],
  data_manager: ['map', 'hospitals:*', 'kams:*', 'assignments:read'],
  viewer: ['map', 'hospitals:read']
}
```

### 3. Componentes Protegidos
```typescript
// components/ProtectedComponent.tsx
<ProtectedComponent requiredPermission="hospitals:edit">
  {/* Contenido solo visible para quienes pueden editar hospitales */}
</ProtectedComponent>
```

### 4. Rutas Protegidas
```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  const userRole = getUserRole(request)
  const path = request.nextUrl.pathname
  
  // Verificar permisos según la ruta
  if (!hasPermission(userRole, path)) {
    return NextResponse.redirect('/unauthorized')
  }
}
```