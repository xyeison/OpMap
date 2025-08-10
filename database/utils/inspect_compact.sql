-- ==================================================================
-- INSPECCIÓN ULTRA-COMPACTA: TODO EN UNA VISTA
-- ==================================================================

WITH table_details AS (
    SELECT 
        t.tablename,
        -- Conteo de columnas
        (SELECT COUNT(*) FROM information_schema.columns c 
         WHERE c.table_name = t.tablename AND c.table_schema = 'public') AS cols,
        -- Estado RLS
        CASE 
            WHEN cls.relrowsecurity THEN '✓'
            ELSE '✗'
        END AS rls,
        -- Número de políticas RLS
        (SELECT COUNT(*) FROM pg_policies p 
         WHERE p.tablename = t.tablename AND p.schemaname = 'public') AS pols,
        -- Número de índices
        (SELECT COUNT(*) FROM pg_indexes i 
         WHERE i.tablename = t.tablename AND i.schemaname = 'public') AS idxs,
        -- Número de FKs salientes
        (SELECT COUNT(*) FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
         WHERE tc.table_name = t.tablename AND tc.constraint_type = 'FOREIGN KEY') AS fks_out,
        -- Número de FKs entrantes
        (SELECT COUNT(*) FROM information_schema.table_constraints tc
         JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
         WHERE ccu.table_name = t.tablename AND tc.constraint_type = 'FOREIGN KEY' 
         AND tc.table_name != t.tablename) AS fks_in,
        -- Tamaño
        pg_size_pretty(pg_total_relation_size(cls.oid)) AS size,
        -- Filas estimadas
        pg_stat_get_live_tuples(cls.oid) AS rows,
        -- Triggers
        (SELECT COUNT(*) FROM information_schema.triggers tr 
         WHERE tr.event_object_table = t.tablename) AS trigs,
        -- Lista de columnas principales
        (SELECT string_agg(c.column_name, ', ' ORDER BY c.ordinal_position)
         FROM information_schema.columns c
         WHERE c.table_name = t.tablename AND c.table_schema = 'public'
         AND c.ordinal_position <= 5) AS main_cols
    FROM pg_tables t
    LEFT JOIN pg_class cls ON cls.relname = t.tablename 
        AND cls.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    WHERE t.schemaname = 'public'
)
SELECT 
    tablename AS "Tabla",
    cols AS "Col",
    rls AS "RLS",
    pols AS "Pol",
    idxs AS "Idx",
    fks_out || '/' || fks_in AS "FK↗/↘",
    trigs AS "Trg",
    rows AS "Filas",
    size AS "Tamaño",
    CASE 
        WHEN LENGTH(main_cols) > 30 THEN SUBSTRING(main_cols, 1, 27) || '...'
        ELSE main_cols
    END AS "Columnas principales"
FROM table_details
ORDER BY 
    CASE 
        WHEN tablename LIKE 'proveedor%' THEN 0
        WHEN tablename LIKE 'hospital%' THEN 1
        WHEN tablename = 'users' THEN 2
        WHEN tablename = 'assignments' THEN 3
        WHEN tablename = 'kams' THEN 4
        ELSE 5
    END,
    tablename;

-- ==================================================================
-- LEYENDA
-- ==================================================================
SELECT '' AS "";
SELECT 'LEYENDA: Col=Columnas, RLS=Row Level Security, Pol=Políticas, Idx=Índices, FK↗/↘=Foreign Keys (salientes/entrantes), Trg=Triggers' AS "Info";

-- ==================================================================
-- RESUMEN DE POLÍTICAS RLS (solo si hay)
-- ==================================================================
SELECT '' AS "";
SELECT 'POLÍTICAS RLS ACTIVAS:' AS "Info";
SELECT 
    tablename || ': ' || 
    string_agg(policyname || '(' || cmd || ')', ', ' ORDER BY policyname) AS "Tabla: Políticas"
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;