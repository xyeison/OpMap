#!/usr/bin/env python3
"""
Limpieza inteligente de tiempos de viaje imposibles
Solo elimina tiempos que son físicamente imposibles, preservando los cálculos válidos de Google Maps
"""

import os
from dotenv import load_dotenv
from supabase import create_client
from math import radians, sin, cos, sqrt, atan2

# Cargar variables de entorno
load_dotenv()

# Configurar Supabase
url = os.getenv('SUPABASE_URL')
key = os.getenv('SUPABASE_ANON_KEY')

if not url or not key:
    print("❌ Error: Variables de entorno SUPABASE_URL y SUPABASE_ANON_KEY no configuradas")
    exit(1)

supabase = create_client(url, key)

def haversine_distance(lat1, lon1, lat2, lon2):
    """Calcular distancia en km entre dos puntos"""
    R = 6371  # Radio de la Tierra en km
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * atan2(sqrt(a), sqrt(1-a))
    return R * c

print("🧹 LIMPIEZA INTELIGENTE DE TIEMPOS IMPOSIBLES\n")

# 1. Analizar todos los tiempos
print("1. Analizando todos los tiempos de viaje...")
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

print(f"\n   Total de registros: {len(all_times)}")

# 2. Identificar tiempos imposibles
impossible_times = []
statistics = {
    'zero_time': 0,
    'too_fast': 0,
    'too_slow': 0,
    'valid': 0
}

print("\n2. Identificando tiempos imposibles...")

for record in all_times:
    seconds = record['travel_time']
    minutes = seconds / 60
    
    # Calcular distancia
    distance = haversine_distance(
        record['origin_lat'], record['origin_lng'],
        record['dest_lat'], record['dest_lng']
    )
    
    # Reglas para identificar tiempos imposibles:
    
    # 1. Tiempo cero o negativo SOLO si la distancia es mayor a 2 km
    # (permite tiempo 0 para mismo municipio/territorio base)
    if seconds <= 0:
        if distance > 2:  # Si están a más de 2 km, tiempo 0 es imposible
            impossible_times.append(record['id'])
            statistics['zero_time'] += 1
            continue
        else:
            statistics['valid'] += 1  # Tiempo 0 es válido para territorio base
            continue
    
    # 2. Velocidad imposible (>200 km/h)
    if minutes > 0:
        speed_kmh = (distance / minutes) * 60
        
        if speed_kmh > 200:  # Más de 200 km/h es imposible
            impossible_times.append(record['id'])
            statistics['too_fast'] += 1
            continue
    
    # 3. Demasiado lento para la distancia (menos de 5 km/h para distancias cortas)
    if distance < 1 and minutes > 12:  # Menos de 1 km no debería tomar más de 12 minutos
        impossible_times.append(record['id'])
        statistics['too_slow'] += 1
        continue
    
    # 4. Casos específicos: distancia grande con tiempo muy corto
    if distance > 10 and minutes < 5:  # Más de 10 km en menos de 5 minutos
        impossible_times.append(record['id'])
        statistics['too_fast'] += 1
        continue
    
    statistics['valid'] += 1

# 3. Mostrar estadísticas
print(f"\n3. Estadísticas:")
print(f"   ✅ Tiempos válidos: {statistics['valid']:,}")
print(f"   ❌ Tiempo cero con distancia >2km: {statistics['zero_time']:,}")
print(f"   ❌ Demasiado rápido (>200 km/h): {statistics['too_fast']:,}")
print(f"   ❌ Demasiado lento: {statistics['too_slow']:,}")
print(f"   ❌ Total a eliminar: {len(impossible_times):,}")
print(f"\n   Nota: Tiempos de 0 segundos en territorio base (misma zona) se preservan")

# 4. Confirmar antes de eliminar
if impossible_times:
    percentage = (len(impossible_times) / len(all_times)) * 100
    print(f"\n   Esto representa el {percentage:.1f}% del total")
    
    # Eliminar en lotes
    print(f"\n4. Eliminando {len(impossible_times)} registros imposibles...")
    
    batch_size = 100
    for i in range(0, len(impossible_times), batch_size):
        batch_ids = impossible_times[i:i+batch_size]
        supabase.from_('travel_time_cache').delete().in_('id', batch_ids).execute()
        
        progress = min(i + batch_size, len(impossible_times))
        print(f"   Progreso: {progress:,} / {len(impossible_times):,}")
    
    print("\n✅ Limpieza completada")
    
    # 5. Verificar resultados
    remaining = supabase.from_('travel_time_cache').select('*', count='exact', head=True).execute()
    print(f"\n5. Resultados finales:")
    print(f"   Registros antes: {len(all_times):,}")
    print(f"   Registros eliminados: {len(impossible_times):,}")
    print(f"   Registros restantes: {remaining.count:,}")
    
else:
    print("\n✅ No se encontraron tiempos imposibles")

print("\n💡 Próximo paso: Ejecutar el recálculo desde la interfaz web")
print("   Los hospitales sin asignar ahora deberían asignarse correctamente")