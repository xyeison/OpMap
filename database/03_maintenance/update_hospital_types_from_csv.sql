-- ========================================
-- ACTUALIZACIÓN DE TIPOS DE HOSPITALES DESDE CSV
-- ========================================
-- Este script genera las sentencias UPDATE para cada hospital
-- basándose en los datos del archivo type.csv

-- Nota: Este es un archivo de ejemplo con algunos registros.
-- El script Python update_hospital_types.py es la forma recomendada
-- de hacer la actualización completa.

-- Ejemplos de actualización por lotes:

-- Actualizar hospitales tipo Privada (muestra de 10 registros)
UPDATE hospitals SET type = 'Privada' 
WHERE id IN (
    'bbdf914a-fbe1-45fa-a3fe-22858447e291',
    '9268bd94-3871-4a87-9b80-00251dbc09b9',
    'eccf706d-e8c6-410a-b708-fff897f1c648',
    '28aa75fd-0c3d-486b-9dae-1fe6402734a8',
    'f75e817d-9e3f-40cc-ae56-efbffc4dc596',
    '5e13ac6d-fbea-44d1-8f46-c5b73030667e',
    '5814001f-e498-466c-8aff-6e10f23e9d75',
    '71860c74-bde1-45f9-b9b6-6bb34e36ffde',
    'c4a9d4d5-da6b-480e-8eb7-506f32631dc2',
    'ecda1cbe-cfc4-43ee-9e85-194adb981de3'
);

-- Actualizar hospitales tipo Publico (muestra de 10 registros)
UPDATE hospitals SET type = 'Publico' 
WHERE id IN (
    '34bfd074-7c38-486a-a24a-ad97439b1c17',
    'da5a0dbc-c6d6-4fa2-9f66-0276d8daddee',
    '06679f6d-6c2f-4913-9c30-6b41cf043142',
    'c36bad8e-5d79-4030-a744-741c8239c809',
    'f8594642-490a-4f90-a37a-65fbf15de316',
    '8702350e-c0e2-4f68-acbb-2ef5cef33b61',
    'aa505371-9606-4582-8626-ed0dc45bf742',
    'c524d273-2286-4d88-91e0-96da2f5b2a9c',
    'b610e4d2-f4b7-4d0f-9235-b2873d33cd0d',
    'e209c6a0-a312-41a2-9b74-fadd9df93fca'
);

-- Verificar resultado parcial
SELECT 
    type,
    COUNT(*) as cantidad
FROM hospitals
WHERE type IS NOT NULL
GROUP BY type
ORDER BY type;

-- ========================================
-- NOTA IMPORTANTE:
-- ========================================
-- Para cargar todos los 777 registros del CSV, use el script Python:
-- python3 scripts/update_hospital_types.py
--
-- Este script SQL solo muestra ejemplos de cómo se hace la actualización.
-- El script Python es más eficiente para actualizar todos los registros.