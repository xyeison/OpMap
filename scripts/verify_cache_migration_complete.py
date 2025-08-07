#!/usr/bin/env python3
"""
Verificar COMPLETAMENTE la migración de travel_time_cache a hospital_kam_distances
"""
from supabase import create_client

supabase_url = 'https://norvxqgohddgsdkggqzq.supabase.co'
supabase_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vcnZ4cWdvaGRkZ3Nka2dncXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMDExMjUsImV4cCI6MjA2ODc3NzEyNX0.BRWIYeD_5OlpVKIrP1QzUmkSx6HEVGzcEUUiSK8CmJs'

supabase = create_client(supabase_url, supabase_key)

print("🔍 VERIFICACIÓN COMPLETA DE MIGRACIÓN")
print("="*60)

# 1. Contar registros totales
print("\n📊 CONTEO DE REGISTROS:")
cache_count = supabase.table('travel_time_cache').select('id', count='exact').execute()
print(f"   travel_time_cache: {cache_count.count} registros")

distances_count = supabase.table('hospital_kam_distances').select('id', count='exact').execute()
print(f"   hospital_kam_distances: {distances_count.count} registros")

print(f"\n   Diferencia: {cache_count.count - distances_count.count} registros")

# 2. Cargar todos los datos
print("\n📥 Cargando datos completos...")

# KAMs
kams = supabase.table('kams').select('*').execute()
kams_dict = {}
for kam in kams.data:
    # Crear múltiples claves con diferentes precisiones
    for precision in [6, 5, 4, 3]:
        lat_key = round(float(kam['lat']), precision)
        lng_key = round(float(kam['lng']), precision)
        key = f"{lat_key},{lng_key}"
        kams_dict[key] = kam

print(f"   KAMs cargados: {len(kams.data)}")

# Hospitales
hospitals = supabase.table('hospitals').select('*').execute()
hospitals_dict = {}
for hospital in hospitals.data:
    # Crear múltiples claves con diferentes precisiones
    for precision in [6, 5, 4, 3]:
        lat_key = round(float(hospital['lat']), precision)
        lng_key = round(float(hospital['lng']), precision)
        key = f"{lat_key},{lng_key}"
        hospitals_dict[key] = hospital

print(f"   Hospitales cargados: {len(hospitals.data)}")

# 3. Cargar travel_time_cache por lotes
print("\n🔍 Analizando travel_time_cache...")
all_cache = []
offset = 0
batch_size = 1000

while True:
    batch = supabase.table('travel_time_cache').select('*').range(offset, offset + batch_size - 1).execute()
    if not batch.data:
        break
    all_cache.extend(batch.data)
    print(f"   Cargados {len(all_cache)} registros...")
    offset += batch_size
    if len(batch.data) < batch_size:
        break

print(f"   Total cargados: {len(all_cache)}")

# 4. Analizar cada registro del caché
print("\n📊 ANALIZANDO REGISTROS:")

mapeable = []
sin_kam = []
sin_hospital = []
sin_ambos = []
duplicados = []

pares_vistos = set()

for i, cache in enumerate(all_cache):
    if i % 500 == 0:
        print(f"   Procesando {i}/{len(all_cache)}...")
    
    # Buscar KAM y Hospital con diferentes precisiones
    kam_found = None
    hospital_found = None
    
    # Intentar diferentes precisiones para KAM
    for precision in [6, 5, 4, 3]:
        lat_key = round(float(cache['origin_lat']), precision)
        lng_key = round(float(cache['origin_lng']), precision)
        key = f"{lat_key},{lng_key}"
        if key in kams_dict:
            kam_found = kams_dict[key]
            break
    
    # Intentar diferentes precisiones para Hospital
    for precision in [6, 5, 4, 3]:
        lat_key = round(float(cache['dest_lat']), precision)
        lng_key = round(float(cache['dest_lng']), precision)
        key = f"{lat_key},{lng_key}"
        if key in hospitals_dict:
            hospital_found = hospitals_dict[key]
            break
    
    # Clasificar
    if kam_found and hospital_found:
        par = (hospital_found['id'], kam_found['id'])
        if par in pares_vistos:
            duplicados.append(cache)
        else:
            pares_vistos.add(par)
            mapeable.append({
                'cache_id': cache['id'],
                'hospital_id': hospital_found['id'],
                'kam_id': kam_found['id'],
                'travel_time': cache['travel_time']
            })
    elif kam_found and not hospital_found:
        sin_hospital.append(cache)
    elif not kam_found and hospital_found:
        sin_kam.append(cache)
    else:
        sin_ambos.append(cache)

print(f"\n📊 RESULTADOS DEL ANÁLISIS:")
print(f"   ✅ Mapeables (únicos): {len(mapeable)}")
print(f"   ⚠️ Duplicados: {len(duplicados)}")
print(f"   ❌ Sin KAM identificado: {len(sin_kam)}")
print(f"   ❌ Sin Hospital identificado: {len(sin_hospital)}")
print(f"   ❌ Sin ninguno: {len(sin_ambos)}")
print(f"   TOTAL: {len(mapeable) + len(duplicados) + len(sin_kam) + len(sin_hospital) + len(sin_ambos)}")

# 5. Verificar qué está en hospital_kam_distances
print("\n🔍 Verificando hospital_kam_distances...")
distances = supabase.table('hospital_kam_distances').select('hospital_id, kam_id').execute()
distances_set = set((d['hospital_id'], d['kam_id']) for d in distances.data)
print(f"   Pares únicos en hospital_kam_distances: {len(distances_set)}")

# 6. Comparar con mapeables
no_migrados = []
for route in mapeable:
    par = (route['hospital_id'], route['kam_id'])
    if par not in distances_set:
        no_migrados.append(route)

print(f"\n📊 ESTADO DE MIGRACIÓN:")
print(f"   Rutas mapeables: {len(mapeable)}")
print(f"   Ya en hospital_kam_distances: {len(mapeable) - len(no_migrados)}")
print(f"   NO migradas: {len(no_migrados)}")

# 7. Analizar registros sin mapear
if sin_hospital:
    print(f"\n🔍 Analizando {len(sin_hospital)} registros sin hospital...")
    # Ver coordenadas únicas de destino
    destinos_unicos = set()
    for cache in sin_hospital[:10]:
        destinos_unicos.add((cache['dest_lat'], cache['dest_lng']))
    
    print(f"   Primeras coordenadas destino sin hospital:")
    for lat, lng in list(destinos_unicos)[:5]:
        print(f"      ({lat}, {lng})")

if sin_kam:
    print(f"\n🔍 Analizando {len(sin_kam)} registros sin KAM...")
    # Ver coordenadas únicas de origen
    origenes_unicos = set()
    for cache in sin_kam[:10]:
        origenes_unicos.add((cache['origin_lat'], cache['origin_lng']))
    
    print(f"   Primeras coordenadas origen sin KAM:")
    for lat, lng in list(origenes_unicos)[:5]:
        print(f"      ({lat}, {lng})")

# 8. Migrar los no migrados
if no_migrados:
    print(f"\n💾 Migrando {len(no_migrados)} rutas faltantes...")
    migrated = 0
    errors = 0
    
    for route in no_migrados[:100]:  # Primeros 100
        try:
            result = supabase.table('hospital_kam_distances').insert({
                'hospital_id': route['hospital_id'],
                'kam_id': route['kam_id'],
                'travel_time': route['travel_time'],
                'source': 'google_maps'
            }).execute()
            if result.data:
                migrated += 1
        except:
            errors += 1
    
    print(f"   Migradas: {migrated}")
    print(f"   Errores: {errors}")

# 9. Resumen final
print("\n" + "="*60)
print("📊 RESUMEN FINAL")
print("="*60)
print(f"travel_time_cache: {len(all_cache)} registros")
print(f"  ├─ Mapeables a KAM-Hospital: {len(mapeable)}")
print(f"  ├─ Duplicados: {len(duplicados)}")
print(f"  └─ No mapeables: {len(sin_kam) + len(sin_hospital) + len(sin_ambos)}")
print()
print(f"hospital_kam_distances: {distances_count.count} registros")
print(f"  ├─ Migrados correctamente: {len(mapeable) - len(no_migrados)}")
print(f"  └─ Pendientes de migrar: {len(no_migrados)}")
print()
print(f"⚠️ REGISTROS NO ÚTILES: {len(sin_kam) + len(sin_hospital) + len(sin_ambos)}")
print("   (No corresponden a pares KAM-Hospital válidos)")
print("="*60)