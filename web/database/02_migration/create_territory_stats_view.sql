-- Crear o reemplazar la vista territory_stats con validación de nombres nulos
DROP VIEW IF EXISTS public.territory_stats CASCADE;

CREATE OR REPLACE VIEW public.territory_stats AS
WITH hospital_stats AS (
  SELECT 
    COALESCE(h.municipality_id, h.locality_id) as territory_id,
    CASE 
      WHEN h.locality_id IS NOT NULL THEN 'locality'
      ELSE 'municipality'
    END as territory_type,
    COALESCE(h.locality_name, h.municipality_name, 'Sin nombre') as territory_name,
    h.department_name,
    COUNT(*) as hospital_count,
    SUM(h.beds) as total_beds,
    COUNT(CASE WHEN h.service_level >= 3 THEN 1 END) as high_level_hospitals,
    COUNT(CASE WHEN h.active = true THEN 1 END) as active_hospitals,
    SUM(h.surgeries) as total_surgeries,
    SUM(h.ambulances) as total_ambulances
  FROM hospitals h
  WHERE h.department_id NOT IN ('27', '97', '99', '88', '95', '94', '91')
  GROUP BY 
    COALESCE(h.municipality_id, h.locality_id),
    CASE WHEN h.locality_id IS NOT NULL THEN 'locality' ELSE 'municipality' END,
    COALESCE(h.locality_name, h.municipality_name, 'Sin nombre'),
    h.department_name
)
SELECT 
  territory_id,
  territory_type,
  territory_name,
  department_name,
  hospital_count,
  COALESCE(total_beds, 0) as total_beds,
  COALESCE(high_level_hospitals, 0) as high_level_hospitals,
  COALESCE(active_hospitals, 0) as active_hospitals,
  COALESCE(total_surgeries, 0) as total_surgeries,
  COALESCE(total_ambulances, 0) as total_ambulances
FROM hospital_stats;

-- Verificar que no hay nombres nulos
SELECT COUNT(*) as null_names_count
FROM territory_stats
WHERE territory_name IS NULL;

-- Mostrar algunos registros de ejemplo
SELECT 
  territory_id,
  territory_name,
  territory_type,
  department_name,
  hospital_count
FROM territory_stats
LIMIT 10;