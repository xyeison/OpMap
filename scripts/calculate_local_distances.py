#!/usr/bin/env python3
"""
Calcular distancias SOLO para hospitales nuevos a KAMs en su misma ciudad
"""
import os
from dotenv import load_dotenv
import requests
from supabase import create_client

load_dotenv()

supabase_url = 'https://norvxqgohddgsdkggqzq.supabase.co'
supabase_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vcnZ4cWdvaGRkZ3Nka2dncXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMDExMjUsImV4cCI6MjA2ODc3NzEyNX0.BRWIYeD_5OlpVKIrP1QzUmkSx6HEVGzcEUUiSK8CmJs'
google_api_key = os.getenv('GOOGLE_MAPS_API_KEY')

supabase = create_client(supabase_url, supabase_key)

# Mapeo directo de ciudades a KAMs
city_kam_map = {
    'Cartagena de Indias': ['KAM Cartagena'],
    'Cali': ['KAM Cali'],
    'Bogotá, D.C.': ['KAM Chapinero', 'KAM Engativá', 'KAM San Cristóbal', 'KAM Kennedy'],
    'Pasto': ['KAM Pasto'],
    'Sincelejo': ['KAM Sincelejo'],
    'Medellín': ['KAM Medellín'],
    'San Juan del Cesar': ['KAM Valledupar']  # Más cercano
}

# Obtener hospitales sin distancias
hospitals = supabase.table('hospitals').select('*').eq('active', True).execute()
distances = supabase.table('hospital_kam_distances').select('hospital_id').execute()
hospitals_with_distances = set(d['hospital_id'] for d in distances.data)

hospitals_without = [h for h in hospitals.data 
                    if h['id'] not in hospitals_with_distances 
                    and h['municipality_name'] in city_kam_map]

print(f"🏥 Hospitales nuevos en ciudades con KAM: {len(hospitals_without)}")

# Obtener KAMs
kams = supabase.table('kams').select('*').eq('active', True).execute()
kams_by_name = {k['name']: k for k in kams.data}

calculations = []
for hospital in hospitals_without:
    city = hospital['municipality_name']
    if city in city_kam_map:
        for kam_name in city_kam_map[city]:
            if kam_name in kams_by_name:
                calculations.append((hospital, kams_by_name[kam_name]))

print(f"📍 Cálculos necesarios: {len(calculations)}")

if calculations:
    print("\nHospitales a calcular:")
    for h, k in calculations[:10]:
        print(f"  - {k['name']} → {h['name']}")
    
    print(f"\n¿Calcular estas {len(calculations)} distancias locales? (s/n)")
    if input().lower() == 's':
        for hospital, kam in calculations:
            try:
                url = "https://maps.googleapis.com/maps/api/distancematrix/json"
                params = {
                    'origins': f"{kam['lat']},{kam['lng']}",
                    'destinations': f"{hospital['lat']},{hospital['lng']}",
                    'mode': 'driving',
                    'language': 'es',
                    'units': 'metric',
                    'key': google_api_key
                }
                
                response = requests.get(url, params=params)
                data = response.json()
                
                if data['status'] == 'OK' and data['rows'][0]['elements'][0]['status'] == 'OK':
                    element = data['rows'][0]['elements'][0]
                    
                    # Guardar en ambas tablas para compatibilidad
                    supabase.table('hospital_kam_distances').insert({
                        'hospital_id': hospital['id'],
                        'kam_id': kam['id'],
                        'travel_time': element['duration']['value'],
                        'distance': element['distance']['value'] / 1000,
                        'source': 'google_maps'
                    }).execute()
                    
                    mins = round(element['duration']['value']/60)
                    print(f"✅ {kam['name']} → {hospital['name']}: {mins} min")
                else:
                    print(f"❌ Sin ruta: {kam['name']} → {hospital['name']}")
                    
            except Exception as e:
                print(f"❌ Error: {e}")
        
        print("\n✅ Distancias locales calculadas")