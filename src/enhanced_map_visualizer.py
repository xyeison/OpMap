"""
Visualizador mejorado de mapas para OpMap.
Muestra puntos de IPS y diferencia municipios con IPS vs solo población.
"""

import json
import os
from typing import Dict, List, Tuple
import folium
from folium import plugins
import branca.colormap as cm
from collections import defaultdict
import random

class EnhancedMapVisualizer:
    """
    Genera visualizaciones mejoradas con puntos de IPS y distinción visual.
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
        
        # Color para zonas sin asignar - gris oscuro
        self.unassigned_color = '#4A4A4A'
        
        # Modo limpio: solo muestra territorios con IPS
        self.clean_mode = False
        
    def create_enhanced_map(self, assignments_file: str, output_file: str):
        """
        Crea un mapa mejorado con puntos de IPS y distinción visual.
        """
        print("🗺️  Generando visualización mejorada del mapa...")
        
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
        
        # Analizar asignaciones
        kam_territories = defaultdict(set)  # kam_id -> set de municipality/locality IDs
        municipalities_with_ips = set()  # Municipios que tienen IPS reales
        ips_locations = []  # Lista de ubicaciones de IPS
        municipality_ips_count = defaultdict(int)  # Contador de IPS por municipio
        municipality_population = {}  # Población por municipio
        
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
                    # Es un municipio solo población
                    if 'municipalityid' in ips and 'population' in ips:
                        municipality_population[ips['municipalityid']] = ips['population']
                
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
        
        # Crear grupos de capas separadas para municipios y localidades
        municipalities_layer = folium.FeatureGroup(name='Municipios', show=True)
        localities_layer = folium.FeatureGroup(name='Localidades de Bogotá', show=True)
        ips_layer = folium.FeatureGroup(name='IPS', show=True)
        kam_layer = folium.FeatureGroup(name='KAMs', show=True)
        
        # Cargar datos de municipios para obtener nombres y población
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
                    
                    # IMPORTANTE: Excluir Bogotá (11001) porque se maneja por localidades
                    if municipality_id == '11001':
                        continue
                    
                    # En modo limpio, solo dibujar municipios con IPS
                    if self.clean_mode and municipality_id not in municipalities_with_ips:
                        continue
                    
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
                        # Opacidad diferente para municipios con/sin IPS
                        opacity = 0.5 if has_ips else 0.25
                    else:
                        color = self.unassigned_color
                        kam_name = 'Sin asignar'
                        has_ips = False
                        opacity = 0.1
                    
                    # Obtener datos del municipio
                    mun_data = municipalities_data.get(municipality_id, {})
                    mun_name = mun_data.get('name', municipality_id)
                    
                    # Población: usar la almacenada si es solo población, o la del archivo PSV
                    if municipality_id in municipality_population:
                        population = municipality_population[municipality_id]
                    else:
                        population = mun_data.get('population', 0)
                    
                    # Número de IPS
                    ips_count = municipality_ips_count.get(municipality_id, 0)
                    
                    # Cargar GeoJSON
                    try:
                        with open(os.path.join(municipalities_path, filename), 'r') as f:
                            geojson_data = json.load(f)
                        
                        # Crear tooltip con información detallada
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
                        
                        # Estilo diferenciado
                        folium.GeoJson(
                            geojson_data,
                            style_function=lambda x, color=color, opacity=opacity, has_ips=has_ips: {
                                'fillColor': color,
                                'color': '#333333' if has_ips else '#AAAAAA',
                                'weight': 0.8 if has_ips else 0.3,
                                'fillOpacity': opacity,
                                'dashArray': '' if has_ips else '3, 3'  # Línea punteada si no tiene IPS
                            },
                            tooltip=folium.Tooltip(
                                tooltip_html,
                                sticky=True
                            )
                        ).add_to(municipalities_layer)
                        
                        municipalities_drawn += 1
                    except Exception as e:
                        pass
        
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
        
        # Dibujar localidades (similar lógica)
        localities_path = 'data/geojson/localities'
        if os.path.exists(localities_path):
            for filename in os.listdir(localities_path):
                if filename.endswith('.geojson'):
                    locality_id = filename.replace('.geojson', '')
                    
                    # En modo limpio, solo dibujar localidades con IPS
                    if self.clean_mode and locality_id not in municipalities_with_ips:
                        continue
                    
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
                    
                    # Obtener datos de la localidad
                    loc_data = localities_data.get(locality_id, {})
                    loc_name = loc_data.get('name', f'Localidad {locality_id}')
                    population = loc_data.get('population', 0)
                    ips_count = municipality_ips_count.get(locality_id, 0)
                    
                    try:
                        with open(os.path.join(localities_path, filename), 'r') as f:
                            geojson_data = json.load(f)
                        
                        # Crear tooltip con información
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
                                'color': '#000000',  # Borde negro para localidades
                                'weight': 2.0,  # Borde más grueso para localidades
                                'fillOpacity': opacity * 0.8,  # Slightly less opacity for localities
                                'dashArray': ''  # Sin líneas punteadas
                            },
                            tooltip=folium.Tooltip(
                                tooltip_html,
                                sticky=True
                            )
                        ).add_to(localities_layer)
                    except:
                        pass
        
        print(f"   ✓ {municipalities_drawn} polígonos dibujados")
        
        # Agregar puntos de IPS (pequeños círculos)
        for ips in ips_locations:
            # Determinar tamaño basado en nivel de servicio
            service_level = int(ips['service_level']) if str(ips['service_level']).isdigit() else 1
            radius = 2 + (service_level * 0.8)  # Nivel 1=2.8, Nivel 2=3.6, Nivel 3=4.4, Nivel 4=5.2
            
            # Crear HTML para el popup con información detallada
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
                            <td style='padding: 2px 0;'><b>👔 KAM:</b></td>
                            <td style='padding: 2px 0;'>{kam_info[ips['kam_id']]['name']}</td>
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
                    <b>Capacidad instalada:</b>
                    <table style='width: 100%; margin-top: 4px;'>
                        <tr>
                            <td style='padding: 2px 0;'>🛏️ Camas:</td>
                            <td style='padding: 2px 0; text-align: right;'><b>{ips['camas']}</b></td>
                            <td style='width: 20px;'></td>
                            <td style='padding: 2px 0;'>🏥 Quirófanos:</td>
                            <td style='padding: 2px 0; text-align: right;'><b>{ips['quirofano']}</b></td>
                        </tr>
                        <tr>
                            <td style='padding: 2px 0;'>🚑 Ambulancias:</td>
                            <td style='padding: 2px 0; text-align: right;'><b>{ips['ambulancias']}</b></td>
                            <td></td>
                            <td></td>
                            <td></td>
                        </tr>
                    </table>
                </div>
            """
            
            # Agregar servicios si existen
            if ips['services']:
                services_list = [s.strip() for s in ips['services'].split(',')][:5]  # Mostrar máximo 5 servicios
                services_html = "<br>".join([f"• {s}" for s in services_list])
                if len(ips['services'].split(',')) > 5:
                    services_html += f"<br>• ... y {len(ips['services'].split(',')) - 5} servicios más"
                
                popup_html += f"""
                <div style='margin-top: 8px; background-color: #fff3cd; padding: 8px; border-radius: 4px;'>
                    <b>Servicios principales:</b><br>
                    <div style='font-size: 11px; margin-top: 4px;'>
                        {services_html}
                    </div>
                </div>
                """
            
            popup_html += "</div>"
            
            folium.CircleMarker(
                location=[ips['lat'], ips['lng']],
                radius=radius,
                popup=folium.Popup(
                    popup_html,
                    max_width=320
                ),
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
                # Contar IPS reales vs municipios solo población
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
        
        # Agregar capas al mapa
        # Agregar capas al mapa en orden correcto (municipios primero, luego localidades)
        municipalities_layer.add_to(m)
        localities_layer.add_to(m)
        ips_layer.add_to(m)
        kam_layer.add_to(m)
        
        # Leyenda mejorada
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
        </div>
        <hr style="margin: 8px 0; border: none; border-top: 1px solid #ddd;">
        <div style="font-size: 11px; color: #333;">
        '''
        
        # Agregar KAMs a la leyenda (solo los 6 con más IPS)
        sorted_kams = sorted(
            [(kam_id, sum(1 for ips in assignments[kam_id] if not ips.get('is_population_only', False))) 
             for kam_id in assignments.keys()],
            key=lambda x: x[1],
            reverse=True
        )[:6]
        
        for kam_id, real_ips in sorted_kams:
            kam = kam_info[kam_id]
            color = kam_colors[kam_id]
            legend_html += f'''
            <div style="margin: 2px 0;">
                <span style="color: {color}; font-size: 16px;">●</span>
                {kam['name']} ({real_ips})
            </div>
            '''
        
        legend_html += '''
        </div>
        </div>
        '''
        
        m.get_root().html.add_child(folium.Element(legend_html))
        
        # Control de capas
        folium.LayerControl(position='topleft').add_to(m)
        
        # Guardar mapa
        m.save(output_file)
        print(f"   ✓ Mapa mejorado guardado en: {output_file}")