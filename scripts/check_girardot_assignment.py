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

print("🎯 VERIFICANDO ASIGNACIÓN DE GIRARDOT\n")

# Buscar hospitales en Girardot
hospitals_girardot = supabase.table('hospitals').select('*').eq('municipality_id', '25307').eq('active', True).execute()
print(f"Hospitales en Girardot: {len(hospitals_girardot.data)}\n")

for hospital in hospitals_girardot.data:
    # Buscar asignación
    assignment = supabase.table('assignments').select('*, kams(name, area_id)').eq('hospital_id', hospital['id']).execute()
    
    if assignment.data:
        kam_name = assignment.data[0]['kams']['name']
        kam_area = assignment.data[0]['kams']['area_id']
        travel_time = assignment.data[0]['travel_time']
        
        print(f"Hospital: {hospital['name']}")
        print(f"  Asignado a: {kam_name} ({kam_area})")
        if travel_time:
            print(f"  Tiempo de viaje: {travel_time/60:.0f} minutos")
        else:
            print(f"  Tiempo de viaje: No calculado")
    else:
        print(f"Hospital: {hospital['name']}")
        print(f"  NO ASIGNADO ❌")
    print()

# Verificar si existe el tiempo en caché
print("\n📊 VERIFICANDO CACHÉ DE TIEMPOS:")
kam_ibague = supabase.table('kams').select('*').eq('area_id', '73001').single().execute()

if kam_ibague.data and hospitals_girardot.data:
    hospital = hospitals_girardot.data[0]  # Primer hospital
    
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
        print(f"✅ Tiempo Ibagué → {hospital['name']}: {cache_entry.data[0]['travel_time']/60:.0f} minutos")
    else:
        print(f"❌ NO existe tiempo calculado Ibagué → {hospital['name']}")