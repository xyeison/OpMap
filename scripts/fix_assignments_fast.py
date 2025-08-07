#!/usr/bin/env python3
"""
Corregir asignaciones usando los tiempos correctos de hospital_kam_distances - Versión rápida
"""
from supabase import create_client
from datetime import datetime

# Configuración de Supabase
supabase_url = 'https://norvxqgohddgsdkggqzq.supabase.co'
supabase_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vcnZ4cWdvaGRkZ3Nka2dncXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMDExMjUsImV4cCI6MjA2ODc3NzEyNX0.BRWIYeD_5OlpVKIrP1QzUmkSx6HEVGzcEUUiSK8CmJs'

supabase = create_client(supabase_url, supabase_key)

print(f"\n🔧 CORRECCIÓN RÁPIDA DE TIEMPOS")
print("=" * 60)

# 1. Cargar todos los tiempos correctos de una vez
print("Cargando tiempos correctos...")
all_distances = {}
offset = 0
batch_size = 1000

while True:
    result = supabase.table('hospital_kam_distances').select('hospital_id, kam_id, travel_time').range(offset, offset + batch_size - 1).execute()
    if result.data:
        for d in result.data:
            key = f"{d['hospital_id']}_{d['kam_id']}"
            all_distances[key] = d['travel_time']
        
        if len(result.data) < batch_size:
            break
        offset += batch_size
    else:
        break

print(f"✅ {len(all_distances)} distancias cargadas")

# 2. Cargar asignaciones actuales
print("\nCargando asignaciones...")
assignments = supabase.table('assignments').select('*').execute()
print(f"✅ {len(assignments.data)} asignaciones cargadas")

# 3. Identificar correcciones necesarias
updates = []
errors = 0

for a in assignments.data:
    # Si es territorio base, el tiempo debe ser 0
    if a['is_base_territory']:
        if a['travel_time'] != 0:
            updates.append({
                'id': a['id'],
                'travel_time': 0
            })
            errors += 1
    else:
        # Buscar tiempo correcto
        key = f"{a['hospital_id']}_{a['kam_id']}"
        correct_time = all_distances.get(key)
        
        if correct_time is not None and a['travel_time'] != correct_time:
            updates.append({
                'id': a['id'],
                'travel_time': correct_time
            })
            errors += 1
            if errors <= 5:
                print(f"  Error: Tiempo actual {a['travel_time']}s, correcto {correct_time}s")

print(f"\n📊 Errores encontrados: {errors} de {len(assignments.data)} ({errors/len(assignments.data)*100:.1f}%)")

if updates:
    print(f"\n🔧 Aplicando {len(updates)} correcciones...")
    
    # Actualizar en lotes más grandes
    batch_size = 500
    for i in range(0, len(updates), batch_size):
        batch = updates[i:i + batch_size]
        
        # Actualizar cada registro
        for update in batch:
            supabase.table('assignments').update({
                'travel_time': update['travel_time']
            }).eq('id', update['id']).execute()
        
        print(f"  Procesados {min(i + batch_size, len(updates))}/{len(updates)}")
    
    print(f"\n✅ COMPLETADO - {len(updates)} tiempos corregidos")
else:
    print("\n✅ No se requieren correcciones")