#!/usr/bin/env python3
"""
Verificar y corregir tiempos en la tabla assignments
"""
from supabase import create_client

supabase_url = 'https://norvxqgohddgsdkggqzq.supabase.co'
supabase_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vcnZ4cWdvaGRkZ3Nka2dncXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMDExMjUsImV4cCI6MjA2ODc3NzEyNX0.BRWIYeD_5OlpVKIrP1QzUmkSx6HEVGzcEUUiSK8CmJs'

supabase = create_client(supabase_url, supabase_key)

print("🔍 VERIFICANDO TABLA ASSIGNMENTS")
print("="*60)

# 1. Obtener todas las asignaciones
print("\n📥 Obteniendo asignaciones...")
assignments = supabase.table('assignments').select('*').execute()
print(f"   Total asignaciones: {len(assignments.data)}")

# 2. Analizar tiempos
needs_fix = []
correct = []
no_time = []

for a in assignments.data:
    if a['travel_time'] is None:
        no_time.append(a)
    elif a['travel_time'] > 1440:  # Más de 24 horas, probablemente en segundos
        needs_fix.append(a)
    else:
        correct.append(a)

print(f"\n📊 Análisis:")
print(f"   Correctos (< 1440 min): {len(correct)}")
print(f"   Necesitan corrección (> 1440): {len(needs_fix)}")
print(f"   Sin tiempo: {len(no_time)}")

if needs_fix:
    print(f"\n⚠️ {len(needs_fix)} asignaciones tienen tiempos en SEGUNDOS")
    
    # Mostrar ejemplos
    print("\n📋 Ejemplos:")
    for a in needs_fix[:5]:
        old_time = a['travel_time']
        new_time = round(old_time / 60) if old_time else 0
        print(f"   {old_time} segundos → {new_time} minutos")
    
    print(f"\n🔧 Corrigiendo {len(needs_fix)} registros...")
    
    # Actualizar
    updated = 0
    for a in needs_fix:
        new_time = round(a['travel_time'] / 60) if a['travel_time'] else None
        try:
            supabase.table('assignments').update({
                'travel_time': new_time
            }).eq('id', a['id']).execute()
            updated += 1
        except:
            pass
        
        if updated % 100 == 0:
            print(f"   Actualizados: {updated}/{len(needs_fix)}")
    
    print(f"\n✅ Corrección completada: {updated} registros actualizados")

# 3. Verificar casos específicos mencionados
print("\n🔍 VERIFICANDO CASOS ESPECÍFICOS:")

# Hospital 900958564-2
h1 = supabase.table('hospitals').select('id, name').eq('code', '900958564-2').execute()
if h1.data:
    h_id = h1.data[0]['id']
    a = supabase.table('assignments').select('*, kams(name)').eq('hospital_id', h_id).execute()
    if a.data:
        print(f"\n{h1.data[0]['name']} (900958564-2):")
        print(f"   Asignado a: {a.data[0]['kams']['name']}")
        print(f"   Tiempo: {a.data[0]['travel_time']} minutos")
        
        # Verificar si debería estar en Kennedy
        k_kennedy = supabase.table('kams').select('id').eq('name', 'KAM Kennedy').execute()
        if k_kennedy.data:
            dist = supabase.table('hospital_kam_distances').select('travel_time').eq(
                'hospital_id', h_id
            ).eq('kam_id', k_kennedy.data[0]['id']).execute()
            if dist.data:
                print(f"   Distancia a KAM Kennedy: {dist.data[0]['travel_time']} minutos")

# Hospital 890701718-1
h2 = supabase.table('hospitals').select('id, name').eq('code', '890701718-1').execute()
if h2.data:
    h_id = h2.data[0]['id']
    a = supabase.table('assignments').select('*, kams(name)').eq('hospital_id', h_id).execute()
    if a.data:
        print(f"\n{h2.data[0]['name']} (890701718-1):")
        print(f"   Asignado a: {a.data[0]['kams']['name']}")
        print(f"   Tiempo: {a.data[0]['travel_time']} minutos")
    else:
        print(f"\n{h2.data[0]['name']} (890701718-1):")
        print(f"   ❌ NO ASIGNADO (probablemente excede 240 minutos)")
        
        # Verificar distancias disponibles
        dists = supabase.table('hospital_kam_distances').select('*, kams(name)').eq('hospital_id', h_id).execute()
        if dists.data:
            print(f"   Distancias disponibles:")
            for d in sorted(dists.data, key=lambda x: x['travel_time'])[:3]:
                print(f"      → {d['kams']['name']}: {d['travel_time']} min")

# 4. Verificación final
print("\n📊 VERIFICACIÓN FINAL:")
final_check = supabase.table('assignments').select('travel_time').gt('travel_time', 1440).execute()
if final_check.data:
    print(f"   ⚠️ Aún hay {len(final_check.data)} asignaciones > 1440 minutos")
else:
    print(f"   ✅ Todas las asignaciones tienen tiempos correctos en MINUTOS")

print("\n" + "="*60)