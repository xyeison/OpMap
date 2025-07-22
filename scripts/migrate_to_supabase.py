#!/usr/bin/env python3
"""
Script para migrar datos existentes de OpMap a Supabase
Convierte los archivos JSON/PSV actuales al formato SQL de Supabase
"""

import json
import csv
import os
from datetime import datetime

def load_json(filepath):
    """Carga un archivo JSON"""
    # Ajustar ruta si estamos en scripts/
    if os.path.exists(filepath):
        full_path = filepath
    else:
        full_path = os.path.join('..', filepath)
    
    with open(full_path, 'r', encoding='utf-8') as f:
        return json.load(f)

def load_psv(filepath):
    """Carga un archivo PSV (pipe-separated values)"""
    # Ajustar ruta si estamos en scripts/
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
    """Genera los INSERT statements para los hospitales"""
    hospitals = load_psv('data/psv/hospitals.psv')
    inserts = []
    
    for i, hospital in enumerate(hospitals):
        # Limitar a los primeros 100 para el ejemplo
        if i >= 100:
            break
            
        # Limpiar valores
        name = hospital['name_register'].replace("'", "''")  # Escapar comillas simples
        locality_id = f"'{hospital['localityid']}'" if hospital['localityid'] else 'NULL'
        beds = hospital.get('camas', 0) or 0
        
        insert = f"""INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('{hospital['external_id']}', '{name}', '{hospital['departmentid']}', '{hospital['municipalityid']}', {locality_id}, {hospital['lat']}, {hospital['lng']}, {beds});"""
        inserts.append(insert)
    
    return '\n'.join(inserts)

def generate_department_inserts():
    """Genera los INSERT statements para los departamentos"""
    # Lista manual de departamentos de Colombia ya que no tenemos el archivo
    departments = {
        '08': 'Atlántico',
        '11': 'Bogotá D.C.',
        '73': 'Tolima',
        '76': 'Valle del Cauca',
        '50': 'Meta',
        '15': 'Boyacá',
        '25': 'Cundinamarca',
        '41': 'Huila',
        '52': 'Nariño',
        '70': 'Sucre',
        '13': 'Bolívar',
        '66': 'Risaralda',
        '05': 'Antioquia',
        '17': 'Caldas',
        '63': 'Quindío',
        '23': 'Córdoba',
        '20': 'Cesar',
        '47': 'Magdalena',
        '44': 'La Guajira',
        '54': 'Norte de Santander',
        '68': 'Santander',
        '18': 'Caquetá',
        '19': 'Cauca',
        '85': 'Casanare',
        '86': 'Putumayo',
        '27': 'Chocó',
        '88': 'San Andrés y Providencia',
        '91': 'Amazonas',
        '94': 'Guainía',
        '95': 'Guaviare',
        '97': 'Vaupés',
        '99': 'Vichada'
    }
    
    excluded = load_json('data/json/excluded_departments.json')
    inserts = []
    
    for dept_id, dept_name in departments.items():
        is_excluded = int(dept_id) in excluded
        insert = f"""INSERT INTO departments (code, name, excluded) VALUES
('{dept_id}', '{dept_name}', {str(is_excluded).lower()});"""
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
    """Genera los INSERT statements para los municipios"""
    municipalities = load_psv('data/psv/municipalities.psv')
    inserts = []
    
    for i, muni in enumerate(municipalities):
        # Limitar a los primeros 100 para el ejemplo
        if i >= 100:
            break
            
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
    """Genera el archivo SQL completo de migración"""
    
    print("Generando script de migración para Supabase...")
    
    sql_content = f"""-- Script de migración de datos OpMap a Supabase
-- Generado el {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

-- IMPORTANTE: Este script contiene datos de ejemplo.
-- Para la migración completa, use el script Python directamente.

-- Limpiar tablas existentes (opcional)
-- TRUNCATE TABLE assignments CASCADE;
-- TRUNCATE TABLE opportunities CASCADE;
-- TRUNCATE TABLE hospitals CASCADE;
-- TRUNCATE TABLE kams CASCADE;
-- TRUNCATE TABLE department_adjacency CASCADE;
-- TRUNCATE TABLE municipalities CASCADE;
-- TRUNCATE TABLE departments CASCADE;

-- 1. Insertar departamentos
{generate_department_inserts()}

-- 2. Insertar municipios (muestra de 100)
{generate_municipality_inserts()}

-- 3. Insertar matriz de adyacencia
{generate_adjacency_inserts()}

-- 4. Insertar KAMs
{generate_kam_inserts()}

-- 5. Insertar hospitales (muestra de 100)
{generate_hospital_inserts()}

-- Nota: Las asignaciones se deben generar ejecutando el algoritmo OpMap
-- y guardando los resultados en la tabla 'assignments'
"""
    
    # Guardar el archivo SQL
    output_path = '../database/migration_data.sql'
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(sql_content)
    
    print(f"✅ Script de migración generado en: {output_path}")
    print("📝 Nota: Este script incluye solo una muestra de los datos.")
    print("Para migrar todos los datos, modifique los límites en el script Python.")

if __name__ == "__main__":
    main()