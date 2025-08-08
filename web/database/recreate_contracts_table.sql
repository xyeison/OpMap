-- Script para recrear la tabla hospital_contracts si está corrupta
-- ADVERTENCIA: Esto eliminará todos los datos existentes

-- 1. Hacer backup de los datos existentes (si los hay)
CREATE TEMP TABLE hospital_contracts_backup AS 
SELECT * FROM hospital_contracts;

-- 2. Eliminar la tabla existente y sus dependencias
DROP TABLE IF EXISTS hospital_contracts CASCADE;

-- 3. Crear la tabla nueva con estructura correcta
CREATE TABLE hospital_contracts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    contract_number VARCHAR(255) NOT NULL,
    contract_type VARCHAR(50) DEFAULT 'capita',
    contracting_model VARCHAR(30) DEFAULT 'contratacion_directa',
    contract_value NUMERIC(15, 2) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    duration_months INTEGER,
    current_provider VARCHAR(255) DEFAULT 'Proveedor',
    provider VARCHAR(255),
    description TEXT,
    active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    CONSTRAINT check_contracting_model CHECK (contracting_model IN ('contratacion_directa', 'licitacion', 'invitacion_privada'))
);

-- 4. Crear índices para mejorar rendimiento
CREATE INDEX idx_hospital_contracts_hospital_id ON hospital_contracts(hospital_id);
CREATE INDEX idx_hospital_contracts_active ON hospital_contracts(active);
CREATE INDEX idx_hospital_contracts_end_date ON hospital_contracts(end_date);

-- 5. Desactivar RLS por ahora (para evitar problemas)
ALTER TABLE hospital_contracts DISABLE ROW LEVEL SECURITY;

-- 6. Restaurar datos del backup (si existen)
INSERT INTO hospital_contracts 
SELECT * FROM hospital_contracts_backup
WHERE EXISTS (SELECT 1 FROM hospital_contracts_backup LIMIT 1);

-- 7. Verificar que la tabla se creó correctamente
SELECT 
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'hospital_contracts'
ORDER BY ordinal_position;

-- 8. Test de inserción
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
    (SELECT id FROM hospitals WHERE active = true LIMIT 1),
    'TEST-' || gen_random_uuid()::text,
    'capita',
    'contratacion_directa',
    1000000,
    '2024-01-01',
    '2024-12-31',
    12,
    true
) RETURNING *;

-- 9. Si el test funcionó, eliminar el registro de prueba
DELETE FROM hospital_contracts WHERE contract_number LIKE 'TEST-%';

-- 10. Mensaje de confirmación
SELECT 'Tabla hospital_contracts recreada exitosamente' as mensaje;