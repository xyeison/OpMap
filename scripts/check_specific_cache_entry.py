#!/usr/bin/env python3
"""
Verificar la entrada específica de travel_time_cache y por qué no se migró
"""
from supabase import create_client

supabase_url = 'https://norvxqgohddgsdkggqzq.supabase.co'
supabase_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vcnZ4cWdvaGRkZ3Nka2dncXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMDExMjUsImV4cCI6MjA2ODc3NzEyNX0.BRWIYeD_5OlpVKIrP1QzUmkSx6HEVGzcEUUiSK8CmJs'

supabase = create_client(supabase_url, supabase_key)

print("🔍 Verificando entrada específica de travel_time_cache")
print("="*60)

# 1. Obtener la entrada específica
cache_id = 'ffb1cc6f-09b7-4181-8ac4-e04e0a272cd8'
cache_entry = supabase.table('travel_time_cache').select('*').eq('id', cache_id).execute()

if not cache_entry.data:
    print(f"❌ No se encontró la entrada con ID: {cache_id}")
    exit()

entry = cache_entry.data[0]
print(f"\n📊 Entrada de caché encontrada:")
print(f"   ID: {entry['id']}")
print(f"   Origen: ({entry['origin_lat']}, {entry['origin_lng']})")
print(f"   Destino: ({entry['dest_lat']}, {entry['dest_lng']})")
print(f"   Tiempo: {entry['travel_time']} minutos")
print(f"   Distancia: {entry.get('distance')} km")
print(f"   Fuente: {entry['source']}")
print(f"   Calculado: {entry.get('calculated_at')}")

# 2. Buscar KAM con esas coordenadas
print(f"\n🔍 Buscando KAM con coordenadas origen...")
kams = supabase.table('kams').select('*').execute()

kam_found = None
for kam in kams.data:
    # Comparar con tolerancia
    if (abs(float(kam['lat']) - float(entry['origin_lat'])) < 0.0001 and 
        abs(float(kam['lng']) - float(entry['origin_lng'])) < 0.0001):
        kam_found = kam
        print(f"✅ KAM encontrado: {kam['name']} (ID: {kam['id']})")
        print(f"   Área: {kam['area_id']}")
        print(f"   Coordenadas KAM: ({kam['lat']}, {kam['lng']})")
        break

if not kam_found:
    print("❌ No se encontró KAM con esas coordenadas origen")
    print("\nKAMs disponibles y sus coordenadas:")
    for kam in kams.data:
        print(f"   {kam['name']}: ({kam['lat']}, {kam['lng']})")

# 3. Buscar Hospital con esas coordenadas destino
print(f"\n🔍 Buscando Hospital con coordenadas destino...")
hospitals = supabase.table('hospitals').select('*').execute()

hospital_found = None
closest_hospitals = []

for hospital in hospitals.data:
    lat_diff = abs(float(hospital['lat']) - float(entry['dest_lat']))
    lng_diff = abs(float(hospital['lng']) - float(entry['dest_lng']))
    distance = (lat_diff**2 + lng_diff**2)**0.5
    
    if lat_diff < 0.0001 and lng_diff < 0.0001:
        hospital_found = hospital
        print(f"✅ Hospital encontrado: {hospital['name']} (ID: {hospital['id']})")
        print(f"   Código: {hospital['code']}")
        print(f"   Municipio: {hospital['municipality_name']}")
        print(f"   Coordenadas Hospital: ({hospital['lat']}, {hospital['lng']})")
        break
    
    # Guardar los más cercanos
    if distance < 0.01:  # Aproximadamente 1km
        closest_hospitals.append((hospital, distance))

if not hospital_found and closest_hospitals:
    print("❌ No se encontró coincidencia exacta, pero hay hospitales cercanos:")
    closest_hospitals.sort(key=lambda x: x[1])
    for h, dist in closest_hospitals[:5]:
        print(f"   {h['name']} - Distancia: {dist:.6f}")
        print(f"      Coordenadas: ({h['lat']}, {h['lng']})")

# 4. Si encontramos ambos, verificar si existe en hospital_kam_distances
if kam_found and hospital_found:
    print(f"\n🔍 Verificando si existe en hospital_kam_distances...")
    existing = supabase.table('hospital_kam_distances').select('*').eq(
        'hospital_id', hospital_found['id']
    ).eq('kam_id', kam_found['id']).execute()
    
    if existing.data:
        print(f"✅ YA EXISTE en hospital_kam_distances:")
        print(f"   ID: {existing.data[0]['id']}")
        print(f"   Tiempo: {existing.data[0]['travel_time']} minutos")
    else:
        print(f"❌ NO existe en hospital_kam_distances")
        print(f"\n💡 Intentando insertar...")
        
        try:
            result = supabase.table('hospital_kam_distances').insert({
                'hospital_id': hospital_found['id'],
                'kam_id': kam_found['id'],
                'travel_time': entry['travel_time'],
                'distance': entry.get('distance'),
                'source': entry['source'],
                'calculated_at': entry.get('calculated_at')
            }).execute()
            
            if result.data:
                print(f"✅ Insertado exitosamente")
        except Exception as e:
            print(f"❌ Error al insertar: {str(e)}")

# 5. Buscar más entradas en travel_time_cache para hospitales de Medellín
if hospital_found and hospital_found['municipality_id'] == '05001':
    print(f"\n🔍 Buscando más entradas en caché para este hospital...")
    
    # Buscar por coordenadas del hospital
    more_entries = []
    for cache in supabase.table('travel_time_cache').select('*').execute().data:
        if (abs(float(cache['dest_lat']) - float(hospital_found['lat'])) < 0.0001 and
            abs(float(cache['dest_lng']) - float(hospital_found['lng'])) < 0.0001):
            more_entries.append(cache)
    
    print(f"   Encontradas {len(more_entries)} entradas para este hospital")
    
    if more_entries:
        print("\n   Detalles de las rutas encontradas:")
        for e in more_entries[:5]:
            # Buscar KAM origen
            kam_name = "Desconocido"
            for kam in kams.data:
                if (abs(float(kam['lat']) - float(e['origin_lat'])) < 0.0001 and
                    abs(float(kam['lng']) - float(e['origin_lng'])) < 0.0001):
                    kam_name = kam['name']
                    break
            print(f"      Desde {kam_name}: {e['travel_time']} minutos")

# 6. Buscar específicamente el Hospital Pablo Tobón Uribe
print(f"\n\n🏥 BUSCANDO HOSPITAL PABLO TOBÓN URIBE...")
pablo_tobon = supabase.table('hospitals').select('*').eq('name', 'Hospital Pablo Tobón Uribe').execute()

if pablo_tobon.data:
    hospital_pt = pablo_tobon.data[0]
    print(f"✅ Encontrado:")
    print(f"   ID: {hospital_pt['id']}")
    print(f"   Código: {hospital_pt['code']}")
    print(f"   Coordenadas: ({hospital_pt['lat']}, {hospital_pt['lng']})")
    print(f"   Municipio: {hospital_pt['municipality_name']}")
    
    # Buscar en travel_time_cache
    print(f"\n🔍 Buscando rutas en travel_time_cache para Pablo Tobón...")
    
    # Cargar todo el caché
    all_cache = supabase.table('travel_time_cache').select('*').execute()
    pablo_routes = []
    
    for cache in all_cache.data:
        lat_diff = abs(float(cache['dest_lat']) - float(hospital_pt['lat']))
        lng_diff = abs(float(cache['dest_lng']) - float(hospital_pt['lng']))
        
        if lat_diff < 0.001 and lng_diff < 0.001:  # Tolerancia más amplia
            pablo_routes.append(cache)
    
    print(f"   Encontradas {len(pablo_routes)} rutas")
    
    if pablo_routes:
        print("\n   Rutas encontradas:")
        for route in pablo_routes:
            # Identificar KAM origen
            kam_name = "Desconocido"
            kam_id = None
            for kam in kams.data:
                if (abs(float(kam['lat']) - float(route['origin_lat'])) < 0.001 and
                    abs(float(kam['lng']) - float(route['origin_lng'])) < 0.001):
                    kam_name = kam['name']
                    kam_id = kam['id']
                    break
            
            print(f"\n   📍 Ruta desde {kam_name}:")
            print(f"      Cache ID: {route['id']}")
            print(f"      Tiempo: {route['travel_time']} minutos")
            print(f"      Origen: ({route['origin_lat']}, {route['origin_lng']})")
            print(f"      Destino: ({route['dest_lat']}, {route['dest_lng']})")
            
            # Verificar si está en hospital_kam_distances
            if kam_id:
                existing = supabase.table('hospital_kam_distances').select('*').eq(
                    'hospital_id', hospital_pt['id']
                ).eq('kam_id', kam_id).execute()
                
                if existing.data:
                    print(f"      ✅ Ya está en hospital_kam_distances")
                else:
                    print(f"      ❌ NO está en hospital_kam_distances")
                    print(f"      💡 Migrando...")
                    try:
                        result = supabase.table('hospital_kam_distances').insert({
                            'hospital_id': hospital_pt['id'],
                            'kam_id': kam_id,
                            'travel_time': route['travel_time'],
                            'distance': route.get('distance'),
                            'source': route['source']
                        }).execute()
                        if result.data:
                            print(f"      ✅ Migrado exitosamente")
                    except Exception as e:
                        print(f"      ❌ Error: {str(e)[:100]}")