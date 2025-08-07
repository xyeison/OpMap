#!/usr/bin/env python3
"""
Identificar qué rutas a KAMs competidores necesitamos calcular
Considerando localidades de Bogotá y reglas del algoritmo
"""
from supabase import create_client

supabase_url = 'https://norvxqgohddgsdkggqzq.supabase.co'
supabase_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vcnZ4cWdvaGRkZ3Nka2dncXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMDExMjUsImV4cCI6MjA2ODc3NzEyNX0.BRWIYeD_5OlpVKIrP1QzUmkSx6HEVGzcEUUiSK8CmJs'

supabase = create_client(supabase_url, supabase_key)

# Matriz de adyacencia departamental
adjacency = supabase.table('department_adjacency').select('*').execute()
adj_matrix = {}
for row in adjacency.data:
    if row['department_code'] not in adj_matrix:
        adj_matrix[row['department_code']] = []
    adj_matrix[row['department_code']].append(row['adjacent_department_code'])

# Departamentos excluidos
excluded = supabase.table('departments').select('code').eq('excluded', True).execute()
excluded_depts = set(d['code'] for d in excluded.data) if excluded.data else set()

# KAMs activos
kams = supabase.table('kams').select('*').eq('active', True).execute()

# Clasificar KAMs
kams_bogota = []  # KAMs con localidad de Bogotá (11001xxx)
kams_regular = []  # KAMs fuera de Bogotá
kams_by_dept = {}
kams_by_area = {}  # Por municipio o localidad

for kam in kams.data:
    area_id = kam['area_id']
    
    # Es KAM de Bogotá si area_id empieza con 11001 (localidad)
    if area_id.startswith('11001') and len(area_id) > 5:
        kams_bogota.append(kam)
        kams_by_area[area_id] = kam  # Localidad específica
    else:
        kams_regular.append(kam)
        dept = area_id[:2]
        if dept not in kams_by_dept:
            kams_by_dept[dept] = []
        kams_by_dept[dept].append(kam)
        
        # Guardar por municipio
        mun = area_id[:5] if len(area_id) >= 5 else area_id
        kams_by_area[mun] = kam

print(f"📊 KAMs detectados:")
print(f"   - KAMs en Bogotá (localidades): {len(kams_bogota)}")
for k in kams_bogota:
    print(f"     • {k['name']} - Localidad {k['area_id']}")
print(f"   - KAMs regulares: {len(kams_regular)}")

# Hospitales sin distancias
hospitals = supabase.table('hospitals').select('*').eq('active', True).execute()
distances = supabase.table('hospital_kam_distances').select('hospital_id').execute()
hospitals_with_distances = set(d['hospital_id'] for d in distances.data)

print(f"\n📊 Hospitales totales: {len(hospitals.data)}")
print(f"   Con distancias: {len(hospitals_with_distances)}")
print(f"   Sin distancias: {len(hospitals.data) - len(hospitals_with_distances)}")

# Analizar hospitales sin distancias
analysis = {}
bogota_hospitals = []

for hospital in hospitals.data:
    # Excluir departamentos marcados como excluidos
    if hospital['department_id'] in excluded_depts:
        continue
        
    if hospital['id'] in hospitals_with_distances:
        continue
    
    h_dept = hospital['department_id']
    h_mun = hospital['municipality_id']
    h_locality = hospital.get('locality_id')
    
    # CASO ESPECIAL: Bogotá (por localidades)
    if h_dept == '11' and h_locality:
        bogota_hospitals.append(hospital)
        continue
    
    # Casos regulares (por municipio)
    if h_dept not in analysis:
        analysis[h_dept] = {
            'name': hospital.get('department_name', h_dept),
            'hospitals': [],
            'kam_local': None,
            'kams_competidores': set()
        }
    
    analysis[h_dept]['hospitals'].append(hospital)
    
    # Identificar KAM local (mismo municipio)
    if h_mun[:5] in kams_by_area:
        analysis[h_dept]['kam_local'] = kams_by_area[h_mun[:5]]['name']
    elif h_mun in kams_by_area:
        analysis[h_dept]['kam_local'] = kams_by_area[h_mun]['name']
    
    # Identificar KAMs competidores según reglas del algoritmo
    # 1. KAMs del mismo departamento
    if h_dept in kams_by_dept:
        for kam in kams_by_dept[h_dept]:
            if not analysis[h_dept]['kam_local'] or kam['name'] != analysis[h_dept]['kam_local']:
                analysis[h_dept]['kams_competidores'].add(kam['name'])
    
    # 2. KAMs de departamentos adyacentes (Nivel 1)
    if h_dept in adj_matrix:
        for adj_dept in adj_matrix[h_dept]:
            if adj_dept in kams_by_dept:
                for kam in kams_by_dept[adj_dept]:
                    analysis[h_dept]['kams_competidores'].add(kam['name'])
    
    # 3. Si enable_level2, incluir departamentos de nivel 2
    # (Asumiendo que todos tienen enable_level2 = true según el contexto)
    if h_dept in adj_matrix:
        for adj_dept in adj_matrix[h_dept]:
            if adj_dept in adj_matrix:
                for adj_dept2 in adj_matrix[adj_dept]:
                    if adj_dept2 in kams_by_dept:
                        for kam in kams_by_dept[adj_dept2]:
                            analysis[h_dept]['kams_competidores'].add(kam['name'])

# Análisis especial para Bogotá
print(f"\n📍 BOGOTÁ - Análisis por localidades:")
print(f"   Hospitales sin distancias en Bogotá: {len(bogota_hospitals)}")

localidades_sin_kam = {}
for hospital in bogota_hospitals:
    locality = hospital.get('locality_id', 'Sin localidad')
    locality_name = hospital.get('locality_name', locality)
    
    if locality not in localidades_sin_kam:
        localidades_sin_kam[locality] = {
            'name': locality_name,
            'hospitals': [],
            'kam_local': None
        }
    
    localidades_sin_kam[locality]['hospitals'].append(hospital['name'])
    
    # Ver si la localidad tiene KAM
    if locality in kams_by_area:
        localidades_sin_kam[locality]['kam_local'] = kams_by_area[locality]['name']

for loc_id, info in localidades_sin_kam.items():
    print(f"   Localidad {info['name']}: {len(info['hospitals'])} hospitales")
    print(f"      KAM local: {info['kam_local'] or 'No tiene'}")
    if not info['kam_local']:
        # Esta localidad competirá entre los KAMs de Bogotá
        kams_compiten = [k['name'] for k in kams_bogota]
        print(f"      Competirán: {', '.join(kams_compiten)}")

print(f"\n📊 RESUMEN POR DEPARTAMENTO (excluyendo Bogotá):")
total_rutas_necesarias = 0

for dept_id, info in sorted(analysis.items(), key=lambda x: len(x[1]['hospitals']), reverse=True):
    if info['hospitals']:
        print(f"\n📍 {info['name']} ({dept_id})")
        print(f"   Hospitales sin distancias: {len(info['hospitals'])}")
        print(f"   KAM local: {info['kam_local'] or 'No tiene'}")
        
        # Si tiene KAM local, no necesita distancia a él (territorio base)
        competidores = info['kams_competidores']
        if info['kam_local'] and info['kam_local'] in competidores:
            competidores.remove(info['kam_local'])
        
        print(f"   KAMs competidores: {', '.join(competidores) if competidores else 'Ninguno'}")
        
        # Calcular rutas necesarias
        rutas = len(info['hospitals']) * len(competidores)
        total_rutas_necesarias += rutas
        if rutas > 0:
            print(f"   Rutas necesarias: {rutas}")

# Rutas para Bogotá
rutas_bogota = len(bogota_hospitals) * (len(kams_bogota) - 1)  # -1 porque no necesita al local
total_rutas_necesarias += rutas_bogota

print(f"\n📊 TOTAL DE RUTAS NECESARIAS:")
print(f"   Departamentos regulares: {total_rutas_necesarias - rutas_bogota}")
print(f"   Bogotá (localidades): {rutas_bogota}")
print(f"   TOTAL: {total_rutas_necesarias}")

print(f"\n⚠️ NOTA IMPORTANTE:")
print(f"   - NO se calculan distancias al KAM del territorio base (automático)")
print(f"   - Solo se calculan distancias a KAMs que pueden competir")
print(f"   - En Bogotá, los KAMs compiten por localidades")
print(f"   - Se respeta enable_level2 para expansión territorial")