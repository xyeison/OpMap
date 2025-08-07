#!/usr/bin/env python3
"""
Migrar TODAS las rutas pendientes de travel_time_cache a hospital_kam_distances
"""
from supabase import create_client

supabase_url = 'https://norvxqgohddgsdkggqzq.supabase.co'
supabase_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vcnZ4cWdvaGRkZ3Nka2dncXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMDExMjUsImV4cCI6MjA2ODc3NzEyNX0.BRWIYeD_5OlpVKIrP1QzUmkSx6HEVGzcEUUiSK8CmJs'

supabase = create_client(supabase_url, supabase_key)

print("🔄 MIGRANDO TODAS LAS RUTAS PENDIENTES")
print("="*60)

# 1. Cargar KAMs y Hospitales
print("\n📥 Cargando datos...")
kams = supabase.table('kams').select('*').execute()
kams_dict = {}
for kam in kams.data:
    for precision in [6, 5, 4, 3]:
        lat_key = round(float(kam['lat']), precision)
        lng_key = round(float(kam['lng']), precision)
        key = f"{lat_key},{lng_key}"
        kams_dict[key] = kam

hospitals = supabase.table('hospitals').select('*').execute()
hospitals_dict = {}
for hospital in hospitals.data:
    for precision in [6, 5, 4, 3]:
        lat_key = round(float(hospital['lat']), precision)
        lng_key = round(float(hospital['lng']), precision)
        key = f"{lat_key},{lng_key}"
        hospitals_dict[key] = hospital

print(f"   KAMs: {len(kams.data)}")
print(f"   Hospitales: {len(hospitals.data)}")

# 2. Cargar distancias existentes
existing = supabase.table('hospital_kam_distances').select('hospital_id, kam_id').execute()
existing_pairs = set((d['hospital_id'], d['kam_id']) for d in existing.data)
print(f"   Distancias existentes: {len(existing_pairs)}")

# 3. Cargar TODO travel_time_cache
print("\n📥 Cargando travel_time_cache...")
all_cache = []
offset = 0
batch_size = 1000

while True:
    batch = supabase.table('travel_time_cache').select('*').range(offset, offset + batch_size - 1).execute()
    if not batch.data:
        break
    all_cache.extend(batch.data)
    offset += batch_size
    if len(batch.data) < batch_size:
        break

print(f"   Total registros: {len(all_cache)}")

# 4. Mapear y filtrar rutas pendientes
print("\n🔍 Identificando rutas pendientes...")
routes_to_insert = []
pares_vistos = set()

for cache in all_cache:
    # Buscar KAM
    kam_found = None
    for precision in [6, 5, 4, 3]:
        lat_key = round(float(cache['origin_lat']), precision)
        lng_key = round(float(cache['origin_lng']), precision)
        key = f"{lat_key},{lng_key}"
        if key in kams_dict:
            kam_found = kams_dict[key]
            break
    
    # Buscar Hospital
    hospital_found = None
    for precision in [6, 5, 4, 3]:
        lat_key = round(float(cache['dest_lat']), precision)
        lng_key = round(float(cache['dest_lng']), precision)
        key = f"{lat_key},{lng_key}"
        if key in hospitals_dict:
            hospital_found = hospitals_dict[key]
            break
    
    # Si encontramos ambos y no existe
    if kam_found and hospital_found:
        par = (hospital_found['id'], kam_found['id'])
        
        # Evitar duplicados en la misma ejecución
        if par not in pares_vistos and par not in existing_pairs:
            pares_vistos.add(par)
            routes_to_insert.append({
                'hospital_id': hospital_found['id'],
                'kam_id': kam_found['id'],
                'travel_time': cache['travel_time'],
                'distance': cache.get('distance'),
                'source': cache.get('source', 'google_maps'),
                'calculated_at': cache.get('calculated_at')
            })

print(f"   Rutas para insertar: {len(routes_to_insert)}")

# 5. Insertar en lotes
if routes_to_insert:
    print(f"\n💾 Insertando {len(routes_to_insert)} rutas...")
    
    batch_size = 50
    inserted_total = 0
    error_total = 0
    
    for i in range(0, len(routes_to_insert), batch_size):
        batch = routes_to_insert[i:i+batch_size]
        try:
            result = supabase.table('hospital_kam_distances').insert(batch).execute()
            if result.data:
                inserted_total += len(result.data)
                print(f"   Batch {i//batch_size + 1}/{(len(routes_to_insert)//batch_size)+1}: ✅ {len(result.data)} insertadas")
        except Exception as e:
            error_total += len(batch)
            print(f"   Batch {i//batch_size + 1}: ❌ Error - {str(e)[:50]}")
    
    print(f"\n📊 RESULTADO:")
    print(f"   Insertadas exitosamente: {inserted_total}")
    print(f"   Errores: {error_total}")

# 6. Verificación final
final_count = supabase.table('hospital_kam_distances').select('id', count='exact').execute()
print(f"\n✅ VERIFICACIÓN FINAL:")
print(f"   Total en hospital_kam_distances: {final_count.count}")
print(f"   Incremento: {final_count.count - len(existing_pairs)}")

print("\n" + "="*60)