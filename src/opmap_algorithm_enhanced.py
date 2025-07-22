"""
Algoritmo OpMap mejorado con soporte para localidades sin IPS.
"""

import csv
import json
from typing import Dict, List, Set, Tuple
from collections import defaultdict
from datetime import datetime

from .opmap_algorithm import OpMapAlgorithm

class EnhancedOpMapAlgorithm(OpMapAlgorithm):
    """
    Versión mejorada del algoritmo OpMap que maneja localidades sin IPS.
    """
    
    def assign_population_without_ips(self):
        """
        Fase 8: Asignación de Población sin IPS (municipios Y localidades)
        """
        print("\n👥 Fase 8: Asignando población sin IPS...")
        
        # Primero, manejar municipios sin IPS (lógica original)
        super().assign_population_without_ips()
        
        # Ahora manejar localidades sin IPS (nuevo)
        self._assign_localities_without_ips()
    
    def _assign_localities_without_ips(self):
        """
        Asigna localidades de Bogotá que no tienen IPS al KAM más cercano.
        """
        print("\n   📍 Asignando localidades de Bogotá sin IPS...")
        
        # Cargar datos de localidades
        localities = []
        with open('data/psv/localities.psv', 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f, delimiter='|')
            for row in reader:
                localities.append(row)
        
        # Crear set de localidades que ya tienen IPS
        localities_with_ips = set()
        for hospital in self.hospitals:
            if 'localityid' in hospital and hospital['localityid']:
                localities_with_ips.add(hospital['localityid'])
        
        # También revisar las asignaciones actuales
        for kam_id, assigned_list in self.assignments.items():
            for item in assigned_list:
                if 'localityid' in item and item['localityid']:
                    localities_with_ips.add(item['localityid'])
        
        # Identificar localidades sin IPS
        localities_without_ips = []
        for loc in localities:
            if loc['id'] not in localities_with_ips:
                localities_without_ips.append(loc)
        
        print(f"   🔍 {len(localities_without_ips)} localidades sin IPS")
        
        if not localities_without_ips:
            return
        
        # Para cada localidad sin IPS, encontrar el KAM más cercano
        localities_assigned = 0
        population_assigned = 0
        
        # KAMs en Bogotá
        bogota_kams = [kam for kam in self.sellers if kam['areaId'].startswith('11001')]
        
        for loc in localities_without_ips:
            try:
                # Para localidades, usar las coordenadas del centro
                # Si no tiene coordenadas, usar las de Bogotá centro
                if 'lat' in loc and 'lng' in loc:
                    loc_location = (float(loc['lat']), float(loc['lng']))
                else:
                    # Centro aproximado de Bogotá
                    loc_location = (4.6097, -74.0817)
                
                best_kam = None
                min_time = float('inf')
                
                # Buscar el KAM más cercano (solo entre KAMs de Bogotá)
                for kam in bogota_kams:
                    kam_location = (float(kam['lat']), float(kam['lng']))
                    time = self.distance_calculator.calculate_travel_time(
                        loc_location, 
                        kam_location
                    )
                    
                    if time and time < min_time:
                        min_time = time
                        best_kam = kam
                
                # Si encontramos un KAM cercano, asignar la localidad
                if best_kam:
                    # Crear una entrada especial para localidades sin IPS
                    locality_entry = {
                        'id_register': f"LOC_{loc['id']}",
                        'name_register': f"Población de {loc['name']}",
                        'localityid': loc['id'],
                        'localityname': loc['name'],
                        'municipalityid': '11001',
                        'municipalityname': 'BOGOTÁ, D.C.',
                        'departmentid': '11',
                        'departmentname': 'Bogotá, D.C.',
                        'lat': loc_location[0],
                        'lng': loc_location[1],
                        'population': int(loc.get('population2025', 0)),
                        'is_population_only': True  # Marcador especial
                    }
                    
                    self.assignments[best_kam['id']].append(locality_entry)
                    localities_assigned += 1
                    population_assigned += int(loc.get('population2025', 0))
                    
                    print(f"      ✓ {loc['name']} asignada a {best_kam['name']} ({min_time} min)")
                    
            except (ValueError, KeyError) as e:
                print(f"      ❌ Error procesando {loc.get('name', loc['id'])}: {e}")
                pass
        
        print(f"   ✓ {localities_assigned} localidades asignadas")
        print(f"   ✓ {population_assigned:,} habitantes adicionales cubiertos")