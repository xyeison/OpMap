#!/usr/bin/env python3
"""
Limpiar todas las estimaciones Haversine del caché
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

print("🧹 LIMPIEZA DE ESTIMACIONES HAVERSINE\n")

# 1. Contar registros por source
print("1. Estado actual del caché:")
sources = supabase.from_('travel_time_cache').select('source', count='exact').execute()

# Obtener conteo por source manualmente
all_records = supabase.from_('travel_time_cache').select('source').execute()
source_counts = {}
if all_records.data:
    for record in all_records.data:
        source = record['source']
        source_counts[source] = source_counts.get(source, 0) + 1

for source, count in source_counts.items():
    print(f"   - {source}: {count} registros")

# 2. Eliminar todos los haversine_estimate
print("\n2. Eliminando registros con source='haversine_estimate'...")

# Primero contar cuántos hay
haversine_count = source_counts.get('haversine_estimate', 0)

if haversine_count > 0:
    # Eliminar en lotes para evitar timeout
    batch_size = 1000
    deleted_total = 0
    
    while True:
        # Obtener IDs de registros haversine
        batch = supabase.from_('travel_time_cache').select('id').eq('source', 'haversine_estimate').limit(batch_size).execute()
        
        if not batch.data:
            break
            
        ids_to_delete = [record['id'] for record in batch.data]
        
        # Eliminar este lote
        result = supabase.from_('travel_time_cache').delete().in_('id', ids_to_delete).execute()
        
        deleted_total += len(ids_to_delete)
        print(f"   Eliminados {deleted_total} de {haversine_count} registros...")
        
        if len(batch.data) < batch_size:
            break
    
    print(f"   ✅ Total eliminados: {deleted_total} registros haversine_estimate")
else:
    print("   ✅ No hay registros haversine_estimate para eliminar")

# 3. Verificar estado final
print("\n3. Estado final del caché:")
all_records = supabase.from_('travel_time_cache').select('source').execute()
source_counts = {}
if all_records.data:
    for record in all_records.data:
        source = record['source']
        source_counts[source] = source_counts.get(source, 0) + 1

for source, count in source_counts.items():
    print(f"   - {source}: {count} registros")

print(f"\n✅ Limpieza completada")
print("💡 Ahora ejecute el recálculo de asignaciones para usar solo tiempos reales de Google Maps")