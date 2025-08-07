#!/usr/bin/env python3
"""
Calcular y guardar distancias faltantes en hospital_kam_distances
cuando se crean nuevos hospitales o KAMs
"""
import os
import sys
from dotenv import load_dotenv
import requests

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from supabase import create_client, Client

# Cargar variables de entorno
load_dotenv()

supabase_url = 'https://norvxqgohddgsdkggqzq.supabase.co'
supabase_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vcnZ4cWdvaGRkZ3Nka2dncXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMDExMjUsImV4cCI6MjA2ODc3NzEyNX0.BRWIYeD_5OlpVKIrP1QzUmkSx6HEVGzcEUUiSK8CmJs'

supabase: Client = create_client(supabase_url, supabase_key)

print("🔍 Buscando distancias faltantes...")

# 1. Obtener todos los hospitales y KAMs activos
hospitals = supabase.table('hospitals').select('*').eq('active', True).execute()
kams = supabase.table('kams').select('*').eq('active', True).execute()

print(f"📊 Hospitales activos: {len(hospitals.data)}")
print(f"📊 KAMs activos: {len(kams.data)}")

# 2. Obtener matriz de adyacencia
adjacency = supabase.table('department_adjacency').select('*').execute()
adjacency_matrix = {}
for row in adjacency.data:
    dept = row['department_code']
    if dept not in adjacency_matrix:
        adjacency_matrix[dept] = []
    adjacency_matrix[dept].append(row['adjacent_department_code'])

# 3. Verificar qué combinaciones ya existen
existing = supabase.table('hospital_kam_distances').select('hospital_id, kam_id').execute()
existing_pairs = set((r['hospital_id'], r['kam_id']) for r in existing.data)

print(f"📊 Distancias existentes: {len(existing_pairs)}")

# 4. Identificar faltantes según reglas de proximidad
missing_pairs = []
google_api_key = os.getenv('GOOGLE_MAPS_API_KEY')

for hospital in hospitals.data:
    hospital_dept = hospital['department_id']
    
    for kam in kams.data:
        # Si ya existe, saltar
        if (hospital['id'], kam['id']) in existing_pairs:
            continue
            
        kam_dept = kam['area_id'][:2]
        
        # Verificar proximidad
        is_same_dept = kam_dept == hospital_dept
        is_adjacent = kam_dept in adjacency_matrix and hospital_dept in adjacency_matrix[kam_dept]
        
        # Nivel 2: departamentos fronterizos de fronterizos
        is_level2 = False
        if kam.get('enable_level2', True):
            for adj_dept in adjacency_matrix.get(kam_dept, []):
                if hospital_dept in adjacency_matrix.get(adj_dept, []):
                    is_level2 = True
                    break
        
        # KAMs de Bogotá pueden competir en Cundinamarca y vecinos
        is_bogota_kam = kam['area_id'].startswith('11001')
        can_bogota_compete = is_bogota_kam and (
            hospital_dept == '11' or 
            hospital_dept == '25' or 
            hospital_dept in adjacency_matrix.get('25', [])
        )
        
        if is_same_dept or is_adjacent or is_level2 or can_bogota_compete:
            missing_pairs.append((hospital, kam))

print(f"❌ Distancias faltantes (según reglas de proximidad): {len(missing_pairs)}")

if missing_pairs:
    print("\n¿Deseas calcular las distancias faltantes con Google Maps? (s/n)")
    respuesta = input().lower()
    
    if respuesta == 's':
        calculated = 0
        failed = 0
        
        for hospital, kam in missing_pairs[:50]:  # Limitar a 50 para no gastar mucho
            try:
                # Calcular con Google Maps
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
                    print(f"✅ {kam['name']} → {hospital['name']}: {round(travel_time/60)} min")
                else:
                    failed += 1
                    print(f"❌ No se pudo calcular: {kam['name']} → {hospital['name']}")
                    
            except Exception as e:
                failed += 1
                print(f"❌ Error: {e}")
        
        print(f"\n📊 Resumen:")
        print(f"   - Calculadas: {calculated}")
        print(f"   - Fallidas: {failed}")
        print(f"   - Pendientes: {len(missing_pairs) - calculated - failed}")