-- Crear tabla de historial de hospitales
CREATE TABLE IF NOT EXISTS hospital_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES hospitals(id),
  action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'activated', 'deactivated')),
  reason TEXT,
  changes JSONB,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_hospital_history_hospital_id ON hospital_history(hospital_id);
CREATE INDEX IF NOT EXISTS idx_hospital_history_created_at ON hospital_history(created_at DESC);

-- Políticas RLS
ALTER TABLE hospital_history ENABLE ROW LEVEL SECURITY;

-- Política para ver historial (todos los usuarios autenticados)
CREATE POLICY "Users can view hospital history" ON hospital_history
  FOR SELECT
  TO authenticated
  USING (true);

-- Política para insertar historial (todos los usuarios autenticados)
CREATE POLICY "Users can insert hospital history" ON hospital_history
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Comentarios
COMMENT ON TABLE hospital_history IS 'Historial de cambios en hospitales';
COMMENT ON COLUMN hospital_history.action IS 'Tipo de acción realizada';
COMMENT ON COLUMN hospital_history.reason IS 'Motivo del cambio (requerido para desactivaciones)';
COMMENT ON COLUMN hospital_history.changes IS 'Detalle de cambios realizados en formato JSON';