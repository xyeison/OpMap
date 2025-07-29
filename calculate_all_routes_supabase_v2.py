#!/usr/bin/env python3
"""
Script simplificado para calcular TODAS las rutas necesarias con Google Maps
y guardarlas en Supabase - sin dependencias del algoritmo Python
"""

import os
import sys
import json
import time
from datetime import datetime
from typing import List, Tuple, Set, Dict

# Agregar el directorio src al path
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

from src.utils.supabase_client import SupabaseClient
from src.utils.google_maps_client import GoogleMapsClient

def load_json(filename):
    """Carga un archivo JSON"""
    with open(filename, 'r', encoding='utf-8') as f:
        return json.load(f)

def load_psv(filename):
    """Carga un archivo PSV y retorna lista de diccionarios"""
    data = []
    with open(filename, 'r', encoding='utf-8') as f:
        headers = f.readline().strip().split('|')
        for line in f:
            values = line.strip().split('|')
            if len(values) == len(headers):
                data.append(dict(zip(headers, values)))
    return data

def get_all_required_routes(sellers, hospitals, adjacency_matrix):
    """
    Obtiene todas las rutas que el algoritmo necesitaría calcular
    """
    required_routes = []
    checked = set()
    
    # Para cada hospital
    for hospital in hospitals:
        # No hay campo active en el PSV, procesar todos
        hospital_dept = hospital['departmentid']
        
        # Para cada KAM
        for seller in sellers:
            seller_dept = seller['areaId'][:2]
            
            # Verificar si el KAM puede competir por este hospital
            # 1. Mismo departamento
            is_same_dept = seller_dept == hospital_dept
            
            # 2. Departamento adyacente (Nivel 1)
            is_adjacent = False
            if seller_dept in adjacency_matrix:
                close_depts = adjacency_matrix[seller_dept].get('closeDepartments', {})
                is_adjacent = hospital_dept in close_depts
            
            # 3. Nivel 2 (si está habilitado)
            is_level2 = False
            if seller['expansionConfig']['enableLevel2'] and seller_dept in adjacency_matrix:
                # Verificar departamentos de nivel 2
                close_depts_l1 = adjacency_matrix[seller_dept].get('closeDepartments', {})
                for adj_dept in close_depts_l1:
                    if adj_dept in adjacency_matrix:
                        close_depts_l2 = adjacency_matrix[adj_dept].get('closeDepartments', {})
                        if hospital_dept in close_depts_l2:
                            is_level2 = True
                            break
            
            # 4. Regla especial: KAMs de Bogotá pueden competir en Cundinamarca
            is_bogota_to_cundi = (seller['areaId'].startswith('11001') and 
                                 hospital_dept in ['25', '11'])
            
            # Si el KAM puede competir, agregar la ruta
            if is_same_dept or is_adjacent or is_level2 or is_bogota_to_cundi:
                route_key = (
                    round(float(seller['lat']), 6),
                    round(float(seller['lng']), 6),
                    round(float(hospital['lat']), 6),
                    round(float(hospital['lng']), 6)
                )
                
                if route_key not in checked:
                    checked.add(route_key)
                    required_routes.append((
                        float(seller['lat']),
                        float(seller['lng']),
                        float(hospital['lat']),
                        float(hospital['lng']),
                        seller['name'],
                        hospital.get('name_register', hospital.get('namegooglemaps', 'Hospital'))
                    ))
    
    return required_routes

def main():
    """Función principal"""
    print("🚀 Calculador de Rutas OpMap con Google Maps (v2)")
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
    
    # Cargar datos locales
    print("\n📦 Cargando datos...")
    try:
        sellers = load_json('data/json/sellers.json')
        hospitals = load_psv('data/psv/hospitals.psv')
        adjacency_matrix = load_json('data/json/adjacency_matrix.json')
        
        print(f"✅ {len(sellers)} KAMs cargados")
        print(f"✅ {len(hospitals)} hospitales cargados")
    except Exception as e:
        print(f"❌ Error al cargar datos: {e}")
        return
    
    # Obtener todas las rutas necesarias
    print("\n🔍 Identificando rutas necesarias...")
    all_routes = get_all_required_routes(sellers, hospitals, adjacency_matrix)
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
    
    # Mostrar algunas rutas de ejemplo
    print("\n📍 Ejemplos de rutas faltantes:")
    for i, route in enumerate(routes_to_calculate[:5]):
        _, _, _, _, kam, hospital = route
        print(f"   {i+1}. {kam} → {hospital}")
    if len(routes_to_calculate) > 5:
        print(f"   ... y {len(routes_to_calculate)-5} más")
    
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
            rate = calculated / elapsed if elapsed > 0 else 0
            remaining = (len(routes_to_calculate) - i) / rate if rate > 0 else 0
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
    if elapsed_total > 0:
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