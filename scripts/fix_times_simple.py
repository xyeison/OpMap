#!/usr/bin/env python3
"""
Corregir tiempos que están en segundos - versión simple y directa
"""
from supabase import create_client

supabase_url = 'https://norvxqgohddgsdkggqzq.supabase.co'
supabase_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vcnZ4cWdvaGRkZ3Nka2dncXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMDExMjUsImV4cCI6MjA2ODc3NzEyNX0.BRWIYeD_5OlpVKIrP1QzUmkSx6HEVGzcEUUiSK8CmJs'

supabase = create_client(supabase_url, supabase_key)

print("🔧 CORRECCIÓN DE TIEMPOS (SEGUNDOS → MINUTOS)")
print("="*60)

# Obtener TODOS los registros > 1440 de una vez
print("\n📥 Obteniendo registros a corregir...")
all_records = []
offset = 0

while True:
    batch = supabase.table('hospital_kam_distances').select('id, travel_time').gt('travel_time', 1440).range(offset, offset + 999).execute()
    if not batch.data:
        break
    all_records.extend(batch.data)
    offset += 1000
    print(f"   Cargados: {len(all_records)} registros...")
    if len(batch.data) < 1000:
        break

print(f"\n📊 Total a corregir: {len(all_records)} registros")

if not all_records:
    print("✅ No hay registros que corregir")
    exit()

# Actualizar en bloques pequeños
print("\n⚙️ Actualizando...")
batch_size = 50
updated = 0

for i in range(0, len(all_records), batch_size):
    batch = all_records[i:i+batch_size]
    
    for record in batch:
        new_time = round(record['travel_time'] / 60)
        try:
            supabase.table('hospital_kam_distances').update({
                'travel_time': new_time
            }).eq('id', record['id']).execute()
            updated += 1
        except:
            pass
    
    if updated % 500 == 0:
        print(f"   Actualizados: {updated}/{len(all_records)}")

print(f"\n✅ Completado: {updated} registros actualizados")

# Verificación final
count_check = supabase.table('hospital_kam_distances').select('id', count='exact').gt('travel_time', 1440).execute()
print(f"\n📊 Verificación: {count_check.count} registros aún > 1440 minutos")

if count_check.count == 0:
    print("✅ ÉXITO: Todos los tiempos están ahora en MINUTOS")
else:
    print(f"⚠️ Quedan {count_check.count} registros por verificar")