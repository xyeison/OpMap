-- Script completo para solucionar todos los problemas de hospital_history

-- 1. Primero, ajustar las políticas RLS de hospital_history
ALTER TABLE hospital_history ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes
DROP POLICY IF EXISTS "Users can view hospital history" ON hospital_history;
DROP POLICY IF EXISTS "Users can insert hospital history" ON hospital_history;

-- Crear políticas más permisivas
CREATE POLICY "Enable all access for authenticated users" ON hospital_history
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 2. Hacer que la columna user_id sea nullable si no lo es
ALTER TABLE hospital_history 
ALTER COLUMN user_id DROP NOT NULL;

-- 3. Hacer que la columna reason sea nullable para activaciones
ALTER TABLE hospital_history 
ALTER COLUMN reason DROP NOT NULL;

-- 4. Verificar y ajustar las políticas de hospitals también
ALTER TABLE hospitals ENABLE ROW LEVEL SECURITY;

-- Eliminar y recrear políticas para hospitals
DROP POLICY IF EXISTS "Users can view hospitals" ON hospitals;
DROP POLICY IF EXISTS "Users can update hospitals" ON hospitals;
DROP POLICY IF EXISTS "Users can insert hospitals" ON hospitals;

CREATE POLICY "Enable read access for all users" ON hospitals
  FOR SELECT
  USING (true);

CREATE POLICY "Enable all modifications for authenticated users" ON hospitals
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 5. Verificar la estructura final
SELECT 
    'hospital_history columns:' as info,
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'hospital_history'
ORDER BY ordinal_position;