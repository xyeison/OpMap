#!/usr/bin/env python3
"""
Corregir tiempos que están en HORAS en lugar de MINUTOS
"""
from supabase import create_client
from datetime import datetime
import json

supabase_url = 'https://norvxqgohddgsdkggqzq.supabase.co'
supabase_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vcnZ4cWdvaGRkZ3Nka2dncXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMDExMjUsImV4cCI6MjA2ODc3NzEyNX0.BRWIYeD_5OlpVKIrP1QzUmkSx6HEVGzcEUUiSK8CmJs'

supabase = create_client(supabase_url, supabase_key)

print("🔧 CORRECCIÓN DE TIEMPOS EN HORAS A MINUTOS")
print("="*60)

# 1. Identificar registros con tiempos < 10 (probablemente en horas)
print("\n📥 Identificando registros con tiempos < 10...")
suspicious = supabase.table('hospital_kam_distances').select('*').lt('travel_time', 10).execute()

print(f"   Registros encontrados: {len(suspicious.data)}")

if not suspicious.data:
    print("\n✅ No hay registros que corregir")
    exit()

# 2. Agrupar por hospital para análisis
hospitals_affected = {}
for record in suspicious.data:
    h_id = record['hospital_id']
    if h_id not in hospitals_affected:
        hospitals_affected[h_id] = []
    hospitals_affected[h_id].append(record)

print(f"   Hospitales afectados: {len(hospitals_affected)}")

# 3. Crear backup antes de modificar
print("\n📦 Creando backup...")
timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
backup_file = f"/Users/yeison/Documents/GitHub/OpMap/backups/hours_to_minutes_backup_{timestamp}.json"

import os
os.makedirs("/Users/yeison/Documents/GitHub/OpMap/backups", exist_ok=True)

with open(backup_file, 'w') as f:
    json.dump({
        'timestamp': timestamp,
        'total_records': len(suspicious.data),
        'data': suspicious.data,
        'hospitals_affected': len(hospitals_affected)
    }, f, indent=2)

print(f"   ✅ Backup guardado: {backup_file}")

# 4. Mostrar ejemplos antes de corregir
print("\n📋 Ejemplos de conversión:")
for i, record in enumerate(suspicious.data[:5], 1):
    old_time = record['travel_time']
    new_time = round(old_time * 60) if old_time else 0
    
    # Obtener info del hospital
    h_info = supabase.table('hospitals').select('name, municipality_name').eq('id', record['hospital_id']).execute()
    if h_info.data:
        print(f"   {i}. {h_info.data[0]['name'][:40]:40} ({h_info.data[0]['municipality_name']})")
        print(f"      {old_time:.1f} horas → {new_time} minutos")

# 5. Confirmar antes de proceder
print(f"\n⚠️ CONFIRMACIÓN:")
print(f"   Registros a actualizar: {len(suspicious.data)}")
print(f"   Operación: Multiplicar travel_time por 60 (convertir horas a minutos)")
print(f"   Backup guardado: SÍ")

input_confirm = input("\n¿Proceder con la corrección? (s/n): ")
if input_confirm.lower() != 's':
    print("❌ Operación cancelada")
    exit()

# 6. Aplicar corrección
print("\n⚙️ Aplicando corrección...")
updated = 0
errors = 0

for record in suspicious.data:
    try:
        new_time = round(record['travel_time'] * 60) if record['travel_time'] else None
        
        result = supabase.table('hospital_kam_distances').update({
            'travel_time': new_time
        }).eq('id', record['id']).execute()
        
        if result.data:
            updated += 1
    except Exception as e:
        errors += 1
        print(f"   Error: {str(e)[:50]}")
    
    if updated % 50 == 0:
        print(f"   Procesados: {updated}/{len(suspicious.data)}")

print(f"\n✅ Corrección completada:")
print(f"   Actualizados: {updated}")
print(f"   Errores: {errors}")

# 7. Verificación final
print("\n📊 VERIFICACIÓN:")

# Verificar Puerto Boyacá específicamente
h_puerto = supabase.table('hospitals').select('id').eq('code', '900678145-1').execute()
if h_puerto.data:
    distances = supabase.table('hospital_kam_distances').select('travel_time, kams(name)').eq('hospital_id', h_puerto.data[0]['id']).order('travel_time').limit(5).execute()
    print("\nPuerto Boyacá (900678145-1) - Tiempos actualizados:")
    for d in distances.data:
        print(f"   → {d['kams']['name']:20} {d['travel_time']} min")

# Verificar que no queden valores < 10
remaining = supabase.table('hospital_kam_distances').select('id', count='exact').lt('travel_time', 10).execute()
print(f"\nRegistros restantes < 10 min: {remaining.count}")

if remaining.count == 0:
    print("\n🎉 ÉXITO!")
    print("   Todos los tiempos han sido corregidos")
    print("   Los valores ahora están en MINUTOS correctos")
else:
    print(f"\n⚠️ Aún quedan {remaining.count} registros < 10 min")
    print("   Podrían ser distancias legítimamente cortas o necesitar revisión")

print("\n" + "="*60)