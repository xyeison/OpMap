#!/usr/bin/env python3

import os
from dotenv import load_dotenv
from supabase import create_client, Client

# Cargar variables de entorno
load_dotenv()

# Inicializar Supabase
supabase_url = os.getenv('SUPABASE_URL')
supabase_key = os.getenv('SUPABASE_ANON_KEY')
supabase: Client = create_client(supabase_url, supabase_key)

print("🔍 VERIFICANDO ESTADO DEL CACHÉ DE TIEMPOS DE VIAJE\n")

# Contar total de entradas
response = supabase.table('travel_time_cache').select('*', count='exact').execute()
total_entries = response.count
print(f"Total de entradas en caché: {total_entries}")

# Contar por fuente
google_response = supabase.table('travel_time_cache').select('*', count='exact').eq('source', 'google_maps').execute()
google_count = google_response.count
print(f"Entradas de Google Maps: {google_count}")

haversine_response = supabase.table('travel_time_cache').select('*', count='exact').eq('source', 'haversine_estimate').execute()
haversine_count = haversine_response.count
print(f"Entradas de Haversine (estimaciones): {haversine_count}")

# Verificar algunos ejemplos de Girardot
print("\n🎯 VERIFICANDO TIEMPOS A GIRARDOT (25307):")

# Buscar hospitales en Girardot
hospitals_girardot = supabase.table('hospitals').select('*').eq('municipality_id', '25307').eq('active', True).execute()
print(f"\nHospitales en Girardot: {len(hospitals_girardot.data)}")

if hospitals_girardot.data:
    # Buscar KAM de Ibagué
    kam_ibague = supabase.table('kams').select('*').eq('area_id', '73001').single().execute()
    
    if kam_ibague.data:
        print(f"\nKAM Ibagué encontrado: {kam_ibague.data['name']}")
        print(f"Ubicación: {kam_ibague.data['lat']}, {kam_ibague.data['lng']}")
        
        # Verificar si existe tiempo de viaje
        for hospital in hospitals_girardot.data[:3]:  # Primeros 3 hospitales
            cache_entry = supabase.table('travel_time_cache').select('*').eq(
                'origin_lat', round(kam_ibague.data['lat'], 6)
            ).eq(
                'origin_lng', round(kam_ibague.data['lng'], 6)
            ).eq(
                'dest_lat', round(hospital['lat'], 6)
            ).eq(
                'dest_lng', round(hospital['lng'], 6)
            ).execute()
            
            if cache_entry.data:
                time_minutes = cache_entry.data[0]['travel_time'] / 60
                source = cache_entry.data[0]['source']
                print(f"\n  {hospital['name']}:")
                print(f"    Tiempo: {time_minutes:.1f} minutos")
                print(f"    Fuente: {source}")
            else:
                print(f"\n  {hospital['name']}: SIN TIEMPO CALCULADO ❌")