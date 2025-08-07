#!/usr/bin/env python3
"""
Identificar qué rutas faltan basándose en el mapeo de cache
y las reglas del algoritmo OpMap
"""
from supabase import create_client
import json

supabase_url = 'https://norvxqgohddgsdkggqzq.supabase.co'
supabase_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vcnZ4cWdvaGRkZ3Nka2dncXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMDExMjUsImV4cCI6MjA2ODc3NzEyNX0.BRWIYeD_5OlpVKIrP1QzUmkSx6HEVGzcEUUiSK8CmJs'

supabase = create_client(supabase_url, supabase_key)

print("🔍 Analizando rutas existentes vs necesarias")
print("="*60)

# 1. Cargar el mapeo existente
print("\n📥 Cargando datos...")
with open('/Users/yeison/Documents/GitHub/OpMap/output/all_mapped_routes.json', 'r') as f:
    existing_routes = json.load(f)

print(f"   Rutas existentes mapeadas: {len(existing_routes)}")

# Crear índice de rutas existentes
existing_index = set()
for route in existing_routes:
    existing_index.add((route['hospital_id'], route['kam_id']))

print(f"   Índice creado con {len(existing_index)} pares únicos")

# 2. Cargar datos necesarios
hospitals = supabase.table('hospitals').select('*').eq('active', True).execute()
kams = supabase.table('kams').select('*').eq('active', True).execute()
print(f"   Hospitales activos: {len(hospitals.data)}")
print(f"   KAMs activos: {len(kams.data)}")

# Matriz de adyacencia
adjacency = supabase.table('department_adjacency').select('*').execute()
adj_matrix = {}
for row in adjacency.data:
    if row['department_code'] not in adj_matrix:
        adj_matrix[row['department_code']] = set()
    adj_matrix[row['department_code']].add(row['adjacent_department_code'])

# Departamentos excluidos
excluded = supabase.table('departments').select('code').eq('excluded', True).execute()
excluded_depts = set(d['code'] for d in excluded.data) if excluded.data else set()

# 3. Clasificar hospitales y KAMs
print("\n📊 Clasificando entidades...")

# Hospitales por categoría
hospitals_bogota = []  # Hospitales en localidades de Bogotá
hospitals_with_local_kam = []  # Hospitales con KAM en su municipio
hospitals_regular = []  # Hospitales que necesitan cálculo

# KAMs por categoría
kams_bogota = []  # KAMs en localidades de Bogotá
kams_regular = []  # KAMs en municipios regulares
kams_by_area = {}  # Índice por área

for kam in kams.data:
    area_id = kam['area_id']
    kams_by_area[area_id] = kam
    
    if area_id.startswith('11001') and len(area_id) > 5:
        kams_bogota.append(kam)
    else:
        kams_regular.append(kam)

print(f"   KAMs en Bogotá: {len(kams_bogota)}")
print(f"   KAMs regulares: {len(kams_regular)}")

# Clasificar hospitales
for hospital in hospitals.data:
    # Excluir departamentos no atendidos
    if hospital['department_id'] in excluded_depts:
        continue
    
    h_dept = hospital['department_id']
    h_mun = hospital['municipality_id']
    h_locality = hospital.get('locality_id')
    
    # Hospital en Bogotá con localidad
    if h_dept == '11' and h_locality:
        hospitals_bogota.append(hospital)
    # Hospital con KAM local (territorio base)
    elif h_mun in kams_by_area or h_mun[:5] in kams_by_area:
        hospitals_with_local_kam.append(hospital)
    else:
        hospitals_regular.append(hospital)

print(f"\n   Hospitales en Bogotá: {len(hospitals_bogota)}")
print(f"   Hospitales con KAM local: {len(hospitals_with_local_kam)}")
print(f"   Hospitales regulares: {len(hospitals_regular)}")

# 4. Identificar rutas necesarias
print("\n🎯 Identificando rutas necesarias...")

routes_needed = []
routes_missing = []
routes_existing = []

def get_competing_kams(hospital, kams_list, adj_matrix):
    """Obtener KAMs que compiten por un hospital"""
    competing = []
    h_dept = hospital['department_id']
    h_mun = hospital['municipality_id']
    h_locality = hospital.get('locality_id')
    
    # CASO BOGOTÁ
    if h_dept == '11' and h_locality:
        # Solo KAMs de Bogotá compiten, excepto el de la misma localidad
        for kam in kams_list:
            if kam['area_id'].startswith('11001'):
                if kam['area_id'] != h_locality:  # No el de la misma localidad
                    competing.append(kam)
    else:
        # CASO REGULAR
        for kam in kams_list:
            kam_area = kam['area_id']
            kam_dept = kam_area[:2]
            
            # Skip si es territorio base
            if kam_area == h_mun or kam_area[:5] == h_mun[:5]:
                continue
            
            # Mismo departamento
            if kam_dept == h_dept:
                competing.append(kam)
                continue
            
            # Nivel 1: departamento adyacente
            if h_dept in adj_matrix and kam_dept in adj_matrix[h_dept]:
                competing.append(kam)
                continue
            
            # Nivel 2: adyacente del adyacente
            if kam.get('enable_level2', True):
                if h_dept in adj_matrix:
                    for adj1 in adj_matrix[h_dept]:
                        if adj1 in adj_matrix and kam_dept in adj_matrix[adj1]:
                            competing.append(kam)
                            break
    
    return competing

# Procesar cada categoría de hospital
print("\n   Procesando hospitales en Bogotá...")
for hospital in hospitals_bogota:
    competing_kams = get_competing_kams(hospital, kams.data, adj_matrix)
    for kam in competing_kams:
        route_pair = (hospital['id'], kam['id'])
        routes_needed.append(route_pair)
        
        if route_pair in existing_index:
            routes_existing.append({
                'hospital': hospital['name'],
                'kam': kam['name'],
                'type': 'bogota'
            })
        else:
            routes_missing.append({
                'hospital_id': hospital['id'],
                'hospital_name': hospital['name'],
                'hospital_locality': hospital.get('locality_name', 'N/A'),
                'kam_id': kam['id'],
                'kam_name': kam['name'],
                'type': 'bogota'
            })

print("\n   Procesando hospitales con KAM local...")
for hospital in hospitals_with_local_kam:
    competing_kams = get_competing_kams(hospital, kams.data, adj_matrix)
    for kam in competing_kams:
        route_pair = (hospital['id'], kam['id'])
        routes_needed.append(route_pair)
        
        if route_pair in existing_index:
            routes_existing.append({
                'hospital': hospital['name'],
                'kam': kam['name'],
                'type': 'local_kam'
            })
        else:
            routes_missing.append({
                'hospital_id': hospital['id'],
                'hospital_name': hospital['name'],
                'hospital_municipality': hospital['municipality_name'],
                'kam_id': kam['id'],
                'kam_name': kam['name'],
                'type': 'local_kam_competitor'
            })

print("\n   Procesando hospitales regulares...")
for hospital in hospitals_regular:
    competing_kams = get_competing_kams(hospital, kams.data, adj_matrix)
    for kam in competing_kams:
        route_pair = (hospital['id'], kam['id'])
        routes_needed.append(route_pair)
        
        if route_pair in existing_index:
            routes_existing.append({
                'hospital': hospital['name'],
                'kam': kam['name'],
                'type': 'regular'
            })
        else:
            routes_missing.append({
                'hospital_id': hospital['id'],
                'hospital_name': hospital['name'],
                'hospital_municipality': hospital['municipality_name'],
                'hospital_department': hospital['department_name'],
                'kam_id': kam['id'],
                'kam_name': kam['name'],
                'type': 'regular'
            })

# 5. Estadísticas
print("\n" + "="*60)
print("📊 ANÁLISIS DE COBERTURA DE RUTAS")
print("="*60)

print(f"\n📈 Resumen General:")
print(f"   Rutas necesarias totales: {len(routes_needed)}")
print(f"   Rutas existentes: {len(routes_existing)}")
print(f"   Rutas faltantes: {len(routes_missing)}")
print(f"   Cobertura: {len(routes_existing)*100/len(routes_needed) if routes_needed else 0:.1f}%")

# Análisis por tipo
missing_by_type = {}
for route in routes_missing:
    route_type = route['type']
    if route_type not in missing_by_type:
        missing_by_type[route_type] = []
    missing_by_type[route_type].append(route)

print(f"\n📊 Rutas faltantes por tipo:")
for route_type, routes in missing_by_type.items():
    print(f"   {route_type}: {len(routes)} rutas")

# Análisis por KAM
missing_by_kam = {}
for route in routes_missing:
    kam_name = route['kam_name']
    if kam_name not in missing_by_kam:
        missing_by_kam[kam_name] = []
    missing_by_kam[kam_name].append(route)

print(f"\n📊 Rutas faltantes por KAM (top 10):")
for kam_name, routes in sorted(missing_by_kam.items(), key=lambda x: len(x[1]), reverse=True)[:10]:
    print(f"   {kam_name}: {len(routes)} rutas")

# Hospitales sin ninguna ruta
hospitals_without_any_route = []
for hospital in hospitals.data:
    if hospital['department_id'] in excluded_depts:
        continue
    
    has_route = False
    for route in existing_routes:
        if route['hospital_id'] == hospital['id']:
            has_route = True
            break
    
    if not has_route:
        hospitals_without_any_route.append(hospital)

print(f"\n⚠️ Hospitales sin NINGUNA ruta calculada: {len(hospitals_without_any_route)}")
if hospitals_without_any_route[:5]:
    print("   Primeros 5:")
    for h in hospitals_without_any_route[:5]:
        print(f"   - {h['name']} ({h['municipality_name']}, {h['department_name']})")

# 6. Guardar análisis
analysis = {
    'summary': {
        'routes_needed': len(routes_needed),
        'routes_existing': len(routes_existing),
        'routes_missing': len(routes_missing),
        'coverage_percentage': len(routes_existing)*100/len(routes_needed) if routes_needed else 0,
        'hospitals_without_any_route': len(hospitals_without_any_route)
    },
    'missing_by_type': {k: len(v) for k, v in missing_by_type.items()},
    'missing_by_kam': {k: len(v) for k, v in missing_by_kam.items()},
    'hospitals_without_routes': [
        {
            'id': h['id'],
            'name': h['name'],
            'municipality': h['municipality_name'],
            'department': h['department_name']
        } for h in hospitals_without_any_route
    ]
}

with open('/Users/yeison/Documents/GitHub/OpMap/output/routes_coverage_analysis.json', 'w') as f:
    json.dump(analysis, f, indent=2)

# Guardar lista detallada de rutas faltantes
with open('/Users/yeison/Documents/GitHub/OpMap/output/routes_missing_detailed.json', 'w') as f:
    json.dump(routes_missing, f, indent=2)

print("\n📄 Archivos guardados:")
print("   - output/routes_coverage_analysis.json")
print("   - output/routes_missing_detailed.json")

print("\n" + "="*60)
print("🎯 RECOMENDACIONES")
print("="*60)
print(f"1. Faltan {len(routes_missing)} rutas por calcular")
print(f"2. Hay {len(hospitals_without_any_route)} hospitales sin ninguna ruta")
print(f"3. Priorizar hospitales con contratos grandes sin rutas")
print(f"4. Considerar usar Haversine para rutas de respaldo")
print("="*60)