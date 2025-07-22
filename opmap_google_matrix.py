#!/usr/bin/env python3
"""
OpMap con Google Distance Matrix API
Calcula y guarda TODOS los tiempos de viaje para reutilización futura
"""

import json
import os
import csv
import math
import time
import folium
import requests
from typing import Dict, List, Set, Tuple
from collections import defaultdict
from datetime import datetime
import webbrowser

# Importar la clase de visualización del mapa
from opmap_bogota_complete import CleanMapVisualizer

# =====================================================
# CONFIGURACIÓN DE GOOGLE MAPS
# =====================================================

# Cargar API key desde archivo .env
def load_api_key():
    try:
        with open('.env', 'r') as f:
            for line in f:
                if line.startswith('GOOGLE_MAPS_API_KEY='):
                    return line.strip().split('=', 1)[1]
    except FileNotFoundError:
        return None
    return None

GOOGLE_MAPS_API_KEY = load_api_key()

# =====================================================
# ALGORITMO OPMAP CON GOOGLE DISTANCE MATRIX
# =====================================================

class GoogleMapsOpMapAlgorithm:
    """
    Algoritmo OpMap que usa Google Distance Matrix API
    y guarda todos los tiempos calculados para reutilización
    """
    
    def __init__(self):
        self.sellers = []
        self.hospitals = []
        self.adjacency_matrix = {}
        self.assignments = defaultdict(list)
        self.travel_times = {}
        self.bogota_kams = []
        self.locality_ips_count = defaultdict(lambda: defaultdict(int))
        self.cache_file = "data/cache/google_distance_matrix_cache.json"
        self.cached_times = {}
        
    def load_cache(self):
        """Carga tiempos de viaje previamente calculados"""
        if os.path.exists(self.cache_file):
            print("   📂 Cargando caché de tiempos de viaje...")
            with open(self.cache_file, 'r') as f:
                self.cached_times = json.load(f)
            print(f"   ✓ {len(self.cached_times)} rutas en caché")
        else:
            print("   ℹ️  No hay caché previo, se calcularán todas las rutas")
            self.cached_times = {}
    
    def save_cache(self):
        """Guarda todos los tiempos calculados"""
        os.makedirs(os.path.dirname(self.cache_file), exist_ok=True)
        with open(self.cache_file, 'w') as f:
            json.dump(self.cached_times, f, indent=2)
        print(f"   💾 Caché guardado: {len(self.cached_times)} rutas")
    
    def get_google_route_time(self, origin_lat, origin_lng, dest_lat, dest_lng):
        """
        Obtiene el tiempo de viaje usando Google Distance Matrix API
        """
        # Verificar caché primero
        cache_key = f"{origin_lat},{origin_lng}|{dest_lat},{dest_lng}"
        if cache_key in self.cached_times:
            return self.cached_times[cache_key]
        
        # Si no está en caché, consultar API
        base_url = "https://maps.googleapis.com/maps/api/distancematrix/json"
        
        params = {
            'origins': f"{origin_lat},{origin_lng}",
            'destinations': f"{dest_lat},{dest_lng}",
            'mode': 'driving',
            'units': 'metric',
            'key': GOOGLE_MAPS_API_KEY
        }
        
        try:
            response = requests.get(base_url, params=params, timeout=5)
            if response.status_code == 200:
                data = response.json()
                
                if data['status'] == 'OK':
                    element = data['rows'][0]['elements'][0]
                    
                    if element['status'] == 'OK':
                        # Tiempo en segundos, convertir a minutos
                        duration_seconds = element['duration']['value']
                        duration_minutes = duration_seconds / 60
                        
                        # Guardar en caché
                        self.cached_times[cache_key] = duration_minutes
                        
                        return duration_minutes
                    elif element['status'] == 'ZERO_RESULTS':
                        # No hay ruta - guardar como None
                        self.cached_times[cache_key] = None
                        return None
                else:
                    print(f"   ⚠️  Error API: {data.get('error_message', 'Unknown error')}")
                    return None
            else:
                print(f"   ⚠️  Error HTTP: {response.status_code}")
                print(f"   Response: {response.text[:200]}")
                return None
                
        except requests.exceptions.Timeout:
            print(f"   ⚠️  Timeout en consulta")
            return None
        except Exception as e:
            print(f"   ⚠️  Error de conexión: {str(e)}")
            return None
    
    def load_data(self, sellers_path: str, hospitals_path: str, adjacency_path: str):
        """Carga todos los datos necesarios"""
        # Cargar vendedores
        with open(sellers_path, 'r', encoding='utf-8') as f:
            self.sellers = json.load(f)
        
        # Identificar KAMs de Bogotá
        self.bogota_kams = [s['id'] for s in self.sellers if s['areaId'].startswith('11')]
        
        # Cargar hospitales
        self.hospitals = []
        excluded_depts = []
        
        # Cargar departamentos excluidos
        try:
            with open('data/json/excluded_departments.json', 'r') as f:
                excluded_depts = [str(d) for d in json.load(f)]
        except:
            excluded_depts = ['27', '97', '99', '88', '95', '94', '91']
        
        with open(hospitals_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f, delimiter='|')
            for row in reader:
                if row.get('departmentid') not in excluded_depts:
                    self.hospitals.append(row)
        
        # Cargar matriz de adyacencia
        with open(adjacency_path, 'r', encoding='utf-8') as f:
            self.adjacency_matrix = json.load(f)
            
        # Cargar caché de tiempos
        self.load_cache()
    
    def calculate_all_travel_times(self):
        """
        Calcula TODOS los tiempos de viaje posibles y los guarda
        """
        print("\n⏱️  Calculando tiempos de viaje con Google Distance Matrix...")
        print(f"   🔑 API Key configurada: {'Sí' if GOOGLE_MAPS_API_KEY else 'NO - CONFIGURAR PRIMERO'}")
        
        if not GOOGLE_MAPS_API_KEY:
            print("\n   ❌ ERROR: No se encontró la API key de Google Maps")
            print("   1. Verifica que existe el archivo .env")
            print("   2. Verifica que contiene GOOGLE_MAPS_API_KEY=tu_clave")
            return False
        
        # Calcular todos los pares KAM-Hospital posibles
        total_pairs = []
        
        for kam in self.sellers:
            dept_kam = kam['areaId'][:2]
            search_departments = {dept_kam}
            
            # Agregar departamentos limítrofes (Nivel 1)
            if dept_kam == '11':  # Bogotá
                search_departments.add('25')  # Cundinamarca
                if '25' in self.adjacency_matrix:
                    search_departments.update(self.adjacency_matrix['25'].get('closeDepartments', []))
            elif dept_kam in self.adjacency_matrix:
                search_departments.update(self.adjacency_matrix[dept_kam].get('closeDepartments', []))
            
            # Agregar Nivel 2 si está habilitado
            if kam.get('expansionConfig', {}).get('enableLevel2', False):
                level2_departments = set()
                for dept in list(search_departments):
                    if dept in self.adjacency_matrix:
                        level2_departments.update(self.adjacency_matrix[dept].get('closeDepartments', []))
                search_departments.update(level2_departments)
            
            # Encontrar hospitales candidatos
            for hospital in self.hospitals:
                # Excluir hospitales en el mismo municipio (territorio base)
                if hospital.get('municipalityid') == kam['areaId']:
                    continue
                if hospital.get('localityid') == kam['areaId']:
                    continue
                    
                if hospital.get('departmentid') in search_departments:
                    # Pre-filtro de distancia
                    kam_lat, kam_lng = float(kam['lat']), float(kam['lng'])
                    hosp_lat, hosp_lng = float(hospital['lat']), float(hospital['lng'])
                    
                    # Calcular distancia Haversine
                    distance = self.haversine_distance(kam_lat, kam_lng, hosp_lat, hosp_lng)
                    
                    # Solo considerar si está a menos de 300km
                    if distance <= 300:
                        total_pairs.append({
                            'kam': kam,
                            'hospital': hospital,
                            'distance': distance
                        })
        
        print(f"\n   📊 Total de rutas a calcular: {len(total_pairs)}")
        
        # Verificar cuántas ya están en caché
        new_calculations = 0
        for pair in total_pairs:
            cache_key = f"{pair['kam']['lat']},{pair['kam']['lng']}|{pair['hospital']['lat']},{pair['hospital']['lng']}"
            if cache_key not in self.cached_times:
                new_calculations += 1
        
        print(f"   ✓ Ya en caché: {len(total_pairs) - new_calculations}")
        print(f"   🆕 Nuevas consultas necesarias: {new_calculations}")
        
        if new_calculations > 0:
            print(f"   💰 Costo estimado: ${new_calculations * 0.005:.2f} USD")
            
            # Mostrar advertencia si hay muchas consultas nuevas
            if new_calculations > 100:
                print(f"\n   ⚠️  Se realizarán {new_calculations} consultas nuevas a Google Maps")
                print("   📝 Continuando automáticamente (modo no interactivo)")
            
            # Verificar límite máximo
            if new_calculations > 5000:
                print(f"\n   ❌ ERROR: Se necesitan {new_calculations} consultas, excede el límite de 5,000")
                return False
        
        # Calcular rutas
        calculated = 0
        errors = 0
        start_time = time.time()
        
        for i, pair in enumerate(total_pairs):
            kam = pair['kam']
            hospital = pair['hospital']
            
            # Calcular tiempo de viaje
            travel_time = self.get_google_route_time(
                kam['lat'], kam['lng'],
                hospital['lat'], hospital['lng']
            )
            
            if travel_time is None and self.cached_times.get(f"{kam['lat']},{kam['lng']}|{hospital['lat']},{hospital['lng']}") is None:
                errors += 1
            else:
                calculated += 1
            
            # Mostrar progreso
            if (i + 1) % 50 == 0 or (i + 1) == len(total_pairs):
                elapsed = time.time() - start_time
                rate = calculated / elapsed if elapsed > 0 else 0
                eta = (len(total_pairs) - i - 1) / rate if rate > 0 else 0
                
                print(f"   Progreso: {i + 1}/{len(total_pairs)} ({(i + 1)/len(total_pairs)*100:.1f}%) - "
                      f"Calculadas: {calculated}, Errores: {errors}, "
                      f"Velocidad: {rate:.1f}/s, ETA: {int(eta/60)}:{int(eta%60):02d}")
            
            # Guardar caché cada 100 consultas
            if (i + 1) % 100 == 0:
                self.save_cache()
            
            # Pequeña pausa para no sobrecargar la API
            if new_calculations > 0 and (i + 1) % 50 == 0:
                time.sleep(0.5)
        
        # Guardar caché final
        self.save_cache()
        
        elapsed_total = time.time() - start_time
        print(f"\n   ✅ Cálculo completado en {elapsed_total:.1f} segundos")
        print(f"   📊 Total calculadas: {calculated}")
        print(f"   ❌ Errores/Sin ruta: {errors}")
        
        return True
    
    def haversine_distance(self, lat1, lon1, lat2, lon2):
        """Calcula distancia en km entre dos coordenadas"""
        R = 6371  # Radio de la Tierra en km
        
        lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        
        a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        
        return R * c
    
    def run_assignment(self):
        """
        Ejecuta el algoritmo de asignación usando los tiempos calculados
        """
        print("\n🏃 Ejecutando algoritmo de asignación...")
        
        # 1. Asignar territorios base
        self.assign_base_territories()
        
        # 2. Asignación competitiva con lógica especial para Bogotá
        self.competitive_assignment()
        
        # 3. Estadísticas finales
        total_assigned = sum(len(ips) for ips in self.assignments.values())
        print(f"\n📊 Resumen de asignación:")
        print(f"   - Total IPS asignadas: {total_assigned}/{len(self.hospitals)}")
        
        for kam in self.sellers:
            kam_id = kam['id']
            ips_count = len(self.assignments.get(kam_id, []))
            print(f"   - {kam['name']}: {ips_count} IPS")
        
        return self.assignments
    
    def assign_base_territories(self):
        """Asigna automáticamente IPS en el mismo municipio/localidad del KAM"""
        print("\n🏠 Asignando territorios base...")
        
        for kam in self.sellers:
            kam_id = kam['id']
            area_id = kam['areaId']
            self.assignments[kam_id] = []
            
            # Asignar IPS del mismo municipio/localidad
            base_ips = 0
            for hospital in self.hospitals:
                if (hospital.get('municipalityid') == area_id or 
                    hospital.get('localityid') == area_id):
                    self.assignments[kam_id].append(hospital)
                    base_ips += 1
            
            print(f"   ✓ {kam['name']}: {base_ips} IPS en territorio base")
    
    def competitive_assignment(self):
        """Asignación competitiva con lógica especial para Bogotá"""
        print("\n🏆 Asignación competitiva con tiempos reales...")
        
        # Obtener IPS no asignadas
        assigned_ids = set()
        for kam_id, assigned_list in self.assignments.items():
            assigned_ids.update(h['id_register'] for h in assigned_list)
        
        bogota_unassigned = []
        other_unassigned = []
        
        for hospital in self.hospitals:
            if hospital['id_register'] not in assigned_ids:
                if hospital.get('municipalityid') == '11001':
                    bogota_unassigned.append(hospital)
                else:
                    other_unassigned.append(hospital)
        
        print(f"   ℹ️  {len(bogota_unassigned)} IPS no asignadas en Bogotá")
        print(f"   ℹ️  {len(other_unassigned)} IPS no asignadas fuera de Bogotá")
        
        conflicts = 0
        assigned_competitive = 0
        
        # Procesar IPS de Bogotá (solo compiten KAMs de Bogotá)
        bogota_assigned = self._process_bogota_ips(bogota_unassigned)
        assigned_competitive += bogota_assigned
        
        # Procesar IPS fuera de Bogotá
        for hospital in other_unassigned:
            candidates = []
            
            # Buscar en todos los KAMs posibles
            for kam in self.sellers:
                cache_key = f"{kam['lat']},{kam['lng']}|{hospital['lat']},{hospital['lng']}"
                
                if cache_key in self.cached_times:
                    travel_time = self.cached_times[cache_key]
                    
                    if travel_time is not None:
                        max_time = kam.get('expansionConfig', {}).get('maxTravelTime', 240)
                        
                        if travel_time <= max_time:
                            # Agregar prioridad como criterio de desempate
                            priority = kam.get('expansionConfig', {}).get('priority', 0)
                            candidates.append((kam['id'], travel_time, priority))
            
            if candidates:
                # Ordenar por tiempo y luego por prioridad (mayor prioridad gana)
                candidates.sort(key=lambda x: (x[1], -x[2]))
                winner_kam = candidates[0][0]
                self.assignments[winner_kam].append(hospital)
                assigned_competitive += 1
                
                if len(candidates) > 1:
                    conflicts += 1
        
        # Asignar localidades de Bogotá por mayoría
        self._assign_localities_by_majority()
        
        print(f"   ✓ {assigned_competitive} IPS asignadas competitivamente")
        print(f"   ✓ {conflicts} conflictos resueltos")
    
    def _process_bogota_ips(self, bogota_ips: List[Dict]) -> int:
        """Procesa las IPS de Bogotá, donde solo compiten los KAMs de Bogotá."""
        assigned = 0
        
        for hospital in bogota_ips:
            locality_id = hospital.get('localityid')
            if not locality_id:
                continue
            
            # Solo KAMs de Bogotá pueden competir
            candidates = []
            for kam_id in self.bogota_kams:
                kam = next((s for s in self.sellers if s['id'] == kam_id), None)
                if not kam:
                    continue
                
                cache_key = f"{kam['lat']},{kam['lng']}|{hospital['lat']},{hospital['lng']}"
                
                # Para IPS de Bogotá, primero intentar con tiempos reales
                if cache_key in self.cached_times and self.cached_times[cache_key] is not None:
                    travel_time = self.cached_times[cache_key]
                else:
                    # Si no hay tiempo real, usar distancia Haversine para Bogotá
                    distance = self.haversine_distance(
                        float(kam['lat']), float(kam['lng']),
                        float(hospital['lat']), float(hospital['lng'])
                    )
                    travel_time = (distance / 40) * 60  # 40 km/h en ciudad
                
                candidates.append((kam_id, travel_time))
            
            if candidates:
                candidates.sort(key=lambda x: x[1])
                winner_kam = candidates[0][0]
                
                # Registrar para mayoría
                self.locality_ips_count[locality_id][winner_kam] += 1
                self.assignments[winner_kam].append(hospital)
                assigned += 1
        
        return assigned
    
    def _assign_localities_by_majority(self):
        """Reasigna las IPS de localidades compartidas al KAM que tenga mayoría."""
        print("\n   📊 Asignando localidades por mayoría...")
        
        localities_reassigned = 0
        
        for locality_id, kam_counts in self.locality_ips_count.items():
            if len(kam_counts) > 1:
                # Encontrar ganador
                winner_kam = max(kam_counts.items(), key=lambda x: x[1])[0]
                
                # Mostrar competencia
                print(f"      Localidad {locality_id}: ", end="")
                for kam, count in kam_counts.items():
                    print(f"{kam}={count} ", end="")
                print(f"→ Ganador: {winner_kam}")
                
                # Reasignar todas las IPS de esta localidad
                for kam_id in list(self.assignments.keys()):
                    if kam_id != winner_kam:
                        ips_to_move = []
                        for ips in self.assignments[kam_id]:
                            if ips.get('localityid') == locality_id:
                                ips_to_move.append(ips)
                        
                        for ips in ips_to_move:
                            self.assignments[kam_id].remove(ips)
                            self.assignments[winner_kam].append(ips)
                            localities_reassigned += 1
        
        if localities_reassigned > 0:
            print(f"   ✓ {localities_reassigned} IPS reasignadas por mayoría de localidad")


def main():
    """
    Función principal
    """
    print("="*60)
    print("   🗺️  OpMap con Google Distance Matrix API")
    print("="*60)
    print(f"📅 Fecha: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*60)
    
    print("\n🔑 Verificando API Key...")
    if GOOGLE_MAPS_API_KEY:
        print(f"   ✓ API Key cargada: {GOOGLE_MAPS_API_KEY[:10]}...{GOOGLE_MAPS_API_KEY[-4:]}")
    else:
        print("   ❌ No se encontró API Key")
        return
    
    # Crear instancia del algoritmo
    algorithm = GoogleMapsOpMapAlgorithm()
    
    # Cargar datos
    print("\n📁 Cargando datos...")
    algorithm.load_data(
        'data/json/sellers.json',
        'data/psv/hospitals.psv',
        'data/json/adjacency_matrix.json'
    )
    print(f"   ✓ {len(algorithm.sellers)} KAMs cargados")
    print(f"   ✓ {len(algorithm.hospitals)} IPS cargadas")
    
    # Calcular todos los tiempos de viaje
    if algorithm.calculate_all_travel_times():
        # Ejecutar asignación
        assignments = algorithm.run_assignment()
        
        # Guardar resultados
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        output_file = f'output/opmap_google_{timestamp}.json'
        
        output_data = {
            'metadata': {
                'timestamp': timestamp,
                'algorithm': 'GoogleMapsOpMapAlgorithm',
                'total_kams': len(algorithm.sellers),
                'total_ips': len(algorithm.hospitals),
                'cache_size': len(algorithm.cached_times)
            },
            'assignments': assignments,
            'travel_times_cache': algorithm.cached_times
        }
        
        os.makedirs('output', exist_ok=True)
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(output_data, f, ensure_ascii=False, indent=2)
        
        print(f"\n✅ Resultados guardados en: {output_file}")
        print(f"✅ Caché de tiempos guardado en: {algorithm.cache_file}")
        
        # Estadísticas finales
        total_assigned = sum(len(ips) for ips in assignments.values())
        print(f"\n📊 Estadísticas finales:")
        print(f"   - IPS asignadas: {total_assigned}/{len(algorithm.hospitals)}")
        print(f"   - Rutas en caché: {len(algorithm.cached_times)}")
        print(f"   - Tamaño del caché: {os.path.getsize(algorithm.cache_file) / 1024:.1f} KB")
        
        print("\n💡 Puedes ejecutar el algoritmo de nuevo sin recalcular rutas")
        print("   El caché se reutilizará automáticamente")
        
        # Generar mapa
        print("\n🗺️  Generando visualización del mapa...")
        visualizer = CleanMapVisualizer()
        map_file = f'output/opmap_google_{timestamp}.html'
        visualizer.create_map(assignments, map_file)
        
        print(f"\n✅ Mapa guardado en: {map_file}")
        print(f"📍 Abriendo mapa en el navegador...")
        
        # Abrir en navegador
        webbrowser.open(f"file://{os.path.abspath(map_file)}")


if __name__ == "__main__":
    main()