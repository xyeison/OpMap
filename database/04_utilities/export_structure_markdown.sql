-- =====================================================
-- EXPORTAR ESTRUCTURA EN FORMATO MARKDOWN
-- =====================================================
-- Genera la estructura en formato Markdown para documentación
-- =====================================================

-- Configurar salida sin bordes
\pset border 0
\pset tuples_only on
\pset format unaligned

-- Generar Markdown
SELECT '# Estructura de Base de Datos OpMap

## Tablas Principales

' || string_agg(
    '### ' || table_name || '
| Columna | Tipo | Nullable | Default |
|---------|------|----------|---------|
' || (
    SELECT string_agg(
        '| ' || column_name || 
        ' | ' || data_type || 
        CASE 
            WHEN character_maximum_length IS NOT NULL 
            THEN '(' || character_maximum_length || ')'
            WHEN numeric_precision IS NOT NULL 
            THEN '(' || numeric_precision || ',' || COALESCE(numeric_scale, 0) || ')'
            ELSE ''
        END ||
        ' | ' || is_nullable ||
        ' | ' || COALESCE(column_default, '-') || ' |',
        E'\n'
        ORDER BY ordinal_position
    )
    FROM information_schema.columns c
    WHERE c.table_name = t.table_name 
        AND c.table_schema = 'public'
), E'\n\n')
FROM information_schema.tables t
WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
GROUP BY table_schema
ORDER BY MIN(
    CASE 
        WHEN table_name LIKE 'hospital%' THEN 1
        WHEN table_name LIKE 'kam%' THEN 2
        WHEN table_name LIKE 'assignment%' THEN 3
        WHEN table_name LIKE 'travel_%' THEN 4
        ELSE 5
    END
);

-- Resetear formato
\pset border 2
\pset tuples_only off
\pset format aligned