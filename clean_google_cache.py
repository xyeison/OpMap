#!/usr/bin/env python3
"""
Script para limpiar el caché de Google Maps eliminando cálculos Haversine
Solo mantiene tiempos reales de Google Maps
"""

import json
import math
from datetime import datetime

def haversine_time_estimate(lat1, lon1, lat2, lon2):
    """Calcula el tiempo estimado basado en distancia Haversine"""
    R = 6371  # Radio de la Tierra en km
    
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    
    a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    distance = R * c
    
    # Estimación: 60 km/h promedio
    return (distance / 60) * 60

def main():
    print("🧹 Limpiando caché de Google Maps...")
    print("="*70)
    
    # Cargar caché actual
    with open('data/cache/google_distance_matrix_cache.json', 'r') as f:
        cache = json.load(f)
    
    print(f"Total de entradas originales: {len(cache)}")
    
    # Hacer backup antes de limpiar
    backup_file = f'data/cache/google_distance_matrix_cache_backup_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'
    with open(backup_file, 'w') as f:
        json.dump(cache, f, indent=2)
    print(f"✓ Backup creado: {backup_file}")
    
    # Filtrar entradas
    cleaned_cache = {}
    removed_entries = []
    
    for key, time in cache.items():
        if time is None:
            # Mantener entradas None (sin ruta)
            cleaned_cache[key] = time
        else:
            # Extraer coordenadas
            try:
                parts = key.split('|')
                origin = parts[0].split(',')
                dest = parts[1].split(',')
                
                lat1, lon1 = float(origin[0]), float(origin[1])
                lat2, lon2 = float(dest[0]), float(dest[1])
                
                # Calcular tiempo Haversine
                haversine_time = haversine_time_estimate(lat1, lon1, lat2, lon2)
                
                # Comparar con el tiempo en caché
                diff_percent = abs(time - haversine_time) / haversine_time * 100
                
                # Si la diferencia es mayor al 10%, es probable que sea tiempo real de Google
                # Usamos 10% como margen de seguridad (más conservador que 5%)
                if diff_percent > 10:
                    cleaned_cache[key] = time
                else:
                    removed_entries.append({
                        'key': key,
                        'time': time,
                        'haversine_time': haversine_time,
                        'diff_percent': diff_percent
                    })
            except:
                # Si hay algún error, mantener la entrada por seguridad
                cleaned_cache[key] = time
    
    print(f"\nEntradas eliminadas (probables cálculos Haversine): {len(removed_entries)}")
    print(f"Entradas mantenidas: {len(cleaned_cache)}")
    
    # Mostrar algunas entradas eliminadas
    if removed_entries:
        print("\nEjemplos de entradas eliminadas:")
        for entry in removed_entries[:5]:
            print(f"  - {entry['key']}")
            print(f"    Tiempo caché: {entry['time']:.1f} min, Haversine: {entry['haversine_time']:.1f} min (diff: {entry['diff_percent']:.1f}%)")
    
    # Guardar caché limpio
    with open('data/cache/google_distance_matrix_cache.json', 'w') as f:
        json.dump(cleaned_cache, f, indent=2)
    
    print(f"\n✅ Caché limpiado y guardado")
    print(f"   - Entradas originales: {len(cache)}")
    print(f"   - Entradas después de limpieza: {len(cleaned_cache)}")
    print(f"   - Entradas eliminadas: {len(removed_entries)}")

if __name__ == "__main__":
    main()