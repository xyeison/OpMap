#!/usr/bin/env python3
"""
Calcular distancias esenciales para hospitales sin ninguna distancia
Solo calcula para KAMs en el mismo municipio/departamento
"""
import os
import sys
from dotenv import load_dotenv
import requests
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from supabase import create_client, Client

load_dotenv()

supabase_url = 'https://norvxqgohddgsdkggqzq.supabase.co'
supabase_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vcnZ4cWdvaGRkZ3Nka2dncXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMDExMjUsImV4cCI6MjA2ODc3NzEyNX0.BRWIYeD_5OlpVKIrP1QzUmkSx6HEVGzcEUUiSK8CmJs'
google_api_key = os.getenv('GOOGLE_MAPS_API_KEY')

supabase: Client = create_client(supabase_url, supabase_key)

print("🔍 Buscando hospitales sin distancias en ciudades con KAMs...")

# Hospitales sin ninguna distancia
query = """
SELECT h.id, h.code, h.name, h.lat, h.lng, h.municipality_id, h.department_id, h.municipality_name
FROM hospitals h
WHERE h.active = true
  AND NOT EXISTS (
    SELECT 1 FROM hospital_kam_distances hkd 
    WHERE hkd.hospital_id = h.id
  )
"""

hospitals_result = supabase.rpc('execute_sql', {'query': query}).execute() if False else None

# Forma alternativa sin RPC
hospitals_data = supabase.table('hospitals').select('*').eq('active', True).execute()
distances_data = supabase.table('hospital_kam_distances').select('hospital_id').execute()

hospitals_with_distances = set(d['hospital_id'] for d in distances_data.data)
hospitals_without = [h for h in hospitals_data.data if h['id'] not in hospitals_with_distances]

print(f"📊 Hospitales sin distancias: {len(hospitals_without)}")

# KAMs activos
kams = supabase.table('kams').select('*').eq('active', True).execute()
kams_by_area = {}
for kam in kams.data:
    area = kam['area_id'][:5]  # Primeros 5 dígitos para municipio
    if area not in kams_by_area:
        kams_by_area[area] = []
    kams_by_area[area].append(kam)

# Agrupar por departamento también
kams_by_dept = {}
for kam in kams.data:
    dept = kam['area_id'][:2]
    if dept not in kams_by_dept:
        kams_by_dept[dept] = []
    kams_by_dept[dept].append(kam)

# Calcular distancias esenciales
calculations_needed = []

for hospital in hospitals_without[:20]:  # Limitar a 20 hospitales
    hospital_mun = hospital['municipality_id'][:5] if hospital['municipality_id'] else None
    hospital_dept = hospital['department_id']
    
    # KAMs en el mismo municipio (prioridad 1)
    if hospital_mun and hospital_mun in kams_by_area:
        for kam in kams_by_area[hospital_mun]:
            calculations_needed.append((hospital, kam, 'mismo_municipio'))
    
    # KAMs en el mismo departamento (prioridad 2)
    elif hospital_dept in kams_by_dept:
        for kam in kams_by_dept[hospital_dept]:
            calculations_needed.append((hospital, kam, 'mismo_departamento'))

print(f"📍 Cálculos necesarios: {len(calculations_needed)}")

if calculations_needed:
    print("\nEjemplos de cálculos necesarios:")
    for h, k, tipo in calculations_needed[:5]:
        print(f"  - {k['name']} → {h['name']} ({tipo})")
    
    print(f"\n¿Calcular estas {len(calculations_needed)} distancias esenciales? (s/n)")
    if input().lower() == 's':
        calculated = 0
        failed = 0
        
        for hospital, kam, tipo in calculations_needed:
            try:
                url = f"https://maps.googleapis.com/maps/api/distancematrix/json"
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
                    travel_time = element['duration']['value']
                    distance = element['distance']['value'] / 1000
                    
                    # Guardar en hospital_kam_distances
                    result = supabase.table('hospital_kam_distances').insert({
                        'hospital_id': hospital['id'],
                        'kam_id': kam['id'],
                        'travel_time': travel_time,
                        'distance': distance,
                        'source': 'google_maps'
                    }).execute()
                    
                    calculated += 1
                    mins = round(travel_time/60)
                    print(f"✅ [{calculated}/{len(calculations_needed)}] {kam['name']} → {hospital['name']}: {mins} min")
                    
                    time.sleep(0.2)  # Pequeña pausa para no saturar la API
                else:
                    failed += 1
                    print(f"❌ No ruta: {kam['name']} → {hospital['name']}")
                    
            except Exception as e:
                failed += 1
                print(f"❌ Error: {e}")
        
        print(f"\n📊 Resumen:")
        print(f"   ✅ Calculadas: {calculated}")
        print(f"   ❌ Fallidas: {failed}")
        
        if calculated > 0:
            print("\n✨ Las distancias esenciales han sido calculadas.")
            print("   Ahora el algoritmo puede asignar estos hospitales correctamente.")