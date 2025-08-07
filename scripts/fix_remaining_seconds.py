#!/usr/bin/env python3
"""
Corregir los registros restantes que están entre 1000-1440
(probablemente también son segundos)
"""
from supabase import create_client
import time

supabase_url = 'https://norvxqgohddgsdkggqzq.supabase.co'
supabase_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vcnZ4cWdvaGRkZ3Nka2dncXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMDExMjUsImV4cCI6MjA2ODc3NzEyNX0.BRWIYeD_5OlpVKIrP1QzUmkSx6HEVGzcEUUiSK8CmJs'

supabase = create_client(supabase_url, supabase_key)

print("🔧 CORRIGIENDO REGISTROS ENTRE 1000-1440")
print("="*60)

# Obtener registros entre 1000 y 1440
print("\n📥 Obteniendo registros sospechosos (1000-1440)...")
suspicious = []
offset = 0

while True:
    batch = supabase.table('hospital_kam_distances').select('id, travel_time').gte('travel_time', 1000).lte('travel_time', 1440).range(offset, offset + 999).execute()
    if not batch.data:
        break
    suspicious.extend(batch.data)
    offset += 1000
    if len(batch.data) < 1000:
        break

print(f"   Registros encontrados: {len(suspicious)}")

if not suspicious:
    print("\n✅ No hay registros sospechosos")
    
    # Verificar si aún quedan > 1440
    high_values = supabase.table('hospital_kam_distances').select('id', count='exact').gt('travel_time', 1440).execute()
    if high_values.count > 0:
        print(f"\n⚠️ Aún hay {high_values.count} registros > 1440")
        print("   Estos podrían ser tiempos legítimos muy largos")
    else:
        print("\n🎉 Todos los tiempos están correctos!")
    exit()

# Analizar los valores
print("\n📊 Análisis de valores:")
values = [r['travel_time'] for r in suspicious]
print(f"   Mínimo: {min(values)}")
print(f"   Máximo: {max(values)}")
print(f"   Promedio: {sum(values)/len(values):.1f}")

# Si dividimos por 60, qué obtendríamos?
print("\n🔍 Si fueran segundos:")
print(f"   Mínimo: {min(values)/60:.1f} min")
print(f"   Máximo: {max(values)/60:.1f} min")
print(f"   Promedio: {(sum(values)/len(values))/60:.1f} min")

# Estos valores parecen más razonables en minutos
print("\n⚙️ Convirtiendo de segundos a minutos...")

updated = 0
errors = 0
start_time = time.time()

# Procesar en lotes pequeños para evitar timeout
batch_size = 25

for i in range(0, len(suspicious), batch_size):
    batch = suspicious[i:i+batch_size]
    
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
            print(f"   Error: {str(e)[:50]}")
    
    # Mostrar progreso
    if updated % 100 == 0:
        elapsed = time.time() - start_time
        rate = updated / elapsed if elapsed > 0 else 0
        remaining = (len(suspicious) - updated) / rate if rate > 0 else 0
        print(f"   Procesados: {updated}/{len(suspicious)} - ETA: {remaining:.0f}s")
    
    # Pequeña pausa para no sobrecargar
    time.sleep(0.1)

print(f"\n✅ Conversión completada:")
print(f"   Actualizados: {updated}")
print(f"   Errores: {errors}")

# Verificación final completa
print("\n📊 VERIFICACIÓN FINAL:")
print("-"*40)

# Contar por rangos
ranges = [
    (0, 60, "0-60 min (1 hora)"),
    (60, 120, "60-120 min (1-2 horas)"),
    (120, 240, "120-240 min (2-4 horas)"),
    (240, 1000, "240-1000 min (4-16 horas)"),
    (1000, 1440, "1000-1440 min (16-24 horas)"),
    (1440, 99999, "> 1440 min (> 24 horas)")
]

for min_val, max_val, label in ranges:
    count = supabase.table('hospital_kam_distances').select('id', count='exact').gte('travel_time', min_val).lt('travel_time', max_val).execute()
    if count.count > 0:
        print(f"   {label}: {count.count} registros")

# Verificar casos específicos
print("\n🔍 Verificando casos específicos:")

# Hospital 900958564-2 con KAM Kennedy
h1 = supabase.table('hospitals').select('id').eq('code', '900958564-2').execute()
if h1.data:
    k_kennedy = supabase.table('kams').select('id').eq('name', 'KAM Kennedy').execute()
    if k_kennedy.data:
        dist = supabase.table('hospital_kam_distances').select('travel_time').eq(
            'hospital_id', h1.data[0]['id']
        ).eq('kam_id', k_kennedy.data[0]['id']).execute()
        if dist.data:
            print(f"   900958564-2 → KAM Kennedy: {dist.data[0]['travel_time']} min")
            if dist.data[0]['travel_time'] > 100:
                print(f"      ⚠️ Parece alto, podría ser segundos aún")

print("\n" + "="*60)
print("PROCESO COMPLETADO")
print("="*60)
print("\n✅ PRÓXIMO PASO:")
print("   Hacer clic en 'Recalcular Asignaciones' en la aplicación web")