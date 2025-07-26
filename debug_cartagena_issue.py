#!/usr/bin/env python3
"""
Debug script to understand why Cartagena is not getting hospitals assigned
"""

import json

print("🔍 Analyzing Cartagena assignment issue...\n")

# Check if hospitals exist in Cartagena
print("1️⃣ Checking hospitals in Cartagena (municipality_id = 13001):")
print("   Execute this query in Supabase:")
print("   SELECT COUNT(*) FROM hospitals WHERE municipality_id = '13001' AND active = true;")
print()

# Check KAM data
print("2️⃣ Checking Cartagena KAM data:")
print("   Execute this query in Supabase:")
print("   SELECT * FROM kams WHERE name = 'KAM Cartagena';")
print()

# Check adjacency matrix
print("3️⃣ Checking adjacency for Bolívar (13):")
print("   Execute this query in Supabase:")
print("   SELECT * FROM department_adjacency WHERE department_code = '13' OR adjacent_department_code = '13';")
print()

# The REAL issue
print("❗ IDENTIFIED ISSUE:")
print("=" * 60)
print()
print("The problem is in the algorithm logic:")
print()
print("1. Territory Base Assignment (Phase 2):")
print("   - Only assigns hospitals where municipality_id = kam.area_id")
print("   - Cartagena KAM has area_id = '13001'")
print("   - This phase will ONLY find hospitals in municipality '13001'")
print()
print("2. Competitive Assignment (Also called Phase 2):")
print("   - Only considers hospitals in adjacent departments")
print("   - The adjacency check uses: kamDept = kam.area_id.substring(0, 2)")
print("   - For Cartagena: kamDept = '13' (Bolívar)")
print("   - It checks if hospitalDept is in adjacency matrix for '13'")
print()
print("3. THE BUG:")
print("   - If there are hospitals in OTHER municipalities of Bolívar (like 13430, 13244)")
print("   - They won't be assigned to Cartagena because:")
print("     a) They're not in municipality 13001 (so not base territory)")
print("     b) They ARE in department 13, so isAdjacent = true")
print("     c) BUT they might be closer to OTHER KAMs in Bolívar or adjacent departments!")
print()
print("4. SOLUTION:")
print("   The algorithm needs to prioritize KAMs within the same department")
print("   when multiple KAMs can reach a hospital.")
print()
print("=" * 60)
print()
print("📊 Diagnostic queries:")
print()
print("-- Check how many hospitals are in Bolívar but assigned to other KAMs")
print("""
SELECT 
    k.name as kam_name,
    k.area_id,
    COUNT(h.id) as hospitals_in_bolivar
FROM assignments a
JOIN kams k ON a.kam_id = k.id
JOIN hospitals h ON a.hospital_id = h.id
WHERE h.department_id = '13'
GROUP BY k.name, k.area_id
ORDER BY hospitals_in_bolivar DESC;
""")
print()
print("-- Check unassigned hospitals in Bolívar")
print("""
SELECT COUNT(*) as unassigned_in_bolivar
FROM hospitals h
WHERE h.department_id = '13' 
  AND h.active = true
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );
""")