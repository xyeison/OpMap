#!/usr/bin/env python3
"""
Calcular exactamente qué rutas necesitamos para que el algoritmo OpMap funcione correctamente
según las reglas descritas:
1. Excluir departamentos marcados como excluidos
2. Hospitales en municipios con KAM = territorio base (no necesitan cálculo)
3. Resto entra en competencia según adjacency_matrix y enable_level2
4. Respetar max_travel_time de cada KAM
5. Usar hospital_kam_distances primero, luego travel_time_cache
"""
from supabase import create_client
import json
from datetime import datetime

supabase_url = 'https://norvxqgohddgsdkggqzq.supabase.co'
supabase_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vcnZ4cWdvaGRkZ3Nka2dncXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMDExMjUsImV4cCI6MjA2ODc3NzEyNX0.BRWIYeD_5OlpVKIrP1QzUmkSx6HEVGzcEUUiSK8CmJs'

supabase = create_client(supabase_url, supabase_key)

print("🔍 CALCULANDO RUTAS NECESARIAS PARA ALGORITMO OPMAP")
print("="*60)

# 1. Cargar configuración del sistema
print("\n📥 Cargando configuración...")

# Departamentos excluidos
excluded_depts = supabase.table('departments').select('code').eq('excluded', True).execute()
excluded_set = set(d['code'] for d in excluded_depts.data)
print(f"   Departamentos excluidos: {len(excluded_set)}")

# KAMs activos con su configuración
kams = supabase.table('kams').select('*').eq('active', True).execute()
print(f"   KAMs activos: {len(kams.data)}")

# Matriz de adyacencia
adjacency = supabase.table('department_adjacency').select('*').execute()
adj_matrix = {}
for row in adjacency.data:
    dept = row['department_code']
    if dept not in adj_matrix:
        adj_matrix[dept] = set()
    adj_matrix[dept].add(row['adjacent_department_code'])

# Hospitales activos
hospitals = supabase.table('hospitals').select('*').eq('active', True).execute()
print(f"   Hospitales activos: {len(hospitals.data)}")

# Distancias ya calculadas
existing_distances = supabase.table('hospital_kam_distances').select('hospital_id, kam_id').execute()
existing_pairs = set((d['hospital_id'], d['kam_id']) for d in existing_distances.data)
print(f"   Distancias existentes: {len(existing_pairs)}")

# 2. Clasificar hospitales según las reglas
print("\n📊 APLICANDO REGLAS DEL ALGORITMO...")

# Índices de KAMs
kams_by_area = {}  # municipio/localidad -> KAM
kams_bogota = []   # KAMs en localidades de Bogotá

for kam in kams.data:
    area_id = kam['area_id']
    kams_by_area[area_id] = kam
    
    # KAMs de Bogotá (localidades que empiezan con 11001)
    if area_id.startswith('11001') and len(area_id) > 5:
        kams_bogota.append(kam)

print(f"\n   KAMs en Bogotá: {len(kams_bogota)}")
print(f"   KAMs con territorio base: {len(kams_by_area)}")

# Clasificar hospitales
territorio_base = []  # Hospitales en territorio base (no necesitan cálculo)
competencia = []      # Hospitales que entran en competencia

hospitales_excluidos = 0

for hospital in hospitals.data:
    # REGLA 1: Excluir departamentos marcados
    if hospital['department_id'] in excluded_set:
        hospitales_excluidos += 1
        continue
    
    h_mun = hospital['municipality_id']
    h_locality = hospital.get('locality_id')
    
    # REGLA 2: Hospitales en municipios/localidades con KAM = territorio base
    is_territorio_base = False
    
    # Verificar si hay KAM en esta localidad (Bogotá)
    if h_locality and h_locality in kams_by_area:
        territorio_base.append({
            'hospital': hospital,
            'kam': kams_by_area[h_locality]
        })
        is_territorio_base = True
    # Verificar si hay KAM en este municipio
    elif h_mun in kams_by_area:
        territorio_base.append({
            'hospital': hospital,
            'kam': kams_by_area[h_mun]
        })
        is_territorio_base = True
    # Verificar con código de 5 dígitos
    elif h_mun[:5] in kams_by_area:
        territorio_base.append({
            'hospital': hospital,
            'kam': kams_by_area[h_mun[:5]]
        })
        is_territorio_base = True
    
    if not is_territorio_base:
        competencia.append(hospital)

print(f"\n📊 CLASIFICACIÓN DE HOSPITALES:")
print(f"   Excluidos (depto excluido): {hospitales_excluidos}")
print(f"   Territorio base (automático): {len(territorio_base)}")
print(f"   En competencia: {len(competencia)}")
print(f"   TOTAL: {hospitales_excluidos + len(territorio_base) + len(competencia)}")

# 3. Calcular rutas necesarias para hospitales en competencia
print("\n🎯 CALCULANDO RUTAS NECESARIAS...")

def get_competing_kams(hospital, all_kams, adj_matrix):
    """
    Determina qué KAMs pueden competir por un hospital según:
    - Departamento propio y adyacentes (nivel 1)
    - Si enable_level2: también adyacentes de adyacentes (nivel 2)
    - Reglas especiales para Bogotá
    """
    h_dept = hospital['department_id']
    h_locality = hospital.get('locality_id')
    competing = []
    
    # CASO ESPECIAL: Bogotá
    if h_dept == '11' and h_locality:
        # En Bogotá compiten todos los KAMs de Bogotá
        for kam in all_kams:
            if kam['area_id'].startswith('11001'):
                competing.append(kam)
    else:
        # CASO GENERAL
        for kam in all_kams:
            kam_dept = kam['area_id'][:2]
            
            # Mismo departamento
            if kam_dept == h_dept:
                competing.append(kam)
                continue
            
            # Nivel 1: departamento adyacente
            if h_dept in adj_matrix and kam_dept in adj_matrix[h_dept]:
                competing.append(kam)
                continue
            
            # Nivel 2: si enable_level2 está activado
            if kam.get('enable_level2', False):
                if h_dept in adj_matrix:
                    for adj1 in adj_matrix[h_dept]:
                        if adj1 in adj_matrix and kam_dept in adj_matrix[adj1]:
                            competing.append(kam)
                            break
    
    return competing

routes_needed = []
routes_needed_set = set()

# Para cada hospital en competencia
for hospital in competencia:
    competing_kams = get_competing_kams(hospital, kams.data, adj_matrix)
    
    for kam in competing_kams:
        route_key = (hospital['id'], kam['id'])
        if route_key not in routes_needed_set:
            routes_needed_set.add(route_key)
            routes_needed.append({
                'hospital_id': hospital['id'],
                'hospital_name': hospital['name'],
                'hospital_municipality': hospital['municipality_name'],
                'hospital_department': hospital['department_name'],
                'hospital_lat': hospital['lat'],
                'hospital_lng': hospital['lng'],
                'kam_id': kam['id'],
                'kam_name': kam['name'],
                'kam_max_time': kam.get('max_travel_time', 240),
                'kam_lat': kam['lat'],
                'kam_lng': kam['lng']
            })

print(f"\n   Rutas necesarias totales: {len(routes_needed)}")

# 4. Verificar cuáles ya existen
routes_missing = []
routes_existing = []

for route in routes_needed:
    pair = (route['hospital_id'], route['kam_id'])
    if pair in existing_pairs:
        routes_existing.append(route)
    else:
        routes_missing.append(route)

print(f"   ✅ Ya calculadas: {len(routes_existing)}")
print(f"   ❌ Faltantes: {len(routes_missing)}")

# 5. Análisis de rutas faltantes
print("\n📊 ANÁLISIS DE RUTAS FALTANTES:")

# Por KAM
kam_missing = {}
for route in routes_missing:
    kam_name = route['kam_name']
    if kam_name not in kam_missing:
        kam_missing[kam_name] = 0
    kam_missing[kam_name] += 1

print("\n   Rutas faltantes por KAM:")
for kam, count in sorted(kam_missing.items(), key=lambda x: x[1], reverse=True):
    print(f"      {kam}: {count}")

# Por departamento
dept_missing = {}
for route in routes_missing:
    dept = route['hospital_department']
    if dept not in dept_missing:
        dept_missing[dept] = 0
    dept_missing[dept] += 1

print("\n   Rutas faltantes por departamento:")
for dept, count in sorted(dept_missing.items(), key=lambda x: x[1], reverse=True)[:10]:
    print(f"      {dept}: {count}")

# 6. Identificar hospitales críticos (sin ninguna ruta)
print("\n⚠️ HOSPITALES CRÍTICOS:")

hospital_route_count = {}
for route in routes_existing:
    h_id = route['hospital_id']
    if h_id not in hospital_route_count:
        hospital_route_count[h_id] = 0
    hospital_route_count[h_id] += 1

hospitals_sin_rutas = []
for hospital in competencia:
    if hospital['id'] not in hospital_route_count:
        hospitals_sin_rutas.append(hospital)

print(f"   Hospitales en competencia sin NINGUNA ruta: {len(hospitals_sin_rutas)}")

if hospitals_sin_rutas[:5]:
    print("\n   Primeros 5:")
    for h in hospitals_sin_rutas[:5]:
        print(f"      - {h['name']} ({h['municipality_name']}, {h['department_name']})")

# 7. Crear archivo SQL para calcular rutas faltantes
print("\n💾 Generando script SQL para búsqueda en travel_time_cache...")

sql_content = """-- Buscar rutas faltantes en travel_time_cache
-- Generado: """ + datetime.now().isoformat() + """

-- Total rutas necesarias: """ + str(len(routes_missing)) + """

-- Crear tabla temporal con las rutas necesarias
CREATE TEMP TABLE IF NOT EXISTS routes_needed (
    hospital_id UUID,
    hospital_lat NUMERIC,
    hospital_lng NUMERIC,
    kam_id UUID,
    kam_lat NUMERIC,
    kam_lng NUMERIC
);

-- Insertar rutas necesarias (primeras 100 como ejemplo)
INSERT INTO routes_needed VALUES
"""

for i, route in enumerate(routes_missing[:100]):
    sql_content += f"\n('{route['hospital_id']}', {route['hospital_lat']}, {route['hospital_lng']}, "
    sql_content += f"'{route['kam_id']}', {route['kam_lat']}, {route['kam_lng']}'){', ' if i < 99 else ';'}"

sql_content += """

-- Buscar coincidencias en travel_time_cache
WITH matches AS (
    SELECT 
        rn.hospital_id,
        rn.kam_id,
        ttc.travel_time,
        ttc.distance,
        ttc.source
    FROM routes_needed rn
    INNER JOIN travel_time_cache ttc ON
        ABS(ttc.origin_lat - rn.kam_lat) < 0.001 AND
        ABS(ttc.origin_lng - rn.kam_lng) < 0.001 AND
        ABS(ttc.dest_lat - rn.hospital_lat) < 0.001 AND
        ABS(ttc.dest_lng - rn.hospital_lng) < 0.001
    WHERE ttc.source = 'google_maps'
)
SELECT COUNT(*) as rutas_encontradas FROM matches;

-- Insertar las encontradas en hospital_kam_distances
INSERT INTO hospital_kam_distances (hospital_id, kam_id, travel_time, distance, source)
SELECT 
    hospital_id,
    kam_id,
    travel_time,
    distance,
    source
FROM matches
ON CONFLICT (hospital_id, kam_id) DO NOTHING;
"""

with open('/Users/yeison/Documents/GitHub/OpMap/database/03_maintenance/find_missing_routes_in_cache.sql', 'w') as f:
    f.write(sql_content)

print("   ✅ Archivo SQL guardado: database/03_maintenance/find_missing_routes_in_cache.sql")

# 8. Guardar análisis completo
analysis = {
    'timestamp': datetime.now().isoformat(),
    'summary': {
        'hospitales_excluidos': hospitales_excluidos,
        'hospitales_territorio_base': len(territorio_base),
        'hospitales_en_competencia': len(competencia),
        'rutas_necesarias': len(routes_needed),
        'rutas_existentes': len(routes_existing),
        'rutas_faltantes': len(routes_missing),
        'hospitales_sin_rutas': len(hospitals_sin_rutas)
    },
    'faltantes_por_kam': kam_missing,
    'faltantes_por_departamento': dept_missing,
    'hospitales_criticos': [
        {
            'id': h['id'],
            'name': h['name'],
            'municipality': h['municipality_name'],
            'department': h['department_name']
        } for h in hospitals_sin_rutas[:20]
    ]
}

with open('/Users/yeison/Documents/GitHub/OpMap/output/algorithm_routes_analysis.json', 'w') as f:
    json.dump(analysis, f, indent=2)

# Guardar lista de rutas faltantes
with open('/Users/yeison/Documents/GitHub/OpMap/output/routes_to_calculate.json', 'w') as f:
    json.dump(routes_missing, f, indent=2)

print("\n📄 Archivos guardados:")
print("   - output/algorithm_routes_analysis.json")
print("   - output/routes_to_calculate.json")
print("   - database/03_maintenance/find_missing_routes_in_cache.sql")

# 9. Resumen final
print("\n" + "="*60)
print("📊 RESUMEN PARA EJECUTAR EL ALGORITMO")
print("="*60)
print(f"Hospitales totales: {len(hospitals.data)}")
print(f"  ├─ Excluidos: {hospitales_excluidos}")
print(f"  ├─ Territorio base (automático): {len(territorio_base)}")
print(f"  └─ En competencia: {len(competencia)}")
print()
print(f"Para los {len(competencia)} hospitales en competencia:")
print(f"  ├─ Rutas necesarias: {len(routes_needed)}")
print(f"  ├─ Ya calculadas: {len(routes_existing)}")
print(f"  └─ FALTAN: {len(routes_missing)}")
print()
print(f"⚠️ CRÍTICO: {len(hospitals_sin_rutas)} hospitales sin ninguna ruta")
print()
print(f"💰 Costo estimado: ${len(routes_missing) * 0.005:.2f} USD")
print("="*60)