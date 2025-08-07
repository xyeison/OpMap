#!/usr/bin/env python3
"""
Calcular TODAS las rutas faltantes identificadas (1,449 rutas)
"""
import os
import time
import json
from datetime import datetime
from supabase import create_client
import googlemaps
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()

# Configuración
supabase_url = 'https://norvxqgohddgsdkggqzq.supabase.co'
supabase_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vcnZ4cWdvaGRkZ3Nka2dncXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMDExMjUsImV4cCI6MjA2ODc3NzEyNX0.BRWIYeD_5OlpVKIrP1QzUmkSx6HEVGzcEUUiSK8CmJs'
google_api_key = os.getenv('GOOGLE_MAPS_API_KEY')

if not google_api_key:
    print("❌ ERROR: No se encontró GOOGLE_MAPS_API_KEY en el archivo .env")
    exit(1)

# Inicializar clientes
supabase = create_client(supabase_url, supabase_key)
gmaps = googlemaps.Client(key=google_api_key)

print("🚀 CALCULADOR DE RUTAS FALTANTES - COMPLETO")
print("="*60)

# 1. Cargar datos necesarios
print("📥 Cargando configuración...")

# Departamentos excluidos
excluded_depts = supabase.table('departments').select('code').eq('excluded', True).execute()
excluded_set = set(d['code'] for d in excluded_depts.data)

# Matriz de adyacencia
adjacency = supabase.table('department_adjacency').select('*').execute()
adj_matrix = {}
for row in adjacency.data:
    dept = row['department_code']
    if dept not in adj_matrix:
        adj_matrix[dept] = set()
    adj_matrix[dept].add(row['adjacent_department_code'])

# KAMs activos
kams = supabase.table('kams').select('*').eq('active', True).execute()
kams_dict = {k['id']: k for k in kams.data}
kams_by_area = {}

for kam in kams.data:
    area_id = kam['area_id']
    kams_by_area[area_id] = kam

print(f"   KAMs activos: {len(kams.data)}")

# Hospitales activos
hospitals = supabase.table('hospitals').select('*').eq('active', True).execute()
hospitals_not_excluded = [h for h in hospitals.data if h['department_id'] not in excluded_set]
print(f"   Hospitales en deptos activos: {len(hospitals_not_excluded)}")

# Distancias existentes
all_distances = []
offset = 0
while True:
    batch = supabase.table('hospital_kam_distances').select('hospital_id, kam_id').range(offset, offset + 999).execute()
    if not batch.data:
        break
    all_distances.extend(batch.data)
    offset += 1000
    if len(batch.data) < 1000:
        break

existing_pairs = set((d['hospital_id'], d['kam_id']) for d in all_distances)
print(f"   Pares existentes: {len(existing_pairs)}")

# 2. Función para determinar KAMs requeridos
def get_required_kams(hospital, all_kams, adj_matrix, kams_by_area):
    """Determina qué KAMs necesitan distancia a este hospital"""
    h_dept = hospital['department_id']
    h_mun = hospital['municipality_id']
    h_locality = hospital.get('locality_id')
    
    required_kams = set()
    
    # Verificar KAM local
    kam_local = None
    if h_locality and h_locality in kams_by_area:
        kam_local = kams_by_area[h_locality]
    elif h_mun in kams_by_area:
        kam_local = kams_by_area[h_mun]
    elif h_mun[:5] in kams_by_area:
        kam_local = kams_by_area[h_mun[:5]]
    
    # CASO BOGOTÁ
    if h_dept == '11' and h_locality:
        for kam in all_kams:
            if kam['area_id'].startswith('11001'):
                if not kam_local or kam['id'] != kam_local['id']:
                    required_kams.add(kam['id'])
    else:
        # CASO REGULAR
        for kam in all_kams:
            if kam_local and kam['id'] == kam_local['id']:
                continue
            
            kam_dept = kam['area_id'][:2]
            
            # Mismo departamento
            if kam_dept == h_dept:
                required_kams.add(kam['id'])
                continue
            
            # Nivel 1: adyacente
            if h_dept in adj_matrix and kam_dept in adj_matrix[h_dept]:
                required_kams.add(kam['id'])
                continue
            
            # Nivel 2
            if kam.get('enable_level2', True):
                if h_dept in adj_matrix:
                    for adj1 in adj_matrix[h_dept]:
                        if adj1 in adj_matrix and kam_dept in adj_matrix[adj1]:
                            required_kams.add(kam['id'])
                            break
    
    return required_kams

# 3. Identificar rutas faltantes
print("\n🔍 Identificando rutas faltantes...")

routes_to_calculate = []

for hospital in hospitals_not_excluded:
    h_id = hospital['id']
    required_kams = get_required_kams(hospital, kams.data, adj_matrix, kams_by_area)
    
    for kam_id in required_kams:
        if (h_id, kam_id) not in existing_pairs:
            kam = kams_dict[kam_id]
            routes_to_calculate.append({
                'hospital_id': h_id,
                'hospital_name': hospital['name'],
                'hospital_lat': hospital['lat'],
                'hospital_lng': hospital['lng'],
                'hospital_dept': hospital['department_name'],
                'hospital_mun': hospital['municipality_name'],
                'kam_id': kam_id,
                'kam_name': kam['name'],
                'kam_lat': kam['lat'],
                'kam_lng': kam['lng']
            })

print(f"   Total rutas a calcular: {len(routes_to_calculate)}")

# Guardar respaldo
timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
backup_file = f"/Users/yeison/Documents/GitHub/OpMap/output/routes_to_calculate_{timestamp}.json"
with open(backup_file, 'w') as f:
    json.dump({
        'total': len(routes_to_calculate),
        'timestamp': timestamp,
        'routes': routes_to_calculate[:100]  # Muestra
    }, f, indent=2)
print(f"   Respaldo: {backup_file}")

# 4. Confirmación
print(f"\n⚠️ INICIANDO CÁLCULO:")
print(f"   Rutas a calcular: {len(routes_to_calculate)}")
print(f"   Costo estimado: ${len(routes_to_calculate) * 0.005:.2f} USD")
print(f"   Tiempo estimado: {len(routes_to_calculate) * 0.3 / 60:.1f} minutos")
print("\n✅ Iniciando en 3 segundos...")
time.sleep(3)

# 5. Procesamiento
print("\n🚀 CALCULANDO RUTAS...")
print("-"*60)

log_file = f"/Users/yeison/Documents/GitHub/OpMap/output/calculation_log_{timestamp}.txt"
calculated = 0
saved = 0
errors = 0
start_time = time.time()

# Procesar en lotes
batch_size = 10
for i in range(0, len(routes_to_calculate), batch_size):
    batch = routes_to_calculate[i:i+batch_size]
    batch_num = i//batch_size + 1
    total_batches = (len(routes_to_calculate) + batch_size - 1) // batch_size
    
    print(f"\n📍 Batch {batch_num}/{total_batches}")
    
    for route in batch:
        try:
            # Llamada a Google Maps
            result = gmaps.distance_matrix(
                origins=[(route['kam_lat'], route['kam_lng'])],
                destinations=[(route['hospital_lat'], route['hospital_lng'])],
                mode="driving",
                units="metric",
                departure_time="now"
            )
            
            if result['status'] == 'OK':
                element = result['rows'][0]['elements'][0]
                
                if element['status'] == 'OK':
                    # Extraer datos
                    distance_meters = element['distance']['value']
                    duration_seconds = element['duration']['value']
                    
                    travel_time_minutes = int(duration_seconds / 60)
                    distance_km = round(distance_meters / 1000, 2)
                    
                    # Guardar en base de datos
                    try:
                        # Verificar que no exista
                        existing = supabase.table('hospital_kam_distances').select('id').eq(
                            'hospital_id', route['hospital_id']
                        ).eq('kam_id', route['kam_id']).execute()
                        
                        if not existing.data:
                            result_db = supabase.table('hospital_kam_distances').insert({
                                'hospital_id': route['hospital_id'],
                                'kam_id': route['kam_id'],
                                'travel_time': travel_time_minutes,
                                'distance': distance_km,
                                'source': 'google_maps',
                                'calculated_at': datetime.now().isoformat()
                            }).execute()
                            
                            if result_db.data:
                                saved += 1
                                print(f"   ✅ {route['kam_name']} → {route['hospital_name'][:30]}: {travel_time_minutes} min")
                        else:
                            print(f"   ⚠️ Ya existe: {route['kam_name']} → {route['hospital_name'][:30]}")
                    except Exception as e:
                        errors += 1
                        print(f"   ❌ Error BD: {str(e)[:50]}")
                        with open(log_file, 'a') as f:
                            f.write(f"Error BD: {route} - {str(e)}\n")
                    
                    calculated += 1
                else:
                    errors += 1
                    print(f"   ❌ Sin ruta: {route['kam_name']} → {route['hospital_name'][:30]}")
                    with open(log_file, 'a') as f:
                        f.write(f"Sin ruta: {route}\n")
            
            # Rate limiting
            time.sleep(0.2)
            
        except Exception as e:
            errors += 1
            print(f"   ❌ Error API: {str(e)[:50]}")
            with open(log_file, 'a') as f:
                f.write(f"Error API: {route} - {str(e)}\n")
    
    # Progreso
    elapsed = time.time() - start_time
    if calculated > 0:
        rate = calculated / elapsed
        remaining = (len(routes_to_calculate) - calculated) / rate if rate > 0 else 0
        print(f"\n📊 Progreso: {calculated}/{len(routes_to_calculate)} ({calculated*100/len(routes_to_calculate):.1f}%)")
        print(f"   Guardadas: {saved}, Errores: {errors}")
        print(f"   Tiempo restante: {remaining/60:.1f} min")

# 6. Resumen final
elapsed_total = time.time() - start_time
print("\n" + "="*60)
print("📊 RESUMEN FINAL")
print("="*60)
print(f"Tiempo total: {elapsed_total/60:.1f} minutos")
print(f"Rutas calculadas: {calculated}")
print(f"Rutas guardadas: {saved}")
print(f"Errores: {errors}")
print(f"Costo real: ${calculated * 0.005:.2f} USD")

# 7. Verificar nuevo estado
new_count = supabase.table('hospital_kam_distances').select('id', count='exact').execute()
print(f"\n📊 Estado final:")
print(f"   Total distancias en BD: {new_count.count}")
print(f"   Nuevas agregadas: {saved}")

print(f"\n📄 Archivos generados:")
print(f"   - Respaldo: {backup_file}")
print(f"   - Log: {log_file}")
print("="*60)