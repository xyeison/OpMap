#!/usr/bin/env python3
"""
Resume OpMap desde Supabase - Solo lectura de datos existentes
No hace nuevas llamadas a Google Maps API
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
from src.algorithms.opmap_algorithm_bogota import BogotaOpMapAlgorithm
from src.visualizers.clean_map_visualizer import CleanMapVisualizer

class ResumeOpMapSupabase:
    """Sistema OpMap que solo lee datos existentes de Supabase"""
    
    def __init__(self):
        """Inicializa el sistema con cliente de Supabase"""
        self.supabase = SupabaseClient()
        self.stats = {
            'supabase_hits': 0,
            'cache_misses': 0,
            'total_queries': 0
        }
        
        # Pre-cargar todos los tiempos de viaje en memoria para mejor rendimiento
        print("📥 Cargando caché de tiempos de viaje desde Supabase...")
        self.cache = self._load_cache_to_memory()
        print(f"✅ {len(self.cache)} rutas cargadas en memoria")
    
    def _load_cache_to_memory(self) -> Dict[Tuple[float, float, float, float], int]:
        """
        Carga todos los tiempos de viaje de Supabase a memoria
        
        Returns:
            Diccionario con clave (origin_lat, origin_lng, dest_lat, dest_lng) y valor travel_time
        """
        cache = {}
        try:
            all_times = self.supabase.get_all_travel_times()
            
            for record in all_times:
                # Solo cargar registros de Google Maps (no Haversine)
                if record.get('source') == 'google_maps':
                    key = (
                        round(record['origin_lat'], 6),
                        round(record['origin_lng'], 6),
                        round(record['dest_lat'], 6),
                        round(record['dest_lng'], 6)
                    )
                    cache[key] = record['travel_time']
            
            return cache
            
        except Exception as e:
            print(f"⚠️ Error al cargar caché: {e}")
            return {}
    
    def get_travel_time_from_cache(self, origin_lat: float, origin_lng: float,
                                  dest_lat: float, dest_lng: float,
                                  max_time: int = 240) -> Optional[int]:
        """
        Obtiene el tiempo de viaje solo desde el caché en memoria
        
        Args:
            origin_lat: Latitud de origen
            origin_lng: Longitud de origen
            dest_lat: Latitud de destino
            dest_lng: Longitud de destino
            max_time: Tiempo máximo permitido en minutos
            
        Returns:
            Tiempo en minutos o None si no existe en caché
        """
        self.stats['total_queries'] += 1
        
        # Buscar en caché con coordenadas redondeadas
        key = (
            round(origin_lat, 6),
            round(origin_lng, 6),
            round(dest_lat, 6),
            round(dest_lng, 6)
        )
        
        travel_time = self.cache.get(key)
        
        if travel_time is not None:
            self.stats['supabase_hits'] += 1
            return travel_time if travel_time <= max_time else None
        else:
            self.stats['cache_misses'] += 1
            return None
    
    def run_algorithm(self, output_prefix: str = "resume_supabase"):
        """
        Ejecuta el algoritmo OpMap usando solo datos existentes en Supabase
        
        Args:
            output_prefix: Prefijo para los archivos de salida
        """
        print("\n🚀 Iniciando OpMap con datos de Supabase (solo lectura)...")
        print(f"📅 Fecha: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        if not self.cache:
            print("❌ No hay datos en el caché de Supabase. Ejecuta primero opmap_supabase.py")
            return None
        
        # Crear instancia del algoritmo con función personalizada
        algorithm = BogotaOpMapAlgorithm(
            travel_time_func=self.get_travel_time_from_cache
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
        print("\n💾 Estadísticas de Caché:")
        print(f"  • Rutas en caché: {len(self.cache):,}")
        print(f"  • Consultas totales: {self.stats['total_queries']:,}")
        print(f"  • Hits de caché: {self.stats['supabase_hits']:,} "
              f"({self.stats['supabase_hits']/max(1, self.stats['total_queries'])*100:.1f}%)")
        print(f"  • Rutas no encontradas: {self.stats['cache_misses']:,}")
        
        # Análisis de caché
        if self.stats['cache_misses'] > 0:
            print(f"\n⚠️ Advertencia: {self.stats['cache_misses']} rutas no encontradas en caché")
            print("   Ejecuta opmap_supabase.py para calcular las rutas faltantes")

def main():
    """Función principal"""
    try:
        # Verificar variables de entorno
        if not os.getenv('SUPABASE_URL') or os.getenv('SUPABASE_URL') == 'your_supabase_url_here':
            print("❌ Error: Configura SUPABASE_URL y SUPABASE_ANON_KEY en el archivo .env")
            return
        
        # Ejecutar el sistema
        resume = ResumeOpMapSupabase()
        resume.run_algorithm()
        
        print("\n✨ Proceso completado exitosamente!")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()