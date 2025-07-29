-- Verificar el estado de los datos en todas las tablas

SELECT 'departments' as tabla, COUNT(*) as registros FROM departments
UNION ALL
SELECT 'municipalities', COUNT(*) FROM municipalities
UNION ALL
SELECT 'kams', COUNT(*) FROM kams
UNION ALL
SELECT 'hospitals', COUNT(*) FROM hospitals
UNION ALL
SELECT 'assignments', COUNT(*) FROM assignments
UNION ALL
SELECT 'travel_time_cache', COUNT(*) FROM travel_time_cache
UNION ALL
SELECT 'opportunities', COUNT(*) FROM opportunities
UNION ALL
SELECT 'department_adjacency', COUNT(*) FROM department_adjacency
ORDER BY tabla;