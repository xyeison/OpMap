-- Eliminar tabla anterior si existe
DROP TABLE IF EXISTS hospital_contracts CASCADE;
DROP TABLE IF EXISTS hospital_history CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Crear tabla de usuarios con contraseña simple (sin hash)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL, -- Contraseña en texto plano
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de historial de cambios en hospitales
CREATE TABLE IF NOT EXISTS hospital_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES hospitals(id),
  user_id UUID NOT NULL REFERENCES users(id),
  action TEXT NOT NULL CHECK (action IN ('activated', 'deactivated', 'edited')),
  reason TEXT NOT NULL,
  previous_state BOOLEAN,
  new_state BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de contratos de hospitales
CREATE TABLE IF NOT EXISTS hospital_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES hospitals(id),
  contract_value DECIMAL(15,2) NOT NULL,
  start_date DATE NOT NULL,
  duration_months INTEGER NOT NULL,
  current_provider TEXT NOT NULL,
  description TEXT,
  active BOOLEAN DEFAULT true,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insertar usuarios de ejemplo
INSERT INTO users (email, password, full_name, role, active) VALUES
  ('admin@opmap.com', 'admin123', 'Administrador OpMap', 'admin', true),
  ('usuario@opmap.com', 'user123', 'Usuario OpMap', 'user', true);

-- Crear índices
CREATE INDEX IF NOT EXISTS idx_hospital_history_hospital_id ON hospital_history(hospital_id);
CREATE INDEX IF NOT EXISTS idx_hospital_contracts_hospital_id ON hospital_contracts(hospital_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);