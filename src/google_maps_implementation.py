"""
Implementación de Google Maps Distance Matrix API para OpMap.
Este archivo contiene el código listo para usar cuando tengas tu API habilitada.
"""

import requests
from typing import Tuple, Optional

def call_google_maps_api(origin: Tuple[float, float], 
                        destination: Tuple[float, float], 
                        api_key: str,
                        mode: str = 'driving') -> Optional[int]:
    """
    Llama a Google Maps Distance Matrix API para calcular tiempo de viaje.
    
    Args:
        origin: Tupla (lat, lng) del origen
        destination: Tupla (lat, lng) del destino
        api_key: Tu API key de Google Maps
        mode: Modo de transporte (driving, walking, transit, bicycling)
        
    Returns:
        Tiempo en minutos o None si hay error
    """
    url = "https://maps.googleapis.com/maps/api/distancematrix/json"
    
    params = {
        "origins": f"{origin[0]},{origin[1]}",
        "destinations": f"{destination[0]},{destination[1]}",
        "mode": mode,
        "units": "metric",
        "language": "es",  # Respuesta en español
        "key": api_key
    }
    
    try:
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        
        data = response.json()
        
        if data["status"] == "OK":
            rows = data.get("rows", [])
            if rows and rows[0]["elements"]:
                element = rows[0]["elements"][0]
                
                if element["status"] == "OK":
                    # Retornar duración en minutos
                    duration_seconds = element["duration"]["value"]
                    return duration_seconds // 60
                else:
                    print(f"Error en ruta: {element.get('status')}")
                    return None
        else:
            print(f"Error API: {data.get('status')}")
            if "error_message" in data:
                print(f"Mensaje: {data['error_message']}")
            return None
            
    except requests.exceptions.RequestException as e:
        print(f"Error de conexión: {str(e)}")
        return None
    except Exception as e:
        print(f"Error inesperado: {str(e)}")
        return None


# Ejemplo de uso de la nueva Routes API (más moderna)
def call_routes_api(origin: Tuple[float, float], 
                   destination: Tuple[float, float], 
                   api_key: str) -> Optional[int]:
    """
    Llama a la nueva Google Routes API (recomendada para 2025).
    
    Esta es la API más moderna que reemplazará a Distance Matrix.
    """
    url = "https://routes.googleapis.com/directions/v2:computeRoutes"
    
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": api_key,
        "X-Goog-FieldMask": "routes.duration,routes.distanceMeters"
    }
    
    body = {
        "origin": {
            "location": {
                "latLng": {
                    "latitude": origin[0],
                    "longitude": origin[1]
                }
            }
        },
        "destination": {
            "location": {
                "latLng": {
                    "latitude": destination[0],
                    "longitude": destination[1]
                }
            }
        },
        "travelMode": "DRIVE",
        "routingPreference": "TRAFFIC_AWARE",
        "computeAlternativeRoutes": False
    }
    
    try:
        response = requests.post(url, json=body, headers=headers, timeout=10)
        response.raise_for_status()
        
        data = response.json()
        
        if "routes" in data and data["routes"]:
            route = data["routes"][0]
            # La duración viene en formato "1234s" (segundos)
            duration_str = route.get("duration", "0s")
            duration_seconds = int(duration_str.rstrip("s"))
            return duration_seconds // 60
        else:
            print("No se encontraron rutas")
            return None
            
    except Exception as e:
        print(f"Error en Routes API: {str(e)}")
        return None


# Para integrar en distance_calculator.py, solo necesitas:
# 1. Importar este archivo
# 2. En el método _call_google_maps_api, usar:
#    from .google_maps_implementation import call_google_maps_api
#    return call_google_maps_api(origin, destination, self.api_key, mode)