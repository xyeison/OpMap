#!/usr/bin/env python3
"""
Completar los registros restantes (1102)
"""
from supabase import create_client

supabase_url = 'https://norvxqgohddgsdkggqzq.supabase.co'
supabase_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vcnZ4cWdvaGRkZ3Nka2dncXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMDExMjUsImV4cCI6MjA2ODc3NzEyNX0.BRWIYeD_5OlpVKIrP1QzUmkSx6HEVGzcEUUiSK8CmJs'

supabase = create_client(supabase_url, supabase_key)

print("🔧 COMPLETANDO CONVERSIÓN DE TIEMPOS")
print("="*60)

# Obtener los restantes
remaining = []
offset = 0

while True:
    batch = supabase.table('hospital_kam_distances').select('id, travel_time').gt('travel_time', 1440).range(offset, offset + 999).execute()
    if not batch.data:
        break
    remaining.extend(batch.data)
    offset += 1000
    if len(batch.data) < 1000:
        break

print(f"Registros restantes: {len(remaining)}")

if not remaining:
    print("✅ No hay registros pendientes")
    exit()

# Procesar todos de una vez con updates individuales
updated = 0
for i, record in enumerate(remaining, 1):
    try:
        new_time = round(record['travel_time'] / 60)
        supabase.table('hospital_kam_distances').update({
            'travel_time': new_time
        }).eq('id', record['id']).execute()
        updated += 1
        
        if updated % 100 == 0:
            print(f"   Procesados: {updated}/{len(remaining)}")
    except:
        pass

print(f"\n✅ Completado: {updated} registros actualizados")

# Verificación final
final_check = supabase.table('hospital_kam_distances').select('id', count='exact').gt('travel_time', 1440).execute()
print(f"\n📊 VERIFICACIÓN FINAL:")
print(f"   Registros > 1440 min: {final_check.count}")

if final_check.count == 0:
    print("\n🎉 CONVERSIÓN COMPLETA!")
    print("   Todos los tiempos están ahora en MINUTOS")
    
    # Estadísticas finales
    stats = supabase.table('hospital_kam_distances').select('travel_time').execute()
    times = [d['travel_time'] for d in stats.data if d['travel_time']]
    
    print(f"\n📈 Estadísticas finales:")
    print(f"   Mínimo: {min(times)} min")
    print(f"   Máximo: {max(times)} min ({max(times)/60:.1f} horas)")
    print(f"   Promedio: {sum(times)/len(times):.1f} min")
    
    print("\n✅ PRÓXIMO PASO:")
    print("   Usar el botón 'Recalcular Asignaciones' en la aplicación web")
    print("   para que el algoritmo use los tiempos corregidos")
else:
    print(f"\n⚠️ Quedan {final_check.count} registros pendientes")