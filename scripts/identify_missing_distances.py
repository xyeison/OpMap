#!/usr/bin/env python3
"""
Identificar exactamente qué distancias hospital-KAM faltan por calcular
"""
from supabase import create_client

supabase_url = 'https://norvxqgohddgsdkggqzq.supabase.co'
supabase_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vcnZ4cWdvaGRkZ3Nka2dncXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMDExMjUsImV4cCI6MjA2ODc3NzEyNX0.BRWIYeD_5OlpVKIrP1QzUmkSx6HEVGzcEUUiSK8CmJs'

supabase = create_client(supabase_url, supabase_key)

print("🔍 IDENTIFICACIÓN DE DISTANCIAS FALTANTES")
print("="*60)

# 1. Obtener todos los hospitales activos
print("\n📥 Obteniendo hospitales activos...")
hospitals = supabase.table('hospitals').select('id, code, name, municipality_name').eq('active', True).execute()
print(f"   Total hospitales activos: {len(hospitals.data)}")

# 2. Obtener todos los KAMs activos
print("\n📥 Obteniendo KAMs activos...")
kams = supabase.table('kams').select('id, name').eq('active', True).execute()
print(f"   Total KAMs activos: {len(kams.data)}")

# 3. Total de combinaciones esperadas
total_expected = len(hospitals.data) * len(kams.data)
print(f"\n📊 Combinaciones esperadas: {total_expected:,}")

# 4. Obtener todas las distancias existentes
print("\n📥 Obteniendo distancias calculadas...")
distances = supabase.table('hospital_kam_distances').select('hospital_id, kam_id').execute()
print(f"   Total distancias existentes: {len(distances.data):,}")

# Crear set de combinaciones existentes
existing = set()
for d in distances.data:
    existing.add((d['hospital_id'], d['kam_id']))

# 5. Identificar combinaciones faltantes
missing = []
hospitals_without_complete = {}
kams_without_complete = {}

for h in hospitals.data:
    h_missing = 0
    for k in kams.data:
        if (h['id'], k['id']) not in existing:
            missing.append((h['id'], k['id']))
            h_missing += 1
    
    if h_missing > 0:
        hospitals_without_complete[h['id']] = {
            'code': h['code'],
            'name': h['name'],
            'municipality': h['municipality_name'],
            'missing_count': h_missing,
            'calculated_count': len(kams.data) - h_missing
        }

# Contar por KAM también
for k in kams.data:
    k_missing = 0
    for h in hospitals.data:
        if (h['id'], k['id']) not in existing:
            k_missing += 1
    
    if k_missing > 0:
        kams_without_complete[k['id']] = {
            'name': k['name'],
            'missing_count': k_missing,
            'calculated_count': len(hospitals.data) - k_missing
        }

print(f"\n📊 RESUMEN:")
print("-"*40)
print(f"Total combinaciones esperadas: {total_expected:,}")
print(f"Total combinaciones existentes: {len(existing):,}")
print(f"Total combinaciones FALTANTES: {len(missing):,}")
print(f"Porcentaje completado: {(len(existing)/total_expected)*100:.1f}%")

# 6. Análisis por hospital
print(f"\n🏥 HOSPITALES CON CÁLCULOS INCOMPLETOS:")
print("-"*40)

# Agrupar por cantidad de cálculos faltantes
by_missing_count = {}
for h_id, h_data in hospitals_without_complete.items():
    count = h_data['missing_count']
    if count not in by_missing_count:
        by_missing_count[count] = []
    by_missing_count[count].append(h_data)

for missing_count in sorted(by_missing_count.keys()):
    hospitals_list = by_missing_count[missing_count]
    print(f"\n{len(hospitals_list)} hospitales con {missing_count} KAMs faltantes:")
    
    # Mostrar algunos ejemplos
    for h in hospitals_list[:3]:
        print(f"   • {h['code']}: {h['name'][:40]} ({h['municipality']})")
        print(f"     Calculados: {h['calculated_count']}/{len(kams.data)}")

# 7. Análisis por KAM
print(f"\n👤 KAMS CON CÁLCULOS INCOMPLETOS:")
print("-"*40)

for k_id, k_data in sorted(kams_without_complete.items(), key=lambda x: x[1]['missing_count']):
    print(f"{k_data['name']:20} - Faltantes: {k_data['missing_count']:3} | Calculados: {k_data['calculated_count']:3}/{len(hospitals.data)}")

# 8. Guardar lista de faltantes
print(f"\n💾 Guardando lista de combinaciones faltantes...")
import json

output_file = '/Users/yeison/Documents/GitHub/OpMap/data/missing_distances.json'
missing_details = []

for h_id, k_id in missing[:100]:  # Primeros 100 para muestra
    h = next((h for h in hospitals.data if h['id'] == h_id), None)
    k = next((k for k in kams.data if k['id'] == k_id), None)
    if h and k:
        missing_details.append({
            'hospital_id': h_id,
            'hospital_code': h['code'],
            'hospital_name': h['name'],
            'kam_id': k_id,
            'kam_name': k['name']
        })

with open(output_file, 'w') as f:
    json.dump({
        'total_missing': len(missing),
        'total_expected': total_expected,
        'percentage_complete': (len(existing)/total_expected)*100,
        'sample': missing_details
    }, f, indent=2)

print(f"   ✅ Guardado en: {output_file}")

# 9. Recomendaciones
print(f"\n" + "="*60)
print("🔧 RECOMENDACIONES:")
print("-"*40)

if len(missing) > 0:
    # Estimar costo
    cost_per_1000 = 5.0  # USD
    estimated_cost = (len(missing) / 1000) * cost_per_1000
    
    print(f"1. Calcular las {len(missing):,} distancias faltantes")
    print(f"   Costo estimado: ${estimated_cost:.2f} USD (Google Maps API)")
    print(f"   Tiempo estimado: {len(missing)/100:.0f} minutos")
    print()
    print("2. Priorizar hospitales con 17 KAMs faltantes (sin ningún cálculo)")
    print()
    print("3. Ejecutar cálculo por lotes para evitar timeouts")
    print()
    print("4. Después de completar, ejecutar 'Recalcular Asignaciones'")
else:
    print("✅ Todas las distancias están calculadas!")

print("\n" + "="*60)