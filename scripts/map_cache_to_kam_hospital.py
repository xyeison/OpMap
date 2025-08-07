#!/usr/bin/env python3
"""
Mapear los 7000+ registros de travel_time_cache a relaciones KAM-Hospital claras
"""
from supabase import create_client
import json
from datetime import datetime

supabase_url = 'https://norvxqgohddgsdkggqzq.supabase.co'
supabase_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vcnZ4cWdvaGRkZ3Nka2dncXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMDExMjUsImV4cCI6MjA2ODc3NzEyNX0.BRWIYeD_5OlpVKIrP1QzUmkSx6HEVGzcEUUiSK8CmJs'

supabase = create_client(supabase_url, supabase_key)

print("🔍 Mapeando travel_time_cache a relaciones KAM → Hospital")
print("="*60)

# 1. Cargar todos los datos necesarios
print("\n📥 Cargando datos...")

# KAMs
kams = supabase.table('kams').select('*').execute()
print(f"   KAMs totales: {len(kams.data)}")

# Hospitales
hospitals = supabase.table('hospitals').select('*').execute()
print(f"   Hospitales totales: {len(hospitals.data)}")

# Travel time cache - obtener TODOS los registros (paginación)
print("   Cargando travel_time_cache...")
all_cache_data = []
offset = 0
batch_size = 1000

while True:
    batch = supabase.table('travel_time_cache').select('*').range(offset, offset + batch_size - 1).execute()
    if not batch.data:
        break
    all_cache_data.extend(batch.data)
    offset += batch_size
    print(f"      Cargados {len(all_cache_data)} registros...")
    if len(batch.data) < batch_size:
        break

cache_data = type('obj', (object,), {'data': all_cache_data})()
print(f"   Registros en caché: {len(cache_data.data)}")

# 2. Crear índices para búsqueda rápida
print("\n🔧 Creando índices de búsqueda...")

def find_kam_by_coords(lat, lng, kams_list, tolerance=0.0001):
    """Encontrar KAM por coordenadas con tolerancia"""
    for kam in kams_list:
        if (abs(float(kam['lat']) - float(lat)) < tolerance and 
            abs(float(kam['lng']) - float(lng)) < tolerance):
            return kam
    return None

def find_hospital_by_coords(lat, lng, hospitals_list, tolerance=0.0001):
    """Encontrar Hospital por coordenadas con tolerancia"""
    for hospital in hospitals_list:
        if (abs(float(hospital['lat']) - float(lat)) < tolerance and 
            abs(float(hospital['lng']) - float(lng)) < tolerance):
            return hospital
    return None

# 3. Mapear cada registro del caché
print("\n🗺️ Mapeando registros...")

mapped_routes = []
unmapped_origins = set()
unmapped_destinations = set()
stats = {
    'total': len(cache_data.data),
    'mapped': 0,
    'unmapped_origin': 0,
    'unmapped_dest': 0,
    'unmapped_both': 0,
    'by_source': {}
}

for i, cache_entry in enumerate(cache_data.data):
    if i % 500 == 0:
        print(f"   Procesando registro {i}/{len(cache_data.data)}...")
    
    origin_lat = cache_entry['origin_lat']
    origin_lng = cache_entry['origin_lng']
    dest_lat = cache_entry['dest_lat']
    dest_lng = cache_entry['dest_lng']
    
    # Buscar KAM origen
    kam = find_kam_by_coords(origin_lat, origin_lng, kams.data)
    
    # Buscar Hospital destino
    hospital = find_hospital_by_coords(dest_lat, dest_lng, hospitals.data)
    
    # Estadísticas por fuente
    source = cache_entry.get('source', 'unknown')
    if source not in stats['by_source']:
        stats['by_source'][source] = {'total': 0, 'mapped': 0}
    stats['by_source'][source]['total'] += 1
    
    # Clasificar el registro
    if kam and hospital:
        mapped_routes.append({
            'cache_id': cache_entry['id'],
            'kam_id': kam['id'],
            'kam_name': kam['name'],
            'kam_area': kam['area_id'],
            'hospital_id': hospital['id'],
            'hospital_code': hospital['code'],
            'hospital_name': hospital['name'],
            'hospital_municipality': hospital['municipality_name'],
            'hospital_department': hospital['department_name'],
            'travel_time': cache_entry['travel_time'],
            'distance': cache_entry.get('distance'),
            'source': source,
            'calculated_at': cache_entry.get('calculated_at')
        })
        stats['mapped'] += 1
        stats['by_source'][source]['mapped'] += 1
    elif kam and not hospital:
        unmapped_destinations.add((dest_lat, dest_lng))
        stats['unmapped_dest'] += 1
    elif not kam and hospital:
        unmapped_origins.add((origin_lat, origin_lng))
        stats['unmapped_origin'] += 1
    else:
        unmapped_origins.add((origin_lat, origin_lng))
        unmapped_destinations.add((dest_lat, dest_lng))
        stats['unmapped_both'] += 1

print(f"\n✅ Mapeo completado")

# 4. Mostrar estadísticas
print("\n📊 ESTADÍSTICAS DE MAPEO:")
print(f"   Total registros: {stats['total']}")
print(f"   ✅ Mapeados correctamente: {stats['mapped']} ({stats['mapped']*100/stats['total']:.1f}%)")
print(f"   ❌ Sin KAM origen: {stats['unmapped_origin']}")
print(f"   ❌ Sin Hospital destino: {stats['unmapped_dest']}")
print(f"   ❌ Sin ambos: {stats['unmapped_both']}")

print("\n📊 Por fuente de datos:")
for source, source_stats in stats['by_source'].items():
    print(f"   {source}: {source_stats['mapped']}/{source_stats['total']} mapeados")

# 5. Análisis de rutas mapeadas
print("\n📊 ANÁLISIS DE RUTAS MAPEADAS:")

# Agrupar por KAM
by_kam = {}
for route in mapped_routes:
    kam_name = route['kam_name']
    if kam_name not in by_kam:
        by_kam[kam_name] = {
            'hospitals': set(),
            'routes': []
        }
    by_kam[kam_name]['hospitals'].add(route['hospital_id'])
    by_kam[kam_name]['routes'].append(route)

print("\n   Rutas por KAM:")
for kam_name in sorted(by_kam.keys()):
    info = by_kam[kam_name]
    print(f"   {kam_name}: {len(info['routes'])} rutas a {len(info['hospitals'])} hospitales")

# Agrupar por tipo de ruta
google_routes = [r for r in mapped_routes if r['source'] == 'google_maps']
haversine_routes = [r for r in mapped_routes if r['source'] == 'haversine']

print(f"\n   Por tipo:")
print(f"   Google Maps: {len(google_routes)} rutas")
print(f"   Haversine: {len(haversine_routes)} rutas")

# 6. Identificar hospitales únicos con rutas
hospitals_with_routes = set()
for route in mapped_routes:
    hospitals_with_routes.add(route['hospital_id'])

print(f"\n   Hospitales únicos con rutas: {len(hospitals_with_routes)}")

# 7. Crear tabla resumen para base de datos
print("\n💾 Creando tabla de mapeo en base de datos...")

# Crear tabla si no existe
create_table_sql = """
CREATE TABLE IF NOT EXISTS cache_mapping (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cache_id UUID REFERENCES travel_time_cache(id),
    kam_id UUID REFERENCES kams(id),
    kam_name VARCHAR(255),
    hospital_id UUID REFERENCES hospitals(id),
    hospital_code VARCHAR(50),
    hospital_name TEXT,
    hospital_municipality VARCHAR(255),
    hospital_department VARCHAR(255),
    travel_time INTEGER,
    distance NUMERIC(10,2),
    source VARCHAR(50),
    calculated_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cache_mapping_kam ON cache_mapping(kam_id);
CREATE INDEX IF NOT EXISTS idx_cache_mapping_hospital ON cache_mapping(hospital_id);
CREATE INDEX IF NOT EXISTS idx_cache_mapping_source ON cache_mapping(source);
"""

# Nota: No podemos ejecutar DDL directamente, guardamos el SQL
with open('/Users/yeison/Documents/GitHub/OpMap/database/03_maintenance/create_cache_mapping.sql', 'w') as f:
    f.write(create_table_sql)
    f.write("\n\n-- Limpiar tabla existente\n")
    f.write("TRUNCATE TABLE cache_mapping CASCADE;\n\n")
    f.write("-- Insertar datos mapeados\n")
    f.write("INSERT INTO cache_mapping (cache_id, kam_id, kam_name, hospital_id, hospital_code, ")
    f.write("hospital_name, hospital_municipality, hospital_department, travel_time, distance, source, calculated_at) VALUES\n")
    
    for i, route in enumerate(mapped_routes[:100]):  # Primeros 100 para ejemplo
        values = (
            f"('{route['cache_id']}', '{route['kam_id']}', '{route['kam_name']}', "
            f"'{route['hospital_id']}', '{route['hospital_code']}', "
            f"'{route['hospital_name'].replace("'", "''")}', "
            f"'{route['hospital_municipality']}', '{route['hospital_department']}', "
            f"{route['travel_time']}, {route['distance'] or 'NULL'}, "
            f"'{route['source']}', "
            f"'{route['calculated_at'] if route['calculated_at'] else 'NOW()'}')"
        )
        if i < len(mapped_routes[:100]) - 1:
            f.write(values + ",\n")
        else:
            f.write(values + ";\n")

print("   SQL guardado en database/03_maintenance/create_cache_mapping.sql")

# 8. Guardar análisis completo en JSON
analysis = {
    'timestamp': datetime.now().isoformat(),
    'statistics': stats,
    'routes_by_kam': {
        kam: {
            'total_routes': len(info['routes']),
            'unique_hospitals': len(info['hospitals'])
        } for kam, info in by_kam.items()
    },
    'total_mapped_routes': len(mapped_routes),
    'unique_hospitals_with_routes': len(hospitals_with_routes),
    'unmapped_origins': len(unmapped_origins),
    'unmapped_destinations': len(unmapped_destinations)
}

# Guardar resumen
with open('/Users/yeison/Documents/GitHub/OpMap/output/cache_mapping_analysis.json', 'w') as f:
    json.dump(analysis, f, indent=2)

# Guardar todas las rutas mapeadas
with open('/Users/yeison/Documents/GitHub/OpMap/output/all_mapped_routes.json', 'w') as f:
    json.dump(mapped_routes, f, indent=2)

print("\n📄 Archivos guardados:")
print("   - output/cache_mapping_analysis.json (resumen)")
print("   - output/all_mapped_routes.json (todas las rutas)")
print("   - database/03_maintenance/create_cache_mapping.sql (SQL)")

# 9. Resumen final
print("\n" + "="*60)
print("📊 RESUMEN FINAL DEL MAPEO")
print("="*60)
print(f"Total registros en caché: {stats['total']}")
print(f"Rutas mapeadas exitosamente: {stats['mapped']}")
print(f"Hospitales únicos con rutas: {len(hospitals_with_routes)}")
print(f"KAMs con rutas: {len(by_kam)}")
print("\nPróximo paso: Comparar estas rutas con las necesarias")
print("="*60)