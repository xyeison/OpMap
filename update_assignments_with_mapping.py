#!/usr/bin/env python3
"""
Script para actualizar asignaciones en Supabase desde resultados de OpMap
con mapeo correcto de IDs a códigos
"""

import json
import csv
import sys

def load_hospital_mapping():
    """Carga el mapeo de ID interno a código NIT"""
    mapping = {}
    with open('data/psv/hospitals.psv', 'r', encoding='utf-8') as f:
        reader = csv.reader(f, delimiter='|')
        next(reader)  # Skip header
        for row in reader:
            if len(row) > 1:
                id_internal = row[0]
                code_nit = row[1]
                mapping[id_internal] = code_nit
    return mapping

def generate_assignments_sql(json_file):
    """Genera SQL para actualizar asignaciones desde JSON de OpMap"""
    
    # Cargar mapeo de hospitales
    hospital_mapping = load_hospital_mapping()
    
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
    missing_hospitals = set()
    
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
    
    for kam_id, hospitals in assignments.items():
        kam_name = kam_name_map.get(kam_id, kam_id)
        
        for hospital in hospitals:
            # Solo procesar IPS reales (no población)
            if not hospital.get('is_population_only', False):
                hospital_id_internal = hospital.get('id_register', '')
                
                # Mapear ID interno a código NIT
                hospital_code = hospital_mapping.get(hospital_id_internal)
                
                if not hospital_code:
                    missing_hospitals.add(hospital_id_internal)
                    continue
                
                travel_time = hospital.get('travel_time', 0)
                
                # Si travel_time es 0, es territorio base
                assignment_type = 'base' if travel_time == 0 else 'competitive'
                
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
    
    if missing_hospitals:
        print(f"-- Hospitales no encontrados: {len(missing_hospitals)}")
        print(f"-- IDs: {', '.join(sorted(missing_hospitals))}")
    
    # Estadísticas por KAM
    print()
    print("-- Estadísticas por KAM:")
    for kam_id, hospitals in assignments.items():
        real_hospitals = [h for h in hospitals if not h.get('is_population_only', False)]
        print(f"-- {kam_id}: {len(real_hospitals)} hospitales")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Uso: python update_assignments_with_mapping.py <archivo_json>")
        sys.exit(1)
    
    generate_assignments_sql(sys.argv[1])