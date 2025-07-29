-- Agregar campos adicionales a la tabla hospitals
ALTER TABLE hospitals 
ADD COLUMN IF NOT EXISTS service_level INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS services TEXT,
ADD COLUMN IF NOT EXISTS surgeries INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS ambulances INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS municipality_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS department_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS locality_name VARCHAR(100);

-- Actualizar nombres de municipios y departamentos
UPDATE hospitals h
SET municipality_name = m.name
FROM municipalities m
WHERE h.municipality_id = m.code;

UPDATE hospitals h
SET department_name = d.name
FROM departments d
WHERE h.department_id = d.code;

-- Para localidades de Bogotá, usar el nombre de la localidad
UPDATE hospitals
SET locality_name = CASE locality_id
    WHEN '1100101' THEN 'Usaquén'
    WHEN '1100102' THEN 'Chapinero'
    WHEN '1100103' THEN 'Santa Fe'
    WHEN '1100104' THEN 'San Cristóbal'
    WHEN '1100105' THEN 'Usme'
    WHEN '1100106' THEN 'Tunjuelito'
    WHEN '1100107' THEN 'Bosa'
    WHEN '1100108' THEN 'Kennedy'
    WHEN '1100109' THEN 'Fontibón'
    WHEN '1100110' THEN 'Engativá'
    WHEN '1100111' THEN 'Suba'
    WHEN '1100112' THEN 'Barrios Unidos'
    WHEN '1100113' THEN 'Teusaquillo'
    WHEN '1100114' THEN 'Los Mártires'
    WHEN '1100115' THEN 'Antonio Nariño'
    WHEN '1100116' THEN 'Puente Aranda'
    WHEN '1100117' THEN 'La Candelaria'
    WHEN '1100118' THEN 'Rafael Uribe Uribe'
    WHEN '1100119' THEN 'Ciudad Bolívar'
    WHEN '1100120' THEN 'Sumapaz'
    ELSE locality_name
END
WHERE locality_id IS NOT NULL;