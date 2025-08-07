-- =====================================================
-- ESTRUCTURA COMPLETA EN FORMATO JSON
-- Para Supabase SQL Editor - Copia el resultado
-- =====================================================

SELECT json_build_object(
    'database_name', current_database(),
    'timestamp', NOW(),
    'tables', (
        SELECT json_object_agg(
            table_name,
            (
                SELECT json_agg(
                    json_build_object(
                        'name', column_name,
                        'type', data_type,
                        'max_length', character_maximum_length,
                        'nullable', is_nullable,
                        'default', column_default,
                        'position', ordinal_position
                    ) ORDER BY ordinal_position
                )
                FROM information_schema.columns
                WHERE table_name = t.table_name
                    AND table_schema = 'public'
            )
        )
        FROM information_schema.tables t
        WHERE table_schema = 'public'
            AND table_type = 'BASE TABLE'
    ),
    'summary', json_build_object(
        'total_tables', (
            SELECT COUNT(*) 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
        ),
        'total_columns', (
            SELECT COUNT(*) 
            FROM information_schema.columns 
            WHERE table_schema = 'public'
        ),
        'total_foreign_keys', (
            SELECT COUNT(*) 
            FROM information_schema.table_constraints 
            WHERE constraint_type = 'FOREIGN KEY' 
            AND table_schema = 'public'
        )
    )
) AS database_structure;