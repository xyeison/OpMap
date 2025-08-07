#!/usr/bin/env python3

import os
from dotenv import load_dotenv
from supabase import create_client, Client

# Cargar variables de entorno
load_dotenv()

# Inicializar Supabase
supabase_url = os.getenv('SUPABASE_URL')
supabase_key = os.getenv('SUPABASE_ANON_KEY')
supabase: Client = create_client(supabase_url, supabase_key)

print("📊 ESTADO ACTUAL EN SUPABASE\n")

# Total hospitales
hospitals = supabase.table('hospitals').select('*', count='exact').eq('active', True).execute()
print(f"Total hospitales activos: {hospitals.count}")

# Total asignaciones
assignments = supabase.table('assignments').select('*', count='exact').execute()
print(f"Total asignaciones: {assignments.count}")

# KAMs activos
kams = supabase.table('kams').select('*', count='exact').eq('active', True).execute()
print(f"Total KAMs activos: {kams.count}")

# Tiempos en caché
cache = supabase.table('travel_time_cache').select('*', count='exact').execute()
print(f"Total rutas en caché: {cache.count}")

print(f"\n⚠️  Hospitales sin asignar: {hospitals.count - assignments.count}")

# Ver distribución de asignaciones
print("\n📊 ASIGNACIONES POR KAM:")
kam_assignments = supabase.table('assignments').select('kam_id, kams(name)').execute()

kam_count = {}
for assignment in kam_assignments.data:
    kam_name = assignment['kams']['name'] if assignment['kams'] else 'Unknown'
    kam_count[kam_name] = kam_count.get(kam_name, 0) + 1

for kam, count in sorted(kam_count.items(), key=lambda x: x[1], reverse=True):
    print(f"  {kam}: {count}")

print("\nNOTA: Para ejecutar el recálculo COMPLETO, usa la aplicación web o el endpoint de la API.")