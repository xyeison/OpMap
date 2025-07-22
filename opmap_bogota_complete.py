#!/usr/bin/env python3
"""
OpMap Bogotá Complete - Sistema unificado de asignación territorial
Incluye el algoritmo con lógica especial para Bogotá y generación de mapa limpio
"""

import json
import os
import csv
import math
import time
import folium
from typing import Dict, List, Set, Tuple
from collections import defaultdict
from datetime import datetime

# =====================================================
# ALGORITMO OPMAP CON LÓGICA ESPECIAL PARA BOGOTÁ
# =====================================================

class BogotaOpMapAlgorithm:
    """
    Algoritmo OpMap con manejo especial de localidades en Bogotá.
    """
    
    def __init__(self):
        self.sellers = []
        self.hospitals = []
        self.adjacency_matrix = {}
        self.assignments = defaultdict(list)
        self.travel_times = {}
        self.bogota_kams = []
        self.locality_ips_count = defaultdict(lambda: defaultdict(int))
        
    def load_data(self, sellers_path: str, hospitals_path: str, adjacency_path: str):
        """
        Fase 1: Carga de datos
        """
        print("📁 Fase 1: Cargando datos...")
        
        # Cargar vendedores
        with open(sellers_path, 'r', encoding='utf-8') as f:
            self.sellers = json.load(f)
        print(f"   ✓ {len(self.sellers)} KAMs cargados")
        
        # Cargar departamentos excluidos
        with open('data/json/excluded_departments.json', 'r') as f:
            excluded_depts = json.load(f)
        excluded_depts_str = [str(d) for d in excluded_depts]  # Convertir a strings
        
        # Cargar hospitales
        self.hospitals = []
        
        with open(hospitals_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f, delimiter='|')
            for row in reader:
                if row['departmentid'] not in excluded_depts_str:
                    self.hospitals.append(row)
        
        print(f"   ✓ {len(self.hospitals)} IPS cargadas (excluyendo departamentos {excluded_depts_str})")
        
        # Cargar matriz de adyacencia
        with open(adjacency_path, 'r', encoding='utf-8') as f:
            self.adjacency_matrix = json.load(f)
        print("   ✓ Matriz de adyacencia cargada")
        
        # Identificar KAMs de Bogotá
        self.bogota_kams = [
            seller for seller in self.sellers 
            if seller['areaId'].startswith('11001')
        ]
        print(f"   ✓ {len(self.bogota_kams)} KAMs operando en Bogotá identificados")
    
    def assign_base_territories(self):
        """
        Fase 2: Asignación de territorios base
        """
        print("\n🏠 Fase 2: Asignando territorios base...")
        
        total_assigned = 0
        excluded_municipalities = set()
        
        for seller in self.sellers:
            area_id = seller['areaId']
            excluded_municipalities.add(area_id)
            
            # Buscar IPS en el territorio base
            base_ips = []
            for hospital in self.hospitals:
                if hospital.get('municipalityid') == area_id or hospital.get('localityid') == area_id:
                    base_ips.append(hospital)
            
            self.assignments[seller['id']] = base_ips
            total_assigned += len(base_ips)
            
            print(f"   ✓ KAM {seller['name']} ({area_id}): {len(base_ips)} IPS en territorio base")
        
        print(f"   📊 Total IPS asignadas automáticamente: {total_assigned}")
        print(f"   🚫 Municipios excluidos de búsqueda: {len(excluded_municipalities)}")
        
        return excluded_municipalities
    
    def calculate_haversine_distance(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
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
    
    def calculate_travel_times(self, candidates_by_kam: Dict[str, List[Dict]]):
        """
        Fase 5: Cálculo de tiempos usando distancia Haversine
        """
        print("\n⏱️  Fase 5: Calculando tiempos de viaje...")
        
        total_calculations = 0
        
        for kam in self.sellers:
            kam_id = kam['id']
            kam_location = (float(kam['lat']), float(kam['lng']))
            self.travel_times[kam_id] = {}
            
            within_range = 0
            total_candidates = len(candidates_by_kam.get(kam_id, []))
            
            for hospital in candidates_by_kam.get(kam_id, []):
                hospital_location = (float(hospital['lat']), float(hospital['lng']))
                
                # Calcular distancia Haversine
                distance = self.calculate_haversine_distance(
                    kam_location[0], kam_location[1],
                    hospital_location[0], hospital_location[1]
                )
                
                # Estimar tiempo (60 km/h promedio)
                time_minutes = (distance / 60) * 60
                
                # Solo guardar si está dentro del límite configurado para este KAM
                max_travel_time = kam.get('expansionConfig', {}).get('maxTravelTime', 240)
                if time_minutes <= max_travel_time:
                    self.travel_times[kam_id][hospital['id_register']] = time_minutes
                    within_range += 1
                
                total_calculations += 1
            
            if total_candidates > 0:
                max_travel_time = kam.get('expansionConfig', {}).get('maxTravelTime', 240)
                print(f"   ✓ KAM {kam['name']}: {within_range}/{total_candidates} IPS dentro de {max_travel_time} min")
        
        print(f"\n   📊 Estadísticas de cálculo:")
        print(f"      - Total cálculos: {total_calculations}")
        print(f"      - Costo estimado API: ${total_calculations * 0.005:.2f}")
    
    def competitive_assignment(self):
        """
        Fase 6: Asignación competitiva con lógica especial para Bogotá
        """
        print("\n🏆 Fase 6: Asignación competitiva...")
        
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
        
        # Procesar IPS de Bogotá (solo compiten KAMs de Bogotá)
        for hospital in bogota_unassigned:
            locality_id = hospital.get('localityid')
            if not locality_id:
                continue
            
            # Solo KAMs de Bogotá pueden competir
            candidates = []
            for kam in self.bogota_kams:
                kam_id = kam['id']
                distance = self.calculate_haversine_distance(
                    float(kam['lat']), float(kam['lng']),
                    float(hospital['lat']), float(hospital['lng'])
                )
                time_minutes = (distance / 40) * 60  # 40 km/h en ciudad
                candidates.append((kam_id, time_minutes))
            
            if candidates:
                candidates.sort(key=lambda x: x[1])
                winner_kam, winner_time = candidates[0]
                
                # Registrar para mayoría
                self.locality_ips_count[locality_id][winner_kam] += 1
                self.assignments[winner_kam].append(hospital)
                
                if len(candidates) > 1:
                    conflicts += 1
        
        # Procesar IPS fuera de Bogotá
        for hospital in other_unassigned:
            candidates = []
            
            for kam_id, times in self.travel_times.items():
                if hospital['id_register'] in times:
                    candidates.append((kam_id, times[hospital['id_register']]))
            
            if candidates:
                candidates.sort(key=lambda x: x[1])
                winner_kam = candidates[0][0]
                self.assignments[winner_kam].append(hospital)
                
                if len(candidates) > 1:
                    conflicts += 1
        
        # Asignar localidades por mayoría
        self._assign_localities_by_majority()
        
        print(f"   ✓ {conflicts} conflictos resueltos")
    
    def _assign_localities_by_majority(self):
        """
        Reasigna localidades completas al KAM con mayoría
        """
        print("\n   📊 Asignando localidades por mayoría...")
        
        localities_reassigned = 0
        
        for locality_id, kam_counts in self.locality_ips_count.items():
            if len(kam_counts) > 1:
                # Encontrar ganador
                winner_kam = max(kam_counts.items(), key=lambda x: x[1])[0]
                
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
    
    def run(self):
        """
        Ejecuta el algoritmo completo
        """
        print("\n🚀 Iniciando algoritmo OpMap con lógica especial para Bogotá...")
        print("="*60)
        
        # Fase 1: Cargar datos
        self.load_data(
            'data/json/sellers.json',
            'data/psv/hospitals.psv',
            'data/json/adjacency_matrix.json'
        )
        
        # Fase 2: Asignar territorios base
        excluded_municipalities = self.assign_base_territories()
        
        # Fase 3: Identificar IPS no asignadas
        print("\n🔍 Fase 3: Identificando IPS no asignadas...")
        assigned_ids = set()
        for kam_id, assigned_list in self.assignments.items():
            assigned_ids.update(h['id_register'] for h in assigned_list)
        
        available_ips = []
        for hospital in self.hospitals:
            if hospital['id_register'] not in assigned_ids:
                if hospital.get('municipalityid') not in excluded_municipalities:
                    available_ips.append(hospital)
        
        print(f"   ✓ {len(available_ips)} IPS disponibles para asignación competitiva")
        
        # Fase 4: Determinar zonas de búsqueda
        print("\n🗺️  Fase 4: Determinando zonas de búsqueda...")
        candidates_by_kam = defaultdict(list)
        
        for kam in self.sellers:
            dept_code = kam['areaId'][:2]
            search_departments = {dept_code}
            
            # Nivel 1: Departamentos limítrofes directos
            if dept_code == '11':  # Bogotá
                search_departments.add('25')  # Cundinamarca
                # Agregar departamentos vecinos de Cundinamarca
                if '25' in self.adjacency_matrix:
                    search_departments.update(self.adjacency_matrix['25'].get('closeDepartments', []))
            elif dept_code in self.adjacency_matrix:
                search_departments.update(self.adjacency_matrix[dept_code].get('closeDepartments', []))
            
            # Nivel 2: Departamentos limítrofes de limítrofes (si está habilitado)
            if kam.get('expansionConfig', {}).get('enableLevel2', False):
                level2_departments = set()
                for dept in list(search_departments):
                    if dept in self.adjacency_matrix:
                        level2_departments.update(self.adjacency_matrix[dept].get('closeDepartments', []))
                search_departments.update(level2_departments)
            
            for hospital in available_ips:
                if hospital.get('departmentid') in search_departments:
                    candidates_by_kam[kam['id']].append(hospital)
            
            print(f"   ✓ KAM {kam['name']}: {len(candidates_by_kam[kam['id']])} IPS candidatas")
        
        # Fase 5: Calcular tiempos
        self.calculate_travel_times(candidates_by_kam)
        
        # Fase 6: Asignación competitiva
        self.competitive_assignment()
        
        return self.assignments


# =====================================================
# VISUALIZADOR DE MAPA LIMPIO
# =====================================================

class CleanMapVisualizer:
    """
    Genera visualizaciones limpias solo con IPS y KAMs.
    """
    
    def __init__(self):
        self.center = [4.5709, -74.2973]
        self.zoom_start = 6
        # Colores distintivos para cada KAM
        self.kam_color_mapping = {
            'barranquilla': '#FF6B6B',  # Rojo coral
            'bucaramanga': '#4ECDC4',   # Turquesa
            'cali': '#45B7D1',          # Azul cielo
            'cartagena': '#96CEB4',     # Verde menta
            'cucuta': '#FECA57',        # Amarillo dorado
            'medellin': '#FF9FF3',      # Rosa
            'monteria': '#54A0FF',      # Azul brillante
            'neiva': '#8B4513',         # Marrón (distintivo de rojos)
            'pasto': '#1DD1A1',         # Verde esmeralda
            'pereira': '#FF7675',       # Rojo claro
            'sincelejo': '#A29BFE',     # Lavanda
            'chapinero': '#FD79A8',     # Rosa chicle
            'engativa': '#FDCB6E',      # Amarillo
            'sancristobal': '#6C5CE7',  # Púrpura
            'kennedy': '#00D2D3',       # Cian
            'valledupar': '#2ECC71'     # Verde
        }
        # Lista de respaldo para KAMs adicionales
        self.kam_colors = [
            '#E74C3C', '#3498DB', '#2ECC71', '#F39C12', '#9B59B6',
            '#1ABC9C', '#34495E', '#E67E22', '#16A085', '#8E44AD'
        ]
        self.unassigned_color = '#E0E0E0'
        self.excluded_color = '#4A4A4A'  # Gris oscuro para departamentos excluidos
    
    def create_map(self, assignments: Dict, output_file: str):
        """
        Crea un mapa limpio con solo IPS y KAMs
        """
        print("\n🗺️  Generando mapa limpio...")
        
        # Cargar información de KAMs
        with open('data/json/sellers.json', 'r') as f:
            sellers = json.load(f)
        kam_info = {s['id']: s for s in sellers}
        
        # Crear mapa base
        m = folium.Map(
            location=self.center,
            zoom_start=self.zoom_start,
            tiles='CartoDB positron',
            prefer_canvas=True
        )
        
        # Asignar colores usando el mapeo específico
        kam_colors = {}
        backup_idx = 0
        for kam_id in assignments.keys():
            if kam_id in self.kam_color_mapping:
                kam_colors[kam_id] = self.kam_color_mapping[kam_id]
            else:
                # Usar color de respaldo si no está en el mapeo
                kam_colors[kam_id] = self.kam_colors[backup_idx % len(self.kam_colors)]
                backup_idx += 1
        
        # Crear capas
        excluded_layer = folium.FeatureGroup(name='Territorios Excluidos', show=True)
        territories_layer = folium.FeatureGroup(name='Territorios', show=True)
        ips_layer = folium.FeatureGroup(name='IPS', show=True)
        kam_layer = folium.FeatureGroup(name='KAMs', show=True)
        
        # Analizar asignaciones
        kam_territories = defaultdict(set)
        territories_with_ips = set()
        ips_locations = []
        territory_stats = defaultdict(lambda: {'ips_count': 0, 'beds': 0, 'population': 0, 'ips_list': []})
        kam_stats = defaultdict(lambda: {'territories': set(), 'ips_count': 0, 'beds': 0, 'population': 0})
        # Nuevo: contar IPS por KAM en cada territorio
        territory_kam_count = defaultdict(lambda: defaultdict(int))
        
        for kam_id, ips_list in assignments.items():
            for ips in ips_list:
                if not ips.get('is_population_only', False):
                    # Información de IPS
                    beds = int(ips.get('camas', 0))
                    territory_id = ips.get('localityid') or ips.get('municipalityid')
                    
                    ips_locations.append({
                        'lat': float(ips['lat']),
                        'lng': float(ips['lng']),
                        'name': ips.get('name_register', 'IPS'),
                        'kam_id': kam_id,
                        'municipality': ips.get('municipalityname', ''),
                        'locality': ips.get('localityname', ''),
                        'department': ips.get('departmentname', ''),
                        'color': kam_colors[kam_id],
                        'beds': beds,
                        'kam_name': kam_info.get(kam_id, {}).get('name', kam_id)
                    })
                    
                    if territory_id:
                        territories_with_ips.add(territory_id)
                        # Contar IPS por KAM en este territorio
                        territory_kam_count[territory_id][kam_id] += 1
                        
                        # Estadísticas por territorio
                        territory_stats[territory_id]['ips_count'] += 1
                        territory_stats[territory_id]['beds'] += beds
                        territory_stats[territory_id]['ips_list'].append(ips['name_register'])
                        
                        # Estadísticas por KAM
                        kam_stats[kam_id]['territories'].add(territory_id)
                        kam_stats[kam_id]['ips_count'] += 1
                        kam_stats[kam_id]['beds'] += beds
                else:
                    # Es solo población
                    territory_id = ips.get('localityid') or ips.get('municipalityid')
                    population = int(ips.get('population', 0))
                    if territory_id:
                        territory_stats[territory_id]['population'] += population
                        kam_stats[kam_id]['population'] += population
        
        # Determinar el KAM ganador por territorio (mayoría)
        territory_winner = {}
        for territory_id, kam_counts in territory_kam_count.items():
            if kam_counts:
                # Encontrar el KAM con más IPS en este territorio
                winner_kam = max(kam_counts.items(), key=lambda x: x[1])[0]
                territory_winner[territory_id] = winner_kam
                kam_territories[winner_kam].add(territory_id)
        
        # Dibujar solo territorios con IPS
        territories_drawn = 0
        
        # Municipios
        municipalities_path = 'data/geojson/municipalities'
        if os.path.exists(municipalities_path):
            for territory_id in territories_with_ips:
                if len(territory_id) == 5:
                    self._draw_territory(
                        territory_id, municipalities_path, 
                        territory_winner, kam_colors, territories_layer,
                        is_locality=False,
                        territory_stats=territory_stats,
                        kam_info=kam_info
                    )
                    territories_drawn += 1
        
        # Localidades
        localities_path = 'data/geojson/localities'
        if os.path.exists(localities_path):
            for territory_id in territories_with_ips:
                if len(territory_id) == 7:
                    self._draw_territory(
                        territory_id, localities_path, 
                        territory_winner, kam_colors, territories_layer,
                        is_locality=True,
                        territory_stats=territory_stats,
                        kam_info=kam_info
                    )
                    territories_drawn += 1
        
        print(f"   ✓ {territories_drawn} territorios con IPS dibujados")
        
        # Dibujar departamentos excluidos en gris oscuro
        excluded_drawn = 0
        try:
            # Cargar departamentos excluidos
            with open('data/json/excluded_departments.json', 'r') as f:
                excluded_depts = [str(d) for d in json.load(f)]
            
            # Cargar información de departamentos para nombres
            dept_names = {}
            with open('data/psv/departments.psv', 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f, delimiter='|')
                for row in reader:
                    dept_names[row['id']] = row['name']
            
            # Buscar y dibujar municipios de departamentos excluidos
            for dept_code in excluded_depts:
                dept_path = f'data/geojson/departments/{dept_code}.geojson'
                if os.path.exists(dept_path):
                    try:
                        with open(dept_path, 'r') as f:
                            geojson_data = json.load(f)
                        
                        dept_name = dept_names.get(dept_code, f'Departamento {dept_code}')
                        
                        # Crear popup para departamento excluido
                        popup_html = f"""
                        <div style='font-family: Arial, sans-serif; font-size: 12px; min-width: 200px;'>
                            <h4 style='margin: 0 0 8px 0; color: #2c3e50;'>{dept_name}</h4>
                            <p style='color: #e74c3c; font-weight: bold;'>
                                ⚠️ Territorio Excluido
                            </p>
                            <p style='font-size: 11px; color: #666;'>
                                Este departamento no está incluido<br>
                                en la asignación territorial debido<br>
                                a su ubicación remota.
                            </p>
                        </div>
                        """
                        
                        folium.GeoJson(
                            geojson_data,
                            style_function=lambda x: {
                                'fillColor': self.excluded_color,
                                'color': '#2c3e50',
                                'weight': 1.0,
                                'fillOpacity': 0.6,
                                'dashArray': '5, 5'  # Línea punteada
                            },
                            popup=folium.Popup(popup_html, max_width=250)
                        ).add_to(excluded_layer)
                        
                        excluded_drawn += 1
                    except:
                        pass
        except:
            pass
        
        if excluded_drawn > 0:
            print(f"   ✓ {excluded_drawn} departamentos excluidos dibujados")
        
        # Agregar puntos de IPS
        for ips in ips_locations:
            # Crear tooltip con toda la información
            tooltip_html = f"""
            <div style="font-family: Arial, sans-serif; min-width: 180px; padding: 5px;">
                <b style="font-size: 14px;">{ips['name']}</b><br>
                <table style="margin-top: 5px; font-size: 12px;">
                    <tr>
                        <td style="padding-right: 10px;"><b>Camas:</b></td>
                        <td>{ips.get('beds', 0)}</td>
                    </tr>
                    <tr>
                        <td style="padding-right: 10px;"><b>Municipio:</b></td>
                        <td>{ips['municipality']}</td>
                    </tr>
                    <tr>
                        <td style="padding-right: 10px;"><b>Departamento:</b></td>
                        <td>{ips['department']}</td>
                    </tr>
                    <tr>
                        <td style="padding-right: 10px;"><b>Asignado a:</b></td>
                        <td style="color: {ips['color']};">{ips['kam_name']}</td>
                    </tr>
                </table>
            </div>
            """
            
            folium.CircleMarker(
                location=[ips['lat'], ips['lng']],
                radius=4,
                tooltip=folium.Tooltip(tooltip_html, sticky=False),
                color='#222222',
                fillColor=ips['color'],
                fillOpacity=0.9,
                weight=0.5
            ).add_to(ips_layer)
        
        # Agregar marcadores de KAMs
        for kam_id, kam in kam_info.items():
            if kam_id in assignments and kam_id in kam_stats:
                stats = kam_stats[kam_id]
                
                # Crear popup detallado para KAM
                popup_html = f"""
                <div style='font-family: Arial, sans-serif; font-size: 12px; min-width: 280px;'>
                    <h4 style='margin: 0 0 8px 0; color: #2c3e50;'>{kam['name']}</h4>
                    
                    <div style='background-color: #f8f9fa; padding: 8px; border-radius: 4px; margin-bottom: 8px;'>
                        <table style='width: 100%; border-collapse: collapse;'>
                            <tr>
                                <td style='padding: 4px 0;'><b>👤 Responsable:</b></td>
                                <td style='padding: 4px 0;'>{kam.get('kamPerson', 'N/A')}</td>
                            </tr>
                            <tr>
                                <td style='padding: 4px 0;'><b>📍 Ubicación:</b></td>
                                <td style='padding: 4px 0;'>{kam.get('address', 'N/A')}</td>
                            </tr>
                        </table>
                    </div>
                    
                    <div style='background-color: #e8f4f8; padding: 8px; border-radius: 4px;'>
                        <b>📊 Estadísticas del territorio:</b>
                        <table style='width: 100%; margin-top: 4px;'>
                            <tr>
                                <td style='padding: 4px 0;'>🏘️ Municipios/Localidades:</td>
                                <td style='padding: 4px 0; text-align: right;'><b>{len(stats['territories'])}</b></td>
                            </tr>
                            <tr>
                                <td style='padding: 4px 0;'>👥 Población total:</td>
                                <td style='padding: 4px 0; text-align: right;'><b>{stats['population']:,}</b></td>
                            </tr>
                            <tr>
                                <td style='padding: 4px 0;'>🏥 IPS asignadas:</td>
                                <td style='padding: 4px 0; text-align: right;'><b>{stats['ips_count']}</b></td>
                            </tr>
                            <tr>
                                <td style='padding: 4px 0;'>🛏️ Total camas:</td>
                                <td style='padding: 4px 0; text-align: right;'><b>{stats['beds']:,}</b></td>
                            </tr>
                        </table>
                    </div>
                </div>
                """
                
                # Crear marcador tipo perfil con el color del KAM
                folium.Marker(
                    location=[float(kam['lat']), float(kam['lng'])],
                    popup=folium.Popup(popup_html, max_width=320),
                    tooltip=folium.Tooltip(
                        f"<b>{kam['name']}</b><br>{stats['ips_count']} IPS | {len(stats['territories'])} territorios",
                        sticky=False
                    ),
                    icon=folium.DivIcon(
                        html=f'''
                        <div style="text-align: center;">
                            <div style="
                                width: 36px;
                                height: 36px;
                                background-color: {kam_colors[kam_id]};
                                border: 3px solid #ffffff;
                                border-radius: 50%;
                                box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                                display: flex;
                                align-items: center;
                                justify-content: center;
                            ">
                                <i class="fa fa-user" style="
                                    color: white;
                                    font-size: 18px;
                                    text-shadow: 1px 1px 1px rgba(0,0,0,0.5);
                                "></i>
                            </div>
                            <div style="
                                width: 0;
                                height: 0;
                                border-left: 8px solid transparent;
                                border-right: 8px solid transparent;
                                border-top: 10px solid {kam_colors[kam_id]};
                                margin: -3px auto 0 auto;
                            "></div>
                        </div>
                        ''',
                        icon_size=(36, 46),
                        icon_anchor=(18, 46)
                    )
                ).add_to(kam_layer)
        
        # Agregar capas al mapa
        excluded_layer.add_to(m)
        territories_layer.add_to(m)
        ips_layer.add_to(m)
        kam_layer.add_to(m)
        
        # Agregar leyenda
        self._add_legend(m)
        
        # Control de capas
        folium.LayerControl(position='topright', collapsed=False).add_to(m)
        
        # Guardar mapa
        m.save(output_file)
        print(f"   ✓ Mapa guardado en: {output_file}")
    
    def _draw_territory(self, territory_id, base_path, territory_winner, 
                       kam_colors, layer, is_locality=False, 
                       territory_stats=None, kam_info=None):
        """
        Dibuja un territorio en el mapa con popup informativo
        """
        filename = f"{territory_id}.geojson"
        filepath = os.path.join(base_path, filename)
        
        if os.path.exists(filepath):
            # Obtener el KAM ganador para este territorio
            assigned_kam = territory_winner.get(territory_id)
            
            if assigned_kam:
                color = kam_colors[assigned_kam]
                
                try:
                    with open(filepath, 'r') as f:
                        geojson_data = json.load(f)
                    
                    # Obtener estadísticas del territorio
                    stats = territory_stats.get(territory_id, {}) if territory_stats else {}
                    
                    # Si no hay población en stats, cargarla del archivo PSV
                    if stats.get('population', 0) == 0:
                        if is_locality:
                            # Cargar población de localidades
                            try:
                                with open('data/psv/localities.psv', 'r', encoding='utf-8') as f:
                                    reader = csv.DictReader(f, delimiter='|')
                                    for row in reader:
                                        if row['id'] == territory_id:
                                            stats['population'] = int(row.get('population2025', 0))
                                            break
                            except:
                                pass
                        else:
                            # Cargar población de municipios
                            try:
                                with open('data/psv/municipalities.psv', 'r', encoding='utf-8') as f:
                                    reader = csv.DictReader(f, delimiter='|')
                                    for row in reader:
                                        if row['id'] == territory_id:
                                            stats['population'] = int(row.get('population2025', 0))
                                            break
                            except:
                                pass
                    
                    # Obtener nombre del territorio
                    territory_name = territory_id
                    if is_locality:
                        # Nombres de localidades de Bogotá
                        locality_names = {
                            '1100101': 'Usaquén', '1100102': 'Chapinero', '1100103': 'Santa Fe',
                            '1100104': 'San Cristóbal', '1100105': 'Usme', '1100106': 'Tunjuelito',
                            '1100107': 'Bosa', '1100108': 'Kennedy', '1100109': 'Fontibón',
                            '1100110': 'Engativá', '1100111': 'Suba', '1100112': 'Barrios Unidos',
                            '1100113': 'Teusaquillo', '1100114': 'Los Mártires', '1100115': 'Antonio Nariño',
                            '1100116': 'Puente Aranda', '1100117': 'La Candelaria', '1100118': 'Rafael Uribe Uribe',
                            '1100119': 'Ciudad Bolívar', '1100120': 'Sumapaz'
                        }
                        territory_name = locality_names.get(territory_id, f'Localidad {territory_id}')
                    else:
                        # Para municipios, buscar el nombre en el archivo PSV
                        try:
                            with open('data/psv/municipalities.psv', 'r', encoding='utf-8') as f:
                                reader = csv.DictReader(f, delimiter='|')
                                for row in reader:
                                    if row['id'] == territory_id:
                                        territory_name = row.get('name', territory_id)
                                        break
                        except:
                            territory_name = f'Municipio {territory_id}'
                    
                    # Crear popup HTML
                    popup_html = f"""
                    <div style='font-family: Arial, sans-serif; font-size: 12px; min-width: 250px;'>
                        <h4 style='margin: 0 0 8px 0; color: #2c3e50;'>{territory_name}</h4>
                        
                        <table style='width: 100%; border-collapse: collapse;'>
                            <tr>
                                <td style='padding: 4px 0;'><b>👔 KAM:</b></td>
                                <td style='padding: 4px 0;'>{kam_info[assigned_kam]['name'] if kam_info else assigned_kam}</td>
                            </tr>
                            <tr>
                                <td style='padding: 4px 0;'><b>👥 Población:</b></td>
                                <td style='padding: 4px 0;'>{stats.get('population', 0):,}</td>
                            </tr>
                            <tr>
                                <td style='padding: 4px 0;'><b>🏥 IPS:</b></td>
                                <td style='padding: 4px 0;'>{stats.get('ips_count', 0)}</td>
                            </tr>
                            <tr>
                                <td style='padding: 4px 0;'><b>🛏️ Camas:</b></td>
                                <td style='padding: 4px 0;'>{stats.get('beds', 0)}</td>
                            </tr>
                        </table>
                    </div>
                    """
                    
                    style = {
                        'fillColor': color,
                        'color': '#000000' if is_locality else '#333333',
                        'weight': 1.5 if is_locality else 0.8,
                        'fillOpacity': 0.5 if is_locality else 0.4
                    }
                    
                    folium.GeoJson(
                        geojson_data,
                        style_function=lambda x, style=style: style,
                        popup=folium.Popup(popup_html, max_width=300)
                    ).add_to(layer)
                except:
                    pass
    
    def _add_legend(self, map_obj):
        """
        Agrega leyenda al mapa
        """
        legend_html = '''
        <div style="position: fixed; 
                    bottom: 30px; right: 10px; width: 260px;
                    background-color: rgba(255,255,255,0.95); z-index: 1000; 
                    border: 1px solid #ccc; border-radius: 8px;
                    padding: 12px; font-size: 12px; box-shadow: 0 2px 6px rgba(0,0,0,0.2);">
        <h4 style="margin: 0 0 8px 0; font-size: 14px; color: #333;">Convenciones</h4>
        <div style="margin-bottom: 6px;">
            <i class="fa fa-user" style="color: #000; font-size: 14px;"></i> 
            <span style="vertical-align: middle;">KAM (Key Account Manager)</span>
        </div>
        <div style="margin-bottom: 6px;">
            <span style="display: inline-block; width: 12px; height: 12px; 
                         background-color: #888; border-radius: 50%; 
                         border: 1px solid #222; vertical-align: middle;"></span> 
            <span style="vertical-align: middle;">Institución Prestadora de Salud</span>
        </div>
        <div style="margin-bottom: 6px;">
            <span style="display: inline-block; width: 30px; height: 12px; 
                         background-color: #888; opacity: 0.4;
                         border: 1px solid #333; vertical-align: middle;"></span> 
            <span style="vertical-align: middle;">Territorio asignado</span>
        </div>
        <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid #ddd; font-size: 11px; color: #666;">
            <i class="fa fa-info-circle"></i> Los colores identifican a cada KAM<br>
            y su zona de cobertura asignada
        </div>
        </div>
        '''
        map_obj.get_root().html.add_child(folium.Element(legend_html))


# =====================================================
# FUNCIÓN PRINCIPAL
# =====================================================

def main():
    """
    Ejecuta el algoritmo completo y genera el mapa
    """
    print("="*60)
    print("   🗺️  OpMap Bogotá - Sistema Completo")
    print("="*60)
    print(f"📅 Fecha: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*60)
    
    # Ejecutar algoritmo
    start_time = time.time()
    algorithm = BogotaOpMapAlgorithm()
    assignments = algorithm.run()
    
    # Preparar datos para guardar
    output_data = {
        'metadata': {
            'timestamp': datetime.now().strftime('%Y%m%d_%H%M%S'),
            'algorithm': 'BogotaOpMapAlgorithm',
            'execution_time_seconds': time.time() - start_time
        },
        'assignments': assignments
    }
    
    # Guardar resultados
    os.makedirs('output', exist_ok=True)
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    
    json_file = f'output/opmap_results_{timestamp}.json'
    with open(json_file, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)
    
    print(f"\n✅ Resultados guardados en: {json_file}")
    
    # Generar mapa
    visualizer = CleanMapVisualizer()
    map_file = f'output/opmap_map_{timestamp}.html'
    visualizer.create_map(assignments, map_file)
    
    print(f"\n✅ Proceso completado en {time.time() - start_time:.2f} segundos")
    print(f"📍 Abrir mapa: file://{os.path.abspath(map_file)}")
    
    # Intentar abrir en navegador
    try:
        import webbrowser
        webbrowser.open(f"file://{os.path.abspath(map_file)}")
        print("🌐 Abriendo en navegador...")
    except:
        pass


if __name__ == "__main__":
    main()