-- Script de prueba para verificar operaciones de hospitales
-- IMPORTANTE: Este script hace cambios reales, úsalo con cuidado

-- 1. Seleccionar un hospital de prueba
SELECT '=== HOSPITAL DE PRUEBA ===' as test;
SELECT id, name, code, active 
FROM hospitals 
WHERE name LIKE '%Clínica Portoazul%'
LIMIT 1;

-- 2. Verificar que puedes actualizar el hospital (sin ejecutar)
-- Descomenta la siguiente línea para ejecutar la actualización
-- UPDATE hospitals SET active = false WHERE name LIKE '%Clínica Portoazul%' RETURNING *;

-- 3. Verificar que puedes insertar en hospital_history (sin ejecutar)
-- Descomenta las siguientes líneas para ejecutar la inserción
/*
INSERT INTO hospital_history (
    hospital_id,
    action,
    reason,
    user_id,
    previous_state,
    new_state
) VALUES (
    (SELECT id FROM hospitals WHERE name LIKE '%Clínica Portoazul%' LIMIT 1),
    'deactivated',
    'Prueba de desactivación',
    NULL, -- Sin usuario (prueba manual)
    true,
    false
) RETURNING *;
*/

-- 4. Ver el historial actual de un hospital
SELECT '=== HISTORIAL ACTUAL ===' as test;
SELECT 
    h.name as hospital_name,
    hh.action,
    hh.reason,
    hh.previous_state,
    hh.new_state,
    hh.created_at,
    u.email as usuario
FROM hospital_history hh
JOIN hospitals h ON h.id = hh.hospital_id
LEFT JOIN users u ON u.id = hh.user_id
ORDER BY hh.created_at DESC
LIMIT 10;

-- 5. Verificar permisos del usuario actual
SELECT '=== PERMISOS DEL USUARIO ACTUAL ===' as test;
SELECT current_user, current_role;