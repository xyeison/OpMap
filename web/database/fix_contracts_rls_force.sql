-- Script FORZADO para arreglar RLS de hospital_contracts
-- Este script es más agresivo y debería resolver el problema

-- 1. DESACTIVAR RLS temporalmente para limpiar todo
ALTER TABLE hospital_contracts DISABLE ROW LEVEL SECURITY;

-- 2. Eliminar TODAS las políticas existentes
DO $$ 
DECLARE
    pol record;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'hospital_contracts'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON hospital_contracts', pol.policyname);
    END LOOP;
END $$;

-- 3. Re-habilitar RLS
ALTER TABLE hospital_contracts ENABLE ROW LEVEL SECURITY;

-- 4. Crear política SUPER PERMISIVA para testing
-- Esta política permite TODO a TODOS los usuarios autenticados
CREATE POLICY "Allow all operations for authenticated users" 
ON hospital_contracts 
FOR ALL 
TO authenticated
USING (true)
WITH CHECK (true);

-- 5. Verificar que la política se creó
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'hospital_contracts';

-- 6. Verificar el estado de RLS
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'hospital_contracts';

-- 7. Si aún no funciona, opción nuclear: DESACTIVAR RLS COMPLETAMENTE
-- DESCOMENTA la siguiente línea solo si todo lo demás falla:
-- ALTER TABLE hospital_contracts DISABLE ROW LEVEL SECURITY;

-- 8. Agregar la columna contracting_model si no existe
ALTER TABLE hospital_contracts 
ADD COLUMN IF NOT EXISTS contracting_model VARCHAR(30) DEFAULT 'contratacion_directa';

-- 9. Eliminar constraint anterior si existe
ALTER TABLE hospital_contracts
DROP CONSTRAINT IF EXISTS check_contracting_model;

-- 10. Agregar nuevo constraint con las 3 opciones
ALTER TABLE hospital_contracts
ADD CONSTRAINT check_contracting_model 
CHECK (contracting_model IN ('contratacion_directa', 'licitacion', 'invitacion_privada'));

-- 11. Verificar permisos en la tabla
SELECT 
    grantee,
    table_schema,
    table_name,
    privilege_type
FROM information_schema.table_privileges
WHERE table_name = 'hospital_contracts'
ORDER BY grantee, privilege_type;

-- 12. Otorgar permisos explícitos al rol authenticated
GRANT ALL ON hospital_contracts TO authenticated;
GRANT USAGE ON SEQUENCE hospital_contracts_id_seq TO authenticated;

-- 13. Verificar si hay triggers que puedan estar interfiriendo
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'hospital_contracts';

-- 14. Test final - intentar insertar un registro de prueba
-- NOTA: Reemplaza los UUIDs con IDs válidos de tu base de datos
/*
INSERT INTO hospital_contracts (
    hospital_id,
    contract_number,
    contract_type,
    contracting_model,
    contract_value,
    start_date,
    end_date,
    duration_months,
    active
) VALUES (
    (SELECT id FROM hospitals LIMIT 1), -- Usa el primer hospital
    'TEST-001',
    'capita',
    'contratacion_directa',
    1000000,
    '2024-01-01',
    '2024-12-31',
    12,
    true
);
*/

-- Si el INSERT de prueba funciona, elimínalo:
-- DELETE FROM hospital_contracts WHERE contract_number = 'TEST-001';