-- ========================================
-- SISTEMA SIMPLE DE AUTENTICACIÓN
-- ========================================

-- 1. TABLA DE USUARIOS (simple)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. TABLA DE HISTORIAL DE CAMBIOS EN HOSPITALES
CREATE TABLE IF NOT EXISTS hospital_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES hospitals(id),
  user_id UUID NOT NULL REFERENCES users(id),
  action TEXT NOT NULL CHECK (action IN ('activated', 'deactivated')),
  reason TEXT NOT NULL,
  previous_state BOOLEAN NOT NULL,
  new_state BOOLEAN NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. TABLA DE CONTRATOS HOSPITALARIOS
CREATE TABLE IF NOT EXISTS hospital_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES hospitals(id),
  contract_value DECIMAL(15, 2) NOT NULL,
  start_date DATE NOT NULL,
  duration_months INTEGER NOT NULL,
  current_provider TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  description TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_hospital_history_hospital_id ON hospital_history(hospital_id);
CREATE INDEX idx_hospital_contracts_hospital_id ON hospital_contracts(hospital_id);

-- ========================================
-- USUARIOS DE EJEMPLO (cambiar contraseñas)
-- ========================================
-- Contraseñas hasheadas con bcrypt (cambiar en producción)
-- admin123 = $2a$10$rBV2JDeWW3.vKyeQcM8fFO4777l4bVeQgDL6VZkqwerTHY5FGsbey
-- user123 = $2a$10$4gPHqMZDL6Bfjo.kR3DYMuqbxrIasBjUKGsXJcY35HxjDJGGJL3Fy

INSERT INTO users (email, password_hash, full_name, role) VALUES
('admin@opmap.com', '$2a$10$rBV2JDeWW3.vKyeQcM8fFO4777l4bVeQgDL6VZkqwrTHY5FGsbey', 'Administrador', 'admin'),
('usuario@opmap.com', '$2a$10$4gPHqMZDL6Bfjo.kR3DYMuqbxrIasBjUKGsXJcY35HxjDJGJL3Fy', 'Usuario', 'user')
ON CONFLICT (email) DO NOTHING;