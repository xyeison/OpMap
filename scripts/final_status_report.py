#!/usr/bin/env python3
"""
Reporte final del estado de las distancias en hospital_kam_distances
"""
from supabase import create_client
from datetime import datetime

supabase_url = 'https://norvxqgohddgsdkggqzq.supabase.co'
supabase_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vcnZ4cWdvaGRkZ3Nka2dncXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMDExMjUsImV4cCI6MjA2ODc3NzEyNX0.BRWIYeD_5OlpVKIrP1QzUmkSx6HEVGzcEUUiSK8CmJs'

supabase = create_client(supabase_url, supabase_key)

print("=" * 80)
print("📊 REPORTE FINAL DE DISTANCIAS - OPMAP")
print("=" * 80)
print(f"Fecha: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print()

# 1. Estado de la tabla hospital_kam_distances
print("📍 TABLA hospital_kam_distances:")
print("-" * 40)

total_distances = supabase.table('hospital_kam_distances').select('id', count='exact').execute()
print(f"Total de registros: {total_distances.count:,}")

# Obtener todos los registros para análisis
all_distances = []
offset = 0
while True:
    batch = supabase.table('hospital_kam_distances').select('*').range(offset, offset + 999).execute()
    if not batch.data:
        break
    all_distances.extend(batch.data)
    offset += 1000
    if len(batch.data) < 1000:
        break

# Análisis por fuente
sources = {}
for d in all_distances:
    source = d.get('source', 'unknown')
    if source not in sources:
        sources[source] = 0
    sources[source] += 1

print("\nDistribución por fuente:")
for source, count in sorted(sources.items(), key=lambda x: x[1], reverse=True):
    print(f"  - {source}: {count:,} ({count*100/len(all_distances):.1f}%)")

# Análisis de tiempos
travel_times = [d['travel_time'] for d in all_distances if d.get('travel_time')]
if travel_times:
    print(f"\nEstadísticas de tiempos de viaje:")
    print(f"  - Mínimo: {min(travel_times)} minutos")
    print(f"  - Máximo: {max(travel_times)} minutos")
    print(f"  - Promedio: {sum(travel_times)/len(travel_times):.1f} minutos")
    
    # Distribución
    under_60 = sum(1 for t in travel_times if t <= 60)
    under_120 = sum(1 for t in travel_times if 60 < t <= 120)
    under_240 = sum(1 for t in travel_times if 120 < t <= 240)
    over_240 = sum(1 for t in travel_times if t > 240)
    
    print(f"\nDistribución de tiempos:")
    print(f"  - 0-60 min: {under_60:,} ({under_60*100/len(travel_times):.1f}%)")
    print(f"  - 61-120 min: {under_120:,} ({under_120*100/len(travel_times):.1f}%)")
    print(f"  - 121-240 min: {under_240:,} ({under_240*100/len(travel_times):.1f}%)")
    print(f"  - >240 min: {over_240:,} ({over_240*100/len(travel_times):.1f}%)")

# 2. Cobertura de hospitales
print("\n📍 COBERTURA DE HOSPITALES:")
print("-" * 40)

# Hospitales activos
hospitals = supabase.table('hospitals').select('*').eq('active', True).execute()
total_hospitals = len(hospitals.data)

# Hospitales con distancias
hospitals_with_distances = set(d['hospital_id'] for d in all_distances)
hospitals_covered = len(hospitals_with_distances)

print(f"Total hospitales activos: {total_hospitals}")
print(f"Hospitales con distancias: {hospitals_covered} ({hospitals_covered*100/total_hospitals:.1f}%)")
print(f"Hospitales sin distancias: {total_hospitals - hospitals_covered}")

# Por departamento (excluidos)
excluded_depts = supabase.table('departments').select('code').eq('excluded', True).execute()
excluded_set = set(d['code'] for d in excluded_depts.data)

hospitals_excluded = [h for h in hospitals.data if h['department_id'] in excluded_set]
hospitals_not_excluded = [h for h in hospitals.data if h['department_id'] not in excluded_set]

print(f"\nHospitales en departamentos excluidos: {len(hospitals_excluded)}")
print(f"Hospitales en departamentos NO excluidos: {len(hospitals_not_excluded)}")

# Cobertura en departamentos no excluidos
hospitals_not_excluded_ids = set(h['id'] for h in hospitals_not_excluded)
covered_not_excluded = hospitals_not_excluded_ids.intersection(hospitals_with_distances)
coverage_not_excluded = len(covered_not_excluded) * 100 / len(hospitals_not_excluded) if hospitals_not_excluded else 0

print(f"\nCobertura en departamentos NO excluidos:")
print(f"  {len(covered_not_excluded)}/{len(hospitals_not_excluded)} ({coverage_not_excluded:.1f}%)")

# 3. Cobertura por KAM
print("\n📍 COBERTURA POR KAM:")
print("-" * 40)

kams = supabase.table('kams').select('*').eq('active', True).execute()
kam_coverage = {}

for d in all_distances:
    kam_id = d['kam_id']
    if kam_id not in kam_coverage:
        kam_coverage[kam_id] = set()
    kam_coverage[kam_id].add(d['hospital_id'])

# Obtener nombres de KAMs
kam_names = {k['id']: k['name'] for k in kams.data}

print("Hospitales con distancia por KAM:")
for kam_id, hospitals_set in sorted(kam_coverage.items(), key=lambda x: len(x[1]), reverse=True):
    kam_name = kam_names.get(kam_id, 'Unknown')
    print(f"  - {kam_name}: {len(hospitals_set)} hospitales")

# KAMs sin distancias
kams_without_distances = [k for k in kams.data if k['id'] not in kam_coverage]
if kams_without_distances:
    print(f"\n⚠️ KAMs sin ninguna distancia calculada:")
    for kam in kams_without_distances:
        print(f"  - {kam['name']}")

# 4. Análisis de duplicados
print("\n📍 ANÁLISIS DE DUPLICADOS:")
print("-" * 40)

pairs = {}
for d in all_distances:
    key = (d['hospital_id'], d['kam_id'])
    if key not in pairs:
        pairs[key] = []
    pairs[key].append(d)

duplicates = {k: v for k, v in pairs.items() if len(v) > 1}
if duplicates:
    print(f"⚠️ Pares con duplicados: {len(duplicates)}")
    total_extra = sum(len(v) - 1 for v in duplicates.values())
    print(f"   Registros duplicados extras: {total_extra}")
else:
    print("✅ No hay duplicados detectados")

# 5. Hospitales críticos sin distancias
print("\n📍 HOSPITALES CRÍTICOS SIN DISTANCIAS:")
print("-" * 40)

hospitals_without_distances = [h for h in hospitals_not_excluded if h['id'] not in hospitals_with_distances]

if hospitals_without_distances:
    # Agrupar por departamento
    by_dept = {}
    for h in hospitals_without_distances:
        dept = h['department_name']
        if dept not in by_dept:
            by_dept[dept] = []
        by_dept[dept].append(h)
    
    # Top 5 departamentos con más hospitales sin distancias
    top_depts = sorted(by_dept.items(), key=lambda x: len(x[1]), reverse=True)[:5]
    
    for dept, hosps in top_depts:
        print(f"\n{dept}: {len(hosps)} hospitales sin distancias")
        # Mostrar primeros 3
        for h in hosps[:3]:
            print(f"  - {h['name']} ({h['municipality_name']})")
            print(f"    Código: {h['code']}, Camas: {h.get('beds', 0)}")
else:
    print("✅ Todos los hospitales tienen al menos una distancia calculada")

# 6. Recomendaciones
print("\n📍 EVALUACIÓN Y RECOMENDACIONES:")
print("-" * 40)

if coverage_not_excluded >= 95:
    print("✅ EXCELENTE: Cobertura superior al 95% en departamentos activos")
    print("   El algoritmo OpMap puede ejecutarse con alta precisión")
elif coverage_not_excluded >= 80:
    print("⚠️ BUENA: Cobertura entre 80-95% en departamentos activos")
    print("   El algoritmo funcionará bien pero algunos hospitales no serán asignados")
elif coverage_not_excluded >= 60:
    print("⚠️ REGULAR: Cobertura entre 60-80% en departamentos activos")
    print("   El algoritmo tendrá limitaciones significativas")
else:
    print("❌ INSUFICIENTE: Cobertura menor al 60% en departamentos activos")
    print("   Se requieren más cálculos de distancias para que el algoritmo funcione")

if hospitals_without_distances:
    print(f"\nAcciones recomendadas:")
    print(f"1. Calcular distancias para {len(hospitals_without_distances)} hospitales restantes")
    
    # Estimar rutas necesarias
    avg_kams_per_hospital = len(all_distances) / hospitals_covered if hospitals_covered > 0 else 8
    estimated_routes = int(len(hospitals_without_distances) * avg_kams_per_hospital)
    estimated_cost = estimated_routes * 0.005
    
    print(f"   - Rutas estimadas: {estimated_routes:,}")
    print(f"   - Costo estimado: ${estimated_cost:.2f} USD")
    print(f"   - Tiempo estimado: {estimated_routes * 0.3 / 60:.1f} minutos")

# 7. Guardar reporte
report_file = f"/Users/yeison/Documents/GitHub/OpMap/output/final_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
with open(report_file, 'w') as f:
    # Redirigir toda la salida al archivo
    import sys
    original_stdout = sys.stdout
    sys.stdout = f
    
    # Repetir todo el reporte
    print("=" * 80)
    print("📊 REPORTE FINAL DE DISTANCIAS - OPMAP")
    print("=" * 80)
    print(f"Fecha: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    print(f"Total distancias: {len(all_distances):,}")
    print(f"Hospitales cubiertos: {hospitals_covered}/{total_hospitals} ({hospitals_covered*100/total_hospitals:.1f}%)")
    print(f"Cobertura en departamentos activos: {coverage_not_excluded:.1f}%")
    
    sys.stdout = original_stdout

print(f"\n📄 Reporte guardado en: {report_file}")
print("=" * 80)