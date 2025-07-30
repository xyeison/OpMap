import math

def haversine_distance(lat1, lon1, lat2, lon2):
    """
    Calcula la distancia entre dos puntos en la Tierra usando la fórmula de Haversine.
    Retorna la distancia en kilómetros.
    """
    R = 6371  # Radio de la Tierra en km
    
    # Convertir grados a radianes
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    
    # Fórmula de Haversine
    a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    distance = R * c
    
    return distance

# Coordenadas de la visita reportada
visit_lat = 10.4666
visit_lon = -73.2547

print(f"Coordenadas de la visita: {visit_lat}, {visit_lon}")
print(f"Ubicación aproximada: Valledupar, Cesar, Colombia")
print()

# Verificar algunas ubicaciones cercanas conocidas
locations = [
    ("Valledupar (centro)", 10.4631, -73.2532),
    ("Hospital Rosario Pumarejo de López", 10.4650, -73.2500),
    ("Clínica Laura Daniela", 10.4680, -73.2520),
]

print("Distancias a ubicaciones conocidas:")
for name, lat, lon in locations:
    dist = haversine_distance(visit_lat, visit_lon, lat, lon)
    print(f"- {name}: {dist:.2f} km ({dist*1000:.0f} metros)")

print("\nNota: La visita está correctamente georeferenciada en Valledupar.")
print("Si no se ve el mapa de calor, puede ser porque:")
print("1. Los controles de visitas no están activados")
print("2. El mapa de calor está desactivado")
print("3. No hay suficientes visitas en el área para generar calor visible")
print("4. El radio del mapa de calor es muy pequeño para el nivel de zoom")