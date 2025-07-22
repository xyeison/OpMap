#!/usr/bin/env python3
"""
Combina archivos GeoJSON de departamentos en un solo archivo
"""

import json
import os
from glob import glob

def combine_department_geojsons():
    """Combina todos los GeoJSON de departamentos en uno solo"""
    
    # Buscar archivos de departamentos
    dept_files = glob('../data/geojson_old2/departments/*.geojson')
    
    if not dept_files:
        print("❌ No se encontraron archivos GeoJSON de departamentos")
        return
    
    print(f"📁 Encontrados {len(dept_files)} archivos de departamentos")
    
    # Estructura del GeoJSON combinado
    combined = {
        "type": "FeatureCollection",
        "features": []
    }
    
    # Leer cada archivo y agregar sus features
    for file_path in sorted(dept_files):
        dept_code = os.path.basename(file_path).replace('.geojson', '')
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                
            # Si es una Feature individual, convertir a FeatureCollection
            if data.get('type') == 'Feature':
                features = [data]
            elif data.get('type') == 'FeatureCollection':
                features = data.get('features', [])
            else:
                print(f"⚠️  Formato no reconocido en {file_path}")
                continue
                
            # Agregar código de departamento a las propiedades
            for feature in features:
                if 'properties' not in feature:
                    feature['properties'] = {}
                feature['properties']['DPTO_CCDGO'] = dept_code
                
            combined['features'].extend(features)
            print(f"✓ Procesado departamento {dept_code}")
            
        except Exception as e:
            print(f"❌ Error procesando {file_path}: {e}")
    
    # Guardar archivo combinado
    output_path = '../web/public/colombia_departments.geojson'
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(combined, f, ensure_ascii=False, indent=2)
    
    print(f"\n✅ Archivo combinado guardado en: {output_path}")
    print(f"📊 Total de features: {len(combined['features'])}")
    
    # También crear una versión minimizada
    mini_output = '../web/public/colombia_departments.min.geojson'
    with open(mini_output, 'w', encoding='utf-8') as f:
        json.dump(combined, f, ensure_ascii=False, separators=(',', ':'))
    
    print(f"✅ Versión minimizada en: {mini_output}")

if __name__ == "__main__":
    combine_department_geojsons()