#!/usr/bin/env python3
"""
Script específico para calcular las rutas de Líbano
"""

import os
import sys
import json
import time

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
    print("🎯 Calculador de rutas específicas para Líbano")
    print("=" * 60)
    
    # Cargar datos
    sellers = load_json('data/json/sellers.json')
    hospitals = load_psv('data/psv/hospitals.psv')
    adjacency_matrix = load_json('data/json/adjacency_matrix.json')
    
    # Buscar hospital de Líbano
    libano_hospitals = [h for h in hospitals if h.get('municipalityid') == '73411']
    if not libano_hospitals:
        print("❌ No se encontró hospital en Líbano")
        return
    
    hospital = libano_hospitals[0]
    print(f"\n🏥 Hospital: {hospital.get('name_register')}")
    print(f"📍 Ubicación: Líbano, Tolima ({hospital['lat']}, {hospital['lng']})")
    
    # Inicializar clientes
    print("\n🔌 Conectando a servicios...")
    supabase = SupabaseClient()
    google_maps = GoogleMapsClient()
    
    # KAMs que pueden competir por Líbano
    relevant_kams = []
    
    for seller in sellers:
        seller_dept = seller['areaId'][:2]
        
        # Verificar si puede competir por Tolima (73)
        # 1. Mismo departamento
        if seller_dept == '73':
            relevant_kams.append((seller, 'Mismo departamento'))
            continue
            
        # 2. Departamento adyacente
        if seller_dept in adjacency_matrix:
            if '73' in adjacency_matrix[seller_dept].get('closeDepartments', {}):
                relevant_kams.append((seller, 'Departamento adyacente'))
                continue
        
        # 3. Nivel 2
        if seller['expansionConfig']['enableLevel2'] and seller_dept in adjacency_matrix:
            for adj_dept in adjacency_matrix[seller_dept].get('closeDepartments', {}):
                if adj_dept in adjacency_matrix:
                    if '73' in adjacency_matrix[adj_dept].get('closeDepartments', {}):
                        relevant_kams.append((seller, 'Nivel 2'))
                        break
        
        # 4. Bogotá → Cundinamarca → Tolima
        if seller['areaId'].startswith('11001'):
            relevant_kams.append((seller, 'Bogotá → Cundinamarca → Tolima'))
    
    print(f"\n📊 KAMs que pueden competir por Líbano: {len(relevant_kams)}")
    
    # Calcular rutas faltantes
    print("\n🚗 Calculando rutas...")
    calculated = 0
    errors = 0
    
    for seller, reason in relevant_kams:
        # Verificar si ya existe en caché
        existing_time = supabase.get_travel_time(
            float(seller['lat']), float(seller['lng']),
            float(hospital['lat']), float(hospital['lng'])
        )
        
        if existing_time is not None:
            print(f"✅ {seller['name']}: {existing_time} min ({existing_time/60:.1f} horas) [En caché] - {reason}")
            continue
        
        # Calcular con Google Maps
        print(f"⏳ Calculando {seller['name']}... ({reason})")
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
                    print(f"✅ {seller['name']}: {travel_time} min ({travel_time/60:.1f} horas) [Calculado]")
                else:
                    errors += 1
                    print(f"❌ Error al guardar en Supabase")
            else:
                errors += 1
                print(f"❌ No se pudo calcular la ruta")
                
        except Exception as e:
            errors += 1
            print(f"❌ Error: {e}")
        
        # Rate limiting
        time.sleep(0.5)
    
    # Resumen
    print(f"\n📊 Resumen:")
    print(f"✅ Rutas calculadas: {calculated}")
    print(f"❌ Errores: {errors}")
    print(f"💰 Costo estimado: ${calculated * 0.005:.2f} USD")
    
    # Mostrar ranking final
    print("\n🏆 Ranking de tiempos a Líbano:")
    times = []
    
    for seller, reason in relevant_kams:
        travel_time = supabase.get_travel_time(
            float(seller['lat']), float(seller['lng']),
            float(hospital['lat']), float(hospital['lng'])
        )
        if travel_time is not None:
            times.append((seller['name'], travel_time, reason))
    
    times.sort(key=lambda x: x[1])
    
    for i, (name, travel_time, reason) in enumerate(times[:10]):
        print(f"{i+1}. {name}: {travel_time} min ({travel_time/60:.1f} horas) - {reason}")

if __name__ == "__main__":
    main()