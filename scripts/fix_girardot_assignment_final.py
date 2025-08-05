#!/usr/bin/env python3
"""
Solución definitiva para asignar Girardot a Ibagué
1. Eliminar TODOS los tiempos incorrectos a Girardot
2. Calcular el tiempo real Ibagué-Girardot con Google Maps
3. Forzar el recálculo completo
"""

import os
import json
import requests
from dotenv import load_dotenv
from supabase import create_client

# Cargar variables de entorno
load_dotenv()

# Configurar Supabase
url = os.getenv('SUPABASE_URL')
key = os.getenv('SUPABASE_ANON_KEY')
supabase = create_client(url, key)

# API Key de Google Maps
google_api_key = os.getenv('GOOGLE_MAPS_API_KEY')

print("🎯 SOLUCIÓN DEFINITIVA: ASIGNACIÓN DE GIRARDOT A IBAGUÉ\n")

# 1. Identificar hospitales en Girardot
print("1. Identificando hospitales en Girardot...")
girardot_hospitals = supabase.from_('hospitals').select('*').eq('municipality_id', '25307').eq('active', True).execute()
print(f"   Encontrados: {len(girardot_hospitals.data)} hospitales")

if not girardot_hospitals.data:
    print("   ❌ No hay hospitales activos en Girardot")
    exit()

# 2. Eliminar TODOS los tiempos existentes a Girardot
print("\n2. Eliminando TODOS los tiempos existentes a hospitales de Girardot...")
deleted_total = 0

for hospital in girardot_hospitals.data:
    # Eliminar todos los tiempos a este hospital
    result = supabase.from_('travel_time_cache').delete().eq(
        'dest_lat', hospital['lat']
    ).eq(
        'dest_lng', hospital['lng']
    ).execute()
    
    print(f"   - {hospital['name']}: tiempos eliminados")
    deleted_total += 1

print(f"   ✅ Limpieza completa de {deleted_total} hospitales")

# 3. Obtener KAMs relevantes
print("\n3. Identificando KAMs que pueden competir por Girardot...")
all_kams = supabase.from_('kams').select('*').eq('active', True).execute()

# Filtrar KAMs que pueden competir por Girardot (Cundinamarca)
# Incluye: Bogotá (11), Cundinamarca (25), y departamentos vecinos
relevant_departments = ['11', '25', '73', '63', '15', '41']  # Bogotá, Cund., Tolima, Quindío, Boyacá, Huila
relevant_kams = [k for k in all_kams.data if k['area_id'][:2] in relevant_departments]

print(f"   KAMs relevantes: {len(relevant_kams)}")
for kam in relevant_kams:
    print(f"   - {kam['name']} ({kam['area_id']})")

# 4. Calcular tiempos reales con Google Maps
print("\n4. Calculando tiempos reales con Google Maps...")

def calculate_google_time(origin_lat, origin_lng, dest_lat, dest_lng):
    """Calcular tiempo real con Google Maps Distance Matrix API"""
    url = f"https://maps.googleapis.com/maps/api/distancematrix/json"
    params = {
        'origins': f"{origin_lat},{origin_lng}",
        'destinations': f"{dest_lat},{dest_lng}",
        'mode': 'driving',
        'language': 'es',
        'units': 'metric',
        'key': google_api_key
    }
    
    try:
        response = requests.get(url, params=params)
        data = response.json()
        
        if data['status'] == 'OK' and data['rows'][0]['elements'][0]['status'] == 'OK':
            element = data['rows'][0]['elements'][0]
            return {
                'duration': element['duration']['value'],  # segundos
                'distance': element['distance']['value'] / 1000  # km
            }
    except Exception as e:
        print(f"      Error: {e}")
    
    return None

# Calcular tiempos para cada KAM relevante a cada hospital de Girardot
calculated_count = 0

for hospital in girardot_hospitals.data:
    print(f"\n   Hospital: {hospital['name']}")
    
    for kam in relevant_kams:
        print(f"      Calculando {kam['name']} → {hospital['name']}...", end='')
        
        result = calculate_google_time(
            kam['lat'], kam['lng'],
            hospital['lat'], hospital['lng']
        )
        
        if result:
            # Insertar en caché
            supabase.from_('travel_time_cache').insert({
                'origin_lat': kam['lat'],
                'origin_lng': kam['lng'],
                'dest_lat': hospital['lat'],
                'dest_lng': hospital['lng'],
                'travel_time': result['duration'],
                'distance': result['distance'],
                'source': 'google_maps'
            }).execute()
            
            minutes = result['duration'] / 60
            print(f" {minutes:.0f} minutos ✅")
            calculated_count += 1
            
            # Pequeña pausa para no saturar la API
            import time
            time.sleep(0.5)
        else:
            print(" ERROR ❌")

print(f"\n   ✅ Total de tiempos calculados: {calculated_count}")

# 5. Verificar específicamente el tiempo Ibagué-Girardot
print("\n5. Verificación específica Ibagué → Girardot:")

ibague_kam = next((k for k in all_kams.data if k['area_id'] == '73001'), None)
if ibague_kam:
    for hospital in girardot_hospitals.data:
        time_check = supabase.from_('travel_time_cache').select('travel_time').eq(
            'origin_lat', ibague_kam['lat']
        ).eq(
            'origin_lng', ibague_kam['lng']
        ).eq(
            'dest_lat', hospital['lat']
        ).eq(
            'dest_lng', hospital['lng']
        ).execute()
        
        if time_check.data:
            minutes = time_check.data[0]['travel_time'] / 60
            print(f"   ✅ {ibague_kam['name']} → {hospital['name']}: {minutes:.0f} minutos")
        else:
            print(f"   ❌ No se calculó el tiempo para {hospital['name']}")

# 6. Forzar recálculo de asignaciones
print("\n6. Eliminando asignaciones actuales de Girardot...")

for hospital in girardot_hospitals.data:
    # Eliminar asignación actual
    supabase.from_('assignments').delete().eq('hospital_id', hospital['id']).execute()
    print(f"   - {hospital['name']}: asignación eliminada")

print("\n✅ PROCESO COMPLETADO")
print("\n💡 SIGUIENTE PASO:")
print("   1. Ejecute el recálculo desde la interfaz web")
print("   2. Girardot debería asignarse ahora a Ibagué (65 minutos)")
print("\n📊 Tiempos esperados:")
print("   - Ibagué → Girardot: ~65 minutos ✅")
print("   - Kennedy → Girardot: ~144 minutos ❌")
print("   - Chapinero → Girardot: ~120 minutos ❌")