"""
Algoritmo OpMap con lógica especial para Bogotá.
Maneja correctamente la asignación por localidades en Bogotá.
"""

import csv
import json
import math
from typing import Dict, List, Set, Tuple
from collections import defaultdict
from datetime import datetime

from .opmap_algorithm_enhanced import EnhancedOpMapAlgorithm


class BogotaOpMapAlgorithm(EnhancedOpMapAlgorithm):
    """
    Versión del algoritmo OpMap que maneja correctamente las localidades de Bogotá.
    """
    
    def __init__(self):
        super().__init__()
        self.bogota_kams = []  # KAMs que operan en Bogotá
        self.locality_adjacency = {}  # Matriz de adyacencia de localidades
        self.locality_ips_count = defaultdict(lambda: defaultdict(int))  # localidad -> {kam_id: count}
        
    def load_data(self, sellers_path: str, hospitals_path: str, 
                  adjacency_path: str):
        """
        Carga los datos necesarios para el algoritmo.
        """
        super().load_data(sellers_path, hospitals_path, adjacency_path)
        
        # Identificar KAMs de Bogotá
        self.bogota_kams = [
            seller for seller in self.sellers 
            if seller['areaId'].startswith('11001')  # Localidades de Bogotá
        ]
        print(f"   ✓ {len(self.bogota_kams)} KAMs operando en Bogotá identificados")
        
        # Cargar matriz de adyacencia de localidades
        self._load_locality_adjacency()
        
    def _load_locality_adjacency(self):
        """
        Carga la matriz de adyacencia de localidades de Bogotá.
        """
        # Por ahora, definimos manualmente las localidades adyacentes
        # En el futuro, esto debería venir de un archivo JSON
        self.locality_adjacency = {
            '1100101': ['1100102', '1100111'],  # Usaquén
            '1100102': ['1100101', '1100103', '1100111', '1100113'],  # Chapinero
            '1100103': ['1100102', '1100104', '1100113', '1100114'],  # Santa Fe
            '1100104': ['1100103', '1100105', '1100114', '1100115', '1100117'],  # San Cristóbal
            '1100105': ['1100104', '1100106', '1100117', '1100119', '1100120'],  # Usme
            '1100106': ['1100105', '1100120'],  # Tunjuelito
            '1100107': ['1100108', '1100109', '1100116'],  # Bosa
            '1100108': ['1100107', '1100109', '1100116', '1100118'],  # Kennedy
            '1100109': ['1100107', '1100108', '1100110', '1100112'],  # Fontibón
            '1100110': ['1100109', '1100111', '1100112'],  # Engativá
            '1100111': ['1100101', '1100102', '1100110', '1100112'],  # Suba
            '1100112': ['1100109', '1100110', '1100111'],  # Barrios Unidos
            '1100113': ['1100102', '1100103', '1100112', '1100114', '1100116'],  # Teusaquillo
            '1100114': ['1100103', '1100104', '1100113', '1100115', '1100116', '1100117'],  # Los Mártires
            '1100115': ['1100104', '1100114', '1100117', '1100118'],  # Antonio Nariño
            '1100116': ['1100107', '1100108', '1100113', '1100114', '1100118'],  # Puente Aranda
            '1100117': ['1100104', '1100105', '1100114', '1100115', '1100118', '1100119'],  # La Candelaria
            '1100118': ['1100108', '1100115', '1100116', '1100117', '1100119'],  # Rafael Uribe Uribe
            '1100119': ['1100105', '1100117', '1100118', '1100120'],  # Ciudad Bolívar
            '1100120': ['1100105', '1100106', '1100119']  # Sumapaz
        }
        
    def competitive_assignment(self, available_ips: Set[str] = None, travel_times: Dict = None):
        """
        Fase 6: Asignación Competitiva con lógica especial para Bogotá.
        """
        print("\n🏆 Fase 6: Asignación competitiva...")
        
        conflicts_resolved = 0
        
        # Usar los tiempos de viaje pasados como parámetro
        if travel_times:
            self.travel_times = travel_times
        
        # Separar IPS de Bogotá del resto
        bogota_unassigned = []
        other_unassigned = []
        
        # Obtener todas las IPS no asignadas
        unassigned_hospitals = []
        assigned_ids = set()
        for kam_id, assigned_list in self.assignments.items():
            assigned_ids.update(h['id_register'] for h in assigned_list)
        
        for hospital in self.hospitals:
            if hospital['id_register'] not in assigned_ids:
                unassigned_hospitals.append(hospital)
        
        # Separar por ubicación
        for hospital in unassigned_hospitals:
            if hospital.get('municipalityid') == '11001':  # Es de Bogotá
                bogota_unassigned.append(hospital)
            else:
                other_unassigned.append(hospital)
        
        print(f"   ℹ️  {len(bogota_unassigned)} IPS no asignadas en Bogotá")
        print(f"   ℹ️  {len(other_unassigned)} IPS no asignadas fuera de Bogotá")
        
        # Procesar IPS de Bogotá con lógica especial
        if bogota_unassigned:
            conflicts_resolved += self._process_bogota_ips(bogota_unassigned)
        
        # Procesar IPS fuera de Bogotá con lógica normal
        if other_unassigned:
            conflicts_resolved += self._process_other_ips(other_unassigned)
        
        # Asignar localidades completas por mayoría
        self._assign_localities_by_majority()
        
        print(f"   ✓ {conflicts_resolved} conflictos resueltos")
        
    def _process_bogota_ips(self, bogota_ips: List[Dict]) -> int:
        """
        Procesa las IPS de Bogotá, donde solo compiten los KAMs de Bogotá.
        """
        conflicts = 0
        
        for hospital in bogota_ips:
            locality_id = hospital.get('localityid')
            if not locality_id:
                continue
                
            # Solo los KAMs de Bogotá pueden competir por IPS en Bogotá
            candidates = []
            
            for kam in self.bogota_kams:
                kam_id = kam['id']
                if kam_id in self.travel_times and hospital['id_register'] in self.travel_times[kam_id]:
                    time = self.travel_times[kam_id][hospital['id_register']]
                    candidates.append((kam_id, time))
            
            if not candidates:
                # Si no hay tiempos calculados, usar distancia Haversine
                for kam in self.bogota_kams:
                    distance = self._calculate_haversine_distance(
                        float(kam['lat']), float(kam['lng']),
                        float(hospital['lat']), float(hospital['lng'])
                    )
                    # Convertir a tiempo estimado (40 km/h promedio en ciudad)
                    time_minutes = (distance / 40) * 60
                    candidates.append((kam['id'], time_minutes))
            
            if candidates:
                # Ordenar por tiempo/distancia
                candidates.sort(key=lambda x: x[1])
                winner_kam, winner_time = candidates[0]
                
                # Registrar para conteo de mayoría
                self.locality_ips_count[locality_id][winner_kam] += 1
                
                # Asignar temporalmente (la asignación final será por mayoría)
                self.assignments[winner_kam].append(hospital)
                
                # Si hay más de un candidato, es un conflicto resuelto
                if len(candidates) > 1:
                    conflicts += 1
                    second_kam, second_time = candidates[1]
                    print(f"   ⚔️  Conflicto resuelto para IPS {hospital['name_register']} en {hospital.get('localityname', locality_id)}: "
                          f"KAM {self._get_kam_name(winner_kam)} ({winner_time:.0f}min) vs "
                          f"KAM {self._get_kam_name(second_kam)} ({second_time:.0f}min)")
        
        return conflicts
    
    def _process_other_ips(self, other_ips: List[Dict]) -> int:
        """
        Procesa las IPS fuera de Bogotá con la lógica normal.
        """
        conflicts = 0
        
        for hospital in other_ips:
            candidates = []
            
            # Todos los KAMs (excepto los de Bogotá) pueden competir
            for kam_id, times in self.travel_times.items():
                # Los KAMs de Bogotá no compiten fuera de Bogotá
                kam = next((s for s in self.sellers if s['id'] == kam_id), None)
                if kam and kam['areaId'].startswith('11001'):
                    continue
                    
                if hospital['id_register'] in times:
                    candidates.append((kam_id, times[hospital['id_register']]))
            
            if candidates:
                candidates.sort(key=lambda x: x[1])
                winner_kam, winner_time = candidates[0]
                
                self.assignments[winner_kam].append(hospital)
                
                if len(candidates) > 1:
                    conflicts += 1
                    second_kam, second_time = candidates[1]
                    print(f"   ⚔️  Conflicto resuelto para IPS {hospital['name_register']}: "
                          f"KAM {self._get_kam_name(winner_kam)} ({winner_time:.0f}min) vs "
                          f"KAM {self._get_kam_name(second_kam)} ({second_time:.0f}min)")
        
        return conflicts
    
    def _assign_localities_by_majority(self):
        """
        Reasigna las IPS de localidades compartidas al KAM que tenga mayoría.
        """
        print("\n   📊 Asignando localidades por mayoría...")
        
        localities_reassigned = 0
        
        for locality_id, kam_counts in self.locality_ips_count.items():
            if len(kam_counts) > 1:  # Localidad disputada
                # Encontrar el KAM con más IPS
                winner_kam = max(kam_counts.items(), key=lambda x: x[1])[0]
                total_ips = sum(kam_counts.values())
                
                locality_name = self._get_locality_name(locality_id)
                print(f"      📍 {locality_name}: ", end="")
                for kam_id, count in sorted(kam_counts.items(), key=lambda x: x[1], reverse=True):
                    print(f"{self._get_kam_name(kam_id)}={count} ", end="")
                print(f"→ Asignada a {self._get_kam_name(winner_kam)}")
                
                # Reasignar todas las IPS de esta localidad al ganador
                for kam_id in list(self.assignments.keys()):
                    if kam_id != winner_kam:
                        # Buscar IPS de esta localidad asignadas a otros KAMs
                        ips_to_move = []
                        for ips in self.assignments[kam_id]:
                            if ips.get('localityid') == locality_id:
                                ips_to_move.append(ips)
                        
                        # Mover las IPS al KAM ganador
                        for ips in ips_to_move:
                            self.assignments[kam_id].remove(ips)
                            self.assignments[winner_kam].append(ips)
                            localities_reassigned += 1
        
        if localities_reassigned > 0:
            print(f"   ✓ {localities_reassigned} IPS reasignadas por mayoría de localidad")
    
    def _calculate_haversine_distance(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """
        Calcula la distancia Haversine entre dos puntos.
        """
        R = 6371  # Radio de la Tierra en km
        
        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lat = math.radians(lat2 - lat1)
        delta_lon = math.radians(lon2 - lon1)
        
        a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon/2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        
        return R * c
    
    def _get_kam_name(self, kam_id: str) -> str:
        """
        Obtiene el nombre de un KAM por su ID.
        """
        kam = next((s for s in self.sellers if s['id'] == kam_id), None)
        return kam['name'] if kam else kam_id
    
    def _get_locality_name(self, locality_id: str) -> str:
        """
        Obtiene el nombre de una localidad.
        """
        # Por ahora retornamos el ID, pero idealmente cargaríamos los nombres
        locality_names = {
            '1100101': 'Usaquén',
            '1100102': 'Chapinero',
            '1100103': 'Santa Fe',
            '1100104': 'San Cristóbal',
            '1100105': 'Usme',
            '1100106': 'Tunjuelito',
            '1100107': 'Bosa',
            '1100108': 'Kennedy',
            '1100109': 'Fontibón',
            '1100110': 'Engativá',
            '1100111': 'Suba',
            '1100112': 'Barrios Unidos',
            '1100113': 'Teusaquillo',
            '1100114': 'Los Mártires',
            '1100115': 'Antonio Nariño',
            '1100116': 'Puente Aranda',
            '1100117': 'La Candelaria',
            '1100118': 'Rafael Uribe Uribe',
            '1100119': 'Ciudad Bolívar',
            '1100120': 'Sumapaz'
        }
        return locality_names.get(locality_id, locality_id)
    
    def verify_contiguity(self):
        """
        Verifica que los territorios asignados sean contiguos.
        """
        print("\n🔍 Verificando contigüidad territorial...")
        
        warnings = 0
        
        for kam_id, assigned_list in self.assignments.items():
            kam = next((s for s in self.sellers if s['id'] == kam_id), None)
            if not kam:
                continue
                
            # Solo verificar KAMs de Bogotá
            if not kam['areaId'].startswith('11001'):
                continue
                
            # Obtener todas las localidades asignadas a este KAM
            assigned_localities = set()
            base_locality = kam['areaId']
            assigned_localities.add(base_locality)
            
            for item in assigned_list:
                if item.get('localityid'):
                    assigned_localities.add(item['localityid'])
            
            # Verificar contigüidad
            if len(assigned_localities) > 1:
                if not self._is_contiguous(assigned_localities):
                    warnings += 1
                    print(f"   ⚠️  Advertencia: El territorio de {kam['name']} no es contiguo")
                    print(f"      Localidades: {', '.join(self._get_locality_name(l) for l in assigned_localities)}")
        
        if warnings == 0:
            print("   ✓ Todos los territorios de Bogotá son contiguos")
        
        return warnings == 0
    
    def _is_contiguous(self, localities: Set[str]) -> bool:
        """
        Verifica si un conjunto de localidades forma un territorio contiguo.
        """
        if len(localities) <= 1:
            return True
            
        # Convertir a lista para poder indexar
        localities_list = list(localities)
        
        # BFS desde la primera localidad
        visited = set()
        queue = [localities_list[0]]
        visited.add(localities_list[0])
        
        while queue:
            current = queue.pop(0)
            
            # Obtener vecinos
            neighbors = self.locality_adjacency.get(current, [])
            
            for neighbor in neighbors:
                if neighbor in localities and neighbor not in visited:
                    visited.add(neighbor)
                    queue.append(neighbor)
        
        # Si visitamos todas las localidades, el territorio es contiguo
        return len(visited) == len(localities)