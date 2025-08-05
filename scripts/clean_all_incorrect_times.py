#!/usr/bin/env python3
"""
Eliminar TODOS los tiempos de viaje físicamente imposibles
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

print("🧹 LIMPIEZA MASIVA DE TIEMPOS INCORRECTOS\n")

# 1. Eliminar tiempos menores a 10 minutos donde la distancia es mayor a 10 km
print("1. Eliminando tiempos físicamente imposibles...")

# Primero, obtener TODOS los registros para análisis
all_times = []
offset = 0
batch_size = 1000

while True:
    batch = supabase.from_('travel_time_cache').select('*').range(offset, offset + batch_size - 1).execute()
    if not batch.data:
        break
    all_times.extend(batch.data)
    offset += batch_size
    print(f"   Cargados {len(all_times)} registros...")
    if len(batch.data) < batch_size:
        break

print(f"\n   Total de registros a analizar: {len(all_times)}")

# Analizar cada registro
to_delete = []

for record in all_times:
    minutes = record['travel_time'] / 60
    distance = record.get('distance', 0)
    
    # Si no hay distancia, calcularla
    if distance == 0:
        from math import radians, sin, cos, sqrt, atan2
        R = 6371  # Radio de la Tierra en km
        
        lat1, lon1 = radians(record['origin_lat']), radians(record['origin_lng'])
        lat2, lon2 = radians(record['dest_lat']), radians(record['dest_lng'])
        
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        
        a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
        c = 2 * atan2(sqrt(a), sqrt(1-a))
        distance = R * c
    
    # Calcular velocidad implícita
    if minutes > 0:
        speed_kmh = (distance / minutes) * 60
        
        # Si la velocidad es mayor a 150 km/h (imposible en ciudades) o el tiempo es irreal
        if speed_kmh > 150 or (distance > 10 and minutes < 10):
            to_delete.append(record['id'])

print(f"\n2. Registros a eliminar: {len(to_delete)}")

# Eliminar en lotes
if to_delete:
    batch_size = 100
    for i in range(0, len(to_delete), batch_size):
        batch_ids = to_delete[i:i+batch_size]
        supabase.from_('travel_time_cache').delete().in_('id', batch_ids).execute()
        print(f"   Eliminados {min(i+batch_size, len(to_delete))} de {len(to_delete)}...")

# 3. Específicamente eliminar tiempos incorrectos a Girardot
print("\n3. Limpiando tiempos específicos a Girardot...")

# Eliminar TODOS los tiempos menores a 30 minutos a Girardot desde fuera de Cundinamarca
girardot_times = supabase.from_('travel_time_cache').select('*').eq('dest_lat', 4.29662698).eq('dest_lng', -74.79827393).lt('travel_time', 1800).execute()

for record in girardot_times.data:
    # Buscar el KAM origen
    kam = supabase.from_('kams').select('name, area_id').eq('lat', record['origin_lat']).eq('lng', record['origin_lng']).execute()
    
    if kam.data:
        area_id = kam.data[0]['area_id']
        dept = area_id[:2]
        
        # Si no es de Cundinamarca (25) y el tiempo es menor a 30 minutos, es imposible
        if dept != '25':
            supabase.from_('travel_time_cache').delete().eq('id', record['id']).execute()
            print(f"   Eliminado: {kam.data[0]['name']} → Girardot ({record['travel_time']/60:.0f} min)")

# 4. Verificar estado final
print("\n4. Estado final:")
remaining = supabase.from_('travel_time_cache').select('id', count='exact').execute()
print(f"   Registros restantes: {remaining.count}")

print("\n✅ Limpieza completada")
print("💡 Ahora el sistema debería recalcular correctamente con tiempos reales")