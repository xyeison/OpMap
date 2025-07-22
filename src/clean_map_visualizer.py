"""
Visualizador limpio de mapas para OpMap.
Solo muestra puntos de IPS y KAMs, sin marcadores de municipios.
Colorea solo las áreas que tienen IPS asignadas.
"""

import json
import os
from typing import Dict, List, Tuple
import folium
from folium import plugins
import branca.colormap as cm
from collections import defaultdict
import random

class CleanMapVisualizer:
    """
    Genera visualizaciones limpias solo con IPS y KAMs.
    """
    
    def __init__(self):
        # Centro de Colombia
        self.center = [4.5709, -74.2973]
        self.zoom_start = 6
        
        # Colores predefinidos para cada KAM (colores distintos y vibrantes)
        self.kam_colors = [
            '#FF6B6B',  # Rojo coral
            '#4ECDC4',  # Turquesa
            '#45B7D1',  # Azul cielo
            '#96CEB4',  # Verde menta
            '#FECA57',  # Amarillo
            '#FF9FF3',  # Rosa
            '#54A0FF',  # Azul brillante
            '#48DBFB',  # Azul claro
            '#1DD1A1',  # Verde esmeralda
            '#FF7675',  # Rosa salmón
            '#A29BFE',  # Lavanda
            '#FD79A8',  # Rosa chicle
            '#FDCB6E',  # Naranja claro
            '#6C5CE7',  # Púrpura
            '#00D2D3',  # Cian
            '#FF6348',  # Tomate
        ]
        
        # Color para zonas sin asignar - gris claro
        self.unassigned_color = '#E0E0E0'
        
    def create_clean_map(self, assignments_file: str, output_file: str):
        """
        Crea un mapa limpio con solo IPS y KAMs.
        """
        print("🗺️  Generando visualización limpia del mapa...")
        
        # Cargar asignaciones
        with open(assignments_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        assignments = data['assignments']
        
        # Cargar información de KAMs
        with open('data/json/sellers.json', 'r') as f:
            sellers = json.load(f)
        
        # Crear diccionario de KAM ID a información
        kam_info = {s['id']: s for s in sellers}
        
        # Crear mapa base con estilo minimalista
        m = folium.Map(
            location=self.center,
            zoom_start=self.zoom_start,
            tiles='CartoDB positron',
            prefer_canvas=True
        )
        
        # Asignar colores a cada KAM
        kam_colors = {}
        color_idx = 0
        for kam_id in assignments.keys():
            kam_colors[kam_id] = self.kam_colors[color_idx % len(self.kam_colors)]
            color_idx += 1
        
        # Crear capas
        territories_layer = folium.FeatureGroup(name='Territorios', show=True)
        ips_layer = folium.FeatureGroup(name='IPS', show=True)
        kam_layer = folium.FeatureGroup(name='KAMs', show=True)
        
        # Analizar asignaciones
        kam_territories = defaultdict(set)  # kam_id -> set de municipality/locality IDs
        territories_with_ips = set()  # Territorios que tienen IPS reales
        ips_locations = []  # Lista de ubicaciones de IPS
        
        for kam_id, ips_list in assignments.items():
            for ips in ips_list:
                # Si es una IPS real (no solo población)
                if not ips.get('is_population_only', False):
                    # Guardar ubicación de IPS con información
                    ips_locations.append({
                        'lat': float(ips['lat']),
                        'lng': float(ips['lng']),
                        'name': ips.get('name_register', 'IPS'),
                        'kam_id': kam_id,
                        'municipality': ips.get('municipalityname', ''),
                        'locality': ips.get('localityname', ''),
                        'color': kam_colors[kam_id],
                        'service_level': ips.get('atencion_nivel', ''),
                        'complexity': ips.get('complexity', ''),
                        'services': ips.get('services', ''),
                        'camas': ips.get('camas', 0),
                        'quirofano': ips.get('quirofano', 0),
                        'ambulancias': ips.get('ambulancias', 0)
                    })
                    
                    # Marcar el territorio como que tiene IPS
                    if ips.get('localityid'):
                        territories_with_ips.add(ips['localityid'])
                        kam_territories[kam_id].add(ips['localityid'])
                    elif ips.get('municipalityid'):
                        territories_with_ips.add(ips['municipalityid'])
                        kam_territories[kam_id].add(ips['municipalityid'])
        
        print(f"   ✓ {len(kam_territories)} territorios de KAM identificados")
        print(f"   ✓ {len(ips_locations)} ubicaciones de IPS reales")
        
        # Dibujar solo territorios que tienen IPS
        territories_drawn = 0
        
        # Dibujar municipios con IPS
        municipalities_path = 'data/geojson/municipalities'
        if os.path.exists(municipalities_path):
            for territory_id in territories_with_ips:
                if len(territory_id) == 5:  # Es un municipio
                    filename = f"{territory_id}.geojson"
                    filepath = os.path.join(municipalities_path, filename)
                    
                    if os.path.exists(filepath):
                        # Encontrar a qué KAM pertenece
                        assigned_kam = None
                        for kam_id, territories in kam_territories.items():
                            if territory_id in territories:
                                assigned_kam = kam_id
                                break
                        
                        if assigned_kam:
                            color = kam_colors[assigned_kam]
                            kam_name = kam_info[assigned_kam]['name']
                            
                            try:
                                with open(filepath, 'r') as f:
                                    geojson_data = json.load(f)
                                
                                folium.GeoJson(
                                    geojson_data,
                                    style_function=lambda x, color=color: {
                                        'fillColor': color,
                                        'color': '#333333',
                                        'weight': 0.8,
                                        'fillOpacity': 0.4
                                    }
                                ).add_to(territories_layer)
                                
                                territories_drawn += 1
                            except:
                                pass
        
        # Dibujar localidades con IPS (Bogotá)
        localities_path = 'data/geojson/localities'
        if os.path.exists(localities_path):
            for territory_id in territories_with_ips:
                if len(territory_id) == 7:  # Es una localidad
                    filename = f"{territory_id}.geojson"
                    filepath = os.path.join(localities_path, filename)
                    
                    if os.path.exists(filepath):
                        # Encontrar a qué KAM pertenece
                        assigned_kam = None
                        for kam_id, territories in kam_territories.items():
                            if territory_id in territories:
                                assigned_kam = kam_id
                                break
                        
                        if assigned_kam:
                            color = kam_colors[assigned_kam]
                            
                            try:
                                with open(filepath, 'r') as f:
                                    geojson_data = json.load(f)
                                
                                folium.GeoJson(
                                    geojson_data,
                                    style_function=lambda x, color=color: {
                                        'fillColor': color,
                                        'color': '#000000',
                                        'weight': 1.5,
                                        'fillOpacity': 0.5
                                    }
                                ).add_to(territories_layer)
                                
                                territories_drawn += 1
                            except:
                                pass
        
        print(f"   ✓ {territories_drawn} territorios con IPS dibujados")
        
        # Agregar puntos de IPS
        for ips in ips_locations:
            # Determinar tamaño basado en nivel de servicio
            service_level = int(ips['service_level']) if str(ips['service_level']).isdigit() else 1
            radius = 3 + (service_level * 1.0)  # Tamaño más uniforme
            
            # Crear tooltip simple
            tooltip_text = f"<b>{ips['name']}</b><br>"
            if ips['locality']:
                tooltip_text += f"{ips['locality']}, Bogotá"
            else:
                tooltip_text += f"{ips['municipality']}"
            
            folium.CircleMarker(
                location=[ips['lat'], ips['lng']],
                radius=radius,
                tooltip=folium.Tooltip(tooltip_text, sticky=False),
                color='#222222',
                fillColor=ips['color'],
                fillOpacity=0.9,
                weight=0.5
            ).add_to(ips_layer)
        
        # Agregar marcadores de KAMs
        for kam_id, kam in kam_info.items():
            if kam_id in assignments:
                # Contar IPS reales
                real_ips = sum(1 for ips in assignments[kam_id] if not ips.get('is_population_only', False))
                
                folium.Marker(
                    location=[float(kam['lat']), float(kam['lng'])],
                    tooltip=folium.Tooltip(
                        f"<b>{kam['name']}</b><br>{real_ips} IPS",
                        sticky=False
                    ),
                    icon=folium.Icon(
                        color='darkblue',
                        icon='user-tie',
                        prefix='fa'
                    )
                ).add_to(kam_layer)
        
        # Agregar capas al mapa
        territories_layer.add_to(m)
        ips_layer.add_to(m)
        kam_layer.add_to(m)
        
        # Leyenda simplificada
        legend_html = '''
        <div style="position: fixed; 
                    bottom: 30px; right: 10px; width: 200px;
                    background-color: rgba(255,255,255,0.95); z-index: 1000; 
                    border: 1px solid #ccc; border-radius: 8px;
                    padding: 10px; font-size: 12px; box-shadow: 0 2px 6px rgba(0,0,0,0.2);">
        <h4 style="margin: 0 0 8px 0; font-size: 14px; color: #333;">Leyenda</h4>
        <div style="margin-bottom: 4px;">
            <i class="fa fa-user-tie" style="color: #00008B;"></i> KAM (Vendedor)
        </div>
        <div style="margin-bottom: 4px;">
            <span style="display: inline-block; width: 12px; height: 12px; 
                         background-color: #FF6B6B; border-radius: 50%; 
                         border: 1px solid #222;"></span> IPS asignada
        </div>
        <div style="margin-bottom: 4px;">
            <span style="display: inline-block; width: 30px; height: 12px; 
                         background-color: #FF6B6B; opacity: 0.4;
                         border: 1px solid #333;"></span> Territorio con IPS
        </div>
        <div style="margin-top: 8px; font-size: 11px; color: #666;">
            Solo se muestran territorios<br>con IPS asignadas
        </div>
        </div>
        '''
        m.get_root().html.add_child(folium.Element(legend_html))
        
        # Control de capas
        folium.LayerControl(position='topright', collapsed=False).add_to(m)
        
        # Guardar mapa
        m.save(output_file)
        print(f"   ✓ Mapa limpio guardado en: {output_file}")