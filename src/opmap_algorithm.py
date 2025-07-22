"""
Algoritmo principal de OpMap para asignación territorial optimizada.
Implementa las 8 fases del algoritmo con todas las optimizaciones.
"""

import json
import csv
from typing import Dict, List, Set, Tuple, Optional
from collections import defaultdict
from .distance_calculator import DistanceCalculator

class OpMapAlgorithm:
    """
    Implementación del algoritmo OpMap con las 8 fases de asignación territorial.
    """
    
    def __init__(self, use_google_api: bool = False, api_key: str = None):
        self.distance_calculator = DistanceCalculator(use_google_api, api_key)
        
        # Constantes del sistema
        self.DEFAULT_MAX_TRAVEL_TIME = 240  # 4 horas en minutos
        self.MAX_PATIENT_TRANSFER_TIME = 240  # 4 horas para pacientes
        self.EXCLUDED_DEPARTMENTS = ['27', '97', '99']  # Chocó, Archipiélagos, Vichada
        
        # Estructuras de datos principales
        self.sellers = []
        self.hospitals = []
        self.adjacency_matrix = {}
        self.assignments = defaultdict(list)  # kam_id -> lista de IPS
        self.excluded_municipalities = set()  # Municipios con KAM residente
        
    def load_data(self, sellers_path: str, hospitals_path: str, adjacency_path: str):
        """
        Fase 1: Inicialización y Carga de Datos
        """
        print("📁 Fase 1: Cargando datos...")
        
        # Cargar vendedores/KAMs
        with open(sellers_path, 'r') as f:
            self.sellers = json.load(f)
            print(f"   ✓ {len(self.sellers)} KAMs cargados")
        
        # Cargar hospitales/IPS
        self.hospitals = []
        with open(hospitals_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f, delimiter='|')
            for row in reader:
                # Filtrar departamentos excluidos
                if row['departmentid'] not in self.EXCLUDED_DEPARTMENTS:
                    self.hospitals.append(row)
        print(f"   ✓ {len(self.hospitals)} IPS cargadas (excluyendo departamentos {self.EXCLUDED_DEPARTMENTS})")
        
        # Cargar matriz de adyacencia
        with open(adjacency_path, 'r') as f:
            self.adjacency_matrix = json.load(f)
            print(f"   ✓ Matriz de adyacencia cargada")
    
    def assign_base_territories(self):
        """
        Fase 2: Asignación de Territorios Base y Construcción del Filtro de Exclusión
        """
        print("\n🏠 Fase 2: Asignando territorios base...")
        base_assignments = 0
        
        for kam in self.sellers:
            area_id = kam['areaId']
            kam_id = kam['id']
            
            # Agregar a municipios excluidos
            self.excluded_municipalities.add(area_id)
            
            # Buscar IPS en el mismo municipio/localidad
            base_ips = []
            for hospital in self.hospitals:
                if (hospital.get('municipalityid') == area_id or 
                    hospital.get('localityid') == area_id):
                    base_ips.append(hospital)
                    base_assignments += 1
            
            self.assignments[kam_id] = base_ips
            
            if base_ips:
                print(f"   ✓ KAM {kam['name']} ({area_id}): {len(base_ips)} IPS en territorio base")
        
        print(f"   📊 Total IPS asignadas automáticamente: {base_assignments}")
        print(f"   🚫 Municipios excluidos de búsqueda: {len(self.excluded_municipalities)}")
    
    def identify_unassigned_ips(self) -> List[Dict]:
        """
        Fase 3: Identificación de IPS No Asignadas
        """
        print("\n🔍 Fase 3: Identificando IPS no asignadas...")
        
        # Crear set de IPS ya asignadas
        assigned_ips = set()
        for ips_list in self.assignments.values():
            for ips in ips_list:
                assigned_ips.add(ips['id_register'])
        
        # Filtrar IPS disponibles
        available_ips = []
        for hospital in self.hospitals:
            if (hospital['id_register'] not in assigned_ips and 
                hospital.get('municipalityid') not in self.excluded_municipalities):
                available_ips.append(hospital)
        
        print(f"   ✓ {len(available_ips)} IPS disponibles para asignación competitiva")
        return available_ips
    
    def determine_search_zones(self, available_ips: List[Dict]) -> Dict[str, List[Dict]]:
        """
        Fase 4: Determinación de Zonas de Búsqueda por KAM
        """
        print("\n🗺️  Fase 4: Determinando zonas de búsqueda...")
        
        kam_candidates = defaultdict(list)
        
        for kam in self.sellers:
            kam_id = kam['id']
            kam_dept = kam['areaId'][:2]  # Primeros 2 dígitos = departamento
            
            # Departamentos donde buscar (propio + fronterizos nivel 1)
            search_departments = {kam_dept}
            
            if kam_dept in self.adjacency_matrix:
                close_depts = self.adjacency_matrix[kam_dept].get('closeDepartments', [])
                search_departments.update(close_depts)
            
            # Filtrar IPS en estos departamentos
            candidates = []
            for ips in available_ips:
                if ips.get('departmentid') in search_departments:
                    candidates.append(ips)
            
            kam_candidates[kam_id] = candidates
            print(f"   ✓ KAM {kam['name']}: {len(candidates)} IPS candidatas en departamentos {search_departments}")
        
        return kam_candidates
    
    def calculate_travel_times(self, kam_candidates: Dict[str, List[Dict]]) -> Dict[str, Dict[str, int]]:
        """
        Fase 5: Cálculo Optimizado de Tiempos de Viaje
        """
        print("\n⏱️  Fase 5: Calculando tiempos de viaje...")
        
        travel_times = defaultdict(dict)
        total_calculations = 0
        
        for kam in self.sellers:
            kam_id = kam['id']
            origin = (float(kam['lat']), float(kam['lng']))
            
            # Obtener configuración específica del KAM
            max_time = kam.get('expansionConfig', {}).get('maxTravelTime', self.DEFAULT_MAX_TRAVEL_TIME)
            
            candidates = kam_candidates.get(kam_id, [])
            valid_calculations = 0
            
            for ips in candidates:
                try:
                    destination = (float(ips['lat']), float(ips['lng']))
                    
                    # Calcular tiempo (usa caché automáticamente)
                    time = self.distance_calculator.calculate_travel_time(origin, destination)
                    
                    # Solo guardar si está dentro del límite del KAM
                    if time and time <= max_time:
                        travel_times[kam_id][ips['id_register']] = time
                        valid_calculations += 1
                    
                    total_calculations += 1
                except (ValueError, KeyError):
                    # Coordenadas inválidas
                    pass
            
            if valid_calculations > 0:
                print(f"   ✓ KAM {kam['name']}: {valid_calculations}/{len(candidates)} IPS dentro de {max_time} min")
        
        stats = self.distance_calculator.get_statistics()
        print(f"\n   📊 Estadísticas de cálculo:")
        print(f"      - Total cálculos: {stats['total_calculations']}")
        print(f"      - Resultados en caché: {stats['cached_results']}")
        print(f"      - Tasa de caché: {stats['cache_hit_rate']:.1f}%")
        print(f"      - Costo estimado API: ${stats['estimated_api_cost']:.2f}")
        
        return travel_times
    
    def competitive_assignment(self, available_ips: List[Dict], travel_times: Dict[str, Dict[str, int]]):
        """
        Fase 6: Asignación Competitiva Final con Resolución de Prioridades
        """
        print("\n🏆 Fase 6: Asignación competitiva...")
        
        # Para cada IPS, encontrar todos los KAM candidatos
        ips_to_kams = defaultdict(list)
        
        for kam_id, ips_times in travel_times.items():
            kam = next(k for k in self.sellers if k['id'] == kam_id)
            priority = kam.get('expansionConfig', {}).get('priority', 1)
            
            for ips_id, time in ips_times.items():
                ips_to_kams[ips_id].append({
                    'kam_id': kam_id,
                    'time': time,
                    'priority': priority,
                    'kam_name': kam['name']
                })
        
        # Resolver competencias
        competitive_assignments = 0
        conflicts_resolved = 0
        
        for ips in available_ips:
            ips_id = ips['id_register']
            if ips_id in ips_to_kams:
                candidates = ips_to_kams[ips_id]
                
                if len(candidates) > 1:
                    conflicts_resolved += 1
                
                # Ordenar por tiempo (ascendente) y luego por prioridad (descendente)
                candidates.sort(key=lambda x: (x['time'], -x['priority']))
                
                # Asignar al mejor candidato
                winner = candidates[0]
                self.assignments[winner['kam_id']].append(ips)
                competitive_assignments += 1
                
                if len(candidates) > 1:
                    print(f"   ⚔️  Conflicto resuelto para IPS {ips['name_register']}: "
                          f"{winner['kam_name']} ({winner['time']}min) vs "
                          f"{candidates[1]['kam_name']} ({candidates[1]['time']}min)")
        
        print(f"   ✓ {competitive_assignments} IPS asignadas competitivamente")
        print(f"   ✓ {conflicts_resolved} conflictos resueltos")
    
    def level2_expansion(self, available_ips: List[Dict]) -> List[Dict]:
        """
        Fase 7: Expansión Selectiva de Segundo Nivel (Control Individual por KAM)
        """
        print("\n🚀 Fase 7: Expansión de segundo nivel...")
        
        # Identificar IPS aún sin asignar
        assigned_ips = set()
        for ips_list in self.assignments.values():
            for ips in ips_list:
                assigned_ips.add(ips['id_register'])
        
        unassigned_ips = [ips for ips in available_ips if ips['id_register'] not in assigned_ips]
        
        if not unassigned_ips:
            print("   ✓ No hay IPS sin asignar, saltando expansión nivel 2")
            return []
        
        print(f"   🔍 {len(unassigned_ips)} IPS aún sin asignar")
        
        # Buscar en departamentos de segundo nivel
        level2_travel_times = defaultdict(dict)
        level2_candidates = defaultdict(list)
        
        for kam in self.sellers:
            # Verificar si este KAM puede expandirse a nivel 2
            if not kam.get('expansionConfig', {}).get('enableLevel2', False):
                continue
            
            kam_id = kam['id']
            kam_dept = kam['areaId'][:2]
            origin = (float(kam['lat']), float(kam['lng']))
            max_time = kam.get('expansionConfig', {}).get('maxTravelTime', self.DEFAULT_MAX_TRAVEL_TIME)
            
            # Obtener departamentos de segundo nivel
            level2_departments = set()
            
            if kam_dept in self.adjacency_matrix:
                # Fronterizos de primer nivel
                for dept1 in self.adjacency_matrix[kam_dept].get('closeDepartments', []):
                    if dept1 in self.adjacency_matrix:
                        # Fronterizos de segundo nivel
                        level2_departments.update(
                            self.adjacency_matrix[dept1].get('closeDepartments', [])
                        )
            
            # Remover departamentos ya considerados
            level2_departments.discard(kam_dept)
            
            # Buscar IPS en estos departamentos
            candidates = []
            for ips in unassigned_ips:
                if ips.get('departmentid') in level2_departments:
                    candidates.append(ips)
            
            if candidates:
                print(f"   🔄 KAM {kam['name']} expandiendo a nivel 2: {len(candidates)} candidatas")
                
                # Calcular tiempos
                for ips in candidates:
                    try:
                        destination = (float(ips['lat']), float(ips['lng']))
                        time = self.distance_calculator.calculate_travel_time(origin, destination)
                        
                        if time and time <= max_time:
                            level2_travel_times[kam_id][ips['id_register']] = time
                            level2_candidates[kam_id].append(ips)
                    except (ValueError, KeyError):
                        pass
        
        # Realizar asignación competitiva con las nuevas opciones
        if level2_travel_times:
            self.competitive_assignment(unassigned_ips, level2_travel_times)
        
        return unassigned_ips
    
    def assign_population_without_ips(self):
        """
        Fase 8: Asignación de Población sin IPS
        """
        print("\n👥 Fase 8: Asignando población sin IPS...")
        
        # Cargar datos de municipios
        municipalities = []
        with open('data/psv/municipalities.psv', 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f, delimiter='|')
            for row in reader:
                # Solo municipios de departamentos no excluidos
                if row['departmentId'] not in self.EXCLUDED_DEPARTMENTS:
                    municipalities.append(row)
        
        # Crear set de municipios que ya tienen IPS
        municipalities_with_ips = set()
        for hospital in self.hospitals:
            if 'municipalityid' in hospital:
                municipalities_with_ips.add(hospital['municipalityid'])
        
        # Identificar municipios sin IPS
        municipalities_without_ips = []
        for mun in municipalities:
            if mun['id'] not in municipalities_with_ips:
                municipalities_without_ips.append(mun)
        
        print(f"   🔍 {len(municipalities_without_ips)} municipios sin IPS")
        
        if not municipalities_without_ips:
            return
        
        # Para cada municipio sin IPS, encontrar el KAM más cercano
        municipalities_assigned = 0
        population_assigned = 0
        
        for mun in municipalities_without_ips:
            try:
                mun_location = (float(mun['lat']), float(mun['lng']))
                best_kam = None
                min_time = float('inf')
                
                # Buscar el KAM más cercano
                for kam in self.sellers:
                    kam_location = (float(kam['lat']), float(kam['lng']))
                    time = self.distance_calculator.calculate_travel_time(
                        mun_location, 
                        kam_location
                    )
                    
                    if time and time <= self.MAX_PATIENT_TRANSFER_TIME and time < min_time:
                        min_time = time
                        best_kam = kam
                
                # Si encontramos un KAM cercano, asignar el municipio
                if best_kam:
                    # Crear una entrada especial para municipios sin IPS
                    municipality_entry = {
                        'id_register': f"MUN_{mun['id']}",
                        'name_register': f"Población de {mun['name']}",
                        'municipalityid': mun['id'],
                        'municipalityname': mun['name'],
                        'departmentid': mun['departmentId'],
                        'departmentname': mun['departmentName'],
                        'lat': mun['lat'],
                        'lng': mun['lng'],
                        'population': int(mun['population2025']),
                        'is_population_only': True  # Marcador especial
                    }
                    
                    self.assignments[best_kam['id']].append(municipality_entry)
                    municipalities_assigned += 1
                    population_assigned += int(mun['population2025'])
                    
            except (ValueError, KeyError) as e:
                # Coordenadas inválidas o datos faltantes
                pass
        
        print(f"   ✓ {municipalities_assigned} municipios asignados")
        print(f"   ✓ {population_assigned:,} habitantes adicionales cubiertos")
    
    def run(self, sellers_path: str, hospitals_path: str, adjacency_path: str) -> Dict:
        """
        Ejecuta el algoritmo completo de OpMap.
        """
        print("🚀 Iniciando algoritmo OpMap...")
        print("=" * 60)
        
        # Fase 1: Cargar datos
        self.load_data(sellers_path, hospitals_path, adjacency_path)
        
        # Fase 2: Asignar territorios base
        self.assign_base_territories()
        
        # Fase 3: Identificar IPS no asignadas
        available_ips = self.identify_unassigned_ips()
        
        if available_ips:
            # Fase 4: Determinar zonas de búsqueda
            kam_candidates = self.determine_search_zones(available_ips)
            
            # Fase 5: Calcular tiempos de viaje
            travel_times = self.calculate_travel_times(kam_candidates)
            
            # Fase 6: Asignación competitiva
            self.competitive_assignment(available_ips, travel_times)
            
            # Fase 7: Expansión nivel 2
            self.level2_expansion(available_ips)
        
        # Fase 8: Población sin IPS
        self.assign_population_without_ips()
        
        # Generar resumen
        print("\n📊 RESUMEN FINAL:")
        print("=" * 60)
        
        total_assigned = 0
        for kam in self.sellers:
            kam_id = kam['id']
            assigned_count = len(self.assignments.get(kam_id, []))
            total_assigned += assigned_count
            print(f"   KAM {kam['name']}: {assigned_count} IPS asignadas")
        
        print(f"\n   Total IPS asignadas: {total_assigned}/{len(self.hospitals)}")
        
        # Guardar caché para futuras ejecuciones
        self.distance_calculator.save_cache('data/cache/distance_cache.json')
        
        return {
            'assignments': dict(self.assignments),
            'statistics': self.distance_calculator.get_statistics(),
            'summary': {
                'total_kams': len(self.sellers),
                'total_ips': len(self.hospitals),
                'assigned_ips': total_assigned,
                'unassigned_ips': len(self.hospitals) - total_assigned
            }
        }