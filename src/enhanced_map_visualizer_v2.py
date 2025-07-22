"""
Visualizador mejorado de mapas para OpMap v2.
Corrige la superposición de marcadores de población.
"""

import json
import os
from typing import Dict, List, Tuple
import folium
from folium import plugins
import branca.colormap as cm
from collections import defaultdict
import random

class EnhancedMapVisualizerV2:
    """
    Genera visualizaciones mejoradas sin superposición de marcadores.
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
        
        # Color para zonas sin asignar
        self.unassigned_color = '#E0E0E0'
        
    def create_enhanced_map(self, assignments_file: str, output_file: str):
        """
        Crea un mapa mejorado sin superposición de marcadores.
        """
        print("🗺️  Generando visualización mejorada del mapa v2...")
        
        # Cargar asignaciones
        with open(assignments_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        assignments = data.get('assignments', {})
        
        # Crear mapa base
        m = folium.Map(
            location=self.center,
            zoom_start=self.zoom_start,
            tiles='OpenStreetMap',
            control_scale=True
        )
        
        # Cargar información de KAMs
        kam_info = {}
        with open('data/json/sellers.json', 'r', encoding='utf-8') as f:
            sellers = json.load(f)
            for seller in sellers:
                kam_info[seller['id']] = seller
        
        # Asignar colores a KAMs
        kam_colors = {}
        color_idx = 0
        for kam_id in sorted(assignments.keys()):
            kam_colors[kam_id] = self.kam_colors[color_idx % len(self.kam_colors)]
            color_idx += 1
        
        # Analizar asignaciones
        kam_territories = defaultdict(set)  # kam_id -> set de municipality/locality IDs
        municipalities_with_ips = set()  # Municipios que tienen IPS reales
        ips_locations = []  # Lista de ubicaciones de IPS
        municipality_ips_count = defaultdict(int)  # Contador de IPS por municipio
        municipalities_population_only = []  # Municipios solo población (para mostrar agrupados)
        
        for kam_id, ips_list in assignments.items():
            for ips in ips_list:
                # Si es una IPS real (no solo población)
                if not ips.get('is_population_only', False):
                    # Guardar ubicación de IPS con toda la información
                    ips_locations.append({
                        'lat': float(ips['lat']),
                        'lng': float(ips['lng']),
                        'name': ips.get('name_register', 'IPS'),
                        'kam_id': kam_id,
                        'municipality': ips.get('municipalityname', ''),
                        'color': kam_colors[kam_id],
                        'service_level': ips.get('service_level', 'N/A'),
                        'camas': ips.get('camas', 0),
                        'quirofano': ips.get('quirofano', 0),
                        'ambulancias': ips.get('ambulancias', 0),
                        'complexity': ips.get('complexity', 'N/A'),
                        'services': ips.get('services', '')
                    })
                    
                    # Marcar municipio como que tiene IPS
                    if 'municipalityid' in ips:
                        municipalities_with_ips.add(ips['municipalityid'])
                        municipality_ips_count[ips['municipalityid']] += 1
                else:
                    # Es un municipio solo población - NO crear marcador si es una localidad
                    if 'municipalityid' in ips and not ips.get('id_register', '').startswith('LOC_'):
                        municipalities_population_only.append({
                            'id': ips['municipalityid'],
                            'name': ips.get('municipalityname', ''),
                            'lat': float(ips.get('lat', 0)),
                            'lng': float(ips.get('lng', 0)),
                            'population': ips.get('population', 0),
                            'kam_id': kam_id,
                            'kam_name': kam_info[kam_id]['name'],
                            'color': kam_colors[kam_id]
                        })
                
                # Agregar municipio al territorio del KAM
                if 'municipalityid' in ips and ips['municipalityid']:
                    kam_territories[kam_id].add(ips['municipalityid'])
                # Agregar localidad (para Bogotá)
                if 'localityid' in ips and ips['localityid']:
                    kam_territories[kam_id].add(ips['localityid'])
        
        # También agregar los territorios base de cada KAM
        for kam_id, kam in kam_info.items():
            kam_territories[kam_id].add(kam['areaId'])
            if kam['areaId'] in municipalities_with_ips:
                municipalities_with_ips.add(kam['areaId'])
        
        print(f"   ✓ {len(kam_territories)} territorios de KAM identificados")
        print(f"   ✓ {len(ips_locations)} ubicaciones de IPS reales")
        print(f"   ✓ {len(municipalities_with_ips)} municipios con IPS")
        print(f"   ✓ {len(municipalities_population_only)} municipios solo población")
        
        # Crear grupos de capas
        territories_layer = folium.FeatureGroup(name='Territorios', show=True)
        ips_layer = folium.FeatureGroup(name='IPS', show=True)
        kam_layer = folium.FeatureGroup(name='KAMs', show=True)
        population_layer = folium.FeatureGroup(name='Municipios sin IPS', show=False)  # Oculto por defecto
        
        # Cargar y dibujar polígonos (municipios y localidades)
        # [El código para dibujar polígonos se mantiene igual que en enhanced_map_visualizer.py]
        self._draw_territories(m, territories_layer, kam_territories, kam_colors, kam_info, 
                             municipalities_with_ips, municipality_ips_count)
        
        # Agregar puntos de IPS
        self._draw_ips_points(ips_layer, ips_locations)
        
        # Agregar marcadores de KAMs
        self._draw_kam_markers(kam_layer, kam_info, kam_colors, assignments)
        
        # Agregar municipios sin IPS agrupados por cercanía
        self._draw_population_markers_grouped(population_layer, municipalities_population_only)
        
        # Agregar capas al mapa
        territories_layer.add_to(m)
        ips_layer.add_to(m)
        kam_layer.add_to(m)
        population_layer.add_to(m)
        
        # Agregar leyenda mejorada
        self._add_legend(m, kam_colors, kam_info, assignments)
        
        # Control de capas con la capa de población oculta por defecto
        folium.LayerControl(position='topleft', collapsed=False).add_to(m)
        
        # Guardar mapa
        m.save(output_file)
        print(f"   ✓ Mapa mejorado v2 guardado en: {output_file}")
    
    def _draw_territories(self, m, layer, kam_territories, kam_colors, kam_info, 
                         municipalities_with_ips, municipality_ips_count):
        """
        Dibuja los polígonos de territorios (municipios y localidades).
        """
        # Cargar datos de municipios
        municipalities_data = {}
        try:
            with open('data/psv/municipalities.psv', 'r', encoding='utf-8') as f:
                import csv
                reader = csv.DictReader(f, delimiter='|')
                for row in reader:
                    municipalities_data[row['id']] = {
                        'name': row['name'],
                        'population': int(row.get('population2025', 0))
                    }
        except:
            pass
        
        # Dibujar municipios
        municipalities_drawn = 0
        municipalities_path = 'data/geojson/municipalities'
        
        if os.path.exists(municipalities_path):
            for filename in os.listdir(municipalities_path):
                if filename.endswith('.geojson'):
                    municipality_id = filename.replace('.geojson', '')
                    
                    # Encontrar a qué KAM pertenece
                    assigned_kam = None
                    for kam_id, territories in kam_territories.items():
                        if municipality_id in territories:
                            assigned_kam = kam_id
                            break
                    
                    if assigned_kam:
                        color = kam_colors[assigned_kam]
                        kam_name = kam_info[assigned_kam]['name']
                        has_ips = municipality_id in municipalities_with_ips
                        opacity = 0.5 if has_ips else 0.25
                    else:
                        color = self.unassigned_color
                        kam_name = 'Sin asignar'
                        has_ips = False
                        opacity = 0.1
                    
                    # Obtener datos del municipio
                    mun_data = municipalities_data.get(municipality_id, {})
                    mun_name = mun_data.get('name', municipality_id)
                    population = mun_data.get('population', 0)
                    ips_count = municipality_ips_count.get(municipality_id, 0)
                    
                    try:
                        with open(os.path.join(municipalities_path, filename), 'r') as f:
                            geojson_data = json.load(f)
                        
                        # Crear tooltip
                        tooltip_html = f"""
                        <div style='font-family: Arial, sans-serif; font-size: 12px;'>
                            <b style='font-size: 14px;'>{mun_name}</b><br>
                            <b>KAM:</b> {kam_name}<br>
                            <b>Población:</b> {population:,}<br>
                        """
                        
                        if has_ips:
                            tooltip_html += f"<b>IPS:</b> {ips_count}<br>"
                            tooltip_html += "<span style='color: #2ECC71;'>🏥 Con servicios de salud</span>"
                        else:
                            tooltip_html += "<span style='color: #E74C3C;'>👥 Solo población (sin IPS)</span>"
                        
                        tooltip_html += "</div>"
                        
                        folium.GeoJson(
                            geojson_data,
                            style_function=lambda x, color=color, opacity=opacity, has_ips=has_ips: {
                                'fillColor': color,
                                'color': '#333333' if has_ips else '#AAAAAA',
                                'weight': 0.8 if has_ips else 0.3,
                                'fillOpacity': opacity,
                                'dashArray': '' if has_ips else '3, 3'
                            },
                            tooltip=folium.Tooltip(tooltip_html, sticky=True)
                        ).add_to(layer)
                        
                        municipalities_drawn += 1
                    except:
                        pass
        
        # Dibujar localidades (similar lógica)
        localities_data = {}
        try:
            with open('data/psv/localities.psv', 'r', encoding='utf-8') as f:
                import csv
                reader = csv.DictReader(f, delimiter='|')
                for row in reader:
                    localities_data[row['id']] = {
                        'name': row['name'],
                        'population': int(row.get('population2025', 0))
                    }
        except:
            pass
        
        localities_path = 'data/geojson/localities'
        if os.path.exists(localities_path):
            for filename in os.listdir(localities_path):
                if filename.endswith('.geojson'):
                    locality_id = filename.replace('.geojson', '')
                    
                    assigned_kam = None
                    for kam_id, territories in kam_territories.items():
                        if locality_id in territories:
                            assigned_kam = kam_id
                            break
                    
                    if assigned_kam:
                        color = kam_colors[assigned_kam]
                        kam_name = kam_info[assigned_kam]['name']
                        has_ips = locality_id in municipalities_with_ips
                        opacity = 0.5 if has_ips else 0.25
                    else:
                        color = self.unassigned_color
                        kam_name = 'Sin asignar'
                        has_ips = False
                        opacity = 0.1
                    
                    loc_data = localities_data.get(locality_id, {})
                    loc_name = loc_data.get('name', f'Localidad {locality_id}')
                    population = loc_data.get('population', 0)
                    ips_count = municipality_ips_count.get(locality_id, 0)
                    
                    try:
                        with open(os.path.join(localities_path, filename), 'r') as f:
                            geojson_data = json.load(f)
                        
                        tooltip_html = f"""
                        <div style='font-family: Arial, sans-serif; font-size: 12px;'>
                            <b style='font-size: 14px;'>{loc_name}</b><br>
                            <b>KAM:</b> {kam_name}<br>
                            <b>Población:</b> {population:,}<br>
                        """
                        
                        if has_ips:
                            tooltip_html += f"<b>IPS:</b> {ips_count}<br>"
                            tooltip_html += "<span style='color: #2ECC71;'>🏥 Con servicios de salud</span>"
                        else:
                            tooltip_html += "<span style='color: #3498DB;'>📍 Localidad de Bogotá</span>"
                        
                        tooltip_html += "</div>"
                        
                        folium.GeoJson(
                            geojson_data,
                            style_function=lambda x, color=color, opacity=opacity, has_ips=has_ips: {
                                'fillColor': color,
                                'color': '#333333' if has_ips else '#AAAAAA',
                                'weight': 0.8 if has_ips else 0.3,
                                'fillOpacity': opacity,
                                'dashArray': '' if has_ips else '3, 3'
                            },
                            tooltip=folium.Tooltip(tooltip_html, sticky=True)
                        ).add_to(layer)
                    except:
                        pass
        
        print(f"   ✓ {municipalities_drawn} polígonos dibujados")
    
    def _draw_ips_points(self, layer, ips_locations):
        """
        Dibuja los puntos de IPS en el mapa.
        """
        for ips in ips_locations:
            service_level = int(ips['service_level']) if str(ips['service_level']).isdigit() else 1
            radius = 2 + (service_level * 0.8)
            
            popup_html = f"""
            <div style='font-family: Arial, sans-serif; font-size: 12px; min-width: 280px;'>
                <h4 style='margin: 0 0 8px 0; color: #2c3e50;'>{ips['name']}</h4>
                
                <div style='background-color: #f8f9fa; padding: 8px; border-radius: 4px; margin-bottom: 8px;'>
                    <table style='width: 100%; border-collapse: collapse;'>
                        <tr>
                            <td style='padding: 2px 0;'><b>📍 Municipio:</b></td>
                            <td style='padding: 2px 0;'>{ips['municipality']}</td>
                        </tr>
                        <tr>
                            <td style='padding: 2px 0;'><b>⭐ Nivel:</b></td>
                            <td style='padding: 2px 0;'>Nivel {ips['service_level']}</td>
                        </tr>
                        <tr>
                            <td style='padding: 2px 0;'><b>🏥 Complejidad:</b></td>
                            <td style='padding: 2px 0;'>{ips['complexity']}</td>
                        </tr>
                    </table>
                </div>
                
                <div style='background-color: #e8f4f8; padding: 8px; border-radius: 4px;'>
                    <b>Capacidad instalada:</b><br>
                    🛏️ Camas: {ips['camas']}<br>
                    🏥 Quirófanos: {ips['quirofano']}<br>
                    🚑 Ambulancias: {ips['ambulancias']}
                </div>
            </div>
            """
            
            folium.CircleMarker(
                location=[ips['lat'], ips['lng']],
                radius=radius,
                popup=folium.Popup(popup_html, max_width=320),
                tooltip=folium.Tooltip(
                    f"<b>{ips['name']}</b><br>Nivel {ips['service_level']} - {ips['camas']} camas",
                    sticky=False
                ),
                color='#222222',
                fillColor=ips['color'],
                fillOpacity=0.9,
                weight=0.5
            ).add_to(layer)
    
    def _draw_kam_markers(self, layer, kam_info, kam_colors, assignments):
        """
        Dibuja los marcadores de KAMs.
        """
        for kam_id, kam in kam_info.items():
            if kam_id in assignments:
                real_ips = sum(1 for ips in assignments[kam_id] if not ips.get('is_population_only', False))
                pop_only = len(assignments[kam_id]) - real_ips
                
                folium.Marker(
                    location=[float(kam['lat']), float(kam['lng'])],
                    popup=folium.Popup(
                        f"<b>{kam['name']}</b><br>"
                        f"<b>IPS reales:</b> {real_ips}<br>"
                        f"<b>Municipios solo población:</b> {pop_only}<br>"
                        f"<b>Total asignaciones:</b> {len(assignments[kam_id])}",
                        max_width=300
                    ),
                    icon=folium.Icon(
                        color='darkblue',
                        icon='user-tie',
                        prefix='fa'
                    )
                ).add_to(layer)
    
    def _draw_population_markers_grouped(self, layer, municipalities_population_only):
        """
        Dibuja marcadores agrupados para municipios sin IPS.
        Agrupa municipios cercanos para evitar superposición.
        """
        if not municipalities_population_only:
            return
        
        # Agrupar municipios cercanos (dentro de 0.5 grados de lat/lng)
        groups = []
        grouped_municipalities = set()
        
        for mun in municipalities_population_only:
            if mun['id'] in grouped_municipalities:
                continue
                
            # Crear nuevo grupo
            group = {
                'center_lat': mun['lat'],
                'center_lng': mun['lng'],
                'municipalities': [mun],
                'total_population': mun['population'],
                'kam_id': mun['kam_id'],
                'kam_name': mun['kam_name'],
                'color': mun['color']
            }
            
            # Buscar municipios cercanos
            for other_mun in municipalities_population_only:
                if other_mun['id'] != mun['id'] and other_mun['id'] not in grouped_municipalities:
                    distance = ((other_mun['lat'] - mun['lat'])**2 + 
                               (other_mun['lng'] - mun['lng'])**2)**0.5
                    if distance < 0.5 and other_mun['kam_id'] == mun['kam_id']:
                        group['municipalities'].append(other_mun)
                        group['total_population'] += other_mun['population']
                        grouped_municipalities.add(other_mun['id'])
            
            grouped_municipalities.add(mun['id'])
            groups.append(group)
        
        # Crear marcadores para cada grupo
        for group in groups:
            # Calcular centro promedio del grupo
            avg_lat = sum(m['lat'] for m in group['municipalities']) / len(group['municipalities'])
            avg_lng = sum(m['lng'] for m in group['municipalities']) / len(group['municipalities'])
            
            # Crear lista de municipios en el grupo
            mun_list = '<br>'.join([f"• {m['name']} ({m['population']:,} hab.)" 
                                   for m in group['municipalities'][:5]])  # Limitar a 5
            if len(group['municipalities']) > 5:
                mun_list += f"<br>... y {len(group['municipalities']) - 5} más"
            
            popup_html = f"""
            <div style='font-family: Arial, sans-serif; font-size: 12px; min-width: 250px;'>
                <h4 style='margin: 0 0 8px 0; color: #e74c3c;'>
                    👥 Municipios sin IPS ({len(group['municipalities'])})
                </h4>
                <b>KAM:</b> {group['kam_name']}<br>
                <b>Población total:</b> {group['total_population']:,}<br>
                <hr style='margin: 8px 0;'>
                <b>Municipios:</b><br>
                {mun_list}
            </div>
            """
            
            # Tamaño del marcador basado en número de municipios
            icon_size = min(30 + len(group['municipalities']) * 2, 50)
            
            folium.Marker(
                location=[avg_lat, avg_lng],
                popup=folium.Popup(popup_html, max_width=320),
                tooltip=folium.Tooltip(
                    f"{len(group['municipalities'])} municipios sin IPS<br>"
                    f"Población: {group['total_population']:,}",
                    sticky=False
                ),
                icon=folium.DivIcon(html=f"""
                    <div style="
                        background-color: {group['color']};
                        width: {icon_size}px;
                        height: {icon_size}px;
                        border-radius: 50%;
                        border: 3px solid white;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-weight: bold;
                        color: white;
                        font-size: 16px;
                    ">
                        👥
                    </div>
                """)
            ).add_to(layer)
        
        print(f"   ✓ {len(groups)} grupos de municipios sin IPS creados")
    
    def _add_legend(self, m, kam_colors, kam_info, assignments):
        """
        Agrega leyenda mejorada al mapa.
        """
        legend_html = '''
        <div style="position: fixed; 
                    bottom: 30px; right: 10px; width: 250px;
                    background-color: rgba(255,255,255,0.95); z-index: 1000; 
                    border: 1px solid #ccc; border-radius: 8px;
                    padding: 12px; font-size: 12px; box-shadow: 0 2px 6px rgba(0,0,0,0.2);">
        <h4 style="margin: 0 0 8px 0; font-size: 14px; color: #333;">Simbología</h4>
        <div style="margin-bottom: 10px; font-size: 11px; color: #555; line-height: 1.4;">
            <div style="margin: 3px 0;">
                <span style="display: inline-block; width: 40px; border-bottom: 2px solid #333;"></span>
                Municipio con IPS
            </div>
            <div style="margin: 3px 0;">
                <span style="display: inline-block; width: 40px; border-bottom: 2px dashed #999;"></span>
                Solo población
            </div>
            <div style="margin: 3px 0;">
                <span style="color: #333;">●</span> Ubicación de IPS
            </div>
            <div style="margin: 3px 0;">
                <span style="color: darkblue;">📍</span> Ubicación KAM
            </div>
            <div style="margin: 3px 0;">
                <span style="font-size: 16px;">👥</span> Municipios sin IPS (agrupados)
            </div>
        </div>
        <hr style="margin: 8px 0; border: none; border-top: 1px solid #ddd;">
        <div style="font-size: 10px; color: #666; font-style: italic;">
            Nota: Los municipios sin IPS están ocultos por defecto. 
            Use el control de capas para mostrarlos.
        </div>
        </div>
        '''
        
        m.get_root().html.add_child(folium.Element(legend_html))