#!/usr/bin/env python3
"""
Calcular las rutas que aún faltan después del primer intento
Versión optimizada para procesamiento masivo
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

print("🚀 CALCULADOR DE RUTAS RESTANTES - VERSIÓN BATCH OPTIMIZADA")
print("="*60)

# 1. Obtener estado actual
print("\n📊 ESTADO ACTUAL:")
current_count = supabase.table('hospital_kam_distances').select('id', count='exact').execute()
print(f"   Distancias actuales en BD: {current_count.count}")

# 2. Cargar configuración necesaria
print("\n📥 Cargando configuración...")

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
kams_bogota = []

for kam in kams.data:
    area_id = kam['area_id']
    kams_by_area[area_id] = kam
    if area_id.startswith('11001'):
        kams_bogota.append(kam)

print(f"   KAMs activos: {len(kams.data)}")

# 3. Obtener hospitales y distancias existentes
print("\n📥 Analizando hospitales...")
hospitals = supabase.table('hospitals').select('*').eq('active', True).execute()

# Obtener TODAS las distancias existentes con paginación
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

# Hospitales sin ninguna distancia
hospitals_sin_distancias = []
for h in hospitals.data:
    if h['department_id'] in excluded_set:
        continue
    if not any(h['id'] == pair[0] for pair in existing_pairs):
        hospitals_sin_distancias.append(h)

print(f"   Hospitales sin ninguna distancia: {len(hospitals_sin_distancias)}")

# 4. Función para determinar KAMs competidores
def get_competing_kams(hospital, all_kams, adj_matrix, kams_by_area):
    """Determina qué KAMs pueden competir por un hospital"""
    h_dept = hospital['department_id']
    h_mun = hospital['municipality_id']
    h_locality = hospital.get('locality_id')
    
    competing = []
    kam_local = None
    
    # Verificar KAM local
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
                    competing.append(kam)
    else:
        # CASO REGULAR
        for kam in all_kams:
            if kam_local and kam['id'] == kam_local['id']:
                continue
            
            kam_dept = kam['area_id'][:2]
            
            # Mismo departamento
            if kam_dept == h_dept:
                competing.append(kam)
                continue
            
            # Nivel 1: adyacente
            if h_dept in adj_matrix and kam_dept in adj_matrix[h_dept]:
                competing.append(kam)
                continue
            
            # Nivel 2: adyacente del adyacente
            if kam.get('enable_level2', True):
                if h_dept in adj_matrix:
                    for adj1 in adj_matrix[h_dept]:
                        if adj1 in adj_matrix and kam_dept in adj_matrix[adj1]:
                            competing.append(kam)
                            break
    
    return kam_local, competing

# 5. Preparar TODAS las rutas necesarias (no solo las que faltan)
print("\n🎯 Calculando rutas faltantes...")

routes_to_calculate = []
routes_already_exist = 0

for hospital in hospitals.data:
    # Skip excluded departments
    if hospital['department_id'] in excluded_set:
        continue
    
    kam_local, competing_kams = get_competing_kams(hospital, kams.data, adj_matrix, kams_by_area)
    
    for kam in competing_kams:
        # Verificar si ya existe
        if (hospital['id'], kam['id']) not in existing_pairs:
            routes_to_calculate.append({
                'hospital_id': hospital['id'],
                'hospital_name': hospital['name'],
                'hospital_lat': hospital['lat'],
                'hospital_lng': hospital['lng'],
                'hospital_municipality': hospital['municipality_name'],
                'hospital_department': hospital['department_name'],
                'kam_id': kam['id'],
                'kam_name': kam['name'],
                'kam_lat': kam['lat'],
                'kam_lng': kam['lng']
            })
        else:
            routes_already_exist += 1

print(f"\n📊 ANÁLISIS DE RUTAS:")
print(f"   Rutas que YA existen: {routes_already_exist}")
print(f"   Rutas que FALTAN calcular: {len(routes_to_calculate)}")
print(f"   Total rutas lógicas: {routes_already_exist + len(routes_to_calculate)}")

if len(routes_to_calculate) == 0:
    print("\n✅ No hay rutas pendientes por calcular")
    exit()

# Crear archivo de respaldo
backup_file = f"/Users/yeison/Documents/GitHub/OpMap/output/remaining_routes_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
with open(backup_file, 'w') as f:
    json.dump({
        'total_remaining': len(routes_to_calculate),
        'already_exist': routes_already_exist,
        'routes_sample': routes_to_calculate[:50]  # Muestra de 50
    }, f, indent=2)
print(f"\n📄 Respaldo guardado en: {backup_file}")

# 6. Confirmar
print(f"\n⚠️ CONFIRMACIÓN:")
print(f"   Rutas pendientes: {len(routes_to_calculate)}")
print(f"   Costo estimado: ${len(routes_to_calculate) * 0.005:.2f} USD")
print(f"   Tiempo estimado: {len(routes_to_calculate) * 0.3:.0f} segundos ({len(routes_to_calculate) * 0.3 / 60:.1f} minutos)")
print("\n✅ Iniciando cálculo en 3 segundos...")
time.sleep(3)

# 7. Procesamiento batch optimizado
print("\n🚀 PROCESANDO RUTAS...")

# Archivo de log
log_file = f"/Users/yeison/Documents/GitHub/OpMap/output/batch_log_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"

calculated = 0
saved = 0
errors = 0
start_time = time.time()

def save_batch_to_database(batch_data):
    """Guardar un lote de rutas en la base de datos"""
    success_count = 0
    try:
        # Insertar en lote
        result = supabase.table('hospital_kam_distances').insert(batch_data).execute()
        if result.data:
            success_count = len(result.data)
    except Exception as e:
        # Si falla el lote, intentar uno por uno
        for route in batch_data:
            try:
                # Verificar que no exista
                existing = supabase.table('hospital_kam_distances').select('id').eq(
                    'hospital_id', route['hospital_id']
                ).eq('kam_id', route['kam_id']).execute()
                
                if not existing.data:
                    result = supabase.table('hospital_kam_distances').insert(route).execute()
                    if result.data:
                        success_count += 1
            except Exception as e2:
                with open(log_file, 'a') as f:
                    f.write(f"Error individual: {str(e2)[:100]}\n")
    
    return success_count

# Procesar en bloques
batch_size = 25  # Google permite hasta 25 origenes/destinos
save_batch_size = 50  # Guardar en BD cada 50 registros

routes_to_save = []

for i in range(0, len(routes_to_calculate), batch_size):
    batch = routes_to_calculate[i:i+batch_size]
    batch_num = i//batch_size + 1
    total_batches = (len(routes_to_calculate)//batch_size) + 1
    
    print(f"\n📍 Batch {batch_num}/{total_batches} ({len(batch)} rutas)")
    
    # Procesar cada ruta del batch
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
                    
                    # Convertir
                    travel_time_minutes = int(duration_seconds / 60)
                    distance_km = round(distance_meters / 1000, 2)
                    
                    # Agregar a batch para guardar
                    routes_to_save.append({
                        'hospital_id': route['hospital_id'],
                        'kam_id': route['kam_id'],
                        'travel_time': travel_time_minutes,
                        'distance': distance_km,
                        'source': 'google_maps',
                        'calculated_at': datetime.now().isoformat()
                    })
                    
                    calculated += 1
                    print(f"   ✓ {route['kam_name'][:20]} → {route['hospital_name'][:30]}: {travel_time_minutes} min")
                else:
                    errors += 1
                    print(f"   ✗ Sin ruta: {route['kam_name'][:20]} → {route['hospital_name'][:30]}")
            
            # Rate limiting
            time.sleep(0.2)  # 5 llamadas por segundo máximo
            
        except Exception as e:
            errors += 1
            print(f"   ✗ Error: {str(e)[:50]}")
            with open(log_file, 'a') as f:
                f.write(f"Error en ruta: {route} - {str(e)}\n")
    
    # Guardar lote en BD si es necesario
    if len(routes_to_save) >= save_batch_size:
        print(f"\n💾 Guardando {len(routes_to_save)} rutas en BD...")
        saved_count = save_batch_to_database(routes_to_save)
        saved += saved_count
        print(f"   Guardadas: {saved_count}")
        routes_to_save = []
    
    # Progreso general
    elapsed = time.time() - start_time
    rate = calculated / elapsed if elapsed > 0 else 0
    remaining_time = (len(routes_to_calculate) - calculated) / rate if rate > 0 else 0
    
    print(f"\n📊 Progreso: {calculated}/{len(routes_to_calculate)} ({calculated*100/len(routes_to_calculate):.1f}%)")
    print(f"   Velocidad: {rate:.1f} rutas/seg")
    print(f"   Tiempo restante: {remaining_time/60:.1f} minutos")
    print(f"   Guardadas: {saved}, Errores: {errors}")

# Guardar últimas rutas pendientes
if routes_to_save:
    print(f"\n💾 Guardando últimas {len(routes_to_save)} rutas...")
    saved_count = save_batch_to_database(routes_to_save)
    saved += saved_count

# 8. Resumen final
elapsed_total = time.time() - start_time
print("\n" + "="*60)
print("📊 RESUMEN FINAL")
print("="*60)
print(f"Tiempo total: {elapsed_total/60:.1f} minutos")
print(f"Rutas calculadas: {calculated}")
print(f"Rutas guardadas: {saved}")
print(f"Errores: {errors}")
print(f"Costo real: ${calculated * 0.005:.2f} USD")

# 9. Verificar nuevo estado
new_count = supabase.table('hospital_kam_distances').select('id', count='exact').execute()
print(f"\n📊 ESTADO FINAL:")
print(f"   Distancias iniciales: {current_count.count}")
print(f"   Distancias finales: {new_count.count}")
print(f"   Nuevas distancias agregadas: {new_count.count - current_count.count}")

print(f"\n📄 Archivos generados:")
print(f"   - Respaldo: {backup_file}")
print(f"   - Log: {log_file}")

print("="*60)