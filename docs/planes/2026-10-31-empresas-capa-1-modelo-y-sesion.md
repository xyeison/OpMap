# Empresas y papeles · capa 1 (modelo y sesión) · plan de implementación

> **Para quien ejecute:** SKILL REQUERIDA: `subagent-driven-development` (recomendada) o `executing-plans`, tarea por
> tarea. Los pasos llevan casillas (`- [ ]`) para seguir el avance.

**Objetivo:** que OpMap sepa de empresas, que cada persona tenga papeles por empresa (y por línea si es líder), que la
sesión esté "como" una empresa y que lo que puede hacer sea la suma de sus papeles allí, sin que nadie con una sola
empresa y un solo papel note nada.

**Arquitectura:** tablas nuevas (`empresas`, `linea_empresas`, `papeles`, `papel_zonas`, `executive_empresas`,
`asignaciones`, `odoo_enlaces`, `users.empresa_activa_id`) sembradas desde lo de hoy; las columnas viejas
(`users.role`, `business_lines.leader_user_id`, `executive_lines`) siguen como caché que escribe el servidor. Las reglas
puras van en `web/lib/empresas-reglas.ts` (probadas sin red); el acceso a datos en `web/lib/empresas.ts`; la sesión
lleva la empresa activa como claim `emp`, pero manda la columna.

**Tecnologías:** Next.js 14 App Router, TypeScript, Supabase (service_role, PostgREST), Zod, pruebas `tsx` sin red con
el Supabase falso de `scripts/lineas-permitidas-api-check.ts`; app Expo en `mobile/` con sus `scripts/checks`.

**Spec:** `docs/specs/2026-10-31-empresas-papeles-y-asignaciones.md` (capa 1). Decisión:
`docs/decisiones/2026-10-31-empresas-papeles-y-asignaciones.md`.

## Restricciones globales

- Idioma español en código nuevo, textos y commits (prefijo convencional, cuerpo con el porqué).
- Nunca "KAM" ni "Vacante" en texto visible; "Zona", "Ejecutivo Comercial", "Líder de negocio".
- Los nombres de los papeles son exactamente los roles de hoy: `admin`, `commercial_director`, `line_leader`,
  `sales_manager`, `contract_manager`, `data_manager`, `hr`, `viewer`, `user`. Orden de "más alto":
  `admin` > `commercial_director` > `line_leader` > `sales_manager` > `contract_manager` > `data_manager` > `hr` >
  `viewer` > `user`.
- Ids fijos de la semilla: VG `a0000000-0000-4000-8000-000000000001` (`codigo` `vg`, `nombre` "VG Medical SAS",
  `nombre_corto` "VG", `nit` `901080496`); Medix `a0000000-0000-4000-8000-000000000002` (`medix`, "Medix", "Medix",
  `nit` NULL). Toda columna `empresa_id` nueva lleva `DEFAULT` el id de VG.
- Un líder nacional (sin Zonas) por línea y empresa, o varios con Zonas disjuntas.
- La migración se ESCRIBE; se aplica solo con autorización del dueño. Nada llama a Google. Costo 0.
- Las pruebas nuevas entran en `npm run test` (`web/package.json`) y en `mobile/scripts/movil-check.ts`. Cerrar cada
  tarea con `npm run check` (en `web/`, y en `mobile/` si la tocó) y mostrar la salida.
- El cliente de `lib/supabase-admin.ts` ya hace `cache: 'no-store'`: no cambiarlo.

## Foco de revisión

1. **Token con `emp` de una empresa donde la persona ya no tiene papel** (se lo quitaron): debe entrar igual, "como" la
   empresa de la columna o la primera, nunca 401 ni 500. Prueba en la tarea 3.
2. **Persona activa sin ningún papel** (la crearon y aún no le dieron nada): entra, `role` `user`, menú solo con
   `/inicio`, la app responde `sin_persona`. Prueba en la tarea 3 y la 5.
3. **0960 sin aplicar** (previews de Vercel antes de la ventana): el servidor sigue con `users.role` como único papel,
   `empresa` null y `empresas` vacío; nada responde 500. Prueba en la tarea 3.
4. **Quitar `sales_manager` a una persona sin fila en `executives`**: 0 afectados, 200, sin error. Prueba en la tarea 7.
5. **Quitar una empresa a una línea que tiene líder o asignaciones en esa empresa**: 409 con mensaje, nada se escribe.
   Prueba en la tarea 9.

---

### Tarea 1: reglas puras de empresas y papeles

**Archivos:**
- Crear: `web/lib/empresas-reglas.ts`
- Crear: `web/scripts/empresas-check.ts`
- Modificar: `web/package.json` (añadir `tsx scripts/empresas-check.ts` al final de `test`)

**Interfaces:**
- Produce (todo exportado de `empresas-reglas.ts`):
  ```ts
  export const EMPRESA_VG_ID = 'a0000000-0000-4000-8000-000000000001'
  export const EMPRESA_MEDIX_ID = 'a0000000-0000-4000-8000-000000000002'
  export interface Empresa { id: string; codigo: string; nombre: string; nombre_corto: string; activa: boolean }
  export interface PapelActivo { id: string; empresa_id: string; papel: Role; line_id: string | null; kam_ids: string[] }
  export interface PapelEntrada { papel: Role; line_id?: string | null; kam_ids?: string[] }
  export const ORDEN_PAPELES: readonly Role[]
  export function papelMasAlto(papeles: readonly { papel: Role }[]): Role            // 'user' si está vacía
  export function tienePermiso(papeles: readonly { papel: Role }[], permiso: Permission): boolean
  export function empresaActivaDe(entrada: { empresaActivaId: string | null; claimEmp: string | null; empresas: readonly Empresa[] }): Empresa | null
  export function validarLiderDeLinea(existentes: readonly { user_id: string; kam_ids: string[] }[], nuevo: { user_id: string; kam_ids: string[] }): { ok: true } | { ok: false; error: string }
  export const MENSAJE_LIDER_NACIONAL_UNICO = 'Esa línea ya tiene líder nacional en esta empresa'
  export const MENSAJE_LIDER_ZONAS_SOLAPADAS = 'Otra líder de esa línea ya tiene alguna de esas Zonas'
  export const MENSAJE_LINEA_FUERA_DE_EMPRESA = 'Esa línea no está en esta empresa'
  export function cacheRolDe(papelesEnVG: readonly { papel: Role }[]): Role              // papelMasAlto, 'user' sin ninguno
  export function cacheLiderDe(lideresEnVG: readonly { user_id: string; kam_ids: string[] }[]): string | null  // el nacional; null si no hay o solo hay por Zonas
  export function papelesDeSemilla(usuarios: readonly { id: string; role: Role; active: boolean }[], lineas: readonly { id: string; leader_user_id: string | null }[]): { ok: true; filas: { user_id: string; empresa_id: string; papel: Role; line_id: string | null }[] } | { ok: false; error: string }
  export function tituloDePapeles(papeles: readonly { papel: Role }[]): string           // getRoleTitle de cada uno, sin repetir, en ORDEN_PAPELES, unidos con ' · '
  ```
  `tienePermiso` = `papeles.some(p => hasPermission(p.papel, permiso))` (conserva que `admin` lo puede todo).
  `empresaActivaDe`: la columna si está en `empresas`; si no, el claim si está; si no, la primera por `codigo`; null
  sin empresas. `papelesDeSemilla` es el ESPEJO en TypeScript de la semilla SQL de la tarea 2: por cada usuario activo
  con `role <> 'line_leader'` una fila en VG, y además una en Medix si es `admin` o `commercial_director`; por cada
  línea con `leader_user_id` una fila `line_leader` en VG con esa línea; `{ ok: false }` con el nombre del problema si
  un usuario activo `line_leader` no lidera ninguna línea.

- [ ] **Paso 1: escribir las pruebas que fallan** en `scripts/empresas-check.ts` (mismo mini marco `check` de
      `scripts/menu-check.ts`; sección "1. Reglas puras"), con estas afirmaciones:
  - `papelMasAlto([])` = `'user'`; `papelMasAlto([{papel:'sales_manager'},{papel:'line_leader'}])` = `'line_leader'`;
    con `admin` en cualquier posición = `'admin'`.
  - `tienePermiso([{papel:'line_leader'}], 'executives:lines')` = false; `tienePermiso([{papel:'line_leader'}], 'campo:app')`
    = true; `tienePermiso([{papel:'line_leader'},{papel:'sales_manager'}], 'visits:report')` = true;
    `tienePermiso([], 'map:view')` = false; `tienePermiso([{papel:'admin'}], 'campo:app')` = true (como hoy `hasPermission`).
  - `empresaActivaDe`: sin `emp` y `[vg]` → vg; sin `emp` y `[vg, medix]` → vg (por `codigo`, aunque lleguen
    desordenadas); columna medix → medix aunque `emp` diga vg; columna null y `emp` medix con papel → medix; `emp`
    de una empresa que no está en la lista → la primera; lista vacía → null.
  - `validarLiderDeLinea([], {kam_ids:[]})` ok; `([{nacional}], {kam_ids:[]})` → `MENSAJE_LIDER_NACIONAL_UNICO`;
    `([{nacional}], {kam_ids:['A']})` → `MENSAJE_LIDER_NACIONAL_UNICO`; `([{kam_ids:['A']}], {kam_ids:['B']})` ok;
    `([{kam_ids:['A','B']}], {kam_ids:['B']})` → `MENSAJE_LIDER_ZONAS_SOLAPADAS`; `([{kam_ids:['A']}], {kam_ids:[]})` →
    `MENSAJE_LIDER_NACIONAL_UNICO` (no cabe un nacional junto a uno por Zonas). Las filas del mismo `user_id` no cuentan.
  - `cacheRolDe([])` = `'user'`; `cacheLiderDe([{u1, []}])` = `u1`; `cacheLiderDe([{u1,['A']},{u2,['B']}])` = null.
  - `papelesDeSemilla`: un `sales_manager` activo → 1 fila (VG); un `admin` → 2 filas (VG y Medix); un
    `commercial_director` → 2; un usuario inactivo → 0; un `line_leader` que lidera dos líneas → 2 filas
    `line_leader` con `line_id` y ninguna sin línea; un `line_leader` activo sin línea → `{ ok: false }`; un
    `commercial_director` que además es `leader_user_id` de una línea → sus 2 filas más 1 `line_leader`.
  - `tituloDePapeles([{papel:'sales_manager'},{papel:'line_leader'}])` = `'Líder de negocio · Ejecutivo Comercial'`.
- [ ] **Paso 2: correrlas y ver que fallan.** `cd web && npx tsx scripts/empresas-check.ts` → falla por módulo
      inexistente.
- [ ] **Paso 3: implementar `web/lib/empresas-reglas.ts`** con las firmas de arriba. Importa `Role`, `Permission`,
      `hasPermission`, `getRoleTitle` de `./permissions`. Sin acceso a datos.
- [ ] **Paso 4: correr y ver que pasan.** `npx tsx scripts/empresas-check.ts` → `OK` en todas, salida 0.
- [ ] **Paso 5: añadir el script a `test` en `web/package.json` y commit.**
  ```bash
  git add web/lib/empresas-reglas.ts web/scripts/empresas-check.ts web/package.json
  git commit -m "feat(empresas): reglas puras de papeles, empresa activa y semilla espejo"
  ```

---

### Tarea 2: migración 0960 y su rollback

**Archivos:**
- Crear: `database/migrations/2026-10-31_0960_empresas_papeles_asignaciones.sql`
- Crear: `database/migrations/2026-10-31_9961_empresas_papeles_asignaciones_rollback.sql`
- Modificar: `docs/base-de-datos.md` (sección nueva "Empresas y papeles (0960)")

**Interfaces:**
- Produce las tablas que leen las tareas 3, 7 y 9. Columnas exactas:
  - `empresas(id uuid PK, codigo text UNIQUE, nombre text, nombre_corto text, nit text NULL, activa boolean DEFAULT true, odoo_url text NULL, created_at timestamptz)`.
  - `linea_empresas(line_id → business_lines ON DELETE CASCADE, empresa_id → empresas, PK (line_id, empresa_id))`.
  - `papeles(id uuid PK, user_id → users ON DELETE CASCADE, empresa_id → empresas, papel text CHECK IN (los 9), line_id → business_lines NULL, activo boolean DEFAULT true, created_by → users NULL, created_at)`;
    CHECK `(papel = 'line_leader') = (line_id IS NOT NULL)`; índice único `(user_id, empresa_id, papel, coalesce(line_id, '00000000-0000-0000-0000-000000000000'::uuid))`;
    disparador `papeles_linea_en_empresa` (BEFORE INSERT/UPDATE): si `line_id` no está en `linea_empresas` para esa
    `empresa_id` → RAISE con `MENSAJE_LINEA_FUERA_DE_EMPRESA`.
  - `papel_zonas(papel_id → papeles ON DELETE CASCADE, kam_id → kams, PK (papel_id, kam_id))`; disparador
    `papeles_lider_unico` (AFTER INSERT/UPDATE en `papeles` y AFTER INSERT/DELETE en `papel_zonas`, CONSTRAINT
    DEFERRABLE INITIALLY DEFERRED) con la regla de `validarLiderDeLinea`.
  - `executive_empresas(executive_id → executives ON DELETE CASCADE, empresa_id → empresas, activo boolean DEFAULT true, PK (executive_id, empresa_id))`.
  - `asignaciones(id uuid PK, executive_id → executives ON DELETE CASCADE, kam_id → kams ON DELETE CASCADE, line_id → business_lines ON DELETE CASCADE, empresa_id → empresas DEFAULT VG, created_by → users NULL, created_at)`;
    UNIQUE `(executive_id, kam_id, line_id, empresa_id)`; disparador `asignaciones_coherentes` (BEFORE INSERT/UPDATE):
    (`line_id`, `empresa_id`) en `linea_empresas` y (`executive_id`, `empresa_id`) en `executive_empresas`.
  - `odoo_enlaces(id uuid PK, empresa_id → empresas, tabla text, fila_id uuid, modelo text, odoo_id integer, created_at)`;
    UNIQUE `(empresa_id, tabla, fila_id)` y `(empresa_id, modelo, odoo_id)`.
  - `users.empresa_activa_id uuid NULL → empresas ON DELETE SET NULL`.
  - `coverage.empresa_id`, `coverage_overrides.empresa_id`, `territory_snapshots.empresa_id`, `visits.empresa_id`,
    `visitas_agenda.empresa_id`, `medico_visitantes.empresa_id`: `uuid NOT NULL DEFAULT VG → empresas`;
    `coverage`: la UNIQUE `(line_id, kam_id)` pasa a `(empresa_id, line_id, kam_id)`.
- Semilla (en el orden): empresas VG y Medix; `linea_empresas` todas las `business_lines` → VG; `papeles` según
  `papelesDeSemilla` (tarea 1); `executive_empresas` todas las `executives` → VG; `asignaciones` una por fila de
  `executive_lines` con `kam_id = executives.base_kam_id` y VG; `odoo_enlaces` desde `executives.odoo_employee_id`
  no nulo (`tabla` `executives`, `modelo` `hr.employee`, VG).
- Precondiciones (RAISE y nada se aplica): algún usuario activo `line_leader` sin línea que lidere (listar cuántos);
  alguna fila de `executive_lines` cuya persona no tenga `base_kam_id`; `executive_lines` o `kams` ausentes.
- Encabezado, `BEGIN/COMMIT`, RLS activada sin políticas, `REVOKE` a `anon, authenticated`, `GRANT` a `service_role`,
  `COMMENT ON` por tabla, y `NOTIFY pgrst, 'reload schema'` al final: igual que `2026-10-30_0950_medicos_contactos.sql`.
  Re-ejecutable: sí (`IF NOT EXISTS`; las semillas con `ON CONFLICT DO NOTHING`).
- Rollback 9961: quita las columnas `empresa_id` y `users.empresa_activa_id`, devuelve la UNIQUE de `coverage`, borra
  las tablas nuevas (con aviso de cuántas filas de `papeles` y `asignaciones` se pierden; `executive_lines` y
  `users.role` no se tocan, siguen siendo la verdad de antes).

- [ ] **Paso 1: escribir la 0960** con todo lo de arriba, un bloque `DO` de pruebas al final que se deshace con
      SQLSTATE `'P0960'` (patrón de la 0950): inserta dos papeles `line_leader` nacionales de la misma línea y empresa y
      comprueba que el segundo falla; inserta una asignación con línea fuera de la empresa y comprueba que falla.
- [ ] **Paso 2: escribir la 9961.**
- [ ] **Paso 3: comprobar sintaxis sin base.** `psql` no está; correr
      `node -e "for (const f of ['database/migrations/2026-10-31_0960_empresas_papeles_asignaciones.sql','database/migrations/2026-10-31_9961_empresas_papeles_asignaciones_rollback.sql']) { const s=require('fs').readFileSync(f,'utf8'); if(!/^BEGIN;/m.test(s)||!/^COMMIT;/m.test(s)) throw new Error(f) }"`
      → sin error. La prueba real es el bloque `DO` cuando el dueño la aplique.
- [ ] **Paso 4: documentar** en `docs/base-de-datos.md` las tablas y columnas, y en `database/migrations/README.md`
      añadir la fila de la 0960 a la tabla de orden.
- [ ] **Paso 5: commit.**
  ```bash
  git add database/migrations/2026-10-31_0960_empresas_papeles_asignaciones.sql database/migrations/2026-10-31_9961_empresas_papeles_asignaciones_rollback.sql docs/base-de-datos.md database/migrations/README.md
  git commit -m "feat(db): 0960 empresas, papeles, asignaciones y enlaces a Odoo (no aplicada)"
  ```

---

### Tarea 3: sesión con empresa activa y papeles

**Archivos:**
- Modificar: `web/lib/session.ts` (`signSession`, `verifySession`, `parseSessionPayload`)
- Modificar: `web/lib/auth-server.ts` (`SessionUser`, `getUserFromRequest`)
- Crear: `web/lib/empresas.ts`
- Crear: `web/scripts/empresas-api-check.ts` (sección A) y añadirlo a `test` en `web/package.json`

**Interfaces:**
- Consume: tarea 1.
- Produce:
  ```ts
  // session.ts
  export function signSession(uid: string, pv: string, emp?: string | null): string      // emp solo si es uuid
  export function verifySession(token): { uid: string; pv: string; emp: string | null } | null
  // auth-server.ts
  export interface SessionUser {
    id: string; email: string; full_name: string; active: boolean
    role: Role                   // papelMasAlto(papeles) — caché para el código que aún lo lee
    empresa: Empresa | null      // la activa
    empresas: Empresa[]          // donde tiene papel activo, por codigo
    papeles: PapelActivo[]       // solo los de la empresa activa
  }
  // empresas.ts
  export interface PapelesDeUsuario { empresas: Empresa[]; papeles: PapelActivo[]; empresaActivaId: string | null }
  export async function cargarPapelesDeUsuario(userId: string, db?: SupabaseAdminClient): Promise<PapelesDeUsuario | 'sin_tabla'>
  export async function listarEmpresas(db?): Promise<Empresa[]>                                   // activas, por codigo
  export async function cambiarEmpresaActiva(userId: string, empresaId: string, db?): Promise<Empresa | 'sin_papel'>
  export function sesionDesdePapeles(base: { id; email; full_name; active; role: Role }, cargado: PapelesDeUsuario | 'sin_tabla', claimEmp: string | null): SessionUser
  ```
  `cargarPapelesDeUsuario` lee `papeles` (activo) con `papel_zonas` y `empresas` (activa) y `users.empresa_activa_id`;
  si PostgREST dice que la tabla no existe (código `42P01` o `PGRST205`) devuelve `'sin_tabla'`.
  `sesionDesdePapeles` con `'sin_tabla'`: `papeles = [{ id: 'rol', empresa_id: '', papel: base.role, line_id: null, kam_ids: [] }]`,
  `empresa = null`, `empresas = []`, `role = base.role`. Con datos: `empresa = empresaActivaDe(...)`, `papeles` los de
  esa empresa, `role = papelMasAlto(papeles)`.

- [ ] **Paso 1: pruebas que fallan** en `scripts/empresas-api-check.ts`, sección "A. Sesión", con el Supabase falso
      de `lineas-permitidas-api-check.ts` (copiar el patrón; tablas `users`, `empresas`, `papeles`, `papel_zonas`):
  - `verifySession(signSession(uid, pv, vg)).emp` = vg; sin `emp` → `emp` null; `signSession(uid, pv, 'no-uuid')` no
    escribe `emp`; un token firmado antes de esta tarea (payload `{uid,pv,iat,exp}`) sigue válido.
  - `getUserFromRequest` de Paola (papeles VG: `line_leader` Trauma y `sales_manager`): `role` `line_leader`,
    `empresa.codigo` `vg`, `papeles.length` 2, `empresas.length` 1.
  - Lizeth (`line_leader` en Medix, `sales_manager` en VG, `empresa_activa_id` medix, cookie con `emp` vg): `empresa`
    medix (manda la columna), `papeles` = solo el de Medix, `role` `line_leader`.
  - Foco 1: cookie con `emp` medix y papel de Medix inactivo → `empresa` vg, 200 (no null).
  - Foco 2: usuario activo sin papeles → `role` `user`, `empresa` null, `empresas` `[]`, `papeles` `[]`.
  - Foco 3: sin la tabla `papeles` (el falso responde `42P01`) → `role` = `users.role`, `empresa` null, sin
    `console.error` de 500.
  - `cambiarEmpresaActiva(lizeth, vg)` escribe `users.empresa_activa_id` y devuelve la empresa; a una sin papel →
    `'sin_papel'` y no escribe.
- [ ] **Paso 2: correr y ver que fallan.** `npx tsx scripts/empresas-api-check.ts`.
- [ ] **Paso 3: implementar** `session.ts`, `empresas.ts` y `auth-server.ts` con las firmas de arriba.
      `getUserFromRequest`: tras validar `pv`, `cargarPapelesDeUsuario` y `sesionDesdePapeles(data, cargado, session.emp)`.
- [ ] **Paso 4: correr y ver que pasan**; luego `npm run check` (las suites que firman cookies con `signSession(uid, pv)`
      deben seguir en verde sin tocarlas).
- [ ] **Paso 5: commit.**
  ```bash
  git add web/lib/session.ts web/lib/auth-server.ts web/lib/empresas.ts web/scripts/empresas-api-check.ts web/package.json
  git commit -m "feat(empresas): la sesión lleva empresa activa y papeles; compatible sin la 0960"
  ```

---

### Tarea 4: permisos como suma de papeles (servidor y cliente)

**Archivos:**
- Modificar: `web/lib/permissions.ts` (añadir `menuDePapeles`, `rutasDePapeles`)
- Modificar: `web/lib/require-role.ts` (`requirePermission`, `requireAnyPermission` usan `tienePermiso(user.papeles, …)`)
- Modificar: `web/contexts/UserContext.tsx` (`User` gana `empresa`, `empresas`, `papeles`)
- Modificar: `web/hooks/usePermissions.ts` (`can/canAny/canAll` con `tienePermiso(papeles)`, `navigationMenu` con
  `menuDePapeles`, `allowedRoutes` con `rutasDePapeles`; sigue devolviendo `role`)
- Modificar: `web/scripts/menu-check.ts` (sección nueva) y `web/scripts/empresas-api-check.ts` (sección B)

**Interfaces:**
- Produce:
  ```ts
  export function menuDePapeles(papeles: readonly { papel: Role }[]): NavigationItem[]   // unión de getNavigationMenu por papel, sin repetir href, en el orden del papel más alto primero
  export function rutasDePapeles(papeles: readonly { papel: Role }[]): string[]          // unión de getAllowedRoutes; ['/login'] si está vacía
  ```

- [ ] **Paso 1: pruebas que fallan.** En `menu-check.ts`: `menuDePapeles([{line_leader},{sales_manager}])` contiene
      "Agendamiento" (de la líder) y todo lo del ejecutivo, sin href repetido; `menuDePapeles([])` = `[]`;
      `rutasDePapeles([])` = `['/login']`; `rutasDePapeles([{papel:'hr'}])` incluye `/inicio`. En `empresas-api-check.ts`
      sección B: `requirePermission` (con una ruta mínima o llamándolo directo con una `NextRequest` con cookie) para
      Paola concede `campo:app` y `visits:report` y niega `executives:lines`; `requireAnyPermission(['intelligence:view','secop:procesos'])`
      con `[{sales_manager}]` concede.
- [ ] **Paso 2: correr y ver que fallan.**
- [ ] **Paso 3: implementar.** `require-role.ts`: `tienePermiso(auth.user.papeles, permission)`. `usePermissions`:
      `const papeles = user?.papeles ?? []`. `UserContext.checkSession` guarda `empresa`, `empresas`, `papeles` de
      `/api/auth/me` (tarea 5 los manda; hasta entonces llegan `undefined` → `[]`).
- [ ] **Paso 4: correr y ver que pasan**; `npm run check`.
- [ ] **Paso 5: commit.**
  ```bash
  git add web/lib/permissions.ts web/lib/require-role.ts web/contexts/UserContext.tsx web/hooks/usePermissions.ts web/scripts/menu-check.ts web/scripts/empresas-api-check.ts
  git commit -m "feat(permisos): lo que puede hacer una persona es la suma de sus papeles"
  ```

---

### Tarea 5: rutas de sesión: `me`, login, cambiar de empresa, listar empresas

**Archivos:**
- Modificar: `web/app/api/auth/me/route.ts`, `web/app/api/auth/login/route.ts`, `web/app/api/auth/sesion-app/route.ts`
- Crear: `web/app/api/auth/empresa/route.ts` (POST), `web/app/api/empresas/route.ts` (GET)
- Modificar: `web/lib/reporte-visitas.ts` (`MeResponse.user`, `UsuarioMovil`, `LoginMovilResponse`)
- Modificar: `web/scripts/empresas-api-check.ts` (sección C)

**Interfaces:**
- Produce:
  ```ts
  export interface EmpresaMovil { id: string; codigo: string; nombre_corto: string }
  // MeResponse.user y UsuarioMovil ganan: empresa: EmpresaMovil | null; empresas: EmpresaMovil[]; papeles: PapelActivo[]
  // POST /api/auth/empresa  body { empresa_id: string }
  //   cookie → 200 { empresa: EmpresaMovil } y cookie refirmada con emp
  //   portador (app) → 200 { empresa, token, expira_at }
  //   400 cuerpo inválido · 403 'No tienes papel en esa empresa' · 401 sin sesión
  // GET /api/empresas → 200 { empresas: EmpresaMovil[] } (activas; requireUser)
  ```
  Login (web y móvil) y `sesion-app` firman con `emp` = la empresa activa resuelta (`sesionDesdePapeles`). `me` arma
  `user.empresa/empresas/papeles` desde `SessionUser`; `sin_persona` y `persona` siguen igual (capa 3 los cambia).

- [ ] **Paso 1: pruebas que fallan** (sección C, contra los handlers reales): `GET /api/auth/me` de Lizeth trae
      `user.empresas` con 2 y `user.empresa.codigo` = la columna; `POST /api/auth/empresa` con cookie y `{empresa_id: vg}`
      → 200, `Set-Cookie` presente y `verifySession(cookie).emp` = vg, `users.empresa_activa_id` = vg; con portador →
      cuerpo con `token` cuyo `emp` es vg; a Medix siendo solo de VG → 403 y columna intacta; `{}` → 400;
      `GET /api/empresas` sin sesión → 401, con sesión → las dos por `codigo`. Foco 2: `me` de un usuario sin papeles →
      200, `user.role` `user`, `user.empresas` `[]`.
- [ ] **Paso 2: correr y ver que fallan.**
- [ ] **Paso 3: implementar** las dos rutas nuevas y los cambios en `me`, `login`, `sesion-app` y los tipos.
- [ ] **Paso 4: correr y ver que pasan**; `npm run check`.
- [ ] **Paso 5: commit.**
  ```bash
  git add web/app/api/auth web/app/api/empresas web/lib/reporte-visitas.ts web/scripts/empresas-api-check.ts
  git commit -m "feat(auth): empresa activa en me y login, POST /api/auth/empresa y GET /api/empresas"
  ```

---

### Tarea 6: la empresa activa en el menú de OpMap

**Archivos:**
- Modificar: `web/components/NavigationWithPermissions.tsx` (bloque del usuario: líneas 210-218 hoy)
- Crear: `web/components/SelectorEmpresa.tsx`

**Interfaces:**
- Consume: `useUser().user.empresa/empresas`, `POST /api/auth/empresa`.
- Produce: `SelectorEmpresa({ empresa, empresas, onCambio })`: con una sola empresa pinta solo
  `empresa.nombre_corto`; con varias, un `<select aria-label="Empresa activa">`; al cambiar llama a la ruta y hace
  `window.location.assign('/inicio')` (recarga todo con la sesión nueva).

- [ ] **Paso 1: implementar.** En el bloque del usuario: debajo del nombre, `nombre_corto` de la empresa (o nada si
      `empresa` es null) y `tituloDePapeles(papeles)` en lugar de `getRoleTitle(role)`.
- [ ] **Paso 2: verificar en el preview** (`npm run dev`): capturas en claro y oscuro, celular y escritorio, de una
      persona con una empresa (solo el nombre corto) y de una con dos (el selector), antes y después de cambiar.
- [ ] **Paso 3: `npm run check` y commit.**
  ```bash
  git add web/components/NavigationWithPermissions.tsx web/components/SelectorEmpresa.tsx
  git commit -m "feat(menu): la empresa activa al lado del nombre y selector cuando hay varias"
  ```

---

### Tarea 7: papeles por empresa en la API de usuarios

**Archivos:**
- Modificar: `web/lib/empresas.ts` (`reemplazarPapeles`, `afectadosDeQuitarEjecutivo`, `escribirCacheDeUsuario`, `escribirCacheDeLinea`)
- Modificar: `web/lib/user-schemas.ts` (`papelEntradaSchema`, `papelesPutSchema`; `createUserSchema.role` pasa a opcional y gana `papeles` opcional)
- Modificar: `web/app/api/users/route.ts` (GET con `papeles`; POST crea papeles), `web/app/api/users/[id]/route.ts`
  (PUT con `role` escribe el papel en VG a través de `reemplazarPapeles`, para la página vieja hasta la tarea 8)
- Crear: `web/app/api/users/[id]/papeles/route.ts` (PUT)
- Modificar: `web/app/api/executives/route.ts` (POST: la persona o vacante nueva recibe `executive_empresas` con
  `empresa_id` del cuerpo o, si no viene, la empresa activa de la sesión; 400 si no es una de sus empresas) y
  `web/app/executives/ExecutiveModal.tsx` (selector "Empresa" solo cuando `user.empresas.length > 1`, por defecto la
  activa; el campo de texto `company` desaparece del formulario)
- Modificar: `web/scripts/empresas-api-check.ts` (sección D)

**Interfaces:**
- Produce:
  ```ts
  export async function reemplazarPapeles(entrada: { userId: string; empresaId: string; papeles: PapelEntrada[]; creadoPor: string; simular?: boolean }, db?):
    Promise<{ ok: true; papeles: PapelActivo[]; afectados: { asignaciones: number; visitantes: number } } | { ok: false; status: 400 | 404 | 409; error: string }>
  export async function escribirCacheDeUsuario(userId: string, db?): Promise<void>   // users.role = cacheRolDe(papeles activos en VG)
  export async function escribirCacheDeLinea(lineId: string, db?): Promise<void>     // business_lines.leader_user_id = cacheLiderDe(líderes activos en VG)
  // PUT /api/users/[id]/papeles  body { empresa_id, papeles: PapelEntrada[] }  query ?simular=1 → solo afectados, nada escrito
  //   200 { papeles, afectados } · 400 línea fuera de la empresa / cuerpo · 404 usuario o empresa · 409 líder repetido o Zonas solapadas
  // GET /api/users → cada usuario gana papeles: PapelActivo[] (todas sus empresas)
  // POST /api/users body { email, password, full_name, role?: Role, papeles?: { empresa_id, papel, line_id?, kam_ids? }[] }  (role sin papeles = ese papel en VG)
  ```
  `reemplazarPapeles`: calcula el delta contra los activos de esa empresa; valida línea en empresa
  (`MENSAJE_LINEA_FUERA_DE_EMPRESA`, 400) y líderes (`validarLiderDeLinea`, 409); si se quita `sales_manager`:
  `executive_empresas` de la persona (vía `executives.user_id`) en esa empresa pasa a `activo = false`, se borran sus
  `asignaciones` de esa empresa y, si la empresa es VG, también sus filas de `executive_lines` (el disparador de la
  0820 cierra los visitantes: ese es el conteo `visitantes`); si se da `sales_manager` y hay fila de `executives`,
  crea o reactiva `executive_empresas`. Escribe las dos cachés al final. Con `simular` solo devuelve `afectados`.

- [ ] **Paso 1: pruebas que fallan** (sección D; tablas `executives`, `executive_lines`, `executive_empresas`,
      `asignaciones`, `medico_visitantes`, `linea_empresas`, `business_lines` en el falso):
  - admin da a Paola `[line_leader Trauma, sales_manager]` en VG → 200, 2 papeles, `users.role` de Paola =
    `line_leader`, `business_lines.leader_user_id` de Trauma = Paola.
  - segundo líder nacional de Trauma en VG → 409 `MENSAJE_LIDER_NACIONAL_UNICO`; con `kam_ids` disjuntas de uno que
    también las tiene → 200 y `leader_user_id` de Trauma = null.
  - líder de una línea que no está en Medix → 400 `MENSAJE_LINEA_FUERA_DE_EMPRESA`.
  - quitar `sales_manager` en VG a una persona con 3 asignaciones y 2 visitantes vivos → `?simular=1` devuelve
    `{asignaciones:3, visitantes:2}` sin escribir; sin simular borra las 3 asignaciones y las `executive_lines`, y
    `executive_empresas` queda `activo=false`.
  - Foco 4: quitar `sales_manager` a un usuario sin fila en `executives` → 200 `{asignaciones:0, visitantes:0}`.
  - `GET /api/users` trae `papeles` por usuario; `POST /api/users` con `role: 'viewer'` crea el papel en VG; sin
    `users:manage` → 403 en las tres rutas.
  - `POST /api/executives` (vacante) sin `empresa_id` → `executive_empresas` con la empresa activa; con `empresa_id`
    medix siendo la sesión solo de VG → 400 y nada escrito (en `lineas-permitidas-api-check.ts` o sección D).
- [ ] **Paso 2: correr y ver que fallan.**
- [ ] **Paso 3: implementar.**
- [ ] **Paso 4: correr y ver que pasan**; `npm run check`.
- [ ] **Paso 5: commit.**
  ```bash
  git add web/lib/empresas.ts web/lib/user-schemas.ts web/app/api/users web/app/api/executives/route.ts web/app/executives/ExecutiveModal.tsx web/scripts
  git commit -m "feat(usuarios): papeles por empresa con cachés de rol y líder; quitar ejecutivo borra asignaciones"
  ```

---

### Tarea 8: `/users` edita papeles por empresa

**Archivos:**
- Modificar: `web/app/users/page.tsx`
- Crear: `web/app/users/PapelesEditor.tsx`

**Interfaces:**
- Consume: `GET /api/users` (con `papeles`), `GET /api/empresas`, `GET /api/business-lines`, `GET /api/kams`,
  `PUT /api/users/[id]/papeles` (con `?simular=1` antes de quitar `sales_manager`).
- Produce: `PapelesEditor({ usuario, empresas, lineas, zonas, onGuardado })`: un bloque por empresa con casillas de
  papel; `line_leader` abre la línea (solo las de esa empresa) y Zonas opcionales; al quitar Ejecutivo Comercial
  muestra el `afectados` de la simulación y pide confirmar ("Se borran N asignaciones y terminan M visitantes").
  El selector de rol único de hoy desaparece; "Nuevo usuario" pide papeles con el mismo editor. Nunca "Vacante".

- [ ] **Paso 1: implementar** sobre la página actual (sigue en claro, `data-tema="claro"`; no se rehace su diseño).
- [ ] **Paso 2: verificar en el preview**: capturas de Paola con sus dos papeles en VG, de Lizeth con un papel en cada
      empresa, del aviso al quitar Ejecutivo Comercial, y del error 409 al poner dos líderes nacionales.
- [ ] **Paso 3: `npm run check` y commit.**
  ```bash
  git add web/app/users
  git commit -m "feat(usuarios): editor de papeles por empresa en /users"
  ```

---

### Tarea 9: líneas por empresa

**Archivos:**
- Modificar: `web/app/api/business-lines/_lib/line-shared.ts` (`loadBusinessLines` trae `empresas`),
  `web/app/api/business-lines/[id]/route.ts` (PATCH `empresa_ids`), `web/lib/types/lines.ts` (`BusinessLine.empresas`)
- Modificar: `web/app/lines/page.tsx` (casillas de empresa en el modal de editar; columna "Empresas")
- Modificar: `web/scripts/lineas-api-check.ts` (o sección E de `empresas-api-check.ts`)

**Interfaces:**
- Produce: `BusinessLine.empresas: EmpresaMovil[]`; `PATCH /api/business-lines/[id]` acepta `empresa_ids: string[]`
  (reemplaza `linea_empresas` de esa línea); 409 `'Esa línea tiene líder o asignaciones en <nombre_corto>'` si se quita
  una empresa con papeles `line_leader` activos o asignaciones en ella; 400 si queda vacía.

- [ ] **Paso 1: pruebas que fallan**: PATCH `empresa_ids: [vg, medix]` → 200 y `GET` trae las dos; Foco 5: quitar VG a
      Trauma con Paola líder → 409 y `linea_empresas` intacta; `[]` → 400; sin `lines:edit` → 403.
- [ ] **Paso 2: correr y ver que fallan.**
- [ ] **Paso 3: implementar.**
- [ ] **Paso 4: correr y ver que pasan**; `npm run check`; captura del modal de Líneas con las casillas.
- [ ] **Paso 5: commit.**
  ```bash
  git add web/app/api/business-lines web/lib/types/lines.ts web/app/lines/page.tsx web/scripts
  git commit -m "feat(lineas): en qué empresas está cada línea"
  ```

---

### Tarea 10: la app de campo muestra y cambia la empresa activa

**Archivos:**
- Modificar: `mobile/lib/tipos.ts` (`EmpresaMovil`; `UsuarioMovil` y `MeResponse.user` ganan `empresa`, `empresas`, `papeles`)
- Modificar: `mobile/lib/claves-api.ts` (`usuario` exactas: `['id','full_name','role','empresa','empresas','papeles']`)
- Modificar: `mobile/lib/api.ts` (`cambiarEmpresa(empresaId): Promise<{ empresa; token; expira_at }>`)
- Modificar: `mobile/lib/sesion.ts` (`Perfil.usuario` guarda `empresa` y `empresas`; `cambiarEmpresa` en `ValorSesion`:
  llama a la API, guarda el token nuevo y el perfil, y vuelve a pedir `me`)
- Crear: `mobile/lib/empresa-activa.ts` (puro)
- Modificar: `mobile/app/(app)/ajustes.tsx` (sección "Empresa" encima de "Cerrar sesión"), `mobile/components/EstadoCola.tsx`
  (nombre corto de la empresa al lado del botón "OpMap"; solo si hay empresa)
- Crear: `mobile/scripts/checks/26-empresa-activa.ts` y registrarlo en `mobile/scripts/movil-check.ts`

**Interfaces:**
- Produce:
  ```ts
  export const MENSAJE_EMPRESA_SIN_SENAL = 'Sin señal no se puede cambiar de empresa'
  export function selectorDeEmpresa(entrada: { empresa: EmpresaMovil | null; empresas: EmpresaMovil[]; enLinea: boolean }):
    { modo: 'oculto' } | { modo: 'solo_nombre'; nombre: string } | { modo: 'selector'; opciones: EmpresaMovil[]; deshabilitado: boolean; aviso: string | null }
  ```
  `oculto` sin empresa; `solo_nombre` con una; `selector` con varias, `deshabilitado` y `aviso` sin señal.

- [ ] **Paso 1: pruebas que fallan** en `26-empresa-activa.ts` (patrón de `25-inicio-opmap.ts`): los cuatro casos de
      `selectorDeEmpresa`; y leyendo `ajustes.tsx` y `EstadoCola.tsx`, que usan `selectorDeEmpresa` y
      `MENSAJE_EMPRESA_SIN_SENAL`.
- [ ] **Paso 2: correr y ver que fallan.** `cd mobile && npx tsx scripts/checks/correr.ts 26-empresa-activa`.
- [ ] **Paso 3: implementar.** Al cambiar: `api.cambiarEmpresa`, guardar token y perfil, `me` de nuevo (el contexto y
      la cola NO se tocan; cada visita encolada guarda ya su empresa en la capa 3, no aquí).
- [ ] **Paso 4: correr y ver que pasan**; `npm run check` en `mobile/` y en `web/` (los tipos deben coincidir).
- [ ] **Paso 5: verificar en el navegador** (`npx expo start --web --port 8081`): capturas de Ajustes con una y con
      dos empresas, y de la franja con el nombre corto.
- [ ] **Paso 6: commit.**
  ```bash
  git add mobile
  git commit -m "feat(campo): empresa activa en Ajustes y en la franja de estado"
  ```

---

### Tarea 11: documentación y cierre de la capa

**Archivos:**
- Modificar: `CLAUDE.md` (una viñeta nueva en "Reglas que no se deducen del código": empresas, papeles por empresa,
  empresa activa por persona, cachés `users.role` y `leader_user_id` hasta la capa 4, 0960 ESCRITA y no aplicada)
- Modificar: `docs/specs/2026-10-31-empresas-papeles-y-asignaciones.md` (estado: capa 1 implementada, PR pendiente)
- Modificar: `web/docs/ROLES_AND_PERMISSIONS.md` (papeles por empresa, suma de permisos)

- [ ] **Paso 1: escribir** las tres cosas.
- [ ] **Paso 2: verificación final.** `cd web && npm run check` y `cd mobile && npm run check`: salida completa en
      verde. Reunir las capturas de las tareas 6, 8, 9 y 10.
- [ ] **Paso 3: revisor del repo.** Subagente `revisor` (`.claude/agents/revisor.md`) sobre el diff de la rama y la
      spec; corregir solo lo que afecte corrección o reglas.
- [ ] **Paso 4: commit y entrega.**
  ```bash
  git add CLAUDE.md docs/specs/2026-10-31-empresas-papeles-y-asignaciones.md web/docs/ROLES_AND_PERMISSIONS.md
  git commit -m "docs(empresas): reglas de la capa 1 en CLAUDE.md, spec y permisos"
  ```
  Luego `/entregar` (PR a `master` con la plantilla; la 0960 se aplica en la ventana del despliegue, con autorización
  del dueño, y DESPUÉS él registra en `/users` el segundo papel de Paola).
