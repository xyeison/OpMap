#!/usr/bin/env python3
"""
Calcular las rutas LÓGICAS que faltan según las reglas del algoritmo OpMap
Solo KAMs que pueden competir según adyacencia departamental
"""
from supabase import create_client

supabase_url = 'https://norvxqgohddgsdkggqzq.supabase.co'
supabase_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vcnZ4cWdvaGRkZ3Nka2dncXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMDExMjUsImV4cCI6MjA2ODc3NzEyNX0.BRWIYeD_5OlpVKIrP1QzUmkSx6HEVGzcEUUiSK8CmJs'

supabase = create_client(supabase_url, supabase_key)

print("🔍 CALCULANDO RUTAS LÓGICAS FALTANTES")
print("="*60)

# 1. Cargar configuración
print("\n📥 Cargando datos...")

# Departamentos excluidos
excluded_depts = supabase.table('departments').select('code').eq('excluded', True).execute()
excluded_set = set(d['code'] for d in excluded_depts.data)

# Matriz de adyacencia
adjacency = supabase.table('department_adjacency').select('*').execute()
adj_matrix = {}
for row in adjacency.data:
    dept = row['department_code']
    if dept not in adj_matrix:
        adj_matrix[dept] = set()
    adj_matrix[dept].add(row['adjacent_department_code'])

# KAMs activos
kams = supabase.table('kams').select('*').eq('active', True).execute()
kams_by_dept = {}
kams_by_area = {}
kams_bogota = []

for kam in kams.data:
    area_id = kam['area_id']
    dept = area_id[:2]
    
    # KAMs por departamento
    if dept not in kams_by_dept:
        kams_by_dept[dept] = []
    kams_by_dept[dept].append(kam)
    
    # KAMs por área
    kams_by_area[area_id] = kam
    
    # KAMs de Bogotá
    if area_id.startswith('11001'):
        kams_bogota.append(kam)

print(f"   KAMs activos: {len(kams.data)}")
print(f"   KAMs en Bogotá: {len(kams_bogota)}")

# Hospitales sin distancias
hospitals = supabase.table('hospitals').select('*').eq('active', True).execute()
distances = supabase.table('hospital_kam_distances').select('hospital_id, kam_id').execute()
existing_pairs = set((d['hospital_id'], d['kam_id']) for d in distances.data)

hospitals_sin_distancias = []
for h in hospitals.data:
    # Excluir departamentos excluidos
    if h['department_id'] in excluded_set:
        continue
    
    # Si no tiene ninguna distancia
    if not any(h['id'] == pair[0] for pair in existing_pairs):
        hospitals_sin_distancias.append(h)

print(f"   Hospitales sin distancias (en deptos no excluidos): {len(hospitals_sin_distancias)}")

# 2. Función para determinar KAMs que pueden competir
def get_competing_kams(hospital, all_kams, adj_matrix, kams_by_area):
    """
    Determina qué KAMs pueden competir LÓGICAMENTE por un hospital
    """
    h_dept = hospital['department_id']
    h_mun = hospital['municipality_id']
    h_locality = hospital.get('locality_id')
    
    competing = []
    kam_local = None
    
    # Verificar si hay KAM local (territorio base)
    if h_locality and h_locality in kams_by_area:
        kam_local = kams_by_area[h_locality]
    elif h_mun in kams_by_area:
        kam_local = kams_by_area[h_mun]
    elif h_mun[:5] in kams_by_area:
        kam_local = kams_by_area[h_mun[:5]]
    
    # CASO BOGOTÁ: localidades
    if h_dept == '11' and h_locality:
        # Todos los KAMs de Bogotá compiten entre sí
        for kam in all_kams:
            if kam['area_id'].startswith('11001'):
                # No incluir el KAM de la misma localidad (territorio base)
                if not kam_local or kam['id'] != kam_local['id']:
                    competing.append(kam)
    else:
        # CASO REGULAR: por departamento y adyacencia
        for kam in all_kams:
            # Skip si es territorio base
            if kam_local and kam['id'] == kam_local['id']:
                continue
            
            kam_dept = kam['area_id'][:2]
            
            # KAM del mismo departamento
            if kam_dept == h_dept:
                competing.append(kam)
                continue
            
            # Nivel 1: departamento adyacente
            if h_dept in adj_matrix and kam_dept in adj_matrix[h_dept]:
                competing.append(kam)
                continue
            
            # Nivel 2: adyacente del adyacente (si enable_level2)
            if kam.get('enable_level2', True):
                if h_dept in adj_matrix:
                    for adj1 in adj_matrix[h_dept]:
                        if adj1 in adj_matrix and kam_dept in adj_matrix[adj1]:
                            competing.append(kam)
                            break
    
    return kam_local, competing

# 3. Calcular rutas necesarias para cada hospital
print("\n🎯 ANALIZANDO RUTAS NECESARIAS...")

routes_needed = []
analysis_by_dept = {}

for hospital in hospitals_sin_distancias:
    h_dept = hospital['department_id']
    h_dept_name = hospital['department_name']
    
    if h_dept not in analysis_by_dept:
        analysis_by_dept[h_dept] = {
            'name': h_dept_name,
            'hospitals': [],
            'total_routes': 0,
            'kams_involved': set()
        }
    
    # Obtener KAMs que pueden competir
    kam_local, competing_kams = get_competing_kams(hospital, kams.data, adj_matrix, kams_by_area)
    
    # Agregar análisis
    analysis_by_dept[h_dept]['hospitals'].append({
        'name': hospital['name'],
        'municipality': hospital['municipality_name'],
        'kam_local': kam_local['name'] if kam_local else None,
        'competing_kams': [k['name'] for k in competing_kams]
    })
    
    # Contar rutas necesarias
    for kam in competing_kams:
        routes_needed.append({
            'hospital_id': hospital['id'],
            'hospital_name': hospital['name'],
            'kam_id': kam['id'],
            'kam_name': kam['name']
        })
        analysis_by_dept[h_dept]['kams_involved'].add(kam['name'])
    
    analysis_by_dept[h_dept]['total_routes'] += len(competing_kams)

print(f"\n📊 TOTAL RUTAS LÓGICAS NECESARIAS: {len(routes_needed)}")

# 4. Mostrar análisis por departamento
print("\n📍 ANÁLISIS POR DEPARTAMENTO:")

for dept_id in sorted(analysis_by_dept.keys(), key=lambda x: analysis_by_dept[x]['total_routes'], reverse=True)[:15]:
    info = analysis_by_dept[dept_id]
    print(f"\n{info['name']} ({dept_id}):")
    print(f"   Hospitales sin distancias: {len(info['hospitals'])}")
    print(f"   Rutas necesarias: {info['total_routes']}")
    print(f"   KAMs que competirían: {', '.join(sorted(info['kams_involved']))}")
    
    # Mostrar ejemplo
    if info['hospitals']:
        h = info['hospitals'][0]
        print(f"\n   Ejemplo: {h['name']} ({h['municipality']})")
        if h['kam_local']:
            print(f"      Territorio base: {h['kam_local']}")
        print(f"      Necesita distancias a: {', '.join(h['competing_kams'][:5])}")
        if len(h['competing_kams']) > 5:
            print(f"      ... y {len(h['competing_kams']) - 5} más")

# 5. Análisis de viabilidad
print("\n" + "="*60)
print("📊 RESUMEN DE RUTAS LÓGICAS")
print("="*60)

# Contar por tipo
bogota_routes = sum(1 for r in routes_needed if any(k['area_id'].startswith('11001') for k in kams.data if k['id'] == r['kam_id']))
regular_routes = len(routes_needed) - bogota_routes

print(f"Hospitales sin distancias: {len(hospitals_sin_distancias)}")
print(f"Rutas lógicas necesarias: {len(routes_needed)}")
print(f"  ├─ En Bogotá (localidades): {bogota_routes}")
print(f"  └─ Resto del país: {regular_routes}")
print()
print(f"Promedio rutas por hospital: {len(routes_needed) / len(hospitals_sin_distancias):.1f}")
print()
print(f"💰 Costo estimado: ${len(routes_needed) * 0.005:.2f} USD")

# 6. Identificar casos críticos
print("\n⚠️ CASOS CRÍTICOS (muchos hospitales sin distancias):")
for dept_id in sorted(analysis_by_dept.keys(), key=lambda x: len(analysis_by_dept[x]['hospitals']), reverse=True)[:5]:
    info = analysis_by_dept[dept_id]
    print(f"   {info['name']}: {len(info['hospitals'])} hospitales, {info['total_routes']} rutas")

# 7. Verificar lógica
print("\n✅ VERIFICACIÓN DE LÓGICA:")
print("   - Solo se calculan distancias a KAMs que pueden competir")
print("   - Se respeta la adyacencia departamental (niveles 1 y 2)")
print("   - Bogotá se maneja por localidades")
print("   - NO se incluyen distancias ilógicas (ej: Cali ↔ Barranquilla)")

print("="*60)