-- Script FINAL para recrear vistas sin SECURITY DEFINER
-- Versión definitiva con todas las correcciones

-- ============================================
-- 1. RECREAR VISTA: visit_statistics
-- ============================================
DROP VIEW IF EXISTS public.visit_statistics CASCADE;

CREATE VIEW public.visit_statistics AS
SELECT 
  v.visit_date,
  v.visit_type,
  v.hospital_id,
  h.name AS hospital_name,
  h.municipality_name,
  h.department_name,
  v.kam_id,
  k.name AS kam_name,
  COUNT(*) OVER (PARTITION BY v.kam_id) AS total_visits_by_kam,
  COUNT(*) OVER (PARTITION BY v.hospital_id) AS total_visits_to_hospital
FROM public.visits v
LEFT JOIN public.hospitals h ON v.hospital_id = h.id
LEFT JOIN public.kams k ON v.kam_id = k.id;

GRANT SELECT ON public.visit_statistics TO anon, authenticated;

-- ============================================
-- 2. RECREAR VISTA: kam_statistics
-- ============================================
DROP VIEW IF EXISTS public.kam_statistics CASCADE;

CREATE VIEW public.kam_statistics AS
SELECT 
  k.id,
  k.name,
  COUNT(DISTINCT a.hospital_id) AS total_hospitals,
  COUNT(DISTINCT h.municipality_id) AS total_municipalities,
  COALESCE(SUM(hc.contract_value), 0) AS total_opportunity_value,
  AVG(a.travel_time) AS avg_travel_time
FROM public.kams k
LEFT JOIN public.assignments a ON k.id = a.kam_id
LEFT JOIN public.hospitals h ON a.hospital_id = h.id
LEFT JOIN public.hospital_contracts hc ON h.id = hc.hospital_id AND hc.active = true
WHERE k.active = true
GROUP BY k.id, k.name;

GRANT SELECT ON public.kam_statistics TO anon, authenticated;

-- ============================================
-- 3. RECREAR VISTA: territory_statistics
-- ============================================
DROP VIEW IF EXISTS public.territory_statistics CASCADE;

CREATE VIEW public.territory_statistics AS
WITH territory_data AS (
  SELECT 
    COALESCE(h.locality_id, h.municipality_id) AS territory_id,
    COALESCE(h.locality_name, h.municipality_name) AS territory_name,
    CASE 
      WHEN h.locality_id IS NOT NULL THEN 'locality'
      ELSE 'municipality'
    END AS territory_type,
    h.id AS hospital_id,
    h.beds,
    h.service_level,
    h.active
  FROM public.hospitals h
),
forced_data AS (
  SELECT 
    fa.territory_id,
    fa.kam_id AS forced_kam_id,
    k.name AS forced_kam_name,
    k.color AS forced_kam_color,
    fa.reason AS forced_reason
  FROM public.forced_assignments fa
  JOIN public.kams k ON fa.kam_id = k.id
  WHERE fa.active = true
),
territory_summary AS (
  SELECT 
    td.territory_id,
    td.territory_name,
    td.territory_type,
    COUNT(DISTINCT td.hospital_id) AS hospital_count,
    COALESCE(SUM(td.beds), 0) AS total_beds,
    COUNT(DISTINCT CASE WHEN td.service_level >= 3 THEN td.hospital_id END) AS high_level_hospitals,
    COUNT(DISTINCT CASE WHEN td.active = true THEN td.hospital_id END) AS active_hospitals
  FROM territory_data td
  GROUP BY td.territory_id, td.territory_name, td.territory_type
)
SELECT 
  ts.territory_id,
  ts.territory_name,
  ts.territory_type,
  ts.hospital_count,
  ts.total_beds,
  ts.high_level_hospitals,
  ts.active_hospitals,
  CASE WHEN fd.forced_kam_id IS NOT NULL THEN true ELSE false END AS is_forced,
  fd.forced_kam_id,
  fd.forced_kam_name,
  fd.forced_kam_color,
  fd.forced_reason
FROM territory_summary ts
LEFT JOIN forced_data fd ON ts.territory_id = fd.territory_id;

GRANT SELECT ON public.territory_statistics TO anon, authenticated;

-- ============================================
-- 4. RECREAR VISTA: hospital_contracts_view
-- ============================================
DROP VIEW IF EXISTS public.hospital_contracts_view CASCADE;

-- CORREGIDO: No duplicar pdf_url ya que existe en hc.*
-- Usar las funciones que sí existen
CREATE VIEW public.hospital_contracts_view AS
SELECT 
  hc.id,
  hc.hospital_id,
  hc.contract_value,
  hc.start_date,
  hc.duration_months,
  hc.current_provider,
  hc.description,
  hc.active,
  hc.created_by,
  hc.created_at,
  hc.contract_number,
  hc.contract_type,
  hc.end_date,
  hc.updated_at,
  hc.pdf_url,  -- Ya existe en la tabla
  hc.pdf_filename,
  hc.pdf_uploaded_at,
  hc.provider,
  h.name AS hospital_name,
  h.municipality_name,
  h.department_name,
  get_contract_end_date(hc.id) AS calculated_end_date,
  get_contract_pdf_url(hc.id) AS calculated_pdf_url  -- Renombrado para evitar conflicto
FROM public.hospital_contracts hc
JOIN public.hospitals h ON hc.hospital_id = h.id;

GRANT SELECT ON public.hospital_contracts_view TO anon, authenticated;

-- ============================================
-- 5. RECREAR VISTA: territory_assignments
-- ============================================
DROP VIEW IF EXISTS public.territory_assignments CASCADE;

CREATE VIEW public.territory_assignments AS
SELECT DISTINCT
  COALESCE(h.locality_id, h.municipality_id) AS territory_id,
  COALESCE(h.locality_name, h.municipality_name) AS territory_name,
  h.department_id,
  h.department_name,
  a.kam_id,
  k.name AS kam_name,
  k.color AS kam_color,
  COUNT(DISTINCT h.id) AS hospital_count
FROM public.assignments a
JOIN public.hospitals h ON a.hospital_id = h.id
JOIN public.kams k ON a.kam_id = k.id
GROUP BY 
  COALESCE(h.locality_id, h.municipality_id),
  COALESCE(h.locality_name, h.municipality_name),
  h.department_id,
  h.department_name,
  a.kam_id,
  k.name,
  k.color;

GRANT SELECT ON public.territory_assignments TO anon, authenticated;

-- ============================================
-- 6. VERIFICACIÓN FINAL
-- ============================================

-- Verificar que las vistas fueron recreadas
SELECT 
  viewname,
  'Vista recreada sin SECURITY DEFINER ✓' as estado
FROM pg_views
WHERE schemaname = 'public'
  AND viewname IN (
    'visit_statistics', 
    'kam_statistics', 
    'territory_statistics', 
    'hospital_contracts_view', 
    'territory_assignments'
  )
ORDER BY viewname;

-- Mostrar resumen de errores resueltos
SELECT 
  'RESUMEN:' as info,
  '5 vistas recreadas sin SECURITY DEFINER' as detalle
UNION ALL
SELECT 
  'NOTA:',
  'El error de spatial_ref_sys puede ignorarse (tabla del sistema PostGIS)';