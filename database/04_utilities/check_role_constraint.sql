-- Verificar la restricción de roles en la tabla users
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'users'::regclass
AND contype = 'c';

-- Ver todos los roles actuales en la tabla
SELECT DISTINCT role, COUNT(*) as count
FROM users
GROUP BY role
ORDER BY role;

-- Ver la estructura de la tabla users
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'users'
ORDER BY ordinal_position;