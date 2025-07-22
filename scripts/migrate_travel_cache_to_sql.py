#!/usr/bin/env python3
"""
Migra el caché de tiempos de viaje de Google Maps a SQL para Supabase
"""

import json
from datetime import datetime

def convert_cache_to_sql():
    """Convierte el caché JSON a SQL inserts"""
    
    # Cargar el caché
    with open('../data/cache/google_distance_matrix_cache.json', 'r') as f:
        cache = json.load(f)
    
    print(f"📊 Total de rutas en caché: {len(cache)}")
    
    inserts = []
    
    for key, travel_time_minutes in cache.items():
        # Parsear la clave: "lat1,lng1|lat2,lng2"
        parts = key.split('|')
        origin = parts[0].split(',')
        dest = parts[1].split(',')
        
        origin_lat = float(origin[0])
        origin_lng = float(origin[1])
        dest_lat = float(dest[0])
        dest_lng = float(dest[1])
        
        # Calcular distancia aproximada (para referencia)
        # Usando la fórmula de Haversine simplificada
        import math
        R = 6371  # Radio de la Tierra en km
        dLat = math.radians(dest_lat - origin_lat)
        dLon = math.radians(dest_lng - origin_lng)
        a = math.sin(dLat/2)**2 + math.cos(math.radians(origin_lat)) * math.cos(math.radians(dest_lat)) * math.sin(dLon/2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        distance = R * c
        
        # Saltar si no hay tiempo válido
        if travel_time_minutes is None:
            continue
            
        travel_time = int(travel_time_minutes)
        
        insert = f"""INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
({origin_lat}, {origin_lng}, {dest_lat}, {dest_lng}, {travel_time}, {distance:.2f}, 'google_maps');"""
        
        inserts.append(insert)
    
    # Generar el archivo SQL
    sql_content = f"""-- Script de migración del caché de tiempos de viaje
-- Generado el {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
-- Total de rutas: {len(cache)}
-- Fuente: Google Distance Matrix API

-- Limpiar caché existente de Google Maps (opcional)
-- DELETE FROM travel_time_cache WHERE source = 'google_maps';

-- Insertar tiempos de viaje calculados
{chr(10).join(inserts)}

-- Verificar resultados
-- SELECT COUNT(*) as total_routes FROM travel_time_cache WHERE source = 'google_maps';
-- SELECT 
--   AVG(travel_time) as avg_time_minutes,
--   MIN(travel_time) as min_time_minutes,
--   MAX(travel_time) as max_time_minutes,
--   AVG(distance) as avg_distance_km
-- FROM travel_time_cache 
-- WHERE source = 'google_maps';
"""
    
    # Guardar el archivo
    output_path = '../database/travel_time_cache.sql'
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(sql_content)
    
    print(f"✅ Script SQL generado: {output_path}")
    print(f"📈 Estadísticas:")
    print(f"   - Total rutas en caché: {len(cache)}")
    print(f"   - Rutas válidas exportadas: {len(inserts)}")
    
    # Calcular estadísticas solo de valores válidos
    valid_times = [v for v in cache.values() if v is not None]
    if valid_times:
        print(f"   - Tiempo promedio: {sum(valid_times) / len(valid_times):.1f} minutos")
        print(f"   - Tiempo mínimo: {min(valid_times):.1f} minutos")
        print(f"   - Tiempo máximo: {max(valid_times):.1f} minutos")
    
    return output_path

def check_what_else_needed():
    """Verifica qué más datos necesitamos para el algoritmo"""
    
    print("\n🔍 Verificando otros datos necesarios para el algoritmo:")
    
    # 1. Sellers (KAMs) - Ya migrado
    print("✅ KAMs (sellers.json) - Ya incluido en migration")
    
    # 2. Hospitals - Ya migrado
    print("✅ Hospitales (hospitals.psv) - Ya incluido en migration")
    
    # 3. Adjacency Matrix - Ya migrado
    print("✅ Matriz de adyacencia - Ya incluido en migration")
    
    # 4. Excluded departments - Ya migrado
    print("✅ Departamentos excluidos - Ya incluido en migration")
    
    # 5. Travel time cache - Este script
    print("⏳ Caché de tiempos de viaje - Generando ahora...")
    
    # 6. Localities para Bogotá
    try:
        with open('../data/psv/localities.psv', 'r') as f:
            lines = len(f.readlines()) - 1  # Menos el header
            print(f"📍 Localidades: {lines} encontradas (importante para lógica de Bogotá)")
            print("   ⚠️  Las localidades ya están en la columna locality_id de hospitals")
    except:
        print("❌ No se encontró archivo de localidades")

if __name__ == "__main__":
    # Generar SQL del caché
    output = convert_cache_to_sql()
    
    # Verificar qué más necesitamos
    check_what_else_needed()
    
    print("\n🚀 Próximo paso: Ejecutar travel_time_cache.sql en Supabase")