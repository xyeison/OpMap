#!/usr/bin/env python3
"""
Calcula rutas faltantes por departamento específico
"""
import sys
import json
import time
from datetime import datetime
sys.path.append('src')
from src.utils.supabase_client import SupabaseClient
from src.utils.google_maps_client import GoogleMapsClient

def load_json(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        return json.load(f)

def load_psv(filename):
    data = []
    with open(filename, 'r', encoding='utf-8') as f:
        headers = f.readline().strip().split('|')
        for line in f:
            values = line.strip().split('|')
            if len(values) == len(headers):
                data.append(dict(zip(headers, values)))
    return data

# Cargar datos
sellers = load_json('data/json/sellers.json')
hospitals = load_psv('data/psv/hospitals.psv')
adjacency = load_json('data/json/adjacency_matrix.json')
excluded_depts = ['27', '88', '91', '94', '95', '97', '99']

# Pedir departamento
target_dept = input("🎯 Departamento a calcular (código): ").strip()

# Filtrar hospitales del departamento
hospitals = [h for h in hospitals if h['departmentid'] == target_dept]

if not hospitals:
    print(f"❌ No hay hospitales en departamento {target_dept}")
    sys.exit(1)

print(f"\n🏥 Hospitales en departamento {target_dept}: {len(hospitals)}")

# Conectar servicios
supabase = SupabaseClient()
google_maps = GoogleMapsClient()

# Verificar rutas faltantes solo para este departamento
missing_routes = []
for hospital in hospitals:
    for seller in sellers:
        seller_dept = seller['areaId'][:2]
        
        # Verificar si puede competir
        can_compete = False
        
        if seller_dept == target_dept or seller['areaId'].startswith('11001'):
            can_compete = True
        elif seller_dept in adjacency and target_dept in adjacency[seller_dept].get('closeDepartments', {}):
            can_compete = True
        elif seller_dept in adjacency:
            for adj_dept in adjacency[seller_dept].get('closeDepartments', {}):
                if adj_dept in adjacency and target_dept in adjacency[adj_dept].get('closeDepartments', {}):
                    can_compete = True
                    break
        
        if not can_compete:
            continue
            
        # Verificar si existe
        existing = supabase.get_travel_time(
            float(seller['lat']), float(seller['lng']),
            float(hospital['lat']), float(hospital['lng'])
        )
        
        if existing is None:
            missing_routes.append((seller, hospital))

print(f"🔍 Rutas faltantes en departamento {target_dept}: {len(missing_routes)}")

if not missing_routes:
    print("✅ Todas las rutas ya están calculadas")
    sys.exit(0)

# Calcular las faltantes
calculated = 0
errors = 0
start_time = time.time()

for i, (seller, hospital) in enumerate(missing_routes):
    if i % 10 == 0:
        print(f"\n📍 Progreso: {i}/{len(missing_routes)}")
    
    try:
        travel_time = google_maps.get_travel_time(
            float(seller['lat']), float(seller['lng']),
            float(hospital['lat']), float(hospital['lng'])
        )
        
        if travel_time is not None:
            success = supabase.save_travel_time(
                float(seller['lat']), float(seller['lng']),
                float(hospital['lat']), float(hospital['lng']),
                travel_time,
                source='google_maps'
            )
            
            if success:
                calculated += 1
                print(f"  ✅ {seller['name']} → {hospital.get('name_register', 'Hospital')[:30]}... ({travel_time} min)")
            else:
                errors += 1
        else:
            errors += 1
            
    except Exception as e:
        errors += 1
        print(f"  ❌ Error: {e}")
    
    time.sleep(0.1)

# Resumen
elapsed = time.time() - start_time
print(f"\n📊 RESUMEN:")
print(f"✅ Calculadas: {calculated}")
print(f"❌ Errores: {errors}")
print(f"⏱️ Tiempo: {elapsed:.0f} segundos")
print(f"💰 Costo: ${calculated * 0.005:.2f} USD")
