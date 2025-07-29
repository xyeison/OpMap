-- ADVERTENCIA: Este script desactiva RLS temporalmente
-- Solo usar para pruebas y desarrollo

-- Opción 1: Desactivar RLS completamente (menos seguro)
ALTER TABLE hospitals DISABLE ROW LEVEL SECURITY;
ALTER TABLE hospital_history DISABLE ROW LEVEL SECURITY;

-- Opción 2: Forzar RLS pero con políticas muy permisivas (más seguro)
-- Primero habilitar RLS
-- ALTER TABLE hospitals ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE hospital_history ENABLE ROW LEVEL SECURITY;

-- Luego crear políticas súper permisivas
-- DROP POLICY IF EXISTS "Temporary - Allow all" ON hospitals;
-- DROP POLICY IF EXISTS "Temporary - Allow all" ON hospital_history;

-- CREATE POLICY "Temporary - Allow all" ON hospitals
--   FOR ALL
--   USING (true)
--   WITH CHECK (true);

-- CREATE POLICY "Temporary - Allow all" ON hospital_history
--   FOR ALL
--   USING (true)
--   WITH CHECK (true);

-- Para revertir y volver a habilitar RLS:
-- ALTER TABLE hospitals ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE hospital_history ENABLE ROW LEVEL SECURITY;