-- =====================================================================================
-- OpMap · Rollback de 0903 (2026-10-28_0903_bogota_norte_punto_base_usaquen.sql)
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-28
--
-- Devuelve Bogotá Norte a su punto base de Chapinero, en una sola transacción:
--   1. kams: area_id, base_city, lat y lng del respaldo.
--   2. hospital_kam_distances y municipality_travel_times de la zona: se reemplazan por los respaldos _norte (los
--      tiempos desde Chapinero), sin la columna respaldado_en; los pares de IPS borradas después se omiten.
--   3. Los respaldos NO se borran (se borran a mano cuando el dueño dé por bueno el resultado).
-- Después hay que recalcular, sin Google: IPS (fase1-recalculate --yes), municipios (fase2b-municipios --assign) y
-- cobertura por línea (fase2-recalculate). Lo pagado a Google por los tiempos desde Usaquén no se recupera.
-- =====================================================================================

BEGIN;

DO $$
DECLARE
  respaldo text;
  tiene_filas boolean;
BEGIN
  -- Con EXECUTE: un SELECT directo sobre una tabla que no existe falla al planear
  FOREACH respaldo IN ARRAY ARRAY['kams_punto_base_respaldo_20261028', 'hospital_kam_distances_respaldo_20261028_norte', 'municipality_travel_times_respaldo_20261028_norte'] LOOP
    IF to_regclass('public.' || respaldo) IS NULL THEN
      RAISE EXCEPTION '9954: no existe % (¿se aplicó la 0903?)', respaldo;
    END IF;
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I)', respaldo) INTO tiene_filas;
    IF NOT tiene_filas THEN
      RAISE EXCEPTION '9954: % está vacío', respaldo;
    END IF;
  END LOOP;
END $$;

UPDATE public.kams k SET area_id = r.area_id, base_city = r.base_city, lat = r.lat, lng = r.lng
  FROM public.kams_punto_base_respaldo_20261028 r
  WHERE r.id = k.id;

DELETE FROM public.hospital_kam_distances WHERE kam_id = (SELECT id FROM public.kams_punto_base_respaldo_20261028);
INSERT INTO public.hospital_kam_distances (id, hospital_id, kam_id, travel_time, distance, source, calculated_at, updated_at)
  SELECT r.id, r.hospital_id, r.kam_id, r.travel_time, r.distance, r.source, r.calculated_at, r.updated_at
  FROM public.hospital_kam_distances_respaldo_20261028_norte r
  WHERE EXISTS (SELECT 1 FROM public.hospitals h WHERE h.id = r.hospital_id);

DELETE FROM public.municipality_travel_times WHERE kam_id = (SELECT id FROM public.kams_punto_base_respaldo_20261028);
INSERT INTO public.municipality_travel_times (id, kam_id, municipality_code, travel_minutes, distance_km, status, source, calculated_at)
  SELECT r.id, r.kam_id, r.municipality_code, r.travel_minutes, r.distance_km, r.status, r.source, r.calculated_at
  FROM public.municipality_travel_times_respaldo_20261028_norte r;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.kams k JOIN public.kams_punto_base_respaldo_20261028 r ON r.id = k.id
    WHERE k.area_id = r.area_id AND k.lat = r.lat AND k.lng = r.lng
  ) THEN
    RAISE EXCEPTION '9954: el punto base no volvió al del respaldo';
  END IF;
  RAISE NOTICE '9954: Bogotá Norte vuelve a su punto base anterior, con sus tiempos de antes';
END $$;

COMMIT;
