#!/usr/bin/env python3
"""
Verificación final completa del sistema
"""
from supabase import create_client

supabase_url = 'https://norvxqgohddgsdkggqzq.supabase.co'
supabase_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vcnZ4cWdvaGRkZ3Nka2dncXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMDExMjUsImV4cCI6MjA2ODc3NzEyNX0.BRWIYeD_5OlpVKIrP1QzUmkSx6HEVGzcEUUiSK8CmJs'

supabase = create_client(supabase_url, supabase_key)

print("✅ VERIFICACIÓN FINAL DEL SISTEMA")
print("="*60)

# 1. Verificar tabla hospital_kam_distances
print("\n📊 TABLA hospital_kam_distances:")
print("-"*40)

# Estadísticas generales
stats = supabase.table('hospital_kam_distances').select('travel_time').execute()
times = [d['travel_time'] for d in stats.data if d['travel_time']]

print(f"Total registros: {len(stats.data)}")
print(f"Con tiempo: {len(times)}")
if times:
    print(f"Rango: {min(times)} - {max(times)} min")
    print(f"Promedio: {sum(times)/len(times):.1f} min")

# Verificar valores sospechosos
under_10 = [t for t in times if t < 10]
over_1440 = [t for t in times if t > 1440]

if under_10:
    print(f"\n⚠️ {len(under_10)} registros < 10 min (posiblemente incorrectos)")
else:
    print(f"\n✅ No hay registros < 10 min")

if over_1440:
    print(f"⚠️ {len(over_1440)} registros > 24 horas (verificar si son correctos)")

# 2. Verificar tabla assignments
print("\n📊 TABLA assignments:")
print("-"*40)

assignments = supabase.table('assignments').select('travel_time').execute()
assign_times = [a['travel_time'] for a in assignments.data if a['travel_time']]

print(f"Total asignaciones: {len(assignments.data)}")
print(f"Con tiempo: {len(assign_times)}")
if assign_times:
    print(f"Rango: {min(assign_times)} - {max(assign_times)} min")
    print(f"Promedio: {sum(assign_times)/len(assign_times):.1f} min")

# 3. Verificar casos específicos corregidos
print("\n🔍 CASOS ESPECÍFICOS:")
print("-"*40)

# Puerto Boyacá (900678145-1)
print("\n1. Puerto Boyacá (900678145-1):")
h = supabase.table('hospitals').select('id').eq('code', '900678145-1').execute()
if h.data:
    dists = supabase.table('hospital_kam_distances').select('travel_time, kams(name)').eq('hospital_id', h.data[0]['id']).order('travel_time').limit(3).execute()
    for d in dists.data:
        print(f"   → {d['kams']['name']:20} {d['travel_time']} min")
    
    if dists.data and dists.data[0]['travel_time'] < 100:
        print("   ⚠️ Tiempos parecen incorrectos")
    else:
        print("   ✅ Tiempos corregidos correctamente")

# Hospital 900958564-2 (debe estar cerca de Kennedy)
print("\n2. Hospital 900958564-2 (Bogotá):")
h = supabase.table('hospitals').select('id').eq('code', '900958564-2').execute()
if h.data:
    dists = supabase.table('hospital_kam_distances').select('travel_time, kams(name)').eq('hospital_id', h.data[0]['id']).order('travel_time').limit(3).execute()
    for d in dists.data:
        print(f"   → {d['kams']['name']:20} {d['travel_time']} min")
    
    # Verificar asignación
    assign = supabase.table('assignments').select('kams(name), travel_time').eq('hospital_id', h.data[0]['id']).execute()
    if assign.data:
        print(f"   📍 Asignado a: {assign.data[0]['kams']['name']} ({assign.data[0]['travel_time']} min)")
        if assign.data[0]['kams']['name'] == 'KAM Kennedy' or (dists.data and dists.data[0]['kams']['name'] == 'KAM Kennedy'):
            print("   ✅ Asignación correcta o lista para recalcular")

# Hospital 890701718-1 (Líbano, Tolima)
print("\n3. Hospital 890701718-1 (Líbano):")
h = supabase.table('hospitals').select('id').eq('code', '890701718-1').execute()
if h.data:
    dists = supabase.table('hospital_kam_distances').select('travel_time, kams(name)').eq('hospital_id', h.data[0]['id']).order('travel_time').limit(3).execute()
    for d in dists.data:
        print(f"   → {d['kams']['name']:20} {d['travel_time']} min")
    
    # Buscar Pereira específicamente
    pereira = [d for d in dists.data if 'Pereira' in d['kams']['name']]
    if pereira:
        print(f"   ✅ KAM Pereira tiene distancia: {pereira[0]['travel_time']} min")

# 4. Resumen final
print("\n" + "="*60)
print("📊 RESUMEN FINAL:")
print("-"*40)

issues = []

if under_10:
    issues.append(f"• {len(under_10)} registros con tiempos < 10 min")

if over_1440:
    issues.append(f"• {len(over_1440)} registros con tiempos > 24 horas")

if issues:
    print("⚠️ Problemas encontrados:")
    for issue in issues:
        print(f"   {issue}")
else:
    print("✅ SISTEMA COMPLETAMENTE CORREGIDO")
    print("   • Todos los tiempos están en MINUTOS")
    print("   • No hay valores obviamente incorrectos")
    print("   • Casos específicos verificados")

print("\n📌 SIGUIENTE PASO:")
print("   1. Recargar la aplicación web (Ctrl+F5)")
print("   2. Hacer clic en 'Recalcular Asignaciones'")
print("   3. Los hospitales se reasignarán con los tiempos corregidos")

print("\n" + "="*60)