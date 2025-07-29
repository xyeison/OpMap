-- ========================================
-- 1. TABLA DE USUARIOS (usa Supabase Auth)
-- ========================================
-- Los usuarios se crearán usando auth.users de Supabase
-- Pero necesitamos una tabla para perfiles adicionales

CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- 2. TABLA DE HISTORIAL DE CAMBIOS EN HOSPITALES
-- ========================================
CREATE TABLE IF NOT EXISTS hospital_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL CHECK (action IN ('activated', 'deactivated')),
  reason TEXT NOT NULL,
  previous_state BOOLEAN NOT NULL,
  new_state BOOLEAN NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para búsquedas rápidas
CREATE INDEX idx_hospital_history_hospital_id ON hospital_history(hospital_id);
CREATE INDEX idx_hospital_history_user_id ON hospital_history(user_id);
CREATE INDEX idx_hospital_history_created_at ON hospital_history(created_at DESC);

-- ========================================
-- 3. TABLA DE CONTRATOS HOSPITALARIOS
-- ========================================
CREATE TABLE IF NOT EXISTS hospital_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  contract_value DECIMAL(15, 2) NOT NULL CHECK (contract_value >= 0),
  start_date DATE NOT NULL,
  duration_months INTEGER NOT NULL CHECK (duration_months > 0),
  current_provider TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_hospital_contracts_hospital_id ON hospital_contracts(hospital_id);
CREATE INDEX idx_hospital_contracts_is_active ON hospital_contracts(is_active);
CREATE INDEX idx_hospital_contracts_start_date ON hospital_contracts(start_date);

-- Función para calcular fecha de finalización
CREATE OR REPLACE FUNCTION get_contract_end_date(start_date DATE, duration_months INTEGER)
RETURNS DATE AS $$
BEGIN
  RETURN start_date + INTERVAL '1 month' * duration_months;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Vista para ver contratos con fecha de finalización calculada
CREATE OR REPLACE VIEW hospital_contracts_view AS
SELECT 
  hc.*,
  get_contract_end_date(hc.start_date, hc.duration_months) as end_date,
  h.name as hospital_name,
  h.code as hospital_code,
  h.municipality_name,
  h.department_name,
  up.full_name as created_by_name
FROM hospital_contracts hc
LEFT JOIN hospitals h ON hc.hospital_id = h.id
LEFT JOIN user_profiles up ON hc.created_by = up.id;

-- ========================================
-- 4. TRIGGER PARA ACTUALIZAR updated_at
-- ========================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_hospital_contracts_updated_at
  BEFORE UPDATE ON hospital_contracts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- 5. RLS (Row Level Security) POLICIES
-- ========================================

-- Habilitar RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE hospital_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE hospital_contracts ENABLE ROW LEVEL SECURITY;

-- Políticas para user_profiles
CREATE POLICY "Users can view all profiles" ON user_profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Only admins can insert profiles" ON user_profiles
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Políticas para hospital_history
CREATE POLICY "All authenticated users can view history" ON hospital_history
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "All authenticated users can insert history" ON hospital_history
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Políticas para hospital_contracts
CREATE POLICY "All authenticated users can view contracts" ON hospital_contracts
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "All authenticated users can insert contracts" ON hospital_contracts
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update own contracts, admins can update all" ON hospital_contracts
  FOR UPDATE USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Only admins can delete contracts" ON hospital_contracts
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ========================================
-- 6. FUNCIONES HELPER
-- ========================================

-- Función para registrar cambio de estado de hospital
CREATE OR REPLACE FUNCTION log_hospital_status_change(
  p_hospital_id UUID,
  p_user_id UUID,
  p_action TEXT,
  p_reason TEXT,
  p_new_state BOOLEAN
)
RETURNS UUID AS $$
DECLARE
  v_previous_state BOOLEAN;
  v_history_id UUID;
BEGIN
  -- Obtener estado anterior
  SELECT active INTO v_previous_state 
  FROM hospitals 
  WHERE id = p_hospital_id;
  
  -- Insertar en historial
  INSERT INTO hospital_history (
    hospital_id, user_id, action, reason, 
    previous_state, new_state
  ) VALUES (
    p_hospital_id, p_user_id, p_action, p_reason,
    v_previous_state, p_new_state
  ) RETURNING id INTO v_history_id;
  
  -- Actualizar estado del hospital
  UPDATE hospitals 
  SET active = p_new_state 
  WHERE id = p_hospital_id;
  
  RETURN v_history_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- 7. DATOS INICIALES DE EJEMPLO
-- ========================================
-- NOTA: Ejecutar esto después de crear usuarios en Supabase Auth

-- Ejemplo de cómo insertar un usuario admin (después de crearlo en Auth)
-- INSERT INTO user_profiles (id, email, full_name, role)
-- VALUES (
--   'UUID_DEL_USUARIO_AUTH',
--   'admin@opmap.com',
--   'Administrador OpMap',
--   'admin'
-- );

-- Ejemplo de contrato
-- INSERT INTO hospital_contracts (
--   hospital_id,
--   contract_value,
--   start_date,
--   duration_months,
--   current_provider,
--   description,
--   created_by
-- ) VALUES (
--   'UUID_DEL_HOSPITAL',
--   5000000.00,
--   '2024-01-01',
--   12,
--   'Proveedor Actual S.A.',
--   'Contrato de suministros médicos',
--   'UUID_DEL_USUARIO'
-- );