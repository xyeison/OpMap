#!/usr/bin/env python3
"""
Verificar calidad de datos en todas las tablas usadas por el mapa
"""
from supabase import create_client
from collections import Counter

supabase_url = 'https://norvxqgohddgsdkggqzq.supabase.co'
supabase_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vcnZ4cWdvaGRkZ3Nka2dncXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMDExMjUsImV4cCI6MjA2ODc3NzEyNX0.BRWIYeD_5OlpVKIrP1QzUmkSx6HEVGzcEUUiSK8CmJs'

supabase = create_client(supabase_url, supabase_key)

print("🔍 VERIFICACIÓN DE CALIDAD DE DATOS")
print("="*60)

issues = []

# 1. Verificar tabla KAMS
print("\n📊 TABLA kams:")
print("-"*40)
kams = supabase.table('kams').select('*').eq('active', True).execute()
print(f"KAMs activos: {len(kams.data)}")

for kam in kams.data:
    if not kam.get('lat') or not kam.get('lng'):
        issues.append(f"KAM {kam['name']} sin coordenadas")
    if not kam.get('area_id'):
        issues.append(f"KAM {kam['name']} sin area_id")

# 2. Verificar tabla ASSIGNMENTS
print("\n📊 TABLA assignments:")
print("-"*40)
assignments = supabase.table('assignments').select('*, hospitals!inner(*), kams!inner(*)').execute()
print(f"Total asignaciones: {len(assignments.data)}")

# Verificar asignaciones duplicadas
hospital_ids = [a['hospital_id'] for a in assignments.data]
duplicates = [h_id for h_id, count in Counter(hospital_ids).items() if count > 1]
if duplicates:
    print(f"⚠️ {len(duplicates)} hospitales con asignaciones DUPLICADAS")
    for dup_id in duplicates[:5]:
        dup_assigns = [a for a in assignments.data if a['hospital_id'] == dup_id]
        h_name = dup_assigns[0]['hospitals']['name'] if dup_assigns else 'Unknown'
        print(f"   • {h_name}: asignado a {len(dup_assigns)} KAMs")
        for da in dup_assigns:
            print(f"     → {da['kams']['name']} (travel_time: {da.get('travel_time')})")
        issues.append(f"Hospital {h_name} con {len(dup_assigns)} asignaciones")

# Verificar tiempos sospechosos
suspicious_times = []
for a in assignments.data:
    t = a.get('travel_time')
    if t and t > 1440:  # Más de 24 horas
        suspicious_times.append(a)

if suspicious_times:
    print(f"\n⚠️ {len(suspicious_times)} asignaciones con tiempos > 24 horas:")
    for st in suspicious_times[:5]:
        print(f"   • {st['hospitals']['name']} → {st['kams']['name']}: {st['travel_time']} min ({st['travel_time']/60:.1f} horas)")
    issues.append(f"{len(suspicious_times)} asignaciones con tiempos excesivos")

# 3. Verificar tabla HOSPITALS
print("\n📊 TABLA hospitals:")
print("-"*40)
hospitals = supabase.table('hospitals').select('*').eq('active', True).execute()
print(f"Hospitales activos: {len(hospitals.data)}")

# Verificar hospitales sin coordenadas
no_coords = [h for h in hospitals.data if not h.get('lat') or not h.get('lng')]
if no_coords:
    print(f"⚠️ {len(no_coords)} hospitales sin coordenadas")
    for h in no_coords[:5]:
        print(f"   • {h['code']}: {h['name']}")
    issues.append(f"{len(no_coords)} hospitales sin coordenadas")

# Verificar coordenadas sospechosas (0,0 o fuera de Colombia)
suspicious_coords = []
for h in hospitals.data:
    lat, lng = h.get('lat'), h.get('lng')
    if lat and lng:
        # Colombia está aproximadamente entre:
        # Lat: -4.2 a 13.5
        # Lng: -82 a -66
        if not (-5 < lat < 14) or not (-83 < lng < -65):
            suspicious_coords.append(h)
        if abs(lat) < 0.1 and abs(lng) < 0.1:  # Cerca de 0,0
            suspicious_coords.append(h)

if suspicious_coords:
    print(f"⚠️ {len(suspicious_coords)} hospitales con coordenadas sospechosas")
    for h in suspicious_coords[:5]:
        print(f"   • {h['code']}: {h['name']} ({h['lat']}, {h['lng']})")
    issues.append(f"{len(suspicious_coords)} hospitales con coordenadas incorrectas")

# 4. Verificar tabla HOSPITAL_KAM_DISTANCES
print("\n📊 TABLA hospital_kam_distances:")
print("-"*40)
distances = supabase.table('hospital_kam_distances').select('travel_time', count='exact').execute()
print(f"Total registros: {distances.count}")

# Verificar tiempos sospechosos
dist_sample = supabase.table('hospital_kam_distances').select('*').limit(1000).execute()
times = [d['travel_time'] for d in dist_sample.data if d['travel_time']]
if times:
    suspicious_low = [t for t in times if t < 2]  # Menos de 2 minutos
    suspicious_high = [t for t in times if t > 1440]  # Más de 24 horas
    
    if suspicious_low:
        print(f"⚠️ {len(suspicious_low)} tiempos < 2 minutos (muestra de 1000)")
        issues.append(f"Tiempos sospechosamente bajos en hospital_kam_distances")
    
    if suspicious_high:
        print(f"⚠️ {len(suspicious_high)} tiempos > 24 horas (muestra de 1000)")
        issues.append(f"Tiempos excesivos en hospital_kam_distances")

# 5. Verificar coherencia entre tablas
print("\n🔄 VERIFICACIÓN DE COHERENCIA:")
print("-"*40)

# Hospitales asignados que no existen
assigned_hospital_ids = set(a['hospital_id'] for a in assignments.data)
existing_hospital_ids = set(h['id'] for h in hospitals.data)
phantom_assignments = assigned_hospital_ids - existing_hospital_ids
if phantom_assignments:
    print(f"⚠️ {len(phantom_assignments)} asignaciones a hospitales que NO EXISTEN")
    issues.append(f"{len(phantom_assignments)} asignaciones fantasma")

# KAMs en asignaciones que no están activos
assigned_kam_ids = set(a['kam_id'] for a in assignments.data)
active_kam_ids = set(k['id'] for k in kams.data)
inactive_kam_assignments = assigned_kam_ids - active_kam_ids
if inactive_kam_assignments:
    print(f"⚠️ {len(inactive_kam_assignments)} asignaciones a KAMs INACTIVOS")
    issues.append(f"{len(inactive_kam_assignments)} asignaciones a KAMs inactivos")

# Hospitales activos sin ninguna distancia calculada
hospitals_with_distances = supabase.table('hospital_kam_distances').select('hospital_id').execute()
hospitals_with_dist_ids = set(d['hospital_id'] for d in hospitals_with_distances.data)
hospitals_without_distances = existing_hospital_ids - hospitals_with_dist_ids
if hospitals_without_distances:
    print(f"⚠️ {len(hospitals_without_distances)} hospitales activos SIN distancias calculadas")
    # Mostrar algunos ejemplos
    examples = list(hospitals_without_distances)[:5]
    for h_id in examples:
        h = next((h for h in hospitals.data if h['id'] == h_id), None)
        if h:
            print(f"   • {h['code']}: {h['name']} ({h['municipality_name']})")
    issues.append(f"{len(hospitals_without_distances)} hospitales sin distancias")

# 6. RESUMEN
print("\n" + "="*60)
print("📊 RESUMEN DE PROBLEMAS ENCONTRADOS:")
print("-"*40)

if issues:
    print("⚠️ Se encontraron los siguientes problemas:")
    for i, issue in enumerate(issues, 1):
        print(f"   {i}. {issue}")
    
    print("\n🔧 ACCIONES RECOMENDADAS:")
    print("   1. Eliminar asignaciones duplicadas")
    print("   2. Recalcular tiempos excesivos")
    print("   3. Verificar coordenadas de hospitales")
    print("   4. Calcular distancias faltantes")
    print("   5. Ejecutar 'Recalcular Asignaciones' después de limpiar")
else:
    print("✅ No se encontraron problemas significativos en los datos")

print("\n" + "="*60)