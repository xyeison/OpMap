#!/usr/bin/env python3
"""
Ejecutar recálculo de asignaciones usando regla de mayoría por CAMAS
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from supabase import create_client
import time
from datetime import datetime

# Configuración de Supabase
supabase_url = 'https://norvxqgohddgsdkggqzq.supabase.co'
supabase_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vcnZ4cWdvaGRkZ3Nka2dncXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMDExMjUsImV4cCI6MjA2ODc3NzEyNX0.BRWIYeD_5OlpVKIrP1QzUmkSx6HEVGzcEUUiSK8CmJs'

supabase = create_client(supabase_url, supabase_key)

class SimplifiedOpMapAlgorithm:
    def __init__(self):
        self.kams = []
        self.hospitals = []
        self.excluded_departments = []
        self.distances = []
        self.adjacency_matrix = {}
    
    def load_data(self):
        print('🔄 Cargando datos...')
        
        # 1. Cargar departamentos excluidos
        result = supabase.table('departments').select('code').eq('excluded', True).execute()
        self.excluded_departments = [d['code'] for d in result.data] if result.data else []
        print(f'✅ {len(self.excluded_departments)} departamentos excluidos')
        
        # 2. Cargar KAMs activos
        result = supabase.table('kams').select('*').eq('active', True).execute()
        self.kams = result.data if result.data else []
        print(f'✅ {len(self.kams)} KAMs activos')
        
        # 3. Cargar hospitales activos
        result = supabase.table('hospitals').select('*').eq('active', True).execute()
        self.hospitals = result.data if result.data else []
        print(f'✅ {len(self.hospitals)} hospitales activos')
        
        # 4. Cargar matriz de adyacencia
        result = supabase.table('department_adjacency').select('*').execute()
        if result.data:
            for adj in result.data:
                if adj['department_code'] not in self.adjacency_matrix:
                    self.adjacency_matrix[adj['department_code']] = []
                self.adjacency_matrix[adj['department_code']].append(adj['adjacent_department_code'])
        print(f'✅ Matriz de adyacencia cargada')
        
        # 5. Cargar TODAS las distancias precalculadas
        print('📊 Cargando distancias precalculadas...')
        self.distances = []
        
        offset = 0
        batch_size = 1000
        
        while True:
            result = supabase.table('hospital_kam_distances').select('hospital_id, kam_id, travel_time').range(offset, offset + batch_size - 1).execute()
            
            if result.data and len(result.data) > 0:
                self.distances.extend(result.data)
                print(f'  Cargadas {len(self.distances)} distancias...')
                offset += batch_size
                
                if len(result.data) < batch_size:
                    break
            else:
                break
        
        print(f'✅ {len(self.distances)} distancias cargadas')
    
    def can_kam_compete_for_hospital(self, kam, hospital):
        # Si es territorio base, siempre puede
        if self.is_base_territory(kam, hospital):
            return True
        
        kam_dept = kam['area_id'][:2]
        hospital_dept = hospital['department_id']
        
        # Mismo departamento
        if kam_dept == hospital_dept:
            return True
        
        # Departamento adyacente (Nivel 1)
        if kam_dept in self.adjacency_matrix and hospital_dept in self.adjacency_matrix[kam_dept]:
            return True
        
        # Nivel 2 (si está habilitado)
        if kam.get('enable_level2', False):
            level1_deps = self.adjacency_matrix.get(kam_dept, [])
            for dept in level1_deps:
                if dept in self.adjacency_matrix and hospital_dept in self.adjacency_matrix[dept]:
                    return True
        
        # Regla especial para Bogotá
        if self.is_bogota_kam(kam):
            # KAMs de Bogotá pueden competir en Bogotá y Cundinamarca
            if hospital_dept in ['11', '25']:
                return True
            # Y departamentos adyacentes a Cundinamarca
            if '25' in self.adjacency_matrix and hospital_dept in self.adjacency_matrix['25']:
                return True
            # Y nivel 2 desde Cundinamarca si está habilitado
            if kam.get('enable_level2', False):
                cund_adjacent = self.adjacency_matrix.get('25', [])
                for dept in cund_adjacent:
                    if dept in self.adjacency_matrix and hospital_dept in self.adjacency_matrix[dept]:
                        return True
        
        return False
    
    def is_base_territory(self, kam, hospital):
        # Para localidades de Bogotá
        if kam['area_id'].startswith('11001') and len(kam['area_id']) > 5:
            return hospital.get('locality_id') == kam['area_id']
        # Para municipios regulares
        return hospital['municipality_id'] == kam['area_id']
    
    def is_bogota_kam(self, kam):
        return kam['area_id'].startswith('11001') and len(kam['area_id']) > 5
    
    def is_bogota_hospital(self, hospital):
        locality_id = hospital.get('locality_id', '')
        return locality_id and locality_id.startswith('11001')
    
    def get_distance(self, hospital_id, kam_id):
        for d in self.distances:
            if d['hospital_id'] == hospital_id and d['kam_id'] == kam_id:
                return d['travel_time']
        return None
    
    def calculate_assignments(self):
        print('\n🚀 INICIANDO ALGORITMO SIMPLIFICADO')
        print('=' * 60)
        start_time = time.time()
        
        assignments = []
        assigned_hospitals = set()
        
        # FASE 1: Asignar territorios base
        print('\n📍 FASE 1: Asignando territorios base...')
        
        for kam in self.kams:
            base_hospitals = [h for h in self.hospitals if self.is_base_territory(kam, h)]
            
            for hospital in base_hospitals:
                assignments.append({
                    'kam_id': kam['id'],
                    'hospital_id': hospital['id'],
                    'travel_time': 0,  # Territorio base = 0 segundos
                    'assignment_type': 'base_territory',
                    'is_base_territory': True
                })
                assigned_hospitals.add(hospital['id'])
            
            if base_hospitals:
                print(f"  ✓ {kam['name']}: {len(base_hospitals)} hospitales en territorio base")
        
        # FASE 2: Asignación competitiva
        print('\n🏥 FASE 2: Asignación competitiva...')
        print(f"  Tiempo transcurrido: {time.time() - start_time:.1f}s")
        
        # Filtrar hospitales sin asignar y que NO estén en departamentos excluidos
        unassigned_hospitals = [h for h in self.hospitals 
                               if h['id'] not in assigned_hospitals 
                               and h['department_id'] not in self.excluded_departments]
        print(f"  Hospitales por asignar: {len(unassigned_hospitals)}")
        excluded_count = len([h for h in self.hospitals if h['department_id'] in self.excluded_departments])
        print(f"  (Excluidos {excluded_count} hospitales en departamentos remotos)")
        
        processed_count = 0
        for hospital in unassigned_hospitals:
            processed_count += 1
            if processed_count % 50 == 0:
                print(f"  Procesados {processed_count}/{len(unassigned_hospitals)} hospitales...")
            
            best_kam = None
            best_time = float('inf')
            
            # Solo KAMs de Bogotá pueden competir por hospitales en Bogotá
            if self.is_bogota_hospital(hospital):
                eligible_kams = [k for k in self.kams if self.is_bogota_kam(k)]
            else:
                eligible_kams = self.kams
            
            for kam in eligible_kams:
                # Verificar restricciones geográficas
                if not self.can_kam_compete_for_hospital(kam, hospital):
                    continue
                
                # Obtener tiempo de viaje desde la tabla
                travel_time = self.get_distance(hospital['id'], kam['id'])
                
                if travel_time is not None:
                    time_in_minutes = travel_time / 60
                    
                    # Verificar límite de tiempo del KAM
                    if time_in_minutes <= kam['max_travel_time']:
                        # En caso de empate, usar prioridad
                        if travel_time < best_time or \
                           (travel_time == best_time and kam['priority'] > (best_kam['priority'] if best_kam else 0)):
                            best_time = travel_time
                            best_kam = kam
            
            if best_kam and best_time < float('inf'):
                assignments.append({
                    'kam_id': best_kam['id'],
                    'hospital_id': hospital['id'],
                    'travel_time': best_time,  # En SEGUNDOS
                    'assignment_type': 'competitive',
                    'is_base_territory': False
                })
                assigned_hospitals.add(hospital['id'])
                if processed_count <= 5 or processed_count % 50 == 0:
                    print(f"  ✓ {hospital['name']} → {best_kam['name']} ({int(best_time/60)} min)")
            else:
                print(f"  ❌ {hospital['name']} - Sin KAM disponible")
        
        # FASE 3: Regla de mayoría por CAMAS en localidades de Bogotá
        print('\n🏘️ FASE 3: Aplicando regla de mayoría por CAMAS en localidades...')
        print(f"  Tiempo transcurrido: {time.time() - start_time:.1f}s")
        
        # Cambio: usar número de CAMAS en lugar de número de hospitales
        locality_beds = {}
        
        # Contar CAMAS por localidad y KAM
        for assignment in assignments:
            hospital = next((h for h in self.hospitals if h['id'] == assignment['hospital_id']), None)
            if hospital and hospital.get('locality_id') and hospital['locality_id'].startswith('11001'):
                if hospital['locality_id'] not in locality_beds:
                    locality_beds[hospital['locality_id']] = {}
                
                # Sumar CAMAS del hospital al KAM
                beds = hospital.get('beds', 0) or 0
                kam_id = assignment['kam_id']
                if kam_id not in locality_beds[hospital['locality_id']]:
                    locality_beds[hospital['locality_id']][kam_id] = 0
                locality_beds[hospital['locality_id']][kam_id] += beds
        
        # Aplicar regla de mayoría basada en CAMAS
        for locality_id, kam_bed_counts in locality_beds.items():
            if len(kam_bed_counts) > 1:
                # Encontrar KAM con más CAMAS (no hospitales)
                winner = max(kam_bed_counts, key=kam_bed_counts.get)
                
                winner_kam = next((k for k in self.kams if k['id'] == winner), None)
                winner_beds = kam_bed_counts[winner]
                total_beds = sum(kam_bed_counts.values())
                print(f"  Localidad {locality_id}: {winner_kam['name'] if winner_kam else 'Unknown'} gana con {winner_beds} de {total_beds} camas")
                
                # Reasignar todos los hospitales de la localidad al ganador
                for i, assignment in enumerate(assignments):
                    hospital = next((h for h in self.hospitals if h['id'] == assignment['hospital_id']), None)
                    if hospital and hospital.get('locality_id') == locality_id and assignment['kam_id'] != winner:
                        new_time = self.get_distance(hospital['id'], winner) or 0
                        assignments[i] = {
                            **assignment,
                            'kam_id': winner,
                            'travel_time': new_time,
                            'assignment_type': 'majority_rule'
                        }
        
        # Estadísticas finales
        print('\n📊 ESTADÍSTICAS FINALES:')
        print('=' * 60)
        print(f'⏱️ Tiempo total de cálculo: {time.time() - start_time:.1f}s')
        print(f'Total hospitales activos: {len(self.hospitals)}')
        print(f'Total asignaciones: {len(assignments)}')
        print(f'Hospitales sin asignar: {len(self.hospitals) - len(assignments)}')
        
        # Resumen por KAM
        kam_summary = {}
        for a in assignments:
            kam_summary[a['kam_id']] = kam_summary.get(a['kam_id'], 0) + 1
        
        print('\n📈 Asignaciones por KAM:')
        for kam_id, count in sorted(kam_summary.items(), key=lambda x: x[1], reverse=True):
            kam = next((k for k in self.kams if k['id'] == kam_id), None)
            if kam:
                print(f"  {kam['name']}: {count} hospitales")
        
        return assignments
    
    def save_assignments(self, assignments):
        print('\n💾 Guardando asignaciones...')
        
        # Limpiar asignaciones anteriores
        supabase.table('assignments').delete().neq('id', '00000000-0000-0000-0000-000000000000').execute()
        
        # Insertar nuevas asignaciones en lotes
        batch_size = 500
        for i in range(0, len(assignments), batch_size):
            batch = assignments[i:i + batch_size]
            result = supabase.table('assignments').insert(batch).execute()
            
            if not result.data:
                print(f'❌ Error en lote {i//batch_size + 1}')
                raise Exception('Error guardando asignaciones')
        
        print(f'✅ {len(assignments)} asignaciones guardadas')

def main():
    print(f"\n🎯 RECÁLCULO DE ASIGNACIONES - REGLA DE MAYORÍA POR CAMAS")
    print(f"Inicio: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    
    algorithm = SimplifiedOpMapAlgorithm()
    
    try:
        algorithm.load_data()
        assignments = algorithm.calculate_assignments()
        algorithm.save_assignments(assignments)
        
        print(f"\n✅ PROCESO COMPLETADO EXITOSAMENTE")
        print(f"Fin: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        return 0
        
    except Exception as e:
        print(f'\n❌ Error ejecutando algoritmo: {e}')
        import traceback
        traceback.print_exc()
        return 1

if __name__ == '__main__':
    exit(main())