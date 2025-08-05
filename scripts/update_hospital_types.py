#!/usr/bin/env python3
"""
Script para actualizar los tipos de hospitales desde un archivo CSV
"""

import os
import csv
from dotenv import load_dotenv
from supabase import create_client, Client

# Cargar variables de entorno
load_dotenv()

# Configuración de Supabase
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_ANON_KEY')  # Usar el nombre correcto de la variable

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: SUPABASE_URL y SUPABASE_ANON_KEY deben estar configuradas en el archivo .env")
    exit(1)

# Crear cliente de Supabase
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def read_csv_file(file_path):
    """Lee el archivo CSV y retorna una lista de tuplas (id, type)"""
    hospital_types = []
    
    with open(file_path, 'r', encoding='utf-8') as file:
        csv_reader = csv.DictReader(file, delimiter=';')
        for row in csv_reader:
            hospital_types.append((row['id'], row['type']))
    
    return hospital_types

def update_hospital_types(hospital_types):
    """Actualiza los tipos de hospitales en la base de datos"""
    total = len(hospital_types)
    updated = 0
    errors = 0
    
    print(f"Total de hospitales a actualizar: {total}")
    print("Iniciando actualización...\n")
    
    # Agrupar por tipo para hacer updates más eficientes
    types_dict = {}
    for hospital_id, hospital_type in hospital_types:
        if hospital_type not in types_dict:
            types_dict[hospital_type] = []
        types_dict[hospital_type].append(hospital_id)
    
    # Actualizar por lotes según el tipo
    for hospital_type, ids in types_dict.items():
        print(f"\nActualizando hospitales tipo '{hospital_type}': {len(ids)} registros")
        
        # Dividir en lotes de 100 para evitar problemas con queries muy largas
        batch_size = 100
        for i in range(0, len(ids), batch_size):
            batch_ids = ids[i:i + batch_size]
            
            try:
                # Actualizar el lote
                supabase.table('hospitals').update({
                    'type': hospital_type
                }).in_('id', batch_ids).execute()
                
                updated += len(batch_ids)
                print(f"  Lote {i//batch_size + 1}: {len(batch_ids)} hospitales actualizados")
                
            except Exception as e:
                print(f"  Error en lote {i//batch_size + 1}: {e}")
                errors += len(batch_ids)
    
    print(f"\n{'='*50}")
    print(f"Resumen de actualización:")
    print(f"  - Total procesados: {total}")
    print(f"  - Actualizados exitosamente: {updated}")
    print(f"  - Errores: {errors}")
    print(f"{'='*50}")
    
    # Verificar resultado final
    verify_update()

def verify_update():
    """Verifica el estado de la actualización"""
    print("\nVerificando actualización...")
    
    try:
        # Contar por tipo
        response = supabase.table('hospitals').select('type').execute()
        
        if response.data:
            type_counts = {}
            null_count = 0
            
            for hospital in response.data:
                if hospital['type']:
                    type_counts[hospital['type']] = type_counts.get(hospital['type'], 0) + 1
                else:
                    null_count += 1
            
            print("\nDistribución de tipos en la base de datos:")
            for hospital_type, count in sorted(type_counts.items()):
                print(f"  - {hospital_type}: {count}")
            
            if null_count > 0:
                print(f"  - Sin tipo asignado: {null_count}")
            
    except Exception as e:
        print(f"Error al verificar: {e}")

def main():
    """Función principal"""
    csv_file = '/Users/yeison/Downloads/type.csv'
    
    if not os.path.exists(csv_file):
        print(f"Error: No se encuentra el archivo {csv_file}")
        return
    
    print("Leyendo archivo CSV...")
    hospital_types = read_csv_file(csv_file)
    
    # Mostrar resumen del CSV
    type_summary = {}
    for _, hospital_type in hospital_types:
        type_summary[hospital_type] = type_summary.get(hospital_type, 0) + 1
    
    print(f"\nResumen del archivo CSV:")
    for hospital_type, count in sorted(type_summary.items()):
        print(f"  - {hospital_type}: {count}")
    
    # Confirmar antes de proceder
    response = input("\n¿Desea proceder con la actualización? (s/n): ")
    if response.lower() != 's':
        print("Actualización cancelada.")
        return
    
    # Ejecutar actualización
    update_hospital_types(hospital_types)

if __name__ == "__main__":
    main()