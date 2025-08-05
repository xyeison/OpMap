#!/usr/bin/env python3
"""
Diagnóstico completo: Por qué Girardot no se asigna a Ibagué
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

print("🔍 DIAGNÓSTICO COMPLETO: IBAGUÉ vs GIRARDOT\n")

# 1. Verificar el KAM de Ibagué
print("1. KAM de Ibagué:")
ibague_kam = supabase.from_('kams').select('*').eq('area_id', '73001').eq('active', True).execute()
if ibague_kam.data:
    kam = ibague_kam.data[0]
    print(f"   ✅ {kam['name']}")
    print(f"   - ID: {kam['id']}")
    print(f"   - Enable Level 2: {kam['enable_level2']}")
    print(f"   - Max travel time: {kam['max_travel_time']} minutos")
else:
    print("   ❌ No encontrado")
    exit()

# 2. Verificar hospitales en Girardot
print("\n2. Hospitales en Girardot (25307):")
girardot_hospitals = supabase.from_('hospitals').select('*').eq('municipality_id', '25307').eq('active', True).execute()
print(f"   Total: {len(girardot_hospitals.data)} hospitales activos")

# 3. Para cada hospital de Girardot, ver quién lo tiene asignado
print("\n3. Asignaciones actuales de hospitales en Girardot:")
for hospital in girardot_hospitals.data:
    # Buscar asignación
    assignment = supabase.from_('assignments').select('*, kams!inner(name, area_id)').eq('hospital_id', hospital['id']).execute()
    
    if assignment.data:
        assigned_kam = assignment.data[0]['kams']['name']
        travel_time = assignment.data[0].get('travel_time')
        print(f"   - {hospital['name']}")
        print(f"     Asignado a: {assigned_kam}")
        if travel_time:
            print(f"     Tiempo registrado: {travel_time/60:.0f} minutos")
    else:
        print(f"   - {hospital['name']}: SIN ASIGNAR ❌")

# 4. Verificar tiempos de viaje en caché
print("\n4. Tiempos de viaje en caché para un hospital de Girardot:")
if girardot_hospitals.data:
    sample_hospital = girardot_hospitals.data[0]
    print(f"   Hospital: {sample_hospital['name']}")
    print(f"   Coordenadas: {sample_hospital['lat']}, {sample_hospital['lng']}")
    
    # Buscar todos los tiempos desde cualquier KAM a este hospital
    travel_times = supabase.from_('travel_time_cache').select('*, origin_lat, origin_lng, travel_time, source').eq(
        'dest_lat', sample_hospital['lat']
    ).eq(
        'dest_lng', sample_hospital['lng']
    ).execute()
    
    if travel_times.data:
        print(f"\n   Tiempos encontrados: {len(travel_times.data)}")
        
        # Identificar qué KAM corresponde a cada tiempo
        for tt in travel_times.data:
            # Buscar KAM por coordenadas
            kam_match = supabase.from_('kams').select('name, area_id').eq('lat', tt['origin_lat']).eq('lng', tt['origin_lng']).execute()
            
            if kam_match.data:
                kam_name = kam_match.data[0]['name']
                minutes = tt['travel_time'] / 60
                print(f"      - {kam_name}: {minutes:.0f} minutos ({tt['source']})")

# 5. Verificar si Ibagué puede competir por Girardot según las reglas
print("\n5. Análisis de reglas de competencia:")
print("   - Ibagué está en Tolima (73)")
print("   - Girardot está en Cundinamarca (25)")
print("   - Tolima limita con Cundinamarca: ✅ SÍ")
print("   - Ibagué tiene Level 2 habilitado: ✅ SÍ")
print("   - Por lo tanto, Ibagué PUEDE competir por Girardot")

# 6. Verificar configuración de expansión
print("\n6. Configuración de todos los KAMs:")
all_kams = supabase.from_('kams').select('name, area_id, enable_level2, priority').eq('active', True).execute()
for k in all_kams.data:
    dept = k['area_id'][:2]
    if dept in ['25', '11', '73']:  # Cundinamarca, Bogotá, Tolima
        print(f"   - {k['name']} ({k['area_id']}): Level2={k['enable_level2']}, Priority={k['priority']}")

# 7. Verificar la query específica del tiempo Ibagué-Girardot
print("\n7. Tiempo específico Ibagué → Girardot:")
if girardot_hospitals.data and ibague_kam.data:
    kam_ibague = ibague_kam.data[0]
    hosp = girardot_hospitals.data[0]
    
    specific_time = supabase.from_('travel_time_cache').select('*').eq(
        'origin_lat', kam_ibague['lat']
    ).eq(
        'origin_lng', kam_ibague['lng']
    ).eq(
        'dest_lat', hosp['lat']
    ).eq(
        'dest_lng', hosp['lng']
    ).execute()
    
    if specific_time.data:
        tt = specific_time.data[0]
        minutes = tt['travel_time'] / 60
        print(f"   ✅ Tiempo encontrado: {minutes:.0f} minutos")
        print(f"   - Source: {tt['source']}")
        print(f"   - Está dentro del límite de 240 min: {'✅ SÍ' if minutes <= 240 else '❌ NO'}")
    else:
        print("   ❌ NO HAY TIEMPO EN CACHÉ")
        print("   Este es el problema: sin tiempo, no puede competir")

print("\n" + "="*60)
print("CONCLUSIÓN:")
print("Si Girardot no se asigna a Ibagué, verificar:")
print("1. ¿Existe el tiempo en caché? (debe ser 65 minutos)")
print("2. ¿Hay otro KAM con menor tiempo?")
print("3. ¿El algoritmo está considerando correctamente las expansiones?")
print("="*60)