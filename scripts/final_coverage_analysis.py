#!/usr/bin/env python3
"""
Análisis final de cobertura para el algoritmo OpMap
"""
from supabase import create_client

supabase_url = 'https://norvxqgohddgsdkggqzq.supabase.co'
supabase_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vcnZ4cWdvaGRkZ3Nka2dncXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMDExMjUsImV4cCI6MjA2ODc3NzEyNX0.BRWIYeD_5OlpVKIrP1QzUmkSx6HEVGzcEUUiSK8CmJs'

supabase = create_client(supabase_url, supabase_key)

print("📊 ANÁLISIS FINAL DE COBERTURA PARA ALGORITMO OPMAP")
print("="*60)

# 1. Obtener todos los hospitales activos
hospitals = supabase.table('hospitals').select('*').eq('active', True).execute()
print(f"\n📥 Hospitales activos: {len(hospitals.data)}")

# 2. Obtener todas las distancias
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

print(f"   Distancias totales: {len(all_distances)}")

# 3. Crear índice de distancias por hospital
distances_by_hospital = {}
for dist in all_distances:
    h_id = dist['hospital_id']
    if h_id not in distances_by_hospital:
        distances_by_hospital[h_id] = []
    distances_by_hospital[h_id].append(dist)

# 4. Clasificar hospitales
hospitals_sin_distancias = []
hospitals_con_pocas = []  # Menos de 5 distancias
hospitals_con_suficientes = []  # 5-10 distancias
hospitals_con_muchas = []  # Más de 10 distancias

for hospital in hospitals.data:
    h_id = hospital['id']
    num_distances = len(distances_by_hospital.get(h_id, []))
    
    if num_distances == 0:
        hospitals_sin_distancias.append(hospital)
    elif num_distances < 5:
        hospitals_con_pocas.append((hospital, num_distances))
    elif num_distances <= 10:
        hospitals_con_suficientes.append((hospital, num_distances))
    else:
        hospitals_con_muchas.append((hospital, num_distances))

print(f"\n📊 DISTRIBUCIÓN DE COBERTURA:")
print(f"   Sin distancias: {len(hospitals_sin_distancias)} hospitales")
print(f"   1-4 distancias: {len(hospitals_con_pocas)} hospitales")
print(f"   5-10 distancias: {len(hospitals_con_suficientes)} hospitales")
print(f"   11+ distancias: {len(hospitals_con_muchas)} hospitales")

# 5. Mostrar hospitales sin distancias
if hospitals_sin_distancias:
    print(f"\n❌ HOSPITALES SIN NINGUNA DISTANCIA ({len(hospitals_sin_distancias)}):")
    
    # Agrupar por departamento
    by_dept = {}
    for h in hospitals_sin_distancias:
        dept = h['department_name']
        if dept not in by_dept:
            by_dept[dept] = []
        by_dept[dept].append(h)
    
    for dept, hosps in sorted(by_dept.items(), key=lambda x: len(x[1]), reverse=True):
        print(f"\n   {dept} ({len(hosps)} hospitales):")
        for h in hosps[:3]:  # Primeros 3
            print(f"      - {h['name']} ({h['municipality_name']})")
            print(f"        Código: {h['code']}, Camas: {h.get('beds', 0)}")

# 6. Hospitales con pocas distancias (problemáticos)
if hospitals_con_pocas:
    print(f"\n⚠️ HOSPITALES CON POCAS DISTANCIAS (1-4):")
    print(f"   Total: {len(hospitals_con_pocas)} hospitales")
    
    # Mostrar algunos ejemplos
    for h, count in hospitals_con_pocas[:5]:
        print(f"\n   {h['name']} ({h['municipality_name']}, {h['department_name']})")
        print(f"      Distancias: {count}")
        
        # Ver a qué KAMs tiene distancia
        if h['id'] in distances_by_hospital:
            kams_ids = [d['kam_id'] for d in distances_by_hospital[h['id']]]
            kams_info = supabase.table('kams').select('name').in_('id', kams_ids).execute()
            kam_names = [k['name'] for k in kams_info.data]
            print(f"      KAMs: {', '.join(kam_names)}")

# 7. Análisis de KAMs
print(f"\n📊 ANÁLISIS POR KAM:")
kams = supabase.table('kams').select('*').eq('active', True).execute()

kam_coverage = {}
for dist in all_distances:
    kam_id = dist['kam_id']
    if kam_id not in kam_coverage:
        kam_coverage[kam_id] = set()
    kam_coverage[kam_id].add(dist['hospital_id'])

for kam in kams.data:
    hospitals_count = len(kam_coverage.get(kam['id'], set()))
    print(f"   {kam['name']}: {hospitals_count} hospitales con distancia")

# 8. Verificar si el algoritmo puede funcionar
print(f"\n🎯 EVALUACIÓN PARA EL ALGORITMO:")

# Hospitales que pueden ser asignados (tienen al menos 1 distancia)
can_be_assigned = len(hospitals.data) - len(hospitals_sin_distancias)
percentage = can_be_assigned * 100 / len(hospitals.data)

print(f"   Hospitales que PUEDEN ser asignados: {can_be_assigned}/{len(hospitals.data)} ({percentage:.1f}%)")
print(f"   Hospitales que NO pueden ser asignados: {len(hospitals_sin_distancias)}")

if percentage >= 95:
    print(f"\n   ✅ COBERTURA SUFICIENTE para ejecutar el algoritmo")
elif percentage >= 80:
    print(f"\n   ⚠️ COBERTURA PARCIAL - El algoritmo funcionará con limitaciones")
else:
    print(f"\n   ❌ COBERTURA INSUFICIENTE - El algoritmo tendrá problemas serios")

# 9. Recomendaciones
print(f"\n💡 RECOMENDACIONES:")
if hospitals_sin_distancias:
    print(f"   1. CRÍTICO: Calcular distancias para los {len(hospitals_sin_distancias)} hospitales sin rutas")
    
    # Estimar rutas necesarias (promedio 8 KAMs por hospital)
    estimated_routes = len(hospitals_sin_distancias) * 8
    estimated_cost = estimated_routes * 0.005
    print(f"      Rutas estimadas: {estimated_routes}")
    print(f"      Costo estimado: ${estimated_cost:.2f} USD")

if hospitals_con_pocas:
    print(f"\n   2. IMPORTANTE: Completar distancias para {len(hospitals_con_pocas)} hospitales con pocas rutas")
    print(f"      Estos hospitales tienen opciones limitadas si su KAM se desactiva")

print(f"\n   3. El algoritmo puede ejecutarse con {percentage:.1f}% de cobertura")

print("\n" + "="*60)