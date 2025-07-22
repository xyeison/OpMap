#!/usr/bin/env python3
"""
Continuar cálculos de Google Maps usando el caché existente
"""
import json
import time
import sys

# Cargar el caché
with open('data/cache/google_distance_matrix_cache.json', 'r') as f:
    cache = json.load(f)

print(f"✅ Rutas ya calculadas en caché: {len(cache)}")

# Contar cuántas son None (sin ruta)
sin_ruta = sum(1 for v in cache.values() if v is None)
con_ruta = sum(1 for v in cache.values() if v is not None)

print(f"   - Con ruta válida: {con_ruta}")
print(f"   - Sin ruta (None): {sin_ruta}")

# Ver algunas estadísticas de tiempos
tiempos = [v for v in cache.values() if v is not None]
if tiempos:
    print(f"\n📊 Estadísticas de tiempos:")
    print(f"   - Mínimo: {min(tiempos):.1f} minutos")
    print(f"   - Máximo: {max(tiempos):.1f} minutos")
    print(f"   - Promedio: {sum(tiempos)/len(tiempos):.1f} minutos")

# Ejecutar el algoritmo usando el caché existente
print("\n🚀 Ejecutando algoritmo con caché existente...")
print("   (sin hacer nuevas consultas a Google Maps)")

# Importar y ejecutar
from opmap_google_matrix import GoogleMapsOpMapAlgorithm, CleanMapVisualizer
from datetime import datetime
import os
import webbrowser

algorithm = GoogleMapsOpMapAlgorithm()

# Cargar datos
algorithm.load_data(
    'data/json/sellers.json',
    'data/psv/hospitals.psv',
    'data/json/adjacency_matrix.json'
)

# El caché ya está cargado, solo ejecutar asignación
print("\n🏃 Ejecutando asignación con tiempos reales...")
assignments = algorithm.run_assignment()

# Guardar resultados
timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
output_file = f'output/opmap_google_cached_{timestamp}.json'

output_data = {
    'metadata': {
        'timestamp': timestamp,
        'algorithm': 'GoogleMapsOpMapAlgorithm',
        'total_kams': len(algorithm.sellers),
        'total_ips': len(algorithm.hospitals),
        'cache_size': len(algorithm.cached_times),
        'used_cache': True
    },
    'assignments': assignments
}

os.makedirs('output', exist_ok=True)
with open(output_file, 'w', encoding='utf-8') as f:
    json.dump(output_data, f, ensure_ascii=False, indent=2)

print(f"\n✅ Resultados guardados en: {output_file}")

# Generar mapa
print("\n🗺️  Generando visualización del mapa...")
visualizer = CleanMapVisualizer()
map_file = f'output/opmap_google_cached_{timestamp}.html'
visualizer.create_map(assignments, map_file)

print(f"\n✅ Mapa guardado en: {map_file}")
print(f"📍 Abriendo mapa en el navegador...")

# Abrir en navegador
webbrowser.open(f"file://{os.path.abspath(map_file)}")