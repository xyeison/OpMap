-- Solución para permitir comentarios en hospital_history
-- Opción 1: Modificar el check constraint para permitir 'noted'

-- Primero, ver el constraint actual
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'hospital_history'::regclass 
AND contype = 'c';

-- Si el constraint no permite 'noted', podemos:
-- 1. Eliminarlo y recrearlo con 'noted' incluido
-- 2. O usar uno de los valores existentes

-- Opción 2: Usar 'activated' o 'deactivated' temporalmente para comentarios
-- y distinguirlos por otro campo o por la ausencia de previous_state/new_state

-- Opción 3: Crear una tabla separada para comentarios
CREATE TABLE IF NOT EXISTS hospital_comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    comment TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_hospital_comments_hospital ON hospital_comments(hospital_id);
CREATE INDEX IF NOT EXISTS idx_hospital_comments_user ON hospital_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_hospital_comments_created ON hospital_comments(created_at DESC);

-- RLS policies para hospital_comments
ALTER TABLE hospital_comments ENABLE ROW LEVEL SECURITY;

-- Política para SELECT (todos pueden ver)
CREATE POLICY "Todos pueden ver comentarios" ON hospital_comments
    FOR SELECT USING (true);

-- Política para INSERT (usuarios autenticados pueden insertar)
CREATE POLICY "Usuarios autenticados pueden crear comentarios" ON hospital_comments
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Política para DELETE (solo admin o autor)
CREATE POLICY "Solo admin o autor pueden eliminar comentarios" ON hospital_comments
    FOR DELETE USING (
        auth.uid() = user_id OR 
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

-- Vista combinada de historial y comentarios
CREATE OR REPLACE VIEW hospital_activity AS
SELECT 
    'history' as type,
    h.id,
    h.hospital_id,
    h.user_id,
    h.action,
    h.reason as message,
    h.previous_state,
    h.new_state,
    h.created_at,
    u.full_name as user_name,
    u.email as user_email,
    u.role as user_role
FROM hospital_history h
LEFT JOIN users u ON h.user_id = u.id
WHERE h.action IN ('activated', 'deactivated')

UNION ALL

SELECT 
    'comment' as type,
    c.id,
    c.hospital_id,
    c.user_id,
    'noted' as action,
    c.comment as message,
    NULL as previous_state,
    NULL as new_state,
    c.created_at,
    u.full_name as user_name,
    u.email as user_email,
    u.role as user_role
FROM hospital_comments c
LEFT JOIN users u ON c.user_id = u.id

ORDER BY created_at DESC;