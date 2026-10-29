# Sistema de Roles y Permisos - OpMap

> La fuente de verdad es `web/lib/permissions.ts` (permisos por rol, menú, rutas e inicio) y sus pruebas
> (`scripts/menu-check.ts`, `scripts/visits-check.ts`, `scripts/terceros-check.ts`). Las secciones "Roles
> Definidos" y la matriz de abajo son históricas; el menú vigente es el de "Menú de la web".

## Menú de la web (dueño, 2026-10-14; por grupos desde el 2026-10-29)

- **Por grupos** (dueño, 2026-10-29, `docs/specs/2026-10-29-menu-por-grupos.md`): Mapa; **Terceros** (título): IPS,
  Cuentas clave (`/terceros`), Médicos, Aseguradoras y Proveedores; **Empleados**: Ejecutivos Comerciales y Líderes de
  negocio; Calendario, Zonas (`/kams`) y Líneas; **Inteligencia de Mercado**: ADRES, Compras públicas
  (`/inteligencia?tab=secop`), Contratos y Cumplimiento; **Configuración**: Mi Empresa, Usuarios, Visita VMO
  (`/visits`) y Parámetros (`/configuracion`). Médicos, Aseguradoras y Líderes de negocio abren "Próximamente". El
  inicio es el Mapa; sin mapa, Calendario. "Hospital" se dice "IPS" en toda la interfaz. Lo de abajo describe el menú
  del 2026-10-14 (el orden quedó superado).
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
- **Regiones** (`/zones`, tabla `zones`, de una versión anterior) se quitaron de la web por pedido del dueño del
  2026-10-14 (spec `docs/specs/2026-10-14-quitar-regiones.md`): ni página, ni botón "Por Regiones" ni columna Región
  en Zonas (`/kams`), ni modo Regiones en el mapa, ni `/api/zones/**` ni `/api/kams/zone`; `/api/kams/stats` y
  `/api/map/data` ya no leen Regiones. Los permisos **`zones:view` y `zones:edit` salieron** de `lib/permissions.ts`
  y de todos los roles que los tenían (admin, sales_manager, line_leader, commercial_director y data_manager);
  ningún otro permiso cambió. La tabla `zones` y la columna `kams.zone_id` quedan en la base, sin uso (borrarlas
  sería otra migración, solo si el dueño lo pide). Lo prueba `scripts/menu-check.ts` (sección 8).
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
| Contratos cargados a mano en `/api/map/data` (`hospital_contracts`) | **Nadie desde el 2026-10-24**: la ruta ya no los lee ni manda `contractValuesByHospital`, `contractProvidersByHospital`, `contractsIncluded` ni los campos de contratos de `territoryStats`; `contracts:view` deja de influir en el mapa | Pedido del dueño (spec `docs/specs/2026-10-24-mapa-giros-y-compras-12-meses.md`): los contratos manuales estaban vencidos y los reemplazan giros y compras. Con ello se cerró el hueco anotado el 2026-10-14 (`viewer`, `data_manager` y `user` con línea recibían contratos sin `contracts:view`). `/contracts`, `/providers`, `/api/contracts/**` y `/api/providers/**` siguen con `contracts:view` |
| Giros ADRES y compras SECOP de 12 meses en las tarjetas del mapa (`GET /api/map/detalle/territorio?tipo=&code=`, `GET /api/map/detalle/ips/[id]`; `/api/map/data` dice si se piden con `inteligenciaIncluida`) | `intelligence:view`: admin, commercial_director, line_leader, data_manager, viewer. `sales_manager` (solo `secop:procesos`, fila siguiente): la API responde 200 con `alcance = 'procesos'`, sin giros ni compras. Sin ninguno de los dos (`contract_manager`, `user`, `hr`): la tarjeta de siempre, sin la sección, sin llamada y sin error; la API da 403 | Misma puerta que `/inteligencia` y `/api/secop/*` (2026-10-24). Nunca nombres de personas naturales ni médicos: el proveedor es una empresa con NIT; las personas van agrupadas y contadas |
| Procesos de SECOP II publicados sin contrato (radar comercial, spec `docs/specs/2026-10-25-secop-procesos-radar.md`): sección "Procesos publicados sin contrato (SECOP II)" en las tarjetas del mapa (12 meses) y tarjeta en la ficha de la IPS (24 meses) | `secop:procesos`: admin, commercial_director, line_leader, data_manager, viewer y **sales_manager** (los Ejecutivos Comerciales). Quien tiene `secop:procesos` sin `intelligence:view` (sales_manager) ve solo esta sección, sin giros ni compras (`alcance = 'procesos'`); sin ninguno de los dos (`contract_manager`, `user`, `hr`): la tarjeta de siempre, sin llamada extra, y la API da 403 | Decisión del dueño 2026-10-25 (`docs/decisiones/2026-10-25-procesos-secop-radar-comercial.md`): es el radar para el comercial. El precio base nunca se suma ni entra en las compras; el proveedor es el que FIGURA (empresa con NIT o nombre; persona natural sin nombre ni documento); las compras de SECOP y `/inteligencia` siguen con `intelligence:view` |
| Tarjeta "Procesos publicados sin contrato (SECOP II)" de la ficha de la IPS (`GET /api/secop/hospital/[id]/procesos`, `components/HospitalProcesosCard.tsx`) | `secop:procesos`, también `sales_manager`; sin él la API da 403 sin leer tablas y la tarjeta no aparece | La respuesta es solo `{ ventana, total, procesos }`: ni compras, ni giros, ni nada de `/inteligencia`. IPS que no es entidad de compra pública (regla de la ficha), sin NIT o sin la vista 0890 → `total: 0` y la tarjeta no aparece |
| Modo Regiones del mapa (antes `?viewMode=zones`) | Nadie: se quitó el 2026-10-14; un `?viewMode=zones` viejo no hace nada | Pedido del dueño (spec `docs/specs/2026-10-14-quitar-regiones.md`); la vista de zonas (`?mode=zones`) no cambió |

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
| `terceros:view` | Ver cuentas, sedes, médicos (sin documento) y contactos; menú "Cuentas clave" (`/terceros`, grupo Terceros) y las páginas "Próximamente" de Médicos y Aseguradoras | admin, commercial_director, line_leader, sales_manager, data_manager, viewer |
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

### Zonas por línea (`web/lib/permissions.ts`; spec `docs/specs/2026-10-23-zonas-por-linea-para-lideres.md`)

Decisión del dueño del 2026-10-23 (`docs/decisiones/2026-10-23-zonas-por-linea-las-lideres-asignan.md`): las líderes
asignan su línea por Zona desde la página "Zonas" (`/kams`), dándosela o quitándosela a un Ejecutivo Comercial o a una
vacante que viva en la Zona, con vista previa simulada antes de guardar. La vacante es una plaza autorizada por la
gerencia y cuenta como una persona (elegible como local y por alcance).

| Permiso | Para qué | Roles |
|---------|----------|-------|
| `executives:lines` | Dar o quitar la propia línea a un Ejecutivo Comercial o vacante que vive en la Zona (`PUT`/`DELETE /api/executives/[id]/lineas/[lineId]`, que recalcula la cobertura sin Google); vista previa con `POST /api/coverage/simular` (nunca escribe; recorta el resultado a las líneas del usuario y, por cada línea que se quita, trae la cuenta de médicos que perderían visitante, sin nombres, que la pantalla exige confirmar antes de guardar) | admin, commercial_director, line_leader (solo en las líneas donde `business_lines.leader_user_id` es su usuario; lo limita la API con `canEditCoverageLine`, igual que `coverage:edit`) |

Qué no cambia: `executives:edit` sigue siendo la puerta para editar la ficha completa (todas las líneas, la zona base y
el campo "Líneas permitidas"); `coverage:edit` para los ajustes manuales y el recálculo; y las cifras de `/kams`
(`GET /api/kams/zonas`, `GET /api/kams/[id]/estadisticas`) usan la misma puerta que "Datos de la zona"
(`executives:view` + `hospitals:view`), así que `hr` recibe 403 y `viewer` ve todas las Zonas; SECOP solo con
`intelligence:view` y el valor de contratos solo con `contracts:view`. La administración de Zonas (agregar, colores,
editar, desactivar) sigue con `kams:edit` y Bogotá con `kams:bogota-config`.

Vocabulario: la celda sin nadie dentro del tope se llama **"Sin cobertura"** (antes "Vacante") en `/kams`, `/lines` y
la leyenda del mapa, para no confundirla con la vacante por contratar (`executives.status = 'placeholder'`), que se
muestra como **"Reservada"** cuando lleva la línea y como **"Ocupada"** cuando la lleva una persona activa. La API
rechaza con 409 dar una línea que la dirección no permitió para esa persona ("Líneas permitidas", tabla
`executive_allowed_lines`, migración 0860; sin filas = sin restricción).

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