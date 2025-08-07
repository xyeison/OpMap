#!/usr/bin/env python3
"""
Convertir tiempos de segundos a minutos en hospital_kam_distances
Solo convierte los que están claramente en segundos (> 1440)
"""
from supabase import create_client
import time

supabase_url = 'https://norvxqgohddgsdkggqzq.supabase.co'
supabase_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vcnZ4cWdvaGRkZ3Nka2dncXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMDExMjUsImV4cCI6MjA2ODc3NzEyNX0.BRWIYeD_5OlpVKIrP1QzUmkSx6HEVGzcEUUiSK8CmJs'

supabase = create_client(supabase_url, supabase_key)

print("🔧 CONVERSIÓN DE SEGUNDOS A MINUTOS")
print("="*60)

# 1. Obtener todos los registros que necesitan conversión
print("\n📥 Obteniendo registros que necesitan conversión...")
records_to_fix = []
offset = 0

while True:
    batch = supabase.table('hospital_kam_distances').select('*').range(offset, offset + 999).execute()
    if not batch.data:
        break
    
    for record in batch.data:
        # Si el tiempo es > 1440 minutos (24 horas), probablemente está en segundos
        if record['travel_time'] and record['travel_time'] > 1440:
            records_to_fix.append(record)
    
    offset += 1000
    if len(batch.data) < 1000:
        break

print(f"   Registros a corregir: {len(records_to_fix)}")

if not records_to_fix:
    print("✅ No hay registros que corregir")
    exit()

# 2. Mostrar ejemplos antes de corregir
print("\n📊 Ejemplos de conversión:")
for r in records_to_fix[:5]:
    old_time = r['travel_time']
    new_time = round(old_time / 60)
    print(f"   {old_time} segundos → {new_time} minutos ({new_time/60:.1f} horas)")

# 3. Confirmar
print(f"\n⚠️ Se convertirán {len(records_to_fix)} registros de segundos a minutos")
print("Procesando...")

# 4. Actualizar en lotes
batch_size = 100
updated = 0
errors = 0

for i in range(0, len(records_to_fix), batch_size):
    batch = records_to_fix[i:i+batch_size]
    
    for record in batch:
        try:
            # Convertir segundos a minutos
            new_time = round(record['travel_time'] / 60)
            
            # Actualizar en BD
            result = supabase.table('hospital_kam_distances').update({
                'travel_time': new_time
            }).eq('id', record['id']).execute()
            
            if result.data:
                updated += 1
            else:
                errors += 1
                
        except Exception as e:
            errors += 1
            print(f"   Error: {str(e)[:50]}")
    
    # Progreso
    if (i + batch_size) % 500 == 0:
        print(f"   Procesados: {min(i + batch_size, len(records_to_fix))}/{len(records_to_fix)}")
    
    # Rate limiting
    time.sleep(0.1)

# 5. Resumen
print("\n" + "="*60)
print("📊 RESUMEN DE CONVERSIÓN")
print("="*60)
print(f"Registros actualizados: {updated}")
print(f"Errores: {errors}")

# 6. Verificar nuevo estado
print("\n🔍 Verificando nuevo estado...")
sample = supabase.table('hospital_kam_distances').select('travel_time').limit(100).execute()
times = [d['travel_time'] for d in sample.data if d['travel_time']]

if times:
    print(f"   Mínimo: {min(times)} minutos")
    print(f"   Máximo: {max(times)} minutos")
    print(f"   Promedio: {sum(times)/len(times):.1f} minutos")
    
    over_1440 = sum(1 for t in times if t > 1440)
    if over_1440 == 0:
        print("\n✅ Conversión exitosa! Todos los tiempos están ahora en MINUTOS")
    else:
        print(f"\n⚠️ Aún hay {over_1440} registros que parecen estar en segundos")

print("="*60)