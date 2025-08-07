#!/usr/bin/env python3
"""
Importar datos limpios desde CSV a hospital_kam_distances
Convierte segundos a minutos y reemplaza todos los datos existentes
"""
import csv
from supabase import create_client
from datetime import datetime
import json

supabase_url = 'https://norvxqgohddgsdkggqzq.supabase.co'
supabase_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vcnZ4cWdvaGRkZ3Nka2dncXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMDExMjUsImV4cCI6MjA2ODc3NzEyNX0.BRWIYeD_5OlpVKIrP1QzUmkSx6HEVGzcEUUiSK8CmJs'

supabase = create_client(supabase_url, supabase_key)

print("🔄 IMPORTACIÓN DE DATOS LIMPIOS A hospital_kam_distances")
print("="*60)

# 1. HACER BACKUP DE DATOS ACTUALES
print("\n📦 PASO 1: Creando backup de datos actuales...")
print("-"*40)

existing_data = []
offset = 0
while True:
    batch = supabase.table('hospital_kam_distances').select('*').range(offset, offset + 999).execute()
    if not batch.data:
        break
    existing_data.extend(batch.data)
    offset += 1000
    print(f"   Descargados: {len(existing_data)} registros...")
    if len(batch.data) < 1000:
        break

# Guardar backup
timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
backup_file = f"/Users/yeison/Documents/GitHub/OpMap/backups/hospital_kam_distances_backup_{timestamp}.json"

import os
os.makedirs("/Users/yeison/Documents/GitHub/OpMap/backups", exist_ok=True)

with open(backup_file, 'w') as f:
    json.dump({
        'timestamp': timestamp,
        'total_records': len(existing_data),
        'data': existing_data
    }, f, indent=2)

print(f"\n✅ Backup guardado:")
print(f"   Archivo: {backup_file}")
print(f"   Total registros respaldados: {len(existing_data)}")

# 2. LEER ARCHIVO CSV
print("\n📥 PASO 2: Leyendo archivo CSV...")
print("-"*40)

csv_file = '/Users/yeison/Downloads/distanciaKAMHospital.csv'
new_records = []

try:
    with open(csv_file, 'r', encoding='utf-8') as f:
        # Detectar delimitador
        first_line = f.readline()
        f.seek(0)
        
        if ';' in first_line:
            delimiter = ';'
        else:
            delimiter = ','
        
        reader = csv.DictReader(f, delimiter=delimiter)
        
        for row in reader:
            # Convertir segundos a minutos
            travel_time_seconds = float(row.get('travel_time', 0))
            travel_time_minutes = round(travel_time_seconds / 60) if travel_time_seconds else None
            
            # Preparar registro
            record = {
                'kam_id': row.get('Kam'),
                'hospital_id': row.get('Hospital'),
                'travel_time': travel_time_minutes,  # En MINUTOS
                'distance': float(row.get('distance', 0)) if row.get('distance') else None,
                'source': row.get('source', 'google_maps')
            }
            new_records.append(record)
    
    print(f"✅ Leídos {len(new_records)} registros del CSV")
    
    # Mostrar muestra de conversión
    print("\n📋 Muestra de conversión (primeros 5):")
    for r in new_records[:5]:
        if r['kam_id'] and r['hospital_id']:
            print(f"   KAM: {r['kam_id'][:8]}... → Hospital: {r['hospital_id'][:8]}...")
            if r['travel_time'] is not None and r['distance'] is not None:
                print(f"   Tiempo: {r['travel_time']} min | Distancia: {r['distance']:.2f} km")
            else:
                print(f"   Tiempo: {r['travel_time']} min | Distancia: {r['distance']} km")
    
except Exception as e:
    print(f"❌ Error leyendo CSV: {e}")
    exit(1)

# 3. LIMPIAR TABLA ACTUAL
print("\n🗑️ PASO 3: Limpiando tabla hospital_kam_distances...")
print("-"*40)

print("   Eliminando registros existentes...")
# Eliminar en lotes para evitar timeout
deleted = 0
while True:
    # Obtener IDs para eliminar
    to_delete = supabase.table('hospital_kam_distances').select('id').limit(100).execute()
    if not to_delete.data:
        break
    
    # Eliminar por ID
    for record in to_delete.data:
        try:
            supabase.table('hospital_kam_distances').delete().eq('id', record['id']).execute()
            deleted += 1
        except:
            pass
    
    if deleted % 500 == 0:
        print(f"   Eliminados: {deleted} registros...")

print(f"✅ Tabla limpiada: {deleted} registros eliminados")

# 4. INSERTAR NUEVOS DATOS
print("\n📤 PASO 4: Insertando datos nuevos...")
print("-"*40)

batch_size = 100
inserted = 0
errors = 0

for i in range(0, len(new_records), batch_size):
    batch = new_records[i:i+batch_size]
    
    try:
        # Insertar lote
        result = supabase.table('hospital_kam_distances').insert(batch).execute()
        if result.data:
            inserted += len(result.data)
    except Exception as e:
        # Si falla el lote, intentar uno por uno
        for record in batch:
            try:
                supabase.table('hospital_kam_distances').insert(record).execute()
                inserted += 1
            except Exception as e2:
                errors += 1
                print(f"   Error en registro: {str(e2)[:50]}")
    
    if inserted % 500 == 0:
        print(f"   Insertados: {inserted}/{len(new_records)}")

print(f"\n✅ Importación completada:")
print(f"   Insertados: {inserted}")
print(f"   Errores: {errors}")

# 5. VERIFICACIÓN FINAL
print("\n🔍 PASO 5: Verificación final...")
print("-"*40)

# Contar registros
final_count = supabase.table('hospital_kam_distances').select('id', count='exact').execute()
print(f"Total registros en la tabla: {final_count.count}")

# Verificar rangos de tiempo
sample = supabase.table('hospital_kam_distances').select('travel_time').limit(1000).execute()
times = [r['travel_time'] for r in sample.data if r['travel_time']]

if times:
    print(f"\nRangos de tiempo (muestra de 1000):")
    print(f"   Mínimo: {min(times)} min")
    print(f"   Máximo: {max(times)} min")
    print(f"   Promedio: {sum(times)/len(times):.1f} min")
    
    # Verificar si hay valores sospechosos
    suspicious = [t for t in times if t > 1440]  # Más de 24 horas
    if suspicious:
        print(f"   ⚠️ {len(suspicious)} valores > 24 horas (verificar si son correctos)")

# Contar hospitales y KAMs únicos
all_records = supabase.table('hospital_kam_distances').select('hospital_id, kam_id').execute()
unique_hospitals = set(r['hospital_id'] for r in all_records.data)
unique_kams = set(r['kam_id'] for r in all_records.data)

print(f"\nCobertura:")
print(f"   Hospitales únicos: {len(unique_hospitals)}")
print(f"   KAMs únicos: {len(unique_kams)}")
print(f"   Combinaciones: {len(all_records.data)}")

# 6. RESUMEN
print("\n" + "="*60)
print("📊 RESUMEN DE LA OPERACIÓN:")
print("-"*40)
print(f"✅ Backup creado: {backup_file}")
print(f"✅ Registros importados: {inserted}")
print(f"✅ Conversión: Segundos → Minutos")
print(f"✅ Tabla hospital_kam_distances actualizada")

print("\n📌 PRÓXIMOS PASOS:")
print("   1. Verificar los datos en la aplicación web")
print("   2. Ejecutar 'Recalcular Asignaciones'")
print("   3. Considerar eliminar travel_time_cache si ya no se necesita")

print("\n" + "="*60)