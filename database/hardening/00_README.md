# Endurecimiento de Supabase — semana 1 (OpMap)

> **ESTADO: NADA DE ESTO SE HA EJECUTADO.** Los scripts se generaron el 2026-10-10 a partir del
> estado vivo del proyecto `norvxqgohddgsdkggqzq`, consultado solo con `SELECT`. No se ha lanzado
> ningún DDL/DML contra la base. Ejecutarlos es una decisión del dueño, después del despliegue
> indicado abajo.

## Qué cierra cada script

| Archivo | Qué hace | Hallazgos |
|---|---|---|
| `01_views_security_invoker.sql` | `security_invoker = true` en las 15 vistas que no lo tenían (y reafirma las 3 que sí) | C-04 |
| `02_rls_enable.sql` | RLS en `visits` y `visit_imports`; elimina `"Allow all operations"` (hospital_history), `users_all` (users) y las 10 políticas de lectura pública de tablas internas | C-03, C-05, A-01 (users_all), SEC-DB-09, R2-M-04 |
| `03_revoke_grants.sql` | Quita a `anon`/`authenticated` toda escritura en `public`, todo acceso a 17 tablas internas y a las 18 vistas, los privilegios por defecto de `postgres` en `public`, y elimina `get_contract_pdf_url` (rota) | C-03, C-04, C-05, A-01, SEC-DB-09, B-12 |
| `04_storage_geojson.sql` | Elimina `"Public Upload"` y `"Public Update"` del bucket `geojson`; conserva `"Public Access"` (lectura) | C-06 |
| `05_functions_search_path.sql` | `search_path = public, pg_temp` en las 11 funciones propias restantes y EXECUTE solo para `service_role` | B-12 |
| `06_verify.sql` | Solo `SELECT`: foto final con el resultado esperado comentado, más pruebas `curl` con la anon key | — |
| `99_rollback.sql` | Deshace exactamente lo que cambian 01–05, por secciones | — |

Estado final para la anon key (la que viaja en el navegador): **solo `SELECT`** en `departments`,
`municipalities`, `department_adjacency`, `hospitals` y `kams`; nada más en `public`; lectura
pública del bucket `geojson`. `kams` no tiene columnas sensibles (sin email ni teléfono; `lat/lng`
es la ubicación base que el mapa ya dibuja), así que no se crea `kams_public`.

El servidor no se ve afectado mientras use `service_role` (bypass de RLS y con todos los
privilegios). Por eso no se crea ninguna política nueva.

## Prerrequisitos (en este orden)

1. **Respaldo del Paso 0 a salvo.** Está en
   `/private/tmp/claude-501/-Users-yjxm-Documents-GitHub-OpMap/b96592bc-25ae-4af0-afb9-263556da1e56/scratchpad/backup-2026-10-10/`
   (`MANIFEST.md`, datos de 21 tablas, `rollback_policies.sql`, `rollback_views.sql`,
   `rollback_grants.sql`, `rollback_rls.sql`, `functions.sql`, copia del bucket `geojson` con
   SHA-256). Es un directorio temporal y contiene datos sensibles: **copiarlo cifrado fuera de
   `/tmp` y fuera del repo antes de nada.** Anotar además en el dashboard de Supabase la fecha del
   último backup diario.
2. **Desplegar a producción el código de la rama `audit/hardening-semana1`.** En esa rama:
   - `/api/visits/import` (POST y DELETE) y la RPC `find_nearest_hospital` usan el cliente
     `service_role` (`lib/supabase-admin.ts`) y `visits/import/[batch]` está eliminado (R2-M-04).
   - Las páginas `/kams` y `/territories` (y `/territories/[id]`) ya no leen con la anon key.
   - Ninguna ruta de servidor usa `NEXT_PUBLIC_SUPABASE_ANON_KEY` ni `createRouteHandlerClient`
     para tablas que no sean las 5 públicas.
3. **`SUPABASE_SERVICE_ROLE_KEY` definida en Vercel** (Production y Preview). El cliente admin
   lanza error si falta; ya no hay fallback a la anon key.
4. **Comprobación previa en el código desplegado** (desde `web/`). Las dos órdenes deben salir
   vacías, salvo las excepciones indicadas:

   ```bash
   # a) Componentes de navegador que leen/escriben tablas o vistas que se cierran. Debe salir vacío
   #    (o solo componentes muertos que nadie importa, p. ej. HospitalActions*.tsx, a borrar).
   grep -rlE "^['\"]use client['\"]" app components contexts hooks 2>/dev/null \
     | xargs grep -nE "\.from\('(zones|forced_assignments|assignments|hospital_contracts|hospital_history|hospital_kam_distances|hospital_comments|visits|visit_imports|users|opportunities|mi_empresa_config|proveedores|proveedor_[a-z]+|[a-z_]*(statistics|stats|summary|view|assignments|zones|contratos|proveedores|indicadores|hospitales|activity|compliance|extended))'\)"

   # b) Código de servidor con la anon key. Solo se admiten lib/supabase.ts (cliente del navegador)
   #    y rutas que lean exclusivamente departments/municipalities/department_adjacency/hospitals/kams.
   grep -rlE "NEXT_PUBLIC_SUPABASE_ANON_KEY|createRouteHandlerClient" app/api lib | sort
   ```

   Foto del árbol de trabajo al generar estos scripts (2026-10-10, otras particiones aún en curso):
   la orden (b) listaba 28 archivos, entre ellos `zones/*`, `visits/import`, `visits/unvisited-zones`,
   `providers/[id]/finanzas|contracts`, `kams/zone` (solo anon) y otros con fallback
   `SERVICE_ROLE || ANON`. Si siguen ahí al desplegar, **no ejecutar 02/03 todavía**.

## Qué se rompe si se ejecuta antes del despliegue

Con el código de `master` (o con la rama a medias), lo que hoy funciona con la anon key dejaría de
hacerlo:

| Script | Qué falla | Dónde |
|---|---|---|
| 02 | Importación mensual de visitas: el INSERT en `visit_imports` devuelve 42501 y la importación entera falla; el borrado por rango afecta 0 filas y responde `success:true` (R2-M-04) | `/api/visits/import` con `createRouteHandlerClient` |
| 02/03 | Lectura de zonas (lista, selector de zona del KAM, estadísticas y territorios por zona) | `app/zones/page.tsx`, `ZoneModal`, `app/kams/page.tsx`, `/api/zones/*` con anon |
| 02/03 | Asignaciones forzadas en el detalle de territorio y en el modal | `app/territories/[id]/page.tsx`, `ForcedAssignmentModal` |
| 03 | `/territories`: `territory_statistics` y `assignments` pasan de devolver 0 filas (RLS) a error de permiso | `app/territories/page.tsx` |
| 02/03 | Visitas: mapa de zonas sin visitar | `/api/visits/unvisited-zones` (anon) |
| 02/03 | Finanzas y contratos de un proveedor | `/api/providers/[id]/finanzas`, `/api/providers/[id]/contracts` (anon) |
| 03 | Cualquier ruta con `SUPABASE_SERVICE_ROLE_KEY \|\| ANON` si falta la variable en Vercel | contratos, KAMs, hospitales, visitas, mapa |
| 05 | `find_nearest_hospital` llamada con la anon key | `/api/visits/import` |
| 02 | Inserción de historial desde el navegador | `HospitalActions.tsx`, `HospitalActionsDB.tsx`, `HospitalActionsComplete.tsx` (nadie los importa: código muerto) |

Lo que **no** cambia: el mapa principal (lee `kams`, `hospitals`, `municipalities` y `departments`,
que siguen públicos, y el resto por `/api/map/data` con service_role), la descarga de GeoJSON
(`/storage/v1/object/public/geojson/...`) y cualquier ruta con service_role. Los contratos desde el
navegador (`ContractsList*`, `ContractsInlineManager`) ya no funcionaban con la anon key: el RLS de
`hospital_contracts` solo admite `authenticated`.

## Cómo ejecutar

1. Supabase Dashboard → SQL Editor (rol `postgres`), o `psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f <archivo>`.
2. En una ventana corta y en este orden: `01` → `02` → `03` → `04` → `05`.
   - Cada archivo es una transacción (`BEGIN … COMMIT`) con comprobaciones al final: si algo no
     queda como se espera, lanza `RAISE EXCEPTION` y **no se aplica nada de ese archivo**.
   - Todos son idempotentes: se pueden relanzar.
   - `03` emite 3 `WARNING: no privileges could be revoked` (spatial_ref_sys, geometry_columns,
     geography_columns). Es esperado: son de PostGIS (dueño `supabase_admin`).
   - Si `04` falla con "must be owner of table objects", borrar las dos políticas desde
     Dashboard → Storage → Policies → bucket `geojson`.
3. Ejecutar `06_verify.sql` y comparar con los resultados esperados comentados; lanzar las
   pruebas `curl` del final (V8).
4. Prueba de humo en producción con un usuario admin y otro viewer: mapa, `/kams`, `/territories`,
   `/zones`, importar un Excel pequeño de visitas, contratos, Mi Empresa, proveedores, comentarios
   de hospital.
5. Repasar los advisors de Supabase. Esperado: `security_definer_view` 0 (antes 15),
   `rls_disabled_in_public` 1 (`spatial_ref_sys`, antes 3), `function_search_path_mutable` 0
   (antes 12), el aviso de `get_contract_pdf_url` desaparece.

## Cómo volver atrás

- **Rápido y quirúrgico:** `99_rollback.sql`, por secciones y en orden inverso (05 → 01). Solo
  deshace lo que 01–05 cambian y devuelve el estado inseguro del 2026-10-10.
- **Completo:** los `rollback_*.sql` del respaldo del Paso 0 (`rollback_policies.sql` recrea las
  54 políticas con `DROP … IF EXISTS` + `CREATE`; `rollback_views.sql` las 18 vistas;
  `rollback_rls.sql` el estado de RLS de 24 tablas; `rollback_grants.sql` los 86 grants y los
  default privileges — saltar las líneas `FOR ROLE supabase_admin`, que `postgres` no puede ejecutar;
  `functions.sql` las 12 funciones).
- Preferible a ambos: arreglar la ruta que falle para que use `service_role`. Revertir reabre
  C-03/C-04/C-05/C-06.
- No restaurar el backup diario de Supabase por esto: revierte todo el proyecto (datos incluidos).

## Lo que queda abierto (no lo resuelven estos scripts)

- `spatial_ref_sys`, `geometry_columns`, `geography_columns` (PostGIS en `public`, dueño
  `supabase_admin`): siguen sin RLS y con privilegios de escritura para anon. `postgres` no puede
  cambiarlos; la vía es mover PostGIS al esquema `extensions` (advisor `extension_in_public`) o
  pedirlo a soporte. Riesgo bajo (catálogo de proyecciones), pero conviene cerrarlo.
- Privilegios por defecto de `supabase_admin` en `public` (siguen concediendo ALL a anon): solo
  afectan a objetos que cree `supabase_admin`.
- Las funciones nuevas siguen naciendo con EXECUTE para `PUBLIC` (valor por defecto global): ver la
  línea comentada en `03`.
- Políticas para `authenticated` con `true` (`assignments_write`, `hospitals_write`, `kams_write`,
  `history_all_authenticated`, `distances_all_authenticated`, `forced_assignments_all_authenticated`,
  `opportunities_all`, las de `hospital_contracts`…): quedan inertes porque `authenticated` ya no
  tiene privilegios, pero se pueden borrar en una limpieza posterior (advisor
  `multiple_permissive_policies`).
- `hospital_activity` sigue exponiendo `user_email`/`user_id`/`user_role` a quien la lea (ahora solo
  `service_role`); reconstruirla sin esos campos (C-04).
- `hospitals.documents_url` (1 fila con valor) y `address/phone` siguen públicos; valorar una vista
  `hospitals_public` si el enlace de documentos es interno.
- Signup de Supabase Auth abierto (`disable_signup=false`): se cierra en el dashboard, no por SQL (A-01).
