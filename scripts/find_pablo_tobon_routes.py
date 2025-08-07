#!/usr/bin/env python3
"""
Buscar todas las rutas hacia Hospital Pablo Tobón Uribe en travel_time_cache
"""
from supabase import create_client

supabase_url = 'https://norvxqgohddgsdkggqzq.supabase.co'
supabase_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vcnZ4cWdvaGRkZ3Nka2dncXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMDExMjUsImV4cCI6MjA2ODc3NzEyNX0.BRWIYeD_5OlpVKIrP1QzUmkSx6HEVGzcEUUiSK8CmJs'

supabase = create_client(supabase_url, supabase_key)

print("🏥 Buscando rutas hacia Hospital Pablo Tobón Uribe")
print("="*60)

# 1. Obtener el hospital
pablo = supabase.table('hospitals').select('*').eq('name', 'Hospital Pablo Tobón Uribe').execute()
if not pablo.data:
    print("❌ No se encontró el hospital")
    exit()

hospital = pablo.data[0]
print(f"\n✅ Hospital encontrado:")
print(f"   Nombre: {hospital['name']}")
print(f"   ID: {hospital['id']}")
print(f"   Código: {hospital['code']}")
print(f"   Coordenadas: ({hospital['lat']}, {hospital['lng']})")
print(f"   Municipio: {hospital['municipality_name']}")

# 2. Buscar en travel_time_cache con diferentes tolerancias
print(f"\n🔍 Buscando en travel_time_cache...")

# Método 1: Búsqueda exacta
exact_matches = supabase.table('travel_time_cache').select('*').eq('dest_lat', hospital['lat']).eq('dest_lng', hospital['lng']).execute()
print(f"\n   Coincidencias exactas: {len(exact_matches.data)}")

# Método 2: Con rango (tolerancia)
range_matches = supabase.table('travel_time_cache').select('*').gte('dest_lat', float(hospital['lat']) - 0.001).lte('dest_lat', float(hospital['lat']) + 0.001).gte('dest_lng', float(hospital['lng']) - 0.001).lte('dest_lng', float(hospital['lng']) + 0.001).execute()
print(f"   Con tolerancia 0.001: {len(range_matches.data)}")

# Obtener todos los KAMs para identificar orígenes
kams = supabase.table('kams').select('*').execute()
kams_dict = {}
for kam in kams.data:
    key = f"{float(kam['lat']):.4f},{float(kam['lng']):.4f}"
    kams_dict[key] = kam

# Analizar las rutas encontradas
if range_matches.data:
    print(f"\n📊 Detalles de rutas encontradas:")
    for route in range_matches.data:
        print(f"\n   Cache ID: {route['id']}")
        print(f"   Destino: ({route['dest_lat']}, {route['dest_lng']})")
        print(f"   Origen: ({route['origin_lat']}, {route['origin_lng']})")
        print(f"   Tiempo: {route['travel_time']} minutos")
        print(f"   Fuente: {route['source']}")
        
        # Identificar KAM origen
        origin_key = f"{float(route['origin_lat']):.4f},{float(route['origin_lng']):.4f}"
        if origin_key in kams_dict:
            kam = kams_dict[origin_key]
            print(f"   ✅ KAM identificado: {kam['name']}")
        else:
            print(f"   ❓ KAM no identificado")

# 3. Verificar en hospital_kam_distances
print(f"\n🔍 Verificando en hospital_kam_distances...")
distances = supabase.table('hospital_kam_distances').select('*').eq('hospital_id', hospital['id']).execute()
print(f"   Distancias existentes: {len(distances.data)}")

if distances.data:
    print("\n   KAMs con distancia calculada:")
    for dist in distances.data:
        # Buscar nombre del KAM
        kam_info = supabase.table('kams').select('name').eq('id', dist['kam_id']).execute()
        kam_name = kam_info.data[0]['name'] if kam_info.data else "Desconocido"
        print(f"      - {kam_name}: {dist['travel_time']} minutos")

# 4. Migrar rutas encontradas si no están en hospital_kam_distances
if range_matches.data:
    print(f"\n💾 Intentando migrar rutas encontradas...")
    migrated = 0
    
    for route in range_matches.data:
        # Identificar KAM
        kam_found = None
        for kam in kams.data:
            if (abs(float(kam['lat']) - float(route['origin_lat'])) < 0.001 and
                abs(float(kam['lng']) - float(route['origin_lng'])) < 0.001):
                kam_found = kam
                break
        
        if kam_found:
            # Verificar si ya existe
            existing = supabase.table('hospital_kam_distances').select('id').eq(
                'hospital_id', hospital['id']
            ).eq('kam_id', kam_found['id']).execute()
            
            if not existing.data:
                try:
                    result = supabase.table('hospital_kam_distances').insert({
                        'hospital_id': hospital['id'],
                        'kam_id': kam_found['id'],
                        'travel_time': route['travel_time'],
                        'distance': route.get('distance'),
                        'source': route['source']
                    }).execute()
                    if result.data:
                        print(f"   ✅ Migrada ruta desde {kam_found['name']}")
                        migrated += 1
                except Exception as e:
                    print(f"   ❌ Error migrando desde {kam_found['name']}: {str(e)[:50]}")
    
    print(f"\n   Total migradas: {migrated}")

print("\n" + "="*60)