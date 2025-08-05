#!/usr/bin/env python3
"""
Eliminar tiempos incorrectos específicamente para Girardot
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

print("🎯 CORRECCIÓN ESPECÍFICA: TIEMPOS A GIRARDOT\n")

# 1. Obtener todos los tiempos a hospitales de Girardot
print("1. Obteniendo tiempos actuales a Girardot...")

# Primero, obtener hospitales en Girardot
girardot_hospitals = supabase.from_('hospitals').select('id, name, lat, lng').eq('municipality_id', '25307').execute()

deleted_count = 0

for hospital in girardot_hospitals.data:
    print(f"\n   Hospital: {hospital['name']}")
    
    # Obtener todos los tiempos a este hospital
    times = supabase.from_('travel_time_cache').select('*').eq('dest_lat', hospital['lat']).eq('dest_lng', hospital['lng']).execute()
    
    for record in times.data:
        # Buscar el KAM origen
        kam = supabase.from_('kams').select('name, area_id').eq('lat', record['origin_lat']).eq('lng', record['origin_lng']).execute()
        
        if kam.data:
            kam_name = kam.data[0]['name']
            area_id = kam.data[0]['area_id']
            dept = area_id[:2]
            minutes = record['travel_time'] / 60
            
            # Reglas de eliminación:
            # 1. Si es de Bogotá (11) y el tiempo es menor a 60 minutos, es imposible
            # 2. Si es de cualquier otro departamento fuera de Cundinamarca y el tiempo es menor a 30 minutos
            delete = False
            reason = ""
            
            if dept == '11' and minutes < 60:
                delete = True
                reason = "Bogotá a Girardot no puede ser <60 min"
            elif dept not in ['25', '11'] and minutes < 30:
                delete = True
                reason = f"Departamento {dept} a Girardot no puede ser <30 min"
            
            if delete:
                print(f"      ❌ {kam_name}: {minutes:.0f} min - ELIMINANDO ({reason})")
                supabase.from_('travel_time_cache').delete().eq('id', record['id']).execute()
                deleted_count += 1
            else:
                print(f"      ✅ {kam_name}: {minutes:.0f} min - OK")

print(f"\n2. Total de registros eliminados: {deleted_count}")

# 3. Verificar que el tiempo de Ibagué sigue existiendo
print("\n3. Verificando tiempo de Ibagué a Girardot...")
ibague_kam = supabase.from_('kams').select('*').eq('area_id', '73001').execute().data[0]

for hospital in girardot_hospitals.data:
    time = supabase.from_('travel_time_cache').select('travel_time').eq(
        'origin_lat', ibague_kam['lat']
    ).eq(
        'origin_lng', ibague_kam['lng']
    ).eq(
        'dest_lat', hospital['lat']
    ).eq(
        'dest_lng', hospital['lng']
    ).execute()
    
    if time.data:
        minutes = time.data[0]['travel_time'] / 60
        print(f"   ✅ Ibagué → {hospital['name']}: {minutes:.0f} minutos")
    else:
        print(f"   ❌ No hay tiempo de Ibagué a {hospital['name']}")

print("\n✅ Corrección completada")
print("💡 Ahora ejecute el recálculo desde la interfaz web")