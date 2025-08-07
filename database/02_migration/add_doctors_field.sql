-- Agregar campo de doctores a la tabla hospitals
ALTER TABLE hospitals
ADD COLUMN IF NOT EXISTS doctors text;

-- Comentario del campo
COMMENT ON COLUMN hospitals.doctors IS 'Lista de doctores que trabajan en el hospital';