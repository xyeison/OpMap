-- Revisar los check constraints de la tabla hospital_history
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM 
    pg_constraint
WHERE 
    conrelid = 'hospital_history'::regclass
    AND contype = 'c';

-- Ver la estructura de la tabla
\d hospital_history

-- Ver valores únicos actuales en la columna action
SELECT DISTINCT action 
FROM hospital_history 
WHERE action IS NOT NULL
ORDER BY action;

-- Intentar insertar un comentario directamente
-- INSERT INTO hospital_history (hospital_id, user_id, reason, action)
-- VALUES ('id-hospital', 'id-usuario', 'Comentario de prueba', 'updated');