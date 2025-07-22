"""
Visualizador de mapas para OpMap.
Genera un mapa interactivo con los territorios asignados a cada KAM.
"""

import json
import os
from typing import Dict, List, Tuple
import folium
from folium import plugins
import branca.colormap as cm
from collections import defaultdict
import random

class MapVisualizer:
    """
    Genera visualizaciones de mapas con territorios coloreados por KAM.
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
            '#30336B',  # Azul marino
            '#95AFC0',  # Gris azulado
            '#535C68',  # Gris oscuro
            '#7BED9F'   # Verde claro
        ]
        
        # Color para zonas sin asignar
        self.unassigned_color = '#E0E0E0'
        
        # Color para departamentos excluidos
        self.excluded_color = '#F5F5F5'
        
    def create_territory_map(self, assignments_file: str, output_file: str):
        """
        Crea un mapa con los territorios coloreados según las asignaciones.
        
        Args:
            assignments_file: Archivo JSON con las asignaciones de OpMap
            output_file: Archivo HTML de salida para el mapa
        """
        print("🗺️  Generando visualización del mapa...")
        
        # Cargar asignaciones
        with open(assignments_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        assignments = data['assignments']
        
        # Cargar información de KAMs
        with open('data/json/sellers.json', 'r') as f:
            sellers = json.load(f)
        
        # Crear diccionario de KAM ID a información
        kam_info = {s['id']: s for s in sellers}
        
        # Crear mapa base
        m = folium.Map(
            location=self.center,
            zoom_start=self.zoom_start,
            tiles='CartoDB positron',  # Mapa más limpio y sutil
            prefer_canvas=True
        )
        
        # Asignar colores a cada KAM
        kam_colors = {}
        color_idx = 0
        for kam_id in assignments.keys():
            kam_colors[kam_id] = self.kam_colors[color_idx % len(self.kam_colors)]
            color_idx += 1
        
        # Extraer todos los municipios/localidades asignados por KAM
        kam_territories = defaultdict(set)  # kam_id -> set de municipality/locality IDs
        
        for kam_id, ips_list in assignments.items():
            for ips in ips_list:
                # Agregar municipio
                if 'municipalityid' in ips and ips['municipalityid']:
                    kam_territories[kam_id].add(ips['municipalityid'])
                # Agregar localidad (para Bogotá)
                if 'localityid' in ips and ips['localityid']:
                    kam_territories[kam_id].add(ips['localityid'])
        
        # También agregar los territorios base de cada KAM
        for kam_id, kam in kam_info.items():
            kam_territories[kam_id].add(kam['areaId'])
        
        print(f"   ✓ {len(kam_territories)} territorios de KAM identificados")
        
        # Cargar y dibujar municipios
        municipalities_drawn = 0
        municipalities_path = 'data/geojson/municipalities'
        
        if os.path.exists(municipalities_path):
            for filename in os.listdir(municipalities_path):
                if filename.endswith('.geojson'):
                    municipality_id = filename.replace('.geojson', '')
                    
                    # Encontrar a qué KAM pertenece este municipio
                    assigned_kam = None
                    for kam_id, territories in kam_territories.items():
                        if municipality_id in territories:
                            assigned_kam = kam_id
                            break
                    
                    # Determinar color
                    if assigned_kam:
                        color = kam_colors[assigned_kam]
                        kam_name = kam_info[assigned_kam]['name']
                    else:
                        color = self.unassigned_color
                        kam_name = 'Sin asignar'
                    
                    # Cargar GeoJSON
                    try:
                        with open(os.path.join(municipalities_path, filename), 'r') as f:
                            geojson_data = json.load(f)
                        
                        # Agregar el polígono al mapa
                        folium.GeoJson(
                            geojson_data,
                            style_function=lambda x, color=color: {
                                'fillColor': color,
                                'color': '#000000',
                                'weight': 0.5,
                                'fillOpacity': 0.7
                            },
                            tooltip=folium.Tooltip(
                                f"Municipio: {municipality_id}<br>KAM: {kam_name}"
                            )
                        ).add_to(m)
                        
                        municipalities_drawn += 1
                    except Exception as e:
                        pass  # Ignorar errores de archivos individuales
        
        print(f"   ✓ {municipalities_drawn} municipios dibujados")
        
        # Cargar y dibujar localidades (Bogotá)
        localities_drawn = 0
        localities_path = 'data/geojson/localities'
        
        if os.path.exists(localities_path):
            for filename in os.listdir(localities_path):
                if filename.endswith('.geojson'):
                    locality_id = filename.replace('.geojson', '')
                    
                    # Encontrar a qué KAM pertenece esta localidad
                    assigned_kam = None
                    for kam_id, territories in kam_territories.items():
                        if locality_id in territories:
                            assigned_kam = kam_id
                            break
                    
                    # Determinar color
                    if assigned_kam:
                        color = kam_colors[assigned_kam]
                        kam_name = kam_info[assigned_kam]['name']
                    else:
                        color = self.unassigned_color
                        kam_name = 'Sin asignar'
                    
                    # Cargar GeoJSON
                    try:
                        with open(os.path.join(localities_path, filename), 'r') as f:
                            geojson_data = json.load(f)
                        
                        # Agregar el polígono al mapa
                        folium.GeoJson(
                            geojson_data,
                            style_function=lambda x, color=color: {
                                'fillColor': color,
                                'color': '#000000',
                                'weight': 1,
                                'fillOpacity': 0.7
                            },
                            tooltip=folium.Tooltip(
                                f"Localidad: {locality_id}<br>KAM: {kam_name}"
                            )
                        ).add_to(m)
                        
                        localities_drawn += 1
                    except Exception as e:
                        pass  # Ignorar errores de archivos individuales
        
        print(f"   ✓ {localities_drawn} localidades dibujadas")
        
        # Agregar marcadores para cada KAM
        for kam_id, kam in kam_info.items():
            if kam_id in assignments and len(assignments[kam_id]) > 0:
                folium.Marker(
                    location=[float(kam['lat']), float(kam['lng'])],
                    popup=folium.Popup(
                        f"<b>{kam['name']}</b><br>"
                        f"Municipio/Localidad: {kam['areaId']}<br>"
                        f"IPS asignadas: {len(assignments[kam_id])}<br>"
                        f"Color: <span style='color:{kam_colors[kam_id]}'>●</span>",
                        max_width=300
                    ),
                    icon=folium.Icon(
                        color='darkblue',
                        icon='user',
                        prefix='fa'
                    )
                ).add_to(m)
        
        # Agregar leyenda
        legend_html = '''
        <div style="position: fixed; 
                    top: 10px; right: 10px; width: 250px; height: auto;
                    background-color: white; z-index: 1000; 
                    border: 2px solid grey; border-radius: 5px;
                    padding: 10px; font-size: 14px;">
        <h4 style="margin: 0 0 10px 0;">Territorios por KAM</h4>
        '''
        
        # Ordenar KAMs por número de IPS asignadas
        sorted_kams = sorted(
            [(kam_id, len(assignments[kam_id])) for kam_id in assignments.keys()],
            key=lambda x: x[1],
            reverse=True
        )
        
        for kam_id, ips_count in sorted_kams:
            kam = kam_info[kam_id]
            color = kam_colors[kam_id]
            legend_html += f'''
            <div style="margin-bottom: 5px;">
                <span style="color: {color}; font-size: 16px;">●</span>
                <span>{kam['name']} ({ips_count} IPS)</span>
            </div>
            '''
        
        legend_html += '''
        <hr style="margin: 10px 0;">
        <div style="margin-bottom: 5px;">
            <span style="color: #E0E0E0; font-size: 16px;">●</span>
            <span>Sin asignar</span>
        </div>
        </div>
        '''
        
        m.get_root().html.add_child(folium.Element(legend_html))
        
        # Agregar control de capas
        folium.LayerControl().add_to(m)
        
        # Guardar mapa
        m.save(output_file)
        print(f"   ✓ Mapa guardado en: {output_file}")
        
        # Generar resumen de territorios
        self._generate_territory_summary(kam_territories, kam_info, output_file.replace('.html', '_summary.txt'))
    
    def _generate_territory_summary(self, kam_territories: Dict, kam_info: Dict, output_file: str):
        """
        Genera un resumen textual de los territorios asignados.
        """
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write("RESUMEN DE TERRITORIOS POR KAM\n")
            f.write("="*50 + "\n\n")
            
            for kam_id, territories in sorted(kam_territories.items(), key=lambda x: len(x[1]), reverse=True):
                kam = kam_info[kam_id]
                f.write(f"{kam['name']} ({kam['areaId']}):\n")
                f.write(f"  - Municipios/Localidades: {len(territories)}\n")
                f.write(f"  - IDs: {', '.join(sorted(territories))}\n")
                f.write("\n")
        
        print(f"   ✓ Resumen de territorios guardado en: {output_file}")