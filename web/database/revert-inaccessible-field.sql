-- Script para REVERTIR/ELIMINAR el campo de hospitales inaccesibles
-- Ejecutar en Supabase SQL Editor

-- ====================================
-- 1. Eliminar la vista de hospitales inaccesibles
-- ====================================
DROP VIEW IF EXISTS hospitals_inaccessible;

-- ====================================
-- 2. Eliminar la función helper
-- ====================================
DROP FUNCTION IF EXISTS mark_hospital_inaccessible(UUID, TEXT);

-- ====================================
-- 3. Eliminar el índice
-- ====================================
DROP INDEX IF EXISTS idx_hospitals_inaccessible;

-- ====================================
-- 4. Eliminar el campo de la tabla hospitals
-- ====================================
ALTER TABLE hospitals 
DROP COLUMN IF EXISTS inaccessible_by_road;

-- ====================================
-- 5. Verificar que el campo fue eliminado
-- ====================================
SELECT 
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'hospitals'
  AND column_name = 'inaccessible_by_road';

-- Si no devuelve nada, el campo fue eliminado correctamente

-- ====================================
-- 6. Confirmar estructura actual de la tabla
-- ====================================
SELECT 
  ordinal_position as pos,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'hospitals'
ORDER BY ordinal_position
LIMIT 10;

-- ====================================
-- Mensaje de confirmación
-- ====================================
SELECT 'Campo inaccessible_by_road eliminado correctamente' as mensaje;