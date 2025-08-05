#!/usr/bin/env python3
"""
Calcular y guardar el tiempo de viaje Ibagué → Girardot
"""

import os
from dotenv import load_dotenv
from supabase import create_client
import requests

# Cargar variables de entorno
load_dotenv()

# Configurar Supabase
url = os.getenv('SUPABASE_URL')
key = os.getenv('SUPABASE_ANON_KEY')
api_key = os.getenv('GOOGLE_MAPS_API_KEY')
supabase = create_client(url, key)

print("🚗 CALCULANDO TIEMPO DE VIAJE IBAGUÉ → GIRARDOT\n")

# 1. Obtener coordenadas
ibague_kam = supabase.from_('kams').select('*').eq('area_id', '73001').eq('active', True).execute().data[0]
kennedy_kam = supabase.from_('kams').select('*').eq('area_id', '1100108').eq('active', True).execute().data[0]
hospital = supabase.from_('hospitals').select('*').eq('municipality_id', '25307').eq('active', True).limit(1).execute().data[0]

print(f"Origen: {ibague_kam['name']} ({ibague_kam['lat']}, {ibague_kam['lng']})")
print(f"Destino: {hospital['name']} ({hospital['lat']}, {hospital['lng']})")

# 2. Calcular con Google Maps
def calculate_google_time(origin_lat, origin_lng, dest_lat, dest_lng):
    url = "https://maps.googleapis.com/maps/api/distancematrix/json"
    params = {
        'origins': f"{origin_lat},{origin_lng}",
        'destinations': f"{dest_lat},{dest_lng}",
        'mode': 'driving',
        'language': 'es',
        'units': 'metric',
        'key': api_key
    }
    
    response = requests.get(url, params=params)
    data = response.json()
    
    if data['status'] == 'OK' and data['rows'][0]['elements'][0]['status'] == 'OK':
        element = data['rows'][0]['elements'][0]
        distance = element['distance']['value'] / 1000  # km
        duration = element['duration']['value']  # segundos
        return duration, distance
    return None, None

# 3. Calcular tiempos para ambos KAMs
print("\n📊 RESULTADOS:")

# Ibagué → Girardot
duration_ibague, distance_ibague = calculate_google_time(
    ibague_kam['lat'], ibague_kam['lng'],
    hospital['lat'], hospital['lng']
)

if duration_ibague:
    minutes_ibague = duration_ibague / 60
    print(f"\nIbagué → Girardot:")
    print(f"  - Distancia: {distance_ibague:.1f} km")
    print(f"  - Tiempo: {minutes_ibague:.0f} minutos ({minutes_ibague/60:.1f} horas)")
    
    # Guardar en caché
    try:
        supabase.from_('travel_time_cache').insert({
            'origin_lat': ibague_kam['lat'],
            'origin_lng': ibague_kam['lng'],
            'dest_lat': hospital['lat'],
            'dest_lng': hospital['lng'],
            'travel_time': duration_ibague,
            'distance': distance_ibague,
            'source': 'google_maps'
        }).execute()
        print("  ✅ Guardado en caché")
    except Exception as e:
        print(f"  ⚠️ Ya existe en caché o error: {e}")

# Kennedy → Girardot
duration_kennedy, distance_kennedy = calculate_google_time(
    kennedy_kam['lat'], kennedy_kam['lng'],
    hospital['lat'], hospital['lng']
)

if duration_kennedy:
    minutes_kennedy = duration_kennedy / 60
    print(f"\nKennedy → Girardot:")
    print(f"  - Distancia: {distance_kennedy:.1f} km")
    print(f"  - Tiempo: {minutes_kennedy:.0f} minutos ({minutes_kennedy/60:.1f} horas)")

# 4. Comparación
if duration_ibague and duration_kennedy:
    print("\n🏆 COMPARACIÓN:")
    print(f"  - Ibagué: {minutes_ibague:.0f} minutos")
    print(f"  - Kennedy: {minutes_kennedy:.0f} minutos")
    
    if minutes_ibague < minutes_kennedy:
        print(f"\n✅ Ibagué está {minutes_kennedy - minutes_ibague:.0f} minutos más cerca")
        print("   Girardot DEBERÍA asignarse a Ibagué")
    else:
        print(f"\n❌ Kennedy está {minutes_ibague - minutes_kennedy:.0f} minutos más cerca")
        print("   Girardot se asigna correctamente a Kennedy")
        
    if minutes_ibague > 240:
        print(f"\n⚠️ NOTA: El tiempo desde Ibagué ({minutes_ibague:.0f} min) excede el límite de 240 minutos")

print("\n💡 Ejecute el recálculo de asignaciones desde la interfaz web para actualizar")