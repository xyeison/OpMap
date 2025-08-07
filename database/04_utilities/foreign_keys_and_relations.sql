-- =====================================================
-- RELACIONES Y CLAVES FORÁNEAS
-- Para Supabase SQL Editor
-- =====================================================

-- Ver todas las relaciones entre tablas
SELECT 
    tc.table_name AS "Tabla Origen",
    kcu.column_name AS "Columna Origen",
    '→' AS " ",
    ccu.table_name AS "Tabla Destino",
    ccu.column_name AS "Columna Destino",
    tc.constraint_name AS "Nombre Constraint"
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;