#!/usr/bin/env python3
"""
Eliminar tiempos de viaje incorrectos (menores a 10 minutos entre ciudades diferentes)
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

print("🔧 CORRECCIÓN DE TIEMPOS DE VIAJE INCORRECTOS\n")

# 1. Buscar tiempos menores a 10 minutos (600 segundos)
print("1. Buscando tiempos sospechosos (<10 minutos)...")
suspicious_times = supabase.from_('travel_time_cache').select('*').lt('travel_time', 600).execute()

print(f"   Encontrados: {len(suspicious_times.data)} registros")

# 2. Analizar cada tiempo sospechoso
incorrect_ids = []

for record in suspicious_times.data:
    # Obtener información de origen y destino
    origin_lat = record['origin_lat']
    origin_lng = record['origin_lng']
    dest_lat = record['dest_lat']
    dest_lng = record['dest_lng']
    minutes = record['travel_time'] / 60
    
    # Calcular distancia aproximada
    from math import radians, sin, cos, sqrt, atan2
    R = 6371  # Radio de la Tierra en km
    
    lat1, lon1 = radians(origin_lat), radians(origin_lng)
    lat2, lon2 = radians(dest_lat), radians(dest_lng)
    
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * atan2(sqrt(a), sqrt(1-a))
    distance = R * c
    
    # Si la distancia es mayor a 5 km y el tiempo es menor a 10 minutos, es sospechoso
    if distance > 5:
        print(f"\n   ⚠️ SOSPECHOSO:")
        print(f"      Tiempo: {minutes:.1f} minutos")
        print(f"      Distancia: {distance:.1f} km")
        print(f"      Velocidad implícita: {(distance/minutes*60):.0f} km/h")
        
        # Buscar qué KAM es
        kam_origin = supabase.from_('kams').select('name').eq('lat', origin_lat).eq('lng', origin_lng).execute()
        if kam_origin.data:
            print(f"      Origen: {kam_origin.data[0]['name']}")
        
        incorrect_ids.append(record['id'])

# 3. Eliminar tiempos incorrectos
if incorrect_ids:
    print(f"\n2. Eliminando {len(incorrect_ids)} registros incorrectos...")
    
    for id_to_delete in incorrect_ids:
        supabase.from_('travel_time_cache').delete().eq('id', id_to_delete).execute()
    
    print("   ✅ Registros eliminados")
else:
    print("\n✅ No se encontraron tiempos obviamente incorrectos")

# 4. Verificar específicamente los tiempos a Girardot
print("\n3. Verificando tiempos específicos a Girardot...")

# Coordenadas aproximadas de Girardot
girardot_lat = 4.296
girardot_lng = -74.798

girardot_times = supabase.from_('travel_time_cache').select('*').eq('dest_lat', 4.29662698).eq('dest_lng', -74.79827393).execute()

print(f"   Tiempos a Girardot: {len(girardot_times.data)}")

for record in girardot_times.data:
    minutes = record['travel_time'] / 60
    
    # Buscar KAM
    kam = supabase.from_('kams').select('name, area_id').eq('lat', record['origin_lat']).eq('lng', record['origin_lng']).execute()
    
    if kam.data:
        kam_name = kam.data[0]['name']
        area = kam.data[0]['area_id']
        
        # Si es un KAM de Bogotá y el tiempo es menor a 30 minutos, es sospechoso
        if area.startswith('11001') and minutes < 30:
            print(f"   ❌ {kam_name}: {minutes:.0f} min - INCORRECTO (Bogotá a Girardot no puede ser <30 min)")
            supabase.from_('travel_time_cache').delete().eq('id', record['id']).execute()
        else:
            print(f"   ✅ {kam_name}: {minutes:.0f} min")

print("\n✅ Limpieza completada")
print("💡 Ejecute el recálculo nuevamente para que use solo tiempos correctos")