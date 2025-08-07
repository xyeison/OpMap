#!/usr/bin/env python3

import os
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
from supabase import create_client, Client
from src.algorithms.opmap_algorithm_bogota import BogotaOpMapAlgorithm
from src.utils.distance_calculator import DistanceCalculator
from src.visualizers.clean_map_visualizer import CleanMapVisualizer
from src.utils.google_maps_client import GoogleMapsClient
import json

# Cargar variables de entorno
load_dotenv()

# Inicializar Supabase
supabase_url = os.getenv('SUPABASE_URL')
supabase_key = os.getenv('SUPABASE_ANON_KEY')
google_api_key = os.getenv('GOOGLE_MAPS_API_KEY')

print("🚀 EJECUTANDO ALGORITMO COMPLETO CON CACHÉ EXISTENTE\n")

# Crear cliente de Google Maps que use Supabase como caché
google_client = GoogleMapsClient(google_api_key)

# Crear calculador que primero busca en Supabase
class SupabaseDistanceCalculator(DistanceCalculator):
    def __init__(self):
        super().__init__()
        self.supabase = create_client(supabase_url, supabase_key)
        self.google_client = google_client
        self.cache_hits = 0
        self.cache_misses = 0
        
    def calculate_time(self, origin, destination):
        # Primero buscar en Supabase
        try:
            result = self.supabase.table('travel_time_cache').select('travel_time').eq(
                'origin_lat', round(origin[0], 6)
            ).eq(
                'origin_lng', round(origin[1], 6)
            ).eq(
                'dest_lat', round(destination[0], 6)
            ).eq(
                'dest_lng', round(destination[1], 6)
            ).execute()
            
            if result.data:
                self.cache_hits += 1
                return result.data[0]['travel_time'] / 60  # convertir a minutos
        except:
            pass
        
        self.cache_misses += 1
        # No hacer llamadas a Google Maps, retornar infinito si no está en caché
        return float('inf')

# Configurar y ejecutar algoritmo
calculator = SupabaseDistanceCalculator()
algorithm = BogotaOpMapAlgorithm(distance_calculator=calculator)

print("📂 Cargando datos...")
assignments = algorithm.assign_hospitals()

print(f"\n✅ Asignaciones completadas")
print(f"📊 Estadísticas:")
print(f"   - Cache hits: {calculator.cache_hits}")
print(f"   - Cache misses: {calculator.cache_misses}")

# Guardar resultados
timestamp = "cache_only"
output_file = f"output/assignments_{timestamp}.json"

# Resumen por KAM
summary = {}
total_assigned = 0
for hospital_id, (kam_id, travel_time) in assignments.items():
    if kam_id not in summary:
        summary[kam_id] = {
            'count': 0,
            'kam_name': algorithm.kams[kam_id]['name'],
            'hospitals': []
        }
    summary[kam_id]['count'] += 1
    summary[kam_id]['hospitals'].append({
        'id': hospital_id,
        'name': algorithm.hospitals[hospital_id]['name'],
        'municipality': algorithm.hospitals[hospital_id]['municipalityName'],
        'travel_time': travel_time
    })
    total_assigned += 1

print(f"\n📊 RESUMEN DE ASIGNACIONES:")
print(f"Total hospitales asignados: {total_assigned} de {len(algorithm.hospitals)}")
print(f"\nPor KAM:")
for kam_id, data in sorted(summary.items(), key=lambda x: x[1]['count'], reverse=True):
    print(f"  {data['kam_name']}: {data['count']} hospitales")

# Verificar Girardot específicamente
print("\n🎯 VERIFICANDO GIRARDOT:")
girardot_hospitals = [h for h in algorithm.hospitals.values() if h['municipalityId'] == '25307']
for hospital in girardot_hospitals:
    if hospital['id'] in assignments:
        kam_id, time = assignments[hospital['id']]
        kam_name = algorithm.kams[kam_id]['name']
        print(f"  {hospital['name']} → {kam_name} ({time:.0f} min)")
    else:
        print(f"  {hospital['name']} → NO ASIGNADO")

# Guardar asignaciones en Supabase
print("\n💾 Guardando asignaciones en Supabase...")

# Primero limpiar asignaciones anteriores
supabase = create_client(supabase_url, supabase_key)
supabase.table('assignments').delete().neq('id', '00000000-0000-0000-0000-000000000000').execute()

# Preparar datos para insertar
assignments_to_insert = []
for hospital_id, (kam_id, travel_time) in assignments.items():
    # Buscar los IDs reales en Supabase
    hospital_result = supabase.table('hospitals').select('id').eq('code', hospital_id).execute()
    kam_result = supabase.table('kams').select('id').eq('name', algorithm.kams[kam_id]['name']).execute()
    
    if hospital_result.data and kam_result.data:
        assignments_to_insert.append({
            'hospital_id': hospital_result.data[0]['id'],
            'kam_id': kam_result.data[0]['id'],
            'travel_time': int(travel_time * 60) if travel_time != float('inf') else None,
            'assignment_type': 'automatic'
        })

# Insertar en lotes
batch_size = 100
for i in range(0, len(assignments_to_insert), batch_size):
    batch = assignments_to_insert[i:i+batch_size]
    supabase.table('assignments').insert(batch).execute()
    print(f"  Guardados {min(i+batch_size, len(assignments_to_insert))} de {len(assignments_to_insert)}")

print("\n✅ PROCESO COMPLETADO")
print(f"   Total asignaciones guardadas: {len(assignments_to_insert)}")