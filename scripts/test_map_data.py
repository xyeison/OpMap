#!/usr/bin/env python3
"""
Simular la lógica del MapComponent para verificar territorios
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

print("🔍 Simulando lógica del MapComponent...\n")

# 1. Cargar datos como el mapa
kams_result = supabase.table('kams').select('*').eq('active', True).execute()
assignments_result = supabase.table('assignments').select('*, hospitals!inner(*), kams!inner(*)').execute()
hospitals_result = supabase.table('hospitals').select('*').eq('active', True).execute()

# 2. Identificar hospitales sin asignar
assigned_hospital_ids = set(a['hospitals']['id'] for a in assignments_result.data)
unassigned_hospitals = [h for h in hospitals_result.data if h['id'] not in assigned_hospital_ids]

print(f"📊 Datos cargados:")
print(f"   KAMs activos: {len(kams_result.data)}")
print(f"   Asignaciones: {len(assignments_result.data)}")
print(f"   Hospitales activos: {len(hospitals_result.data)}")
print(f"   Hospitales sin asignar: {len(unassigned_hospitals)}")

# 3. Construir territorios como el mapa
kam_territories = {}
territories_with_ips = set()
vacant_territories = set()

# Identificar territorios vacantes
for hospital in unassigned_hospitals:
    if hospital.get('locality_id'):
        vacant_territories.add(hospital['locality_id'])
    elif hospital.get('municipality_id'):
        vacant_territories.add(hospital['municipality_id'])

# Identificar territorios con IPS asignadas
for assignment in assignments_result.data:
    hospital = assignment['hospitals']
    kam_id = assignment['kams']['id']
    
    if kam_id not in kam_territories:
        kam_territories[kam_id] = set()
    
    if hospital.get('locality_id'):
        territories_with_ips.add(hospital['locality_id'])
        kam_territories[kam_id].add(hospital['locality_id'])
    elif hospital.get('municipality_id'):
        territories_with_ips.add(hospital['municipality_id'])
        kam_territories[kam_id].add(hospital['municipality_id'])

# 4. Verificar Vélez específicamente
velez_id = '68861'
print(f"\n🔍 Análisis del territorio de Vélez ({velez_id}):")
print(f"   ¿Está en territorios vacantes? {velez_id in vacant_territories}")
print(f"   ¿Está en territorios con IPS? {velez_id in territories_with_ips}")

# Ver qué KAMs tienen territorios en Vélez
kams_in_velez = []
for kam_id, territories in kam_territories.items():
    if velez_id in territories:
        kams_in_velez.append(kam_id)

if kams_in_velez:
    print(f"   ⚠️ KAMs con territorio en Vélez: {', '.join(kams_in_velez)}")
else:
    print(f"   ✅ Ningún KAM tiene territorio en Vélez")

# 5. Verificar si hay algún hospital asignado en Vélez
assigned_in_velez = [a for a in assignments_result.data 
                     if a['hospitals']['municipality_id'] == velez_id]

if assigned_in_velez:
    print(f"\n⚠️ PROBLEMA: Hay {len(assigned_in_velez)} hospitales asignados en Vélez:")
    for a in assigned_in_velez:
        print(f"   - {a['hospitals']['name']} asignado a {a['kams']['name']}")
else:
    print(f"\n✅ Correcto: No hay hospitales asignados en Vélez")

# 6. Simular la construcción de territory_winners
territory_winners = {}
for kam_id, territories in kam_territories.items():
    for territory_id in territories:
        # Simplificado - en el mapa real hay lógica de mayoría para localidades
        territory_winners[territory_id] = kam_id

print(f"\n📍 Estado final del territorio de Vélez:")
if velez_id in territory_winners:
    print(f"   ❌ PROBLEMA: Vélez aparece como ganado por {territory_winners[velez_id]}")
else:
    print(f"   ✅ Correcto: Vélez no tiene ganador (territorio vacante)")

# 7. Simular cómo se vería el territorio
all_territories = territories_with_ips.union(vacant_territories)
if velez_id in all_territories:
    is_vacant = velez_id in vacant_territories
    kam_id = territory_winners.get(velez_id)
    
    print(f"\n🎨 Renderizado del territorio de Vélez:")
    print(f"   isVacant: {is_vacant}")
    print(f"   kamId: {kam_id}")
    print(f"   Color esperado: {'#808080 (gris)' if is_vacant else f'Color del KAM {kam_id}'}")
    
    if not is_vacant and kam_id:
        print(f"   ⚠️ PROBLEMA: El territorio se mostraría con el color del KAM {kam_id}")
    elif is_vacant:
        print(f"   ✅ Correcto: El territorio se mostraría en gris (vacante)")