#!/usr/bin/env python3
"""
IMPORTANTE: La tabla hospital_kam_distances almacena tiempos en SEGUNDOS
El frontend debe convertir a minutos/horas para mostrar

Importar datos limpios desde CSV a hospital_kam_distances
Mantiene los tiempos en SEGUNDOS como vienen del CSV
"""
import csv
from supabase import create_client
from datetime import datetime
import json

supabase_url = 'https://norvxqgohddgsdkggqzq.supabase.co'
supabase_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vcnZ4cWdvaGRkZ3Nka2dncXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMDExMjUsImV4cCI6MjA2ODc3NzEyNX0.BRWIYeD_5OlpVKIrP1QzUmkSx6HEVGzcEUUiSK8CmJs'

supabase = create_client(supabase_url, supabase_key)

print("🔄 IMPORTACIÓN DE DATOS LIMPIOS A hospital_kam_distances")
print("⚠️  NOTA: Los tiempos se almacenan en SEGUNDOS")
print("="*60)

# 1. LEER ARCHIVO CSV PRIMERO
print("\n📥 PASO 1: Leyendo archivo CSV...")
print("-"*40)

csv_file = '/Users/yeison/Downloads/distanciaKAMHospital.csv'
new_records = []

try:
    with open(csv_file, 'r', encoding='utf-8-sig') as f:  # utf-8-sig para manejar BOM
        reader = csv.DictReader(f, delimiter=';')
        
        for row in reader:
            # Mantener tiempo en SEGUNDOS
            travel_time_seconds = int(float(row.get('travel_time', 0))) if row.get('travel_time') else None
            
            # Preparar registro
            record = {
                'kam_id': row.get('Kam'),
                'hospital_id': row.get('Hospital'),
                'travel_time': travel_time_seconds,  # En SEGUNDOS
                'distance': float(row.get('distance', 0)) if row.get('distance') else None,
                'source': row.get('source', 'google_maps')
            }
            new_records.append(record)
    
    print(f"✅ Leídos {len(new_records)} registros del CSV")
    
    # Mostrar muestra
    print("\n📋 Muestra de datos (primeros 5):")
    for i, r in enumerate(new_records[:5], 1):
        print(f"   {i}. KAM: {r['kam_id'][:8]}... → Hospital: {r['hospital_id'][:8]}...")
        print(f"      Tiempo: {r['travel_time']} seg ({r['travel_time']/60:.1f} min)")
        print(f"      Distancia: {r['distance']:.2f} km")
    
except Exception as e:
    print(f"❌ Error leyendo CSV: {e}")
    exit(1)

# 2. HACER BACKUP RÁPIDO (solo contar registros actuales)
print("\n📦 PASO 2: Verificando datos actuales...")
print("-"*40)

current_count = supabase.table('hospital_kam_distances').select('id', count='exact').execute()
print(f"   Registros actuales en la tabla: {current_count.count}")

# 3. LIMPIAR TABLA (más eficiente usando truncate si es posible)
print("\n🗑️ PASO 3: Limpiando tabla hospital_kam_distances...")
print("-"*40)

# Intentar eliminar todos los registros de una vez
try:
    # Obtener todos los IDs
    all_ids = []
    offset = 0
    while True:
        batch = supabase.table('hospital_kam_distances').select('id').range(offset, offset + 999).execute()
        if not batch.data:
            break
        all_ids.extend([r['id'] for r in batch.data])
        offset += 1000
        if len(batch.data) < 1000:
            break
    
    print(f"   Eliminando {len(all_ids)} registros...")
    
    # Eliminar en lotes más grandes
    batch_size = 500
    for i in range(0, len(all_ids), batch_size):
        batch_ids = all_ids[i:i+batch_size]
        supabase.table('hospital_kam_distances').delete().in_('id', batch_ids).execute()
        if (i + batch_size) % 2000 == 0:
            print(f"   Eliminados: {min(i + batch_size, len(all_ids))}/{len(all_ids)}")
    
    print(f"✅ Tabla limpiada")
    
except Exception as e:
    print(f"⚠️ Error limpiando tabla: {e}")
    print("   Continuando con la inserción...")

# 4. INSERTAR NUEVOS DATOS
print("\n📤 PASO 4: Insertando datos nuevos...")
print("-"*40)

batch_size = 500  # Lotes más grandes para ser más rápido
inserted = 0
errors = 0

for i in range(0, len(new_records), batch_size):
    batch = new_records[i:i+batch_size]
    
    try:
        # Insertar lote completo
        result = supabase.table('hospital_kam_distances').insert(batch).execute()
        if result.data:
            inserted += len(result.data)
    except Exception as e:
        # Si falla, reducir tamaño del lote
        print(f"   Lote falló, intentando en sub-lotes de 100...")
        for j in range(0, len(batch), 100):
            sub_batch = batch[j:j+100]
            try:
                result = supabase.table('hospital_kam_distances').insert(sub_batch).execute()
                if result.data:
                    inserted += len(result.data)
            except Exception as e2:
                errors += len(sub_batch)
                print(f"   Error en sub-lote: {str(e2)[:50]}")
    
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
sample = supabase.table('hospital_kam_distances').select('travel_time').limit(100).execute()
times = [r['travel_time'] for r in sample.data if r['travel_time']]

if times:
    print(f"\nRangos de tiempo en SEGUNDOS (muestra de 100):")
    print(f"   Mínimo: {min(times)} seg ({min(times)/60:.1f} min)")
    print(f"   Máximo: {max(times)} seg ({max(times)/60:.1f} min)")
    print(f"   Promedio: {sum(times)/len(times):.0f} seg ({sum(times)/len(times)/60:.1f} min)")

# Contar hospitales y KAMs únicos
print("\nContando cobertura...")
hospitals_count = supabase.table('hospital_kam_distances').select('hospital_id').execute()
kams_count = supabase.table('hospital_kam_distances').select('kam_id').execute()

unique_hospitals = len(set(r['hospital_id'] for r in hospitals_count.data))
unique_kams = len(set(r['kam_id'] for r in kams_count.data))

print(f"   Hospitales únicos: {unique_hospitals}")
print(f"   KAMs únicos: {unique_kams}")
print(f"   Total combinaciones: {final_count.count}")

# 6. DOCUMENTACIÓN
print("\n" + "="*60)
print("📊 RESUMEN DE LA OPERACIÓN:")
print("-"*40)
print(f"✅ Registros importados: {inserted}")
print(f"⚠️ IMPORTANTE: Tiempos almacenados en SEGUNDOS")
print(f"✅ Tabla hospital_kam_distances actualizada")

print("\n📝 DOCUMENTACIÓN IMPORTANTE:")
print("-"*40)
print("La tabla hospital_kam_distances almacena travel_time en SEGUNDOS")
print("Para mostrar en la aplicación:")
print("   - Minutos: travel_time / 60")
print("   - Horas: travel_time / 3600")
print("   - Formato: Math.floor(travel_time/3600)h Math.floor((travel_time%3600)/60)min")

print("\n📌 PRÓXIMOS PASOS:")
print("   1. Actualizar el frontend para manejar segundos")
print("   2. Actualizar el algoritmo de asignación para usar segundos")
print("   3. Ejecutar 'Recalcular Asignaciones'")
print("   4. Considerar eliminar travel_time_cache")

print("\n" + "="*60)