#!/usr/bin/env python3
"""
Verificar estado del hospital 900067136-1
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

print("🔍 Buscando hospital con código 900067136-1...\n")

# Buscar el hospital
result = supabase.table('hospitals').select('*').eq('code', '900067136-1').execute()

if not result.data:
    print("❌ No se encontró el hospital con código 900067136-1")
    exit(1)

hospital = result.data[0]
print("✅ Hospital encontrado:")
print(f"   ID: {hospital['id']}")
print(f"   Nombre: {hospital['name']}")
print(f"   Código: {hospital['code']}")
print(f"   Municipio: {hospital['municipality_id']} - {hospital['municipality_name']}")
print(f"   Departamento: {hospital['department_id']} - {hospital.get('department_name', 'N/A')}")
print(f"   Coordenadas: {hospital['lat']}, {hospital['lng']}")
print(f"   Activo: {hospital['active']}")
print(f"   Camas: {hospital.get('beds', 0)}")

# Buscar asignación
assignment_result = supabase.table('assignments').select('*, kams(name, area_id)').eq('hospital_id', hospital['id']).execute()

if assignment_result.data:
    for i, assignment in enumerate(assignment_result.data):
        print(f"\n📍 Asignación {i+1}:")
        print(f"   ID Asignación: {assignment['id']}")
        print(f"   KAM: {assignment['kams']['name'] if assignment.get('kams') else 'N/A'}")
        print(f"   KAM área: {assignment['kams']['area_id'] if assignment.get('kams') else 'N/A'}")
        print(f"   Tiempo: {assignment.get('travel_time', 0)} segundos ({round(assignment.get('travel_time', 0) / 60) if assignment.get('travel_time') else 0} minutos)")
        print(f"   Tipo: {assignment.get('assignment_type', 'N/A')}")
        print(f"   Es territorio base: {assignment.get('is_base_territory', False)}")
        print(f"   Fecha asignación: {assignment.get('assigned_at', 'N/A')}")
else:
    print("\n⚠️ NO HAY ASIGNACIONES para este hospital")

# Verificar si hay asignaciones duplicadas
print("\n🔍 Verificando posibles duplicados...")
dup_result = supabase.table('assignments').select('id, kam_id, hospital_id, kams(name)').eq('hospital_id', hospital['id']).execute()

if dup_result.data and len(dup_result.data) > 1:
    print(f"⚠️ ALERTA: Hay {len(dup_result.data)} asignaciones para este hospital!")
    for dup in dup_result.data:
        print(f"   - ID: {dup['id']}, KAM: {dup['kams']['name'] if dup.get('kams') else 'Sin KAM'}")

# Verificar si el hospital tiene múltiples IDs
print("\n🔍 Verificando si hay hospitales duplicados con el mismo código...")
dup_hospitals = supabase.table('hospitals').select('id, code, name, active').eq('code', '900067136-1').execute()

if dup_hospitals.data and len(dup_hospitals.data) > 1:
    print(f"⚠️ ALERTA: Hay {len(dup_hospitals.data)} hospitales con el mismo código!")
    for h in dup_hospitals.data:
        print(f"   - ID: {h['id']}, Nombre: {h['name']}, Activo: {h['active']}")

# Buscar en caché de tiempos
print("\n🚗 Verificando rutas en caché hacia este hospital...")

lat_rounded = round(hospital['lat'], 6)
lng_rounded = round(hospital['lng'], 6)

# Buscar KAMs activos
kams_result = supabase.table('kams').select('name, lat, lng, area_id').eq('active', True).execute()

if kams_result.data:
    for kam in kams_result.data[:5]:  # Solo los primeros 5 KAMs
        kam_lat_rounded = round(kam['lat'], 6)
        kam_lng_rounded = round(kam['lng'], 6)
        
        cache_result = supabase.table('travel_time_cache').select('travel_time').eq('origin_lat', kam_lat_rounded).eq('origin_lng', kam_lng_rounded).eq('dest_lat', lat_rounded).eq('dest_lng', lng_rounded).execute()
        
        if cache_result.data:
            travel_time = cache_result.data[0]['travel_time']
            minutes = round(travel_time / 60)
            print(f"   - {kam['name']}: {minutes} minutos")
        else:
            print(f"   - {kam['name']}: Sin ruta en caché")