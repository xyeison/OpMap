#!/usr/bin/env python3
"""
BACKUP Y CORRECCIÓN DE TIEMPOS
1. Hacer backup completo
2. Convertir segundos a minutos
"""
from supabase import create_client
import json
from datetime import datetime

supabase_url = 'https://norvxqgohddgsdkggqzq.supabase.co'
supabase_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vcnZ4cWdvaGRkZ3Nka2dncXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMDExMjUsImV4cCI6MjA2ODc3NzEyNX0.BRWIYeD_5OlpVKIrP1QzUmkSx6HEVGzcEUUiSK8CmJs'

supabase = create_client(supabase_url, supabase_key)

print("🔒 BACKUP Y CORRECCIÓN DE TIEMPOS")
print("="*60)

# 1. HACER BACKUP COMPLETO
print("\n📦 PASO 1: CREANDO BACKUP COMPLETO...")
print("-"*40)

all_data = []
offset = 0

print("Descargando todos los registros...")
while True:
    batch = supabase.table('hospital_kam_distances').select('*').range(offset, offset + 999).execute()
    if not batch.data:
        break
    all_data.extend(batch.data)
    offset += 1000
    print(f"   Descargados: {len(all_data)} registros...")
    if len(batch.data) < 1000:
        break

# Guardar backup
timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
backup_file = f"/Users/yeison/Documents/GitHub/OpMap/backups/hospital_kam_distances_backup_{timestamp}.json"

# Crear directorio si no existe
import os
os.makedirs("/Users/yeison/Documents/GitHub/OpMap/backups", exist_ok=True)

with open(backup_file, 'w') as f:
    json.dump({
        'timestamp': timestamp,
        'total_records': len(all_data),
        'data': all_data
    }, f, indent=2)

print(f"\n✅ BACKUP GUARDADO:")
print(f"   Archivo: {backup_file}")
print(f"   Total registros: {len(all_data)}")

# 2. ANALIZAR QUÉ NECESITA CORRECCIÓN
print("\n📊 PASO 2: ANALIZANDO DATOS...")
print("-"*40)

needs_fix = []
already_ok = []

for record in all_data:
    if record['travel_time'] and record['travel_time'] > 1440:
        needs_fix.append(record)
    else:
        already_ok.append(record)

print(f"   Registros correctos: {len(already_ok)}")
print(f"   Registros a corregir: {len(needs_fix)}")

if not needs_fix:
    print("\n✅ No hay registros que corregir")
    exit()

# Mostrar ejemplos
print("\n📋 Ejemplos de conversión:")
for r in needs_fix[:5]:
    old_time = r['travel_time']
    new_time = round(old_time / 60)
    print(f"   {old_time} segundos → {new_time} minutos ({new_time/60:.1f} horas)")

# 3. CONFIRMAR ANTES DE PROCEDER
print(f"\n⚠️ CONFIRMACIÓN:")
print(f"   Backup guardado: SÍ ✅")
print(f"   Registros a actualizar: {len(needs_fix)}")
print(f"   Operación: Dividir travel_time por 60")

input_confirm = input("\n¿Proceder con la corrección? (s/n): ")
if input_confirm.lower() != 's':
    print("❌ Operación cancelada")
    print(f"   El backup está en: {backup_file}")
    exit()

# 4. APLICAR CORRECCIÓN
print("\n🔧 PASO 3: APLICANDO CORRECCIÓN...")
print("-"*40)

batch_size = 100
updated = 0
errors = 0

for i in range(0, len(needs_fix), batch_size):
    batch = needs_fix[i:i+batch_size]
    
    for record in batch:
        try:
            new_time = round(record['travel_time'] / 60)
            
            result = supabase.table('hospital_kam_distances').update({
                'travel_time': new_time
            }).eq('id', record['id']).execute()
            
            if result.data:
                updated += 1
            else:
                errors += 1
                
        except Exception as e:
            errors += 1
            print(f"   Error: {str(e)[:50]}")
    
    # Progreso
    if (i + batch_size) % 500 == 0 or i + batch_size >= len(needs_fix):
        print(f"   Procesados: {min(i + batch_size, len(needs_fix))}/{len(needs_fix)}")

# 5. VERIFICACIÓN FINAL
print("\n📊 PASO 4: VERIFICACIÓN FINAL...")
print("-"*40)

# Verificar que no queden registros > 1440
count_check = supabase.table('hospital_kam_distances').select('id', count='exact').gt('travel_time', 1440).execute()

print(f"Actualizados exitosamente: {updated}")
print(f"Errores: {errors}")
print(f"Registros aún > 1440 min: {count_check.count}")

if count_check.count == 0:
    print("\n✅ ÉXITO COMPLETO!")
    print("   Todos los tiempos están ahora en MINUTOS")
else:
    print(f"\n⚠️ Quedan {count_check.count} registros sin convertir")
    print(f"   Puede ejecutar el script nuevamente")

# 6. CREAR SCRIPT DE RESTAURACIÓN
restore_script = f"/Users/yeison/Documents/GitHub/OpMap/backups/restore_script_{timestamp}.py"
with open(restore_script, 'w') as f:
    f.write(f'''#!/usr/bin/env python3
"""
Script para restaurar desde backup si algo sale mal
Creado: {timestamp}
"""
import json
from supabase import create_client

supabase_url = '{supabase_url}'
supabase_key = '{supabase_key}'
backup_file = '{backup_file}'

print("🔄 RESTAURANDO DESDE BACKUP...")

# Cargar backup
with open(backup_file, 'r') as f:
    backup = json.load(f)

print(f"Registros a restaurar: {{backup['total_records']}}")

# Conectar a Supabase
supabase = create_client(supabase_url, supabase_key)

# Restaurar cada registro
for record in backup['data']:
    try:
        supabase.table('hospital_kam_distances').update({{
            'travel_time': record['travel_time']
        }}).eq('id', record['id']).execute()
    except:
        pass

print("✅ Restauración completada")
''')

print(f"\n📄 Script de restauración creado:")
print(f"   {restore_script}")
print(f"   (Úsalo si necesitas revertir los cambios)")

print("\n" + "="*60)
print("PROCESO COMPLETADO")
print("="*60)