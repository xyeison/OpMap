"""
Módulo de cálculo de distancias/tiempos para OpMap.
Temporalmente usa Haversine, pero está estructurado para reemplazar
fácilmente con Google Maps Distance Matrix API.
"""

import math
from typing import Dict, List, Tuple, Optional
import json
from datetime import datetime

class DistanceCalculator:
    """
    Calculador de distancias/tiempos con caché integrado.
    Simula exactamente el comportamiento de Google Maps API.
    """
    
    def __init__(self, use_google_api: bool = False, api_key: str = None):
        self.use_google_api = use_google_api
        self.api_key = api_key
        self.cache = {}  # Cache en memoria para evitar cálculos duplicados
        self.api_calls_count = 0  # Contador de "llamadas API" para estadísticas
        
        # Velocidad promedio en km/h para diferentes tipos de vías en Colombia
        # Estos valores simulan las condiciones reales de Google Maps
        self.speed_factors = {
            'urban': 40,      # Velocidad en ciudad
            'highway': 80,    # Velocidad en autopista
            'rural': 50       # Velocidad en carretera rural
        }
    
    def calculate_travel_time(self, origin: Tuple[float, float], 
                            destination: Tuple[float, float],
                            mode: str = 'driving') -> Optional[int]:
        """
        Calcula el tiempo de viaje entre dos puntos.
        
        Args:
            origin: Tupla (lat, lng) del origen
            destination: Tupla (lat, lng) del destino
            mode: Modo de transporte (siempre 'driving' para OpMap)
            
        Returns:
            Tiempo en minutos o None si no se puede calcular
        """
        # Crear clave única para el caché
        cache_key = f"{origin[0]},{origin[1]}|{destination[0]},{destination[1]}|{mode}"
        
        # Verificar si ya está en caché
        if cache_key in self.cache:
            return self.cache[cache_key]
        
        # Incrementar contador de "llamadas API"
        self.api_calls_count += 1
        
        if self.use_google_api:
            # Implementar llamada real a Google Maps API
            result = self._call_google_maps_api(origin, destination, mode)
        else:
            # Usar Haversine temporalmente
            result = self._calculate_haversine_time(origin, destination)
        
        # Guardar en caché
        self.cache[cache_key] = result
        return result
    
    def _calculate_haversine_time(self, origin: Tuple[float, float], 
                                 destination: Tuple[float, float]) -> int:
        """
        Calcula el tiempo de viaje usando la fórmula de Haversine.
        Añade un factor de realismo para simular rutas reales vs línea recta.
        """
        # Radio de la Tierra en kilómetros
        R = 6371.0
        
        lat1, lon1 = origin
        lat2, lon2 = destination
        
        # Convertir a radianes
        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        lon1_rad = math.radians(lon1)
        lon2_rad = math.radians(lon2)
        
        # Diferencias
        dlat = lat2_rad - lat1_rad
        dlon = lon2_rad - lon1_rad
        
        # Fórmula de Haversine
        a = math.sin(dlat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon/2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        distance_km = R * c
        
        # Factor de realismo: las rutas reales son ~1.3x más largas que la línea recta
        real_distance_km = distance_km * 1.3
        
        # Determinar tipo de ruta basado en la distancia
        if distance_km < 50:
            speed = self.speed_factors['urban']
        elif distance_km < 200:
            speed = self.speed_factors['rural']
        else:
            speed = self.speed_factors['highway']
        
        # Calcular tiempo en minutos
        time_minutes = int((real_distance_km / speed) * 60)
        
        return time_minutes
    
    def calculate_batch(self, origin_destination_pairs: List[Tuple[Tuple[float, float], 
                                                                  Tuple[float, float]]]) -> List[Optional[int]]:
        """
        Calcula tiempos para múltiples pares origen-destino.
        Simula el batch processing de Google Maps API.
        """
        results = []
        for origin, destination in origin_destination_pairs:
            time = self.calculate_travel_time(origin, destination)
            results.append(time)
        return results
    
    def get_statistics(self) -> Dict:
        """
        Retorna estadísticas de uso para optimización.
        """
        return {
            'total_calculations': self.api_calls_count,
            'cached_results': len(self.cache),
            'cache_hit_rate': (len(self.cache) / max(self.api_calls_count, 1)) * 100 if self.api_calls_count > 0 else 0,
            'estimated_api_cost': self.api_calls_count * 0.005  # $5 por 1000 elementos
        }
    
    def save_cache(self, filepath: str):
        """
        Guarda el caché en un archivo para persistencia.
        """
        cache_data = {
            'timestamp': datetime.now().isoformat(),
            'statistics': self.get_statistics(),
            'cache': self.cache
        }
        with open(filepath, 'w') as f:
            json.dump(cache_data, f, indent=2)
    
    def load_cache(self, filepath: str):
        """
        Carga el caché desde un archivo.
        """
        try:
            with open(filepath, 'r') as f:
                data = json.load(f)
                self.cache = data.get('cache', {})
        except FileNotFoundError:
            pass  # No hay caché previo
    
    def _call_google_maps_api(self, origin: Tuple[float, float], 
                             destination: Tuple[float, float], 
                             mode: str = 'driving') -> Optional[int]:
        """
        Llama a Google Maps Distance Matrix API.
        Para activar, asegúrate de tener la API habilitada en Google Cloud Console.
        """
        # Importar la implementación
        from .google_maps_implementation import call_google_maps_api
        
        if not self.api_key:
            print("⚠️  Error: No se proporcionó API key de Google Maps")
            return None
        
        return call_google_maps_api(origin, destination, self.api_key, mode)