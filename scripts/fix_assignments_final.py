#!/usr/bin/env python3
"""
Corregir definitivamente la tabla assignments
"""
from supabase import create_client

supabase_url = 'https://norvxqgohddgsdkggqzq.supabase.co'
supabase_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vcnZ4cWdvaGRkZ3Nka2dncXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMDExMjUsImV4cCI6MjA2ODc3NzEyNX0.BRWIYeD_5OlpVKIrP1QzUmkSx6HEVGzcEUUiSK8CmJs'

supabase = create_client(supabase_url, supabase_key)

print("🔧 CORRECCIÓN FINAL DE TABLA ASSIGNMENTS")
print("="*60)

# 1. Obtener asignaciones con tiempos sospechosos
print("\n📥 Obteniendo asignaciones con tiempos > 240...")
suspicious = supabase.table('assignments').select('*').gt('travel_time', 240).execute()

print(f"   Encontradas: {len(suspicious.data)} asignaciones")

# Analizar valores
if suspicious.data:
    values = [a['travel_time'] for a in suspicious.data if a['travel_time']]
    print(f"\n📊 Análisis:")
    print(f"   Mínimo: {min(values)}")
    print(f"   Máximo: {max(values)}")
    print(f"   Promedio: {sum(values)/len(values):.1f}")
    
    # Separar por rangos
    range_240_1000 = [v for v in values if 240 < v <= 1000]
    range_1000_1440 = [v for v in values if 1000 < v <= 1440]
    range_over_1440 = [v for v in values if v > 1440]
    
    print(f"\n📊 Por rangos:")
    print(f"   240-1000: {len(range_240_1000)} registros")
    print(f"   1000-1440: {len(range_1000_1440)} registros")
    print(f"   > 1440: {len(range_over_1440)} registros")
    
    # Los de 1000-1440 son claramente segundos
    if range_1000_1440:
        print(f"\n⚠️ {len(range_1000_1440)} registros entre 1000-1440 parecen ser SEGUNDOS")
        print("   Convirtiendo a minutos...")
        
        updated = 0
        for a in suspicious.data:
            if a['travel_time'] and 1000 < a['travel_time'] <= 1440:
                new_time = round(a['travel_time'] / 60)
                try:
                    supabase.table('assignments').update({
                        'travel_time': new_time
                    }).eq('id', a['id']).execute()
                    updated += 1
                except:
                    pass
        
        print(f"   ✅ Convertidos: {updated} registros")

# 2. Actualizar tiempos NULL con valores de hospital_kam_distances
print("\n📥 Buscando asignaciones sin tiempo...")
no_time = supabase.table('assignments').select('*').is_('travel_time', 'null').execute()

if no_time.data:
    print(f"   Encontradas: {len(no_time.data)} sin tiempo")
    print("   Actualizando desde hospital_kam_distances...")
    
    updated = 0
    for a in no_time.data:
        # Buscar el tiempo en hospital_kam_distances
        dist = supabase.table('hospital_kam_distances').select('travel_time').eq(
            'hospital_id', a['hospital_id']
        ).eq('kam_id', a['kam_id']).execute()
        
        if dist.data and dist.data[0]['travel_time']:
            try:
                supabase.table('assignments').update({
                    'travel_time': dist.data[0]['travel_time']
                }).eq('id', a['id']).execute()
                updated += 1
            except:
                pass
    
    print(f"   ✅ Actualizados: {updated} registros")

# 3. Verificación final
print("\n📊 VERIFICACIÓN FINAL:")
print("-"*40)

# Estadísticas actualizadas
all_assignments = supabase.table('assignments').select('travel_time').execute()
times = [a['travel_time'] for a in all_assignments.data if a['travel_time']]

if times:
    print(f"Total asignaciones: {len(all_assignments.data)}")
    print(f"Con tiempo: {len(times)}")
    print(f"Tiempo mínimo: {min(times)} min")
    print(f"Tiempo máximo: {max(times)} min")
    print(f"Tiempo promedio: {sum(times)/len(times):.1f} min")
    
    # Verificar rangos
    over_240 = [t for t in times if t > 240]
    over_1000 = [t for t in times if t > 1000]
    
    if over_240:
        print(f"\nAsignaciones > 240 min: {len(over_240)}")
        print("   (Estas pueden ser rutas legítimamente largas)")
    
    if over_1000:
        print(f"\n⚠️ Asignaciones > 1000 min: {len(over_1000)}")
        print("   Verificar si son correctas")

# 4. Verificar el caso específico 900958564-2
print("\n🔍 Verificando caso específico 900958564-2:")
h = supabase.table('hospitals').select('id').eq('code', '900958564-2').execute()
if h.data:
    a = supabase.table('assignments').select('*, kams(name)').eq('hospital_id', h.data[0]['id']).execute()
    if a.data:
        print(f"   Asignado a: {a.data[0]['kams']['name']}")
        print(f"   Tiempo: {a.data[0]['travel_time']} min")
        
        if a.data[0]['travel_time'] is None:
            # Intentar obtener de hospital_kam_distances
            dist = supabase.table('hospital_kam_distances').select('travel_time').eq(
                'hospital_id', h.data[0]['id']
            ).eq('kam_id', a.data[0]['kam_id']).execute()
            if dist.data:
                print(f"   Tiempo en hospital_kam_distances: {dist.data[0]['travel_time']} min")
                print("   ⚠️ Necesita actualización")

print("\n" + "="*60)
print("✅ CORRECCIÓN COMPLETADA")
print("\n📌 SIGUIENTE PASO:")
print("   Hacer clic en 'Recalcular Asignaciones' en la aplicación web")
print("   Esto reasignará hospitales usando los tiempos corregidos")
print("="*60)