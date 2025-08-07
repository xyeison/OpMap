#!/usr/bin/env python3
"""
Probar el algoritmo directamente para ver dónde se traba
"""
from supabase import create_client
import time

supabase_url = 'https://norvxqgohddgsdkggqzq.supabase.co'
supabase_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vcnZ4cWdvaGRkZ3Nka2dncXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMDExMjUsImV4cCI6MjA2ODc3NzEyNX0.BRWIYeD_5OlpVKIrP1QzUmkSx6HEVGzcEUUiSK8CmJs'

supabase = create_client(supabase_url, supabase_key)

print("🔍 PROBANDO OPERACIONES DEL ALGORITMO")
print("="*60)

# 1. Probar eliminación de asignaciones
print("\n1. Probando eliminación de asignaciones...")
start = time.time()

try:
    # Contar cuántas hay
    count_before = supabase.table('assignments').select('id', count='exact').execute()
    print(f"   Asignaciones antes: {count_before.count}")
    
    # Intentar eliminar todas
    print("   Eliminando todas las asignaciones...")
    result = supabase.table('assignments').delete().neq('id', '00000000-0000-0000-0000-000000000000').execute()
    
    elapsed = time.time() - start
    print(f"   ✅ Eliminación completada en {elapsed:.2f} segundos")
    
    # Verificar
    count_after = supabase.table('assignments').select('id', count='exact').execute()
    print(f"   Asignaciones después: {count_after.count}")
    
except Exception as e:
    print(f"   ❌ Error: {e}")

# 2. Probar carga de distancias
print("\n2. Probando carga de distancias...")
start = time.time()

try:
    distances = []
    offset = 0
    batch_size = 1000
    
    while True:
        batch = supabase.table('hospital_kam_distances').select('hospital_id, kam_id, travel_time').range(offset, offset + batch_size - 1).execute()
        
        if batch.data:
            distances.extend(batch.data)
            print(f"   Cargadas {len(distances)} distancias...")
            offset += batch_size
            
            if len(batch.data) < batch_size:
                break
        else:
            break
    
    elapsed = time.time() - start
    print(f"   ✅ {len(distances)} distancias cargadas en {elapsed:.2f} segundos")
    
except Exception as e:
    print(f"   ❌ Error: {e}")

# 3. Probar inserción de asignaciones
print("\n3. Probando inserción de asignaciones...")

# Crear algunas asignaciones de prueba
test_assignments = []
hospitals = supabase.table('hospitals').select('id').limit(5).execute()
kams = supabase.table('kams').select('id').limit(1).execute()

if hospitals.data and kams.data:
    for h in hospitals.data:
        test_assignments.append({
            'hospital_id': h['id'],
            'kam_id': kams.data[0]['id'],
            'travel_time': 1800,  # 30 minutos en segundos
            'assignment_type': 'test',
            'is_base_territory': False
        })
    
    print(f"   Insertando {len(test_assignments)} asignaciones de prueba...")
    start = time.time()
    
    try:
        result = supabase.table('assignments').insert(test_assignments).execute()
        elapsed = time.time() - start
        print(f"   ✅ Inserción completada en {elapsed:.2f} segundos")
    except Exception as e:
        print(f"   ❌ Error: {e}")

print("\n" + "="*60)
print("RESUMEN:")
print("Si alguna operación tarda mucho o falla, ese es el problema")