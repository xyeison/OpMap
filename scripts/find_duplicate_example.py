#!/usr/bin/env python3
"""
Encontrar y mostrar un ejemplo de duplicado en hospital_kam_distances
"""
from supabase import create_client

supabase_url = 'https://norvxqgohddgsdkggqzq.supabase.co'
supabase_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vcnZ4cWdvaGRkZ3Nka2dncXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMDExMjUsImV4cCI6MjA2ODc3NzEyNX0.BRWIYeD_5OlpVKIrP1QzUmkSx6HEVGzcEUUiSK8CmJs'

supabase = create_client(supabase_url, supabase_key)

print("🔍 BUSCANDO DUPLICADOS EN hospital_kam_distances")
print("="*60)

# Obtener TODOS los registros para análisis completo
print("\n📥 Cargando datos...")
all_records = []
offset = 0
batch_size = 1000

while True:
    batch = supabase.table('hospital_kam_distances').select('*').range(offset, offset + batch_size - 1).execute()
    if not batch.data:
        break
    all_records.extend(batch.data)
    print(f"   Cargados {len(all_records)} registros...")
    offset += batch_size
    if len(batch.data) < batch_size:
        break

print(f"\n📊 Total registros: {len(all_records)}")

# Analizar duplicados
pairs = {}
for record in all_records:
    key = (record['hospital_id'], record['kam_id'])
    if key not in pairs:
        pairs[key] = []
    pairs[key].append(record)

# Encontrar duplicados
duplicates = {k: v for k, v in pairs.items() if len(v) > 1}
unique_pairs = {k: v for k, v in pairs.items() if len(v) == 1}

print(f"   Pares únicos: {len(unique_pairs)}")
print(f"   Pares con duplicados: {len(duplicates)}")

# Calcular total de registros extras
total_duplicates = sum(len(v) - 1 for v in duplicates.values())
print(f"   Registros duplicados a eliminar: {total_duplicates}")

# Mostrar ejemplos de duplicados
if duplicates:
    print(f"\n📋 EJEMPLOS DE DUPLICADOS:")
    print("-"*60)
    
    # Mostrar primeros 3 ejemplos
    for i, (key, records) in enumerate(list(duplicates.items())[:3], 1):
        hospital_id, kam_id = key
        
        # Obtener información
        hospital = supabase.table('hospitals').select('name, code, municipality_name').eq('id', hospital_id).execute()
        kam = supabase.table('kams').select('name, area_id').eq('id', kam_id).execute()
        
        print(f"\n🔸 EJEMPLO {i}:")
        if hospital.data:
            h = hospital.data[0]
            print(f"   Hospital: {h['name']}")
            print(f"   Código: {h['code']}")
            print(f"   Municipio: {h['municipality_name']}")
        
        if kam.data:
            k = kam.data[0]
            print(f"   KAM: {k['name']} (área {k['area_id']})")
        
        print(f"\n   📊 {len(records)} REGISTROS DUPLICADOS:")
        
        # Mostrar todos los registros duplicados
        for j, r in enumerate(records, 1):
            print(f"\n   Registro {j}:")
            print(f"      ID: {r['id']}")
            print(f"      Tiempo: {r['travel_time']} minutos")
            print(f"      Distancia: {r.get('distance', 'N/A')} km")
            print(f"      Fuente: {r['source']}")
            print(f"      Calculado: {r.get('calculated_at', 'N/A')}")
            print(f"      Creado: {r['created_at']}")
            print(f"      Actualizado: {r.get('updated_at', 'N/A')}")
        
        print("-"*60)

# Análisis de patrones
print(f"\n📊 ANÁLISIS DE PATRONES DE DUPLICACIÓN:")

# Contar cuántas veces se duplica cada par
duplication_counts = {}
for records in duplicates.values():
    count = len(records)
    if count not in duplication_counts:
        duplication_counts[count] = 0
    duplication_counts[count] += 1

print("\n   Distribución de duplicados:")
for count, pairs in sorted(duplication_counts.items()):
    print(f"      {count} copias: {pairs} pares")

# Verificar si todos tienen los mismos valores
print(f"\n🔍 VERIFICANDO CONSISTENCIA DE DUPLICADOS:")
inconsistent = []
for key, records in list(duplicates.items())[:10]:  # Primeros 10
    times = set(r['travel_time'] for r in records)
    sources = set(r['source'] for r in records)
    
    if len(times) > 1 or len(sources) > 1:
        inconsistent.append({
            'key': key,
            'times': times,
            'sources': sources
        })

if inconsistent:
    print(f"   ⚠️ {len(inconsistent)} pares tienen valores DIFERENTES en sus duplicados")
    for inc in inconsistent[:3]:
        print(f"      Par {inc['key']}: tiempos {inc['times']}, fuentes {inc['sources']}")
else:
    print(f"   ✅ Todos los duplicados tienen los mismos valores (son copias exactas)")

print("\n" + "="*60)
print("RESUMEN:")
print("="*60)
print(f"Total registros: {len(all_records)}")
print(f"Pares únicos reales: {len(pairs)}")
print(f"Registros a eliminar: {total_duplicates}")
print(f"Registros finales después de limpieza: {len(all_records) - total_duplicates}")
print("="*60)