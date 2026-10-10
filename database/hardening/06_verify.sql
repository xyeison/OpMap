-- =====================================================================================
-- OpMap · Endurecimiento Supabase · 06 — Verificación posterior (solo SELECT)
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-10
--
-- Ejecutar DESPUÉS de 01–05. No modifica nada. Cada consulta indica el resultado esperado.
-- Los scripts 01–05 ya abortan su transacción si algo no queda bien; esto es la foto final
-- para adjuntar al cambio y para repetir más adelante (regresiones).
-- En el SQL Editor de Supabase solo se ve el resultado de la última consulta: ejecutar los
-- bloques V1…V7 de uno en uno (o el archivo completo con psql).
-- Transacción de solo lectura: cualquier escritura accidental fallaría.
-- =====================================================================================

BEGIN TRANSACTION READ ONLY;

-- V1. Vistas de public y security_invoker  (C-04)
-- Esperado: 20 filas. Las 18 de dueño postgres con security_invoker = true.
--           geography_columns y geometry_columns (supabase_admin, PostGIS) con NULL: correcto.
SELECT c.relname AS vista,
       pg_get_userbyid(c.relowner) AS dueno,
       c.reloptions
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public' AND c.relkind IN ('v', 'm')
 ORDER BY (c.reloptions IS NULL) DESC, c.relname;

-- V1b. Conteo directo. Esperado: 0
SELECT count(*) AS vistas_propias_sin_security_invoker
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public' AND c.relkind = 'v'
   AND pg_get_userbyid(c.relowner) = 'postgres'
   AND NOT coalesce(c.reloptions @> ARRAY['security_invoker=true'], false);

-- V2. Tablas sin RLS en public  (C-03, SEC-DB-09)
-- Esperado: 1 fila, spatial_ref_sys (PostGIS, dueño supabase_admin; no se puede cambiar como
--           postgres). visits y visit_imports NO deben aparecer.
SELECT c.relname AS tabla_sin_rls, pg_get_userbyid(c.relowner) AS dueno
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND NOT c.relrowsecurity
 ORDER BY 1;

-- V3. Políticas que aplican a anon (roles public o anon)  (C-03, C-05, A-01)
-- Esperado (27 filas):
--   departments / municipalities / department_adjacency: "Allow public read access" y
--     *_read_all  (SELECT, true)                                              ->  6 filas
--   hospitals.hospitals_read, kams.kams_read  (SELECT, true)                 ->  2 filas
--   hospital_comments: DELETE con auth.uid() e INSERT con auth.uid() IS NOT NULL
--     (anon no cumple ninguna)                                                ->  2 filas
--   mi_empresa_config.mi_empresa_write_authenticated (auth.role() in authenticated/service_role) -> 1
--   proveedores, proveedor_contactos, proveedor_enlaces, proveedor_finanzas,
--     proveedor_indicadores: *_insert/_update/_delete con auth.role() (anon no cumple) -> 15 filas
--   zones.zones_modify_admin (auth.jwt()->>'role' = 'admin'; anon no cumple)  ->  1 fila
-- Lo importante: ninguna fila con qual/with_check = 'true' fuera de las 5 tablas públicas.
SELECT tablename, policyname, cmd, roles::text, qual, with_check
  FROM pg_policies
 WHERE schemaname = 'public' AND roles && ARRAY['public', 'anon']::name[]
 ORDER BY tablename, policyname;

-- V3b. Conteo directo de políticas abiertas en tablas internas. Esperado: 0
SELECT count(*) AS politicas_abiertas_en_internas
  FROM pg_policies
 WHERE schemaname = 'public'
   AND roles && ARRAY['public', 'anon']::name[]
   AND coalesce(qual, with_check) = 'true'
   AND tablename NOT IN ('departments', 'municipalities', 'department_adjacency', 'hospitals', 'kams');

-- V3c. users sin políticas (A-01). Esperado: 0
SELECT count(*) AS politicas_en_users FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users';

-- V3d. Total de políticas en public. Esperado: 39 (51 antes − 12 eliminadas en 02)
SELECT count(*) AS politicas_public FROM pg_policies WHERE schemaname = 'public';

-- V4. Privilegios de anon y authenticated sobre tablas/vistas de public  (C-03, C-04, C-05)
-- Esperado: 10 filas propias = SELECT para anon y authenticated en departments,
--   municipalities, department_adjacency, hospitals, kams.
--   Además aparecen geography_columns, geometry_columns y spatial_ref_sys (PostGIS, concedidos
--   por supabase_admin; postgres no puede revocarlos): esas 6 filas son conocidas y aceptadas.
SELECT grantee, table_name,
       string_agg(privilege_type, ',' ORDER BY privilege_type) AS privilegios
  FROM information_schema.role_table_grants
 WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated')
 GROUP BY grantee, table_name
 ORDER BY table_name, grantee;

-- V4b. Privilegios directos (ACL) indebidos en objetos propios. Esperado: 0 filas
SELECT r.rolname, c.relname, a.privilege_type
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  CROSS JOIN LATERAL aclexplode(c.relacl) a
  JOIN pg_roles r ON r.oid = a.grantee
 WHERE n.nspname = 'public'
   AND c.relkind IN ('r', 'p', 'v', 'm', 'S')
   AND pg_get_userbyid(c.relowner) = 'postgres'
   AND r.rolname IN ('anon', 'authenticated')
   AND NOT (a.privilege_type = 'SELECT'
            AND c.relname IN ('departments', 'municipalities', 'department_adjacency', 'hospitals', 'kams'))
 ORDER BY 1, 2, 3;

-- V5. Privilegios por defecto en public  (C-03)
-- Esperado: las 3 filas de grantor postgres (r, S, f) SIN anon ni authenticated, p. ej.
--   r: {postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}
--   S: {postgres=rwU/postgres,service_role=rwU/postgres}
--   f: {postgres=X/postgres,service_role=X/postgres}
-- Las 3 filas de grantor supabase_admin siguen con anon/authenticated (no modificables como
-- postgres; solo afectan a objetos creados por supabase_admin).
SELECT pg_get_userbyid(d.defaclrole) AS grantor, d.defaclobjtype AS tipo, d.defaclacl::text AS acl
  FROM pg_default_acl d
  JOIN pg_namespace n ON n.oid = d.defaclnamespace
 WHERE n.nspname = 'public'
 ORDER BY 1, 2;

-- V6. Funciones propias: search_path y EXECUTE  (B-12)
-- Esperado: 11 filas (get_contract_pdf_url ya no existe), todas con
--   proconfig = {"search_path=public, pg_temp"}, anon_exec = false, auth_exec = false,
--   service_exec = true.
SELECT p.oid::regprocedure::text AS funcion,
       p.prosecdef AS security_definer,
       p.proconfig::text,
       has_function_privilege('anon', p.oid, 'EXECUTE')          AS anon_exec,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_exec,
       has_function_privilege('service_role', p.oid, 'EXECUTE')  AS service_exec
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
 ORDER BY 1;

-- V6b. get_contract_pdf_url eliminada. Esperado: NULL
SELECT to_regprocedure('public.get_contract_pdf_url(uuid)') AS get_contract_pdf_url;

-- V7. Políticas de storage  (C-06)
-- Esperado: 1 fila: objects | "Public Access" | SELECT | {public} | (bucket_id = 'geojson'::text)
SELECT tablename, policyname, cmd, roles::text, qual, with_check
  FROM pg_policies
 WHERE schemaname = 'storage'
 ORDER BY tablename, policyname;

-- V7b. Bucket. Esperado: geojson | public = true (la lectura pública se mantiene a propósito)
SELECT id, public, file_size_limit, allowed_mime_types FROM storage.buckets ORDER BY id;

COMMIT;

-- V8. Prueba funcional con la anon key (fuera de SQL; ejecutar desde una terminal).
--   Sustituir $URL y $ANON por la URL del proyecto y la anon key (NEXT_PUBLIC_SUPABASE_ANON_KEY).
--   Esperado: 200 con datos en las 5 tablas públicas; 401/403 (42501 "permission denied") en
--   las demás; las vistas también 401/403.
--   curl -s -o /dev/null -w '%{http_code}\n' "$URL/rest/v1/hospitals?select=id&limit=1"            -H "apikey: $ANON"   # 200
--   curl -s -o /dev/null -w '%{http_code}\n' "$URL/rest/v1/kams?select=id&limit=1"                 -H "apikey: $ANON"   # 200
--   curl -s -o /dev/null -w '%{http_code}\n' "$URL/rest/v1/visits?select=id&limit=1"               -H "apikey: $ANON"   # 401
--   curl -s -o /dev/null -w '%{http_code}\n' "$URL/rest/v1/users?select=id&limit=1"                -H "apikey: $ANON"   # 401
--   curl -s -o /dev/null -w '%{http_code}\n' "$URL/rest/v1/v_hospital_contracts_extended?limit=1"  -H "apikey: $ANON"   # 401
--   curl -s -o /dev/null -w '%{http_code}\n' "$URL/rest/v1/mi_empresa_config?limit=1"              -H "apikey: $ANON"   # 401
--   curl -s -o /dev/null -w '%{http_code}\n' -X POST "$URL/rest/v1/rpc/find_nearest_hospital" \
--        -H "apikey: $ANON" -H 'Content-Type: application/json' -d '{"visit_lat":4.6,"visit_lng":-74.1}'    # 401
--   Storage (debe fallar con 400/403):
--   curl -s -o /dev/null -w '%{http_code}\n' -X POST "$URL/storage/v1/object/geojson/prueba.geojson" \
--        -H "apikey: $ANON" -H "Authorization: Bearer $ANON" -H 'Content-Type: application/json' -d '{}'
--   Lectura pública del bucket (debe seguir en 200):
--   curl -s -o /dev/null -w '%{http_code}\n' "$URL/storage/v1/object/public/geojson/departments/11.geojson"
--   (departments/11.geojson existe en el bucket, confirmado el 2026-10-10).
