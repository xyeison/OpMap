-- ========================================
-- PRUEBA DE INSERCIÓN PASO A PASO
-- ========================================

-- PASO 1: Ejecuta SOLO esta consulta primero
SELECT id, name, code 
FROM hospitals 
WHERE active = true 
LIMIT 5;

-- PASO 2: De los resultados anteriores, verás algo como:
-- id                                    | name           | code
-- ---------------------------------------|----------------|-------
-- 123e4567-e89b-12d3-a456-426614174000  | Hospital XYZ   | 12345

-- Copia el valor de la columna 'id' (el UUID largo)

-- PASO 3: Ahora ejecuta este INSERT reemplazando el ID:
-- (Cambia 'REEMPLAZA_CON_EL_ID_DEL_PASO_1' con el ID que copiaste)

INSERT INTO hospital_contracts (
    hospital_id,
    contract_value,
    start_date,
    duration_months,
    current_provider,
    active
) VALUES (
    'REEMPLAZA_CON_EL_ID_DEL_PASO_1', -- <-- PEGA AQUÍ EL ID
    1000000,
    '2024-01-01',
    12,
    'Proveedor Test',
    true
) RETURNING *;

-- EJEMPLO REAL (NO ejecutes esto, es solo un ejemplo):
-- Si el hospital_id fuera '123e4567-e89b-12d3-a456-426614174000', sería:
/*
INSERT INTO hospital_contracts (
    hospital_id,
    contract_value,
    start_date,
    duration_months,
    current_provider,
    active
) VALUES (
    '123e4567-e89b-12d3-a456-426614174000',
    1000000,
    '2024-01-01',
    12,
    'Proveedor Test',
    true
) RETURNING *;
*/

-- Si el INSERT funciona, verás el registro creado
-- Si falla, comparte el mensaje de error exacto