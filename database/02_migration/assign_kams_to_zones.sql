-- Asignar KAMs a zonas basado en su ubicación geográfica
-- Primero, verificamos qué KAMs existen
DO $$
DECLARE
    zona_norte_id uuid;
    zona_centro_id uuid;
    zona_occidente_id uuid;
    zona_oriente_id uuid;
    zona_sur_id uuid;
BEGIN
    -- Obtener IDs de las zonas
    SELECT id INTO zona_norte_id FROM zones WHERE code = 'ZONA_NORTE';
    SELECT id INTO zona_centro_id FROM zones WHERE code = 'ZONA_CENTRO';
    SELECT id INTO zona_occidente_id FROM zones WHERE code = 'ZONA_OCCIDENTE';
    SELECT id INTO zona_oriente_id FROM zones WHERE code = 'ZONA_ORIENTE';
    SELECT id INTO zona_sur_id FROM zones WHERE code = 'ZONA_SUR';

    -- ZONA NORTE: Costa Atlántica
    -- Barranquilla, Cartagena, Montería, Sincelejo, Valledupar
    INSERT INTO zone_kams (zone_id, kam_id, is_primary)
    SELECT zona_norte_id, id, (name = 'barranquilla')
    FROM kams
    WHERE name IN ('barranquilla', 'cartagena', 'monteria', 'sincelejo', 'valledupar')
    ON CONFLICT (zone_id, kam_id) DO NOTHING;

    -- ZONA CENTRO: Bogotá y alrededores
    -- Chapinero, Engativá, San Cristóbal, Kennedy, Neiva
    INSERT INTO zone_kams (zone_id, kam_id, is_primary)
    SELECT zona_centro_id, id, (name = 'chapinero')
    FROM kams
    WHERE name IN ('chapinero', 'engativa', 'sancristobal', 'kennedy', 'neiva')
    ON CONFLICT (zone_id, kam_id) DO NOTHING;

    -- ZONA OCCIDENTE: Valle y Eje Cafetero
    -- Cali, Pereira, Medellín
    INSERT INTO zone_kams (zone_id, kam_id, is_primary)
    SELECT zona_occidente_id, id, (name = 'cali')
    FROM kams
    WHERE name IN ('cali', 'pereira', 'medellin')
    ON CONFLICT (zone_id, kam_id) DO NOTHING;

    -- ZONA ORIENTE: Santanderes
    -- Bucaramanga, Cúcuta
    INSERT INTO zone_kams (zone_id, kam_id, is_primary)
    SELECT zona_oriente_id, id, (name = 'bucaramanga')
    FROM kams
    WHERE name IN ('bucaramanga', 'cucuta')
    ON CONFLICT (zone_id, kam_id) DO NOTHING;

    -- ZONA SUR: Sur del país
    -- Pasto
    INSERT INTO zone_kams (zone_id, kam_id, is_primary)
    SELECT zona_sur_id, id, (name = 'pasto')
    FROM kams
    WHERE name = 'pasto'
    ON CONFLICT (zone_id, kam_id) DO NOTHING;

END $$;

-- Verificar las asignaciones
SELECT
    z.name as zona,
    z.color,
    COUNT(zk.kam_id) as cantidad_kams,
    STRING_AGG(k.name, ', ' ORDER BY k.name) as kams
FROM zones z
LEFT JOIN zone_kams zk ON z.id = zk.zone_id
LEFT JOIN kams k ON zk.kam_id = k.id
GROUP BY z.id, z.name, z.color
ORDER BY z.name;