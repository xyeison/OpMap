#!/usr/bin/env python3
"""
Script para migrar el caché JSON de tiempos de viaje a Supabase
"""

import os
import sys
import json
from datetime import datetime

# Agregar el directorio src al path
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

from src.utils.supabase_client import SupabaseClient

def main():
    """Migra el caché JSON a Supabase"""
    print("🔄 Migración de Caché JSON a Supabase")
    print("=" * 50)
    
    # Verificar variables de entorno
    if not os.getenv('SUPABASE_URL') or os.getenv('SUPABASE_URL') == 'your_supabase_url_here':
        print("❌ Error: Configura SUPABASE_URL y SUPABASE_ANON_KEY en el archivo .env")
        return
    
    # Ruta del archivo de caché JSON
    cache_file = "data/cache/google_distance_matrix_cache.json"
    
    if not os.path.exists(cache_file):
        print(f"❌ No se encontró el archivo de caché: {cache_file}")
        return
    
    # Cargar caché JSON
    print(f"📥 Cargando caché desde: {cache_file}")
    try:
        with open(cache_file, 'r') as f:
            cache_data = json.load(f)
        print(f"✅ {len(cache_data)} entradas encontradas en el caché")
    except Exception as e:
        print(f"❌ Error al cargar caché: {e}")
        return
    
    # Conectar a Supabase
    print("\n🔌 Conectando a Supabase...")
    try:
        supabase = SupabaseClient()
        print("✅ Conexión establecida")
    except Exception as e:
        print(f"❌ Error al conectar con Supabase: {e}")
        return
    
    # Migrar datos
    print("\n📤 Migrando datos a Supabase...")
    migrated = 0
    failed = 0
    skipped = 0
    
    for i, (key, value) in enumerate(cache_data.items()):
        if i % 100 == 0:
            print(f"   Procesando: {i}/{len(cache_data)} ({i/len(cache_data)*100:.1f}%)")
        
        try:
            # Parsear la clave
            coords = key.split(',')
            if len(coords) != 4:
                failed += 1
                continue
            
            origin_lat = float(coords[0])
            origin_lng = float(coords[1])
            dest_lat = float(coords[2])
            dest_lng = float(coords[3])
            travel_time = int(value)
            
            # Verificar si ya existe
            existing = supabase.get_travel_time(origin_lat, origin_lng, dest_lat, dest_lng)
            if existing is not None:
                skipped += 1
                continue
            
            # Guardar en Supabase
            success = supabase.save_travel_time(
                origin_lat, origin_lng,
                dest_lat, dest_lng,
                travel_time,
                source='google_maps'  # Asumimos que todo el caché es de Google Maps
            )
            
            if success:
                migrated += 1
            else:
                failed += 1
                
        except Exception as e:
            failed += 1
            if failed <= 5:  # Solo mostrar los primeros 5 errores
                print(f"   ⚠️ Error en entrada {key}: {e}")
    
    # Mostrar resumen
    print("\n📊 Resumen de Migración:")
    print("=" * 50)
    print(f"✅ Migrados exitosamente: {migrated}")
    print(f"⏭️ Omitidos (ya existían): {skipped}")
    print(f"❌ Fallidos: {failed}")
    print(f"📊 Total procesado: {len(cache_data)}")
    
    # Verificar integridad
    if migrated + skipped > 0:
        print("\n🔍 Verificando integridad...")
        all_times = supabase.get_all_travel_times()
        print(f"✅ Total de rutas en Supabase: {len(all_times)}")
        
        # Filtrar solo Google Maps
        google_routes = [t for t in all_times if t.get('source') == 'google_maps']
        print(f"✅ Rutas de Google Maps: {len(google_routes)}")
    
    print(f"\n✨ Migración completada a las {datetime.now().strftime('%H:%M:%S')}")

if __name__ == "__main__":
    main()