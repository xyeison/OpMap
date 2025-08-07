#!/usr/bin/env python3
"""
Verificar por qué estos hospitales no tienen match en travel_time_cache
"""
from supabase import create_client

supabase_url = 'https://norvxqgohddgsdkggqzq.supabase.co'
supabase_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vcnZ4cWdvaGRkZ3Nka2dncXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMDExMjUsImV4cCI6MjA2ODc3NzEyNX0.BRWIYeD_5OlpVKIrP1QzUmkSx6HEVGzcEUUiSK8CmJs'

supabase = create_client(supabase_url, supabase_key)

# Hospital de ejemplo: Gestión Salud-San Fernando en Cartagena
hospital = supabase.table('hospitals').select('*').eq('code', '806015201-2').execute()

if hospital.data:
    h = hospital.data[0]
    print(f"🏥 Hospital: {h['name']}")
    print(f"   Coordenadas: {h['lat']}, {h['lng']}")
    print(f"   Redondeadas: {round(h['lat'], 6)}, {round(h['lng'], 6)}")
    
    # Buscar en travel_time_cache con estas coordenadas
    lat_rounded = round(h['lat'], 6)
    lng_rounded = round(h['lng'], 6)
    
    # Buscar como destino
    cache_as_dest = supabase.table('travel_time_cache').select('*').eq('dest_lat', lat_rounded).eq('dest_lng', lng_rounded).limit(5).execute()
    
    print(f"\n📍 Registros en cache con estas coordenadas como destino: {len(cache_as_dest.data)}")
    
    if not cache_as_dest.data:
        # Buscar con variación de precisión
        print("\n🔍 Buscando con variaciones de precisión...")
        
        # Buscar con 5 decimales
        lat_5 = round(h['lat'], 5)
        lng_5 = round(h['lng'], 5)
        
        cache_5 = supabase.table('travel_time_cache').select('dest_lat, dest_lng').eq('dest_lat', lat_5).eq('dest_lng', lng_5).limit(1).execute()
        if cache_5.data:
            print(f"   ✅ Encontrado con 5 decimales: {lat_5}, {lng_5}")
        
        # Buscar coordenadas cercanas
        print("\n🔍 Buscando coordenadas cercanas en cache...")
        
        # Rango de búsqueda (aproximadamente 100 metros)
        lat_min = lat_rounded - 0.001
        lat_max = lat_rounded + 0.001
        lng_min = lng_rounded - 0.001
        lng_max = lng_rounded + 0.001
        
        nearby = supabase.table('travel_time_cache').select('dest_lat, dest_lng, source').gte('dest_lat', lat_min).lte('dest_lat', lat_max).gte('dest_lng', lng_min).lte('dest_lng', lng_max).limit(10).execute()
        
        if nearby.data:
            print(f"   Encontradas {len(nearby.data)} coordenadas cercanas:")
            for n in nearby.data[:3]:
                print(f"     - {n['dest_lat']}, {n['dest_lng']} ({n['source']})")
                
    # Verificar si el hospital tiene otro código o ID duplicado
    print("\n🔍 Verificando posibles duplicados del hospital...")
    same_name = supabase.table('hospitals').select('id, code, lat, lng, active').ilike('name', f'%San Fernando%').execute()
    
    if len(same_name.data) > 1:
        print(f"   ⚠️ Encontrados {len(same_name.data)} hospitales con nombre similar:")
        for s in same_name.data:
            print(f"     - {s['code']}: ({s['lat']}, {s['lng']}) - Activo: {s['active']}")