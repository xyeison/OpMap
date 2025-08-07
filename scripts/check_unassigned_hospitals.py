#!/usr/bin/env python3
"""
Verificar hospitales no asignados
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

print("🔍 Verificando hospitales no asignados...\n")

# Obtener todos los hospitales activos
hospitals_result = supabase.table('hospitals').select('id, code, name, municipality_id, municipality_name, active').eq('active', True).execute()

# Obtener todas las asignaciones
assignments_result = supabase.table('assignments').select('hospital_id').execute()

# Crear set de IDs asignados
assigned_ids = set(a['hospital_id'] for a in assignments_result.data)

# Encontrar hospitales no asignados
unassigned = []
for hospital in hospitals_result.data:
    if hospital['id'] not in assigned_ids:
        unassigned.append(hospital)

print(f"📊 Resumen:")
print(f"   Total hospitales activos: {len(hospitals_result.data)}")
print(f"   Hospitales asignados: {len(assigned_ids)}")
print(f"   Hospitales NO asignados: {len(unassigned)}")

print(f"\n❌ Hospitales sin asignar:")
for h in unassigned[:10]:  # Mostrar solo los primeros 10
    print(f"   - {h['name']} ({h['code']})")
    print(f"     Municipio: {h['municipality_name']} ({h['municipality_id']})")

# Buscar específicamente el hospital de Vélez
print(f"\n🔍 Buscando hospital 900067136-1 en los no asignados...")
velez_found = False
for h in unassigned:
    if h['code'] == '900067136-1':
        print(f"   ✅ ENCONTRADO en lista de no asignados")
        print(f"   - {h['name']}")
        print(f"   - ID: {h['id']}")
        velez_found = True
        break

if not velez_found:
    print(f"   ❌ NO encontrado en lista de no asignados")
    
    # Verificar si está asignado
    for hospital in hospitals_result.data:
        if hospital['code'] == '900067136-1':
            if hospital['id'] in assigned_ids:
                print(f"   ⚠️ El hospital ESTÁ asignado (ID: {hospital['id']})")
                # Buscar la asignación
                assignment = supabase.table('assignments').select('*, kams(name)').eq('hospital_id', hospital['id']).execute()
                if assignment.data:
                    print(f"   - Asignado a: {assignment.data[0]['kams']['name']}")
            else:
                print(f"   🤔 El hospital existe pero hay un problema de consistencia")