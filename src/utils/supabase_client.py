"""
Cliente de Supabase para OpMap
Maneja la conexión y operaciones con la base de datos
"""
import os
import json
from typing import List, Dict, Optional, Tuple
from datetime import datetime
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

class SupabaseClient:
    def __init__(self):
        """Inicializa el cliente de Supabase"""
        supabase_url = os.getenv('SUPABASE_URL')
        supabase_key = os.getenv('SUPABASE_ANON_KEY')
        
        if not supabase_url or not supabase_key:
            raise ValueError("SUPABASE_URL y SUPABASE_ANON_KEY deben estar configurados en .env")
        
        self.client: Client = create_client(supabase_url, supabase_key)
    
    def get_travel_time(self, origin_lat: float, origin_lng: float, 
                       dest_lat: float, dest_lng: float) -> Optional[int]:
        """
        Obtiene el tiempo de viaje desde el caché de Supabase
        
        Args:
            origin_lat: Latitud de origen
            origin_lng: Longitud de origen
            dest_lat: Latitud de destino
            dest_lng: Longitud de destino
            
        Returns:
            Tiempo en minutos o None si no existe
        """
        try:
            # Buscar en la tabla travel_time_cache
            # Redondeamos a 6 decimales para evitar problemas de precisión
            response = self.client.table('travel_time_cache').select('travel_time').eq(
                'origin_lat', round(origin_lat, 6)
            ).eq(
                'origin_lng', round(origin_lng, 6)
            ).eq(
                'dest_lat', round(dest_lat, 6)
            ).eq(
                'dest_lng', round(dest_lng, 6)
            ).execute()
            
            if response.data and len(response.data) > 0:
                return response.data[0]['travel_time']
            
            return None
            
        except Exception as e:
            print(f"Error al obtener tiempo de viaje de Supabase: {e}")
            return None
    
    def save_travel_time(self, origin_lat: float, origin_lng: float,
                        dest_lat: float, dest_lng: float,
                        travel_time: int, distance: Optional[float] = None,
                        source: str = 'google_maps') -> bool:
        """
        Guarda un tiempo de viaje en Supabase
        
        Args:
            origin_lat: Latitud de origen
            origin_lng: Longitud de origen
            dest_lat: Latitud de destino
            dest_lng: Longitud de destino
            travel_time: Tiempo en minutos
            distance: Distancia en km (opcional)
            source: Fuente del cálculo ('google_maps' o 'haversine')
            
        Returns:
            True si se guardó correctamente
        """
        try:
            data = {
                'origin_lat': round(origin_lat, 6),
                'origin_lng': round(origin_lng, 6),
                'dest_lat': round(dest_lat, 6),
                'dest_lng': round(dest_lng, 6),
                'travel_time': travel_time,
                'source': source,
                'calculated_at': datetime.utcnow().isoformat()
            }
            
            if distance is not None:
                data['distance'] = round(distance, 2)
            
            # Insertar o actualizar (upsert)
            response = self.client.table('travel_time_cache').upsert(
                data,
                on_conflict='origin_lat,origin_lng,dest_lat,dest_lng'
            ).execute()
            
            return len(response.data) > 0
            
        except Exception as e:
            print(f"Error al guardar tiempo de viaje en Supabase: {e}")
            return False
    
    def get_all_travel_times(self) -> List[Dict]:
        """
        Obtiene todos los tiempos de viaje del caché usando paginación
        
        Returns:
            Lista de diccionarios con los tiempos de viaje
        """
        try:
            all_data = []
            page_size = 1000
            offset = 0
            
            while True:
                # Obtener página actual
                response = self.client.table('travel_time_cache').select('*').range(offset, offset + page_size - 1).execute()
                
                if not response.data:
                    break
                    
                all_data.extend(response.data)
                
                # Si recibimos menos registros que el tamaño de página, terminamos
                if len(response.data) < page_size:
                    break
                    
                offset += page_size
                
            return all_data
        except Exception as e:
            print(f"Error al obtener todos los tiempos de viaje: {e}")
            return []
    
    def get_travel_times_batch(self, coordinates: List[Tuple[float, float, float, float]]) -> Dict:
        """
        Obtiene múltiples tiempos de viaje en una sola consulta
        
        Args:
            coordinates: Lista de tuplas (origin_lat, origin_lng, dest_lat, dest_lng)
            
        Returns:
            Diccionario con clave (origin_lat, origin_lng, dest_lat, dest_lng) y valor travel_time
        """
        try:
            # Construir consulta OR para múltiples coordenadas
            if not coordinates:
                return {}
            
            # Por limitaciones de Supabase, es mejor hacer consultas individuales
            # o usar una función almacenada para consultas complejas
            result = {}
            
            for origin_lat, origin_lng, dest_lat, dest_lng in coordinates:
                travel_time = self.get_travel_time(origin_lat, origin_lng, dest_lat, dest_lng)
                if travel_time is not None:
                    key = (round(origin_lat, 6), round(origin_lng, 6), 
                          round(dest_lat, 6), round(dest_lng, 6))
                    result[key] = travel_time
            
            return result
            
        except Exception as e:
            print(f"Error al obtener tiempos de viaje en lote: {e}")
            return {}
    
    def migrate_from_json_cache(self, json_file_path: str) -> Tuple[int, int]:
        """
        Migra los datos del caché JSON a Supabase
        
        Args:
            json_file_path: Ruta al archivo JSON del caché
            
        Returns:
            Tupla (registros_migrados, registros_fallidos)
        """
        try:
            with open(json_file_path, 'r') as f:
                cache_data = json.load(f)
            
            migrated = 0
            failed = 0
            
            for key, value in cache_data.items():
                # El key tiene formato "origin_lat,origin_lng,dest_lat,dest_lng"
                coords = key.split(',')
                if len(coords) != 4:
                    failed += 1
                    continue
                
                try:
                    origin_lat = float(coords[0])
                    origin_lng = float(coords[1])
                    dest_lat = float(coords[2])
                    dest_lng = float(coords[3])
                    
                    # Determinar la fuente basándose en el valor
                    # Si es un entero simple, probablemente es Haversine
                    # Si tiene decimales, es más probable que sea Google Maps
                    source = 'google_maps'
                    travel_time = int(value)
                    
                    success = self.save_travel_time(
                        origin_lat, origin_lng,
                        dest_lat, dest_lng,
                        travel_time,
                        source=source
                    )
                    
                    if success:
                        migrated += 1
                    else:
                        failed += 1
                        
                except (ValueError, TypeError):
                    failed += 1
                    continue
            
            return migrated, failed
            
        except Exception as e:
            print(f"Error al migrar caché JSON: {e}")
            return 0, 0
    
    def clear_haversine_calculations(self) -> int:
        """
        Elimina los cálculos de Haversine del caché
        
        Returns:
            Número de registros eliminados
        """
        try:
            # Eliminar registros donde source = 'haversine'
            response = self.client.table('travel_time_cache').delete().eq(
                'source', 'haversine'
            ).execute()
            
            return len(response.data)
            
        except Exception as e:
            print(f"Error al limpiar cálculos Haversine: {e}")
            return 0