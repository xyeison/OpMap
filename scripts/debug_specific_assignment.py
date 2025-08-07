#!/usr/bin/env python3
"""
Debug de asignación específica
"""
from supabase import create_client

supabase_url = 'https://norvxqgohddgsdkggqzq.supabase.co'
supabase_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vcnZ4cWdvaGRkZ3Nka2dncXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMDExMjUsImV4cCI6MjA2ODc3NzEyNX0.BRWIYeD_5OlpVKIrP1QzUmkSx6HEVGzcEUUiSK8CmJs'

supabase = create_client(supabase_url, supabase_key)

hospital_id = 'cce7c25a-5565-4ca5-ad1e-a4782bf322ff'
kam_id = '247f8e1a-c9c9-4e15-9f3b-25dbf46f439c'

print("🔍 DEBUG DE ASIGNACIÓN ESPECÍFICA")
print("="*60)

# 1. Información del hospital
hospital = supabase.table('hospitals').select('*').eq('id', hospital_id).single().execute()
if hospital.data:
    h = hospital.data
    print(f"\n📋 HOSPITAL:")
    print(f"  ID: {h['id']}")
    print(f"  Nombre: {h['name']}")
    print(f"  Código: {h['code']}")
    print(f"  Municipio: {h['municipality_name']} ({h['municipality_id']})")
    print(f"  Departamento: {h['department_name']} ({h['department_id']})")
    print(f"  Localidad: {h.get('locality_id', 'N/A')}")
    print(f"  Activo: {h['active']}")

# 2. Información del KAM
kam = supabase.table('kams').select('*').eq('id', kam_id).single().execute()
if kam.data:
    k = kam.data
    print(f"\n👤 KAM:")
    print(f"  ID: {k['id']}")
    print(f"  Nombre: {k['name']}")
    print(f"  Area ID: {k['area_id']}")
    print(f"  Max travel time: {k['max_travel_time']} minutos")
    print(f"  Enable level2: {k['enable_level2']}")
    print(f"  Activo: {k['active']}")

# 3. Verificar si existe la distancia
print(f"\n📊 DISTANCIA EN hospital_kam_distances:")
distance = supabase.table('hospital_kam_distances').select('*').eq('hospital_id', hospital_id).eq('kam_id', kam_id).execute()

if distance.data and len(distance.data) > 0:
    d = distance.data[0]
    print(f"  ✅ EXISTE el registro:")
    print(f"  Travel time: {d['travel_time']} segundos ({d['travel_time']/60:.1f} minutos)")
    print(f"  Distance: {d.get('distance', 'N/A')} km")
else:
    print(f"  ❌ NO EXISTE registro de distancia")

# 4. Ver TODAS las distancias para este hospital
print(f"\n📍 TODAS LAS DISTANCIAS PARA ESTE HOSPITAL:")
all_distances = supabase.table('hospital_kam_distances').select('*, kams(name)').eq('hospital_id', hospital_id).execute()

if all_distances.data:
    # Ordenar por tiempo
    sorted_dist = sorted(all_distances.data, key=lambda x: x['travel_time'] if x['travel_time'] else 999999)
    
    for i, d in enumerate(sorted_dist, 1):
        time_sec = d['travel_time']
        time_min = time_sec / 60 if time_sec else 0
        kam_name = d['kams']['name'] if 'kams' in d else 'Unknown'
        print(f"  {i}. {kam_name}: {time_sec} seg ({time_min:.1f} min)")
        if d['kam_id'] == kam_id:
            print(f"     ⬆️ ESTE ES EL KAM QUE MENCIONAS")
else:
    print(f"  ❌ No hay distancias para este hospital")

# 5. Ver asignación actual
print(f"\n🎯 ASIGNACIÓN ACTUAL:")
assignment = supabase.table('assignments').select('*, kams(name)').eq('hospital_id', hospital_id).execute()

if assignment.data and len(assignment.data) > 0:
    a = assignment.data[0]
    print(f"  ✅ Asignado a: {a['kams']['name']}")
    print(f"  KAM ID: {a['kam_id']}")
    print(f"  Travel time: {a.get('travel_time', 'N/A')} segundos")
    print(f"  Tipo: {a['assignment_type']}")
    
    if a['kam_id'] != kam_id:
        print(f"\n  ⚠️ NO ESTÁ ASIGNADO AL KAM {kam['data']['name']}")
        print(f"  A pesar de que SÍ existe la distancia")
else:
    print(f"  ❌ Hospital NO está asignado a ningún KAM")

# 6. Verificar restricciones geográficas
if hospital.data and kam.data:
    print(f"\n🗺️ VERIFICACIÓN DE RESTRICCIONES GEOGRÁFICAS:")
    
    h_dept = hospital.data['department_id']
    k_area = kam.data['area_id']
    k_dept = k_area[:2]  # Primeros 2 dígitos son el departamento
    
    print(f"  Hospital en departamento: {h_dept}")
    print(f"  KAM en departamento: {k_dept}")
    
    # Verificar adyacencia
    adjacency = supabase.table('department_adjacency').select('*').eq('department_code', k_dept).execute()
    adjacent_depts = [a['adjacent_department_code'] for a in adjacency.data] if adjacency.data else []
    
    if h_dept == k_dept:
        print(f"  ✅ Mismo departamento")
    elif h_dept in adjacent_depts:
        print(f"  ✅ Departamento adyacente (Nivel 1)")
    else:
        # Verificar nivel 2
        level2 = False
        if kam.data['enable_level2']:
            for adj_dept in adjacent_depts:
                adj2 = supabase.table('department_adjacency').select('*').eq('department_code', adj_dept).execute()
                if adj2.data:
                    adj2_depts = [a['adjacent_department_code'] for a in adj2.data]
                    if h_dept in adj2_depts:
                        level2 = True
                        print(f"  ✅ Departamento adyacente Nivel 2 (via {adj_dept})")
                        break
        
        if not level2:
            print(f"  ❌ NO es adyacente (no debería poder competir)")

# 7. Verificar si el departamento está excluido
print(f"\n🚫 VERIFICACIÓN DE EXCLUSIONES:")
if hospital.data:
    dept_excluded = supabase.table('departments').select('excluded').eq('code', hospital.data['department_id']).single().execute()
    if dept_excluded.data:
        if dept_excluded.data['excluded']:
            print(f"  ❌ Departamento {hospital.data['department_id']} está EXCLUIDO")
        else:
            print(f"  ✅ Departamento NO está excluido")

print("\n" + "="*60)
print("📝 RESUMEN DEL PROBLEMA:")
if distance.data and assignment.data and assignment.data[0]['kam_id'] != kam_id:
    print(f"  El hospital TIENE distancia calculada al KAM")
    print(f"  pero NO está asignado a ese KAM")
    print(f"  Posibles causas:")
    print(f"  1. Otro KAM tiene menor distancia")
    print(f"  2. Restricciones geográficas impiden la asignación")
    print(f"  3. El tiempo excede el max_travel_time del KAM")
    print(f"  4. Regla de mayoría en localidades (si aplica)")
elif not distance.data:
    print(f"  NO existe registro de distancia entre hospital y KAM")
elif not assignment.data:
    print(f"  El hospital NO está asignado a ningún KAM")