#!/usr/bin/env python3
"""
OpMap con Supabase - Sistema de Asignación Territorial Optimizada
Versión que usa Supabase para almacenar y recuperar tiempos de viaje
Compatible con despliegues en Vercel
"""

import json
import os
import sys
from typing import Dict, List, Tuple, Optional
from datetime import datetime
import time

# Agregar el directorio src al path
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

from src.utils.supabase_client import SupabaseClient
from src.utils.google_maps_client import GoogleMapsClient
from src.algorithms.opmap_algorithm_bogota import BogotaOpMapAlgorithm
from src.visualizers.clean_map_visualizer import CleanMapVisualizer
from src.utils.distance_calculator import haversine_distance, haversine_time_estimate

class OpMapSupabase:
    """Sistema OpMap que usa Supabase como backend de datos"""
    
    def __init__(self):
        """Inicializa el sistema con clientes de Supabase y Google Maps"""
        self.supabase = SupabaseClient()
        self.google_maps = GoogleMapsClient()
        self.stats = {
            'supabase_hits': 0,
            'google_api_calls': 0,
            'haversine_fallbacks': 0,
            'total_queries': 0,
            'errors': 0
        }
    
    def get_travel_time(self, origin_lat: float, origin_lng: float,
                       dest_lat: float, dest_lng: float,
                       max_time: int = 240) -> Optional[int]:
        """
        Obtiene el tiempo de viaje, primero desde Supabase, luego Google Maps
        
        Args:
            origin_lat: Latitud de origen
            origin_lng: Longitud de origen
            dest_lat: Latitud de destino
            dest_lng: Longitud de destino
            max_time: Tiempo máximo permitido en minutos
            
        Returns:
            Tiempo en minutos o None si no es alcanzable
        """
        self.stats['total_queries'] += 1
        
        # 1. Intentar obtener de Supabase primero
        travel_time = self.supabase.get_travel_time(
            origin_lat, origin_lng, dest_lat, dest_lng
        )
        
        if travel_time is not None:
            self.stats['supabase_hits'] += 1
            return travel_time if travel_time <= max_time else None
        
        # 2. Si no está en Supabase, calcular con Google Maps
        try:
            travel_time = self.google_maps.get_travel_time(
                origin_lat, origin_lng, dest_lat, dest_lng
            )
            
            if travel_time is not None:
                self.stats['google_api_calls'] += 1
                
                # Guardar en Supabase para futuras consultas
                self.supabase.save_travel_time(
                    origin_lat, origin_lng,
                    dest_lat, dest_lng,
                    travel_time,
                    source='google_maps'
                )
                
                return travel_time if travel_time <= max_time else None
        
        except Exception as e:
            print(f"Error con Google Maps API: {e}")
            self.stats['errors'] += 1
        
        # 3. Fallback a Haversine si Google Maps falla
        distance = haversine_distance(origin_lat, origin_lng, dest_lat, dest_lng)
        haversine_time = haversine_time_estimate(origin_lat, origin_lng, dest_lat, dest_lng)
        
        if haversine_time <= max_time:
            self.stats['haversine_fallbacks'] += 1
            
            # NO guardar Haversine en Supabase según los requerimientos
            # Solo usarlo temporalmente
            
            return haversine_time
        
        return None
    
    def run_algorithm(self, output_prefix: str = "opmap_supabase"):
        """
        Ejecuta el algoritmo OpMap usando Supabase como fuente de datos
        
        Args:
            output_prefix: Prefijo para los archivos de salida
        """
        print("🚀 Iniciando OpMap con Supabase...")
        print(f"📅 Fecha: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        # Crear instancia del algoritmo con función personalizada
        algorithm = BogotaOpMapAlgorithm(
            travel_time_func=self.get_travel_time
        )
        
        # Ejecutar el algoritmo
        print("\n⚙️ Ejecutando algoritmo de asignación territorial...")
        start_time = time.time()
        
        results = algorithm.run()
        
        elapsed_time = time.time() - start_time
        print(f"\n✅ Algoritmo completado en {elapsed_time:.2f} segundos")
        
        # Mostrar estadísticas
        self._print_statistics(results)
        
        # Guardar resultados
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Guardar JSON con resultados
        output_file = f"output/{output_prefix}_results_{timestamp}.json"
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(results, f, ensure_ascii=False, indent=2)
        print(f"\n💾 Resultados guardados en: {output_file}")
        
        # Generar mapa
        print("\n🗺️ Generando visualización del mapa...")
        visualizer = CleanMapVisualizer()
        map_file = f"output/{output_prefix}_map_{timestamp}.html"
        visualizer.create_map(results, map_file)
        print(f"🌍 Mapa guardado en: {map_file}")
        
        return results
    
    def _print_statistics(self, results: Dict):
        """Imprime estadísticas del proceso"""
        print("\n📊 Estadísticas de Asignación:")
        print("=" * 50)
        
        # Estadísticas de hospitales
        total_assigned = sum(len(data['hospitals']) for data in results['kams'].values())
        print(f"🏥 Total IPS asignadas: {total_assigned}")
        print(f"❌ IPS no asignadas: {len(results.get('unassigned_hospitals', []))}")
        
        # Estadísticas por KAM
        print("\n👥 Distribución por KAM:")
        for kam_name, data in sorted(results['kams'].items(), 
                                    key=lambda x: len(x[1]['hospitals']), 
                                    reverse=True):
            count = len(data['hospitals'])
            print(f"  • {kam_name}: {count} IPS")
        
        # Estadísticas de caché
        print("\n💾 Estadísticas de Datos:")
        print(f"  • Consultas totales: {self.stats['total_queries']:,}")
        print(f"  • Hits de Supabase: {self.stats['supabase_hits']:,} "
              f"({self.stats['supabase_hits']/max(1, self.stats['total_queries'])*100:.1f}%)")
        print(f"  • Llamadas a Google Maps API: {self.stats['google_api_calls']:,}")
        print(f"  • Fallbacks a Haversine: {self.stats['haversine_fallbacks']:,}")
        print(f"  • Errores: {self.stats['errors']:,}")
        
        # Costo estimado
        if self.stats['google_api_calls'] > 0:
            estimated_cost = self.stats['google_api_calls'] * 0.005
            print(f"\n💰 Costo estimado de Google Maps: ${estimated_cost:.2f} USD")

def main():
    """Función principal"""
    try:
        # Verificar variables de entorno
        if not os.getenv('SUPABASE_URL') or os.getenv('SUPABASE_URL') == 'your_supabase_url_here':
            print("❌ Error: Configura SUPABASE_URL y SUPABASE_ANON_KEY en el archivo .env")
            print("Puedes obtener estos valores desde tu proyecto de Supabase:")
            print("1. Ve a https://app.supabase.io")
            print("2. Selecciona tu proyecto")
            print("3. Ve a Settings > API")
            print("4. Copia 'Project URL' y 'anon public key'")
            return
        
        # Ejecutar el sistema
        opmap = OpMapSupabase()
        opmap.run_algorithm()
        
        print("\n✨ Proceso completado exitosamente!")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()