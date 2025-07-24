#!/usr/bin/env python3
"""
Script para actualizar asignaciones en Supabase desde resultados de OpMap
"""

import json
import sys

def generate_assignments_sql(json_file):
    """Genera SQL para actualizar asignaciones desde JSON de OpMap"""
    
    # Cargar resultados
    with open(json_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    assignments = data['assignments']
    
    print("-- Limpiar asignaciones existentes")
    print("DELETE FROM assignments;")
    print()
    
    print("-- Insertar nuevas asignaciones")
    print("INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type)")
    print("VALUES")
    
    values = []
    total_assignments = 0
    
    for kam_id, hospitals in assignments.items():
        for hospital in hospitals:
            # Solo procesar IPS reales (no población)
            if not hospital.get('is_population_only', False):
                hospital_code = hospital.get('id_register', '')
                travel_time = hospital.get('travel_time', 0)
                
                # Si travel_time es 0, es territorio base
                assignment_type = 'base' if travel_time == 0 else 'competitive'
                
                # Mapear kam_id del JSON al nombre en la BD
                kam_name_map = {
                    'barranquilla': 'KAM Barranquilla',
                    'bucaramanga': 'KAM Bucaramanga',
                    'cali': 'KAM Cali',
                    'cartagena': 'KAM Cartagena',
                    'cucuta': 'KAM Cúcuta',
                    'medellin': 'KAM Medellín',
                    'monteria': 'KAM Montería',
                    'neiva': 'KAM Neiva',
                    'pasto': 'KAM Pasto',
                    'pereira': 'KAM Pereira',
                    'sincelejo': 'KAM Sincelejo',
                    'chapinero': 'KAM Chapinero',
                    'engativa': 'KAM Engativá',
                    'sancristobal': 'KAM San Cristóbal',
                    'kennedy': 'KAM Kennedy',
                    'valledupar': 'KAM Valledupar'
                }
                
                kam_name = kam_name_map.get(kam_id, kam_id)
                
                # Generar query
                value = f"""  ((SELECT id FROM kams WHERE name = '{kam_name}'),
   (SELECT id FROM hospitals WHERE code = '{hospital_code}'),
   {travel_time if travel_time else 'NULL'},
   '{assignment_type}')"""
                
                values.append(value)
                total_assignments += 1
    
    print(',\n'.join(values))
    print(";")
    print()
    print(f"-- Total asignaciones: {total_assignments}")
    
    # Estadísticas por KAM
    print()
    print("-- Estadísticas por KAM:")
    for kam_id, hospitals in assignments.items():
        real_hospitals = [h for h in hospitals if not h.get('is_population_only', False)]
        print(f"-- {kam_id}: {len(real_hospitals)} hospitales")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Uso: python update_assignments_from_opmap.py <archivo_json>")
        sys.exit(1)
    
    generate_assignments_sql(sys.argv[1])