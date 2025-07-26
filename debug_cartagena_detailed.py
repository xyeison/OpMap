#!/usr/bin/env python3
"""
Detailed debugging for Cartagena assignment issue
"""

print("🔍 CARTAGENA DEBUGGING - DETAILED ANALYSIS")
print("=" * 70)
print()

print("HYPOTHESIS 1: No hospitals in municipality 13001")
print("-" * 50)
print("Check with this query:")
print("""
SELECT 
    COUNT(*) as total,
    COUNT(CASE WHEN active = true THEN 1 END) as active,
    COUNT(CASE WHEN active = false THEN 1 END) as inactive
FROM hospitals 
WHERE municipality_id = '13001';
""")
print()

print("HYPOTHESIS 2: Hospitals exist but Cartagena KAM is not active")
print("-" * 50)
print("Check with this query:")
print("""
SELECT id, name, area_id, active 
FROM kams 
WHERE name = 'KAM Cartagena' OR area_id = '13001';
""")
print()

print("HYPOTHESIS 3: Hospitals are being assigned to other KAMs")
print("-" * 50)
print("Check which KAMs are getting Cartagena's hospitals:")
print("""
SELECT 
    k.name as kam_name,
    k.area_id as kam_location,
    h.code as hospital_code,
    h.name as hospital_name,
    a.travel_time,
    a.assignment_type
FROM assignments a
JOIN kams k ON a.kam_id = k.id
JOIN hospitals h ON a.hospital_id = h.id
WHERE h.municipality_id = '13001'
ORDER BY k.name, h.name;
""")
print()

print("HYPOTHESIS 4: Algorithm is not finding Cartagena hospitals")
print("-" * 50)
print("The algorithm has two phases:")
print()
print("Phase 1 (Territory Base): Assigns hospitals where hospital.municipality_id = kam.area_id")
print("  - For Cartagena KAM (area_id='13001'), this should find all hospitals in 13001")
print()
print("Phase 2 (Competitive): Assigns remaining hospitals based on travel time")
print("  - Only considers adjacent departments")
print()
print("Check what the algorithm sees:")
print("""
-- All active KAMs that could compete for Bolívar hospitals
SELECT name, area_id, max_travel_time, enable_level2, priority, active
FROM kams 
WHERE active = true
  AND (area_id LIKE '13%'  -- KAMs in Bolívar
    OR area_id LIKE '08%'  -- KAMs in Atlántico (adjacent to Bolívar)
    OR area_id LIKE '70%'  -- KAMs in Sucre (adjacent to Bolívar)
    OR area_id LIKE '20%'  -- KAMs in Cesar (adjacent to Bolívar)
    OR area_id LIKE '23%'  -- KAMs in Córdoba (adjacent to Bolívar)
    OR area_id LIKE '50%'  -- KAMs in Meta (adjacent to Bolívar via Antioquia)
    OR area_id LIKE '05%') -- KAMs in Antioquia (adjacent to Bolívar)
ORDER BY area_id;
""")
print()

print("CRITICAL CHECK: Look at the algorithm initialization")
print("-" * 50)
print("When the algorithm runs, it loads:")
print("1. Active KAMs: SELECT * FROM kams WHERE active = true")
print("2. Active Hospitals: SELECT * FROM hospitals WHERE active = true")
print()
print("If Cartagena KAM shows as active=false when activating, the algorithm won't see it!")
print()

print("FINAL DIAGNOSTIC QUERY:")
print("-" * 50)
print("""
WITH cartagena_data AS (
    SELECT 
        (SELECT COUNT(*) FROM hospitals WHERE municipality_id = '13001' AND active = true) as hospitals_in_13001,
        (SELECT COUNT(*) FROM kams WHERE area_id = '13001' AND active = true) as active_kams_in_13001,
        (SELECT active FROM kams WHERE name = 'KAM Cartagena' LIMIT 1) as cartagena_kam_active,
        (SELECT id FROM kams WHERE name = 'KAM Cartagena' LIMIT 1) as cartagena_kam_id
)
SELECT 
    hospitals_in_13001,
    active_kams_in_13001,
    cartagena_kam_active,
    cartagena_kam_id,
    (SELECT COUNT(*) FROM assignments WHERE kam_id = cartagena_kam_id) as cartagena_assignments
FROM cartagena_data;
""")