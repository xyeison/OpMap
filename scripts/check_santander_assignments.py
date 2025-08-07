#!/usr/bin/env python3
"""
Verificar asignaciones en Santander (departamento 68)
"""
import os
import sys
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from supabase import create_client, Client

# Cargar variables de entorno
load_dotenv()

# URL correcta de Supabase
supabase_url = 'https://norvxqgohddgsdkggqzq.supabase.co'
supabase_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vcnZ4cWdvaGRkZ3Nka2dncXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMDExMjUsImV4cCI6MjA2ODc3NzEyNX0.BRWIYeD_5OlpVKIrP1QzUmkSx6HEVGzcEUUiSK8CmJs'

supabase: Client = create_client(supabase_url, supabase_key)

print("🔍 Analizando asignaciones en Santander (departamento 68)...\n")

# 1. Buscar todos los hospitales en Santander
hospitals_result = supabase.table('hospitals').select('*').eq('department_id', '68').eq('active', True).execute()

print(f"📍 Total hospitales en Santander: {len(hospitals_result.data)}")

# 2. Analizar asignaciones por municipio
municipalities = {}
for hospital in hospitals_result.data:
    mun_id = hospital['municipality_id']
    if mun_id not in municipalities:
        municipalities[mun_id] = {
            'name': hospital.get('municipality_name', mun_id),
            'hospitals': [],
            'assigned': 0,
            'unassigned': 0,
            'kams': set()
        }
    
    municipalities[mun_id]['hospitals'].append(hospital)
    
    # Verificar asignación
    assignment = supabase.table('assignments').select('*, kams(name, id)').eq('hospital_id', hospital['id']).execute()
    if assignment.data:
        municipalities[mun_id]['assigned'] += 1
        municipalities[mun_id]['kams'].add(assignment.data[0]['kams']['name'])
    else:
        municipalities[mun_id]['unassigned'] += 1

# 3. Mostrar resumen por municipio
print("\n📊 Resumen por municipio:")
print("-" * 80)
print(f"{'Municipio':<30} {'Total':<8} {'Asign':<8} {'No Asign':<10} {'KAM(s)'}")
print("-" * 80)

total_assigned = 0
total_unassigned = 0

for mun_id, data in sorted(municipalities.items(), key=lambda x: x[1]['name']):
    total_assigned += data['assigned']
    total_unassigned += data['unassigned']
    
    kams_str = ', '.join(data['kams']) if data['kams'] else 'NINGUNO'
    status = "⚠️ " if data['unassigned'] > 0 else "✅ "
    
    print(f"{status}{data['name']:<28} {len(data['hospitals']):<8} {data['assigned']:<8} {data['unassigned']:<10} {kams_str}")

print("-" * 80)
print(f"{'TOTAL':<30} {len(hospitals_result.data):<8} {total_assigned:<8} {total_unassigned:<10}")

# 4. Listar específicamente los municipios sin cobertura
print("\n❌ Municipios con hospitales NO asignados:")
for mun_id, data in sorted(municipalities.items(), key=lambda x: x[1]['name']):
    if data['unassigned'] > 0:
        print(f"   - {data['name']}: {data['unassigned']} hospital(es) sin asignar")
        for hospital in data['hospitals']:
            assignment = supabase.table('assignments').select('id').eq('hospital_id', hospital['id']).execute()
            if not assignment.data:
                print(f"      • {hospital['name']} ({hospital['code']})")

# 5. Verificar KAM de Bucaramanga específicamente
print("\n🔍 Verificando asignaciones del KAM Bucaramanga:")
bucaramanga_assignments = supabase.table('assignments').select('*, hospitals!inner(municipality_id, municipality_name, department_id), kams!inner(name)').eq('kams.name', 'KAM Bucaramanga').eq('hospitals.department_id', '68').execute()

if bucaramanga_assignments.data:
    print(f"   KAM Bucaramanga tiene {len(bucaramanga_assignments.data)} hospitales en Santander:")
    mun_counts = {}
    for a in bucaramanga_assignments.data:
        mun_name = a['hospitals']['municipality_name']
        mun_counts[mun_name] = mun_counts.get(mun_name, 0) + 1
    
    for mun, count in sorted(mun_counts.items()):
        print(f"      - {mun}: {count} hospital(es)")