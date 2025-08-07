#!/usr/bin/env python3
"""
Script para verificar que el sistema maneja correctamente los segundos
"""
from supabase import create_client
import random

supabase_url = 'https://norvxqgohddgsdkggqzq.supabase.co'
supabase_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vcnZ4cWdvaGRkZ3Nka2dncXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMDExMjUsImV4cCI6MjA2ODc3NzEyNX0.BRWIYeD_5OlpVKIrP1QzUmkSx6HEVGzcEUUiSK8CmJs'

supabase = create_client(supabase_url, supabase_key)

print("🔍 VERIFICACIÓN DEL SISTEMA DE SEGUNDOS")
print("="*60)

# 1. Verificar hospital_kam_distances
print("\n1. VERIFICANDO hospital_kam_distances:")
print("-"*40)

# Obtener muestra de datos
sample = supabase.table('hospital_kam_distances').select('*').limit(10).execute()

if sample.data:
    print(f"✅ Encontrados {len(sample.data)} registros de muestra")
    
    # Verificar que los tiempos son segundos
    for i, record in enumerate(sample.data[:3], 1):
        time_sec = record.get('travel_time', 0)
        time_min = time_sec / 60 if time_sec else 0
        time_hrs = time_sec / 3600 if time_sec else 0
        
        print(f"\n   Registro {i}:")
        print(f"   - travel_time: {time_sec} segundos")
        print(f"   - En minutos: {time_min:.1f} min")
        print(f"   - En horas: {time_hrs:.2f} hrs")
        
        # Verificar si es razonable como segundos
        if time_sec > 60 and time_sec < 50000:  # Entre 1 min y ~14 horas
            print(f"   ✅ Parece correcto (segundos)")
        elif time_sec < 60:
            print(f"   ⚠️ Muy corto - posiblemente ya en minutos")
        else:
            print(f"   ⚠️ Verificar - valor inusual")

# 2. Verificar rangos generales
print("\n2. ESTADÍSTICAS GENERALES:")
print("-"*40)

# Obtener todos los tiempos
all_times = []
offset = 0
while True:
    batch = supabase.table('hospital_kam_distances').select('travel_time').range(offset, offset + 999).execute()
    if not batch.data:
        break
    all_times.extend([r['travel_time'] for r in batch.data if r['travel_time']])
    offset += 1000
    if len(batch.data) < 1000:
        break

if all_times:
    min_time = min(all_times)
    max_time = max(all_times)
    avg_time = sum(all_times) / len(all_times)
    
    print(f"Total registros con tiempo: {len(all_times)}")
    print(f"\nEn SEGUNDOS:")
    print(f"  Mínimo: {min_time} seg")
    print(f"  Máximo: {max_time} seg")
    print(f"  Promedio: {avg_time:.0f} seg")
    
    print(f"\nConvertido a MINUTOS:")
    print(f"  Mínimo: {min_time/60:.1f} min")
    print(f"  Máximo: {max_time/60:.1f} min ({max_time/3600:.1f} hrs)")
    print(f"  Promedio: {avg_time/60:.1f} min")
    
    # Verificar distribución
    under_1hr = len([t for t in all_times if t < 3600])
    between_1_4hr = len([t for t in all_times if 3600 <= t < 14400])
    over_4hr = len([t for t in all_times if t >= 14400])
    
    print(f"\nDISTRIBUCIÓN:")
    print(f"  < 1 hora: {under_1hr} ({under_1hr*100/len(all_times):.1f}%)")
    print(f"  1-4 horas: {between_1_4hr} ({between_1_4hr*100/len(all_times):.1f}%)")
    print(f"  > 4 horas: {over_4hr} ({over_4hr*100/len(all_times):.1f}%)")

# 3. Verificar assignments
print("\n3. VERIFICANDO assignments:")
print("-"*40)

assignments = supabase.table('assignments').select('*').limit(10).execute()

if assignments.data:
    print(f"✅ Encontradas {len(assignments.data)} asignaciones de muestra")
    
    for i, assign in enumerate(assignments.data[:3], 1):
        time_sec = assign.get('travel_time', 0)
        
        print(f"\n   Asignación {i}:")
        print(f"   - travel_time: {time_sec} segundos")
        print(f"   - En minutos: {time_sec/60:.1f} min" if time_sec else "   - En minutos: 0 min")
        print(f"   - Tipo: {assign.get('assignment_type')}")
        
        if assign.get('is_base_territory'):
            print(f"   ✅ Territorio base (0 segundos esperado)")
        elif time_sec > 60:
            print(f"   ✅ Parece correcto (segundos)")
        else:
            print(f"   ⚠️ Verificar valor")

# 4. Verificar KAMs max_travel_time
print("\n4. VERIFICANDO LÍMITES DE KAMs:")
print("-"*40)

kams = supabase.table('kams').select('name, max_travel_time').eq('active', True).execute()

if kams.data:
    print(f"✅ {len(kams.data)} KAMs activos")
    print("\nLímites de tiempo (deben estar en MINUTOS):")
    for kam in kams.data[:5]:
        print(f"  - {kam['name']}: {kam['max_travel_time']} minutos")

print("\n" + "="*60)
print("📊 RESUMEN:")
print("-"*40)

if all_times and min_time > 60 and avg_time > 300:
    print("✅ Los datos parecen estar correctamente en SEGUNDOS")
    print("✅ La conversión a minutos/horas produce valores razonables")
    print("✅ Sistema listo para operar con segundos")
else:
    print("⚠️ Revisar los datos - pueden tener unidades mezcladas")

print("\n📝 RECORDATORIO:")
print("  - hospital_kam_distances.travel_time → SEGUNDOS")
print("  - assignments.travel_time → SEGUNDOS")  
print("  - kams.max_travel_time → MINUTOS")
print("  - Frontend debe convertir segundos → minutos/horas para mostrar")
print("\n" + "="*60)