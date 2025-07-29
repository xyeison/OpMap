#!/usr/bin/env python3
"""
Identifica las rutas faltantes según la lógica de negocio
"""
import sys
import json
sys.path.append('src')
from src.utils.supabase_client import SupabaseClient

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

# Filtrar hospitales excluyendo departamentos
hospitals = [h for h in hospitals if h['departmentid'] not in excluded_depts]

print(f"🏥 Hospitales activos: {len(hospitals)}")
print(f"👥 KAMs: {len(sellers)}")

# Conectar a Supabase
supabase = SupabaseClient()
existing_routes = supabase.get_all_travel_times()

# Crear set de rutas existentes para búsqueda rápida
existing_set = set()
for route in existing_routes:
    key = (round(route['origin_lat'], 6), round(route['origin_lng'], 6),
           round(route['dest_lat'], 6), round(route['dest_lng'], 6))
    existing_set.add(key)

print(f"\n✅ Rutas existentes en Supabase: {len(existing_routes):,}")

# Identificar rutas faltantes
missing_routes = []
missing_by_dept = {}

for hospital in hospitals:
    hospital_dept = hospital['departmentid']
    
    for seller in sellers:
        seller_dept = seller['areaId'][:2]
        
        # Verificar si el KAM puede competir
        can_compete = False
        
        # Mismo departamento o Bogotá
        if seller_dept == hospital_dept or seller['areaId'].startswith('11001'):
            can_compete = True
        # Adyacente Nivel 1
        elif seller_dept in adjacency and hospital_dept in adjacency[seller_dept].get('closeDepartments', {}):
            can_compete = True
        # Nivel 2
        elif seller_dept in adjacency:
            for adj_dept in adjacency[seller_dept].get('closeDepartments', {}):
                if adj_dept in adjacency and hospital_dept in adjacency[adj_dept].get('closeDepartments', {}):
                    can_compete = True
                    break
        
        if not can_compete:
            continue
            
        # Verificar si existe la ruta
        route_key = (round(float(seller['lat']), 6), round(float(seller['lng']), 6),
                     round(float(hospital['lat']), 6), round(float(hospital['lng']), 6))
        
        if route_key not in existing_set:
            missing_routes.append({
                'seller': seller,
                'hospital': hospital,
                'hospital_dept': hospital_dept
            })
            
            if hospital_dept not in missing_by_dept:
                missing_by_dept[hospital_dept] = 0
            missing_by_dept[hospital_dept] += 1

print(f"\n❌ Rutas faltantes: {len(missing_routes)}")

if missing_routes:
    print("\n📍 Departamentos con rutas faltantes:")
    sorted_depts = sorted(missing_by_dept.items(), key=lambda x: x[1], reverse=True)
    for dept_id, count in sorted_depts[:10]:
        dept_name = next((d['name'] for d in adjacency.values() if str(d.get('id')) == dept_id), dept_id)
        print(f"  {dept_id} - {dept_name}: {count} rutas faltantes")
    
    # Mostrar algunos ejemplos
    print("\n🔍 Ejemplos de rutas faltantes:")
    for i, missing in enumerate(missing_routes[:5]):
        h_name = missing['hospital'].get('name_register', 'Hospital')[:40]
        s_name = missing['seller']['name']
        print(f"  {i+1}. {s_name} → {h_name}... (Depto {missing['hospital_dept']})")
else:
    print("\n✅ ¡Todas las rutas necesarias están calculadas!")

# Verificar rutas "extra" (que existen pero no son necesarias)
extra_count = 0
for route in existing_routes:
    # Buscar el seller y hospital correspondientes
    found = False
    for seller in sellers:
        if (abs(float(seller['lat']) - route['origin_lat']) < 0.0001 and
            abs(float(seller['lng']) - route['origin_lng']) < 0.0001):
            for hospital in hospitals:
                if (abs(float(hospital['lat']) - route['dest_lat']) < 0.0001 and
                    abs(float(hospital['lng']) - route['dest_lng']) < 0.0001):
                    found = True
                    break
            if found:
                break
    
    if not found:
        extra_count += 1

print(f"\n🔄 Rutas 'extra' (hospitales excluidos o no necesarias): {extra_count}")
