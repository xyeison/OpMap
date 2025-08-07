#!/usr/bin/env python3
"""
Probar tiempos de hospitales no asignados
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

print("🔍 Probando tiempos de hospitales no asignados...\n")

# 1. Obtener hospitales asignados
assignments = supabase.table('assignments').select('hospital_id').execute()
assigned_ids = [a['hospital_id'] for a in assignments.data]

# 2. Obtener hospitales no asignados
hospitals = supabase.table('hospitals').select('*').eq('active', True).execute()
unassigned = [h for h in hospitals.data if h['id'] not in assigned_ids]

print(f"📊 Total hospitales no asignados: {len(unassigned)}")

# 3. Obtener KAMs activos
kams = supabase.table('kams').select('*').eq('active', True).execute()
print(f"📊 Total KAMs activos: {len(kams.data)}")

# 4. Para el primer hospital no asignado, buscar tiempos
if unassigned:
    hospital = unassigned[0]
    print(f"\n🏥 Hospital ejemplo: {hospital['name']} ({hospital['code']})")
    print(f"   Ubicación: {hospital['municipality_name']}, {hospital.get('department_name', 'N/A')}")
    print(f"   Coordenadas: {hospital['lat']}, {hospital['lng']}")
    
    print(f"\n⏱️ Tiempos de viaje desde cada KAM:")
    
    times_found = 0
    for kam in kams.data:
        # Redondear coordenadas
        kam_lat = round(kam['lat'], 6)
        kam_lng = round(kam['lng'], 6)
        hosp_lat = round(hospital['lat'], 6)
        hosp_lng = round(hospital['lng'], 6)
        
        # Buscar en caché
        cache = supabase.table('travel_time_cache').select('travel_time').eq('origin_lat', kam_lat).eq('origin_lng', kam_lng).eq('dest_lat', hosp_lat).eq('dest_lng', hosp_lng).execute()
        
        if cache.data:
            time_seconds = cache.data[0]['travel_time']
            time_minutes = round(time_seconds / 60)
            time_hours = time_minutes / 60
            
            status = "✅" if time_minutes <= kam.get('max_travel_time', 240) else "❌"
            print(f"   {status} {kam['name']}: {time_minutes} min ({time_hours:.1f} horas)")
            times_found += 1
        else:
            print(f"   ⚠️ {kam['name']}: Sin calcular")
    
    print(f"\n📊 Resumen: {times_found} de {len(kams.data)} KAMs tienen tiempo calculado")