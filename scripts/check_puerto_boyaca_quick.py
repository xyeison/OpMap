#!/usr/bin/env python3
"""
Verificación rápida del problema de Puerto Boyacá
"""
from supabase import create_client
import math

supabase_url = 'https://norvxqgohddgsdkggqzq.supabase.co'
supabase_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vcnZ4cWdvaGRkZ3Nka2dncXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMDExMjUsImV4cCI6MjA2ODc3NzEyNX0.BRWIYeD_5OlpVKIrP1QzUmkSx6HEVGzcEUUiSK8CmJs'

supabase = create_client(supabase_url, supabase_key)

def haversine_distance(lat1, lon1, lat2, lon2):
    """Calcular distancia en línea recta en km"""
    R = 6371
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return R * c

print("🔍 VERIFICACIÓN RÁPIDA - PUERTO BOYACÁ")
print("="*60)

# 1. Buscar el hospital
hospital = supabase.table('hospitals').select('*').eq('code', '900678145-1').execute()
if not hospital.data:
    print("❌ Hospital no encontrado")
    exit()

h = hospital.data[0]
print(f"\n📍 Hospital: {h['name']}")
print(f"   Ubicación: {h['municipality_name']}, {h['department_name']}")
print(f"   Coordenadas: ({h['lat']}, {h['lng']})")

# 2. Verificar distancias
distances = supabase.table('hospital_kam_distances').select('*, kams(name, lat, lng)').eq('hospital_id', h['id']).order('travel_time').limit(10).execute()

print(f"\n📊 Tiempos registrados (más cortos):")
for d in distances.data:
    kam = d['kams']
    straight_km = haversine_distance(h['lat'], h['lng'], kam['lat'], kam['lng'])
    min_time = (straight_km / 120) * 60  # Tiempo mínimo a 120 km/h
    
    print(f"   {kam['name']:20} → {d['travel_time']:4} min")
    print(f"      Distancia línea recta: {straight_km:.0f} km")
    print(f"      Tiempo mínimo posible: {min_time:.0f} min")
    
    if d['travel_time'] < min_time * 0.5:
        print(f"      ⚠️ IMPOSIBLE - El tiempo es menor al 50% del mínimo físico")

# 3. Verificar el patrón de valores
print("\n📊 PATRÓN DE VALORES:")
all_times = supabase.table('hospital_kam_distances').select('travel_time').eq('hospital_id', h['id']).execute()
times = [d['travel_time'] for d in all_times.data if d['travel_time']]

if times:
    print(f"   Total distancias: {len(times)}")
    print(f"   Rango: {min(times)} - {max(times)} min")
    print(f"   Promedio: {sum(times)/len(times):.1f} min")
    
    # Si TODOS los valores son < 10, hay un problema claro
    if max(times) < 10:
        print(f"\n   🚨 PROBLEMA DETECTADO:")
        print(f"      Todos los tiempos son < 10 minutos")
        print(f"      Esto es físicamente imposible para Puerto Boyacá")
        print(f"      Los valores parecen estar en HORAS, no minutos")
        
        print(f"\n   💡 CONVERSIÓN SUGERIDA:")
        print(f"      Si convertimos a minutos (* 60):")
        print(f"      Rango: {min(times)*60} - {max(times)*60} min")
        print(f"      Promedio: {(sum(times)/len(times))*60:.0f} min")
        print(f"      Estos valores son más realistas")

# 4. Buscar otros hospitales con el mismo problema
print("\n🔍 Buscando otros hospitales con tiempos < 10 min...")
query = """
    SELECT h.code, h.name, h.municipality_name, 
           MAX(hkd.travel_time) as max_time,
           MIN(hkd.travel_time) as min_time,
           COUNT(hkd.id) as count
    FROM hospitals h
    JOIN hospital_kam_distances hkd ON h.id = hkd.hospital_id
    WHERE hkd.travel_time IS NOT NULL
    GROUP BY h.id, h.code, h.name, h.municipality_name
    HAVING MAX(hkd.travel_time) < 10
    LIMIT 20
"""

# Usando RPC si está disponible, o método alternativo
suspicious = supabase.table('hospital_kam_distances').select('hospital_id').lt('travel_time', 10).execute()
unique_hospitals = set(d['hospital_id'] for d in suspicious.data)

if unique_hospitals:
    print(f"   Encontrados {len(unique_hospitals)} hospitales con tiempos < 10 min")
    
    # Mostrar algunos ejemplos
    for h_id in list(unique_hospitals)[:5]:
        h_info = supabase.table('hospitals').select('code, name, municipality_name').eq('id', h_id).execute()
        if h_info.data:
            print(f"      • {h_info.data[0]['code']} - {h_info.data[0]['name'][:40]} ({h_info.data[0]['municipality_name']})")

print("\n" + "="*60)
print("CONCLUSIÓN:")
print("-"*40)
print("Los tiempos de Puerto Boyacá (y posiblemente otros hospitales)")
print("parecen estar en HORAS en lugar de MINUTOS.")
print("Necesitan ser multiplicados por 60 para obtener minutos correctos.")
print("="*60)