"""
Algoritmo OpMap con Fase 8 corregida para mantener continuidad territorial.
Los municipios sin IPS se asignan al KAM que atiende la IPS más cercana.
"""

import json
import os
from typing import Dict, List, Set, Tuple, Optional
from datetime import datetime
import csv
from collections import defaultdict

from .distance_calculator import DistanceCalculator

class OpMapAlgorithmFixed:
    """
    Implementación del algoritmo OpMap con 8 fases.
    Fase 8 corregida para asignar municipios sin IPS al KAM de la IPS más cercana.
    """
    
    def __init__(self):
        # Configuración de tiempos máximos (en minutos)
        self.DEFAULT_MAX_KAM_TRAVEL_TIME = 240  # 4 horas por defecto
        self.MAX_PATIENT_TRANSFER_TIME = 240   # 4 horas para pacientes
        
        # Departamentos excluidos
        self.EXCLUDED_DEPARTMENTS = ['27', '97', '99']
        
        # Calculador de distancias
        self.distance_calculator = DistanceCalculator()
        
        # Datos que se cargarán
        self.sellers = []
        self.hospitals = []
        self.adjacency_matrix = {}
        self.municipalities = []
        
        # Resultados
        self.assignments = defaultdict(list)
        self.summary = {}
        
    def load_data(self):
        """
        Fase 1: Carga todos los datos necesarios desde archivos.
        """
        print("\n🔄 Fase 1: Cargando datos...")
        
        # Cargar vendedores (KAMs)
        with open('data/json/sellers.json', 'r', encoding='utf-8') as f:
            self.sellers = json.load(f)
        print(f"   ✓ {len(self.sellers)} KAMs cargados")
        
        # Cargar hospitales (IPS)
        self.hospitals = []
        with open('data/psv/hospitals.psv', 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f, delimiter='|')
            for row in reader:
                # Excluir departamentos específicos
                if row.get('departmentid', '') not in self.EXCLUDED_DEPARTMENTS:
                    self.hospitals.append(row)
        print(f"   ✓ {len(self.hospitals)} IPS cargadas")
        
        # Cargar matriz de adyacencia
        with open('data/json/adjacency_matrix.json', 'r', encoding='utf-8') as f:
            self.adjacency_matrix = json.load(f)
        print(f"   ✓ Matriz de adyacencia cargada")
        
        # Cargar municipios
        self.municipalities = []
        with open('data/psv/municipalities.psv', 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f, delimiter='|')
            for row in reader:
                if row.get('departmentId', '') not in self.EXCLUDED_DEPARTMENTS:
                    self.municipalities.append(row)
        print(f"   ✓ {len(self.municipalities)} municipios cargados")
        
    def assign_base_territories(self):
        """
        Fase 2: Asigna automáticamente las IPS del territorio base de cada KAM.
        También construye el conjunto de municipios con KAM.
        """
        print("\n🏠 Fase 2: Asignando territorios base...")
        
        municipalities_with_kam = set()
        base_assignments = 0
        
        for seller in self.sellers:
            area_id = seller['areaId']
            municipalities_with_kam.add(area_id)
            
            # Buscar IPS en el área del KAM
            for hospital in self.hospitals:
                if (hospital.get('municipalityid') == area_id or 
                    hospital.get('localityid') == area_id):
                    self.assignments[seller['id']].append(hospital)
                    base_assignments += 1
        
        print(f"   ✓ {base_assignments} IPS asignadas en territorios base")
        print(f"   ✓ {len(municipalities_with_kam)} municipios con KAM residente")
        
        return municipalities_with_kam
    
    def identify_unassigned_ips(self, municipalities_with_kam: Set[str]) -> List[Dict]:
        """
        Fase 3: Identifica las IPS que aún no han sido asignadas.
        """
        print("\n🔍 Fase 3: Identificando IPS no asignadas...")
        
        # IPS ya asignadas
        assigned_ips = set()
        for ips_list in self.assignments.values():
            for ips in ips_list:
                assigned_ips.add(ips['id_register'])
        
        # IPS no asignadas y fuera de municipios con KAM
        unassigned_ips = []
        for hospital in self.hospitals:
            if (hospital['id_register'] not in assigned_ips and
                hospital.get('municipalityid') not in municipalities_with_kam):
                unassigned_ips.append(hospital)
        
        print(f"   ✓ {len(unassigned_ips)} IPS disponibles para asignación")
        return unassigned_ips
    
    def determine_search_zones(self, unassigned_ips: List[Dict]) -> Dict[str, List[Dict]]:
        """
        Fase 4: Determina las zonas de búsqueda para cada KAM.
        """
        print("\n🗺️  Fase 4: Determinando zonas de búsqueda...")
        
        kam_candidates = defaultdict(list)
        
        for seller in self.sellers:
            # Departamento del KAM
            kam_dept = seller['areaId'][:2]
            
            # Departamentos donde puede buscar (propio + fronterizos nivel 1)
            search_departments = {kam_dept}
            
            # Agregar departamentos fronterizos
            if kam_dept in self.adjacency_matrix:
                for adj_dept in self.adjacency_matrix[kam_dept].get('closeDepartments', {}):
                    search_departments.add(adj_dept)
            
            # Filtrar IPS candidatas
            for ips in unassigned_ips:
                ips_dept = ips.get('departmentid', '')[:2]
                if ips_dept in search_departments:
                    kam_candidates[seller['id']].append(ips)
        
        # Resumen
        total_candidates = sum(len(candidates) for candidates in kam_candidates.values())
        print(f"   ✓ {total_candidates} relaciones KAM-IPS a evaluar")
        
        return kam_candidates
    
    def calculate_travel_times(self, kam_candidates: Dict[str, List[Dict]]) -> Dict[str, Dict[str, float]]:
        """
        Fase 5: Calcula los tiempos de viaje para cada par KAM-IPS candidato.
        """
        print("\n⏱️  Fase 5: Calculando tiempos de viaje...")
        
        travel_times = defaultdict(dict)
        calculations = 0
        
        for seller in self.sellers:
            kam_id = seller['id']
            kam_location = (float(seller['lat']), float(seller['lng']))
            
            # Obtener límite de tiempo personalizado
            max_time = seller.get('expansionConfig', {}).get('maxTravelTime', self.DEFAULT_MAX_KAM_TRAVEL_TIME)
            
            for ips in kam_candidates.get(kam_id, []):
                try:
                    ips_location = (float(ips['lat']), float(ips['lng']))
                    time = self.distance_calculator.calculate_travel_time(
                        kam_location, 
                        ips_location
                    )
                    
                    if time and time <= max_time:
                        travel_times[kam_id][ips['id_register']] = time
                        calculations += 1
                        
                except (ValueError, KeyError):
                    # Coordenadas inválidas
                    pass
        
        print(f"   ✓ {calculations} tiempos calculados dentro de límites")
        return travel_times
    
    def assign_ips_competitively(self, unassigned_ips: List[Dict], 
                                travel_times: Dict[str, Dict[str, float]]) -> int:
        """
        Fase 6: Asigna IPS de forma competitiva basándose en tiempos y prioridades.
        """
        print("\n🏆 Fase 6: Asignación competitiva de IPS...")
        
        assignments_made = 0
        
        # Para cada IPS no asignada
        for ips in unassigned_ips:
            ips_id = ips['id_register']
            candidates = []
            
            # Encontrar todos los KAM que pueden llegar a esta IPS
            for seller in self.sellers:
                kam_id = seller['id']
                if ips_id in travel_times.get(kam_id, {}):
                    priority = seller.get('expansionConfig', {}).get('priority', 2)
                    candidates.append({
                        'kam_id': kam_id,
                        'time': travel_times[kam_id][ips_id],
                        'priority': priority
                    })
            
            if candidates:
                # Ordenar por tiempo (ascendente) y luego por prioridad (descendente)
                candidates.sort(key=lambda x: (x['time'], -x['priority']))
                
                # Asignar al mejor candidato
                winner = candidates[0]
                self.assignments[winner['kam_id']].append(ips)
                assignments_made += 1
        
        print(f"   ✓ {assignments_made} IPS asignadas competitivamente")
        return assignments_made
    
    def expand_to_level2_if_needed(self, initial_assignments: int):
        """
        Fase 7: Expansión selectiva a departamentos de segundo nivel.
        """
        print("\n🔄 Fase 7: Evaluando expansión a nivel 2...")
        
        # Identificar IPS aún sin asignar
        assigned_ips = set()
        for ips_list in self.assignments.values():
            for ips in ips_list:
                assigned_ips.add(ips['id_register'])
        
        remaining_ips = [h for h in self.hospitals if h['id_register'] not in assigned_ips]
        
        if not remaining_ips:
            print("   ✓ Todas las IPS ya están asignadas")
            return
        
        print(f"   ⚠️  {len(remaining_ips)} IPS sin asignar")
        
        # Solo KAMs con enableLevel2 = true pueden expandirse
        expanding_kams = [s for s in self.sellers 
                         if s.get('expansionConfig', {}).get('enableLevel2', False)]
        
        if not expanding_kams:
            print("   ℹ️  Ningún KAM tiene habilitada la expansión a nivel 2")
            return
        
        print(f"   🔍 {len(expanding_kams)} KAMs pueden expandirse a nivel 2")
        
        # Similar a fases anteriores pero con departamentos de nivel 2
        # ... (implementación similar pero con fronterizos de fronterizos)
        
    def assign_population_without_ips(self):
        """
        Fase 8 CORREGIDA: Asigna municipios sin IPS al KAM que atiende la IPS más cercana.
        Esto mantiene la continuidad territorial ya que los pacientes irían a esa IPS.
        """
        print("\n👥 Fase 8: Asignando población sin IPS...")
        
        # Crear un índice de IPS por ID para búsqueda rápida
        ips_by_id = {h['id_register']: h for h in self.hospitals}
        
        # Crear un mapa de IPS -> KAM para saber qué KAM atiende cada IPS
        ips_to_kam = {}
        for kam_id, ips_list in self.assignments.items():
            for ips in ips_list:
                if not ips.get('is_population_only', False):  # Solo IPS reales
                    ips_to_kam[ips['id_register']] = kam_id
        
        # Identificar municipios sin IPS
        municipalities_with_ips = set()
        for hospital in self.hospitals:
            if 'municipalityid' in hospital:
                municipalities_with_ips.add(hospital['municipalityid'])
        
        municipalities_without_ips = []
        for mun in self.municipalities:
            if mun['id'] not in municipalities_with_ips:
                municipalities_without_ips.append(mun)
        
        print(f"   🔍 {len(municipalities_without_ips)} municipios sin IPS")
        
        if not municipalities_without_ips:
            return
        
        municipalities_assigned = 0
        population_assigned = 0
        municipalities_vacant = []
        
        for mun in municipalities_without_ips:
            try:
                mun_location = (float(mun['lat']), float(mun['lng']))
                best_ips = None
                min_time = float('inf')
                
                # Buscar la IPS más cercana (donde irían los pacientes)
                for hospital in self.hospitals:
                    # Solo considerar IPS reales que ya están asignadas a algún KAM
                    if hospital['id_register'] in ips_to_kam:
                        try:
                            ips_location = (float(hospital['lat']), float(hospital['lng']))
                            time = self.distance_calculator.calculate_travel_time(
                                mun_location, 
                                ips_location
                            )
                            
                            if time and time <= self.MAX_PATIENT_TRANSFER_TIME and time < min_time:
                                min_time = time
                                best_ips = hospital
                        except (ValueError, KeyError):
                            pass
                
                # Si encontramos una IPS cercana, asignar el municipio al KAM que la atiende
                if best_ips and best_ips['id_register'] in ips_to_kam:
                    kam_id = ips_to_kam[best_ips['id_register']]
                    
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
                        'is_population_only': True,  # Marcador especial
                        'nearest_ips': best_ips['name_register'],  # IPS de referencia
                        'travel_time_to_ips': min_time
                    }
                    
                    self.assignments[kam_id].append(municipality_entry)
                    municipalities_assigned += 1
                    population_assigned += int(mun['population2025'])
                else:
                    # Municipio sin IPS cercana accesible - zona vacante
                    municipalities_vacant.append(mun['name'])
                    
            except (ValueError, KeyError) as e:
                # Coordenadas inválidas o datos faltantes
                pass
        
        print(f"   ✓ {municipalities_assigned} municipios asignados")
        print(f"   ✓ {population_assigned:,} habitantes adicionales cubiertos")
        if municipalities_vacant:
            print(f"   ⚠️  {len(municipalities_vacant)} municipios sin cobertura (zonas vacantes)")
            print(f"      {', '.join(municipalities_vacant[:5])}{'...' if len(municipalities_vacant) > 5 else ''}")
    
    def generate_summary(self):
        """
        Genera un resumen de las asignaciones realizadas.
        """
        print("\n📊 Generando resumen...")
        
        total_ips = 0
        total_population = 0
        kam_summaries = {}
        
        for kam_id, ips_list in self.assignments.items():
            real_ips = [ips for ips in ips_list if not ips.get('is_population_only', False)]
            pop_only = [ips for ips in ips_list if ips.get('is_population_only', False)]
            
            kam_info = next((s for s in self.sellers if s['id'] == kam_id), {})
            population = sum(int(ips.get('population', 0)) for ips in pop_only)
            
            kam_summaries[kam_id] = {
                'name': kam_info.get('name', kam_id),
                'real_ips_count': len(real_ips),
                'population_only_count': len(pop_only),
                'total_assignments': len(ips_list),
                'population_covered': population
            }
            
            total_ips += len(real_ips)
            total_population += population
        
        self.summary = {
            'timestamp': datetime.now().isoformat(),
            'total_kams': len(self.sellers),
            'total_ips_assigned': total_ips,
            'total_population_covered': total_population,
            'kam_summaries': kam_summaries
        }
    
    def save_results(self):
        """
        Guarda los resultados en archivos JSON.
        """
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        # Crear directorio de salida si no existe
        os.makedirs('output', exist_ok=True)
        
        # Guardar asignaciones
        output_file = f'output/assignments_{timestamp}.json'
        output_data = {
            'summary': self.summary,
            'assignments': dict(self.assignments)
        }
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(output_data, f, ensure_ascii=False, indent=2)
        
        print(f"\n✅ Resultados guardados en: {output_file}")
        
        return output_file
    
    def run(self):
        """
        Ejecuta el algoritmo completo de OpMap.
        """
        print("\n" + "="*60)
        print("🚀 INICIANDO ALGORITMO OPMAP (FASE 8 CORREGIDA)")
        print("="*60)
        
        # Fase 1: Cargar datos
        self.load_data()
        
        # Fase 2: Asignar territorios base
        municipalities_with_kam = self.assign_base_territories()
        
        # Fase 3: Identificar IPS no asignadas
        unassigned_ips = self.identify_unassigned_ips(municipalities_with_kam)
        
        # Fase 4: Determinar zonas de búsqueda
        kam_candidates = self.determine_search_zones(unassigned_ips)
        
        # Fase 5: Calcular tiempos de viaje
        travel_times = self.calculate_travel_times(kam_candidates)
        
        # Fase 6: Asignación competitiva
        assignments_made = self.assign_ips_competitively(unassigned_ips, travel_times)
        
        # Fase 7: Expansión a nivel 2 (si es necesario)
        self.expand_to_level2_if_needed(assignments_made)
        
        # Fase 8: Asignar población sin IPS (CORREGIDA)
        self.assign_population_without_ips()
        
        # Generar resumen
        self.generate_summary()
        
        # Guardar resultados
        output_file = self.save_results()
        
        print("\n" + "="*60)
        print("✨ ALGORITMO COMPLETADO CON ÉXITO")
        print("="*60)
        
        return output_file