#!/usr/bin/env python3
"""
Verificar estado del territorio de Vélez (68861)
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

print("🔍 Analizando territorio de Vélez (68861)...\n")

# 1. Buscar todos los hospitales en Vélez
hospitals_result = supabase.table('hospitals').select('*').eq('municipality_id', '68861').eq('active', True).execute()

print(f"📍 Hospitales en Vélez: {len(hospitals_result.data)}")
for hospital in hospitals_result.data:
    print(f"   - {hospital['name']} ({hospital['code']})")
    print(f"     Camas: {hospital.get('beds', 0)}")
    print(f"     Coordenadas: {hospital['lat']}, {hospital['lng']}")
    
    # Buscar asignación
    assignment = supabase.table('assignments').select('*, kams(name)').eq('hospital_id', hospital['id']).execute()
    if assignment.data:
        print(f"     ✅ ASIGNADO a: {assignment.data[0]['kams']['name']}")
        print(f"     Tiempo: {round(assignment.data[0].get('travel_time', 0) / 60)} minutos")
    else:
        print(f"     ❌ NO ASIGNADO")

print("\n" + "="*60)

# 2. Verificar si algún otro hospital en Vélez está asignado
print("\n🏥 Resumen del municipio de Vélez:")
assigned_count = 0
unassigned_count = 0

for hospital in hospitals_result.data:
    assignment = supabase.table('assignments').select('id').eq('hospital_id', hospital['id']).execute()
    if assignment.data:
        assigned_count += 1
    else:
        unassigned_count += 1

print(f"   Total hospitales: {len(hospitals_result.data)}")
print(f"   Asignados: {assigned_count}")
print(f"   NO asignados: {unassigned_count}")

# 3. Verificar en otras tablas si Vélez aparece como territorio de algún KAM
print("\n🗺️ Verificando si Vélez aparece como territorio asignado...")

# Buscar todos los hospitales asignados y ver si alguno está en Vélez
assignments_in_velez = supabase.table('assignments').select('*, hospitals!inner(municipality_id), kams(name)').eq('hospitals.municipality_id', '68861').execute()

if assignments_in_velez.data:
    print(f"⚠️ INCONSISTENCIA: Hay {len(assignments_in_velez.data)} asignaciones para hospitales en Vélez")
    for a in assignments_in_velez.data:
        print(f"   - Hospital ID: {a['hospital_id']}, KAM: {a['kams']['name']}")
else:
    print("✅ No hay asignaciones para ningún hospital en Vélez (correcto)")

# 4. Verificar tiempos de viaje desde KAMs cercanos
print("\n🚗 Verificando tiempos de viaje desde KAMs cercanos a Vélez...")

# Coordenadas aproximadas de Vélez
velez_lat = 6.01564392
velez_lng = -73.67397299

# Buscar tiempos en caché para cualquier hospital de Vélez
kams = supabase.table('kams').select('id, name, lat, lng').eq('active', True).execute()

for kam in kams.data[:5]:  # Solo los primeros 5 KAMs
    kam_lat = round(kam['lat'], 6)
    kam_lng = round(kam['lng'], 6)
    
    # Buscar tiempo hacia el centro de Vélez (aproximado)
    cache = supabase.table('travel_time_cache').select('travel_time').eq('origin_lat', kam_lat).eq('origin_lng', kam_lng).execute()
    
    # Filtrar los que están cerca de Vélez
    velez_times = []
    for c in cache.data:
        # Esta es una aproximación, buscaremos destinos cercanos a Vélez
        pass
    
    # Buscar específicamente para el hospital de Vélez
    velez_hospital_lat = round(velez_lat, 6)
    velez_hospital_lng = round(velez_lng, 6)
    
    specific_cache = supabase.table('travel_time_cache').select('travel_time').eq('origin_lat', kam_lat).eq('origin_lng', kam_lng).eq('dest_lat', velez_hospital_lat).eq('dest_lng', velez_hospital_lng).execute()
    
    if specific_cache.data:
        minutes = round(specific_cache.data[0]['travel_time'] / 60)
        status = "✅ Dentro del límite" if minutes <= 240 else "❌ Fuera del límite (>4h)"
        print(f"   {kam['name']}: {minutes} minutos {status}")