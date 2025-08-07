#!/usr/bin/env python3
"""
Debug de la regla de mayoría - caso específico
"""
from supabase import create_client

supabase_url = 'https://norvxqgohddgsdkggqzq.supabase.co'
supabase_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vcnZ4cWdvaGRkZ3Nka2dncXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMDExMjUsImV4cCI6MjA2ODc3NzEyNX0.BRWIYeD_5OlpVKIrP1QzUmkSx6HEVGzcEUUiSK8CmJs'

supabase = create_client(supabase_url, supabase_key)

hospital_id = 'aa505371-9606-4582-8626-ed0dc45bf742'
kam_mas_cercano = '3ce353cc-64d0-454e-9017-e78e20a1ea59'

print("🔍 DEBUG DE REGLA DE MAYORÍA")
print("="*60)

# 1. Info del hospital
hospital = supabase.table('hospitals').select('*').eq('id', hospital_id).single().execute()
if hospital.data:
    h = hospital.data
    print(f"\n📋 HOSPITAL:")
    print(f"  Nombre: {h['name']}")
    print(f"  Código: {h['code']}")
    print(f"  Municipio: {h.get('municipality_name')} ({h.get('municipality_id')})")
    print(f"  Localidad: {h.get('locality_name')} ({h.get('locality_id')})")
    
    locality_id = h.get('locality_id')
    municipality_id = h.get('municipality_id')

# 2. Ver todos los tiempos para este hospital
print(f"\n📊 DISTANCIAS PARA ESTE HOSPITAL:")
distances = supabase.table('hospital_kam_distances').select('*, kams(name)').eq('hospital_id', hospital_id).order('travel_time').execute()

if distances.data:
    for d in distances.data[:5]:
        kam_name = d['kams']['name'] if 'kams' in d else 'Unknown'
        time_min = d['travel_time'] / 60 if d['travel_time'] else 0
        print(f"  - {kam_name}: {time_min:.1f} min")
        if d['kam_id'] == kam_mas_cercano:
            print(f"    ⬆️ ESTE ES EL MÁS CERCANO")

# 3. Ver asignación actual
print(f"\n🎯 ASIGNACIÓN ACTUAL:")
assignment = supabase.table('assignments').select('*, kams(name)').eq('hospital_id', hospital_id).execute()

if assignment.data and len(assignment.data) > 0:
    a = assignment.data[0]
    print(f"  Asignado a: {a['kams']['name']}")
    time_min = a.get('travel_time', 0) / 60 if a.get('travel_time') else 0
    print(f"  Tiempo: {time_min:.1f} min")
    print(f"  Tipo: {a['assignment_type']}")
    
    if a['kam_id'] != kam_mas_cercano:
        print(f"\n  ⚠️ NO está asignado al KAM más cercano")

# 4. Analizar la localidad/municipio completo
print(f"\n🏘️ ANÁLISIS DE LA LOCALIDAD/MUNICIPIO:")

# Buscar area_id para determinar si es localidad o municipio
if locality_id and locality_id.startswith('11001'):
    # Es una localidad de Bogotá
    area_id = locality_id
    area_type = "Localidad"
    print(f"  Analizando Localidad: {h.get('locality_name')} ({locality_id})")
else:
    # Es un municipio regular
    area_id = municipality_id
    area_type = "Municipio"
    print(f"  Analizando Municipio: {h.get('municipality_name')} ({municipality_id})")

# Buscar todos los hospitales en la misma área
hospitals_in_area = supabase.table('hospitals').select('id, name').eq('locality_id' if area_type == "Localidad" else 'municipality_id', area_id).eq('active', True).execute()

if hospitals_in_area.data:
    print(f"  Total hospitales en {area_type}: {len(hospitals_in_area.data)}")
    
    # Para cada hospital, ver a qué KAM está asignado
    kam_counts = {}
    hospital_assignments = {}
    
    for hosp in hospitals_in_area.data:
        # Ver asignación individual (sin regla de mayoría)
        dist = supabase.table('hospital_kam_distances').select('kam_id, travel_time, kams(name)').eq('hospital_id', hosp['id']).order('travel_time').limit(1).execute()
        
        if dist.data and len(dist.data) > 0:
            best_kam = dist.data[0]['kam_id']
            best_kam_name = dist.data[0]['kams']['name']
            
            if best_kam not in kam_counts:
                kam_counts[best_kam] = {'name': best_kam_name, 'count': 0}
            kam_counts[best_kam]['count'] += 1
            hospital_assignments[hosp['id']] = best_kam_name
    
    print(f"\n  📊 DISTRIBUCIÓN NATURAL (sin regla de mayoría):")
    for kam_id, info in sorted(kam_counts.items(), key=lambda x: x[1]['count'], reverse=True):
        print(f"    - {info['name']}: {info['count']} hospitales")
        if kam_id == kam_mas_cercano:
            print(f"      ⬆️ Este KAM debería ganar si tiene {info['count']}")
    
    # Ver cuál KAM gana por mayoría
    winner_kam = max(kam_counts.items(), key=lambda x: x[1]['count'])
    print(f"\n  🏆 GANADOR POR MAYORÍA: {winner_kam[1]['name']} con {winner_kam[1]['count']} hospitales")
    
    # Ver las asignaciones reales actuales
    print(f"\n  📍 ASIGNACIONES REALES (después de regla de mayoría):")
    real_assignments = supabase.table('assignments').select('hospital_id, kam_id, kams(name)').in_('hospital_id', [h['id'] for h in hospitals_in_area.data]).execute()
    
    if real_assignments.data:
        real_kam_counts = {}
        for ra in real_assignments.data:
            kam_name = ra['kams']['name']
            if kam_name not in real_kam_counts:
                real_kam_counts[kam_name] = 0
            real_kam_counts[kam_name] += 1
        
        for kam_name, count in real_kam_counts.items():
            print(f"    - {kam_name}: {count} hospitales")

print("\n" + "="*60)
print("📝 CONCLUSIÓN:")
print("Si el hospital no está asignado al KAM más cercano,")
print("es porque la regla de mayoría lo reasignó al KAM")
print("que tiene más hospitales en esa localidad/municipio.")