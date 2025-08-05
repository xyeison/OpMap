#!/usr/bin/env python3
"""
Diagnóstico: ¿Por qué Girardot no se asigna al KAM de Ibagué?
"""

import os
from dotenv import load_dotenv
from supabase import create_client

# Cargar variables de entorno
load_dotenv()

# Configurar Supabase
url = os.getenv('SUPABASE_URL')
key = os.getenv('SUPABASE_ANON_KEY')
supabase = create_client(url, key)

print("🔍 DIAGNÓSTICO: Asignación de Girardot\n")

# 1. Verificar si existe el KAM de Ibagué
print("1. Buscando KAM de Ibagué...")
ibague_kam = supabase.from_('kams').select('*').eq('area_id', '73001').eq('active', True).execute()
if ibague_kam.data:
    kam_ibague = ibague_kam.data[0]
    print(f"   ✅ KAM encontrado: {kam_ibague['name']} (ID: {kam_ibague['id']})")
    print(f"   - Ubicación: {kam_ibague['area_id']}")
    print(f"   - Nivel 2 habilitado: {kam_ibague['enable_level2']}")
    print(f"   - Tiempo máximo: {kam_ibague['max_travel_time']} minutos")
else:
    print("   ❌ No se encontró KAM activo en Ibagué (73001)")
    exit(1)

# 2. Verificar hospitales en Girardot
print("\n2. Buscando hospitales en Girardot...")
girardot_hospitals = supabase.from_('hospitals').select('*').eq('municipality_id', '25307').eq('active', True).execute()
if girardot_hospitals.data:
    print(f"   ✅ {len(girardot_hospitals.data)} hospitales activos en Girardot:")
    for h in girardot_hospitals.data[:3]:  # Mostrar solo los primeros 3
        print(f"      - {h['name']} ({h['code']})")
else:
    print("   ❌ No se encontraron hospitales activos en Girardot")
    exit(1)

# 3. Verificar asignaciones actuales de Girardot
print("\n3. Verificando asignaciones actuales de hospitales en Girardot...")
hospital_ids = [h['id'] for h in girardot_hospitals.data]
assignments = supabase.from_('assignments').select('*, kams(name, area_id)').in_('hospital_id', hospital_ids).execute()

if assignments.data:
    kam_counts = {}
    for a in assignments.data:
        kam_name = a['kams']['name']
        kam_counts[kam_name] = kam_counts.get(kam_name, 0) + 1
    
    print("   Asignaciones actuales:")
    for kam, count in kam_counts.items():
        print(f"      - {kam}: {count} hospitales")
else:
    print("   ❌ No hay asignaciones para hospitales de Girardot")

# 4. Verificar tiempos de viaje desde Ibagué a Girardot
print("\n4. Verificando tiempos de viaje desde Ibagué a Girardot...")
if girardot_hospitals.data and kam_ibague:
    sample_hospital = girardot_hospitals.data[0]
    
    # Buscar tiempo en caché
    travel_time = supabase.from_('travel_time_cache').select('travel_time, source').eq(
        'origin_lat', kam_ibague['lat']
    ).eq(
        'origin_lng', kam_ibague['lng']
    ).eq(
        'dest_lat', sample_hospital['lat']
    ).eq(
        'dest_lng', sample_hospital['lng']
    ).execute()
    
    if travel_time.data:
        time_minutes = travel_time.data[0]['travel_time'] / 60
        source = travel_time.data[0]['source']
        print(f"   ✅ Tiempo de viaje encontrado: {time_minutes:.1f} minutos ({source})")
        if time_minutes > kam_ibague['max_travel_time']:
            print(f"   ⚠️ PROBLEMA: El tiempo excede el máximo permitido ({kam_ibague['max_travel_time']} min)")
    else:
        print("   ❌ No se encontró tiempo de viaje en caché")

# 5. Verificar otros KAMs que compiten por Girardot
print("\n5. Verificando KAMs que pueden competir por Girardot...")
# Girardot está en Cundinamarca (25)
# Departamentos que limitan con Cundinamarca: 05, 11, 15, 17, 41, 50, 73, 85

# KAMs en Cundinamarca
cundinamarca_kams = supabase.from_('kams').select('*').eq('active', True).execute()
competing_kams = []

for kam in cundinamarca_kams.data:
    dept_code = kam['area_id'][:2]
    # KAMs que pueden competir: mismo depto (25), Bogotá (11), o departamentos limítrofes
    if dept_code in ['25', '11', '05', '15', '17', '41', '50', '73', '85']:
        competing_kams.append(kam)

print(f"   Encontrados {len(competing_kams)} KAMs que pueden competir:")
for kam in competing_kams:
    print(f"      - {kam['name']} ({kam['area_id'][:2]})")

# 6. Comparar tiempos de viaje de todos los KAMs competidores
print("\n6. Comparando tiempos de viaje de KAMs competidores...")
if girardot_hospitals.data:
    sample_hospital = girardot_hospitals.data[0]
    travel_times = []
    
    for kam in competing_kams[:5]:  # Limitar a 5 para no hacer demasiadas consultas
        time_data = supabase.from_('travel_time_cache').select('travel_time').eq(
            'origin_lat', kam['lat']
        ).eq(
            'origin_lng', kam['lng']
        ).eq(
            'dest_lat', sample_hospital['lat']
        ).eq(
            'dest_lng', sample_hospital['lng']
        ).execute()
        
        if time_data.data:
            time_minutes = time_data.data[0]['travel_time'] / 60
            travel_times.append((kam['name'], time_minutes))
    
    if travel_times:
        travel_times.sort(key=lambda x: x[1])
        print("   Tiempos de viaje (ordenados):")
        for kam_name, time in travel_times:
            print(f"      - {kam_name}: {time:.1f} minutos")

print("\n🔍 CONCLUSIÓN:")
print("Si Girardot no se asigna a Ibagué, puede ser porque:")
print("1. Otro KAM tiene menor tiempo de viaje")
print("2. El tiempo desde Ibagué excede las 4 horas (240 minutos)")
print("3. No hay tiempos de viaje calculados en el caché")
print("\nEjecute el recálculo de asignaciones para actualizar.")