-- Script para corregir la tabla hospital_history

-- Primero verificar si la tabla existe
DO $$
BEGIN
    -- Si la tabla existe, agregar columna changes si no existe
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'hospital_history') THEN
        -- Agregar columna changes si no existe
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                      WHERE table_schema = 'public' 
                      AND table_name = 'hospital_history' 
                      AND column_name = 'changes') THEN
            ALTER TABLE hospital_history ADD COLUMN changes JSONB;
        END IF;
    ELSE
        -- Si la tabla no existe, crearla completa
        CREATE TABLE hospital_history (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            hospital_id UUID NOT NULL REFERENCES hospitals(id),
            action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'activated', 'deactivated')),
            reason TEXT,
            changes JSONB,
            created_by UUID REFERENCES users(id),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    END IF;
END $$;

-- Crear índices si no existen
CREATE INDEX IF NOT EXISTS idx_hospital_history_hospital_id ON hospital_history(hospital_id);
CREATE INDEX IF NOT EXISTS idx_hospital_history_created_at ON hospital_history(created_at DESC);

-- Habilitar RLS
ALTER TABLE hospital_history ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes si existen
DROP POLICY IF EXISTS "Users can view hospital history" ON hospital_history;
DROP POLICY IF EXISTS "Users can insert hospital history" ON hospital_history;

-- Crear políticas
CREATE POLICY "Users can view hospital history" ON hospital_history
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert hospital history" ON hospital_history
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Comentarios
COMMENT ON TABLE hospital_history IS 'Historial de cambios en hospitales';
COMMENT ON COLUMN hospital_history.action IS 'Tipo de acción realizada';
COMMENT ON COLUMN hospital_history.reason IS 'Motivo del cambio (requerido para desactivaciones)';
COMMENT ON COLUMN hospital_history.changes IS 'Detalle de cambios realizados en formato JSON';