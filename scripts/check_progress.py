#!/usr/bin/env python3

import os
from dotenv import load_dotenv
from supabase import create_client, Client
from datetime import datetime, timedelta

# Cargar variables de entorno
load_dotenv()

# Inicializar Supabase
supabase_url = os.getenv('SUPABASE_URL')
supabase_key = os.getenv('SUPABASE_ANON_KEY')
supabase: Client = create_client(supabase_url, supabase_key)

print("📊 VERIFICANDO PROGRESO DEL RECÁLCULO\n")

# Contar entradas en caché
response = supabase.table('travel_time_cache').select('*', count='exact').execute()
total_cache = response.count
print(f"Total de rutas en caché: {total_cache}")

# Contar las más recientes (últimos 10 minutos)
ten_minutes_ago = (datetime.now() - timedelta(minutes=10)).isoformat()
recent = supabase.table('travel_time_cache').select('*', count='exact').gte('calculated_at', ten_minutes_ago).execute()
recent_count = recent.count
print(f"Rutas calculadas en los últimos 10 minutos: {recent_count}")

# Verificar específicamente Girardot
print("\n🎯 VERIFICANDO GIRARDOT:")

# Buscar KAM de Ibagué
kam_ibague = supabase.table('kams').select('*').eq('area_id', '73001').single().execute()

# Buscar hospitales en Girardot
hospitals_girardot = supabase.table('hospitals').select('*').eq('municipality_id', '25307').eq('active', True).execute()

if kam_ibague.data and hospitals_girardot.data:
    for hospital in hospitals_girardot.data:
        # Verificar si existe tiempo en caché
        cache_entry = supabase.table('travel_time_cache').select('*').eq(
            'origin_lat', round(kam_ibague.data['lat'], 6)
        ).eq(
            'origin_lng', round(kam_ibague.data['lng'], 6)
        ).eq(
            'dest_lat', round(hospital['lat'], 6)
        ).eq(
            'dest_lng', round(hospital['lng'], 6)
        ).execute()
        
        if cache_entry.data:
            time_minutes = cache_entry.data[0]['travel_time'] / 60
            calculated_at = cache_entry.data[0]['calculated_at']
            print(f"✅ {hospital['name']}: {time_minutes:.0f} minutos (calculado: {calculated_at})")
        else:
            print(f"❌ {hospital['name']}: NO CALCULADO")

# Verificar asignaciones
print("\n📋 ASIGNACIONES ACTUALES:")
response = supabase.table('assignments').select('*', count='exact').execute()
total_assignments = response.count
print(f"Total de hospitales asignados: {total_assignments}")

# Ver las últimas asignaciones
print("\n🆕 ÚLTIMAS 5 ASIGNACIONES:")
recent_assignments = supabase.table('assignments').select('*, hospitals(name, municipality_id), kams(name)').order('assigned_at', desc=True).limit(5).execute()

for assignment in recent_assignments.data:
    hospital_name = assignment['hospitals']['name']
    kam_name = assignment['kams']['name']
    assigned_at = assignment['assigned_at']
    print(f"- {hospital_name} → {kam_name} ({assigned_at})")