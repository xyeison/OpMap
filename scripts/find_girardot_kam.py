#!/usr/bin/env python3
"""
Encontrar qué KAM tiene realmente asignado Girardot
"""

import os
from dotenv import load_dotenv
from supabase import create_client

# Cargar variables de entorno
load_dotenv()

# Configurar Supabase
url = os.getenv('SUPABASE_URL')
key = os.getenv('SUPABASE_ANON_KEY')
supabase = create_client(url, key)

print("🔍 BUSCANDO KAM ASIGNADO A GIRARDOT\n")

# 1. Buscar hospitales en Girardot
print("1. Hospitales en Girardot:")
hospitals = supabase.from_('hospitals').select('id, name').eq('municipality_id', '25307').eq('active', True).execute()
if hospitals.data:
    print(f"   Encontrados {len(hospitals.data)} hospitales")
    hospital_ids = [h['id'] for h in hospitals.data]
    
    # 2. Buscar asignaciones
    print("\n2. Asignaciones actuales:")
    assignments = supabase.from_('assignments').select('*, kams(*)').in_('hospital_id', hospital_ids).execute()
    
    if assignments.data:
        kam_counts = {}
        for a in assignments.data:
            kam_name = a['kams']['name']
            kam_area = a['kams']['area_id']
            key = f"{kam_name} ({kam_area})"
            kam_counts[key] = kam_counts.get(key, 0) + 1
        
        print("   KAMs asignados:")
        for kam, count in kam_counts.items():
            print(f"   - {kam}: {count} hospitales")
            
        # Información detallada del KAM principal
        if assignments.data:
            main_kam = assignments.data[0]['kams']
            print(f"\n3. Detalles del KAM asignado:")
            print(f"   - Nombre: {main_kam['name']}")
            print(f"   - ID: {main_kam['id']}")
            print(f"   - Área: {main_kam['area_id']}")
            print(f"   - Coordenadas: {main_kam['lat']}, {main_kam['lng']}")
    else:
        print("   ❌ No hay asignaciones")
        
# 3. Buscar todos los KAMs que podrían competir
print("\n4. KAMs que pueden competir por Girardot:")
kams = supabase.from_('kams').select('name, area_id').eq('active', True).execute()
if kams.data:
    for kam in kams.data:
        dept = kam['area_id'][:2]
        # Puede competir si está en: Cundinamarca (25), Bogotá (11), o departamentos limítrofes
        if dept in ['25', '11', '05', '15', '17', '41', '50', '73', '85']:
            print(f"   - {kam['name']} ({kam['area_id']}) - Depto: {dept}")