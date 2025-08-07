#!/usr/bin/env python3
"""
Investigar casos específicos de asignaciones incorrectas
"""
from supabase import create_client

supabase_url = 'https://norvxqgohddgsdkggqzq.supabase.co'
supabase_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vcnZ4cWdvaGRkZ3Nka2dncXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMDExMjUsImV4cCI6MjA2ODc3NzEyNX0.BRWIYeD_5OlpVKIrP1QzUmkSx6HEVGzcEUUiSK8CmJs'

supabase = create_client(supabase_url, supabase_key)

print("🔍 INVESTIGACIÓN DE CASOS ESPECÍFICOS")
print("="*60)

# CASO 1: Hospital 900958564-2
print("\n📍 CASO 1: Hospital 900958564-2")
print("-"*40)

# Buscar el hospital
hospital1 = supabase.table('hospitals').select('*').eq('code', '900958564-2').execute()
if hospital1.data:
    h = hospital1.data[0]
    print(f"Hospital: {h['name']}")
    print(f"Ubicación: {h['municipality_name']}, {h['department_name']}")
    print(f"Municipio ID: {h['municipality_id']}")
    print(f"Localidad ID: {h.get('locality_id', 'N/A')}")
    print(f"Coordenadas: {h['lat']}, {h['lng']}")
    print(f"Hospital ID: {h['id']}")
    
    # Buscar asignación actual
    assignment = supabase.table('assignments').select('*, kams(*)').eq('hospital_id', h['id']).execute()
    if assignment.data:
        a = assignment.data[0]
        print(f"\n✅ Asignación actual:")
        print(f"   KAM: {a['kams']['name']}")
        print(f"   Tiempo: {a.get('travel_time', 'Sin tiempo')} minutos")
        print(f"   Tipo: {a.get('assignment_type', 'N/A')}")
    
    # Buscar KAMs de Bogotá
    kams_bogota = supabase.table('kams').select('*').eq('active', True).execute()
    kams_bogota_filtered = [k for k in kams_bogota.data if k['area_id'].startswith('11001')]
    
    print(f"\n🔍 KAMs de Bogotá y sus localidades:")
    for kam in kams_bogota_filtered:
        print(f"   {kam['name']}: Localidad {kam['area_id']}")
    
    # Si el hospital está en Bogotá, verificar localidad
    if h['department_id'] == '11':
        print(f"\n📍 Hospital en Bogotá:")
        print(f"   Localidad del hospital: {h.get('locality_id', 'SIN LOCALIDAD')}")
        
        # Verificar si hay KAM en esa localidad
        if h.get('locality_id'):
            kam_local = next((k for k in kams_bogota_filtered if k['area_id'] == h['locality_id']), None)
            if kam_local:
                print(f"   ✅ KAM local encontrado: {kam_local['name']}")
            else:
                print(f"   ❌ No hay KAM en la localidad {h['locality_id']}")
    
    # Buscar distancias disponibles
    print(f"\n📊 Distancias disponibles para este hospital:")
    distances = supabase.table('hospital_kam_distances').select('*, kams(name)').eq('hospital_id', h['id']).execute()
    
    if distances.data:
        for d in distances.data:
            print(f"   → {d['kams']['name']}: {d['travel_time']} min")
    else:
        print("   ❌ No hay distancias calculadas para este hospital")
else:
    print("❌ Hospital no encontrado")

# CASO 2: Hospital 890701718-1 en Líbano, Tolima
print("\n\n📍 CASO 2: Hospital 890701718-1 (Líbano, Tolima)")
print("-"*40)

hospital2 = supabase.table('hospitals').select('*').eq('code', '890701718-1').execute()
if hospital2.data:
    h = hospital2.data[0]
    print(f"Hospital: {h['name']}")
    print(f"Ubicación: {h['municipality_name']}, {h['department_name']}")
    print(f"Departamento ID: {h['department_id']}")
    print(f"Coordenadas: {h['lat']}, {h['lng']}")
    print(f"Hospital ID: {h['id']}")
    
    # Buscar KAM Pereira
    kam_pereira = supabase.table('kams').select('*').eq('name', 'KAM Pereira').execute()
    if kam_pereira.data:
        k = kam_pereira.data[0]
        print(f"\n👤 KAM Pereira:")
        print(f"   Ubicación: {k['area_id']}")
        print(f"   Departamento: {k['area_id'][:2]}")
        print(f"   KAM ID: {k['id']}")
        
        # Buscar distancia específica
        distance = supabase.table('hospital_kam_distances').select('*').eq('hospital_id', h['id']).eq('kam_id', k['id']).execute()
        
        if distance.data:
            print(f"\n✅ Distancia encontrada:")
            print(f"   Tiempo: {distance.data[0]['travel_time']} minutos")
            print(f"   Distancia: {distance.data[0].get('distance', 'N/A')} km")
            print(f"   Fuente: {distance.data[0]['source']}")
        else:
            print(f"\n❌ NO hay distancia calculada entre KAM Pereira y este hospital")
    
    # Verificar matriz de adyacencia
    print(f"\n🗺️ Análisis de adyacencia:")
    
    # Tolima (73) y Risaralda (66)
    adjacency = supabase.table('department_adjacency').select('*').execute()
    
    # Crear matriz
    adj_matrix = {}
    for row in adjacency.data:
        dept = row['department_code']
        if dept not in adj_matrix:
            adj_matrix[dept] = []
        adj_matrix[dept].append(row['adjacent_department_code'])
    
    # Tolima es adyacente a Risaralda?
    if '73' in adj_matrix and '66' in adj_matrix['73']:
        print(f"   ✅ Tolima (73) ES adyacente a Risaralda (66)")
    else:
        print(f"   ❌ Tolima (73) NO es adyacente a Risaralda (66)")
    
    # Qué departamentos son adyacentes a Tolima?
    if '73' in adj_matrix:
        print(f"\n   Departamentos adyacentes a Tolima:")
        for dept in adj_matrix['73']:
            dept_info = supabase.table('departments').select('name').eq('code', dept).execute()
            if dept_info.data:
                print(f"      - {dept}: {dept_info.data[0]['name']}")
    
    # Buscar todas las distancias para este hospital
    print(f"\n📊 Todas las distancias disponibles para el hospital:")
    all_distances = supabase.table('hospital_kam_distances').select('*, kams(name)').eq('hospital_id', h['id']).execute()
    
    if all_distances.data:
        for d in sorted(all_distances.data, key=lambda x: x['travel_time']):
            print(f"   → {d['kams']['name']}: {d['travel_time']} min")
    else:
        print("   ❌ No hay distancias calculadas")
        
    # Ver qué KAMs DEBERÍAN competir por este hospital
    print(f"\n🎯 KAMs que DEBERÍAN competir (según algoritmo):")
    
    # KAMs del mismo departamento (Tolima)
    kams_tolima = [k for k in kams_bogota.data if k['area_id'][:2] == '73']
    if kams_tolima:
        print(f"   Mismo departamento (Tolima):")
        for k in kams_tolima:
            print(f"      - {k['name']}")
    else:
        print(f"   No hay KAMs en Tolima")
    
    # KAMs de departamentos adyacentes
    if '73' in adj_matrix:
        print(f"   Departamentos adyacentes:")
        for adj_dept in adj_matrix['73']:
            kams_adj = [k for k in kams_bogota.data if k['area_id'][:2] == adj_dept]
            if kams_adj:
                for k in kams_adj:
                    print(f"      - {k['name']} (desde {adj_dept})")
else:
    print("❌ Hospital no encontrado")

print("\n" + "="*60)