#!/usr/bin/env python3
"""
Script para subir archivos GeoJSON a Cloudflare R2
"""
import os
import boto3
from pathlib import Path
import json
from tqdm import tqdm

# Configuración - ACTUALIZA ESTOS VALORES
R2_ACCESS_KEY_ID = "TU_ACCESS_KEY_ID"
R2_SECRET_ACCESS_KEY = "TU_SECRET_ACCESS_KEY"
R2_ACCOUNT_ID = "TU_ACCOUNT_ID"
BUCKET_NAME = "opmap-geojson"

# Directorio base de GeoJSON
BASE_DIR = "/Users/yeison/Documents/GitHub/OpMap/data/geojson"

def create_r2_client():
    """Crear cliente S3 para R2"""
    return boto3.client(
        's3',
        endpoint_url=f'https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com',
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY,
        region_name='auto'
    )

def upload_geojson_files():
    """Subir todos los archivos GeoJSON a R2"""
    client = create_r2_client()
    
    # Crear bucket si no existe
    try:
        client.create_bucket(Bucket=BUCKET_NAME)
        print(f"✅ Bucket '{BUCKET_NAME}' creado")
    except:
        print(f"ℹ️  Bucket '{BUCKET_NAME}' ya existe")
    
    # Contar archivos
    total_files = sum(1 for _ in Path(BASE_DIR).rglob("*.geojson"))
    print(f"\n📊 Total de archivos a subir: {total_files}")
    
    # Subir archivos con barra de progreso
    uploaded = 0
    failed = 0
    
    with tqdm(total=total_files, desc="Subiendo archivos") as pbar:
        for geojson_path in Path(BASE_DIR).rglob("*.geojson"):
            # Obtener la ruta relativa para R2
            relative_path = geojson_path.relative_to(BASE_DIR)
            s3_key = str(relative_path).replace('\\', '/')  # Windows compatibility
            
            try:
                # Subir archivo
                with open(geojson_path, 'rb') as f:
                    client.put_object(
                        Bucket=BUCKET_NAME,
                        Key=s3_key,
                        Body=f,
                        ContentType='application/geo+json'
                    )
                uploaded += 1
            except Exception as e:
                print(f"\n❌ Error subiendo {s3_key}: {e}")
                failed += 1
            
            pbar.update(1)
    
    print(f"\n✅ Subida completa!")
    print(f"   - Archivos subidos: {uploaded}")
    print(f"   - Archivos fallidos: {failed}")
    
    # Listar archivos por tipo
    print("\n📁 Archivos subidos por tipo:")
    for folder in ['departments', 'localities', 'municipalities']:
        response = client.list_objects_v2(
            Bucket=BUCKET_NAME,
            Prefix=f"{folder}/"
        )
        count = response.get('KeyCount', 0)
        print(f"   - {folder}: {count} archivos")

def create_cors_config():
    """Crear configuración CORS para el bucket"""
    client = create_r2_client()
    
    cors_config = {
        'CORSRules': [{
            'AllowedOrigins': ['*'],  # En producción, especifica tu dominio
            'AllowedMethods': ['GET'],
            'AllowedHeaders': ['*'],
            'MaxAgeSeconds': 3600
        }]
    }
    
    try:
        client.put_bucket_cors(
            Bucket=BUCKET_NAME,
            CORSConfiguration=cors_config
        )
        print("✅ Configuración CORS aplicada")
    except Exception as e:
        print(f"❌ Error configurando CORS: {e}")

if __name__ == "__main__":
    print("🚀 Cloudflare R2 Upload Script")
    print("==============================")
    print()
    print("⚠️  Antes de ejecutar:")
    print("1. Actualiza las credenciales en este script")
    print("2. Obtén las credenciales desde tu dashboard de R2")
    print()
    
    response = input("¿Has actualizado las credenciales? (s/n): ")
    if response.lower() == 's':
        upload_geojson_files()
        create_cors_config()
        
        print("\n📝 Próximos pasos:")
        print("1. Ve a tu dashboard de R2 y obtén la URL pública del bucket")
        print("2. Actualiza el archivo /web/app/api/geojson/[type]/[id]/route.ts")
        print("3. Cambia la URL base a: https://TU-BUCKET.r2.dev/")
    else:
        print("❌ Actualiza las credenciales primero")