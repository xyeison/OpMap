#!/usr/bin/env python3
"""
Calcular las rutas faltantes usando Google Maps Distance Matrix API
Guardar directamente en hospital_kam_distances
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

print("🚀 CALCULADOR DE RUTAS FALTANTES CON GOOGLE MAPS")
print("="*60)

# 1. Cargar configuración y datos necesarios
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

# Hospitales sin distancias
hospitals = supabase.table('hospitals').select('*').eq('active', True).execute()
distances = supabase.table('hospital_kam_distances').select('hospital_id, kam_id').execute()
existing_pairs = set((d['hospital_id'], d['kam_id']) for d in distances.data)

hospitals_sin_distancias = []
for h in hospitals.data:
    if h['department_id'] in excluded_set:
        continue
    if not any(h['id'] == pair[0] for pair in existing_pairs):
        hospitals_sin_distancias.append(h)

print(f"   Hospitales sin distancias: {len(hospitals_sin_distancias)}")

# 2. Función para determinar KAMs competidores
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

# 3. Preparar rutas a calcular
print("\n🎯 Preparando rutas a calcular...")

routes_to_calculate = []
for hospital in hospitals_sin_distancias:
    kam_local, competing_kams = get_competing_kams(hospital, kams.data, adj_matrix, kams_by_area)
    
    for kam in competing_kams:
        # Verificar que no exista ya
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

print(f"   Total rutas a calcular: {len(routes_to_calculate)}")

# Crear archivo de respaldo
backup_file = f"/Users/yeison/Documents/GitHub/OpMap/output/routes_calculation_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
with open(backup_file, 'w') as f:
    json.dump({
        'total_routes': len(routes_to_calculate),
        'routes': routes_to_calculate[:100]  # Guardar primeras 100 como muestra
    }, f, indent=2)
print(f"   Respaldo guardado en: {backup_file}")

# 4. Confirmar antes de proceder
print(f"\n⚠️ CONFIRMACIÓN:")
print(f"   Rutas a calcular: {len(routes_to_calculate)}")
print(f"   Costo estimado: ${len(routes_to_calculate) * 0.005:.2f} USD")
print(f"   Tiempo estimado: {len(routes_to_calculate) * 0.5:.0f} segundos")

# Proceder automáticamente en modo batch
print("\n✅ Procediendo automáticamente (modo batch)...")

# 5. Calcular rutas en lotes
print("\n🚀 INICIANDO CÁLCULO DE RUTAS...")

batch_size = 10  # Google permite hasta 25, pero usamos 10 para ser conservadores
calculated = 0
errors = 0
saved = 0

# Archivo de log
log_file = f"/Users/yeison/Documents/GitHub/OpMap/output/calculation_log_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"

def save_to_database(route_data):
    """Guardar ruta en hospital_kam_distances"""
    try:
        # Verificar que no exista
        existing = supabase.table('hospital_kam_distances').select('id').eq(
            'hospital_id', route_data['hospital_id']
        ).eq('kam_id', route_data['kam_id']).execute()
        
        if not existing.data:
            result = supabase.table('hospital_kam_distances').insert({
                'hospital_id': route_data['hospital_id'],
                'kam_id': route_data['kam_id'],
                'travel_time': route_data['travel_time'],
                'distance': route_data['distance'],
                'source': 'google_maps',
                'calculated_at': datetime.now().isoformat()
            }).execute()
            
            if result.data:
                return True
    except Exception as e:
        with open(log_file, 'a') as f:
            f.write(f"Error guardando: {str(e)}\n")
    return False

# Procesar en lotes
for i in range(0, len(routes_to_calculate), batch_size):
    batch = routes_to_calculate[i:i+batch_size]
    
    print(f"\n📍 Procesando batch {i//batch_size + 1}/{(len(routes_to_calculate)//batch_size)+1}")
    
    # Preparar origenes y destinos para el batch
    origins = [(r['kam_lat'], r['kam_lng']) for r in batch]
    destinations = [(r['hospital_lat'], r['hospital_lng']) for r in batch]
    
    try:
        # Llamar a Google Maps Distance Matrix
        for j, route in enumerate(batch):
            origin = (route['kam_lat'], route['kam_lng'])
            destination = (route['hospital_lat'], route['hospital_lng'])
            
            try:
                result = gmaps.distance_matrix(
                    origins=[origin],
                    destinations=[destination],
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
                        
                        # Convertir a minutos y kilómetros
                        travel_time_minutes = int(duration_seconds / 60)
                        distance_km = round(distance_meters / 1000, 2)
                        
                        # Guardar en base de datos
                        route_data = {
                            'hospital_id': route['hospital_id'],
                            'kam_id': route['kam_id'],
                            'travel_time': travel_time_minutes,
                            'distance': distance_km
                        }
                        
                        if save_to_database(route_data):
                            saved += 1
                            print(f"   ✅ {route['kam_name']} → {route['hospital_name']}: {travel_time_minutes} min")
                        
                        calculated += 1
                    else:
                        errors += 1
                        print(f"   ❌ Sin ruta: {route['kam_name']} → {route['hospital_name']}")
                        with open(log_file, 'a') as f:
                            f.write(f"Sin ruta: {route}\n")
                
                # Esperar entre llamadas para respetar rate limits
                time.sleep(0.5)
                
            except Exception as e:
                errors += 1
                print(f"   ❌ Error: {str(e)[:50]}")
                with open(log_file, 'a') as f:
                    f.write(f"Error: {str(e)} - Route: {route}\n")
    
    except Exception as e:
        print(f"   ❌ Error en batch: {str(e)}")
        errors += len(batch)
    
    # Mostrar progreso
    print(f"   Progreso: {calculated}/{len(routes_to_calculate)} ({calculated*100/len(routes_to_calculate):.1f}%)")
    print(f"   Guardadas: {saved}, Errores: {errors}")
    
    # Continuar sin límite para calcular todas las rutas
    # (Comentado el límite de prueba)

# 6. Resumen final
print("\n" + "="*60)
print("📊 RESUMEN FINAL")
print("="*60)
print(f"Rutas calculadas: {calculated}")
print(f"Rutas guardadas: {saved}")
print(f"Errores: {errors}")
print(f"Costo real: ${calculated * 0.005:.2f} USD")
print()
print(f"📄 Archivos generados:")
print(f"   - Respaldo: {backup_file}")
print(f"   - Log: {log_file}")

# 7. Verificar nuevo estado
new_distances = supabase.table('hospital_kam_distances').select('id', count='exact').execute()
print(f"\n📊 Estado actual:")
print(f"   Total distancias en base de datos: {new_distances.count}")

print("="*60)