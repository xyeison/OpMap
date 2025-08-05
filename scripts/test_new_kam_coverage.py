#!/usr/bin/env python3
"""
Verificar qué hospitales puede cubrir un nuevo KAM según las reglas del algoritmo
"""

import os
from dotenv import load_dotenv
from supabase import create_client

# Cargar variables de entorno
load_dotenv()

# Configurar Supabase
url = os.getenv('SUPABASE_URL')
key = os.getenv('SUPABASE_ANON_KEY')
supabase = create_client(url, key)

print("🔍 ANÁLISIS DE COBERTURA PARA NUEVOS KAMs\n")

# Ejemplo: Analizar qué puede cubrir el KAM de Ibagué
kam_area = '73001'  # Ibagué
print(f"Analizando cobertura potencial para KAM en {kam_area}...")

# 1. Obtener información del municipio
kam_dept = kam_area[:2]  # '73' (Tolima)
print(f"\nDepartamento del KAM: {kam_dept}")

# 2. Obtener departamentos adyacentes (Nivel 1)
adjacency = supabase.from_('department_adjacency').select('adjacent_department_code').eq('department_code', kam_dept).execute()
level1_depts = {kam_dept}  # Incluir el propio departamento
if adjacency.data:
    for adj in adjacency.data:
        level1_depts.add(adj['adjacent_department_code'])

print(f"\nDepartamentos Nivel 1 (adyacentes directos): {sorted(level1_depts)}")

# 3. Obtener departamentos Nivel 2 (adyacentes de adyacentes)
level2_depts = set()
for dept in level1_depts:
    adj2 = supabase.from_('department_adjacency').select('adjacent_department_code').eq('department_code', dept).execute()
    if adj2.data:
        for a in adj2.data:
            level2_depts.add(a['adjacent_department_code'])

# Nivel 2 incluye todos los anteriores más los nuevos
all_depts = level1_depts.union(level2_depts)
print(f"Departamentos Nivel 2 (total alcanzable): {sorted(all_depts)}")

# 4. Contar hospitales en cada departamento
print("\n📊 HOSPITALES POTENCIALES POR DEPARTAMENTO:")
print("(Sujeto a tiempo de viaje < 4 horas)")
print("-" * 50)

total_potential = 0
for dept in sorted(all_depts):
    # Obtener nombre del departamento
    dept_info = supabase.from_('departments').select('name').eq('code', dept).execute()
    dept_name = dept_info.data[0]['name'] if dept_info.data else 'Desconocido'
    
    # Contar hospitales activos
    hospitals = supabase.from_('hospitals').select('id', count='exact').eq('department_id', dept).eq('active', True).execute()
    count = hospitals.count or 0
    total_potential += count
    
    nivel = "Base" if dept == kam_dept else "Nivel 1" if dept in level1_depts else "Nivel 2"
    print(f"{dept} - {dept_name:<30} {count:>3} hospitales ({nivel})")

print("-" * 50)
print(f"TOTAL POTENCIAL: {total_potential} hospitales")

# 5. Verificar específicamente algunos municipios importantes
print("\n🏥 MUNICIPIOS ESPECÍFICOS DE INTERÉS:")
important_municipalities = [
    ('25307', 'Girardot'),
    ('25286', 'Funza'),
    ('25269', 'Facatativá'),
    ('25899', 'Zipaquirá'),
    ('73001', 'Ibagué'),
    ('73268', 'Espinal'),
    ('73449', 'Melgar')
]

for muni_code, muni_name in important_municipalities:
    hospitals = supabase.from_('hospitals').select('name').eq('municipality_id', muni_code).eq('active', True).execute()
    count = len(hospitals.data) if hospitals.data else 0
    dept = muni_code[:2]
    
    if dept in all_depts:
        print(f"✅ {muni_name}: {count} hospitales - SÍ puede competir")
    else:
        print(f"❌ {muni_name}: {count} hospitales - NO puede competir")

print("\n💡 NOTA: La asignación final depende de:")
print("   1. Tiempo de viaje real < 4 horas")
print("   2. Competencia con otros KAMs más cercanos")
print("   3. Regla de mayoría en territorios compartidos")