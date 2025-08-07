#!/usr/bin/env python3
"""
Verificar qué está pasando en Rafael Uribe Uribe
"""
from supabase import create_client

supabase_url = 'https://norvxqgohddgsdkggqzq.supabase.co'
supabase_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vcnZ4cWdvaGRkZ3Nka2dncXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMDExMjUsImV4cCI6MjA2ODc3NzEyNX0.BRWIYeD_5OlpVKIrP1QzUmkSx6HEVGzcEUUiSK8CmJs'

supabase = create_client(supabase_url, supabase_key)

print("🔍 ANÁLISIS DETALLADO DE RAFAEL URIBE URIBE")
print("="*60)

# 1. Buscar TODOS los hospitales en Rafael Uribe Uribe
print("\n1. HOSPITALES EN RAFAEL URIBE URIBE (1100118):")
print("-"*40)

hospitals = supabase.table('hospitals').select('*').eq('locality_id', '1100118').eq('active', True).execute()

if hospitals.data:
    print(f"Total encontrados: {len(hospitals.data)}")
    for h in hospitals.data:
        print(f"\n  • {h['name']}")
        print(f"    Código: {h['code']}")
        print(f"    ID: {h['id']}")
        
        # Ver asignación actual
        assignment = supabase.table('assignments').select('kam_id, kams(name, color)').eq('hospital_id', h['id']).execute()
        if assignment.data and len(assignment.data) > 0:
            kam_name = assignment.data[0]['kams']['name']
            kam_color = assignment.data[0]['kams'].get('color', 'Unknown')
            print(f"    Asignado a: {kam_name} (Color: {kam_color})")
        else:
            print(f"    Sin asignación")
            
        # Ver distancia más cercana
        closest = supabase.table('hospital_kam_distances').select('kam_id, travel_time, kams(name, color)').eq('hospital_id', h['id']).order('travel_time').limit(1).execute()
        if closest.data and len(closest.data) > 0:
            closest_kam = closest.data[0]['kams']['name']
            closest_color = closest.data[0]['kams'].get('color', 'Unknown')
            time_min = closest.data[0]['travel_time'] / 60
            print(f"    Más cercano: {closest_kam} ({time_min:.1f} min, Color: {closest_color})")

# 2. Ver los KAMs involucrados
print("\n2. KAMS RELEVANTES:")
print("-"*40)

kams_ids = ['3ce353cc-64d0-454e-9017-e78e20a1ea59', '4612f53f-2e66-445b-a10f-b912f87e2f87']  # Kennedy y San Cristóbal
kams = supabase.table('kams').select('*').in_('id', kams_ids).execute()

if kams.data:
    for k in kams.data:
        print(f"\n  • {k['name']}")
        print(f"    ID: {k['id']}")
        print(f"    Area: {k['area_id']}")
        print(f"    Color: {k.get('color', 'Unknown')}")
        
        # Ver si su area_id es una localidad de Bogotá
        if k['area_id'].startswith('11001') and len(k['area_id']) > 5:
            # Buscar el nombre de la localidad
            locality = supabase.table('hospitals').select('locality_name').eq('locality_id', k['area_id']).limit(1).execute()
            if locality.data:
                print(f"    Localidad base: {locality.data[0]['locality_name']}")

# 3. Verificar si hay un problema con la regla de mayoría
print("\n3. ANÁLISIS DE ASIGNACIONES:")
print("-"*40)

# Contar asignaciones por KAM en Rafael Uribe Uribe
if hospitals.data:
    kam_counts = {}
    for h in hospitals.data:
        assignment = supabase.table('assignments').select('kam_id, kams(name)').eq('hospital_id', h['id']).execute()
        if assignment.data and len(assignment.data) > 0:
            kam_name = assignment.data[0]['kams']['name']
            kam_id = assignment.data[0]['kam_id']
            if kam_id not in kam_counts:
                kam_counts[kam_id] = {'name': kam_name, 'count': 0}
            kam_counts[kam_id]['count'] += 1
    
    print("Distribución actual de hospitales:")
    for kam_id, info in kam_counts.items():
        print(f"  - {info['name']}: {info['count']} hospitales")

# 4. Verificar colores en el mapa
print("\n4. COLORES DE KAMS:")
print("-"*40)

all_kams = supabase.table('kams').select('name, color').eq('active', True).execute()
if all_kams.data:
    for k in all_kams.data:
        if 'Kennedy' in k['name'] or 'San Cristóbal' in k['name']:
            print(f"  {k['name']}: {k.get('color', 'Sin color definido')}")

print("\n" + "="*60)