#!/usr/bin/env python3
"""
Verificar por qué Girardot se asigna a Kennedy en lugar de Ibagué
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

print("🔍 ANÁLISIS: ¿Por qué Girardot no se asigna a Ibagué?\n")

# 1. Datos del KAM de Ibagué
print("1. KAM de Ibagué:")
ibague_kam = supabase.from_('kams').select('*').eq('area_id', '73001').eq('active', True).execute()
if ibague_kam.data:
    kam_ibague = ibague_kam.data[0]
    print(f"   ✅ {kam_ibague['name']}")
    print(f"   - ID: {kam_ibague['id']}")
    print(f"   - Coordenadas: {kam_ibague['lat']}, {kam_ibague['lng']}")

# 2. Datos del KAM Kennedy (que tiene Girardot actualmente)
print("\n2. KAM Kennedy (actual asignado):")
kennedy_kam = supabase.from_('kams').select('*').eq('area_id', '11001008').eq('active', True).execute()
if kennedy_kam.data:
    kam_kennedy = kennedy_kam.data[0]
    print(f"   ✅ {kam_kennedy['name']}")
    print(f"   - ID: {kam_kennedy['id']}")
    print(f"   - Coordenadas: {kam_kennedy['lat']}, {kam_kennedy['lng']}")

# 3. Hospital de muestra en Girardot
print("\n3. Hospital de muestra en Girardot:")
girardot_hospital = supabase.from_('hospitals').select('*').eq('municipality_id', '25307').eq('active', True).limit(1).execute()
if girardot_hospital.data:
    hospital = girardot_hospital.data[0]
    print(f"   ✅ {hospital['name']}")
    print(f"   - Coordenadas: {hospital['lat']}, {hospital['lng']}")

# 4. Buscar tiempos en caché
print("\n4. Comparación de tiempos de viaje:")

# Tiempo Ibagué -> Girardot
if ibague_kam.data and girardot_hospital.data:
    kam_ibague = ibague_kam.data[0]
    hospital = girardot_hospital.data[0]
    time_ibague = supabase.from_('travel_time_cache').select('travel_time, source').eq(
        'origin_lat', kam_ibague['lat']
    ).eq(
        'origin_lng', kam_ibague['lng']
    ).eq(
        'dest_lat', hospital['lat']
    ).eq(
        'dest_lng', hospital['lng']
    ).execute()
    
    if time_ibague.data:
        minutes = time_ibague.data[0]['travel_time'] / 60
        print(f"   Ibagué → Girardot: {minutes:.1f} minutos ({time_ibague.data[0]['source']})")
    else:
        print("   Ibagué → Girardot: NO HAY DATOS EN CACHÉ ❌")

# Tiempo Kennedy -> Girardot
if kennedy_kam.data and girardot_hospital.data:
    kam_kennedy = kennedy_kam.data[0]
    hospital = girardot_hospital.data[0]
    time_kennedy = supabase.from_('travel_time_cache').select('travel_time, source').eq(
        'origin_lat', kam_kennedy['lat']
    ).eq(
        'origin_lng', kam_kennedy['lng']
    ).eq(
        'dest_lat', hospital['lat']
    ).eq(
        'dest_lng', hospital['lng']
    ).execute()
    
    if time_kennedy.data:
        minutes = time_kennedy.data[0]['travel_time'] / 60
        print(f"   Kennedy → Girardot: {minutes:.1f} minutos ({time_kennedy.data[0]['source']})")
    else:
        print("   Kennedy → Girardot: NO HAY DATOS EN CACHÉ")

# 5. Verificar reglas de competencia
print("\n5. Análisis de reglas de competencia:")
print("   - Girardot está en Cundinamarca (25)")
print("   - Ibagué está en Tolima (73)")
print("   - Kennedy está en Bogotá (11)")
print("   - Tolima SÍ limita con Cundinamarca ✅")
print("   - Bogotá SÍ limita con Cundinamarca ✅")
print("   - Ambos KAMs pueden competir por Girardot")

# 6. Calcular distancia aproximada (Haversine)
import math

def haversine_distance(lat1, lon1, lat2, lon2):
    R = 6371  # Radio de la Tierra en km
    dLat = math.radians(lat2 - lat1)
    dLon = math.radians(lon2 - lon1)
    a = math.sin(dLat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dLon/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return R * c

if ibague_kam.data and kennedy_kam.data and girardot_hospital.data:
    kam_ibague = ibague_kam.data[0]
    kam_kennedy = kennedy_kam.data[0]
    hospital = girardot_hospital.data[0]
    dist_ibague = haversine_distance(kam_ibague['lat'], kam_ibague['lng'], hospital['lat'], hospital['lng'])
    dist_kennedy = haversine_distance(kam_kennedy['lat'], kam_kennedy['lng'], hospital['lat'], hospital['lng'])
    
    print(f"\n6. Distancias aproximadas (línea recta):")
    print(f"   - Ibagué → Girardot: {dist_ibague:.1f} km")
    print(f"   - Kennedy → Girardot: {dist_kennedy:.1f} km")
    
    # Estimar tiempo (60 km/h promedio)
    est_time_ibague = dist_ibague * 60 / 60  # minutos
    est_time_kennedy = dist_kennedy * 60 / 60  # minutos
    
    print(f"\n7. Tiempos estimados (60 km/h):")
    print(f"   - Ibagué → Girardot: {est_time_ibague:.0f} minutos")
    print(f"   - Kennedy → Girardot: {est_time_kennedy:.0f} minutos")

print("\n📊 CONCLUSIÓN:")
print("El problema probable es que:")
print("1. No hay tiempo de viaje calculado para Ibagué → Girardot")
print("2. O el tiempo calculado es incorrecto")
print("3. Necesita ejecutar el cálculo de rutas para obtener tiempos reales")
print("\nSOLUCIÓN: Ejecutar el recálculo de asignaciones desde la interfaz web")