-- Agregar columna de rol a la tabla users si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' 
                   AND column_name = 'role') THEN
        ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT 'viewer';
    END IF;
END $$;

-- Agregar comentario descriptivo
COMMENT ON COLUMN users.role IS 'Rol del usuario: admin, sales_manager, contract_manager, data_manager, viewer';

-- Crear índice para búsquedas por rol
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Actualizar el usuario administrador existente (si existe)
UPDATE users 
SET role = 'admin' 
WHERE email = 'admin@opmap.com' OR email = 'admin@example.com';

-- Crear algunos usuarios de ejemplo con diferentes roles
INSERT INTO users (id, email, password, full_name, role, active)
VALUES 
  -- Sales Manager
  (gen_random_uuid(), 'sales.manager@opmap.com', crypt('OpMap2024!', gen_salt('bf')), 'Gerente de Ventas', 'sales_manager', true),
  
  -- Contract Manager
  (gen_random_uuid(), 'contract.manager@opmap.com', crypt('OpMap2024!', gen_salt('bf')), 'Gestor de Contratos', 'contract_manager', true),
  
  -- Data Manager
  (gen_random_uuid(), 'data.manager@opmap.com', crypt('OpMap2024!', gen_salt('bf')), 'Gestor de Datos', 'data_manager', true),
  
  -- Viewer
  (gen_random_uuid(), 'viewer@opmap.com', crypt('OpMap2024!', gen_salt('bf')), 'Usuario Consulta', 'viewer', true)
ON CONFLICT (email) DO UPDATE
SET role = EXCLUDED.role,
    full_name = EXCLUDED.full_name;

-- Crear función para verificar permisos
CREATE OR REPLACE FUNCTION check_user_permission(user_id UUID, required_permission TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    user_role VARCHAR(50);
BEGIN
    -- Obtener el rol del usuario
    SELECT role INTO user_role
    FROM users
    WHERE id = user_id AND active = true;
    
    -- Si no se encuentra el usuario o no está activo
    IF user_role IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Admin tiene todos los permisos
    IF user_role = 'admin' THEN
        RETURN TRUE;
    END IF;
    
    -- Verificar permisos específicos por rol
    CASE user_role
        WHEN 'sales_manager' THEN
            RETURN required_permission IN (
                'dashboard:view', 'map:view', 'hospitals:view', 
                'kams:view', 'kams:edit', 'contracts:view', 
                'recalculate:simple'
            );
        WHEN 'contract_manager' THEN
            RETURN required_permission IN (
                'map:view', 'contracts:view', 'contracts:edit',
                'hospitals:view', 'kams:view'
            );
        WHEN 'data_manager' THEN
            RETURN required_permission IN (
                'map:view', 'hospitals:view', 'hospitals:edit',
                'kams:view', 'kams:edit'
            );
        WHEN 'viewer' THEN
            RETURN required_permission IN ('map:view', 'hospitals:view');
        ELSE
            RETURN FALSE;
    END CASE;
END;
$$ LANGUAGE plpgsql;

-- Crear vista para obtener permisos del usuario actual
CREATE OR REPLACE VIEW user_permissions AS
SELECT 
    u.id,
    u.email,
    u.full_name,
    u.role,
    CASE 
        WHEN u.role = 'admin' THEN 
            ARRAY['dashboard:view', 'map:view', 'hospitals:view', 'hospitals:edit', 
                  'kams:view', 'kams:edit', 'contracts:view', 'contracts:edit',
                  'recalculate:simple', 'recalculate:complete', 'diagnostics:view', 
                  'users:manage']
        WHEN u.role = 'sales_manager' THEN
            ARRAY['dashboard:view', 'map:view', 'hospitals:view', 
                  'kams:view', 'kams:edit', 'contracts:view', 'recalculate:simple']
        WHEN u.role = 'contract_manager' THEN
            ARRAY['map:view', 'contracts:view', 'contracts:edit', 
                  'hospitals:view', 'kams:view']
        WHEN u.role = 'data_manager' THEN
            ARRAY['map:view', 'hospitals:view', 'hospitals:edit', 
                  'kams:view', 'kams:edit']
        WHEN u.role = 'viewer' THEN
            ARRAY['map:view', 'hospitals:view']
        ELSE
            ARRAY[]::TEXT[]
    END AS permissions
FROM users u
WHERE u.active = true;

-- Actualizar políticas RLS para considerar roles
-- Política para hospitales (ejemplo)
DROP POLICY IF EXISTS "Usuarios pueden ver hospitales según su rol" ON hospitals;
CREATE POLICY "Usuarios pueden ver hospitales según su rol" ON hospitals
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid()
            AND u.active = true
            AND (
                u.role IN ('admin', 'sales_manager', 'contract_manager', 'data_manager', 'viewer')
            )
        )
    );

DROP POLICY IF EXISTS "Usuarios pueden editar hospitales según su rol" ON hospitals;
CREATE POLICY "Usuarios pueden editar hospitales según su rol" ON hospitals
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid()
            AND u.active = true
            AND u.role IN ('admin', 'data_manager')
        )
    );

-- Mensaje de confirmación
DO $$
BEGIN
    RAISE NOTICE 'Sistema de roles configurado exitosamente';
    RAISE NOTICE 'Usuarios de prueba creados:';
    RAISE NOTICE '- admin@opmap.com (Admin)';
    RAISE NOTICE '- sales.manager@opmap.com (Sales Manager)';
    RAISE NOTICE '- contract.manager@opmap.com (Contract Manager)';
    RAISE NOTICE '- data.manager@opmap.com (Data Manager)';
    RAISE NOTICE '- viewer@opmap.com (Viewer)';
    RAISE NOTICE 'Contraseña para todos: OpMap2024!';
END $$;