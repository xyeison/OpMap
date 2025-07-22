#!/usr/bin/env python3
"""
Script para migrar datos existentes de OpMap a Supabase
Versión SIN departamentos (ya que fueron insertados con fix_departments.sql)
"""

import json
import csv
import os
from datetime import datetime

def load_json(filepath):
    """Carga un archivo JSON"""
    if os.path.exists(filepath):
        full_path = filepath
    else:
        full_path = os.path.join('..', filepath)
    
    with open(full_path, 'r', encoding='utf-8') as f:
        return json.load(f)

def load_psv(filepath):
    """Carga un archivo PSV (pipe-separated values)"""
    if os.path.exists(filepath):
        full_path = filepath
    else:
        full_path = os.path.join('..', filepath)
        
    data = []
    with open(full_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f, delimiter='|')
        for row in reader:
            data.append(row)
    return data

def generate_kam_inserts():
    """Genera los INSERT statements para los KAMs"""
    sellers = load_json('data/json/sellers.json')
    inserts = []
    
    # Colores predefinidos para cada KAM
    kam_colors = {
        'KAM Barranquilla': '#0000FF',
        'KAM Chapinero': '#FFFF00',
        'KAM Ibagué': '#0000FF',
        'KAM Cali': '#008000',
        'KAM Villavicencio': '#800080',
        'KAM Tunja': '#FF00FF',
        'KAM San Cristóbal': '#00FFFF',
        'KAM Soacha Kennedy': '#FFA500',
        'KAM Neiva': '#8B4513',
        'KAM Pasto': '#808080',
        'KAM Sincelejo': '#00FF00',
        'KAM Cartagena': '#FFC0CB',
        'KAM Pereira': '#4B0082',
        'KAM Buenaventura': '#FFD700',
        'KAM Plato': '#8A2BE2',
        'KAM Medellín': '#FF1493'
    }
    
    for seller in sellers:
        color = kam_colors.get(seller['name'], '#000000')
        insert = f"""INSERT INTO kams (name, area_id, lat, lng, enable_level2, max_travel_time, priority, color) VALUES
('{seller['name']}', '{seller['areaId']}', {seller['lat']}, {seller['lng']}, {str(seller['expansionConfig']['enableLevel2']).lower()}, {seller['expansionConfig']['maxTravelTime']}, {seller['expansionConfig']['priority']}, '{color}');"""
        inserts.append(insert)
    
    return '\n'.join(inserts)

def generate_hospital_inserts():
    """Genera los INSERT statements para TODOS los hospitales"""
    hospitals = load_psv('data/psv/hospitals.psv')
    inserts = []
    
    for hospital in hospitals:
        # Limpiar valores
        name = hospital['name_register'].replace("'", "''")  # Escapar comillas simples
        locality_id = f"'{hospital['localityid']}'" if hospital['localityid'] else 'NULL'
        beds = hospital.get('camas', 0) or 0
        
        insert = f"""INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('{hospital['external_id']}', '{name}', '{hospital['departmentid']}', '{hospital['municipalityid']}', {locality_id}, {hospital['lat']}, {hospital['lng']}, {beds});"""
        inserts.append(insert)
    
    return '\n'.join(inserts)

def generate_adjacency_inserts():
    """Genera los INSERT statements para la matriz de adyacencia"""
    adjacency = load_json('data/json/adjacency_matrix.json')
    inserts = []
    
    for dept_code, data in adjacency.items():
        for adjacent in data.get('closeDepartments', []):
            insert = f"""INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('{dept_code}', '{adjacent}');"""
            inserts.append(insert)
    
    return '\n'.join(inserts)

def generate_municipality_inserts():
    """Genera los INSERT statements para TODOS los municipios"""
    municipalities = load_psv('data/psv/municipalities.psv')
    inserts = []
    
    for muni in municipalities:
        name = muni['name'].replace("'", "''")
        dept_code = muni['id'][:2]  # Los primeros 2 dígitos son el departamento
        lat = muni.get('lat', 0) or 0
        lng = muni.get('lng', 0) or 0
        population = muni.get('population2025', 0) or 0
        
        insert = f"""INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('{muni['id']}', '{name}', '{dept_code}', {lat}, {lng}, {population});"""
        inserts.append(insert)
    
    return '\n'.join(inserts)

def main():
    """Genera el archivo SQL completo de migración SIN DEPARTAMENTOS"""
    
    print("Generando script de migración COMPLETO para Supabase (sin departamentos)...")
    
    sql_content = f"""-- Script de migración COMPLETO de datos OpMap a Supabase
-- Versión SIN DEPARTAMENTOS (usar después de fix_departments.sql)
-- Generado el {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

-- IMPORTANTE: Este script asume que ya ejecutaste fix_departments.sql
-- que insertó todos los departamentos.

-- 1. Insertar municipios (TODOS)
{generate_municipality_inserts()}

-- 2. Insertar matriz de adyacencia
{generate_adjacency_inserts()}

-- 3. Insertar KAMs
{generate_kam_inserts()}

-- 4. Insertar hospitales (TODOS)
{generate_hospital_inserts()}

-- Nota: Las asignaciones se deben generar ejecutando el algoritmo OpMap
-- y guardando los resultados en la tabla 'assignments'
"""
    
    # Guardar el archivo SQL
    output_path = '../database/migration_complete_no_departments.sql'
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(sql_content)
    
    # Calcular estadísticas
    num_municipalities = len(load_psv('data/psv/municipalities.psv'))
    num_hospitals = len(load_psv('data/psv/hospitals.psv'))
    num_kams = len(load_json('data/json/sellers.json'))
    
    print(f"✅ Script de migración COMPLETO generado en: {output_path}")
    print(f"📊 Estadísticas de migración:")
    print(f"   - Municipios: {num_municipalities}")
    print(f"   - Hospitales: {num_hospitals}")
    print(f"   - KAMs: {num_kams}")
    print(f"\n⚠️  IMPORTANTE:")
    print("   1. Este script NO incluye departamentos (ya deben estar insertados)")
    print("   2. El archivo es grande (~{:.1f} MB). Considera ejecutarlo por partes.".format(len(sql_content) / 1024 / 1024))
    print("   3. En Supabase, podrías necesitar aumentar el timeout si es muy grande")

if __name__ == "__main__":
    main()