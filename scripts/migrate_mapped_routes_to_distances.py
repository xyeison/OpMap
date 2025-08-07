#!/usr/bin/env python3
"""
Migrar todas las rutas mapeadas de travel_time_cache a hospital_kam_distances
"""
from supabase import create_client
import json

supabase_url = 'https://norvxqgohddgsdkggqzq.supabase.co'
supabase_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vcnZ4cWdvaGRkZ3Nka2dncXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMDExMjUsImV4cCI6MjA2ODc3NzEyNX0.BRWIYeD_5OlpVKIrP1QzUmkSx6HEVGzcEUUiSK8CmJs'

supabase = create_client(supabase_url, supabase_key)

print("🔄 Migrando rutas mapeadas a hospital_kam_distances")
print("="*60)

# 1. Cargar rutas mapeadas
print("\n📥 Cargando rutas mapeadas...")
with open('/Users/yeison/Documents/GitHub/OpMap/output/all_mapped_routes.json', 'r') as f:
    mapped_routes = json.load(f)

print(f"   Total rutas mapeadas: {len(mapped_routes)}")

# 2. Obtener rutas ya existentes en hospital_kam_distances
print("\n📊 Verificando rutas existentes...")
existing = supabase.table('hospital_kam_distances').select('hospital_id, kam_id').execute()
existing_pairs = set((r['hospital_id'], r['kam_id']) for r in existing.data)
print(f"   Rutas ya en hospital_kam_distances: {len(existing_pairs)}")

# 3. Filtrar rutas nuevas para insertar
new_routes = []
duplicate_routes = []

for route in mapped_routes:
    pair = (route['hospital_id'], route['kam_id'])
    if pair not in existing_pairs:
        new_routes.append({
            'hospital_id': route['hospital_id'],
            'kam_id': route['kam_id'],
            'travel_time': route['travel_time'],
            'distance': route.get('distance'),
            'source': route['source'],
            'calculated_at': route.get('calculated_at')
        })
    else:
        duplicate_routes.append(route)

print(f"\n📊 Análisis:")
print(f"   Rutas nuevas para insertar: {len(new_routes)}")
print(f"   Rutas duplicadas (ya existen): {len(duplicate_routes)}")

# 4. Insertar en lotes
if new_routes:
    print(f"\n💾 Insertando {len(new_routes)} rutas nuevas...")
    
    batch_size = 100
    inserted_total = 0
    failed_total = 0
    
    for i in range(0, len(new_routes), batch_size):
        batch = new_routes[i:i+batch_size]
        try:
            result = supabase.table('hospital_kam_distances').insert(batch).execute()
            inserted_total += len(result.data) if result.data else 0
            print(f"   Batch {i//batch_size + 1}: Insertadas {len(result.data) if result.data else 0} rutas")
        except Exception as e:
            print(f"   Error en batch {i//batch_size + 1}: {str(e)}")
            failed_total += len(batch)
    
    print(f"\n✅ Inserción completada:")
    print(f"   Exitosas: {inserted_total}")
    print(f"   Fallidas: {failed_total}")

# 5. Verificar nuevo estado
print("\n🔍 Verificando estado final...")
final_count = supabase.table('hospital_kam_distances').select('id', count='exact').execute()
print(f"   Total en hospital_kam_distances: {final_count.count}")

# 6. Análisis de cobertura por hospital
print("\n📊 Analizando cobertura por hospital...")
distances_data = supabase.table('hospital_kam_distances').select('hospital_id, kam_id').execute()
hospitals_with_distances = {}
for dist in distances_data.data:
    h_id = dist['hospital_id']
    if h_id not in hospitals_with_distances:
        hospitals_with_distances[h_id] = []
    hospitals_with_distances[h_id].append(dist['kam_id'])

print(f"   Hospitales con al menos una distancia: {len(hospitals_with_distances)}")

# Distribución
distribution = {}
for h_id, kam_list in hospitals_with_distances.items():
    count = len(kam_list)
    if count not in distribution:
        distribution[count] = 0
    distribution[count] += 1

print("\n   Distribución de distancias por hospital:")
for count in sorted(distribution.keys())[:10]:
    print(f"      {count} KAMs: {distribution[count]} hospitales")

# 7. Guardar resumen
summary = {
    'migration_date': str(json.dumps({'now': 'now'}, default=str)),
    'mapped_routes_total': len(mapped_routes),
    'existing_before': len(existing_pairs),
    'new_routes_inserted': inserted_total if new_routes else 0,
    'duplicates_skipped': len(duplicate_routes),
    'final_total': final_count.count,
    'hospitals_with_distances': len(hospitals_with_distances),
    'distance_distribution': distribution
}

with open('/Users/yeison/Documents/GitHub/OpMap/output/migration_summary.json', 'w') as f:
    json.dump(summary, f, indent=2)

print("\n📄 Resumen guardado en output/migration_summary.json")

print("\n" + "="*60)
print("✅ MIGRACIÓN COMPLETADA")
print("="*60)
print(f"Total rutas en hospital_kam_distances: {final_count.count}")
print(f"Hospitales con distancias: {len(hospitals_with_distances)}")
print("="*60)