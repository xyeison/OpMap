#!/usr/bin/env python3
"""
Verificación real de los datos en hospital_kam_distances
"""
from supabase import create_client

supabase_url = 'https://norvxqgohddgsdkggqzq.supabase.co'
supabase_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vcnZ4cWdvaGRkZ3Nka2dncXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMDExMjUsImV4cCI6MjA2ODc3NzEyNX0.BRWIYeD_5OlpVKIrP1QzUmkSx6HEVGzcEUUiSK8CmJs'

supabase = create_client(supabase_url, supabase_key)

print("🔍 VERIFICACIÓN REAL DE DATOS")
print("="*60)

# 1. Contar KAMs activos
print("\n📊 KAMs:")
kams = supabase.table('kams').select('id, name, active').execute()
active_kams = [k for k in kams.data if k.get('active', True)]
print(f"   Total KAMs: {len(kams.data)}")
print(f"   KAMs activos: {len(active_kams)}")
for k in kams.data:
    print(f"   • {k['name']:20} - Activo: {k.get('active', True)}")

# 2. Contar hospitales activos
print("\n📊 Hospitales:")
hospitals_count = supabase.table('hospitals').select('id', count='exact').eq('active', True).execute()
print(f"   Hospitales activos: {hospitals_count.count}")

# 3. Contar registros en hospital_kam_distances
print("\n📊 Tabla hospital_kam_distances:")
distances_count = supabase.table('hospital_kam_distances').select('id', count='exact').execute()
print(f"   Total registros: {distances_count.count}")

# Obtener una muestra para ver la estructura
sample = supabase.table('hospital_kam_distances').select('*').limit(5).execute()
print("\n   Muestra de registros:")
for d in sample.data:
    print(f"   • travel_time: {d.get('travel_time')} | distance: {d.get('distance')}")

# 4. Contar registros por KAM
print("\n📊 Registros por KAM en hospital_kam_distances:")
for kam in active_kams:
    count = supabase.table('hospital_kam_distances').select('id', count='exact').eq('kam_id', kam['id']).execute()
    print(f"   {kam['name']:20} - {count.count:4} registros")

# 5. Contar hospitales únicos en hospital_kam_distances
print("\n📊 Hospitales únicos en hospital_kam_distances:")
# Obtener todos los hospital_ids únicos
all_distances = supabase.table('hospital_kam_distances').select('hospital_id').execute()
unique_hospitals = set(d['hospital_id'] for d in all_distances.data)
print(f"   Hospitales con al menos 1 distancia: {len(unique_hospitals)}")

# 6. Cálculo correcto
print("\n📊 CÁLCULOS CORRECTOS:")
print("-"*40)
total_expected = hospitals_count.count * len(active_kams)
print(f"   Combinaciones esperadas: {total_expected:,}")
print(f"   Combinaciones existentes: {distances_count.count:,}")
print(f"   Combinaciones faltantes: {total_expected - distances_count.count:,}")
print(f"   Porcentaje completado: {(distances_count.count/total_expected)*100:.1f}%")

print("\n" + "="*60)