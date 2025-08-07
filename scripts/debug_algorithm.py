#!/usr/bin/env python3
"""
Debug del algoritmo - verificar por qué no asigna algunos hospitales
"""
from supabase import create_client

supabase_url = 'https://norvxqgohddgsdkggqzq.supabase.co'
supabase_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vcnZ4cWdvaGRkZ3Nka2dncXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMDExMjUsImV4cCI6MjA2ODc3NzEyNX0.BRWIYeD_5OlpVKIrP1QzUmkSx6HEVGzcEUUiSK8CmJs'

supabase = create_client(supabase_url, supabase_key)

print("🔍 DEBUG DEL ALGORITMO")
print("="*60)

# 1. Verificar hospitales sin asignar que SÍ tienen distancias
print("\n1. HOSPITALES SIN ASIGNAR CON DISTANCIAS DISPONIBLES:")
print("-"*40)

# Obtener todos los hospitales activos
hospitals = supabase.table('hospitals').select('id, name, code, municipality_id, department_id').eq('active', True).execute()

# Obtener todas las asignaciones
assignments = supabase.table('assignments').select('hospital_id').execute()
assigned_ids = set([a['hospital_id'] for a in assignments.data]) if assignments.data else set()

# Hospitales sin asignar
unassigned = [h for h in hospitals.data if h['id'] not in assigned_ids]
print(f"Total hospitales activos: {len(hospitals.data)}")
print(f"Hospitales asignados: {len(assigned_ids)}")
print(f"Hospitales sin asignar: {len(unassigned)}")

# Para cada hospital sin asignar, verificar si tiene distancias
hospitals_with_distances = []
for h in unassigned[:20]:  # Revisar los primeros 20
    distances = supabase.table('hospital_kam_distances').select('kam_id').eq('hospital_id', h['id']).execute()
    if distances.data and len(distances.data) > 0:
        hospitals_with_distances.append({
            'hospital': h,
            'distance_count': len(distances.data)
        })

print(f"\nHospitales sin asignar que SÍ tienen distancias: {len(hospitals_with_distances)}")
for item in hospitals_with_distances[:5]:
    h = item['hospital']
    print(f"  - {h['name']} ({h['code']})")
    print(f"    Municipio: {h['municipality_id']}, Depto: {h['department_id']}")
    print(f"    Tiene {item['distance_count']} distancias calculadas")

# 2. Verificar departamentos excluidos
print("\n2. VERIFICACIÓN DE DEPARTAMENTOS EXCLUIDOS:")
print("-"*40)

excluded = supabase.table('departments').select('code, name').eq('excluded', True).execute()
if excluded.data:
    excluded_codes = [d['code'] for d in excluded.data]
    print(f"Departamentos excluidos: {excluded_codes}")
    
    # Ver si hay hospitales sin asignar en departamentos NO excluidos
    non_excluded_unassigned = [h for h in unassigned if h['department_id'] not in excluded_codes]
    print(f"Hospitales sin asignar en departamentos NO excluidos: {len(non_excluded_unassigned)}")

# 3. Caso específico del hospital problemático
print("\n3. CASO ESPECÍFICO: Clínica Porvenir (Soledad)")
print("-"*40)

hospital_id = 'cce7c25a-5565-4ca5-ad1e-a4782bf322ff'

# Verificar si es territorio base de algún KAM
kam_soledad = supabase.table('kams').select('*').eq('area_id', '08758').execute()
if kam_soledad.data:
    print(f"  ✅ Hay un KAM en Soledad (08758): {kam_soledad.data[0]['name']}")
else:
    print(f"  ❌ NO hay KAM en Soledad (08758)")
    
    # Ver KAMs en Atlántico
    kams_atlantico = supabase.table('kams').select('*').like('area_id', '08%').execute()
    if kams_atlantico.data:
        print(f"  KAMs en Atlántico:")
        for k in kams_atlantico.data:
            print(f"    - {k['name']} en {k['area_id']}")

# 4. Verificar si el problema es el filtro de departamentos excluidos
print("\n4. VERIFICACIÓN DEL FILTRO DE DEPARTAMENTOS:")
print("-"*40)

# El algoritmo filtra hospitales por departamentos excluidos
# Verificar si esto está funcionando correctamente
hospitals_atlantico = supabase.table('hospitals').select('id, name').eq('department_id', '08').eq('active', True).execute()
print(f"Hospitales activos en Atlántico (08): {len(hospitals_atlantico.data)}")

assignments_atlantico = supabase.table('assignments').select('hospital_id').in_('hospital_id', [h['id'] for h in hospitals_atlantico.data]).execute()
print(f"Hospitales de Atlántico asignados: {len(assignments_atlantico.data) if assignments_atlantico.data else 0}")
print(f"Hospitales de Atlántico sin asignar: {len(hospitals_atlantico.data) - (len(assignments_atlantico.data) if assignments_atlantico.data else 0)}")

print("\n" + "="*60)
print("📝 CONCLUSIÓN:")
print("El algoritmo simplificado parece tener un problema con:")
print("1. El filtrado de hospitales por departamentos excluidos")
print("2. O la carga inicial de datos")
print("3. O la lógica de asignación competitiva")