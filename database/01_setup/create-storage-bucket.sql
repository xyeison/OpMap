-- Crear bucket para archivos GeoJSON
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'geojson',
  'geojson', 
  true,  -- Bucket público
  52428800, -- 50MB limit
  ARRAY['application/json', 'application/geo+json']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Verificar que se creó
SELECT * FROM storage.buckets WHERE id = 'geojson';