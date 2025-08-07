#!/usr/bin/env python3
"""
Verificar cobertura COMPLETA de distancias
Cada hospital debe tener distancias a TODOS los KAMs que pueden competir por él
"""
from supabase import create_client

supabase_url = 'https://norvxqgohddgsdkggqzq.supabase.co'
supabase_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vcnZ4cWdvaGRkZ3Nka2dncXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMDExMjUsImV4cCI6MjA2ODc3NzEyNX0.BRWIYeD_5OlpVKIrP1QzUmkSx6HEVGzcEUUiSK8CmJs'

supabase = create_client(supabase_url, supabase_key)

print("🔍 VERIFICACIÓN DE COBERTURA COMPLETA")
print("="*60)

# 1. Cargar datos necesarios
print("📥 Cargando datos...")

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
kams_by_area = {}
kams_by_dept = {}

for kam in kams.data:
    area_id = kam['area_id']
    dept = area_id[:2]
    
    kams_by_area[area_id] = kam
    
    if dept not in kams_by_dept:
        kams_by_dept[dept] = []
    kams_by_dept[dept].append(kam)

print(f"   KAMs activos: {len(kams.data)}")

# Hospitales activos
hospitals = supabase.table('hospitals').select('*').eq('active', True).execute()
hospitals_not_excluded = [h for h in hospitals.data if h['department_id'] not in excluded_set]
print(f"   Hospitales en deptos activos: {len(hospitals_not_excluded)}")

# Distancias existentes
all_distances = []
offset = 0
while True:
    batch = supabase.table('hospital_kam_distances').select('hospital_id, kam_id').range(offset, offset + 999).execute()
    if not batch.data:
        break
    all_distances.extend(batch.data)
    offset += 1000
    if len(batch.data) < 1000:
        break

print(f"   Distancias totales: {len(all_distances)}")

# Crear índice de distancias por hospital
distances_by_hospital = {}
for d in all_distances:
    h_id = d['hospital_id']
    if h_id not in distances_by_hospital:
        distances_by_hospital[h_id] = set()
    distances_by_hospital[h_id].add(d['kam_id'])

# 2. Función para determinar KAMs que DEBEN competir
def get_required_kams(hospital, all_kams, adj_matrix, kams_by_area):
    """
    Determina qué KAMs DEBEN tener distancia a este hospital
    según las reglas del algoritmo
    """
    h_dept = hospital['department_id']
    h_mun = hospital['municipality_id']
    h_locality = hospital.get('locality_id')
    
    required_kams = set()
    
    # Verificar si hay KAM local (territorio base)
    kam_local = None
    if h_locality and h_locality in kams_by_area:
        kam_local = kams_by_area[h_locality]
    elif h_mun in kams_by_area:
        kam_local = kams_by_area[h_mun]
    elif h_mun[:5] in kams_by_area:
        kam_local = kams_by_area[h_mun[:5]]
    
    # Si es territorio base, NO necesita distancia (asignación automática)
    # Pero sí necesita distancias a los KAMs que pueden competir
    
    # CASO BOGOTÁ
    if h_dept == '11' and h_locality:
        for kam in all_kams:
            if kam['area_id'].startswith('11001'):
                # Todos los KAMs de Bogotá necesitan distancia
                # (excepto si es su propio territorio base)
                if not kam_local or kam['id'] != kam_local['id']:
                    required_kams.add(kam['id'])
    else:
        # CASO REGULAR
        for kam in all_kams:
            # Skip si es territorio base
            if kam_local and kam['id'] == kam_local['id']:
                continue
            
            kam_dept = kam['area_id'][:2]
            
            # KAM del mismo departamento
            if kam_dept == h_dept:
                required_kams.add(kam['id'])
                continue
            
            # Nivel 1: departamento adyacente
            if h_dept in adj_matrix and kam_dept in adj_matrix[h_dept]:
                required_kams.add(kam['id'])
                continue
            
            # Nivel 2: adyacente del adyacente
            if kam.get('enable_level2', True):
                if h_dept in adj_matrix:
                    for adj1 in adj_matrix[h_dept]:
                        if adj1 in adj_matrix and kam_dept in adj_matrix[adj1]:
                            required_kams.add(kam['id'])
                            break
    
    return kam_local, required_kams

# 3. Verificar cada hospital
print("\n🔍 ANALIZANDO COBERTURA COMPLETA...")
print("-"*60)

hospitals_complete = []
hospitals_partial = []
hospitals_none = []
total_routes_missing = 0

for hospital in hospitals_not_excluded:
    h_id = hospital['id']
    
    # Determinar qué KAMs necesitan distancia
    kam_local, required_kams = get_required_kams(hospital, kams.data, adj_matrix, kams_by_area)
    
    # Verificar qué distancias tiene
    existing_kams = distances_by_hospital.get(h_id, set())
    
    # Calcular faltantes
    missing_kams = required_kams - existing_kams
    
    if len(required_kams) == 0 and kam_local:
        # Es territorio base sin competidores
        hospitals_complete.append({
            'hospital': hospital,
            'reason': f'Territorio base de {kam_local["name"]} sin competidores'
        })
    elif len(missing_kams) == 0:
        # Tiene todas las distancias necesarias
        hospitals_complete.append({
            'hospital': hospital,
            'reason': f'Completo: {len(existing_kams)} distancias'
        })
    elif len(existing_kams) > 0:
        # Tiene algunas pero no todas
        hospitals_partial.append({
            'hospital': hospital,
            'existing': len(existing_kams),
            'required': len(required_kams),
            'missing': len(missing_kams),
            'missing_kams': missing_kams
        })
        total_routes_missing += len(missing_kams)
    else:
        # No tiene ninguna distancia
        hospitals_none.append({
            'hospital': hospital,
            'required': len(required_kams),
            'missing_kams': missing_kams
        })
        total_routes_missing += len(required_kams)

# 4. Mostrar resultados
print(f"\n📊 RESUMEN DE COBERTURA:")
print(f"   Hospitales con cobertura COMPLETA: {len(hospitals_complete)}")
print(f"   Hospitales con cobertura PARCIAL: {len(hospitals_partial)}")
print(f"   Hospitales SIN ninguna distancia: {len(hospitals_none)}")
print(f"   TOTAL hospitales analizados: {len(hospitals_not_excluded)}")

# 5. Detalles de hospitales con cobertura parcial
if hospitals_partial:
    print(f"\n⚠️ HOSPITALES CON COBERTURA PARCIAL ({len(hospitals_partial)}):")
    print("-"*60)
    
    # Agrupar por departamento
    by_dept = {}
    for item in hospitals_partial:
        h = item['hospital']
        dept = h['department_name']
        if dept not in by_dept:
            by_dept[dept] = []
        by_dept[dept].append(item)
    
    for dept in sorted(by_dept.keys()):
        items = by_dept[dept]
        total_missing = sum(item['missing'] for item in items)
        print(f"\n{dept}: {len(items)} hospitales, {total_missing} rutas faltantes")
        
        for item in items[:3]:  # Mostrar hasta 3 ejemplos
            h = item['hospital']
            print(f"   • {h['name']} ({h['municipality_name']})")
            print(f"     Tiene: {item['existing']}/{item['required']} distancias")
            print(f"     Faltan: {item['missing']} rutas")

# 6. Detalles de hospitales sin ninguna distancia
if hospitals_none:
    print(f"\n❌ HOSPITALES SIN NINGUNA DISTANCIA ({len(hospitals_none)}):")
    print("-"*60)
    
    # Agrupar por departamento
    by_dept = {}
    for item in hospitals_none:
        h = item['hospital']
        dept = h['department_name']
        if dept not in by_dept:
            by_dept[dept] = []
        by_dept[dept].append(item)
    
    for dept in sorted(by_dept.keys(), key=lambda x: len(by_dept[x]), reverse=True)[:5]:
        items = by_dept[dept]
        total_required = sum(item['required'] for item in items)
        print(f"\n{dept}: {len(items)} hospitales, {total_required} rutas necesarias")
        
        for item in items[:2]:  # Mostrar hasta 2 ejemplos
            h = item['hospital']
            print(f"   • {h['name']} ({h['municipality_name']})")
            print(f"     Código: {h['code']}")
            print(f"     Necesita: {item['required']} distancias")

# 7. Análisis de rutas faltantes por KAM
print(f"\n📍 ANÁLISIS DE RUTAS FALTANTES POR KAM:")
print("-"*60)

missing_by_kam = {}
for item in hospitals_partial + hospitals_none:
    for kam_id in item['missing_kams']:
        if kam_id not in missing_by_kam:
            missing_by_kam[kam_id] = 0
        missing_by_kam[kam_id] += 1

# Obtener nombres de KAMs
kam_names = {k['id']: k['name'] for k in kams.data}

for kam_id, count in sorted(missing_by_kam.items(), key=lambda x: x[1], reverse=True):
    kam_name = kam_names.get(kam_id, 'Unknown')
    print(f"   {kam_name}: {count} rutas faltantes")

# 8. Resumen final
print("\n" + "="*60)
print("📊 EVALUACIÓN FINAL DE COBERTURA")
print("="*60)

coverage_complete = len(hospitals_complete) * 100 / len(hospitals_not_excluded)
coverage_partial = len(hospitals_partial) * 100 / len(hospitals_not_excluded)
coverage_none = len(hospitals_none) * 100 / len(hospitals_not_excluded)

print(f"Cobertura COMPLETA: {len(hospitals_complete)}/{len(hospitals_not_excluded)} ({coverage_complete:.1f}%)")
print(f"Cobertura PARCIAL: {len(hospitals_partial)}/{len(hospitals_not_excluded)} ({coverage_partial:.1f}%)")
print(f"Sin cobertura: {len(hospitals_none)}/{len(hospitals_not_excluded)} ({coverage_none:.1f}%)")

print(f"\n🎯 RUTAS FALTANTES:")
print(f"   Total rutas que faltan: {total_routes_missing}")
print(f"   Costo estimado: ${total_routes_missing * 0.005:.2f} USD")
print(f"   Tiempo estimado: {total_routes_missing * 0.3 / 60:.1f} minutos")

if coverage_complete >= 95:
    print(f"\n✅ EXCELENTE: El algoritmo puede funcionar con alta precisión")
elif coverage_complete >= 80:
    print(f"\n⚠️ BUENO: El algoritmo funcionará pero con limitaciones")
elif coverage_complete >= 60:
    print(f"\n⚠️ REGULAR: El algoritmo tendrá problemas significativos")
else:
    print(f"\n❌ INSUFICIENTE: Se requieren muchas más distancias")

print("="*60)