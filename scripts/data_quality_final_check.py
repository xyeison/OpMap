#!/usr/bin/env python3
"""
Verificación final de calidad de datos después de todas las correcciones
"""
from supabase import create_client

supabase_url = 'https://norvxqgohddgsdkggqzq.supabase.co'
supabase_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vcnZ4cWdvaGRkZ3Nka2dncXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMDExMjUsImV4cCI6MjA2ODc3NzEyNX0.BRWIYeD_5OlpVKIrP1QzUmkSx6HEVGzcEUUiSK8CmJs'

supabase = create_client(supabase_url, supabase_key)

print("✅ VERIFICACIÓN FINAL DE CALIDAD DE DATOS")
print("="*60)

# 1. Verificar tiempos en hospital_kam_distances
print("\n📊 TABLA hospital_kam_distances:")
print("-"*40)

# Verificar rangos de tiempo
sample = supabase.table('hospital_kam_distances').select('travel_time').limit(1000).execute()
times = [d['travel_time'] for d in sample.data if d['travel_time']]

if times:
    under_10 = len([t for t in times if t < 10])
    over_1440 = len([t for t in times if t > 1440])
    
    print(f"Muestra de 1000 registros:")
    print(f"   Mínimo: {min(times)} min")
    print(f"   Máximo: {max(times)} min")
    print(f"   Promedio: {sum(times)/len(times):.1f} min")
    print(f"   Registros < 10 min: {under_10}")
    print(f"   Registros > 24 horas: {over_1440}")
    
    if under_10 == 0:
        print("   ✅ No hay tiempos sospechosamente bajos")
    else:
        print(f"   ⚠️ {under_10} tiempos < 10 min (revisar)")

# 2. Verificar tiempos en assignments
print("\n📊 TABLA assignments:")
print("-"*40)

assignments = supabase.table('assignments').select('travel_time').execute()
assign_times = [a['travel_time'] for a in assignments.data if a['travel_time']]

if assign_times:
    under_10 = len([t for t in assign_times if t < 10])
    over_240 = len([t for t in assign_times if t > 240])
    over_1440 = len([t for t in assign_times if t > 1440])
    
    print(f"Total asignaciones: {len(assignments.data)}")
    print(f"   Con tiempo: {len(assign_times)}")
    print(f"   Sin tiempo: {len(assignments.data) - len(assign_times)}")
    print(f"   Mínimo: {min(assign_times)} min")
    print(f"   Máximo: {max(assign_times)} min")
    print(f"   Promedio: {sum(assign_times)/len(assign_times):.1f} min")
    print(f"   Registros < 10 min: {under_10}")
    print(f"   Registros > 240 min (4h): {over_240}")
    print(f"   Registros > 1440 min (24h): {over_1440}")
    
    if over_1440 == 0:
        print("   ✅ No hay tiempos excesivos (> 24h)")
    else:
        print(f"   ⚠️ {over_1440} asignaciones > 24 horas")

# 3. Verificar coherencia entre tablas
print("\n🔄 COHERENCIA ENTRE TABLAS:")
print("-"*40)

# Hospitales activos
hospitals = supabase.table('hospitals').select('id', count='exact').eq('active', True).execute()
print(f"Hospitales activos: {hospitals.count}")

# Hospitales con distancias calculadas
with_distances = supabase.table('hospital_kam_distances').select('hospital_id').execute()
unique_hospitals_with_dist = len(set(d['hospital_id'] for d in with_distances.data))
print(f"Hospitales con distancias calculadas: {unique_hospitals_with_dist}")

# Hospitales asignados
assigned = supabase.table('assignments').select('hospital_id').execute()
unique_assigned = len(set(a['hospital_id'] for a in assigned.data))
print(f"Hospitales asignados: {unique_assigned}")

# Hospitales sin asignar
unassigned = hospitals.count - unique_assigned if hospitals.count else 0
print(f"Hospitales sin asignar: {unassigned}")

# Hospitales sin distancias
without_distances = hospitals.count - unique_hospitals_with_dist if hospitals.count else 0
print(f"Hospitales sin distancias calculadas: {without_distances}")

if without_distances > 0:
    print(f"\n⚠️ {without_distances} hospitales activos no tienen distancias calculadas")
    print("   Estos hospitales no podrán ser asignados correctamente")

# 4. Casos específicos de prueba
print("\n🔍 CASOS DE PRUEBA ESPECÍFICOS:")
print("-"*40)

test_cases = [
    ('900678145-1', 'Puerto Boyacá'),
    ('900958564-1', 'Bogotá - Kennedy'),
    ('890701718-1', 'Líbano, Tolima')
]

for code, description in test_cases:
    print(f"\n{description} ({code}):")
    
    # Buscar hospital
    h = supabase.table('hospitals').select('id').eq('code', code).execute()
    if h.data:
        h_id = h.data[0]['id']
        
        # Verificar distancias
        dists = supabase.table('hospital_kam_distances').select('travel_time').eq('hospital_id', h_id).limit(3).execute()
        if dists.data:
            times = [d['travel_time'] for d in dists.data if d['travel_time']]
            if times:
                print(f"   Distancias: min={min(times)}, max={max(times)} min")
                if min(times) < 10:
                    print(f"   ⚠️ Tiempo mínimo sospechoso: {min(times)} min")
                else:
                    print(f"   ✅ Tiempos parecen correctos")
        else:
            print(f"   ❌ Sin distancias calculadas")
        
        # Verificar asignación
        assign = supabase.table('assignments').select('travel_time').eq('hospital_id', h_id).execute()
        if assign.data and assign.data[0]['travel_time']:
            print(f"   Asignación: {assign.data[0]['travel_time']} min")
    else:
        print(f"   ❌ Hospital no encontrado")

# 5. Resumen final
print("\n" + "="*60)
print("📊 RESUMEN DE ESTADO ACTUAL:")
print("-"*40)

issues = []

if under_10 > 0:
    issues.append("Tiempos < 10 min en hospital_kam_distances")

if over_1440 > 0:
    issues.append("Tiempos > 24h en assignments")

if without_distances > 100:
    issues.append(f"{without_distances} hospitales sin distancias calculadas")

if len(assign_times) < unique_assigned * 0.5:
    issues.append("Muchas asignaciones sin tiempo calculado")

if issues:
    print("⚠️ Problemas pendientes:")
    for issue in issues:
        print(f"   • {issue}")
    print("\n🔧 Recomendación:")
    print("   1. Calcular distancias faltantes con Google Maps")
    print("   2. Ejecutar 'Recalcular Asignaciones'")
else:
    print("✅ DATOS EN BUEN ESTADO")
    print("   • Tiempos en rangos correctos")
    print("   • Sin valores obviamente incorrectos")
    print("   • Listo para usar en producción")
    
print("\n📌 La aplicación web debería mostrar los datos correctamente.")
print("   Si aún ves problemas, recarga con Ctrl+F5")

print("\n" + "="*60)