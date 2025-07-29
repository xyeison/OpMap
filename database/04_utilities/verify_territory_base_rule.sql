-- Verificar la regla de territorio base para TODOS los KAMs

-- 1. Ver todos los KAMs y sus municipios base
SELECT 
    id,
    name,
    area_id as municipio_base,
    active
FROM kams
ORDER BY name;

-- 2. Verificar que cada KAM tiene todas las IPS de su municipio con tiempo 0
SELECT 
    k.name as kam_name,
    k.area_id as kam_municipio,
    COUNT(DISTINCT h.id) as ips_mismo_municipio,
    COUNT(DISTINCT CASE WHEN a.travel_time = 0 THEN h.id END) as ips_con_tiempo_0,
    COUNT(DISTINCT CASE WHEN a.travel_time > 0 THEN h.id END) as ips_con_tiempo_mayor_0,
    CASE 
        WHEN COUNT(DISTINCT h.id) = COUNT(DISTINCT CASE WHEN a.travel_time = 0 THEN h.id END)
        THEN '✅ CORRECTO - Todas las IPS del municipio tienen tiempo 0'
        ELSE '❌ ERROR - Hay IPS del mismo municipio con tiempo > 0'
    END as validacion
FROM kams k
JOIN hospitals h ON h.municipality_id = k.area_id
LEFT JOIN assignments a ON a.kam_id = k.id AND a.hospital_id = h.id
WHERE k.active = true
GROUP BY k.id, k.name, k.area_id
ORDER BY k.name;

-- 3. Buscar IPS huérfanas (sin asignar) que deberían tener un KAM local
SELECT 
    h.code,
    h.name,
    h.municipality_id,
    h.department_id,
    k.name as kam_en_municipio,
    CASE 
        WHEN k.id IS NOT NULL THEN 'ERROR - Hay KAM pero no está asignada'
        ELSE 'OK - No hay KAM en este municipio'
    END as estado
FROM hospitals h
LEFT JOIN assignments a ON h.id = a.hospital_id
LEFT JOIN kams k ON k.area_id = h.municipality_id AND k.active = true
WHERE a.id IS NULL
  AND h.active = true
ORDER BY h.municipality_id;

-- 4. Resumen: ¿Cuántas IPS quedarían sin asignar si eliminamos cada KAM?
SELECT 
    k.name as kam_name,
    k.area_id as municipio,
    COUNT(DISTINCT CASE WHEN h.municipality_id = k.area_id THEN h.id END) as ips_territorio_base,
    COUNT(DISTINCT CASE WHEN h.municipality_id != k.area_id THEN h.id END) as ips_expansion,
    COUNT(DISTINCT h.id) as total_ips_asignadas,
    CONCAT(
        'Si se elimina este KAM: ',
        COUNT(DISTINCT CASE WHEN h.municipality_id = k.area_id THEN h.id END),
        ' IPS de territorio base necesitarían reasignación'
    ) as impacto_eliminacion
FROM kams k
JOIN assignments a ON a.kam_id = k.id
JOIN hospitals h ON h.id = a.hospital_id
WHERE k.active = true
GROUP BY k.id, k.name, k.area_id
ORDER BY COUNT(DISTINCT h.id) DESC;

-- 5. Simulación: ¿A qué KAM se reasignarían las IPS de Valledupar?
WITH valledupar_ips AS (
    SELECT h.* 
    FROM hospitals h
    WHERE h.municipality_id = '20001' -- Código de Valledupar
      AND h.active = true
)
SELECT 
    vi.code as ips_code,
    vi.name as ips_name,
    k.name as kam_mas_cercano,
    ROUND(
        CAST(2 * 6371 * ASIN(SQRT(
            POWER(SIN(RADIANS((vi.lat - k.lat) / 2)), 2) +
            COS(RADIANS(k.lat)) * COS(RADIANS(vi.lat)) *
            POWER(SIN(RADIANS((vi.lng - k.lng) / 2)), 2)
        )) AS numeric)
    , 2) as distancia_km
FROM valledupar_ips vi
CROSS JOIN kams k
WHERE k.active = true 
  AND k.name NOT LIKE '%Valledupar%'
  AND k.area_id != '20001'
ORDER BY 
    vi.code,
    distancia_km
LIMIT 20; -- Mostrar los primeros resultados