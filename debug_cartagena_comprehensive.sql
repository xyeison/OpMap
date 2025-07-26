-- Comprehensive Debug for Cartagena KAM Issue
-- =============================================

-- 1. Check Cartagena KAM status
SELECT 
    id,
    name,
    area_id,
    active,
    enable_level2,
    max_travel_time,
    priority,
    color
FROM kams 
WHERE name = 'KAM Cartagena';

-- 2. Check if there are hospitals in Cartagena (13001)
SELECT 
    COUNT(*) as total_hospitals,
    COUNT(CASE WHEN active = true THEN 1 END) as active_hospitals,
    COUNT(CASE WHEN active = false THEN 1 END) as inactive_hospitals
FROM hospitals 
WHERE municipality_id = '13001';

-- 3. List first 10 hospitals in Cartagena
SELECT 
    code,
    name,
    active,
    department_id,
    municipality_id,
    locality_id
FROM hospitals 
WHERE municipality_id = '13001'
LIMIT 10;

-- 4. Check current assignments for Cartagena KAM
SELECT 
    k.name as kam_name,
    k.active as kam_active,
    COUNT(a.id) as total_assignments,
    COUNT(CASE WHEN a.assignment_type = 'base' THEN 1 END) as base_assignments,
    COUNT(CASE WHEN a.assignment_type = 'competitive' THEN 1 END) as competitive_assignments
FROM kams k
LEFT JOIN assignments a ON k.id = a.kam_id
WHERE k.name = 'KAM Cartagena'
GROUP BY k.id, k.name, k.active;

-- 5. Check if any other KAM has Cartagena hospitals assigned
SELECT 
    k.name as kam_name,
    k.area_id as kam_area,
    k.active as kam_active,
    COUNT(h.id) as cartagena_hospitals_count
FROM assignments a
JOIN kams k ON a.kam_id = k.id
JOIN hospitals h ON a.hospital_id = h.id
WHERE h.municipality_id = '13001'
GROUP BY k.id, k.name, k.area_id, k.active
ORDER BY cartagena_hospitals_count DESC;

-- 6. Check ALL KAMs to see their active status
SELECT 
    name,
    area_id,
    active,
    CASE 
        WHEN active = true THEN '✅ Active'
        ELSE '❌ Inactive'
    END as status
FROM kams
ORDER BY name;

-- 7. If Cartagena is inactive, here's the fix
-- UPDATE kams SET active = true WHERE name = 'KAM Cartagena';

-- 8. Check assignment creation timestamps
SELECT 
    k.name as kam_name,
    COUNT(a.id) as assignments,
    MIN(a.created_at) as first_assignment,
    MAX(a.created_at) as last_assignment
FROM kams k
LEFT JOIN assignments a ON k.id = a.kam_id
GROUP BY k.id, k.name
ORDER BY k.name;

-- 9. Debug: Show exact assignment counts by KAM including zero assignments
WITH kam_assignment_counts AS (
    SELECT 
        k.id,
        k.name,
        k.area_id,
        k.active,
        COUNT(a.id) as assignment_count
    FROM kams k
    LEFT JOIN assignments a ON k.id = a.kam_id
    GROUP BY k.id, k.name, k.area_id, k.active
)
SELECT 
    name,
    area_id,
    active,
    assignment_count,
    CASE 
        WHEN assignment_count = 0 AND active = true THEN '⚠️  Active but no assignments'
        WHEN assignment_count = 0 AND active = false THEN '❌ Inactive and no assignments'
        WHEN assignment_count > 0 AND active = true THEN '✅ Active with assignments'
        WHEN assignment_count > 0 AND active = false THEN '⚠️  Inactive but has assignments'
    END as status
FROM kam_assignment_counts
ORDER BY 
    CASE WHEN name = 'KAM Cartagena' THEN 0 ELSE 1 END,
    name;