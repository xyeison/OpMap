#!/usr/bin/env python3
"""
Ejecuta el algoritmo OpMap COMPLETO usando SOLO datos de Supabase
"""

import os
from dotenv import load_dotenv
from supabase import create_client, Client
from datetime import datetime

# Cargar variables de entorno
load_dotenv()

# Inicializar Supabase
supabase_url = os.getenv('SUPABASE_URL')
supabase_key = os.getenv('SUPABASE_ANON_KEY')
supabase: Client = create_client(supabase_url, supabase_key)

print("🚀 EJECUTANDO ALGORITMO COMPLETO CON DATOS DE SUPABASE\n")

# 1. Cargar KAMs
kams_response = supabase.table('kams').select('*').eq('active', True).execute()
kams = {kam['id']: kam for kam in kams_response.data}
print(f"✅ {len(kams)} KAMs activos cargados")

# 2. Cargar Hospitales
hospitals_response = supabase.table('hospitals').select('*').eq('active', True).execute()
hospitals = {h['id']: h for h in hospitals_response.data}
print(f"✅ {len(hospitals)} hospitales activos cargados")

# 3. Cargar matriz de adyacencia
adjacency_response = supabase.table('department_adjacency').select('*').execute()
adjacency = {}
for row in adjacency_response.data:
    dept = row['department_code']
    if dept not in adjacency:
        adjacency[dept] = []
    adjacency[dept].append(row['adjacent_department_code'])

# 4. Limpiar asignaciones anteriores
print("\n🗑️ Limpiando asignaciones anteriores...")
supabase.table('assignments').delete().neq('id', '00000000-0000-0000-0000-000000000000').execute()

# 5. FASE 1: Asignar territorio base
print("\n🏠 FASE 1: Asignando territorios base...")
assignments = []
assigned_hospitals = set()

for kam_id, kam in kams.items():
    base_hospitals = []
    
    # Para KAMs de Bogotá (localidades)
    if kam['area_id'].startswith('11001'):
        base_hospitals = [h for h in hospitals.values() 
                         if h['locality_id'] == kam['area_id'] 
                         and h['id'] not in assigned_hospitals]
    else:
        # Para otros KAMs (municipios)
        base_hospitals = [h for h in hospitals.values() 
                         if h['municipality_id'] == kam['area_id'] 
                         and h['id'] not in assigned_hospitals]
    
    print(f"  {kam['name']}: {len(base_hospitals)} hospitales en territorio base")
    
    for hospital in base_hospitals:
        assignments.append({
            'kam_id': kam_id,
            'hospital_id': hospital['id'],
            'travel_time': 0,
            'assignment_type': 'territory_base'
        })
        assigned_hospitals.add(hospital['id'])

print(f"\n✅ Total asignados en territorio base: {len(assignments)}")

# 6. FASE 2: Competencia por localidades de Bogotá
print("\n🏙️ FASE 2: Competencia por localidades de Bogotá...")
bogota_kams = [k for k in kams.values() if k['area_id'].startswith('11001')]
bogota_hospitals = [h for h in hospitals.values() 
                   if h['department_id'] == '11' 
                   and h['locality_id'] 
                   and h['id'] not in assigned_hospitals]

print(f"  KAMs de Bogotá: {len(bogota_kams)}")
print(f"  Hospitales sin asignar en Bogotá: {len(bogota_hospitals)}")

# Agrupar por localidad
localities = {}
for h in bogota_hospitals:
    if h['locality_id'] not in localities:
        localities[h['locality_id']] = []
    localities[h['locality_id']].append(h)

for locality_id, locality_hospitals in localities.items():
    print(f"\n  Localidad {locality_id}: {len(locality_hospitals)} hospitales")
    
    # Para cada hospital, encontrar el KAM más cercano
    votes = {}
    hospital_assignments = []
    
    for hospital in locality_hospitals:
        best_kam = None
        best_time = float('inf')
        
        for kam in bogota_kams:
            # Buscar tiempo en caché
            cache_result = supabase.table('travel_time_cache').select('travel_time').eq(
                'origin_lat', round(kam['lat'], 6)
            ).eq(
                'origin_lng', round(kam['lng'], 6)
            ).eq(
                'dest_lat', round(hospital['lat'], 6)
            ).eq(
                'dest_lng', round(hospital['lng'], 6)
            ).execute()
            
            if cache_result.data:
                time = cache_result.data[0]['travel_time']
                if time < best_time and time <= kam['max_travel_time'] * 60:
                    best_time = time
                    best_kam = kam
        
        if best_kam:
            votes[best_kam['id']] = votes.get(best_kam['id'], 0) + 1
            hospital_assignments.append({
                'hospital': hospital,
                'kam': best_kam,
                'time': best_time
            })
    
    # Determinar ganador por mayoría
    if votes:
        winner_id = max(votes, key=votes.get)
        winner = kams[winner_id]
        print(f"    Ganador: {winner['name']} con {votes[winner_id]}/{len(locality_hospitals)} hospitales")
        
        # Asignar todos los hospitales al ganador
        for item in hospital_assignments:
            assignments.append({
                'kam_id': winner_id,
                'hospital_id': item['hospital']['id'],
                'travel_time': item['time'] if item['kam']['id'] == winner_id else None,
                'assignment_type': 'automatic'
            })
            assigned_hospitals.add(item['hospital']['id'])

# 7. FASE 3: Asignación competitiva fuera de Bogotá
print("\n🏃 FASE 3: Asignación competitiva fuera de Bogotá...")
unassigned = [h for h in hospitals.values() 
              if h['id'] not in assigned_hospitals 
              and h['department_id'] != '11']

print(f"  Hospitales sin asignar: {len(unassigned)}")

# Agrupar por municipio
municipalities = {}
for h in unassigned:
    if h['municipality_id'] not in municipalities:
        municipalities[h['municipality_id']] = []
    municipalities[h['municipality_id']].append(h)

processed = 0
for municipality_id, muni_hospitals in municipalities.items():
    votes = {}
    hospital_assignments = []
    
    for hospital in muni_hospitals:
        best_kam = None
        best_time = float('inf')
        
        for kam_id, kam in kams.items():
            kam_dept = kam['area_id'][:2]
            hospital_dept = hospital['department_id']
            
            # Verificar si el KAM puede competir
            can_compete = False
            
            # Mismo departamento
            if kam_dept == hospital_dept:
                can_compete = True
            # Departamento adyacente
            elif kam_dept in adjacency and hospital_dept in adjacency[kam_dept]:
                can_compete = True
            # Nivel 2
            elif kam['enable_level2']:
                for adj_dept in adjacency.get(kam_dept, []):
                    if hospital_dept in adjacency.get(adj_dept, []):
                        can_compete = True
                        break
            # KAMs de Bogotá pueden competir en Cundinamarca
            elif kam['area_id'].startswith('11001') and hospital_dept == '25':
                can_compete = True
            
            if not can_compete:
                continue
            
            # Buscar tiempo en caché
            cache_result = supabase.table('travel_time_cache').select('travel_time').eq(
                'origin_lat', round(kam['lat'], 6)
            ).eq(
                'origin_lng', round(kam['lng'], 6)
            ).eq(
                'dest_lat', round(hospital['lat'], 6)
            ).eq(
                'dest_lng', round(hospital['lng'], 6)
            ).execute()
            
            if cache_result.data:
                time = cache_result.data[0]['travel_time']
                if time < best_time and time <= kam['max_travel_time'] * 60:
                    best_time = time
                    best_kam = kam
        
        if best_kam:
            votes[best_kam['id']] = votes.get(best_kam['id'], 0) + 1
            hospital_assignments.append({
                'hospital': hospital,
                'kam': best_kam,
                'time': best_time
            })
    
    # Asignar por mayoría
    if votes:
        winner_id = max(votes, key=votes.get)
        winner = kams[winner_id]
        
        for item in hospital_assignments:
            assignments.append({
                'kam_id': winner_id,
                'hospital_id': item['hospital']['id'],
                'travel_time': item['time'] if item['kam']['id'] == winner_id else None,
                'assignment_type': 'automatic'
            })
            assigned_hospitals.add(item['hospital']['id'])
    
    processed += 1
    if processed % 50 == 0:
        print(f"    Procesados {processed}/{len(municipalities)} municipios...")

# 8. Guardar asignaciones
print(f"\n💾 Guardando {len(assignments)} asignaciones en Supabase...")
batch_size = 100
for i in range(0, len(assignments), batch_size):
    batch = assignments[i:i+batch_size]
    supabase.table('assignments').insert(batch).execute()
    print(f"  Guardados {min(i+batch_size, len(assignments))} de {len(assignments)}")

# 9. Resumen final
print("\n📊 RESUMEN FINAL:")
print(f"  Total hospitales: {len(hospitals)}")
print(f"  Total asignados: {len(assigned_hospitals)}")
print(f"  No asignados: {len(hospitals) - len(assigned_hospitals)}")

# Contar por KAM
kam_counts = {}
for assignment in assignments:
    kam_id = assignment['kam_id']
    kam_counts[kam_id] = kam_counts.get(kam_id, 0) + 1

print("\n📊 Asignaciones por KAM:")
for kam_id, count in sorted(kam_counts.items(), key=lambda x: x[1], reverse=True):
    print(f"  {kams[kam_id]['name']}: {count} hospitales")

print("\n✅ PROCESO COMPLETADO")