-- ========================================
-- FIX: CONFIGURACIÓN DEL BUCKET DE CONTRATOS
-- ========================================

-- 1. Primero verificar si el bucket existe
SELECT 
    id, 
    name, 
    public, 
    file_size_limit,
    allowed_mime_types
FROM storage.buckets 
WHERE id = 'contracts';

-- 2. Eliminar bucket si existe (para recrearlo correctamente)
DELETE FROM storage.buckets WHERE id = 'contracts';

-- 3. Crear bucket con configuración correcta
INSERT INTO storage.buckets (
    id, 
    name, 
    public, 
    file_size_limit, 
    allowed_mime_types,
    avif_autodetection
)
VALUES (
    'contracts',
    'contracts', 
    false,  -- Bucket privado
    10485760, -- 10MB limit
    ARRAY['application/pdf']::text[],
    false
);

-- 4. Verificar que se creó correctamente
SELECT * FROM storage.buckets WHERE id = 'contracts';

-- 5. Eliminar políticas existentes si las hay
DELETE FROM storage.policies 
WHERE bucket_id = 'contracts';

-- 6. Crear políticas RLS más permisivas para el bucket
-- Política para permitir INSERT a cualquier usuario autenticado
CREATE POLICY "contracts_insert_policy" 
ON storage.objects 
FOR INSERT 
TO authenticated
WITH CHECK (bucket_id = 'contracts');

-- Política para permitir SELECT a cualquier usuario autenticado
CREATE POLICY "contracts_select_policy" 
ON storage.objects 
FOR SELECT 
TO authenticated
USING (bucket_id = 'contracts');

-- Política para permitir UPDATE a cualquier usuario autenticado
CREATE POLICY "contracts_update_policy" 
ON storage.objects 
FOR UPDATE 
TO authenticated
USING (bucket_id = 'contracts');

-- Política para permitir DELETE a cualquier usuario autenticado
CREATE POLICY "contracts_delete_policy" 
ON storage.objects 
FOR DELETE 
TO authenticated
USING (bucket_id = 'contracts');

-- 7. Verificar las políticas
SELECT 
    name,
    action,
    bucket_id,
    definition
FROM storage.policies
WHERE bucket_id = 'contracts';

-- 8. Asegurarse de que la tabla hospital_contracts tiene las columnas necesarias
ALTER TABLE hospital_contracts 
ADD COLUMN IF NOT EXISTS pdf_url TEXT,
ADD COLUMN IF NOT EXISTS pdf_filename TEXT,
ADD COLUMN IF NOT EXISTS pdf_uploaded_at TIMESTAMP WITH TIME ZONE;

-- 9. Verificar estructura final
SELECT 
    'Bucket creado:' as info,
    id,
    name,
    public,
    file_size_limit
FROM storage.buckets 
WHERE id = 'contracts'
UNION ALL
SELECT 
    'Políticas creadas:' as info,
    COUNT(*)::text as id,
    '' as name,
    NULL as public,
    NULL as file_size_limit
FROM storage.policies 
WHERE bucket_id = 'contracts';

-- Nota: Si continúa el error, verificar en el dashboard de Supabase:
-- 1. Storage > Buckets > Verificar que existe 'contracts'
-- 2. Authentication > Policies > Verificar las políticas del bucket
-- 3. Verificar que el usuario tiene rol 'authenticated'