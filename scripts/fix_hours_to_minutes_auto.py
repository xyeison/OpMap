#!/usr/bin/env python3
"""
Corregir tiempos que están en HORAS en lugar de MINUTOS (automático)
"""
from supabase import create_client
from datetime import datetime
import json

supabase_url = 'https://norvxqgohddgsdkggqzq.supabase.co'
supabase_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vcnZ4cWdvaGRkZ3Nka2dncXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMDExMjUsImV4cCI6MjA2ODc3NzEyNX0.BRWIYeD_5OlpVKIrP1QzUmkSx6HEVGzcEUUiSK8CmJs'

supabase = create_client(supabase_url, supabase_key)

print("🔧 CORRECCIÓN AUTOMÁTICA DE TIEMPOS EN HORAS A MINUTOS")
print("="*60)

# 1. Identificar registros con tiempos < 10 (probablemente en horas)
print("\n📥 Identificando registros con tiempos < 10...")
suspicious = supabase.table('hospital_kam_distances').select('*').lt('travel_time', 10).execute()

print(f"   Registros encontrados: {len(suspicious.data)}")

if not suspicious.data:
    print("\n✅ No hay registros que corregir")
    exit()

# 2. Agrupar por hospital
hospitals_affected = {}
for record in suspicious.data:
    h_id = record['hospital_id']
    if h_id not in hospitals_affected:
        hospitals_affected[h_id] = []
    hospitals_affected[h_id].append(record)

print(f"   Hospitales afectados: {len(hospitals_affected)}")

# 3. Crear backup
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

# 4. Mostrar ejemplos
print("\n📋 Conversiones a realizar:")
for i, record in enumerate(suspicious.data, 1):
    old_time = record['travel_time']
    new_time = round(old_time * 60) if old_time else 0
    
    # Obtener info del hospital y KAM
    h_info = supabase.table('hospitals').select('code, name, municipality_name').eq('id', record['hospital_id']).execute()
    k_info = supabase.table('kams').select('name').eq('id', record['kam_id']).execute()
    
    if h_info.data and k_info.data:
        print(f"   {i:2}. {h_info.data[0]['code']:15} | {h_info.data[0]['municipality_name']:20}")
        print(f"       {k_info.data[0]['name']:20} | {old_time:.1f} horas → {new_time} minutos")

# 5. Aplicar corrección
print("\n⚙️ Aplicando corrección automática...")
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
            print(f"   ✅ Actualizado registro {updated}/{len(suspicious.data)}")
    except Exception as e:
        errors += 1
        print(f"   ❌ Error: {str(e)[:50]}")

print(f"\n📊 Resultados:")
print(f"   Actualizados: {updated}")
print(f"   Errores: {errors}")

# 6. Verificación final
print("\n🔍 VERIFICACIÓN FINAL:")
print("-"*40)

# Verificar algunos casos específicos
test_cases = [
    '900678145-1',  # Puerto Boyacá
    '800215019-1',  # Montería
    '900073857-1',  # Sincelejo
]

for code in test_cases:
    h = supabase.table('hospitals').select('id, name, municipality_name').eq('code', code).execute()
    if h.data:
        dists = supabase.table('hospital_kam_distances').select('travel_time, kams(name)').eq('hospital_id', h.data[0]['id']).order('travel_time').limit(3).execute()
        print(f"\n{code} - {h.data[0]['name'][:30]}... ({h.data[0]['municipality_name']})")
        for d in dists.data:
            print(f"   → {d['kams']['name']:20} {d['travel_time']} min")

# Verificar que no queden valores < 10
remaining = supabase.table('hospital_kam_distances').select('id', count='exact').lt('travel_time', 10).execute()
print(f"\n📊 Estado final:")
print(f"   Registros < 10 min restantes: {remaining.count}")

if remaining.count == 0:
    print("\n🎉 CORRECCIÓN EXITOSA!")
    print("   Todos los tiempos han sido convertidos de horas a minutos")
    print("   Los valores ahora reflejan tiempos de viaje realistas")
    
    # Crear script de restauración
    restore_script = f"/Users/yeison/Documents/GitHub/OpMap/backups/restore_hours_{timestamp}.py"
    with open(restore_script, 'w') as f:
        f.write(f'''#!/usr/bin/env python3
"""
Restaurar valores originales si es necesario
"""
import json
from supabase import create_client

backup_file = '{backup_file}'
supabase_url = '{supabase_url}'
supabase_key = '{supabase_key}'

print("Restaurando desde backup...")
with open(backup_file, 'r') as f:
    backup = json.load(f)

supabase = create_client(supabase_url, supabase_key)

for record in backup['data']:
    supabase.table('hospital_kam_distances').update({{
        'travel_time': record['travel_time']
    }}).eq('id', record['id']).execute()

print("✅ Restauración completada")
''')
    
    print(f"\n📄 Script de restauración creado:")
    print(f"   {restore_script}")
else:
    print(f"\n⚠️ Aún quedan {remaining.count} registros < 10 min")
    print("   Verificar manualmente si son correctos")

print("\n" + "="*60)
print("PROCESO COMPLETADO")
print("="*60)