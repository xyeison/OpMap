#!/usr/bin/env python3
"""
Verificar cobertura REAL de hospital_kam_distances
"""
from supabase import create_client

supabase_url = 'https://norvxqgohddgsdkggqzq.supabase.co'
supabase_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vcnZ4cWdvaGRkZ3Nka2dncXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMDExMjUsImV4cCI6MjA2ODc3NzEyNX0.BRWIYeD_5OlpVKIrP1QzUmkSx6HEVGzcEUUiSK8CmJs'

supabase = create_client(supabase_url, supabase_key)

print("📊 ANÁLISIS REAL DE COBERTURA DE DISTANCIAS")
print("="*60)

# 1. Total de hospitales activos
hospitals = supabase.table('hospitals').select('id, name, code, department_id').eq('active', True).execute()
hospital_ids = set([h['id'] for h in hospitals.data])
print(f"Total hospitales activos: {len(hospital_ids)}")

# 2. Obtener TODOS los registros de hospital_kam_distances (paginando)
print("\nCargando TODOS los registros de hospital_kam_distances...")
all_distances = []
offset = 0
batch_size = 1000

while True:
    batch = supabase.table('hospital_kam_distances').select('hospital_id, kam_id').range(offset, offset + batch_size - 1).execute()
    if not batch.data:
        break
    all_distances.extend(batch.data)
    print(f"  Cargados {len(all_distances)} registros...")
    offset += batch_size
    if len(batch.data) < batch_size:
        break

print(f"\n✅ Total registros en hospital_kam_distances: {len(all_distances)}")

# 3. Contar hospitales únicos con distancias
hospitals_with_distances = set([d['hospital_id'] for d in all_distances])
print(f"Hospitales únicos con distancias: {len(hospitals_with_distances)}")

# 4. Contar KAMs únicos
kams_with_distances = set([d['kam_id'] for d in all_distances])
print(f"KAMs únicos con distancias: {len(kams_with_distances)}")

# 5. Promedio de distancias por hospital
if len(hospitals_with_distances) > 0:
    avg_distances = len(all_distances) / len(hospitals_with_distances)
    print(f"Promedio de KAMs por hospital: {avg_distances:.1f}")

# 6. Hospitales sin distancias
hospitals_without = hospital_ids - hospitals_with_distances
print(f"\nHospitales SIN distancias: {len(hospitals_without)}")

# 7. Ver algunos hospitales sin distancias
if hospitals_without:
    print("\nEjemplos de hospitales sin distancias:")
    missing_examples = list(hospitals_without)[:5]
    for h_id in missing_examples:
        hospital = next((h for h in hospitals.data if h['id'] == h_id), None)
        if hospital:
            print(f"  - {hospital['name']} ({hospital['code']}) - Depto: {hospital['department_id']}")

# 8. Verificar el hospital específico mencionado
specific_hospital = 'cce7c25a-5565-4ca5-ad1e-a4782bf322ff'
if specific_hospital in hospitals_with_distances:
    count = len([d for d in all_distances if d['hospital_id'] == specific_hospital])
    print(f"\n✅ Hospital Clínica Porvenir tiene {count} distancias calculadas")
else:
    print(f"\n❌ Hospital Clínica Porvenir NO tiene distancias")

# 9. Ver porcentaje de cobertura REAL
coverage = (len(hospitals_with_distances) / len(hospital_ids)) * 100
print(f"\n📈 COBERTURA REAL: {coverage:.1f}%")
print(f"   {len(hospitals_with_distances)} de {len(hospital_ids)} hospitales tienen distancias")

# 10. Verificar si hay hospitales en la tabla de distancias que no están activos
orphan_hospitals = hospitals_with_distances - hospital_ids
if orphan_hospitals:
    print(f"\n⚠️ Hay {len(orphan_hospitals)} hospitales en hospital_kam_distances que no están activos")

print("\n" + "="*60)