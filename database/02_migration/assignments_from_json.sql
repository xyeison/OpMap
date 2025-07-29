-- Script de asignaciones de hospitales a KAMs
-- Generado el 2025-07-22 11:56:52
-- Fuente: ../output/opmap_google_cached_20250722_083814.json
-- Algoritmo: GoogleMapsOpMapAlgorithm
-- Total IPS: 768
-- Total KAMs: 16

-- Limpiar asignaciones existentes (opcional)
-- TRUNCATE TABLE assignments CASCADE;

-- Insertar asignaciones
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '901221353-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '890100275-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '800094898-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '900701446-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '901627949-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '900600256-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '900318964-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '802020128-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '900098008-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '800088346-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '800179966-2'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '802007056-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '802012998-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '900744456-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '900839869-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '802017597-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '900431550-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '802021332-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '900465319-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '900756475-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '900422064-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '800074742-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '800025755-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '890117677-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '901049966-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '800129856-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '802024077-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '901536799-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '900002780-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '800194798-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '901377982-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '900594169-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '890110705-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '800212086-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '890102140-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '900263250-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '900164285-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '802016761-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '802000774-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '901549486-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '800149384-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '800149384-2'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '890102768-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '890102768-2'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '901139193-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '901139193-2'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '802019573-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '900038029-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '802001084-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '901227264-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '900720497-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '900099151-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '900553752-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '806015201-3'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '900223667-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '901653898-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '900247184-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '900423126-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '901721622-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '901089614-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '901270747-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '891701664-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '900520510-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '900873344-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '901523434-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '900685946-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '901152693-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '800067515-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '901266096-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '891780185-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '800185449-2'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '900267064-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '890112801-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '802000909-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '901690556-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '900464696-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '819000364-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '900248882-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '819006339-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '800130625-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '819002176-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '901437002-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '901267161-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '900517542-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '800201726-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '819000413-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '800179966-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '819002025-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%barranquilla%' LIMIT 1)
  AND h.code = '891780008-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%bucaramanga%' LIMIT 1)
  AND h.code = '900884937-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%bucaramanga%' LIMIT 1)
  AND h.code = '800153463-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%bucaramanga%' LIMIT 1)
  AND h.code = '800084206-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%bucaramanga%' LIMIT 1)
  AND h.code = '900581702-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%bucaramanga%' LIMIT 1)
  AND h.code = '900110992-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%bucaramanga%' LIMIT 1)
  AND h.code = '900073081-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%bucaramanga%' LIMIT 1)
  AND h.code = '901809401-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%bucaramanga%' LIMIT 1)
  AND h.code = '900101736-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%bucaramanga%' LIMIT 1)
  AND h.code = '900006037-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%bucaramanga%' LIMIT 1)
  AND h.code = '901026947-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%bucaramanga%' LIMIT 1)
  AND h.code = '890208758-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%bucaramanga%' LIMIT 1)
  AND h.code = '900110631-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%bucaramanga%' LIMIT 1)
  AND h.code = '900240018-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%bucaramanga%' LIMIT 1)
  AND h.code = '901241255-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%bucaramanga%' LIMIT 1)
  AND h.code = '890209698-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%bucaramanga%' LIMIT 1)
  AND h.code = '890209698-2'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%bucaramanga%' LIMIT 1)
  AND h.code = '804014839-2'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%bucaramanga%' LIMIT 1)
  AND h.code = '900064250-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%bucaramanga%' LIMIT 1)
  AND h.code = '900772387-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%bucaramanga%' LIMIT 1)
  AND h.code = '890212568-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%bucaramanga%' LIMIT 1)
  AND h.code = '800215758-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%bucaramanga%' LIMIT 1)
  AND h.code = '900330752-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%bucaramanga%' LIMIT 1)
  AND h.code = '901547282-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%bucaramanga%' LIMIT 1)
  AND h.code = '900190045-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%bucaramanga%' LIMIT 1)
  AND h.code = '900069163-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%bucaramanga%' LIMIT 1)
  AND h.code = '800090749-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%bucaramanga%' LIMIT 1)
  AND h.code = '800255963-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%bucaramanga%' LIMIT 1)
  AND h.code = '900136865-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%bucaramanga%' LIMIT 1)
  AND h.code = '890205361-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%bucaramanga%' LIMIT 1)
  AND h.code = '900066347-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%bucaramanga%' LIMIT 1)
  AND h.code = '804010540-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%bucaramanga%' LIMIT 1)
  AND h.code = '892300445-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%bucaramanga%' LIMIT 1)
  AND h.code = '900008376-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%bucaramanga%' LIMIT 1)
  AND h.code = '800038024-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%bucaramanga%' LIMIT 1)
  AND h.code = '800197217-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%bucaramanga%' LIMIT 1)
  AND h.code = '901228997-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%bucaramanga%' LIMIT 1)
  AND h.code = '900936058-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%bucaramanga%' LIMIT 1)
  AND h.code = '900357414-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%bucaramanga%' LIMIT 1)
  AND h.code = '890202024-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%bucaramanga%' LIMIT 1)
  AND h.code = '890202024-2'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%bucaramanga%' LIMIT 1)
  AND h.code = '890212568-2'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%bucaramanga%' LIMIT 1)
  AND h.code = '890212568-3'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '890399047-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '900753224-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '830023202-2'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '900550254-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '805026771-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '890300516-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '805029464-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '805023423-3'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '901158187-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '900242742-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '901211457-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '900900754-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '901149757-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '890300513-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '900891513-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '900464965-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '900208912-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '800220806-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '900668922-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '890303841-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '900771349-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '890399020-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '800193618-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '800138186-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '901314126-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '800116511-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '901828182-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '800004579-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '900471348-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '800149384-10'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '900908245-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '800048954-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '890301430-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '900373079-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '800178948-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '805019703-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '900124603-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '900126941-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '890307200-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '800024390-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '901714987-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '890303208-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '890303461-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '805002370-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '900922290-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '800212422-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '800212422-2'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '890324177-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '890324177-2'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '900631361-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '900631361-2'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '891501676-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '817001773-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '900442930-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '805027743-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '900146633-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '800191916-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '901190692-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '891580002-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '815000316-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '805027743-4'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '891901158-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '891380054-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '891500084-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '835000972-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '817007598-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '900051107-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '891304097-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '901552405-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '900699086-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '901477409-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '800030924-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '800254141-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '900469882-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '900570697-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '900228989-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '891300047-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '817003166-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '900615608-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '901108368-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '890303208-2'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '900051107-2'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '900051107-3'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cali%' LIMIT 1)
  AND h.code = '890303208-4'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cartagena%' LIMIT 1)
  AND h.code = '901602010-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cartagena%' LIMIT 1)
  AND h.code = '800234860-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cartagena%' LIMIT 1)
  AND h.code = '805023423-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cartagena%' LIMIT 1)
  AND h.code = '890400693-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cartagena%' LIMIT 1)
  AND h.code = '900482242-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cartagena%' LIMIT 1)
  AND h.code = '900304958-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cartagena%' LIMIT 1)
  AND h.code = '890480135-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cartagena%' LIMIT 1)
  AND h.code = '900520429-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cartagena%' LIMIT 1)
  AND h.code = '900279660-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cartagena%' LIMIT 1)
  AND h.code = '900269029-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cartagena%' LIMIT 1)
  AND h.code = '806007650-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cartagena%' LIMIT 1)
  AND h.code = '900219120-3'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cartagena%' LIMIT 1)
  AND h.code = '900042103-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cartagena%' LIMIT 1)
  AND h.code = '900491883-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cartagena%' LIMIT 1)
  AND h.code = '806012426-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cartagena%' LIMIT 1)
  AND h.code = '806016797-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cartagena%' LIMIT 1)
  AND h.code = '806008439-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cartagena%' LIMIT 1)
  AND h.code = '800003765-2'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cartagena%' LIMIT 1)
  AND h.code = '901828276-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cartagena%' LIMIT 1)
  AND h.code = '806013568-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cartagena%' LIMIT 1)
  AND h.code = '860028947-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cartagena%' LIMIT 1)
  AND h.code = '900233294-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cartagena%' LIMIT 1)
  AND h.code = '900725987-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cartagena%' LIMIT 1)
  AND h.code = '900600550-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cartagena%' LIMIT 1)
  AND h.code = '806010200-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cartagena%' LIMIT 1)
  AND h.code = '901315311-2'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cartagena%' LIMIT 1)
  AND h.code = '806004548-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cartagena%' LIMIT 1)
  AND h.code = '830023202-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cartagena%' LIMIT 1)
  AND h.code = '830066626-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cartagena%' LIMIT 1)
  AND h.code = '900027397-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cartagena%' LIMIT 1)
  AND h.code = '901031682-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cartagena%' LIMIT 1)
  AND h.code = '806015201-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cartagena%' LIMIT 1)
  AND h.code = '806015201-2'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cucuta%' LIMIT 1)
  AND h.code = '890500309-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cucuta%' LIMIT 1)
  AND h.code = '900722891-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cucuta%' LIMIT 1)
  AND h.code = '890500060-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cucuta%' LIMIT 1)
  AND h.code = '900191362-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cucuta%' LIMIT 1)
  AND h.code = '807000799-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cucuta%' LIMIT 1)
  AND h.code = '900075758-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cucuta%' LIMIT 1)
  AND h.code = '890503532-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cucuta%' LIMIT 1)
  AND h.code = '800176890-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cucuta%' LIMIT 1)
  AND h.code = '900394575-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cucuta%' LIMIT 1)
  AND h.code = '800014918-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cucuta%' LIMIT 1)
  AND h.code = '900470642-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cucuta%' LIMIT 1)
  AND h.code = '807002152-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cucuta%' LIMIT 1)
  AND h.code = '900272320-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cucuta%' LIMIT 1)
  AND h.code = '900176496-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cucuta%' LIMIT 1)
  AND h.code = '800012189-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cucuta%' LIMIT 1)
  AND h.code = '901326028-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cucuta%' LIMIT 1)
  AND h.code = '900282439-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cucuta%' LIMIT 1)
  AND h.code = '890501019-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cucuta%' LIMIT 1)
  AND h.code = '901220248-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%cucuta%' LIMIT 1)
  AND h.code = '807001041-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%medellin%' LIMIT 1)
  AND h.code = '890900650-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%medellin%' LIMIT 1)
  AND h.code = '890905177-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%medellin%' LIMIT 1)
  AND h.code = '900408220-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%medellin%' LIMIT 1)
  AND h.code = '890938774-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%medellin%' LIMIT 1)
  AND h.code = '900261353-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%medellin%' LIMIT 1)
  AND h.code = '890981374-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%medellin%' LIMIT 1)
  AND h.code = '901180382-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%medellin%' LIMIT 1)
  AND h.code = '900547542-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%medellin%' LIMIT 1)
  AND h.code = '900274660-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%medellin%' LIMIT 1)
  AND h.code = '900033806-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%medellin%' LIMIT 1)
  AND h.code = '890901825-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%medellin%' LIMIT 1)
  AND h.code = '900219120-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%medellin%' LIMIT 1)
  AND h.code = '890904646-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%medellin%' LIMIT 1)
  AND h.code = '811026259-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%medellin%' LIMIT 1)
  AND h.code = '890900518-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%medellin%' LIMIT 1)
  AND h.code = '890903777-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%medellin%' LIMIT 1)
  AND h.code = '800107179-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%medellin%' LIMIT 1)
  AND h.code = '900618986-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%medellin%' LIMIT 1)
  AND h.code = '890933857-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%medellin%' LIMIT 1)
  AND h.code = '901094037-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%medellin%' LIMIT 1)
  AND h.code = '800044402-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%medellin%' LIMIT 1)
  AND h.code = '860013779-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%medellin%' LIMIT 1)
  AND h.code = '901212900-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%medellin%' LIMIT 1)
  AND h.code = '811016192-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%medellin%' LIMIT 1)
  AND h.code = '890902922-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%medellin%' LIMIT 1)
  AND h.code = '800024834-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%medellin%' LIMIT 1)
  AND h.code = '890919272-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%medellin%' LIMIT 1)
  AND h.code = '811016273-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%medellin%' LIMIT 1)
  AND h.code = '811046900-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%medellin%' LIMIT 1)
  AND h.code = '900625317-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%medellin%' LIMIT 1)
  AND h.code = '890936927-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%medellin%' LIMIT 1)
  AND h.code = '900033371-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%medellin%' LIMIT 1)
  AND h.code = '900063460-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%medellin%' LIMIT 1)
  AND h.code = '800051998-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%medellin%' LIMIT 1)
  AND h.code = '890901826-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%medellin%' LIMIT 1)
  AND h.code = '811007832-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%medellin%' LIMIT 1)
  AND h.code = '890934747-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%medellin%' LIMIT 1)
  AND h.code = '900038926-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%medellin%' LIMIT 1)
  AND h.code = '890982608-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%medellin%' LIMIT 1)
  AND h.code = '890933408-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%medellin%' LIMIT 1)
  AND h.code = '800241602-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%medellin%' LIMIT 1)
  AND h.code = '811038014-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%medellin%' LIMIT 1)
  AND h.code = '900071466-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%medellin%' LIMIT 1)
  AND h.code = '800168083-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%medellin%' LIMIT 1)
  AND h.code = '800058016-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%medellin%' LIMIT 1)
  AND h.code = '800058016-2'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%medellin%' LIMIT 1)
  AND h.code = '800067065-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%medellin%' LIMIT 1)
  AND h.code = '890905843-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%medellin%' LIMIT 1)
  AND h.code = '890905843-2'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%medellin%' LIMIT 1)
  AND h.code = '890911816-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%medellin%' LIMIT 1)
  AND h.code = '890911816-2'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%medellin%' LIMIT 1)
  AND h.code = '900438216-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%medellin%' LIMIT 1)
  AND h.code = '901597551-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%medellin%' LIMIT 1)
  AND h.code = '900421895-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%medellin%' LIMIT 1)
  AND h.code = '890981536-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%medellin%' LIMIT 1)
  AND h.code = '890982264-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%medellin%' LIMIT 1)
  AND h.code = '890905154-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%medellin%' LIMIT 1)
  AND h.code = '890939936-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%medellin%' LIMIT 1)
  AND h.code = '900857186-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%medellin%' LIMIT 1)
  AND h.code = '890907215-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%medellin%' LIMIT 1)
  AND h.code = '800092616-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%medellin%' LIMIT 1)
  AND h.code = '900236850-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%medellin%' LIMIT 1)
  AND h.code = '800190884-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%medellin%' LIMIT 1)
  AND h.code = '890907241-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%medellin%' LIMIT 1)
  AND h.code = '890980066-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%medellin%' LIMIT 1)
  AND h.code = '890906347-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%medellin%' LIMIT 1)
  AND h.code = '890981726-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%medellin%' LIMIT 1)
  AND h.code = '800123106-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%medellin%' LIMIT 1)
  AND h.code = '900245405-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%medellin%' LIMIT 1)
  AND h.code = '800146467-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%medellin%' LIMIT 1)
  AND h.code = '900226451-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%medellin%' LIMIT 1)
  AND h.code = '901273698-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%medellin%' LIMIT 1)
  AND h.code = '900699359-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%medellin%' LIMIT 1)
  AND h.code = '800067065-2'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%medellin%' LIMIT 1)
  AND h.code = '900438216-2'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%medellin%' LIMIT 1)
  AND h.code = '900699359-2'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%monteria%' LIMIT 1)
  AND h.code = '891079999-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%monteria%' LIMIT 1)
  AND h.code = '900540156-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%monteria%' LIMIT 1)
  AND h.code = '812007194-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%monteria%' LIMIT 1)
  AND h.code = '800250634-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%monteria%' LIMIT 1)
  AND h.code = '900005955-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%monteria%' LIMIT 1)
  AND h.code = '901597483-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%monteria%' LIMIT 1)
  AND h.code = '901085352-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%monteria%' LIMIT 1)
  AND h.code = '800215019-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%monteria%' LIMIT 1)
  AND h.code = '812000924-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%monteria%' LIMIT 1)
  AND h.code = '901168777-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%monteria%' LIMIT 1)
  AND h.code = '812005831-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%monteria%' LIMIT 1)
  AND h.code = '800074112-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%monteria%' LIMIT 1)
  AND h.code = '900842629-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%monteria%' LIMIT 1)
  AND h.code = '812004479-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%monteria%' LIMIT 1)
  AND h.code = '900193988-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%monteria%' LIMIT 1)
  AND h.code = '891001122-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%monteria%' LIMIT 1)
  AND h.code = '900082202-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%monteria%' LIMIT 1)
  AND h.code = '812005522-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%monteria%' LIMIT 1)
  AND h.code = '812005130-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%monteria%' LIMIT 1)
  AND h.code = '812004935-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%monteria%' LIMIT 1)
  AND h.code = '900740827-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%monteria%' LIMIT 1)
  AND h.code = '901129333-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%monteria%' LIMIT 1)
  AND h.code = '900192459-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%monteria%' LIMIT 1)
  AND h.code = '901043802-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%monteria%' LIMIT 1)
  AND h.code = '890981137-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%monteria%' LIMIT 1)
  AND h.code = '890980757-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%monteria%' LIMIT 1)
  AND h.code = '811002429-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%monteria%' LIMIT 1)
  AND h.code = '812002958-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%monteria%' LIMIT 1)
  AND h.code = '891080015-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%monteria%' LIMIT 1)
  AND h.code = '830507245-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%monteria%' LIMIT 1)
  AND h.code = '812005644-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%monteria%' LIMIT 1)
  AND h.code = '900891534-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%monteria%' LIMIT 1)
  AND h.code = '800204153-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%neiva%' LIMIT 1)
  AND h.code = '900422195-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%neiva%' LIMIT 1)
  AND h.code = '900523628-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%neiva%' LIMIT 1)
  AND h.code = '900215983-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%neiva%' LIMIT 1)
  AND h.code = '813005431-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%neiva%' LIMIT 1)
  AND h.code = '800110181-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%neiva%' LIMIT 1)
  AND h.code = '891180268-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%neiva%' LIMIT 1)
  AND h.code = '813001952-3'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%neiva%' LIMIT 1)
  AND h.code = '813001952-4'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%neiva%' LIMIT 1)
  AND h.code = '813011577-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%neiva%' LIMIT 1)
  AND h.code = '813011577-2'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%neiva%' LIMIT 1)
  AND h.code = '891180134-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%neiva%' LIMIT 1)
  AND h.code = '900471504-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%neiva%' LIMIT 1)
  AND h.code = '900718172-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%neiva%' LIMIT 1)
  AND h.code = '890701459-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%neiva%' LIMIT 1)
  AND h.code = '891180117-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%neiva%' LIMIT 1)
  AND h.code = '891180026-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%neiva%' LIMIT 1)
  AND h.code = '900807126-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%neiva%' LIMIT 1)
  AND h.code = '890701033-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%neiva%' LIMIT 1)
  AND h.code = '890701353-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pasto%' LIMIT 1)
  AND h.code = '900335692-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pasto%' LIMIT 1)
  AND h.code = '814006170-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pasto%' LIMIT 1)
  AND h.code = '814006248-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pasto%' LIMIT 1)
  AND h.code = '900900155-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pasto%' LIMIT 1)
  AND h.code = '814004714-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pasto%' LIMIT 1)
  AND h.code = '830504400-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pasto%' LIMIT 1)
  AND h.code = '891200528-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pasto%' LIMIT 1)
  AND h.code = '900335691-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pasto%' LIMIT 1)
  AND h.code = '891200240-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pasto%' LIMIT 1)
  AND h.code = '891200032-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pasto%' LIMIT 1)
  AND h.code = '900091143-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pasto%' LIMIT 1)
  AND h.code = '800176807-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pasto%' LIMIT 1)
  AND h.code = '900047319-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pasto%' LIMIT 1)
  AND h.code = '900442870-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pasto%' LIMIT 1)
  AND h.code = '891200209-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pasto%' LIMIT 1)
  AND h.code = '800084362-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pasto%' LIMIT 1)
  AND h.code = '901180926-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pasto%' LIMIT 1)
  AND h.code = '837000974-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pasto%' LIMIT 1)
  AND h.code = '891200952-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pasto%' LIMIT 1)
  AND h.code = '900077584-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pereira%' LIMIT 1)
  AND h.code = '891409981-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pereira%' LIMIT 1)
  AND h.code = '816007055-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pereira%' LIMIT 1)
  AND h.code = '801000713-3'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pereira%' LIMIT 1)
  AND h.code = '891480000-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pereira%' LIMIT 1)
  AND h.code = '891411743-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pereira%' LIMIT 1)
  AND h.code = '800222727-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pereira%' LIMIT 1)
  AND h.code = '800231235-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pereira%' LIMIT 1)
  AND h.code = '816002451-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pereira%' LIMIT 1)
  AND h.code = '816003270-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pereira%' LIMIT 1)
  AND h.code = '900797064-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pereira%' LIMIT 1)
  AND h.code = '816002834-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pereira%' LIMIT 1)
  AND h.code = '900611653-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pereira%' LIMIT 1)
  AND h.code = '901685966-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pereira%' LIMIT 1)
  AND h.code = '900189664-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pereira%' LIMIT 1)
  AND h.code = '891408586-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pereira%' LIMIT 1)
  AND h.code = '900743259-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pereira%' LIMIT 1)
  AND h.code = '900191332-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pereira%' LIMIT 1)
  AND h.code = '900342064-2'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pereira%' LIMIT 1)
  AND h.code = '900342064-3'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pereira%' LIMIT 1)
  AND h.code = '805023423-2'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pereira%' LIMIT 1)
  AND h.code = '891900343-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pereira%' LIMIT 1)
  AND h.code = '800209891-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pereira%' LIMIT 1)
  AND h.code = '900138815-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pereira%' LIMIT 1)
  AND h.code = '890801989-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pereira%' LIMIT 1)
  AND h.code = '890703630-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pereira%' LIMIT 1)
  AND h.code = '900848340-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pereira%' LIMIT 1)
  AND h.code = '901223046-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pereira%' LIMIT 1)
  AND h.code = '800112414-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pereira%' LIMIT 1)
  AND h.code = '901394627-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pereira%' LIMIT 1)
  AND h.code = '890801026-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pereira%' LIMIT 1)
  AND h.code = '805027743-3'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pereira%' LIMIT 1)
  AND h.code = '901352353-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pereira%' LIMIT 1)
  AND h.code = '891411663-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pereira%' LIMIT 1)
  AND h.code = '821003143-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pereira%' LIMIT 1)
  AND h.code = '900181419-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pereira%' LIMIT 1)
  AND h.code = '890801201-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pereira%' LIMIT 1)
  AND h.code = '801000713-2'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pereira%' LIMIT 1)
  AND h.code = '900204682-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pereira%' LIMIT 1)
  AND h.code = '800036400-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pereira%' LIMIT 1)
  AND h.code = '890804817-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pereira%' LIMIT 1)
  AND h.code = '900342064-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pereira%' LIMIT 1)
  AND h.code = '800185449-3'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pereira%' LIMIT 1)
  AND h.code = '900219120-4'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pereira%' LIMIT 1)
  AND h.code = '890706833-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pereira%' LIMIT 1)
  AND h.code = '900066955-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pereira%' LIMIT 1)
  AND h.code = '891900441-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pereira%' LIMIT 1)
  AND h.code = '809012505-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pereira%' LIMIT 1)
  AND h.code = '900850834-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pereira%' LIMIT 1)
  AND h.code = '800149384-9'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pereira%' LIMIT 1)
  AND h.code = '800000118-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pereira%' LIMIT 1)
  AND h.code = '890802036-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pereira%' LIMIT 1)
  AND h.code = '810003245-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pereira%' LIMIT 1)
  AND h.code = '901576207-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pereira%' LIMIT 1)
  AND h.code = '890801099-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pereira%' LIMIT 1)
  AND h.code = '801000713-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pereira%' LIMIT 1)
  AND h.code = '800198174-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pereira%' LIMIT 1)
  AND h.code = '800219192-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pereira%' LIMIT 1)
  AND h.code = '800185449-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pereira%' LIMIT 1)
  AND h.code = '800254132-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pereira%' LIMIT 1)
  AND h.code = '890806490-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pereira%' LIMIT 1)
  AND h.code = '800024744-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pereira%' LIMIT 1)
  AND h.code = '890807591-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pereira%' LIMIT 1)
  AND h.code = '890303461-2'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pereira%' LIMIT 1)
  AND h.code = '901403201-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%pereira%' LIMIT 1)
  AND h.code = '890303208-3'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%sincelejo%' LIMIT 1)
  AND h.code = '823002342-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%sincelejo%' LIMIT 1)
  AND h.code = '900164946-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%sincelejo%' LIMIT 1)
  AND h.code = '806016920-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%sincelejo%' LIMIT 1)
  AND h.code = '830510991-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%sincelejo%' LIMIT 1)
  AND h.code = '892280033-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%sincelejo%' LIMIT 1)
  AND h.code = '900995574-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%sincelejo%' LIMIT 1)
  AND h.code = '823003752-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%sincelejo%' LIMIT 1)
  AND h.code = '823002800-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%sincelejo%' LIMIT 1)
  AND h.code = '823002991-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%sincelejo%' LIMIT 1)
  AND h.code = '901504183-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%sincelejo%' LIMIT 1)
  AND h.code = '800183943-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%sincelejo%' LIMIT 1)
  AND h.code = '892200273-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%sincelejo%' LIMIT 1)
  AND h.code = '900073857-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%sincelejo%' LIMIT 1)
  AND h.code = '900513306-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%sincelejo%' LIMIT 1)
  AND h.code = '901439816-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%sincelejo%' LIMIT 1)
  AND h.code = '900196346-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%sincelejo%' LIMIT 1)
  AND h.code = '819001895-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%sincelejo%' LIMIT 1)
  AND h.code = '812000527-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%sincelejo%' LIMIT 1)
  AND h.code = '823004895-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%sincelejo%' LIMIT 1)
  AND h.code = '900638867-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%sincelejo%' LIMIT 1)
  AND h.code = '901639560-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%sincelejo%' LIMIT 1)
  AND h.code = '819001483-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%sincelejo%' LIMIT 1)
  AND h.code = '812003851-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%sincelejo%' LIMIT 1)
  AND h.code = '823004881-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%sincelejo%' LIMIT 1)
  AND h.code = '900558281-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%sincelejo%' LIMIT 1)
  AND h.code = '800191643-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%sincelejo%' LIMIT 1)
  AND h.code = '890480113-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%sincelejo%' LIMIT 1)
  AND h.code = '900196347-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%sincelejo%' LIMIT 1)
  AND h.code = '900196347-2'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%chapinero%' LIMIT 1)
  AND h.code = '900485519-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%chapinero%' LIMIT 1)
  AND h.code = '900291018-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%chapinero%' LIMIT 1)
  AND h.code = '830040256-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%chapinero%' LIMIT 1)
  AND h.code = '860015536-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%chapinero%' LIMIT 1)
  AND h.code = '830095073-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%chapinero%' LIMIT 1)
  AND h.code = '860073087-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%chapinero%' LIMIT 1)
  AND h.code = '901582380-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%chapinero%' LIMIT 1)
  AND h.code = '830117846-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%chapinero%' LIMIT 1)
  AND h.code = '800172517-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%chapinero%' LIMIT 1)
  AND h.code = '830005028-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%chapinero%' LIMIT 1)
  AND h.code = '830103995-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%chapinero%' LIMIT 1)
  AND h.code = '901153925-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%chapinero%' LIMIT 1)
  AND h.code = '800117564-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%chapinero%' LIMIT 1)
  AND h.code = '860002541-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%chapinero%' LIMIT 1)
  AND h.code = '901541935-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%chapinero%' LIMIT 1)
  AND h.code = '860007336-3'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%chapinero%' LIMIT 1)
  AND h.code = '860007336-4'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%chapinero%' LIMIT 1)
  AND h.code = '860013570-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%chapinero%' LIMIT 1)
  AND h.code = '860066942-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%chapinero%' LIMIT 1)
  AND h.code = '900702981-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%chapinero%' LIMIT 1)
  AND h.code = '900219120-2'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%chapinero%' LIMIT 1)
  AND h.code = '901622460-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%chapinero%' LIMIT 1)
  AND h.code = '860010783-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%chapinero%' LIMIT 1)
  AND h.code = '900578105-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%chapinero%' LIMIT 1)
  AND h.code = '860006745-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%chapinero%' LIMIT 1)
  AND h.code = '830099212-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%chapinero%' LIMIT 1)
  AND h.code = '900613550-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%chapinero%' LIMIT 1)
  AND h.code = '860502092-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%chapinero%' LIMIT 1)
  AND h.code = '830090073-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%chapinero%' LIMIT 1)
  AND h.code = '900829069-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%chapinero%' LIMIT 1)
  AND h.code = '860013779-2'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%chapinero%' LIMIT 1)
  AND h.code = '800149384-5'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%chapinero%' LIMIT 1)
  AND h.code = '800149384-8'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%chapinero%' LIMIT 1)
  AND h.code = '800227072-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%chapinero%' LIMIT 1)
  AND h.code = '860013570-3'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%chapinero%' LIMIT 1)
  AND h.code = '860066942-3'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%chapinero%' LIMIT 1)
  AND h.code = '900210981-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%chapinero%' LIMIT 1)
  AND h.code = '804014839-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%chapinero%' LIMIT 1)
  AND h.code = '899999163-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%chapinero%' LIMIT 1)
  AND h.code = '899999123-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%chapinero%' LIMIT 1)
  AND h.code = '899999017-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%chapinero%' LIMIT 1)
  AND h.code = '830507718-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '900284591-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '800149384-3'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '900971006-2'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '800099652-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '900374792-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '901145394-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '900393235-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '830073010-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '800162636-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '800017308-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '900102024-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '900098476-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '900126068-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '901002487-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '860013874-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '900385628-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '800112384-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '901254142-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '900769549-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '830078325-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '860037950-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '901216620-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '860006656-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '860035992-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '900800086-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '901138410-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '830104410-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '830005127-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '901526275-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '901249661-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '900439194-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '830113849-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '900090619-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '900582598-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '900341876-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '860514752-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '830146310-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '800006602-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '900211668-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '901060053-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '800003765-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '800149384-4'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '800149384-6'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '800149384-7'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '830507718-2'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '860007336-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '860013570-2'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '900210981-2'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '900959048-3'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '900971006-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '900971006-3'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '891855438-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '900218628-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '891800231-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '800099860-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '891856372-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '899999032-2'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '891856161-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '820003850-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '813001952-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '901339938-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '901532463-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '832003167-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '899999147-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '891856507-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '890706823-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '899999156-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '900405505-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '900531397-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '800200789-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '899999151-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '901100223-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '809011517-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '901168482-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '900371613-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '826003824-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '820001277-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '891800395-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '900817788-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '900181419-2'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '860015929-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '860024766-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '891800023-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '860013779-3'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '900171988-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '900750333-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '860009555-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '832010436-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '900419180-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '891855039-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '900529056-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '810000913-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '832004115-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '860020283-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '820001181-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%engativa%' LIMIT 1)
  AND h.code = '890700666-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%sancristobal%' LIMIT 1)
  AND h.code = '900484802-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%sancristobal%' LIMIT 1)
  AND h.code = '899999092-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%sancristobal%' LIMIT 1)
  AND h.code = '899999032-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%sancristobal%' LIMIT 1)
  AND h.code = '900959051-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%sancristobal%' LIMIT 1)
  AND h.code = '800149453-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%sancristobal%' LIMIT 1)
  AND h.code = '860007373-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%sancristobal%' LIMIT 1)
  AND h.code = '860015888-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%sancristobal%' LIMIT 1)
  AND h.code = '900959051-2'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%sancristobal%' LIMIT 1)
  AND h.code = '832001411-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%sancristobal%' LIMIT 1)
  AND h.code = '892000501-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%sancristobal%' LIMIT 1)
  AND h.code = '901421601-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%sancristobal%' LIMIT 1)
  AND h.code = '900910007-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%sancristobal%' LIMIT 1)
  AND h.code = '901041691-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%sancristobal%' LIMIT 1)
  AND h.code = '900273700-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%sancristobal%' LIMIT 1)
  AND h.code = '900213617-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%sancristobal%' LIMIT 1)
  AND h.code = '900470909-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%sancristobal%' LIMIT 1)
  AND h.code = '900958401-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%sancristobal%' LIMIT 1)
  AND h.code = '892000401-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%sancristobal%' LIMIT 1)
  AND h.code = '900148265-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%sancristobal%' LIMIT 1)
  AND h.code = '901324466-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%sancristobal%' LIMIT 1)
  AND h.code = '800162035-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%sancristobal%' LIMIT 1)
  AND h.code = '800175901-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%sancristobal%' LIMIT 1)
  AND h.code = '800175901-2'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%sancristobal%' LIMIT 1)
  AND h.code = '900958564-2'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%kennedy%' LIMIT 1)
  AND h.code = '800201496-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%kennedy%' LIMIT 1)
  AND h.code = '860090566-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%kennedy%' LIMIT 1)
  AND h.code = '800227072-2'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%kennedy%' LIMIT 1)
  AND h.code = '860007336-2'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%kennedy%' LIMIT 1)
  AND h.code = '860013570-4'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%kennedy%' LIMIT 1)
  AND h.code = '900959048-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%kennedy%' LIMIT 1)
  AND h.code = '900959048-4'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%kennedy%' LIMIT 1)
  AND h.code = '860066942-2'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%kennedy%' LIMIT 1)
  AND h.code = '900958564-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%kennedy%' LIMIT 1)
  AND h.code = '900959048-2'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%kennedy%' LIMIT 1)
  AND h.code = '890680031-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%kennedy%' LIMIT 1)
  AND h.code = '805027743-2'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%kennedy%' LIMIT 1)
  AND h.code = '800006850-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%kennedy%' LIMIT 1)
  AND h.code = '800174851-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%kennedy%' LIMIT 1)
  AND h.code = '900777755-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%kennedy%' LIMIT 1)
  AND h.code = '830104627-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%kennedy%' LIMIT 1)
  AND h.code = '890601210-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%kennedy%' LIMIT 1)
  AND h.code = '890680025-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%kennedy%' LIMIT 1)
  AND h.code = '900110940-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%kennedy%' LIMIT 1)
  AND h.code = '860007336-5'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%valledupar%' LIMIT 1)
  AND h.code = '900601052-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%valledupar%' LIMIT 1)
  AND h.code = '901781428-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%valledupar%' LIMIT 1)
  AND h.code = '892300708-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%valledupar%' LIMIT 1)
  AND h.code = '824001252-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%valledupar%' LIMIT 1)
  AND h.code = '900009080-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%valledupar%' LIMIT 1)
  AND h.code = '892300979-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%valledupar%' LIMIT 1)
  AND h.code = '900016598-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%valledupar%' LIMIT 1)
  AND h.code = '900874361-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%valledupar%' LIMIT 1)
  AND h.code = '824001041-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%valledupar%' LIMIT 1)
  AND h.code = '824002277-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%valledupar%' LIMIT 1)
  AND h.code = '901323248-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%valledupar%' LIMIT 1)
  AND h.code = '900855509-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%valledupar%' LIMIT 1)
  AND h.code = '892399994-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%valledupar%' LIMIT 1)
  AND h.code = '900008328-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%valledupar%' LIMIT 1)
  AND h.code = '900008328-2'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%valledupar%' LIMIT 1)
  AND h.code = '900957139-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%valledupar%' LIMIT 1)
  AND h.code = '901535908-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%valledupar%' LIMIT 1)
  AND h.code = '839000356-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%valledupar%' LIMIT 1)
  AND h.code = '901336751-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%valledupar%' LIMIT 1)
  AND h.code = '892115009-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%valledupar%' LIMIT 1)
  AND h.code = '900778696-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%valledupar%' LIMIT 1)
  AND h.code = '901353174-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%valledupar%' LIMIT 1)
  AND h.code = '892120115-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%valledupar%' LIMIT 1)
  AND h.code = '800193989-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%valledupar%' LIMIT 1)
  AND h.code = '900177624-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%valledupar%' LIMIT 1)
  AND h.code = '901402625-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%valledupar%' LIMIT 1)
  AND h.code = '900498069-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%valledupar%' LIMIT 1)
  AND h.code = '900214926-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%valledupar%' LIMIT 1)
  AND h.code = '825001800-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%valledupar%' LIMIT 1)
  AND h.code = '839000145-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%valledupar%' LIMIT 1)
  AND h.code = '892115010-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%valledupar%' LIMIT 1)
  AND h.code = '900138649-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%valledupar%' LIMIT 1)
  AND h.code = '892300175-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%valledupar%' LIMIT 1)
  AND h.code = '825003080-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%valledupar%' LIMIT 1)
  AND h.code = '900345765-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, NULL, 'automatic'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%valledupar%' LIMIT 1)
  AND h.code = '900139859-1'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );

-- Verificar resultados
-- SELECT COUNT(*) as total_assignments FROM assignments;
-- SELECT k.name, COUNT(a.id) as hospitals_count 
-- FROM kams k 
-- LEFT JOIN assignments a ON k.id = a.kam_id 
-- GROUP BY k.name 
-- ORDER BY hospitals_count DESC;

-- Total de asignaciones esperadas: 728
