#!/usr/bin/env python3
"""
Aplicar corrección de tiempos (ya tenemos backup)
Backup guardado en: /Users/yeison/Documents/GitHub/OpMap/backups/hospital_kam_distances_backup_20250806_150255.json
"""
from supabase import create_client
import time

supabase_url = 'https://norvxqgohddgsdkggqzq.supabase.co'
supabase_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vcnZ4cWdvaGRkZ3Nka2dncXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMDExMjUsImV4cCI6MjA2ODc3NzEyNX0.BRWIYeD_5OlpVKIrP1QzUmkSx6HEVGzcEUUiSK8CmJs'

supabase = create_client(supabase_url, supabase_key)

print("🔧 APLICANDO CORRECCIÓN DE TIEMPOS")
print("="*60)
print("✅ Backup ya guardado en:")
print("   /Users/yeison/Documents/GitHub/OpMap/backups/hospital_kam_distances_backup_20250806_150255.json")
print()

# Obtener registros a corregir
print("📥 Obteniendo registros > 1440...")
needs_fix = []
offset = 0

while True:
    batch = supabase.table('hospital_kam_distances').select('id, travel_time').gt('travel_time', 1440).range(offset, offset + 999).execute()
    if not batch.data:
        break
    needs_fix.extend(batch.data)
    offset += 1000
    if len(batch.data) < 1000:
        break

print(f"   Registros a corregir: {len(needs_fix)}")

if not needs_fix:
    print("\n✅ No hay registros que corregir")
    exit()

# Aplicar corrección
print("\n⚙️ Aplicando corrección...")
batch_size = 50
updated = 0
errors = 0
start_time = time.time()

for i in range(0, len(needs_fix), batch_size):
    batch = needs_fix[i:i+batch_size]
    
    for record in batch:
        try:
            new_time = round(record['travel_time'] / 60)
            
            result = supabase.table('hospital_kam_distances').update({
                'travel_time': new_time
            }).eq('id', record['id']).execute()
            
            if result.data:
                updated += 1
        except Exception as e:
            errors += 1
    
    # Progreso cada 500
    if updated % 500 == 0:
        elapsed = time.time() - start_time
        rate = updated / elapsed if elapsed > 0 else 0
        remaining = (len(needs_fix) - updated) / rate if rate > 0 else 0
        print(f"   Procesados: {updated}/{len(needs_fix)} - Tiempo restante: {remaining/60:.1f} min")

print(f"\n✅ Corrección completada:")
print(f"   Actualizados: {updated}")
print(f"   Errores: {errors}")

# Verificación final
count_check = supabase.table('hospital_kam_distances').select('id', count='exact').gt('travel_time', 1440).execute()
print(f"\n📊 Verificación final:")
print(f"   Registros aún > 1440 min: {count_check.count}")

if count_check.count == 0:
    print("\n🎉 ÉXITO TOTAL!")
    print("   Todos los tiempos están ahora en MINUTOS correctos")
    
    # Verificar casos específicos
    print("\n🔍 Verificando casos específicos:")
    
    # Hospital 900958564-2
    h1 = supabase.table('hospitals').select('id').eq('code', '900958564-2').execute()
    if h1.data:
        k_san_cristobal = supabase.table('kams').select('id').eq('name', 'KAM San Cristóbal').execute()
        if k_san_cristobal.data:
            dist = supabase.table('hospital_kam_distances').select('travel_time').eq(
                'hospital_id', h1.data[0]['id']
            ).eq('kam_id', k_san_cristobal.data[0]['id']).execute()
            if dist.data:
                print(f"   900958564-2 → KAM San Cristóbal: {dist.data[0]['travel_time']} min ✅")
    
    # Hospital 890701718-1
    h2 = supabase.table('hospitals').select('id').eq('code', '890701718-1').execute()
    if h2.data:
        k_pereira = supabase.table('kams').select('id').eq('name', 'KAM Pereira').execute()
        if k_pereira.data:
            dist = supabase.table('hospital_kam_distances').select('travel_time').eq(
                'hospital_id', h2.data[0]['id']
            ).eq('kam_id', k_pereira.data[0]['id']).execute()
            if dist.data:
                print(f"   890701718-1 → KAM Pereira: {dist.data[0]['travel_time']} min ✅")
else:
    print(f"\n⚠️ Aún quedan {count_check.count} registros por corregir")
    print("   Ejecute el script nuevamente si es necesario")

print("\n" + "="*60)