#!/usr/bin/env python3
"""
Script para debuggear por qué Cartagena KAM no está recibiendo hospitales asignados
Genera queries SQL para ejecutar en Supabase directamente
"""

print("""
🔍 Queries SQL para investigar el problema de Cartagena KAM
=========================================================

-- 1️⃣ Buscar información del KAM de Cartagena
SELECT id, name, area_id, lat, lng, max_travel_time, enable_level2, priority, active
FROM kams 
WHERE name = 'KAM Cartagena';

-- 2️⃣ Buscar hospitales en el municipio de Cartagena (13001)
SELECT COUNT(*) as total_hospitales
FROM hospitals 
WHERE municipality_id = '13001';

-- Ver algunos hospitales de ejemplo
SELECT code, name, department_id, municipality_id, locality_id, lat, lng
FROM hospitals 
WHERE municipality_id = '13001'
LIMIT 10;

-- 3️⃣ Verificar si Cartagena tiene asignaciones
SELECT 
    a.kam_id,
    k.name as kam_name,
    COUNT(a.hospital_id) as total_asignaciones,
    COUNT(CASE WHEN a.assignment_type = 'base' THEN 1 END) as base_assignments,
    COUNT(CASE WHEN a.assignment_type = 'competitive' THEN 1 END) as competitive_assignments
FROM assignments a
JOIN kams k ON a.kam_id = k.id
WHERE k.name = 'KAM Cartagena'
GROUP BY a.kam_id, k.name;

-- Ver detalle de las asignaciones (si existen)
SELECT 
    h.code,
    h.name as hospital_name,
    h.municipality_id,
    a.assignment_type,
    a.travel_time
FROM assignments a
JOIN kams k ON a.kam_id = k.id
JOIN hospitals h ON a.hospital_id = h.id
WHERE k.name = 'KAM Cartagena'
LIMIT 10;

-- 4️⃣ Verificar qué KAMs podrían estar compitiendo por Cartagena
-- KAMs en Bolívar (13)
SELECT name, area_id, active
FROM kams 
WHERE area_id LIKE '13%';

-- KAMs en departamentos cercanos
-- Atlántico (08)
SELECT name, area_id, active
FROM kams 
WHERE area_id LIKE '08%';

-- Sucre (70)
SELECT name, area_id, active
FROM kams 
WHERE area_id LIKE '70%';

-- 5️⃣ Verificar si algún otro KAM tiene asignados los hospitales de Cartagena
SELECT 
    k.name as kam_name,
    k.area_id,
    COUNT(h.id) as hospitales_cartagena_asignados
FROM assignments a
JOIN kams k ON a.kam_id = k.id
JOIN hospitals h ON a.hospital_id = h.id
WHERE h.municipality_id = '13001'
GROUP BY k.name, k.area_id
ORDER BY hospitales_cartagena_asignados DESC;

-- 6️⃣ Verificar información del municipio
SELECT *
FROM municipalities 
WHERE code = '13001';

-- 7️⃣ Verificar estado del campo 'active' en todos los KAMs
SELECT name, area_id, active
FROM kams
ORDER BY name;

-- 8️⃣ Query completo de diagnóstico
WITH cartagena_hospitals AS (
    SELECT COUNT(*) as total_hospitals
    FROM hospitals 
    WHERE municipality_id = '13001'
),
cartagena_kam AS (
    SELECT id, name, area_id, active
    FROM kams 
    WHERE name = 'KAM Cartagena'
),
cartagena_assignments AS (
    SELECT COUNT(*) as total_assignments
    FROM assignments a
    JOIN kams k ON a.kam_id = k.id
    WHERE k.name = 'KAM Cartagena'
)
SELECT 
    ck.name,
    ck.area_id,
    ck.active,
    ch.total_hospitals as hospitales_en_cartagena,
    ca.total_assignments as hospitales_asignados_a_cartagena_kam
FROM cartagena_kam ck
CROSS JOIN cartagena_hospitals ch
CROSS JOIN cartagena_assignments ca;

=========================================================
Ejecuta estas queries en el SQL Editor de Supabase para diagnosticar el problema.
""")