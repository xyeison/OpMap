#!/usr/bin/env python3
"""
Script para calcular TODAS las rutas necesarias con Google Maps
y guardarlas en Supabase
"""

import os
import sys
import json
import time
from datetime import datetime
from typing import List, Tuple, Set

# Agregar el directorio src al path
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

from src.utils.supabase_client import SupabaseClient
from src.utils.google_maps_client import GoogleMapsClient
# No necesitamos importar el algoritmo, cargaremos los datos directamente

def get_all_required_routes(algorithm: BogotaOpMapAlgorithm) -> List[Tuple[float, float, float, float, str, str]]:
    """
    Obtiene todas las rutas que el algoritmo necesitaría calcular
    Retorna lista de tuplas (origin_lat, origin_lng, dest_lat, dest_lng, kam_name, hospital_name)
    """
    required_routes = []
    checked = set()
    
    # Para cada hospital
    for hospital in algorithm.hospitals:
        hospital_dept = hospital['department_id']
        
        # Para cada KAM
        for kam in algorithm.sellers:
            kam_dept = kam['areaId'][:2]
            
            # Verificar si el KAM puede competir por este hospital
            # 1. Mismo departamento
            is_same_dept = kam_dept == hospital_dept
            
            # 2. Departamento adyacente (Nivel 1)
            is_adjacent = False
            if kam_dept in algorithm.adjacency_matrix:
                is_adjacent = hospital_dept in algorithm.adjacency_matrix[kam_dept]['closeDepartments']
            
            # 3. Nivel 2 (si está habilitado)
            is_level2 = False
            if kam['expansionConfig']['enableLevel2'] and kam_dept in algorithm.adjacency_matrix:
                # Verificar departamentos de nivel 2
                for adj_dept in algorithm.adjacency_matrix[kam_dept]['closeDepartments']:
                    if adj_dept in algorithm.adjacency_matrix:
                        if hospital_dept in algorithm.adjacency_matrix[adj_dept]['closeDepartments']:
                            is_level2 = True
                            break
            
            # 4. Regla especial: KAMs de Bogotá pueden competir en Cundinamarca
            is_bogota_to_cundi = (kam['areaId'].startswith('11001') and 
                                 hospital_dept in ['25', '11'])  # Cundinamarca o Bogotá
            
            # Si el KAM puede competir, agregar la ruta
            if is_same_dept or is_adjacent or is_level2 or is_bogota_to_cundi:
                route_key = (
                    round(kam['lat'], 6),
                    round(kam['lng'], 6),
                    round(hospital['lat'], 6),
                    round(hospital['lng'], 6)
                )
                
                if route_key not in checked:
                    checked.add(route_key)
                    required_routes.append((
                        kam['lat'],
                        kam['lng'],
                        hospital['lat'],
                        hospital['lng'],
                        kam['name'],
                        hospital['name']
                    ))
    
    return required_routes

def main():
    """Función principal"""
    print("🚀 Calculador de Rutas OpMap con Google Maps")
    print("=" * 60)
    print(f"📅 Fecha: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Inicializar clientes
    print("\n🔌 Conectando a servicios...")
    try:
        supabase = SupabaseClient()
        google_maps = GoogleMapsClient()
        print("✅ Conexión establecida")
    except Exception as e:
        print(f"❌ Error al conectar: {e}")
        return
    
    # Inicializar algoritmo para obtener datos
    print("\n📦 Cargando datos del algoritmo...")
    algorithm = BogotaOpMapAlgorithm()
    algorithm.load_data()
    
    print(f"✅ {len(algorithm.sellers)} KAMs cargados")
    print(f"✅ {len(algorithm.hospitals)} hospitales cargados")
    
    # Obtener todas las rutas necesarias
    print("\n🔍 Identificando rutas necesarias...")
    all_routes = get_all_required_routes(algorithm)
    print(f"📊 Total de rutas posibles: {len(all_routes):,}")
    
    # Verificar cuáles ya están en caché
    print("\n💾 Verificando caché existente...")
    routes_to_calculate = []
    
    for route in all_routes:
        origin_lat, origin_lng, dest_lat, dest_lng, kam_name, hospital_name = route
        
        # Verificar si ya existe en caché
        existing_time = supabase.get_travel_time(
            origin_lat, origin_lng, dest_lat, dest_lng
        )
        
        if existing_time is None:
            routes_to_calculate.append(route)
    
    cached_count = len(all_routes) - len(routes_to_calculate)
    print(f"✅ Rutas en caché: {cached_count:,}")
    print(f"❌ Rutas faltantes: {len(routes_to_calculate):,}")
    
    if len(routes_to_calculate) == 0:
        print("\n✨ ¡Todas las rutas ya están en caché!")
        return
    
    # Calcular costo estimado
    estimated_cost = len(routes_to_calculate) * 0.005
    estimated_time = len(routes_to_calculate) / 10  # ~10 llamadas por segundo
    
    print(f"\n💰 Costo estimado: ${estimated_cost:.2f} USD")
    print(f"⏱️  Tiempo estimado: {estimated_time:.0f} segundos ({estimated_time/60:.1f} minutos)")
    
    # Confirmar
    response = input("\n¿Deseas continuar? (s/n): ")
    if response.lower() != 's':
        print("❌ Cancelado por el usuario")
        return
    
    # Calcular rutas faltantes
    print(f"\n🚗 Calculando {len(routes_to_calculate):,} rutas con Google Maps...")
    calculated = 0
    errors = 0
    start_time = time.time()
    
    for i, route in enumerate(routes_to_calculate):
        origin_lat, origin_lng, dest_lat, dest_lng, kam_name, hospital_name = route
        
        if i % 100 == 0 and i > 0:
            elapsed = time.time() - start_time
            rate = calculated / elapsed
            remaining = (len(routes_to_calculate) - i) / rate
            print(f"   Progreso: {i}/{len(routes_to_calculate)} ({i/len(routes_to_calculate)*100:.1f}%) - "
                  f"Tiempo restante: {remaining/60:.1f} min")
        
        try:
            # Calcular con Google Maps
            travel_time = google_maps.get_travel_time(
                origin_lat, origin_lng, dest_lat, dest_lng
            )
            
            if travel_time is not None:
                # Guardar en Supabase
                success = supabase.save_travel_time(
                    origin_lat, origin_lng,
                    dest_lat, dest_lng,
                    travel_time,
                    source='google_maps'
                )
                
                if success:
                    calculated += 1
                else:
                    errors += 1
            else:
                errors += 1
                
        except Exception as e:
            errors += 1
            if errors <= 5:
                print(f"   ⚠️ Error en {kam_name} → {hospital_name}: {e}")
        
        # Rate limiting
        time.sleep(0.1)  # 100ms entre llamadas
    
    # Resumen final
    elapsed_total = time.time() - start_time
    print("\n" + "=" * 60)
    print("📊 RESUMEN FINAL")
    print("=" * 60)
    print(f"✅ Rutas calculadas exitosamente: {calculated:,}")
    print(f"❌ Errores: {errors:,}")
    print(f"⏱️  Tiempo total: {elapsed_total:.0f} segundos ({elapsed_total/60:.1f} minutos)")
    print(f"💰 Costo real estimado: ${calculated * 0.005:.2f} USD")
    print(f"📈 Velocidad promedio: {calculated/elapsed_total:.1f} rutas/segundo")
    
    # Verificar nuevo total en caché
    print("\n🔍 Verificando caché actualizado...")
    all_cache = supabase.get_all_travel_times()
    google_cache = [t for t in all_cache if t.get('source') == 'google_maps']
    print(f"✅ Total de rutas en caché: {len(google_cache):,}")
    
    print("\n✨ ¡Proceso completado!")
    print("Ahora puedes ejecutar el algoritmo con datos completos.")

if __name__ == "__main__":
    main()