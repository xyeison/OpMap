"""
Visualizador mejorado de mapas para OpMap con asignación por mayoría.
Los polígonos se colorean según el KAM que tenga más IPS en ese territorio.
"""

import json
import os
from typing import Dict, List, Tuple
import folium
from folium import plugins
import branca.colormap as cm
from collections import defaultdict
import random

class EnhancedMapVisualizerMajority:
    """
    Genera visualizaciones de mapas con territorios coloreados por mayoría de IPS.
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
        Crea un mapa mejorado con asignación de colores por mayoría.
        """
        print("🗺️  Generando visualización mejorada del mapa (asignación por mayoría)...")
        
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
        
        # Analizar asignaciones: contar IPS por territorio y por KAM
        territory_kam_counts = defaultdict(lambda: defaultdict(int))  # territory_id -> {kam_id: count}
        municipalities_with_ips = set()
        ips_locations = []
        municipality_ips_count = defaultdict(int)
        municipality_population = {}
        
        for kam_id, ips_list in assignments.items():
            for ips in ips_list:
                # Si es una IPS real (no solo población)
                if not ips.get('is_population_only', False):
                    # Guardar ubicación de IPS
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
                    
                    # Contar IPS por territorio
                    if 'municipalityid' in ips and ips['municipalityid']:
                        territory_id = ips['municipalityid']
                        territory_kam_counts[territory_id][kam_id] += 1
                        municipalities_with_ips.add(territory_id)
                        municipality_ips_count[territory_id] += 1
                    
                    # Para localidades de Bogotá
                    if 'localityid' in ips and ips['localityid']:
                        territory_id = ips['localityid']
                        territory_kam_counts[territory_id][kam_id] += 1
                        municipalities_with_ips.add(territory_id)
                        municipality_ips_count[territory_id] += 1
                else:
                    # Es solo población
                    if 'municipalityid' in ips:
                        municipality_population[ips['municipalityid']] = ips.get('population', 0)
        
        # Determinar el KAM dominante por territorio (el que tiene más IPS)
        territory_dominant_kam = {}
        territory_sharing_info = {}  # Información sobre territorios compartidos
        
        for territory_id, kam_counts in territory_kam_counts.items():
            if kam_counts:
                # Ordenar KAMs por número de IPS (descendente)
                sorted_kams = sorted(kam_counts.items(), key=lambda x: x[1], reverse=True)
                dominant_kam = sorted_kams[0][0]
                territory_dominant_kam[territory_id] = dominant_kam
                
                # Si hay más de un KAM, es territorio compartido
                if len(sorted_kams) > 1:
                    total_ips = sum(count for _, count in sorted_kams)
                    territory_sharing_info[territory_id] = {
                        'kams': sorted_kams,
                        'total_ips': total_ips,
                        'dominant_percentage': (sorted_kams[0][1] / total_ips * 100)
                    }
        
        print(f"   ✓ {len(territory_dominant_kam)} territorios con IPS identificados")
        print(f"   ✓ {len(territory_sharing_info)} territorios compartidos entre múltiples KAMs")
        print(f"   ✓ {len(ips_locations)} ubicaciones de IPS")
        
        # Crear grupos de capas
        territories_layer = folium.FeatureGroup(name='Territorios', show=True)
        ips_layer = folium.FeatureGroup(name='IPS', show=True)
        kam_layer = folium.FeatureGroup(name='KAMs', show=True)
        population_layer = folium.FeatureGroup(name='Municipios sin IPS', show=True)
        
        # Cargar y dibujar municipios
        self._draw_municipalities(m, territories_layer, territory_dominant_kam, territory_sharing_info,
                                kam_colors, kam_info, municipalities_with_ips, 
                                municipality_ips_count, municipality_population)
        
        # Cargar y dibujar localidades
        self._draw_localities(m, territories_layer, territory_dominant_kam, territory_sharing_info,
                            kam_colors, kam_info, municipalities_with_ips, 
                            municipality_ips_count)
        
        # Agregar puntos de IPS
        for ips in ips_locations:
            # Tamaño basado en nivel de servicio
            service_level = int(ips['service_level']) if str(ips['service_level']).isdigit() else 1
            radius = 2 + (service_level * 0.8)
            
            # Información detallada para el popup
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
            ).add_to(ips_layer)
        
        # Agregar marcadores de KAMs
        for kam_id, kam in kam_info.items():
            if kam_id in assignments:
                # Contar IPS reales vs solo población
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
                ).add_to(kam_layer)
        
        # Agregar marcadores para municipios sin IPS
        municipalities_population_only = []
        for kam_id, ips_list in assignments.items():
            for ips in ips_list:
                if ips.get('is_population_only', False) and 'municipalityid' in ips:
                    municipalities_population_only.append({
                        'name': ips.get('municipalityname', ''),
                        'lat': float(ips.get('lat', 0)),
                        'lng': float(ips.get('lng', 0)),
                        'population': ips.get('population', 0),
                        'kam_name': kam_info[kam_id]['name'],
                        'color': kam_colors[kam_id]
                    })
        
        # Agregar marcadores de población
        for mun in municipalities_population_only:
            folium.Marker(
                location=[mun['lat'], mun['lng']],
                popup=folium.Popup(
                    f"<b>{mun['name']}</b><br>"
                    f"<b>Población:</b> {mun['population']:,}<br>"
                    f"<b>KAM asignado:</b> {mun['kam_name']}<br>"
                    f"<span style='color: #e74c3c;'>⚠️ Sin IPS - Población debe trasladarse</span>",
                    max_width=300
                ),
                icon=folium.DivIcon(html=f"""
                    <div style="
                        background-color: {mun['color']};
                        width: 24px;
                        height: 24px;
                        border-radius: 50%;
                        border: 2px solid white;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-weight: bold;
                        color: white;
                        font-size: 12px;
                    ">
                        👥
                    </div>
                """)
            ).add_to(population_layer)
        
        # Agregar capas al mapa
        territories_layer.add_to(m)
        ips_layer.add_to(m)
        kam_layer.add_to(m)
        population_layer.add_to(m)
        
        # Agregar leyenda mejorada
        self._add_legend(m, kam_colors, kam_info, assignments, territory_sharing_info)
        
        # Control de capas
        folium.LayerControl(position='topleft', collapsed=False).add_to(m)
        
        # Guardar mapa
        m.save(output_file)
        print(f"   ✓ Mapa mejorado guardado en: {output_file}")
    
    def _draw_municipalities(self, m, layer, territory_dominant_kam, territory_sharing_info,
                           kam_colors, kam_info, municipalities_with_ips, 
                           municipality_ips_count, municipality_population):
        """
        Dibuja los municipios con colores según el KAM dominante.
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
        
        municipalities_drawn = 0
        municipalities_path = 'data/geojson/municipalities'
        
        if os.path.exists(municipalities_path):
            for filename in os.listdir(municipalities_path):
                if filename.endswith('.geojson'):
                    municipality_id = filename.replace('.geojson', '')
                    
                    # Determinar color y KAM
                    if municipality_id in territory_dominant_kam:
                        assigned_kam = territory_dominant_kam[municipality_id]
                        color = kam_colors[assigned_kam]
                        kam_name = kam_info[assigned_kam]['name']
                        has_ips = True
                        opacity = 0.5
                    else:
                        # Verificar si algún KAM tiene base aquí
                        base_kam = None
                        for kam_id, kam in kam_info.items():
                            if kam['areaId'] == municipality_id:
                                base_kam = kam_id
                                break
                        
                        if base_kam:
                            color = kam_colors[base_kam]
                            kam_name = kam_info[base_kam]['name']
                            has_ips = municipality_id in municipalities_with_ips
                            opacity = 0.3 if has_ips else 0.2
                        else:
                            color = self.unassigned_color
                            kam_name = 'Sin asignar'
                            has_ips = False
                            opacity = 0.1
                    
                    # Obtener datos del municipio
                    mun_data = municipalities_data.get(municipality_id, {})
                    mun_name = mun_data.get('name', municipality_id)
                    population = municipality_population.get(municipality_id, mun_data.get('population', 0))
                    ips_count = municipality_ips_count.get(municipality_id, 0)
                    
                    try:
                        with open(os.path.join(municipalities_path, filename), 'r') as f:
                            geojson_data = json.load(f)
                        
                        # Crear tooltip con información de compartición
                        tooltip_html = f"""
                        <div style='font-family: Arial, sans-serif; font-size: 12px;'>
                            <b style='font-size: 14px;'>{mun_name}</b><br>
                            <b>KAM dominante:</b> {kam_name}<br>
                            <b>Población:</b> {population:,}<br>
                        """
                        
                        if has_ips:
                            tooltip_html += f"<b>IPS totales:</b> {ips_count}<br>"
                            
                            # Si es territorio compartido, mostrar detalles
                            if municipality_id in territory_sharing_info:
                                info = territory_sharing_info[municipality_id]
                                tooltip_html += "<br><b>Territorio compartido:</b><br>"
                                for kam_id, count in info['kams'][:3]:  # Mostrar top 3
                                    kam_n = kam_info[kam_id]['name']
                                    pct = count / info['total_ips'] * 100
                                    tooltip_html += f"• {kam_n}: {count} IPS ({pct:.0f}%)<br>"
                                
                            tooltip_html += "<span style='color: #2ECC71;'>🏥 Con servicios de salud</span>"
                        else:
                            tooltip_html += "<span style='color: #E74C3C;'>👥 Solo población (sin IPS)</span>"
                        
                        tooltip_html += "</div>"
                        
                        # Estilo diferente para territorios compartidos
                        is_shared = municipality_id in territory_sharing_info
                        
                        folium.GeoJson(
                            geojson_data,
                            style_function=lambda x, color=color, opacity=opacity, has_ips=has_ips, is_shared=is_shared: {
                                'fillColor': color,
                                'color': '#333333' if has_ips else '#AAAAAA',
                                'weight': 1.5 if is_shared else 0.8 if has_ips else 0.3,
                                'fillOpacity': opacity,
                                'dashArray': '5, 5' if is_shared else '' if has_ips else '3, 3'
                            },
                            tooltip=folium.Tooltip(tooltip_html, sticky=True)
                        ).add_to(layer)
                        
                        municipalities_drawn += 1
                    except:
                        pass
        
        print(f"   ✓ {municipalities_drawn} municipios dibujados")
    
    def _draw_localities(self, m, layer, territory_dominant_kam, territory_sharing_info,
                        kam_colors, kam_info, municipalities_with_ips, 
                        municipality_ips_count):
        """
        Dibuja las localidades con colores según el KAM dominante.
        """
        # Cargar datos de localidades
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
        localities_drawn = 0
        
        if os.path.exists(localities_path):
            for filename in os.listdir(localities_path):
                if filename.endswith('.geojson'):
                    locality_id = filename.replace('.geojson', '')
                    
                    # Determinar color y KAM
                    if locality_id in territory_dominant_kam:
                        assigned_kam = territory_dominant_kam[locality_id]
                        color = kam_colors[assigned_kam]
                        kam_name = kam_info[assigned_kam]['name']
                        has_ips = True
                        opacity = 0.5
                    else:
                        # Verificar si algún KAM tiene base aquí
                        base_kam = None
                        for kam_id, kam in kam_info.items():
                            if kam['areaId'] == locality_id:
                                base_kam = kam_id
                                break
                        
                        if base_kam:
                            color = kam_colors[base_kam]
                            kam_name = kam_info[base_kam]['name']
                            has_ips = locality_id in municipalities_with_ips
                            opacity = 0.3 if has_ips else 0.2
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
                        
                        # Crear tooltip con información de compartición
                        tooltip_html = f"""
                        <div style='font-family: Arial, sans-serif; font-size: 12px;'>
                            <b style='font-size: 14px;'>{loc_name}</b><br>
                            <b>KAM dominante:</b> {kam_name}<br>
                            <b>Población:</b> {population:,}<br>
                        """
                        
                        if has_ips:
                            tooltip_html += f"<b>IPS totales:</b> {ips_count}<br>"
                            
                            # Si es territorio compartido, mostrar detalles
                            if locality_id in territory_sharing_info:
                                info = territory_sharing_info[locality_id]
                                tooltip_html += "<br><b>Territorio compartido:</b><br>"
                                for kam_id, count in info['kams'][:3]:
                                    kam_n = kam_info[kam_id]['name']
                                    pct = count / info['total_ips'] * 100
                                    tooltip_html += f"• {kam_n}: {count} IPS ({pct:.0f}%)<br>"
                                
                            tooltip_html += "<span style='color: #2ECC71;'>🏥 Con servicios de salud</span>"
                        else:
                            tooltip_html += "<span style='color: #3498DB;'>📍 Localidad de Bogotá</span>"
                        
                        tooltip_html += "</div>"
                        
                        # Estilo diferente para territorios compartidos
                        is_shared = locality_id in territory_sharing_info
                        
                        folium.GeoJson(
                            geojson_data,
                            style_function=lambda x, color=color, opacity=opacity, has_ips=has_ips, is_shared=is_shared: {
                                'fillColor': color,
                                'color': '#333333' if has_ips else '#AAAAAA',
                                'weight': 1.5 if is_shared else 0.8 if has_ips else 0.3,
                                'fillOpacity': opacity,
                                'dashArray': '5, 5' if is_shared else '' if has_ips else '3, 3'
                            },
                            tooltip=folium.Tooltip(tooltip_html, sticky=True)
                        ).add_to(layer)
                        
                        localities_drawn += 1
                    except:
                        pass
        
        print(f"   ✓ {localities_drawn} localidades dibujadas")
    
    def _add_legend(self, m, kam_colors, kam_info, assignments, territory_sharing_info):
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
                <span style="display: inline-block; width: 40px; border-bottom: 2px dashed #555;"></span>
                Territorio compartido
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
                <span style="font-size: 16px;">👥</span> Municipio sin IPS
            </div>
        </div>
        '''
        
        if territory_sharing_info:
            legend_html += f'''
            <hr style="margin: 8px 0; border: none; border-top: 1px solid #ddd;">
            <div style="font-size: 10px; color: #666;">
                <b>{len(territory_sharing_info)}</b> territorios compartidos<br>
                (coloreados por KAM dominante)
            </div>
            '''
        
        legend_html += '''
        </div>
        '''
        
        m.get_root().html.add_child(folium.Element(legend_html))