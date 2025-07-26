-- Habilitar RLS en la tabla hospitals si no está habilitado
ALTER TABLE hospitals ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes si existen
DROP POLICY IF EXISTS "Users can view hospitals" ON hospitals;
DROP POLICY IF EXISTS "Users can update hospitals" ON hospitals;
DROP POLICY IF EXISTS "Users can insert hospitals" ON hospitals;

-- Crear políticas para la tabla hospitals

-- Política para ver hospitales (todos los usuarios autenticados)
CREATE POLICY "Users can view hospitals" ON hospitals
  FOR SELECT
  TO authenticated
  USING (true);

-- Política para actualizar hospitales (todos los usuarios autenticados)
CREATE POLICY "Users can update hospitals" ON hospitals
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Política para insertar hospitales (todos los usuarios autenticados)
CREATE POLICY "Users can insert hospitals" ON hospitals
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- También verificar que el campo 'active' existe en la tabla hospitals
DO $$
BEGIN
    -- Si la columna active no existe, agregarla
    IF NOT EXISTS (SELECT FROM information_schema.columns 
                  WHERE table_schema = 'public' 
                  AND table_name = 'hospitals' 
                  AND column_name = 'active') THEN
        ALTER TABLE hospitals ADD COLUMN active BOOLEAN DEFAULT true;
    END IF;
END $$;