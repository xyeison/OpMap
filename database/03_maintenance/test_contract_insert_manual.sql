-- ========================================
-- PRUEBA MANUAL DE INSERCIÓN DE CONTRATO
-- ========================================

-- 1. Primero, obtener un hospital_id válido
SELECT id, name, code 
FROM hospitals 
WHERE active = true 
LIMIT 5;

-- 2. Copiar un ID de la consulta anterior y pegarlo en el INSERT de abajo

-- 3. Intentar insertar un contrato mínimo
-- AJUSTA el hospital_id con uno de los IDs obtenidos arriba
INSERT INTO hospital_contracts (
    hospital_id,
    contract_value,
    start_date,
    duration_months,
    current_provider,
    active
) VALUES (
    'PEGA_AQUI_UN_HOSPITAL_ID', -- <-- CAMBIAR ESTO
    1000000,
    '2024-01-01',
    12,
    'Proveedor Test',
    true
) RETURNING *;

-- Si el INSERT anterior falla, intenta con todos los campos:
/*
INSERT INTO hospital_contracts (
    hospital_id,
    contract_number,
    contract_type,
    contract_value,
    start_date,
    end_date,
    duration_months,
    current_provider,
    description,
    active,
    created_by
) VALUES (
    'PEGA_AQUI_UN_HOSPITAL_ID', -- <-- CAMBIAR ESTO
    'TEST-001',
    'capita',
    1000000,
    '2024-01-01',
    '2024-12-31',
    12,
    'Proveedor Test',
    'Contrato de prueba',
    true,
    NULL
) RETURNING *;
*/

-- 4. Si funcionó, eliminar el registro de prueba:
-- DELETE FROM hospital_contracts WHERE contract_number = 'TEST-001';