#!/usr/bin/env python3
"""
Buscar en travel_time_cache las rutas que necesitamos
de los 670 hospitales sin distancias a sus KAMs competidores
"""
from supabase import create_client
import json

supabase_url = 'https://norvxqgohddgsdkggqzq.supabase.co'
supabase_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vcnZ4cWdvaGRkZ3Nka2dncXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMDExMjUsImV4cCI6MjA2ODc3NzEyNX0.BRWIYeD_5OlpVKIrP1QzUmkSx6HEVGzcEUUiSK8CmJs'

supabase = create_client(supabase_url, supabase_key)

print("🔍 Buscando rutas existentes en travel_time_cache...")

# 1. Obtener hospitales sin ninguna distancia
hospitals_all = supabase.table('hospitals').select('*').eq('active', True).execute()
distances_existing = supabase.table('hospital_kam_distances').select('hospital_id').execute()
hospitals_with_distances = set(d['hospital_id'] for d in distances_existing.data)

hospitals_without = [h for h in hospitals_all.data if h['id'] not in hospitals_with_distances]
print(f"📊 Hospitales sin distancias: {len(hospitals_without)}")

# 2. Obtener todos los KAMs activos
kams = supabase.table('kams').select('*').eq('active', True).execute()
kams_by_id = {k['id']: k for k in kams.data}

# 3. Obtener matriz de adyacencia
adjacency = supabase.table('department_adjacency').select('*').execute()
adj_matrix = {}
for row in adjacency.data:
    if row['department_code'] not in adj_matrix:
        adj_matrix[row['department_code']] = []
    adj_matrix[row['department_code']].append(row['adjacent_department_code'])

# 4. Para cada hospital, identificar qué KAMs necesita
routes_needed = []
bogota_localities = {}

for hospital in hospitals_without:
    h_dept = hospital['department_id']
    h_mun = hospital['municipality_id']
    h_locality = hospital.get('locality_id')
    
    # Identificar KAMs que compiten por este hospital
    competing_kams = []
    
    # CASO BOGOTÁ: Por localidades
    if h_dept == '11' and h_locality:
        # En Bogotá, todos los KAMs de Bogotá compiten
        for kam in kams.data:
            if kam['area_id'].startswith('11001'):
                competing_kams.append(kam)
    else:
        # CASO REGULAR: Por departamento y adyacencia
        for kam in kams.data:
            kam_area = kam['area_id']
            kam_dept = kam_area[:2]
            
            # Si el KAM está en el mismo municipio, es territorio base (no necesita cálculo)
            if kam_area[:5] == h_mun[:5] or kam_area == h_mun:
                continue  # Territorio base, skip
            
            # KAM del mismo departamento
            if kam_dept == h_dept:
                competing_kams.append(kam)
                continue
            
            # KAM de departamento adyacente (Nivel 1)
            if h_dept in adj_matrix and kam_dept in adj_matrix[h_dept]:
                competing_kams.append(kam)
                continue
            
            # KAM de departamento adyacente de adyacente (Nivel 2)
            if kam.get('enable_level2', True):  # Todos tienen nivel 2 habilitado
                if h_dept in adj_matrix:
                    for adj1 in adj_matrix[h_dept]:
                        if adj1 in adj_matrix and kam_dept in adj_matrix[adj1]:
                            competing_kams.append(kam)
                            break
    
    # Agregar rutas necesarias
    for kam in competing_kams:
        routes_needed.append({
            'hospital_id': hospital['id'],
            'hospital_name': hospital['name'],
            'hospital_lat': hospital['lat'],
            'hospital_lng': hospital['lng'],
            'kam_id': kam['id'],
            'kam_name': kam['name'],
            'kam_lat': kam['lat'],
            'kam_lng': kam['lng']
        })

print(f"📊 Rutas necesarias identificadas: {len(routes_needed)}")

# 5. Buscar estas rutas en travel_time_cache
print("\n🔍 Buscando en travel_time_cache...")

found_routes = []
not_found_routes = []
tolerance_levels = [
    (6, "exacta"),
    (5, "5 decimales"),
    (4, "4 decimales"),
    (3, "3 decimales")
]

for route in routes_needed:
    found = False
    
    for decimals, precision_name in tolerance_levels:
        # Intentar con diferentes niveles de precisión
        # Buscar en travel_time_cache con diferentes precisiones
        cache_results = supabase.table('travel_time_cache').select('*').execute()
        
        for cache_entry in cache_results.data:
            # Comparar coordenadas con la precisión actual
            if (round(float(cache_entry['origin_lat']), decimals) == round(float(route['kam_lat']), decimals) and
                round(float(cache_entry['origin_lng']), decimals) == round(float(route['kam_lng']), decimals) and
                round(float(cache_entry['dest_lat']), decimals) == round(float(route['hospital_lat']), decimals) and
                round(float(cache_entry['dest_lng']), decimals) == round(float(route['hospital_lng']), decimals) and
                cache_entry.get('source') == 'google_maps' and
                cache_entry.get('travel_time') is not None):
                
                found_routes.append({
                    **route,
                    'travel_time': cache_entry['travel_time'],
                    'precision': precision_name
                })
                found = True
                break
        
        if found:
            break
    
    if not found:
        not_found_routes.append(route)

print(f"\n✅ Rutas encontradas en caché: {len(found_routes)}")
print(f"❌ Rutas NO encontradas: {len(not_found_routes)}")

# 6. Mostrar estadísticas por precisión
precision_stats = {}
for route in found_routes:
    precision = route['precision']
    if precision not in precision_stats:
        precision_stats[precision] = 0
    precision_stats[precision] += 1

print("\n📊 Rutas encontradas por nivel de precisión:")
for precision, count in precision_stats.items():
    print(f"   {precision}: {count} rutas")

# 7. Insertar las rutas encontradas en hospital_kam_distances
if found_routes:
    print(f"\n💾 Insertando {len(found_routes)} rutas en hospital_kam_distances...")
    
    inserted = 0
    for route in found_routes:
        # Verificar que no exista ya
        existing = supabase.table('hospital_kam_distances').select('id').eq(
            'hospital_id', route['hospital_id']
        ).eq('kam_id', route['kam_id']).execute()
        
        if not existing.data:
            result = supabase.table('hospital_kam_distances').insert({
                'hospital_id': route['hospital_id'],
                'kam_id': route['kam_id'],
                'travel_time': route['travel_time'],
                'source': 'google_maps'
            }).execute()
            if result.data:
                inserted += 1
    
    print(f"✅ Insertadas: {inserted} rutas nuevas")

# 8. Análisis de rutas faltantes
if not_found_routes:
    print(f"\n📊 Análisis de {len(not_found_routes)} rutas faltantes:")
    
    # Agrupar por KAM
    by_kam = {}
    for route in not_found_routes:
        kam_name = route['kam_name']
        if kam_name not in by_kam:
            by_kam[kam_name] = []
        by_kam[kam_name].append(route)
    
    print("\nRutas faltantes por KAM:")
    for kam_name, routes in sorted(by_kam.items(), key=lambda x: len(x[1]), reverse=True):
        print(f"   {kam_name}: {len(routes)} rutas")
    
    # Mostrar las primeras 10 rutas faltantes
    print("\nPrimeras 10 rutas que faltan:")
    for i, route in enumerate(not_found_routes[:10], 1):
        print(f"   {i}. {route['hospital_name']} → {route['kam_name']}")

print("\n✅ Búsqueda completada")
print(f"   Total rutas necesarias: {len(routes_needed)}")
print(f"   Encontradas en caché: {len(found_routes)}")
print(f"   Por calcular: {len(not_found_routes)}")

# Guardar resultados para análisis posterior
with open('/Users/yeison/Documents/GitHub/OpMap/output/routes_analysis.json', 'w') as f:
    json.dump({
        'routes_needed': len(routes_needed),
        'found_in_cache': len(found_routes),
        'not_found': len(not_found_routes),
        'precision_stats': precision_stats,
        'missing_by_kam': {k: len(v) for k, v in by_kam.items()} if not_found_routes else {}
    }, f, indent=2)

print("\n📄 Resultados guardados en output/routes_analysis.json")