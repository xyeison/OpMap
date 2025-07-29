#!/usr/bin/env python3
"""
Script de prueba para verificar el cálculo de rutas
"""

import os
import sys
import json

# Agregar el directorio src al path
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

from src.utils.supabase_client import SupabaseClient

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
    print("🔍 Verificando datos y caché...")
    
    # Cargar datos
    sellers = load_json('data/json/sellers.json')
    hospitals = load_psv('data/psv/hospitals.psv')
    
    print(f"✅ {len(sellers)} KAMs cargados")
    print(f"✅ {len(hospitals)} hospitales cargados")
    
    # Buscar específicamente Líbano
    libano_hospitals = [h for h in hospitals if h.get('municipalityid') == '73411']
    print(f"\n🏥 Hospitales en Líbano (73411): {len(libano_hospitals)}")
    
    if libano_hospitals:
        hospital = libano_hospitals[0]
        print(f"   - {hospital.get('name_register', hospital.get('namegooglemaps'))}")
        print(f"   - Coordenadas: {hospital['lat']}, {hospital['lng']}")
        
        # Conectar a Supabase
        print("\n💾 Verificando caché en Supabase...")
        try:
            supabase = SupabaseClient()
            
            # Verificar tiempos desde diferentes KAMs
            kams_to_check = [
                ('KAM Pereira', '66001'),
                ('KAM Neiva', '41001'),
                ('KAM Engativá', '1100110'),
                ('KAM Kennedy', '1100108')
            ]
            
            for kam_name, area_id in kams_to_check:
                # Buscar el KAM
                kam = next((s for s in sellers if s['areaId'] == area_id), None)
                if kam:
                    # Verificar si existe en caché
                    travel_time = supabase.get_travel_time(
                        float(kam['lat']), float(kam['lng']),
                        float(hospital['lat']), float(hospital['lng'])
                    )
                    
                    if travel_time is not None:
                        print(f"   ✅ {kam_name} → Líbano: {travel_time} min ({travel_time/60:.1f} horas)")
                    else:
                        print(f"   ❌ {kam_name} → Líbano: No en caché")
            
            # Contar total en caché
            print("\n📊 Estadísticas del caché:")
            all_times = supabase.get_all_travel_times()
            print(f"   Total rutas en caché: {len(all_times):,}")
            
        except Exception as e:
            print(f"❌ Error: {e}")

if __name__ == "__main__":
    main()