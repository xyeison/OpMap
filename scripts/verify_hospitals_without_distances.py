#!/usr/bin/env python3
"""
Verificar si los hospitales sin distancias están en departamentos excluidos
"""
from supabase import create_client

supabase_url = 'https://norvxqgohddgsdkggqzq.supabase.co'
supabase_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vcnZ4cWdvaGRkZ3Nka2dncXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMDExMjUsImV4cCI6MjA2ODc3NzEyNX0.BRWIYeD_5OlpVKIrP1QzUmkSx6HEVGzcEUUiSK8CmJs'

supabase = create_client(supabase_url, supabase_key)

print("🔍 VERIFICANDO HOSPITALES SIN DISTANCIAS")
print("="*60)

# 1. Obtener departamentos excluidos
excluded_depts = supabase.table('departments').select('code, name').eq('excluded', True).execute()
excluded_codes = set(d['code'] for d in excluded_depts.data)
excluded_names = {d['code']: d['name'] for d in excluded_depts.data}

print("\n📍 DEPARTAMENTOS EXCLUIDOS:")
for code in sorted(excluded_codes):
    print(f"   {code}: {excluded_names.get(code, 'Unknown')}")

# 2. Obtener hospitales activos
hospitals = supabase.table('hospitals').select('*').eq('active', True).execute()

# 3. Obtener distancias existentes
distances = supabase.table('hospital_kam_distances').select('hospital_id').execute()
hospitals_with_distances = set(d['hospital_id'] for d in distances.data)

# 4. Clasificar hospitales sin distancias
hospitals_sin_distancias = []
for h in hospitals.data:
    if h['id'] not in hospitals_with_distances:
        hospitals_sin_distancias.append(h)

print(f"\n📊 Total hospitales sin distancias: {len(hospitals_sin_distancias)}")

# 5. Separar por departamento excluido o no
en_deptos_excluidos = []
en_deptos_no_excluidos = []

for h in hospitals_sin_distancias:
    if h['department_id'] in excluded_codes:
        en_deptos_excluidos.append(h)
    else:
        en_deptos_no_excluidos.append(h)

print(f"\n📊 ANÁLISIS:")
print(f"   En departamentos EXCLUIDOS: {len(en_deptos_excluidos)}")
print(f"   En departamentos NO excluidos: {len(en_deptos_no_excluidos)} ⚠️")

# 6. Mostrar hospitales en departamentos EXCLUIDOS
if en_deptos_excluidos:
    print(f"\n✅ HOSPITALES EN DEPARTAMENTOS EXCLUIDOS ({len(en_deptos_excluidos)}):")
    print("   (Estos NO necesitan distancias según las reglas)")
    
    by_dept = {}
    for h in en_deptos_excluidos:
        dept_name = h['department_name']
        if dept_name not in by_dept:
            by_dept[dept_name] = []
        by_dept[dept_name].append(h)
    
    for dept, hosps in sorted(by_dept.items()):
        print(f"\n   {dept} ({len(hosps)} hospitales):")
        for h in hosps:
            print(f"      - {h['name']} ({h['municipality_name']})")
            print(f"        Código: {h['code']}, Camas: {h.get('beds', 0)}")

# 7. Mostrar hospitales en departamentos NO EXCLUIDOS
if en_deptos_no_excluidos:
    print(f"\n❌ HOSPITALES EN DEPARTAMENTOS NO EXCLUIDOS ({len(en_deptos_no_excluidos)}):")
    print("   (Estos SÍ necesitan distancias y es un problema)")
    
    by_dept = {}
    for h in en_deptos_no_excluidos:
        dept_name = h['department_name']
        dept_id = h['department_id']
        key = f"{dept_name} ({dept_id})"
        if key not in by_dept:
            by_dept[key] = []
        by_dept[key].append(h)
    
    for dept, hosps in sorted(by_dept.items(), key=lambda x: len(x[1]), reverse=True):
        print(f"\n   {dept}: {len(hosps)} hospitales")
        for h in hosps[:5]:  # Mostrar hasta 5
            print(f"      - {h['name']} ({h['municipality_name']})")
            print(f"        Código: {h['code']}, Camas: {h.get('beds', 0)}")
            print(f"        ID: {h['id']}")
        if len(hosps) > 5:
            print(f"      ... y {len(hosps) - 5} más")

# 8. Verificar si hay KAMs en esos departamentos
print(f"\n🔍 VERIFICANDO KAMS EN DEPARTAMENTOS AFECTADOS:")
kams = supabase.table('kams').select('*').eq('active', True).execute()

dept_ids_afectados = set(h['department_id'] for h in en_deptos_no_excluidos)
for dept_id in sorted(dept_ids_afectados):
    kams_en_dept = [k for k in kams.data if k['area_id'][:2] == dept_id]
    dept_name = next((h['department_name'] for h in en_deptos_no_excluidos if h['department_id'] == dept_id), dept_id)
    
    if kams_en_dept:
        print(f"\n   {dept_name} ({dept_id}):")
        for kam in kams_en_dept:
            print(f"      ✅ {kam['name']} en {kam['area_id']}")
    else:
        print(f"\n   {dept_name} ({dept_id}): ❌ Sin KAM local")

# 9. Resumen final
print(f"\n" + "="*60)
print("📊 RESUMEN:")
print("="*60)
print(f"Hospitales sin distancias: {len(hospitals_sin_distancias)}")
print(f"  ├─ En departamentos excluidos (OK): {len(en_deptos_excluidos)}")
print(f"  └─ En departamentos NO excluidos (PROBLEMA): {len(en_deptos_no_excluidos)}")
print()

if en_deptos_no_excluidos:
    # Estimar rutas necesarias
    estimated_routes = len(en_deptos_no_excluidos) * 8  # Promedio 8 KAMs por hospital
    estimated_cost = estimated_routes * 0.005
    
    print(f"⚠️ ACCIÓN REQUERIDA:")
    print(f"   Calcular distancias para {len(en_deptos_no_excluidos)} hospitales")
    print(f"   Rutas estimadas: {estimated_routes}")
    print(f"   Costo estimado: ${estimated_cost:.2f} USD")
else:
    print("✅ Todos los hospitales sin distancias están en departamentos excluidos")
    print("   No se requiere acción adicional")

print("="*60)