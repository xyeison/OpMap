#!/usr/bin/env python3
"""
Convierte las asignaciones de JSON a SQL para Supabase
"""

import json
from datetime import datetime

def convert_assignments_to_sql(json_path):
    """Convierte el archivo JSON de asignaciones a SQL"""
    
    # Cargar el archivo JSON
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    assignments = data.get('assignments', {})
    metadata = data.get('metadata', {})
    
    # Generar SQL
    inserts = []
    total_assignments = 0
    
    for kam_id, hospitals in assignments.items():
        for hospital in hospitals:
            total_assignments += 1
            
            # Obtener el external_id del hospital
            hospital_code = hospital.get('external_id', hospital.get('nit', ''))
            
            # Usar el id del KAM del archivo JSON
            kam_ref = kam_id
            
            # Obtener el tiempo de viaje si existe
            travel_time = hospital.get('travel_time', 'NULL')
            if travel_time != 'NULL':
                travel_time = f"'{travel_time}'"
            
            # Tipo de asignación
            assignment_type = 'automatic'
            if hospital.get('municipalityid', '').endswith(hospital.get('area_id', 'XXX')):
                assignment_type = 'territory_base'
            
            insert = f"""INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type) 
SELECT k.id, h.id, {travel_time}, '{assignment_type}'
FROM kams k, hospitals h
WHERE k.name = (SELECT name FROM kams WHERE LOWER(REPLACE(name, ' ', '_')) LIKE '%{kam_id}%' LIMIT 1)
  AND h.code = '{hospital_code}'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );"""
            
            inserts.append(insert)
    
    # Generar el archivo SQL
    sql_content = f"""-- Script de asignaciones de hospitales a KAMs
-- Generado el {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
-- Fuente: {json_path}
-- Algoritmo: {metadata.get('algorithm', 'OpMap')}
-- Total IPS: {metadata.get('total_ips', 'N/A')}
-- Total KAMs: {metadata.get('total_kams', 'N/A')}

-- Limpiar asignaciones existentes (opcional)
-- TRUNCATE TABLE assignments CASCADE;

-- Insertar asignaciones
{chr(10).join(inserts)}

-- Verificar resultados
-- SELECT COUNT(*) as total_assignments FROM assignments;
-- SELECT k.name, COUNT(a.id) as hospitals_count 
-- FROM kams k 
-- LEFT JOIN assignments a ON k.id = a.kam_id 
-- GROUP BY k.name 
-- ORDER BY hospitals_count DESC;

-- Total de asignaciones esperadas: {total_assignments}
"""
    
    return sql_content, total_assignments

def main():
    # Usar el archivo más reciente con Google Maps
    json_path = '../output/opmap_google_cached_20250722_083814.json'
    
    print(f"📖 Leyendo asignaciones desde: {json_path}")
    
    sql_content, total = convert_assignments_to_sql(json_path)
    
    # Guardar el SQL
    output_path = '../database/assignments_from_json.sql'
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(sql_content)
    
    print(f"✅ Script SQL generado: {output_path}")
    print(f"📊 Total de asignaciones: {total}")
    print("\n🚀 Próximo paso: Ejecutar este script en Supabase SQL Editor")

if __name__ == "__main__":
    main()