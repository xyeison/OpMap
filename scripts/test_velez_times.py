#!/usr/bin/env python3
"""
Probar tiempos del hospital de Vélez específicamente
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

print("🔍 Buscando hospital de Vélez (900067136-1)...\n")

# Buscar el hospital de Vélez
hospital = supabase.table('hospitals').select('*').eq('code', '900067136-1').execute()

if not hospital.data:
    print("❌ No se encontró el hospital")
    exit(1)

hospital = hospital.data[0]
print(f"🏥 Hospital: {hospital['name']}")
print(f"   Ubicación: {hospital['municipality_name']}")
print(f"   Coordenadas: {hospital['lat']}, {hospital['lng']}")

# Verificar si está asignado
assignment = supabase.table('assignments').select('*').eq('hospital_id', hospital['id']).execute()
if assignment.data:
    print(f"   ✅ ASIGNADO")
else:
    print(f"   ❌ NO ASIGNADO")

# Obtener KAMs y buscar tiempos
kams = supabase.table('kams').select('*').eq('active', True).execute()

print(f"\n⏱️ Tiempos de viaje desde cada KAM:")

hosp_lat = round(hospital['lat'], 6)
hosp_lng = round(hospital['lng'], 6)

for kam in kams.data:
    kam_lat = round(kam['lat'], 6)
    kam_lng = round(kam['lng'], 6)
    
    # Buscar en caché
    cache = supabase.table('travel_time_cache').select('travel_time').eq('origin_lat', kam_lat).eq('origin_lng', kam_lng).eq('dest_lat', hosp_lat).eq('dest_lng', hosp_lng).execute()
    
    if cache.data:
        time_seconds = cache.data[0]['travel_time']
        time_minutes = round(time_seconds / 60)
        time_hours = time_minutes / 60
        
        status = "✅" if time_minutes <= kam.get('max_travel_time', 240) else "❌"
        print(f"   {status} {kam['name']}: {time_minutes} min ({time_hours:.1f} horas) - Límite: {kam.get('max_travel_time', 240)} min")
    else:
        print(f"   ⚠️ {kam['name']}: Sin calcular")