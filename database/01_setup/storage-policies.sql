-- Eliminar políticas existentes si las hay
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Public Upload" ON storage.objects;
DROP POLICY IF EXISTS "Public Delete" ON storage.objects;

-- Política para permitir lectura pública de archivos en el bucket 'geojson'
CREATE POLICY "Public Access" ON storage.objects
FOR SELECT
USING (bucket_id = 'geojson');

-- Política para permitir uploads anónimos al bucket 'geojson' 
CREATE POLICY "Public Upload" ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'geojson');

-- Política para permitir actualizaciones (upsert)
CREATE POLICY "Public Update" ON storage.objects
FOR UPDATE
USING (bucket_id = 'geojson')
WITH CHECK (bucket_id = 'geojson');

-- Verificar políticas
SELECT * FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage';