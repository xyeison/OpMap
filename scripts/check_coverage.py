#!/usr/bin/env python3
"""
Verificar cobertura de hospital_kam_distances
"""
from supabase import create_client

supabase_url = 'https://norvxqgohddgsdkggqzq.supabase.co'
supabase_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vcnZ4cWdvaGRkZ3Nka2dncXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMDExMjUsImV4cCI6MjA2ODc3NzEyNX0.BRWIYeD_5OlpVKIrP1QzUmkSx6HEVGzcEUUiSK8CmJs'

supabase = create_client(supabase_url, supabase_key)

print("📊 ANÁLISIS DE COBERTURA DE DISTANCIAS")
print("="*60)

# 1. Total de hospitales activos
hospitals = supabase.table('hospitals').select('id, name, department_id').eq('active', True).execute()
hospital_ids = set([h['id'] for h in hospitals.data])
print(f"Total hospitales activos: {len(hospital_ids)}")

# 2. Hospitales con distancias
distances = supabase.table('hospital_kam_distances').select('hospital_id').execute()
hospitals_with_distances = set([d['hospital_id'] for d in distances.data])
print(f"Hospitales con distancias: {len(hospitals_with_distances)}")

# 3. Hospitales sin distancias
hospitals_without = hospital_ids - hospitals_with_distances
print(f"Hospitales SIN distancias: {len(hospitals_without)}")

# 4. Verificar si son de departamentos excluidos
excluded = supabase.table('departments').select('code').eq('excluded', True).execute()
excluded_codes = [d['code'] for d in excluded.data] if excluded.data else []

hospitals_by_dept = {}
for h in hospitals.data:
    dept = h['department_id']
    if dept not in hospitals_by_dept:
        hospitals_by_dept[dept] = []
    hospitals_by_dept[dept].append(h['id'])

print(f"\n📍 HOSPITALES SIN DISTANCIAS POR DEPARTAMENTO:")
print("-"*40)

for dept, hosp_list in sorted(hospitals_by_dept.items()):
    without_dist = [h for h in hosp_list if h in hospitals_without]
    if without_dist:
        is_excluded = " (EXCLUIDO)" if dept in excluded_codes else ""
        print(f"Depto {dept}{is_excluded}: {len(without_dist)} de {len(hosp_list)} sin distancias")

# 5. Ver porcentaje de cobertura
coverage = (len(hospitals_with_distances) / len(hospital_ids)) * 100
print(f"\n📈 COBERTURA TOTAL: {coverage:.1f}%")

print("\n💡 CONCLUSIÓN:")
if coverage < 50:
    print("❌ La tabla hospital_kam_distances tiene muy poca cobertura")
    print("   Solo se pueden asignar los hospitales que tienen distancias calculadas")
    print("   Por eso solo se asignan 343 hospitales de 775")
else:
    print("✅ Buena cobertura de distancias")