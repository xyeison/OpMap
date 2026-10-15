# Sistema de Roles y Permisos - OpMap

> La fuente de verdad es `web/lib/permissions.ts` (permisos por rol, menú, rutas e inicio) y sus pruebas
> (`scripts/menu-check.ts`, `scripts/visits-check.ts`, `scripts/terceros-check.ts`). Las secciones "Roles
> Definidos" y la matriz de abajo son históricas; el menú vigente es el de "Menú de la web".

## Menú de la web (dueño, 2026-10-14)

- **Sin Dashboard**: los indicadores (cobertura, oportunidades, hospitales, totales) no tenían sentido por ahora y
  se generarán después. `"/"` ya no muestra tablero: lleva a la **página de inicio** del rol (`getHomeRoute`), que
  es la primera opción de su menú: `/map` para todo rol con `map:view`; `/calendario` para `hr`. El logo "OpMap"
  lleva al mismo sitio. El login sigue mandando a `?next=` o, sin él, a `"/"` y de ahí al inicio.
  `dashboard:view` sigue en los roles pero ya no abre nada; `/api/dashboard/stats` se quitó.
- **Orden** (`getNavigationMenu`; cada opción solo con su permiso): Mapa, Hospitales, Terceros, Calendario, Zonas
  (`/kams`), Líneas, Ejecutivos Comerciales, Inteligencia, Contratos, Mi Empresa, Cumplimiento, Proveedores,
  Usuarios, Visitas y, al final, Configuración.
- **Municipios** sale del menú principal y queda dentro de **Configuración** (pestaña "Municipios", con
  `territories:view`, el permiso de siempre). `/territories` y `/territories/[id]` siguen funcionando; sus
  "Volver" llevan a `/configuracion?seccion=municipios`.
- **Regiones** (`/zones`, de una versión anterior) sale del menú y su página se quitó. La tabla `zones` y
  `/api/zones` (que usan el mapa y Zonas) no cambian.
- **Configuración** (`/configuracion`) se muestra con cualquiera de `PERMISOS_CONFIGURACION` (`visits:config`,
  `territories:view`, `recalculate:simple`, `recalculate:complete`) y cada sección pide el suyo
  (`seccionesConfiguracion`); con una sola sección no sale la barra de secciones. La sección va en `?seccion=`.

| Sección | Permiso | Qué tiene |
|---------|---------|-----------|
| Visitas | `visits:config` | Metas, Qué cuenta, Personas, General y Subtipos (Fase 7 F2) |
| Municipios | `territories:view` | Lista de municipios y localidades; "Asignar" (forzada) con `territories:manage` |
| Asignación | `dashboard:view` y `recalculate:simple` o `recalculate:complete` (los mismos que pedía el antiguo dashboard) | "Recalcular asignaciones" y, con `recalculate:complete`, "Calcular rutas" con Google Maps (antes en el dashboard; nada corre al abrir la página) |

Menú por rol (lo prueba `scripts/menu-check.ts`):

| Rol | Menú | Configuración |
|-----|------|---------------|
| admin | Mapa · Hospitales · Terceros · Calendario · Zonas · Líneas · Ejecutivos Comerciales · Inteligencia · Contratos · Mi Empresa · Cumplimiento · Proveedores · Usuarios · Visitas · Configuración | Visitas, Municipios, Asignación |
| commercial_director | Mapa · Hospitales · Terceros · Calendario · Zonas · Líneas · Ejecutivos Comerciales · Inteligencia · Contratos · Proveedores · Visitas · Configuración | Visitas, Municipios |
| line_leader | Mapa · Hospitales · Terceros · Calendario · Zonas · Líneas · Ejecutivos Comerciales · Inteligencia · Contratos · Configuración | Municipios |
| sales_manager | Mapa · Hospitales · Terceros · Calendario · Zonas · Líneas · Ejecutivos Comerciales · Contratos · Configuración | Municipios |
| data_manager | Mapa · Hospitales · Terceros · Zonas · Líneas · Ejecutivos Comerciales · Inteligencia · Visitas · Configuración | Municipios |
| contract_manager | Mapa · Hospitales · Líneas · Ejecutivos Comerciales · Contratos · Mi Empresa · Cumplimiento · Proveedores | — |
| viewer | Mapa · Hospitales · Terceros · Líneas · Ejecutivos Comerciales · Inteligencia | — |
| user | Mapa · Hospitales · Líneas · Ejecutivos Comerciales | — |
| hr | Calendario · Líneas · Ejecutivos Comerciales (inicio: Calendario) | — |

## "Datos de la zona" (ventana de Ejecutivos Comerciales, 2026-10-14)

Clic en una persona o vacante de `/executives` → `GET /api/executives/[id]/estadisticas` (solo lectura). Mismas
reglas que las páginas de donde salen las cifras (`lib/zona-estadisticas.ts`; pruebas en
`scripts/zona-estadisticas-check.ts` y `scripts/zona-estadisticas-api-check.ts`):

| Qué | Quién lo ve | Por qué |
|-----|-------------|---------|
| La ventana (municipios, población, afiliados, IPS, giros, visitas de VMO, médicos) | `executives:view` + `hospitals:view`: todos menos `hr` (a `hr` el nombre no se le muestra como enlace y la API da 403) | Las cifras salen de las IPS, como la ficha de la IPS y sus tarjetas de giros y entorno |
| Compras públicas (SECOP y la parte de VG Medical) | `intelligence:view`: admin, commercial_director, line_leader, data_manager, viewer | Igual que `/api/secop/*`; sin el permiso la tarjeta no sale y la ruta ni lee SECOP |
| Cobertura por línea y territorio | Solo las líneas de `GET /api/me/lines` (`resolveUserLines`): todas con `map:all-lines`; si no, las que lidera o lleva | Igual que `/api/coverage?line=`, que da 403 en las demás; sin líneas, ni cobertura ni territorio |

## Mapa: "Ver por" Ejecutivos Comerciales o Zonas (2026-10-14)

Spec `docs/specs/2026-10-14-mapa-vista-de-zonas-para-todos.md`; pruebas en `scripts/mapa-zonas-api-check.ts`.

| Qué | Quién lo ve | Por qué |
|-----|-------------|---------|
| `/map` y `GET /api/map/data` | `map:view`: todos menos `hr` (la API da 403 sin el permiso) | Mismo permiso que la página |
| Vista por Ejecutivos Comerciales (`?line=<código>`) | Las líneas de `GET /api/me/lines`: todas con `map:all-lines`; si no, las que lidera o lleva | Igual que `/api/coverage?line=`, que da 403 en las demás |
| Vista de zonas (`?mode=zones`: todas las zonas activas con su color) | `map:view` (antes solo `map:all-lines`); también quien no tiene líneas | Pedido del dueño: que las líderes vean cómo se distribuyen todas las zonas |
| En la vista de zonas, quién vive en cada zona (`kams[].executives`) | Con `map:all-lines`, todos; si no, solo quienes llevan alguna de sus líneas | Sin la cobertura ni las personas de las líneas que no ve; sin `?line` no hay cobertura |
| Contratos activos por IPS en `/api/map/data` (valor y proveedor, también en `territoryStats`) | Quien ya los recibía: `map:all-lines` o alguna línea; y quien tiene `contracts:view`. Sin líneas y sin `contracts:view` (rol `user`), no (`contractsIncluded: false`) | La vista de zonas no amplía lo que cada uno ve de las IPS. Pendiente del dueño: hoy `viewer`, `data_manager` y un `user` con línea reciben contratos sin `contracts:view` (hueco anterior al 2026-10-14, no se tocó) |
| Modo Regiones del mapa (`?mode=zones&viewMode=zones`) | Solo `map:all-lines`, como antes | Fuera de alcance de la spec (`lib/map-view.ts`) |

## Roles Definidos (histórico)

### 1. **Admin** (Administrador del Sistema)
**Descripción**: Control total del sistema
**Permisos**:
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

## Matriz de Permisos (histórico)

| Funcionalidad | Admin | Sales Manager | Contract Manager | Data Manager | Viewer |
|--------------|-------|---------------|------------------|--------------|---------|
| Dashboard (quitado el 2026-10-14) | — | — | — | — | — |
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
| `visits:config` | Ver y cambiar la configuración de visitas (metas, qué cuenta, personas, general, subtipos) y la cuota de cualquier persona; sección "Visitas" de "Configuración" (`/configuracion`) | admin, commercial_director |
| `calendar:manage` | Días de empresa y de ciudad, cargar festivos, anular días del calendario | admin, commercial_director, hr |
| `daysoff:approve` | Ver todos los días libres, aprobar o rechazar en bloque, registrar o anular por otra persona | admin, commercial_director, hr (además, el rol debe estar en `aprobacion_dias_libres.aprueban`, salvo admin; lo exige la API). Nunca sobre sus propios días: si su usuario está enlazado a un Ejecutivo Comercial, no se registra "por otra persona" (403) y la revisión en bloque omite los suyos; los registra en "Mis días libres" y los aprueba otra persona |
| `daysoff:view` | Ver, sin aprobar, los días libres de las ejecutivas de sus líneas (`executive_lines` en líneas con `business_lines.leader_user_id` = él) | line_leader |
| `visits:report` | Lo propio de un Ejecutivo Comercial: sus días libres y su cuota. Requiere usuario enlazado a una ejecutiva (si no, 403 "Tu usuario no está enlazado con un Ejecutivo Comercial") | admin, commercial_director, line_leader, sales_manager |

Menú "Calendario" (`/calendario`) con cualquiera de `calendar:manage`, `daysoff:approve`, `daysoff:view` o
`visits:report` (`PERMISOS_CALENDARIO`); cada pestaña pide el suyo. `viewer` no tiene ninguno de los cinco
(403 en configuración y días libres).

### Traspaso de Ejecutivos Comerciales (`web/lib/permissions.ts`; spec `docs/specs/2026-10-12-traspaso-ejecutivo-comercial.md`)

| Permiso | Para qué | Roles |
|---------|----------|-------|
| `executives:transfer` | Botón "Traspasar" (y "Dar de baja", que abre lo mismo) en Ejecutivos Comerciales: vista previa y traspaso en un paso de las líneas, la zona, los ajustes manuales de cobertura, el nombre del territorio y los médicos (visitantes) a otra persona, a una persona nueva o a una vacante; con la cobertura recalculada (`POST /api/executives/[id]/traspaso` y `/traspaso/vista-previa`) | admin, commercial_director |

Solo esos dos roles tienen a la vez equipo (`executives:edit`), cobertura (`coverage:edit`) y visitantes
(`visitantes:manage`); `data_manager`, `line_leader`, `viewer` y los demás reciben 403. "Contratar" una vacante
(`POST /api/executives/[id]/contratar`) pide `executives:edit` y el historial (`GET /api/executives/traspasos`),
`executives:view`; el **motivo** de cada traspaso (texto libre de la salida) solo lo reciben quienes tienen
`executives:edit` o `executives:transfer` (para los demás va en `null`).

**El traspaso no reemplaza a `users:manage`**: al dar de baja, "Desactivar su usuario" solo desactiva un usuario
activo de Ejecutivo Comercial (rol `sales_manager` o `user`) y nunca el de quien hace el traspaso. Un admin, un líder
de línea o cualquier otro rol enlazado a esa ficha sigue activo (la vista previa lo avisa) y se desactiva, si hace
falta, desde Usuarios, con sus guardas (nadie se desactiva a sí mismo; nunca el último admin).

## Navegación por Rol

Ver "Menú de la web (dueño, 2026-10-14)" al principio: el menú sale de `getNavigationMenu` y lo prueba
`scripts/menu-check.ts`. Ya no hay Dashboard, Municipios (está en Configuración) ni Regiones.

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