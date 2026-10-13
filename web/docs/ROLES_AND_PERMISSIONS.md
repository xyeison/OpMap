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

### Fase 6 · F1 Terceros (`web/lib/permissions.ts`; contrato `docs/fases/fase6-visitas-f1-terceros.md`)

| Permiso | Para qué | Roles |
|---------|----------|-------|
| `terceros:view` | Ver cuentas, sedes, médicos (sin documento) y contactos; menú "Terceros" (`/terceros`) | admin, commercial_director, line_leader, sales_manager, data_manager, viewer |
| `terceros:create` | Crear cuentas (con su sede principal), sedes, médicos (verificar documento) y contactos; vincular sedes a un médico | admin, commercial_director, line_leader, sales_manager, data_manager |
| `terceros:manage` | Editar o desactivar, ver el documento del médico y la identificación de personas, confirmar ubicación de sedes, marcar cliente y modalidad (solo EPS), desvincular sedes de un médico | admin, commercial_director, data_manager |
| `visitantes:manage` | Asignar y terminar visitantes de un médico | admin, commercial_director, line_leader (solo en las líneas donde `business_lines.leader_user_id` es su usuario; lo exige la API) |

El documento del médico nunca sale en listas; en el detalle, solo con `terceros:manage` (sin ese permiso ni
siquiera se pide a la base). Buscar por un documento de persona (cédula del médico, CC/CE/PA de una cuenta) también
es de `terceros:manage` y solo por `POST /api/terceros/{cuentas,medicos}/buscar` (el documento va en el cuerpo, nunca
en la URL ni en los logs de peticiones); por GET un número solo busca NIT.

### Fase 7 · F2 Configuración y calendario (`web/lib/permissions.ts`; contrato `docs/fases/fase7-visitas-f2-config-calendario.md`)

Rol nuevo **`hr`** ("Recursos humanos"; migración 0810 lo añade a `users_role_check`): `lines:view`,
`executives:view`, `calendar:manage`, `daysoff:approve`. Sin mapa ni dashboard.

| Permiso | Para qué | Roles |
|---------|----------|-------|
| `visits:config` | Ver y cambiar la configuración de visitas (metas, qué cuenta, personas, general, subtipos) y la cuota de cualquier persona; menú "Configuración" (`/configuracion`) | admin, commercial_director |
| `calendar:manage` | Días de empresa y de ciudad, cargar festivos, anular días del calendario | admin, commercial_director, hr |
| `daysoff:approve` | Ver todos los días libres, aprobar o rechazar en bloque, registrar o anular por otra persona | admin, commercial_director, hr (además, el rol debe estar en `aprobacion_dias_libres.aprueban`, salvo admin; lo exige la API). Nunca sobre sus propios días: si su usuario está enlazado a un Ejecutivo Comercial, no se registra "por otra persona" (403) y la revisión en bloque omite los suyos; los registra en "Mis días libres" y los aprueba otra persona |
| `daysoff:view` | Ver, sin aprobar, los días libres de las ejecutivas de sus líneas (`executive_lines` en líneas con `business_lines.leader_user_id` = él) | line_leader |
| `visits:report` | Lo propio de un Ejecutivo Comercial: sus días libres y su cuota. Requiere usuario enlazado a una ejecutiva (si no, 403 "Tu usuario no está enlazado con un Ejecutivo Comercial") | admin, commercial_director, line_leader, sales_manager |

Menú "Calendario" (`/calendario`) con cualquiera de `calendar:manage`, `daysoff:approve`, `daysoff:view` o
`visits:report` (`PERMISOS_CALENDARIO`); cada pestaña pide el suyo. `viewer` no tiene ninguno de los cinco
(403 en configuración y días libres).

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