#!/usr/bin/env python3
"""
Analizar por qué 46 hospitales no tienen distancias calculadas
"""
from supabase import create_client

supabase_url = 'https://norvxqgohddgsdkggqzq.supabase.co'
supabase_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vcnZ4cWdvaGRkZ3Nka2dncXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMDExMjUsImV4cCI6MjA2ODc3NzEyNX0.BRWIYeD_5OlpVKIrP1QzUmkSx6HEVGzcEUUiSK8CmJs'

supabase = create_client(supabase_url, supabase_key)

print("🔍 ANÁLISIS DE HOSPITALES SIN DISTANCIAS")
print("="*60)

# 1. Obtener datos necesarios
excluded_depts = supabase.table('departments').select('code').eq('excluded', True).execute()
excluded_set = set(d['code'] for d in excluded_depts.data)

hospitals = supabase.table('hospitals').select('*').eq('active', True).execute()
distances = supabase.table('hospital_kam_distances').select('hospital_id').execute()
hospitals_with_distances = set(d['hospital_id'] for d in distances.data)

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
kams_by_area = {}
kams_by_dept = {}

for kam in kams.data:
    area_id = kam['area_id']
    dept = area_id[:2]
    
    kams_by_area[area_id] = kam
    
    if dept not in kams_by_dept:
        kams_by_dept[dept] = []
    kams_by_dept[dept].append(kam)

# 2. Identificar hospitales sin distancias
hospitals_without_distances = []
for h in hospitals.data:
    if h['department_id'] not in excluded_set and h['id'] not in hospitals_with_distances:
        hospitals_without_distances.append(h)

print(f"Total hospitales sin distancias (en deptos no excluidos): {len(hospitals_without_distances)}")
print()

# 3. Analizar cada hospital sin distancias
analysis = []

for h in hospitals_without_distances:
    h_dept = h['department_id']
    h_mun = h['municipality_id']
    h_locality = h.get('locality_id')
    
    # Verificar si tiene KAM local (territorio base)
    kam_local = None
    if h_locality and h_locality in kams_by_area:
        kam_local = kams_by_area[h_locality]
    elif h_mun in kams_by_area:
        kam_local = kams_by_area[h_mun]
    elif h_mun[:5] in kams_by_area:
        kam_local = kams_by_area[h_mun[:5]]
    
    # Determinar KAMs que DEBERÍAN competir
    competing_kams = []
    
    # CASO BOGOTÁ
    if h_dept == '11' and h_locality:
        for kam in kams.data:
            if kam['area_id'].startswith('11001'):
                if not kam_local or kam['id'] != kam_local['id']:
                    competing_kams.append(kam['name'])
    else:
        # CASO REGULAR
        # KAMs del mismo departamento
        if h_dept in kams_by_dept:
            for kam in kams_by_dept[h_dept]:
                if not kam_local or kam['id'] != kam_local['id']:
                    competing_kams.append(kam['name'])
        
        # KAMs de departamentos adyacentes (Nivel 1)
        if h_dept in adj_matrix:
            for adj_dept in adj_matrix[h_dept]:
                if adj_dept in kams_by_dept:
                    for kam in kams_by_dept[adj_dept]:
                        if kam['name'] not in competing_kams:
                            competing_kams.append(kam['name'])
        
        # KAMs de nivel 2
        if h_dept in adj_matrix:
            for adj1 in adj_matrix[h_dept]:
                if adj1 in adj_matrix:
                    for adj2 in adj_matrix[adj1]:
                        if adj2 in kams_by_dept:
                            for kam in kams_by_dept[adj2]:
                                if kam.get('enable_level2', True) and kam['name'] not in competing_kams:
                                    competing_kams.append(kam['name'])
    
    analysis.append({
        'hospital': h,
        'kam_local': kam_local['name'] if kam_local else None,
        'competing_kams': competing_kams,
        'total_kams_needed': len(competing_kams) + (1 if kam_local else 0)
    })

# 4. Agrupar por departamento y analizar
by_dept = {}
for item in analysis:
    h = item['hospital']
    dept_name = h['department_name']
    dept_id = h['department_id']
    
    if dept_id not in by_dept:
        by_dept[dept_id] = {
            'name': dept_name,
            'hospitals': [],
            'has_local_kam': dept_id in kams_by_dept,
            'adjacent_depts': list(adj_matrix.get(dept_id, [])),
            'total_routes_needed': 0
        }
    
    by_dept[dept_id]['hospitals'].append(item)
    by_dept[dept_id]['total_routes_needed'] += item['total_kams_needed']

# 5. Mostrar análisis detallado
print("📊 ANÁLISIS POR DEPARTAMENTO:")
print("-"*60)

for dept_id in sorted(by_dept.keys(), key=lambda x: len(by_dept[x]['hospitals']), reverse=True):
    info = by_dept[dept_id]
    
    print(f"\n🏥 {info['name']} ({dept_id})")
    print(f"   Hospitales sin distancias: {len(info['hospitals'])}")
    print(f"   ¿Tiene KAM local?: {'SÍ' if info['has_local_kam'] else 'NO'}")
    
    if info['has_local_kam']:
        local_kams = [k['name'] for k in kams_by_dept.get(dept_id, [])]
        print(f"   KAMs locales: {', '.join(local_kams)}")
    
    print(f"   Departamentos adyacentes: {', '.join(info['adjacent_depts']) if info['adjacent_depts'] else 'Ninguno'}")
    print(f"   Rutas totales necesarias: {info['total_routes_needed']}")
    
    # Mostrar ejemplos
    print(f"\n   Ejemplos de hospitales:")
    for item in info['hospitals'][:3]:
        h = item['hospital']
        print(f"\n   • {h['name']}")
        print(f"     Municipio: {h['municipality_name']} ({h['municipality_id']})")
        print(f"     Código: {h['code']}")
        print(f"     Camas: {h.get('beds', 0)}")
        
        if item['kam_local']:
            print(f"     ✅ Territorio base de: {item['kam_local']}")
        else:
            print(f"     ❌ NO es territorio base de ningún KAM")
        
        if item['competing_kams']:
            print(f"     Debería tener distancias a: {', '.join(item['competing_kams'][:5])}")
            if len(item['competing_kams']) > 5:
                print(f"     ... y {len(item['competing_kams']) - 5} KAMs más")
        else:
            print(f"     ⚠️ No hay KAMs que puedan competir por este hospital")

# 6. Identificar posibles problemas
print("\n"*2)
print("🔍 ANÁLISIS DE CAUSAS POSIBLES:")
print("="*60)

# Hospitales sin KAMs competidores
sin_competidores = [item for item in analysis if not item['competing_kams'] and not item['kam_local']]
if sin_competidores:
    print(f"\n❌ {len(sin_competidores)} hospitales NO tienen KAMs que puedan competir:")
    for item in sin_competidores[:5]:
        h = item['hospital']
        print(f"   - {h['name']} ({h['municipality_name']}, {h['department_name']})")

# Hospitales que son territorio base pero sin distancias a competidores
territorio_base_sin_competidores = [item for item in analysis if item['kam_local'] and not item['competing_kams']]
if territorio_base_sin_competidores:
    print(f"\n✅ {len(territorio_base_sin_competidores)} hospitales son TERRITORIO BASE y no tienen competidores:")
    for item in territorio_base_sin_competidores[:5]:
        h = item['hospital']
        print(f"   - {h['name']} - Territorio base de {item['kam_local']}")

# Hospitales que deberían tener distancias
deberian_tener = [item for item in analysis if item['competing_kams']]
if deberian_tener:
    print(f"\n⚠️ {len(deberian_tener)} hospitales DEBERÍAN tener distancias calculadas:")
    total_routes = sum(item['total_kams_needed'] for item in deberian_tener)
    print(f"   Total rutas faltantes: {total_routes}")
    print(f"   Costo estimado: ${total_routes * 0.005:.2f} USD")
    
    # Verificar si fueron creados recientemente
    print(f"\n   Verificando fechas de creación...")
    for item in deberian_tener[:3]:
        h = item['hospital']
        print(f"   - {h['name']}")
        print(f"     ID: {h['id']}")
        print(f"     Creado: {h.get('created_at', 'No disponible')}")

# 7. Resumen final
print("\n"*2)
print("📊 RESUMEN:")
print("="*60)
print(f"Total hospitales sin distancias: {len(hospitals_without_distances)}")
print(f"  - Sin KAMs que puedan competir: {len(sin_competidores)}")
print(f"  - Territorio base sin competidores: {len(territorio_base_sin_competidores)}")
print(f"  - Deberían tener distancias: {len(deberian_tener)}")

if deberian_tener:
    print(f"\n🎯 ACCIÓN REQUERIDA:")
    print(f"   Calcular {sum(item['total_kams_needed'] for item in deberian_tener)} rutas faltantes")
    print(f"   Para {len(deberian_tener)} hospitales")
else:
    print(f"\n✅ Los hospitales sin distancias NO las necesitan según las reglas del algoritmo")

print("="*60)