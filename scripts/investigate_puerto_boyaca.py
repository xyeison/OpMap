#!/usr/bin/env python3
"""
Investigar el caso de Puerto Boyacá con tiempos incorrectos
"""
from supabase import create_client
import math

supabase_url = 'https://norvxqgohddgsdkggqzq.supabase.co'
supabase_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vcnZ4cWdvaGRkZ3Nka2dncXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMDExMjUsImV4cCI6MjA2ODc3NzEyNX0.BRWIYeD_5OlpVKIrP1QzUmkSx6HEVGzcEUUiSK8CmJs'

supabase = create_client(supabase_url, supabase_key)

def haversine_distance(lat1, lon1, lat2, lon2):
    """Calcular distancia en línea recta en km"""
    R = 6371  # Radio de la Tierra en km
    
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    
    a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    
    return R * c

print("🔍 INVESTIGANDO CASO PUERTO BOYACÁ")
print("="*60)

# 1. Buscar el hospital
print("\n📍 Buscando hospital 900678145-1...")
hospital = supabase.table('hospitals').select('*').eq('code', '900678145-1').execute()

if not hospital.data:
    print("❌ Hospital no encontrado")
    exit()

h = hospital.data[0]
print(f"✅ Hospital encontrado:")
print(f"   Nombre: {h['name']}")
print(f"   Municipio: {h['municipality_name']}")
print(f"   Departamento: {h['department_name']}")
print(f"   Coordenadas: ({h['lat']}, {h['lng']})")

# 2. Obtener distancias registradas
print(f"\n📊 Distancias en hospital_kam_distances:")
distances = supabase.table('hospital_kam_distances').select('*, kams(name, area_id, lat, lng)').eq('hospital_id', h['id']).order('travel_time').execute()

if distances.data:
    print(f"   Total registros: {len(distances.data)}")
    print("\n   Tiempos registrados:")
    for d in distances.data[:10]:
        kam = d['kams']
        # Calcular distancia en línea recta
        straight_distance = haversine_distance(h['lat'], h['lng'], kam['lat'], kam['lng'])
        
        print(f"   → {kam['name']:20} {d['travel_time']:4} min | Línea recta: {straight_distance:.0f} km | Área ID: {kam['area_id']}")
        
        # Si el tiempo es menor a lo físicamente posible (asumiendo 120 km/h máximo)
        min_possible_time = (straight_distance / 120) * 60  # minutos
        if d['travel_time'] < min_possible_time * 0.8:  # 80% del tiempo mínimo teórico
            print(f"      ⚠️ IMPOSIBLE: Tiempo menor al físicamente posible ({min_possible_time:.0f} min mínimo)")

# 3. Verificar si hay más hospitales con el mismo problema
print("\n🔍 Buscando otros casos similares...")
print("   (Hospitales con todos los tiempos < 10 minutos)")

# Obtener todos los hospitales
all_hospitals = supabase.table('hospitals').select('id, code, name, municipality_name').execute()

suspicious_hospitals = []
for hosp in all_hospitals.data:
    dists = supabase.table('hospital_kam_distances').select('travel_time').eq('hospital_id', hosp['id']).execute()
    if dists.data:
        times = [d['travel_time'] for d in dists.data if d['travel_time']]
        if times and max(times) < 10:
            suspicious_hospitals.append({
                'hospital': hosp,
                'max_time': max(times),
                'min_time': min(times),
                'count': len(times)
            })

if suspicious_hospitals:
    print(f"\n⚠️ Encontrados {len(suspicious_hospitals)} hospitales sospechosos:")
    for s in suspicious_hospitals[:10]:
        print(f"   {s['hospital']['code']:15} | {s['hospital']['name'][:40]:40} | Tiempos: {s['min_time']}-{s['max_time']} min")
else:
    print("   ✅ No se encontraron otros casos similares")

# 4. Analizar el patrón
print("\n📊 ANÁLISIS DEL PROBLEMA:")
print("-"*40)

# Verificar si todos los valores están en un rango sospechoso
all_distances = supabase.table('hospital_kam_distances').select('travel_time').execute()
times = [d['travel_time'] for d in all_distances.data if d['travel_time']]

under_10 = [t for t in times if t < 10]
print(f"Total distancias < 10 min: {len(under_10)} de {len(times)} ({len(under_10)*100/len(times):.1f}%)")

if under_10:
    print(f"Valores: {sorted(set(under_10))}")
    
    # Si hay muchos valores específicos repetidos, podría ser un patrón
    from collections import Counter
    counts = Counter(under_10)
    print(f"\nFrecuencia de valores < 10:")
    for val, count in counts.most_common(10):
        print(f"   {val} min: {count} veces")

print("\n" + "="*60)