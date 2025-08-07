-- =====================================================
-- EXPORTAR ESTRUCTURA EN FORMATO JSON
-- =====================================================
-- Genera la estructura completa en formato JSON
-- =====================================================

SELECT json_build_object(
    'database', current_database(),
    'generated_at', NOW(),
    'tables', (
        SELECT json_agg(
            json_build_object(
                'table_name', table_name,
                'columns', (
                    SELECT json_agg(
                        json_build_object(
                            'column_name', column_name,
                            'data_type', data_type,
                            'character_maximum_length', character_maximum_length,
                            'numeric_precision', numeric_precision,
                            'numeric_scale', numeric_scale,
                            'is_nullable', is_nullable,
                            'column_default', column_default,
                            'ordinal_position', ordinal_position
                        ) ORDER BY ordinal_position
                    )
                    FROM information_schema.columns
                    WHERE table_name = t.table_name
                        AND table_schema = 'public'
                ),
                'foreign_keys', (
                    SELECT json_agg(
                        json_build_object(
                            'column_name', kcu.column_name,
                            'foreign_table', ccu.table_name,
                            'foreign_column', ccu.column_name,
                            'constraint_name', tc.constraint_name
                        )
                    )
                    FROM information_schema.table_constraints AS tc 
                    JOIN information_schema.key_column_usage AS kcu
                        ON tc.constraint_name = kcu.constraint_name
                        AND tc.table_schema = kcu.table_schema
                    JOIN information_schema.constraint_column_usage AS ccu
                        ON ccu.constraint_name = tc.constraint_name
                    WHERE tc.constraint_type = 'FOREIGN KEY' 
                        AND tc.table_schema = 'public'
                        AND tc.table_name = t.table_name
                ),
                'indexes', (
                    SELECT json_agg(
                        json_build_object(
                            'index_name', indexname,
                            'index_definition', indexdef
                        )
                    )
                    FROM pg_indexes
                    WHERE tablename = t.table_name
                        AND schemaname = 'public'
                )
            ) ORDER BY table_name
        )
        FROM information_schema.tables t
        WHERE table_schema = 'public'
            AND table_type = 'BASE TABLE'
    ),
    'views', (
        SELECT json_agg(
            json_build_object(
                'view_name', table_name,
                'columns', (
                    SELECT json_agg(
                        json_build_object(
                            'column_name', column_name,
                            'data_type', data_type
                        ) ORDER BY ordinal_position
                    )
                    FROM information_schema.columns
                    WHERE table_name = v.table_name
                        AND table_schema = 'public'
                )
            ) ORDER BY table_name
        )
        FROM information_schema.views v
        WHERE table_schema = 'public'
    ),
    'statistics', json_build_object(
        'total_tables', (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'),
        'total_columns', (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'public'),
        'total_indexes', (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public'),
        'total_foreign_keys', (SELECT COUNT(*) FROM information_schema.table_constraints WHERE constraint_type = 'FOREIGN KEY' AND table_schema = 'public'),
        'total_views', (SELECT COUNT(*) FROM information_schema.views WHERE table_schema = 'public'),
        'database_size', pg_database_size(current_database())
    )
) AS database_structure;