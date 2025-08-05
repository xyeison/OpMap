#!/usr/bin/env python3
"""
Verificar coordenadas de Girardot y calcular tiempo real desde Ibagué
"""

import os
from dotenv import load_dotenv
from supabase import create_client
import googlemaps

# Cargar variables de entorno
load_dotenv()

# Configurar Supabase
url = os.getenv('SUPABASE_URL')
key = os.getenv('SUPABASE_ANON_KEY')
supabase = create_client(url, key)

# Configurar Google Maps
gmaps = googlemaps.Client(key=os.getenv('GOOGLE_MAPS_API_KEY'))

print("🔍 VERIFICACIÓN DE COORDENADAS Y TIEMPOS\n")

# 1. Verificar coordenadas de Girardot
print("1. Verificando municipio Girardot...")
girardot = supabase.from_('municipalities').select('*').eq('code', '25307').execute()
if girardot.data:
    g = girardot.data[0]
    print(f"   Municipio: {g['name']}")
    print(f"   Coordenadas: {g.get('lat', 'NO TIENE')}, {g.get('lng', 'NO TIENE')}")

# 2. Verificar hospitales en Girardot
print("\n2. Verificando coordenadas de hospitales en Girardot...")
hospitals = supabase.from_('hospitals').select('name, lat, lng').eq('municipality_id', '25307').limit(1).execute()
if hospitals.data:
    h = hospitals.data[0]
    print(f"   Hospital: {h['name']}")
    print(f"   Coordenadas: {h['lat']}, {h['lng']}")
    
    # Verificar si las coordenadas son razonables para Girardot
    # Girardot debería estar cerca de 4.3°N, -74.8°W
    if abs(h['lat'] - 4.3) < 0.5 and abs(h['lng'] - (-74.8)) < 0.5:
        print("   ✅ Coordenadas parecen correctas para Girardot")
    else:
        print("   ⚠️ ADVERTENCIA: Coordenadas parecen incorrectas para Girardot")

# 3. Verificar KAM de Ibagué
print("\n3. Verificando KAM de Ibagué...")
ibague = supabase.from_('kams').select('*').eq('area_id', '73001').eq('active', True).execute()
if ibague.data:
    kam = ibague.data[0]
    print(f"   KAM: {kam['name']}")
    print(f"   Coordenadas: {kam['lat']}, {kam['lng']}")

# 4. Calcular tiempo real con Google Maps
if hospitals.data and ibague.data:
    print("\n4. Calculando tiempo real de viaje con Google Maps...")
    
    origin = f"{kam['lat']},{kam['lng']}"
    destination = f"{h['lat']},{h['lng']}"
    
    try:
        result = gmaps.distance_matrix(
            origins=[origin],
            destinations=[destination],
            mode="driving",
            language="es",
            units="metric"
        )
        
        if result['status'] == 'OK' and result['rows'][0]['elements'][0]['status'] == 'OK':
            element = result['rows'][0]['elements'][0]
            distance = element['distance']['value'] / 1000  # km
            duration = element['duration']['value'] / 60  # minutos
            
            print(f"   ✅ Tiempo de viaje: {duration:.0f} minutos ({duration/60:.1f} horas)")
            print(f"   ✅ Distancia: {distance:.1f} km")
            
            # Guardar en caché
            print("\n5. Guardando en caché de tiempos...")
            insert_result = supabase.from_('travel_time_cache').insert({
                'origin_lat': kam['lat'],
                'origin_lng': kam['lng'],
                'dest_lat': h['lat'],
                'dest_lng': h['lng'],
                'travel_time': int(duration * 60),  # segundos
                'distance': distance,
                'source': 'google_maps'
            }).execute()
            
            if insert_result.data:
                print("   ✅ Tiempo guardado en caché")
            else:
                print("   ❌ Error al guardar en caché")
                
            # Verificar si el tiempo está dentro del límite
            if duration <= 240:
                print(f"\n✅ CONCLUSIÓN: Ibagué SÍ puede competir por Girardot ({duration:.0f} min < 240 min)")
            else:
                print(f"\n❌ CONCLUSIÓN: Ibagué NO puede competir por Girardot ({duration:.0f} min > 240 min)")
                
        else:
            print("   ❌ No se pudo calcular la ruta")
            
    except Exception as e:
        print(f"   ❌ Error al consultar Google Maps: {e}")

# 5. Verificar otros tiempos en caché que parecen incorrectos
print("\n6. Verificando tiempos sospechosos en caché...")
suspicious = supabase.from_('travel_time_cache').select('*').lt('travel_time', 300).execute()  # < 5 minutos
if suspicious.data:
    print(f"   ⚠️ Encontrados {len(suspicious.data)} tiempos menores a 5 minutos")
    print("   Estos tiempos probablemente son erróneos y deberían recalcularse")