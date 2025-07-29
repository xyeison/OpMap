#!/usr/bin/env python3
"""
Calcula TODAS las rutas faltantes de una vez
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

print("🚀 Calculador de TODAS las Rutas Faltantes OpMap")
print("=" * 60)
print(f"📅 Fecha: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

# Cargar datos
sellers = load_json('data/json/sellers.json')
hospitals = load_psv('data/psv/hospitals.psv')
adjacency = load_json('data/json/adjacency_matrix.json')
excluded_depts = ['27', '88', '91', '94', '95', '97', '99']

# Filtrar hospitales
hospitals = [h for h in hospitals if h['departmentid'] not in excluded_depts]

print(f"\n🏥 Hospitales: {len(hospitals)}")
print(f"👥 KAMs: {len(sellers)}")

# Conectar servicios
print("\n🔌 Conectando a servicios...")
supabase = SupabaseClient()
google_maps = GoogleMapsClient()

# Obtener rutas existentes
existing_routes = supabase.get_all_travel_times()
existing_set = set()
for route in existing_routes:
    key = (round(route['origin_lat'], 6), round(route['origin_lng'], 6),
           round(route['dest_lat'], 6), round(route['dest_lng'], 6))
    existing_set.add(key)

print(f"✅ Rutas existentes: {len(existing_routes):,}")

# Identificar y calcular rutas faltantes
missing_count = 0
calculated = 0
errors = 0
start_time = time.time()

print("\n🔍 Buscando y calculando rutas faltantes...")

for i, hospital in enumerate(hospitals):
    hospital_dept = hospital['departmentid']
    hospital_name = hospital.get('name_register', 'Hospital')[:30]
    
    for seller in sellers:
        seller_dept = seller['areaId'][:2]
        
        # Verificar si puede competir
        can_compete = False
        
        if seller_dept == hospital_dept or seller['areaId'].startswith('11001'):
            can_compete = True
        elif seller_dept in adjacency and hospital_dept in adjacency[seller_dept].get('closeDepartments', {}):
            can_compete = True
        elif seller_dept in adjacency:
            for adj_dept in adjacency[seller_dept].get('closeDepartments', {}):
                if adj_dept in adjacency and hospital_dept in adjacency[adj_dept].get('closeDepartments', {}):
                    can_compete = True
                    break
        
        if not can_compete:
            continue
            
        # Verificar si existe
        route_key = (round(float(seller['lat']), 6), round(float(seller['lng']), 6),
                     round(float(hospital['lat']), 6), round(float(hospital['lng']), 6))
        
        if route_key in existing_set:
            continue
            
        # Ruta faltante encontrada
        missing_count += 1
        
        # Calcular con Google Maps
        try:
            travel_time = google_maps.get_travel_time(
                float(seller['lat']), float(seller['lng']),
                float(hospital['lat']), float(hospital['lng'])
            )
            
            if travel_time is not None:
                # Guardar en Supabase
                success = supabase.save_travel_time(
                    float(seller['lat']), float(seller['lng']),
                    float(hospital['lat']), float(hospital['lng']),
                    travel_time,
                    source='google_maps'
                )
                
                if success:
                    calculated += 1
                    if calculated % 50 == 0:
                        elapsed = time.time() - start_time
                        rate = calculated / elapsed if elapsed > 0 else 0
                        eta = (missing_count - calculated) / rate if rate > 0 else 0
                        print(f"  ✅ {calculated}/{missing_count} rutas ({rate:.1f}/seg, ETA: {eta/60:.1f} min)")
                else:
                    errors += 1
            else:
                errors += 1
                
        except Exception as e:
            errors += 1
            if errors <= 5:
                print(f"  ⚠️ Error: {e}")
        
        # Rate limiting
        time.sleep(0.1)
    
    # Progreso por hospital
    if (i + 1) % 50 == 0:
        print(f"\n🏥 Procesados {i+1}/{len(hospitals)} hospitales")

# Resumen final
elapsed_total = time.time() - start_time
print("\n" + "=" * 60)
print("📊 RESUMEN FINAL")
print("=" * 60)
print(f"📍 Rutas faltantes encontradas: {missing_count:,}")
print(f"✅ Rutas calculadas exitosamente: {calculated:,}")
print(f"❌ Errores: {errors:,}")
print(f"⏱️ Tiempo total: {elapsed_total:.0f} segundos ({elapsed_total/60:.1f} minutos)")
print(f"💰 Costo estimado: ${calculated * 0.005:.2f} USD")

if calculated < missing_count:
    print(f"\n⚠️ Quedaron {missing_count - calculated} rutas sin calcular")
else:
    print("\n✅ ¡TODAS las rutas han sido calculadas exitosamente!")

# Verificar estado final
final_routes = supabase.get_all_travel_times()
print(f"\n📊 Estado final en Supabase: {len(final_routes):,} rutas totales")
