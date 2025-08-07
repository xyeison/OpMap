#!/usr/bin/env python3

import os
import requests
from dotenv import load_dotenv
from supabase import create_client, Client
import time

# Cargar variables de entorno
load_dotenv()

# Inicializar Supabase
supabase_url = os.getenv('SUPABASE_URL')
supabase_key = os.getenv('SUPABASE_ANON_KEY')
google_api_key = os.getenv('GOOGLE_MAPS_API_KEY')
supabase: Client = create_client(supabase_url, supabase_key)

print("🎯 CALCULANDO RUTAS DIRECTAMENTE PARA GIRARDOT\n")

# 1. Obtener KAMs que pueden competir
kams_response = supabase.table('kams').select('*').eq('active', True).execute()
kams = kams_response.data

# Filtrar KAMs de Cundinamarca (25), Tolima (73) y Bogotá (11)
eligible_kams = []
for kam in kams:
    dept = kam['area_id'][:2]
    if dept in ['25', '73', '11']:
        eligible_kams.append(kam)
        print(f"KAM elegible: {kam['name']} ({kam['area_id']})")

print(f"\nTotal KAMs elegibles: {len(eligible_kams)}")

# 2. Obtener hospitales de Girardot
hospitals_response = supabase.table('hospitals').select('*').eq('municipality_id', '25307').eq('active', True).execute()
hospitals = hospitals_response.data
print(f"Hospitales en Girardot: {len(hospitals)}\n")

# 3. Calcular tiempos
for kam in eligible_kams:
    for hospital in hospitals:
        # Verificar si ya existe
        existing = supabase.table('travel_time_cache').select('travel_time').eq(
            'origin_lat', round(kam['lat'], 6)
        ).eq(
            'origin_lng', round(kam['lng'], 6)
        ).eq(
            'dest_lat', round(hospital['lat'], 6)
        ).eq(
            'dest_lng', round(hospital['lng'], 6)
        ).execute()
        
        if existing.data:
            time_min = existing.data[0]['travel_time'] / 60
            print(f"✅ Ya existe: {kam['name']} → {hospital['name']}: {time_min:.0f} minutos")
            continue
        
        # Calcular con Google Maps
        print(f"📍 Calculando: {kam['name']} → {hospital['name']}...", end='', flush=True)
        
        url = f"https://maps.googleapis.com/maps/api/distancematrix/json"
        params = {
            'origins': f"{kam['lat']},{kam['lng']}",
            'destinations': f"{hospital['lat']},{hospital['lng']}",
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
                duration = element['duration']['value']  # segundos
                distance = element['distance']['value'] / 1000  # km
                
                # Guardar en Supabase
                insert_result = supabase.table('travel_time_cache').insert({
                    'origin_lat': round(kam['lat'], 6),
                    'origin_lng': round(kam['lng'], 6),
                    'dest_lat': round(hospital['lat'], 6),
                    'dest_lng': round(hospital['lng'], 6),
                    'travel_time': duration,
                    'distance': distance,
                    'source': 'google_maps'
                }).execute()
                
                print(f" ✅ {duration/60:.0f} minutos")
            else:
                print(f" ❌ Error: {data.get('status', 'Unknown')}")
        
        except Exception as e:
            print(f" ❌ Error: {str(e)}")
        
        # Pausa para no saturar la API
        time.sleep(0.2)

print("\n✅ PROCESO COMPLETADO")
print("\nAhora ejecuta el recálculo de asignaciones desde la web para que Girardot se asigne correctamente.")