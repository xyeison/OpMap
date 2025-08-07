#!/usr/bin/env python3
"""
Identificar qué rutas a KAMs competidores necesitamos calcular
"""
from supabase import create_client

supabase_url = 'https://norvxqgohddgsdkggqzq.supabase.co'
supabase_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vcnZ4cWdvaGRkZ3Nka2dncXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMDExMjUsImV4cCI6MjA2ODc3NzEyNX0.BRWIYeD_5OlpVKIrP1QzUmkSx6HEVGzcEUUiSK8CmJs'

supabase = create_client(supabase_url, supabase_key)

# Matriz de adyacencia
adjacency = supabase.table('department_adjacency').select('*').execute()
adj_matrix = {}
for row in adjacency.data:
    if row['department_code'] not in adj_matrix:
        adj_matrix[row['department_code']] = []
    adj_matrix[row['department_code']].append(row['adjacent_department_code'])

# KAMs activos
kams = supabase.table('kams').select('*').eq('active', True).execute()
kams_by_dept = {}
for kam in kams.data:
    dept = kam['area_id'][:2]
    if dept not in kams_by_dept:
        kams_by_dept[dept] = []
    kams_by_dept[dept].append(kam)

# Hospitales sin distancias
hospitals = supabase.table('hospitals').select('*').eq('active', True).execute()
distances = supabase.table('hospital_kam_distances').select('hospital_id').execute()
hospitals_with_distances = set(d['hospital_id'] for d in distances.data)

print("📊 Análisis de rutas faltantes a KAMs competidores:\n")

# Analizar por departamento
dept_analysis = {}

for hospital in hospitals.data:
    if hospital['id'] in hospitals_with_distances:
        continue
    
    h_dept = hospital['department_id']
    h_mun = hospital['municipality_id']
    
    if h_dept not in dept_analysis:
        dept_analysis[h_dept] = {
            'name': hospital.get('department_name', h_dept),
            'hospitals_sin_distancia': [],
            'kam_local': None,
            'kams_competidores': []
        }
    
    dept_analysis[h_dept]['hospitals_sin_distancia'].append(hospital['name'])
    
    # Identificar KAM local
    for kam in kams.data:
        if kam['area_id'][:5] == h_mun[:5] or kam['area_id'] == h_mun:
            dept_analysis[h_dept]['kam_local'] = kam['name']
    
    # Identificar KAMs competidores (departamentos vecinos)
    if h_dept in adj_matrix:
        for adj_dept in adj_matrix[h_dept]:
            if adj_dept in kams_by_dept:
                for kam in kams_by_dept[adj_dept]:
                    if kam['name'] not in dept_analysis[h_dept]['kams_competidores']:
                        dept_analysis[h_dept]['kams_competidores'].append(kam['name'])

# Mostrar resultados
for dept_id, info in dept_analysis.items():
    if info['hospitals_sin_distancia']:
        print(f"📍 Departamento: {info['name']} ({dept_id})")
        print(f"   Hospitales sin distancias: {len(info['hospitals_sin_distancia'])}")
        print(f"   KAM local: {info['kam_local'] or 'No tiene'}")
        print(f"   KAMs competidores que necesitan distancias: {', '.join(info['kams_competidores']) if info['kams_competidores'] else 'Ninguno'}")
        print()

# Calcular total de rutas necesarias
total_rutas = 0
for dept_id, info in dept_analysis.items():
    total_rutas += len(info['hospitals_sin_distancia']) * len(info['kams_competidores'])

print(f"\n📊 TOTAL DE RUTAS A COMPETIDORES NECESARIAS: {total_rutas}")
print("\nNota: NO se necesitan calcular distancias al KAM local (territorio base)")
print("Solo se necesitan distancias a KAMs de departamentos vecinos para respaldo")