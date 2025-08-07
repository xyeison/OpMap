#!/usr/bin/env python3
"""
Verificación final de todas las correcciones
"""
from supabase import create_client

supabase_url = 'https://norvxqgohddgsdkggqzq.supabase.co'
supabase_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vcnZ4cWdvaGRkZ3Nka2dncXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMDExMjUsImV4cCI6MjA2ODc3NzEyNX0.BRWIYeD_5OlpVKIrP1QzUmkSx6HEVGzcEUUiSK8CmJs'

supabase = create_client(supabase_url, supabase_key)

print("✅ VERIFICACIÓN FINAL DE CORRECCIONES")
print("="*60)

# 1. Verificar casos específicos mencionados por el usuario
print("\n🔍 CASOS ESPECÍFICOS:")
print("-"*40)

# Hospital 900958564-2 (debe estar asignado a Kennedy, no a San Cristóbal)
h1 = supabase.table('hospitals').select('id, name, municipality_name').eq('code', '900958564-2').execute()
if h1.data:
    h_id = h1.data[0]['id']
    print(f"\nHospital: {h1.data[0]['name']}")
    print(f"Código: 900958564-2")
    print(f"Municipio: {h1.data[0]['municipality_name']}")
    
    # Obtener distancias a todos los KAMs
    distances = supabase.table('hospital_kam_distances').select('*, kams(name)').eq('hospital_id', h_id).order('travel_time').execute()
    
    print(f"\nDistancias disponibles:")
    for d in distances.data[:5]:  # Top 5 más cercanos
        print(f"   → {d['kams']['name']}: {d['travel_time']} min")
    
    # Ver asignación actual
    assignment = supabase.table('assignments').select('*, kams(name)').eq('hospital_id', h_id).execute()
    if assignment.data:
        print(f"\n📍 Asignación actual: {assignment.data[0]['kams']['name']}")
        print(f"   Tiempo: {assignment.data[0]['travel_time']} min")
        
        if assignment.data[0]['kams']['name'] != 'KAM Kennedy' and distances.data[0]['kams']['name'] == 'KAM Kennedy':
            print("   ⚠️ NECESITA RECALCULAR - Kennedy es más cercano!")

print("\n" + "-"*40)

# Hospital 890701718-1 en Líbano, Tolima
h2 = supabase.table('hospitals').select('id, name, municipality_name').eq('code', '890701718-1').execute()
if h2.data:
    h_id = h2.data[0]['id']
    print(f"\nHospital: {h2.data[0]['name']}")
    print(f"Código: 890701718-1")
    print(f"Municipio: {h2.data[0]['municipality_name']}")
    
    # Obtener distancias
    distances = supabase.table('hospital_kam_distances').select('*, kams(name)').eq('hospital_id', h_id).order('travel_time').execute()
    
    if distances.data:
        print(f"\nDistancias disponibles:")
        for d in distances.data[:5]:
            print(f"   → {d['kams']['name']}: {d['travel_time']} min")
        
        # Buscar específicamente Pereira
        pereira_dist = [d for d in distances.data if 'Pereira' in d['kams']['name']]
        if pereira_dist:
            print(f"\n✅ KAM Pereira SÍ tiene distancia: {pereira_dist[0]['travel_time']} min")
        else:
            print("\n❌ KAM Pereira NO tiene distancia calculada")
    else:
        print("\n❌ No hay distancias calculadas para este hospital")
    
    # Ver asignación
    assignment = supabase.table('assignments').select('*, kams(name)').eq('hospital_id', h_id).execute()
    if assignment.data:
        print(f"\n📍 Asignación actual: {assignment.data[0]['kams']['name']}")
        print(f"   Tiempo: {assignment.data[0]['travel_time']} min")
    else:
        print("\n📍 Sin asignación (probablemente > 240 min a todos los KAMs)")

# 2. Estadísticas generales
print("\n" + "="*60)
print("📊 ESTADÍSTICAS GENERALES:")
print("-"*40)

# Tabla hospital_kam_distances
distances_stats = supabase.table('hospital_kam_distances').select('travel_time').execute()
times = [d['travel_time'] for d in distances_stats.data if d['travel_time']]

print(f"\nTabla hospital_kam_distances:")
print(f"   Total registros: {len(distances_stats.data)}")
print(f"   Con tiempo: {len(times)}")
print(f"   Tiempo mínimo: {min(times)} min")
print(f"   Tiempo máximo: {max(times)} min ({max(times)/60:.1f} horas)")
print(f"   Tiempo promedio: {sum(times)/len(times):.1f} min")

# Verificar si hay valores sospechosos
suspicious = [t for t in times if t > 1440]
if suspicious:
    print(f"\n⚠️ ALERTA: {len(suspicious)} registros > 24 horas")
    print(f"   Estos podrían ser rutas legítimamente largas o errores")
    print(f"   Valores: {sorted(suspicious)[:10]}...")  # Primeros 10

# Tabla assignments
assignments_stats = supabase.table('assignments').select('travel_time').execute()
assign_times = [a['travel_time'] for a in assignments_stats.data if a['travel_time']]

print(f"\nTabla assignments:")
print(f"   Total asignaciones: {len(assignments_stats.data)}")
print(f"   Con tiempo: {len(assign_times)}")
if assign_times:
    print(f"   Tiempo mínimo: {min(assign_times)} min")
    print(f"   Tiempo máximo: {max(assign_times)} min")
    print(f"   Tiempo promedio: {sum(assign_times)/len(assign_times):.1f} min")

# Verificar coherencia
assign_suspicious = [t for t in assign_times if t > 240]
if assign_suspicious:
    print(f"\n⚠️ {len(assign_suspicious)} asignaciones > 240 min (límite estándar)")

print("\n" + "="*60)
print("🎯 RESUMEN FINAL:")
print("-"*40)

if not suspicious and not assign_suspicious:
    print("✅ Todas las correcciones están completas")
    print("✅ Los tiempos están en MINUTOS")
    print("✅ No hay valores obviamente incorrectos")
    print("\n📌 SIGUIENTE PASO:")
    print("   → Hacer clic en 'Recalcular Asignaciones' en la web")
    print("   → Esto reasignará hospitales con los tiempos corregidos")
else:
    print("⚠️ Hay algunos valores que revisar:")
    if suspicious:
        print(f"   - {len(suspicious)} distancias > 24 horas en hospital_kam_distances")
    if assign_suspicious:
        print(f"   - {len(assign_suspicious)} asignaciones > 240 min en assignments")
    print("\nEstos podrían ser correctos (rutas muy largas) o necesitar revisión")

print("\n" + "="*60)