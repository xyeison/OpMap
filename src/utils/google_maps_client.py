"""
Cliente de Google Maps para OpMap
Maneja las consultas a Google Maps Distance Matrix API
"""
import os
import json
import requests
from typing import Optional, Tuple
from dotenv import load_dotenv

load_dotenv()

class GoogleMapsClient:
    def __init__(self):
        """Inicializa el cliente de Google Maps"""
        self.api_key = os.getenv('GOOGLE_MAPS_API_KEY')
        if not self.api_key:
            raise ValueError("GOOGLE_MAPS_API_KEY debe estar configurado en .env")
        
        self.base_url = "https://maps.googleapis.com/maps/api/distancematrix/json"
        self.calls_count = 0
    
    def get_travel_time(self, origin_lat: float, origin_lng: float, 
                       dest_lat: float, dest_lng: float) -> Optional[int]:
        """
        Obtiene el tiempo de viaje entre dos puntos usando Google Maps
        
        Args:
            origin_lat: Latitud de origen
            origin_lng: Longitud de origen
            dest_lat: Latitud de destino
            dest_lng: Longitud de destino
            
        Returns:
            Tiempo en minutos o None si no hay ruta
        """
        try:
            # Construir parámetros
            params = {
                'origins': f"{origin_lat},{origin_lng}",
                'destinations': f"{dest_lat},{dest_lng}",
                'mode': 'driving',
                'units': 'metric',
                'key': self.api_key
            }
            
            # Hacer la solicitud
            response = requests.get(self.base_url, params=params)
            self.calls_count += 1
            
            if response.status_code != 200:
                print(f"Error en Google Maps API: {response.status_code}")
                return None
            
            data = response.json()
            
            # Verificar el estado de la respuesta
            if data.get('status') != 'OK':
                print(f"Error en respuesta de Google Maps: {data.get('status')}")
                return None
            
            # Extraer el tiempo de viaje
            if data.get('rows') and len(data['rows']) > 0:
                elements = data['rows'][0].get('elements', [])
                if elements and len(elements) > 0:
                    element = elements[0]
                    if element.get('status') == 'OK':
                        duration = element.get('duration', {})
                        # Retornar tiempo en minutos
                        return round(duration.get('value', 0) / 60)
            
            return None
            
        except Exception as e:
            print(f"Error al consultar Google Maps: {e}")
            return None
    
    def get_travel_info(self, origin_lat: float, origin_lng: float, 
                        dest_lat: float, dest_lng: float) -> Tuple[Optional[int], Optional[float]]:
        """
        Obtiene el tiempo de viaje y distancia entre dos puntos
        
        Args:
            origin_lat: Latitud de origen
            origin_lng: Longitud de origen
            dest_lat: Latitud de destino
            dest_lng: Longitud de destino
            
        Returns:
            Tupla (tiempo_en_minutos, distancia_en_km) o (None, None) si no hay ruta
        """
        try:
            # Construir parámetros
            params = {
                'origins': f"{origin_lat},{origin_lng}",
                'destinations': f"{dest_lat},{dest_lng}",
                'mode': 'driving',
                'units': 'metric',
                'key': self.api_key
            }
            
            # Hacer la solicitud
            response = requests.get(self.base_url, params=params)
            self.calls_count += 1
            
            if response.status_code != 200:
                return None, None
            
            data = response.json()
            
            if data.get('status') != 'OK':
                return None, None
            
            # Extraer tiempo y distancia
            if data.get('rows') and len(data['rows']) > 0:
                elements = data['rows'][0].get('elements', [])
                if elements and len(elements) > 0:
                    element = elements[0]
                    if element.get('status') == 'OK':
                        duration = element.get('duration', {})
                        distance = element.get('distance', {})
                        
                        time_minutes = round(duration.get('value', 0) / 60)
                        distance_km = round(distance.get('value', 0) / 1000, 2)
                        
                        return time_minutes, distance_km
            
            return None, None
            
        except Exception as e:
            print(f"Error al consultar Google Maps: {e}")
            return None, None
    
    def get_api_calls_count(self) -> int:
        """Retorna el número de llamadas a la API realizadas"""
        return self.calls_count