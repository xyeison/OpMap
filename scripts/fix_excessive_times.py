#!/usr/bin/env python3
"""
Corregir tiempos excesivos en assignments (> 1440 min / 24 horas)
"""
from supabase import create_client

supabase_url = 'https://norvxqgohddgsdkggqzq.supabase.co'
supabase_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vcnZ4cWdvaGRkZ3Nka2dncXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMDExMjUsImV4cCI6MjA2ODc3NzEyNX0.BRWIYeD_5OlpVKIrP1QzUmkSx6HEVGzcEUUiSK8CmJs'

supabase = create_client(supabase_url, supabase_key)

print("🔧 CORRECCIÓN DE TIEMPOS EXCESIVOS EN ASSIGNMENTS")
print("="*60)

# 1. Obtener asignaciones con tiempos > 1440 (24 horas)
print("\n📥 Buscando asignaciones con tiempos > 1440 min...")
excessive = supabase.table('assignments').select('*').gt('travel_time', 1440).execute()

print(f"   Encontradas: {len(excessive.data)} asignaciones")

if not excessive.data:
    print("\n✅ No hay asignaciones con tiempos excesivos")
    exit()

# 2. Analizar los valores
times = [a['travel_time'] for a in excessive.data if a['travel_time']]
print(f"\n📊 Análisis de tiempos excesivos:")
print(f"   Rango: {min(times)} - {max(times)} min")
print(f"   Promedio: {sum(times)/len(times):.1f} min")

# Si dividimos por 60 (asumiendo que son segundos)
print(f"\n🔍 Si fueran segundos:")
print(f"   Rango: {min(times)/60:.1f} - {max(times)/60:.1f} min")
print(f"   Promedio: {sum(times)/len(times)/60:.1f} min")

# Mostrar ejemplos
print(f"\n📋 Ejemplos (primeros 10):")
for a in excessive.data[:10]:
    old_time = a['travel_time']
    new_time = round(old_time / 60) if old_time else None
    print(f"   • Hospital ID: {a['hospital_id'][:8]}... → KAM ID: {a['kam_id'][:8]}...")
    print(f"     {old_time} seg? → {new_time} min")

# 3. Aplicar corrección
print(f"\n⚙️ Convirtiendo {len(excessive.data)} registros de segundos a minutos...")

updated = 0
errors = 0

for a in excessive.data:
    if a['travel_time'] and a['travel_time'] > 1440:
        new_time = round(a['travel_time'] / 60)
        try:
            result = supabase.table('assignments').update({
                'travel_time': new_time
            }).eq('id', a['id']).execute()
            
            if result.data:
                updated += 1
        except Exception as e:
            errors += 1
            print(f"   Error: {str(e)[:50]}")
    
    if updated % 50 == 0:
        print(f"   Procesados: {updated}/{len(excessive.data)}")

print(f"\n✅ Corrección completada:")
print(f"   Actualizados: {updated}")
print(f"   Errores: {errors}")

# 4. Verificación final
remaining = supabase.table('assignments').select('id', count='exact').gt('travel_time', 1440).execute()
print(f"\n📊 Verificación final:")
print(f"   Asignaciones > 1440 min restantes: {remaining.count}")

if remaining.count == 0:
    print("\n🎉 ÉXITO!")
    print("   Todos los tiempos excesivos han sido corregidos")
else:
    # Verificar si los restantes son legítimos
    still_high = supabase.table('assignments').select('travel_time').gt('travel_time', 1440).execute()
    if still_high.data:
        times = [a['travel_time'] for a in still_high.data]
        print(f"\n⚠️ Aún hay {len(times)} tiempos > 24 horas")
        print(f"   Rango: {min(times)} - {max(times)} min")
        print("   Estos podrían ser distancias legítimamente largas o necesitar revisión manual")

print("\n" + "="*60)