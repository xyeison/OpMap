#!/usr/bin/env python3
"""
Verificar y corregir unidades de tiempo en hospital_kam_distances
"""
from supabase import create_client

supabase_url = 'https://norvxqgohddgsdkggqzq.supabase.co'
supabase_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vcnZ4cWdvaGRkZ3Nka2dncXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMDExMjUsImV4cCI6MjA2ODc3NzEyNX0.BRWIYeD_5OlpVKIrP1QzUmkSx6HEVGzcEUUiSK8CmJs'

supabase = create_client(supabase_url, supabase_key)

print("🔍 VERIFICACIÓN DE UNIDADES DE TIEMPO")
print("="*60)

# Obtener muestra de datos
sample = supabase.table('hospital_kam_distances').select('*').limit(20).execute()

print("\n📊 Muestra de tiempos actuales:")
for d in sample.data[:10]:
    # Si el tiempo es > 1440 (24 horas en minutos), probablemente esté en segundos
    if d['travel_time'] and d['travel_time'] > 1440:
        tiempo_minutos = d['travel_time'] / 60
        print(f"   Tiempo actual: {d['travel_time']} → {tiempo_minutos:.1f} minutos ({tiempo_minutos/60:.1f} horas)")

# Análisis estadístico
print("\n📈 Análisis de todos los tiempos:")
all_times = []
offset = 0
while True:
    batch = supabase.table('hospital_kam_distances').select('travel_time').range(offset, offset + 999).execute()
    if not batch.data:
        break
    all_times.extend([d['travel_time'] for d in batch.data if d['travel_time']])
    offset += 1000
    if len(batch.data) < 1000:
        break

print(f"   Total registros con tiempo: {len(all_times)}")

if all_times:
    # Estadísticas
    min_time = min(all_times)
    max_time = max(all_times)
    avg_time = sum(all_times) / len(all_times)
    
    print(f"\n   VALORES ACTUALES:")
    print(f"   Mínimo: {min_time}")
    print(f"   Máximo: {max_time}")
    print(f"   Promedio: {avg_time:.1f}")
    
    # Contar cuántos son probablemente segundos
    probably_seconds = sum(1 for t in all_times if t > 1440)  # Más de 24 horas
    
    print(f"\n   ANÁLISIS:")
    print(f"   Registros > 1440 (24 horas): {probably_seconds} ({probably_seconds*100/len(all_times):.1f}%)")
    
    if probably_seconds > len(all_times) * 0.5:
        print("\n⚠️ DIAGNÓSTICO: La mayoría de los tiempos parecen estar en SEGUNDOS")
        print("   Necesitan ser convertidos a MINUTOS")
        
        print("\n   SI SE CONVIRTIERAN A MINUTOS:")
        print(f"   Mínimo: {min_time/60:.1f} minutos")
        print(f"   Máximo: {max_time/60:.1f} minutos ({max_time/3600:.1f} horas)")
        print(f"   Promedio: {avg_time/60:.1f} minutos")
        
        # Preguntar si corregir
        print("\n" + "="*60)
        print("🔧 CORRECCIÓN NECESARIA")
        print("="*60)
        print("Se detectó que los tiempos están en SEGUNDOS y deben convertirse a MINUTOS")
        print("Esto afecta a aproximadamente", probably_seconds, "registros")
        print("\nPara corregir, ejecuta: python3 scripts/convert_seconds_to_minutes.py")
    else:
        print("\n✅ Los tiempos parecen estar en las unidades correctas (MINUTOS)")

print("\n" + "="*60)