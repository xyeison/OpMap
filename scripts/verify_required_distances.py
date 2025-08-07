#!/usr/bin/env python3
"""
Algoritmo para determinar qué KAMs DEBEN tener distancia calculada
para cada hospital según las reglas de OpMap
"""
from supabase import create_client
import json
from datetime import datetime

supabase_url = 'https://norvxqgohddgsdkggqzq.supabase.co'
supabase_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vcnZ4cWdvaGRkZ3Nka2dncXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMDExMjUsImV4cCI6MjA2ODc3NzEyNX0.BRWIYeD_5OlpVKIrP1QzUmkSx6HEVGzcEUUiSK8CmJs'

supabase = create_client(supabase_url, supabase_key)

print("🔍 ALGORITMO DE VERIFICACIÓN DE DISTANCIAS REQUERIDAS")
print("="*60)

# 1. Cargar datos necesarios
print("\n📥 Cargando datos del sistema...")

# Hospitales activos
hospitals = supabase.table('hospitals').select('*').eq('active', True).execute()
print(f"   Hospitales activos: {len(hospitals.data)}")

# KAMs activos
kams = supabase.table('kams').select('*').eq('active', True).execute()
kams_by_area = {}
kams_by_dept = {}
kams_bogota = []

for kam in kams.data:
    area_id = kam['area_id']
    dept = area_id[:2]
    
    # Índice por área (municipio o localidad)
    kams_by_area[area_id] = kam
    
    # Índice por departamento
    if dept not in kams_by_dept:
        kams_by_dept[dept] = []
    kams_by_dept[dept].append(kam)
    
    # KAMs de Bogotá (localidades)
    if area_id.startswith('11001') and len(area_id) > 5:
        kams_bogota.append(kam)

print(f"   KAMs activos: {len(kams.data)}")
print(f"   KAMs en Bogotá: {len(kams_bogota)}")

# Matriz de adyacencia
adjacency = supabase.table('department_adjacency').select('*').execute()
adj_matrix = {}
for row in adjacency.data:
    dept = row['department_code']
    if dept not in adj_matrix:
        adj_matrix[dept] = set()
    adj_matrix[dept].add(row['adjacent_department_code'])

# Departamentos excluidos
excluded = supabase.table('departments').select('code').eq('excluded', True).execute()
excluded_depts = set(d['code'] for d in excluded.data)

# Distancias existentes
distances = supabase.table('hospital_kam_distances').select('hospital_id, kam_id').execute()
existing_distances = {}
for dist in distances.data:
    h_id = dist['hospital_id']
    if h_id not in existing_distances:
        existing_distances[h_id] = set()
    existing_distances[h_id].add(dist['kam_id'])

print(f"   Distancias existentes: {len(distances.data)}")

# 2. ALGORITMO: Determinar KAMs requeridos para cada hospital
print("\n🎯 APLICANDO REGLAS DE OPMAP...")
print("\nREGLAS:")
print("1. Si hospital está en municipio/localidad con KAM → es territorio base (NO necesita distancia)")
print("2. Hospitales en Bogotá → necesitan distancia a TODOS los KAMs de Bogotá excepto el propio")
print("3. Hospitales regulares → necesitan distancia a KAMs que pueden competir:")
print("   - KAMs del mismo departamento")
print("   - KAMs de departamentos fronterizos (Nivel 1)")
print("   - KAMs de fronterizos de fronterizos (Nivel 2)")

def get_required_kams(hospital, all_kams, adj_matrix, kams_by_area, kams_bogota):
    """
    Determina qué KAMs DEBEN tener distancia calculada para este hospital
    Retorna: (kam_territorio_base, lista_kams_competidores)
    """
    h_dept = hospital['department_id']
    h_mun = hospital['municipality_id']
    h_locality = hospital.get('locality_id')
    
    kam_territorio_base = None
    kams_competidores = []
    
    # REGLA 1: Identificar KAM de territorio base
    if h_locality and h_locality in kams_by_area:
        kam_territorio_base = kams_by_area[h_locality]
    elif h_mun in kams_by_area:
        kam_territorio_base = kams_by_area[h_mun]
    elif h_mun[:5] in kams_by_area:
        kam_territorio_base = kams_by_area[h_mun[:5]]
    
    # REGLA 2: Hospitales en Bogotá
    if h_dept == '11' and h_locality:
        # Necesitan distancia a TODOS los KAMs de Bogotá excepto el propio
        for kam in kams_bogota:
            if not kam_territorio_base or kam['id'] != kam_territorio_base['id']:
                kams_competidores.append(kam)
    else:
        # REGLA 3: Hospitales regulares
        for kam in all_kams:
            # Skip si es territorio base
            if kam_territorio_base and kam['id'] == kam_territorio_base['id']:
                continue
            
            kam_dept = kam['area_id'][:2]
            
            # 3.1: KAMs del mismo departamento
            if kam_dept == h_dept:
                kams_competidores.append(kam)
                continue
            
            # 3.2: KAMs de departamentos fronterizos (Nivel 1)
            if h_dept in adj_matrix and kam_dept in adj_matrix[h_dept]:
                kams_competidores.append(kam)
                continue
            
            # 3.3: KAMs de fronterizos de fronterizos (Nivel 2)
            # Solo si el KAM tiene enable_level2 = true (todos lo tienen)
            if kam.get('enable_level2', True):
                found_level2 = False
                if h_dept in adj_matrix:
                    for adj1 in adj_matrix[h_dept]:
                        if adj1 in adj_matrix and kam_dept in adj_matrix[adj1]:
                            kams_competidores.append(kam)
                            found_level2 = True
                            break
    
    return kam_territorio_base, kams_competidores

# 3. Analizar cada hospital
print("\n📊 ANALIZANDO CADA HOSPITAL...")

analysis_results = []
summary = {
    'total_hospitals': 0,
    'hospitals_complete': 0,
    'hospitals_incomplete': 0,
    'hospitals_no_distances': 0,
    'total_distances_required': 0,
    'total_distances_existing': 0,
    'total_distances_missing': 0
}

hospitals_incomplete = []
hospitals_no_distances = []

for hospital in hospitals.data:
    # Skip departamentos excluidos
    if hospital['department_id'] in excluded_depts:
        continue
    
    summary['total_hospitals'] += 1
    
    # Determinar KAMs requeridos
    kam_base, kams_required = get_required_kams(
        hospital, kams.data, adj_matrix, kams_by_area, kams_bogota
    )
    
    # Obtener distancias existentes para este hospital
    h_distances = existing_distances.get(hospital['id'], set())
    
    # Calcular qué falta
    kams_required_ids = set(k['id'] for k in kams_required)
    missing_kams = []
    
    for kam in kams_required:
        if kam['id'] not in h_distances:
            missing_kams.append(kam)
    
    # Clasificar hospital
    is_complete = len(missing_kams) == 0
    has_no_distances = len(h_distances) == 0
    
    if is_complete:
        summary['hospitals_complete'] += 1
    else:
        summary['hospitals_incomplete'] += 1
        
    if has_no_distances:
        summary['hospitals_no_distances'] += 1
        hospitals_no_distances.append(hospital)
    
    summary['total_distances_required'] += len(kams_required)
    summary['total_distances_existing'] += len(h_distances & kams_required_ids)
    summary['total_distances_missing'] += len(missing_kams)
    
    # Guardar resultado detallado
    result = {
        'hospital_id': hospital['id'],
        'hospital_name': hospital['name'],
        'hospital_code': hospital['code'],
        'municipality': hospital['municipality_name'],
        'department': hospital['department_name'],
        'locality': hospital.get('locality_name'),
        'kam_territorio_base': kam_base['name'] if kam_base else None,
        'kams_required_count': len(kams_required),
        'kams_existing_count': len(h_distances & kams_required_ids),
        'kams_missing_count': len(missing_kams),
        'is_complete': is_complete,
        'missing_kams': [k['name'] for k in missing_kams]
    }
    
    analysis_results.append(result)
    
    if not is_complete and len(missing_kams) > 0:
        hospitals_incomplete.append(result)

# 4. Mostrar resultados
print("\n" + "="*60)
print("📊 RESULTADOS DEL ANÁLISIS")
print("="*60)

print(f"\n📈 RESUMEN GENERAL:")
print(f"   Hospitales analizados: {summary['total_hospitals']}")
print(f"   ✅ Completos (tienen todas las distancias): {summary['hospitals_complete']}")
print(f"   ⚠️ Incompletos (faltan distancias): {summary['hospitals_incomplete']}")
print(f"   ❌ Sin ninguna distancia: {summary['hospitals_no_distances']}")

print(f"\n📏 DISTANCIAS:")
print(f"   Requeridas totales: {summary['total_distances_required']}")
print(f"   Existentes: {summary['total_distances_existing']}")
print(f"   Faltantes: {summary['total_distances_missing']}")
print(f"   Cobertura: {summary['total_distances_existing']*100/summary['total_distances_required']:.1f}%")

# Análisis por departamento
by_dept = {}
for result in analysis_results:
    dept = result['department']
    if dept not in by_dept:
        by_dept[dept] = {
            'total': 0,
            'complete': 0,
            'incomplete': 0,
            'missing_distances': 0
        }
    by_dept[dept]['total'] += 1
    if result['is_complete']:
        by_dept[dept]['complete'] += 1
    else:
        by_dept[dept]['incomplete'] += 1
    by_dept[dept]['missing_distances'] += result['kams_missing_count']

print(f"\n📍 DEPARTAMENTOS CON MÁS HOSPITALES INCOMPLETOS:")
sorted_depts = sorted(by_dept.items(), key=lambda x: x[1]['incomplete'], reverse=True)
for dept, stats in sorted_depts[:10]:
    if stats['incomplete'] > 0:
        print(f"   {dept}: {stats['incomplete']}/{stats['total']} incompletos ({stats['missing_distances']} distancias faltantes)")

# Hospitales críticos (sin ninguna distancia)
if hospitals_no_distances:
    print(f"\n⚠️ HOSPITALES CRÍTICOS (sin ninguna distancia):")
    for h in hospitals_no_distances[:10]:
        print(f"   - {h['name']} ({h['municipality_name']}, {h['department_name']})")

# Análisis de KAMs con más distancias faltantes
kam_missing_count = {}
for result in hospitals_incomplete:
    for kam_name in result['missing_kams']:
        if kam_name not in kam_missing_count:
            kam_missing_count[kam_name] = 0
        kam_missing_count[kam_name] += 1

print(f"\n📊 KAMS CON MÁS DISTANCIAS FALTANTES:")
sorted_kams = sorted(kam_missing_count.items(), key=lambda x: x[1], reverse=True)
for kam_name, count in sorted_kams[:10]:
    print(f"   {kam_name}: {count} distancias faltantes")

# 5. Guardar resultados
print("\n💾 Guardando resultados...")

# Resumen general
with open('/Users/yeison/Documents/GitHub/OpMap/output/distance_verification_summary.json', 'w') as f:
    json.dump(summary, f, indent=2)

# Análisis detallado
with open('/Users/yeison/Documents/GitHub/OpMap/output/distance_verification_detailed.json', 'w') as f:
    json.dump(analysis_results, f, indent=2)

# Hospitales incompletos
with open('/Users/yeison/Documents/GitHub/OpMap/output/hospitals_incomplete.json', 'w') as f:
    json.dump(hospitals_incomplete, f, indent=2)

print("\n📄 Archivos guardados:")
print("   - output/distance_verification_summary.json")
print("   - output/distance_verification_detailed.json")
print("   - output/hospitals_incomplete.json")

# 6. Recomendaciones
print("\n" + "="*60)
print("🎯 RECOMENDACIONES")
print("="*60)

if summary['hospitals_no_distances'] > 0:
    print(f"1. CRÍTICO: {summary['hospitals_no_distances']} hospitales sin ninguna distancia")
    print("   → Calcular al menos las distancias a KAMs cercanos")

if summary['total_distances_missing'] > 0:
    print(f"2. Faltan {summary['total_distances_missing']} distancias para completitud total")
    print("   → Priorizar hospitales con contratos grandes")

print("\n3. Para cada hospital se verificó:")
print("   ✓ Si tiene KAM en territorio base (no necesita distancia)")
print("   ✓ Si está en Bogotá (necesita distancia a otros KAMs de Bogotá)")
print("   ✓ Qué KAMs pueden competir (mismo depto + fronterizos nivel 1 y 2)")

print("\n" + "="*60)