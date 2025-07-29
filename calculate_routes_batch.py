#!/usr/bin/env python3
"""
Script optimizado para calcular rutas por lotes
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

def main():
    """Función principal"""
    print("🚀 Calculador de Rutas OpMap - Versión Batch")
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
    
    # Cargar datos
    print("\n📦 Cargando datos...")
    sellers = load_json('data/json/sellers.json')
    hospitals = load_psv('data/psv/hospitals.psv')
    adjacency_matrix = load_json('data/json/adjacency_matrix.json')
    
    print(f"✅ {len(sellers)} KAMs cargados")
    print(f"✅ {len(hospitals)} hospitales cargados")
    
    # Primero, contar cuántas rutas necesitamos evaluar por departamento
    print("\n📊 Analizando rutas necesarias por departamento...")
    
    routes_by_dept = {}
    total_routes_needed = 0
    
    for hospital in hospitals:
        hospital_dept = hospital['departmentid']
        
        if hospital_dept not in routes_by_dept:
            routes_by_dept[hospital_dept] = 0
        
        # Contar KAMs que pueden competir
        kam_count = 0
        for seller in sellers:
            seller_dept = seller['areaId'][:2]
            
            # Verificar si puede competir (simplificado)
            can_compete = False
            
            # Mismo departamento o Bogotá
            if seller_dept == hospital_dept or seller['areaId'].startswith('11001'):
                can_compete = True
            # Adyacente
            elif seller_dept in adjacency_matrix:
                if hospital_dept in adjacency_matrix[seller_dept].get('closeDepartments', {}):
                    can_compete = True
            
            if can_compete:
                kam_count += 1
        
        routes_by_dept[hospital_dept] += kam_count
        total_routes_needed += kam_count
    
    # Mostrar departamentos con más rutas
    sorted_depts = sorted(routes_by_dept.items(), key=lambda x: x[1], reverse=True)
    print("\nDepartamentos con más rutas necesarias:")
    for dept_id, count in sorted_depts[:10]:
        dept_name = next((d['name'] for d in adjacency_matrix.values() if dept_id in str(d)), dept_id)
        print(f"  {dept_id}: {count:,} rutas")
    
    print(f"\n📊 Total estimado de rutas: {total_routes_needed:,}")
    
    # Ahora calcular solo un departamento específico como prueba
    target_dept = input("\n¿Qué departamento quieres calcular? (código o 'all' para todos): ").strip()
    
    if target_dept == 'all':
        target_hospitals = hospitals
        print(f"\n⚠️  Calculando TODOS los departamentos ({len(hospitals)} hospitales)")
    else:
        target_hospitals = [h for h in hospitals if h['departmentid'] == target_dept]
        print(f"\n🎯 Calculando solo departamento {target_dept} ({len(target_hospitals)} hospitales)")
    
    if not target_hospitals:
        print("❌ No se encontraron hospitales")
        return
    
    # Calcular rutas
    calculated = 0
    errors = 0
    skipped = 0
    start_time = time.time()
    
    for i, hospital in enumerate(target_hospitals):
        hospital_dept = hospital['departmentid']
        hospital_name = hospital.get('name_register', hospital.get('namegooglemaps', 'Hospital'))
        
        if i % 10 == 0:
            print(f"\n📍 Hospital {i+1}/{len(target_hospitals)}: {hospital_name[:50]}...")
        
        for seller in sellers:
            seller_dept = seller['areaId'][:2]
            
            # Verificar si puede competir (simplificado)
            can_compete = False
            
            if seller_dept == hospital_dept or seller['areaId'].startswith('11001'):
                can_compete = True
            elif seller_dept in adjacency_matrix:
                if hospital_dept in adjacency_matrix[seller_dept].get('closeDepartments', {}):
                    can_compete = True
            
            if not can_compete:
                continue
            
            # Verificar si ya existe en caché
            existing_time = supabase.get_travel_time(
                float(seller['lat']), float(seller['lng']),
                float(hospital['lat']), float(hospital['lng'])
            )
            
            if existing_time is not None:
                skipped += 1
                continue
            
            # Calcular con Google Maps
            try:
                travel_time = google_maps.get_travel_time(
                    float(seller['lat']), float(seller['lng']),
                    float(hospital['lat']), float(hospital['lng'])
                )
                
                if travel_time is not None:
                    # Guardar en Supabase
                    success = supabase.save_travel_time(
                        float(seller['lat']), float(seller['lng']),
                        float(hospital['lat']), float(hospital['lng']),
                        travel_time,
                        source='google_maps'
                    )
                    
                    if success:
                        calculated += 1
                        if calculated % 50 == 0:
                            elapsed = time.time() - start_time
                            rate = calculated / elapsed if elapsed > 0 else 0
                            print(f"   ✅ {calculated} rutas calculadas ({rate:.1f}/seg)")
                    else:
                        errors += 1
                else:
                    errors += 1
                    
            except Exception as e:
                errors += 1
                if errors <= 5:
                    print(f"   ⚠️ Error: {e}")
            
            # Rate limiting
            time.sleep(0.1)
    
    # Resumen final
    elapsed_total = time.time() - start_time
    print("\n" + "=" * 60)
    print("📊 RESUMEN FINAL")
    print("=" * 60)
    print(f"✅ Rutas calculadas: {calculated:,}")
    print(f"⏭️  Rutas omitidas (ya en caché): {skipped:,}")
    print(f"❌ Errores: {errors:,}")
    print(f"⏱️  Tiempo total: {elapsed_total:.0f} segundos ({elapsed_total/60:.1f} minutos)")
    print(f"💰 Costo estimado: ${calculated * 0.005:.2f} USD")
    if elapsed_total > 0:
        print(f"📈 Velocidad: {calculated/elapsed_total:.1f} rutas/segundo")

if __name__ == "__main__":
    main()