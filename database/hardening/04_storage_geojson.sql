-- =====================================================================================
-- OpMap · Endurecimiento Supabase · 04 — Bucket geojson: sin subida ni modificación públicas
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-10 · NO EJECUTADO TODAVÍA
--
-- Qué cierra: el bucket público geojson (1.174 objetos, los polígonos del mapa) tiene en
--   storage.objects las políticas "Public Upload" (INSERT) y "Public Update" (UPDATE) para el
--   rol public: cualquiera con la anon key puede sobrescribir o añadir geometrías.
-- Hallazgos: C-06 [SEC-DB-05, SEC-13].
--
-- Políticas confirmadas con SELECT sobre pg_policies (schemaname='storage') el 2026-10-10:
--   "Public Access"  SELECT  {public}  USING (bucket_id = 'geojson')          -> se CONSERVA
--   "Public Update"  UPDATE  {public}  USING/CHECK (bucket_id = 'geojson')    -> se elimina
--   "Public Upload"  INSERT  {public}  CHECK (bucket_id = 'geojson')          -> se elimina
--   No hay más políticas en storage.objects ni en storage.buckets.
--
-- Efecto: la lectura no cambia (la app descarga desde /storage/v1/object/public/geojson/...,
--   web/app/api/geojson/[type]/[id]/route.ts). La subida/actualización solo queda para
--   service_role (bypass de RLS), p. ej. un script de mantenimiento o el dashboard.
--   No hay código en web/ que suba al bucket.
--
-- Copia previa: los 1.174 GeoJSON están respaldados en el Paso 0 (backup-2026-10-10/geojson,
--   con geojson_sha256.txt; 1.174/1.174 nombres coinciden con el bucket, 0 diferencias de tamaño).
--
-- Nota de permisos: en Supabase, postgres puede crear/eliminar políticas de storage.objects
--   desde el SQL Editor. Si devolviera "must be owner of table objects", eliminar las dos
--   políticas desde Dashboard > Storage > Policies (bucket geojson).
-- Idempotente: sí. Rollback: ver 99_rollback.sql (sección 04).
-- =====================================================================================

BEGIN;

DROP POLICY IF EXISTS "Public Upload" ON storage.objects;
DROP POLICY IF EXISTS "Public Update" ON storage.objects;

-- Comprobaciones: queda la lectura y no queda escritura para public/anon/authenticated.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'storage' AND tablename = 'objects'
       AND policyname = 'Public Access' AND cmd = 'SELECT'
  ) THEN
    RAISE EXCEPTION 'Falta la política "Public Access" (SELECT) en storage.objects: el mapa no podría listar/leer';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'storage' AND tablename = 'objects'
       AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
       AND (roles && ARRAY['public', 'anon', 'authenticated']::name[])
  ) THEN
    RAISE EXCEPTION 'Quedan políticas de escritura en storage.objects para public/anon/authenticated';
  END IF;
END $$;

COMMIT;
