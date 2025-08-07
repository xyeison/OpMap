#!/usr/bin/env python3
"""
Verificar qué hospitales en Medellín no tienen distancias
"""
from supabase import create_client

supabase_url = 'https://norvxqgohddgsdkggqzq.supabase.co'
supabase_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vcnZ4cWdvaGRkZ3Nka2dncXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMDExMjUsImV4cCI6MjA2ODc3NzEyNX0.BRWIYeD_5OlpVKIrP1QzUmkSx6HEVGzcEUUiSK8CmJs'

supabase = create_client(supabase_url, supabase_key)

print("🔍 Buscando hospitales en Medellín sin distancias...")
print("="*60)

# 1. Obtener hospitales de Medellín
hospitals_medellin = supabase.table('hospitals').select('*').eq('active', True).eq('municipality_id', '05001').execute()
print(f"\n📊 Total hospitales en Medellín: {len(hospitals_medellin.data)}")

# 2. Obtener distancias existentes
distances = supabase.table('hospital_kam_distances').select('hospital_id').execute()
hospitals_with_distances = set(d['hospital_id'] for d in distances.data)

# 3. Clasificar hospitales
hospitals_without_distances = []
hospitals_with_distances_list = []

for hospital in hospitals_medellin.data:
    if hospital['id'] in hospitals_with_distances:
        hospitals_with_distances_list.append(hospital)
    else:
        hospitals_without_distances.append(hospital)

print(f"✅ Con distancias: {len(hospitals_with_distances_list)}")
print(f"❌ Sin distancias: {len(hospitals_without_distances)}")

# 4. Mostrar hospitales sin distancias
if hospitals_without_distances:
    print(f"\n❌ HOSPITALES EN MEDELLÍN SIN DISTANCIAS ({len(hospitals_without_distances)}):")
    print("-"*60)
    for i, hospital in enumerate(hospitals_without_distances, 1):
        print(f"\n{i}. {hospital['name']}")
        print(f"   Código: {hospital['code']}")
        print(f"   Dirección: {hospital.get('address', 'No disponible')}")
        print(f"   Camas: {hospital.get('beds', 0)}")
        print(f"   ID: {hospital['id']}")
else:
    print("\n✅ Todos los hospitales en Medellín tienen al menos una distancia calculada")

# 5. Verificar si el KAM de Medellín existe y está activo
kam_medellin = supabase.table('kams').select('*').eq('area_id', '05001').execute()
if kam_medellin.data:
    kam = kam_medellin.data[0]
    print(f"\n📍 KAM de Medellín:")
    print(f"   Nombre: {kam['name']}")
    print(f"   Activo: {kam['active']}")
    print(f"   ID: {kam['id']}")
    
    # Nota importante
    print(f"\n⚠️ NOTA IMPORTANTE:")
    print(f"   Los {len(hospitals_without_distances)} hospitales en Medellín están en el")
    print(f"   territorio base del KAM Medellín, por lo que NO necesitan distancia")
    print(f"   calculada a él (es automática/instantánea).")
    print(f"   ")
    print(f"   Sin embargo, SÍ necesitan distancias a KAMs competidores de:")
    print(f"   - Departamentos fronterizos (Córdoba, Bolívar, Santander, etc.)")
    print(f"   - Departamentos de nivel 2 si enable_level2=true")
else:
    print("\n⚠️ No hay KAM asignado a Medellín (05001)")