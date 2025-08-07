#!/usr/bin/env python3
"""
Migrar rutas mapeadas a hospital_kam_distances de forma segura
"""
from supabase import create_client
import json

supabase_url = 'https://norvxqgohddgsdkggqzq.supabase.co'
supabase_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vcnZ4cWdvaGRkZ3Nka2dncXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMDExMjUsImV4cCI6MjA2ODc3NzEyNX0.BRWIYeD_5OlpVKIrP1QzUmkSx6HEVGzcEUUiSK8CmJs'

supabase = create_client(supabase_url, supabase_key)

print("🔄 Migrando rutas mapeadas de forma segura")
print("="*60)

# 1. Cargar rutas mapeadas
print("\n📥 Cargando rutas mapeadas...")
with open('/Users/yeison/Documents/GitHub/OpMap/output/all_mapped_routes.json', 'r') as f:
    mapped_routes = json.load(f)

print(f"   Total rutas mapeadas: {len(mapped_routes)}")

# 2. Procesar cada ruta individualmente
print("\n💾 Insertando rutas...")
inserted = 0
skipped = 0
errors = 0

for i, route in enumerate(mapped_routes):
    if i % 100 == 0:
        print(f"   Procesando {i}/{len(mapped_routes)} ({inserted} insertadas, {skipped} omitidas)...")
    
    try:
        # Verificar si ya existe
        existing = supabase.table('hospital_kam_distances').select('id').eq(
            'hospital_id', route['hospital_id']
        ).eq('kam_id', route['kam_id']).execute()
        
        if existing.data:
            skipped += 1
            continue
        
        # Insertar
        result = supabase.table('hospital_kam_distances').insert({
            'hospital_id': route['hospital_id'],
            'kam_id': route['kam_id'],
            'travel_time': route['travel_time'],
            'distance': route.get('distance'),
            'source': route['source'],
            'calculated_at': route.get('calculated_at')
        }).execute()
        
        if result.data:
            inserted += 1
    except Exception as e:
        errors += 1
        if errors <= 5:  # Solo mostrar primeros 5 errores
            print(f"   Error: {str(e)[:100]}")

print(f"\n✅ Procesamiento completado:")
print(f"   Insertadas: {inserted}")
print(f"   Omitidas (ya existían): {skipped}")
print(f"   Errores: {errors}")

# 3. Verificar estado final
print("\n🔍 Verificando estado final...")
final_count = supabase.table('hospital_kam_distances').select('id', count='exact').execute()
print(f"   Total en hospital_kam_distances: {final_count.count}")

# 4. Análisis de cobertura
distances_data = supabase.table('hospital_kam_distances').select('hospital_id, kam_id').execute()
hospitals_with_distances = {}
for dist in distances_data.data:
    h_id = dist['hospital_id']
    if h_id not in hospitals_with_distances:
        hospitals_with_distances[h_id] = set()
    hospitals_with_distances[h_id].add(dist['kam_id'])

print(f"   Hospitales con al menos una distancia: {len(hospitals_with_distances)}")

# Verificar hospitales activos sin distancias
hospitals_active = supabase.table('hospitals').select('id, name, municipality_name').eq('active', True).execute()
hospitals_without_distances = []
for h in hospitals_active.data:
    if h['id'] not in hospitals_with_distances:
        hospitals_without_distances.append(h)

print(f"   Hospitales activos sin distancias: {len(hospitals_without_distances)}")

if hospitals_without_distances[:5]:
    print("\n   Primeros 5 hospitales sin distancias:")
    for h in hospitals_without_distances[:5]:
        print(f"      - {h['name']} ({h['municipality_name']})")

print("\n" + "="*60)
print("✅ MIGRACIÓN COMPLETADA")
print("="*60)
print(f"Total rutas: {final_count.count}")
print(f"Hospitales con distancias: {len(hospitals_with_distances)}/{len(hospitals_active.data)}")
print(f"Cobertura: {len(hospitals_with_distances)*100/len(hospitals_active.data):.1f}%")
print("="*60)