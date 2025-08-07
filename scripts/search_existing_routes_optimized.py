#!/usr/bin/env python3
"""
Buscar eficientemente en travel_time_cache las rutas necesarias
"""
from supabase import create_client
import json
from decimal import Decimal

supabase_url = 'https://norvxqgohddgsdkggqzq.supabase.co'
supabase_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vcnZ4cWdvaGRkZ3Nka2dncXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMDExMjUsImV4cCI6MjA2ODc3NzEyNX0.BRWIYeD_5OlpVKIrP1QzUmkSx6HEVGzcEUUiSK8CmJs'

supabase = create_client(supabase_url, supabase_key)

print("🔍 Buscando rutas existentes en travel_time_cache de manera optimizada...")

# 1. Cargar todos los datos necesarios en memoria
print("📥 Cargando datos...")

# Hospitales sin distancias
hospitals_all = supabase.table('hospitals').select('*').eq('active', True).execute()
distances_existing = supabase.table('hospital_kam_distances').select('hospital_id').execute()
hospitals_with_distances = set(d['hospital_id'] for d in distances_existing.data)
hospitals_without = [h for h in hospitals_all.data if h['id'] not in hospitals_with_distances]

print(f"   Hospitales sin distancias: {len(hospitals_without)}")

# KAMs activos
kams = supabase.table('kams').select('*').eq('active', True).execute()
kams_by_id = {k['id']: k for k in kams.data}

# Matriz de adyacencia
adjacency = supabase.table('department_adjacency').select('*').execute()
adj_matrix = {}
for row in adjacency.data:
    if row['department_code'] not in adj_matrix:
        adj_matrix[row['department_code']] = set()
    adj_matrix[row['department_code']].add(row['adjacent_department_code'])

# Cargar TODO el caché en memoria (más eficiente que múltiples queries)
print("📥 Cargando travel_time_cache completo...")
cache_data = supabase.table('travel_time_cache').select('*').eq('source', 'google_maps').execute()
print(f"   Registros en caché: {len(cache_data.data)}")

# 2. Crear índice de caché para búsqueda rápida
print("🔧 Creando índice de búsqueda...")
cache_index = {}

def make_key(lat1, lng1, lat2, lng2, precision=4):
    """Crear clave de búsqueda con precisión específica"""
    return (
        round(float(lat1), precision),
        round(float(lng1), precision),
        round(float(lat2), precision),
        round(float(lng2), precision)
    )

# Indexar con diferentes precisiones
for cache_entry in cache_data.data:
    if cache_entry.get('travel_time') is not None:
        # Indexar con precisión 4 (más común)
        key4 = make_key(
            cache_entry['origin_lat'],
            cache_entry['origin_lng'],
            cache_entry['dest_lat'],
            cache_entry['dest_lng'],
            precision=4
        )
        cache_index[key4] = cache_entry

print(f"   Índice creado con {len(cache_index)} entradas")

# 3. Identificar rutas necesarias
print("\n🎯 Identificando rutas necesarias...")

routes_needed = []
routes_needed_set = set()  # Para evitar duplicados

for hospital in hospitals_without:
    h_dept = hospital['department_id']
    h_mun = hospital['municipality_id']
    h_locality = hospital.get('locality_id')
    
    # Identificar KAMs que compiten
    competing_kams = []
    
    # CASO BOGOTÁ
    if h_dept == '11' and h_locality:
        for kam in kams.data:
            if kam['area_id'].startswith('11001'):
                # No incluir si es el KAM de la misma localidad (territorio base)
                if kam['area_id'] != h_locality:
                    competing_kams.append(kam)
    else:
        # CASO REGULAR
        for kam in kams.data:
            kam_area = kam['area_id']
            kam_dept = kam_area[:2]
            
            # Skip territorio base
            if kam_area[:5] == h_mun[:5] or kam_area == h_mun:
                continue
            
            # KAM del mismo departamento
            if kam_dept == h_dept:
                competing_kams.append(kam)
                continue
            
            # Nivel 1: departamento adyacente
            if h_dept in adj_matrix and kam_dept in adj_matrix[h_dept]:
                competing_kams.append(kam)
                continue
            
            # Nivel 2: adyacente del adyacente
            if kam.get('enable_level2', True):
                found_level2 = False
                if h_dept in adj_matrix:
                    for adj1 in adj_matrix[h_dept]:
                        if adj1 in adj_matrix and kam_dept in adj_matrix[adj1]:
                            competing_kams.append(kam)
                            found_level2 = True
                            break
    
    # Agregar rutas únicas
    for kam in competing_kams:
        route_key = (hospital['id'], kam['id'])
        if route_key not in routes_needed_set:
            routes_needed_set.add(route_key)
            routes_needed.append({
                'hospital_id': hospital['id'],
                'hospital_name': hospital['name'],
                'hospital_lat': hospital['lat'],
                'hospital_lng': hospital['lng'],
                'hospital_dept': hospital['department_name'],
                'kam_id': kam['id'],
                'kam_name': kam['name'],
                'kam_lat': kam['lat'],
                'kam_lng': kam['lng']
            })

print(f"   Rutas necesarias: {len(routes_needed)}")

# 4. Buscar rutas en caché
print("\n🔍 Buscando coincidencias en caché...")

found_routes = []
not_found_routes = []
precision_stats = {3: 0, 4: 0, 5: 0, 6: 0}

for route in routes_needed:
    found = False
    
    # Intentar con diferentes precisiones
    for precision in [4, 5, 3, 6]:  # Orden optimizado
        key = make_key(
            route['kam_lat'],
            route['kam_lng'],
            route['hospital_lat'],
            route['hospital_lng'],
            precision=precision
        )
        
        if key in cache_index:
            cache_entry = cache_index[key]
            found_routes.append({
                **route,
                'travel_time': cache_entry['travel_time'],
                'distance': cache_entry.get('distance'),
                'precision': precision
            })
            precision_stats[precision] += 1
            found = True
            break
    
    if not found:
        not_found_routes.append(route)

print(f"\n📊 RESULTADOS:")
print(f"   ✅ Encontradas: {len(found_routes)} rutas")
print(f"   ❌ No encontradas: {len(not_found_routes)} rutas")

print(f"\n📊 Precisión de coincidencias:")
for precision, count in sorted(precision_stats.items()):
    if count > 0:
        print(f"   {precision} decimales: {count} rutas")

# 5. Insertar rutas encontradas
if found_routes:
    print(f"\n💾 Insertando {len(found_routes)} rutas en hospital_kam_distances...")
    
    inserted = 0
    skipped = 0
    
    for route in found_routes:
        # Verificar que no exista
        existing = supabase.table('hospital_kam_distances').select('id').eq(
            'hospital_id', route['hospital_id']
        ).eq('kam_id', route['kam_id']).execute()
        
        if not existing.data:
            result = supabase.table('hospital_kam_distances').insert({
                'hospital_id': route['hospital_id'],
                'kam_id': route['kam_id'],
                'travel_time': route['travel_time'],
                'distance': route.get('distance'),
                'source': 'google_maps'
            }).execute()
            if result.data:
                inserted += 1
        else:
            skipped += 1
    
    print(f"   ✅ Insertadas: {inserted} nuevas")
    print(f"   ⏭️ Omitidas (ya existían): {skipped}")

# 6. Análisis de rutas faltantes
if not_found_routes:
    print(f"\n📊 ANÁLISIS DE {len(not_found_routes)} RUTAS FALTANTES:")
    
    # Por KAM
    by_kam = {}
    for route in not_found_routes:
        kam_name = route['kam_name']
        if kam_name not in by_kam:
            by_kam[kam_name] = []
        by_kam[kam_name].append(route)
    
    print("\n   Por KAM (top 10):")
    for kam_name, routes in sorted(by_kam.items(), key=lambda x: len(x[1]), reverse=True)[:10]:
        print(f"      {kam_name}: {len(routes)} rutas")
    
    # Por departamento
    by_dept = {}
    for route in not_found_routes:
        dept = route['hospital_dept']
        if dept not in by_dept:
            by_dept[dept] = []
        by_dept[dept].append(route)
    
    print("\n   Por departamento de hospital (top 10):")
    for dept, routes in sorted(by_dept.items(), key=lambda x: len(x[1]), reverse=True)[:10]:
        print(f"      {dept}: {len(routes)} rutas")

# 7. Verificar nuevo estado
print("\n🔄 Verificando nuevo estado...")
new_distances = supabase.table('hospital_kam_distances').select('hospital_id').execute()
new_hospitals_with_distances = set(d['hospital_id'] for d in new_distances.data)
remaining_without = len(hospitals_all.data) - len(new_hospitals_with_distances)

print(f"   Hospitales con distancias ahora: {len(new_hospitals_with_distances)}")
print(f"   Hospitales sin distancias ahora: {remaining_without}")

# 8. Guardar análisis
analysis = {
    'timestamp': str(json.dumps({'now': 'now'}, default=str)),
    'routes_needed': len(routes_needed),
    'found_in_cache': len(found_routes),
    'not_found': len(not_found_routes),
    'precision_stats': precision_stats,
    'inserted': inserted if found_routes else 0,
    'hospitals_without_distances_before': len(hospitals_without),
    'hospitals_without_distances_after': remaining_without,
    'missing_by_kam': {k: len(v) for k, v in by_kam.items()} if not_found_routes else {},
    'missing_by_dept': {k: len(v) for k, v in by_dept.items()} if not_found_routes else {}
}

with open('/Users/yeison/Documents/GitHub/OpMap/output/cache_search_results.json', 'w') as f:
    json.dump(analysis, f, indent=2)

print("\n📄 Análisis guardado en output/cache_search_results.json")

# 9. Resumen final
print("\n" + "="*60)
print("📊 RESUMEN FINAL:")
print("="*60)
print(f"Hospitales sin distancias inicial: {len(hospitals_without)}")
print(f"Rutas necesarias identificadas: {len(routes_needed)}")
print(f"Rutas encontradas en caché: {len(found_routes)}")
print(f"Rutas insertadas: {inserted if found_routes else 0}")
print(f"Hospitales sin distancias final: {remaining_without}")
print(f"Rutas aún por calcular: {len(not_found_routes)}")
print("="*60)