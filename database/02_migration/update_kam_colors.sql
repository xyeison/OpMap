-- Actualizar colores de KAMs en la base de datos
-- Estos colores se usarán en el frontend para los territorios

UPDATE kams SET color = '#FF6B6B' WHERE id = 'barranquilla' OR name = 'KAM Barranquilla';
UPDATE kams SET color = '#4ECDC4' WHERE id = 'bucaramanga' OR name = 'KAM Bucaramanga';
UPDATE kams SET color = '#45B7D1' WHERE id = 'cali' OR name = 'KAM Cali';
UPDATE kams SET color = '#96CEB4' WHERE id = 'cartagena' OR name = 'KAM Cartagena';
UPDATE kams SET color = '#FECA57' WHERE id = 'cucuta' OR name = 'KAM Cúcuta';
UPDATE kams SET color = '#FF9FF3' WHERE id = 'medellin' OR name = 'KAM Medellín';
UPDATE kams SET color = '#54A0FF' WHERE id = 'monteria' OR name = 'KAM Montería';
UPDATE kams SET color = '#8B4513' WHERE id = 'neiva' OR name = 'KAM Neiva';
UPDATE kams SET color = '#1DD1A1' WHERE id = 'pasto' OR name = 'KAM Pasto';
UPDATE kams SET color = '#FF7675' WHERE id = 'pereira' OR name = 'KAM Pereira';
UPDATE kams SET color = '#A29BFE' WHERE id = 'sincelejo' OR name = 'KAM Sincelejo';
UPDATE kams SET color = '#FD79A8' WHERE id = 'chapinero' OR name = 'KAM Chapinero';
UPDATE kams SET color = '#FDCB6E' WHERE id = 'engativa' OR name = 'KAM Engativá';
UPDATE kams SET color = '#6C5CE7' WHERE id = 'sancristobal' OR name = 'KAM San Cristóbal';
UPDATE kams SET color = '#00D2D3' WHERE id = 'kennedy' OR name = 'KAM Kennedy';
UPDATE kams SET color = '#2ECC71' WHERE id = 'valledupar' OR name = 'KAM Valledupar';

-- Verificar que todos los KAMs tengan color
SELECT id, name, color FROM kams ORDER BY name;