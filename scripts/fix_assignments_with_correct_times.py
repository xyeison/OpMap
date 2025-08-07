#!/usr/bin/env python3
"""
Corregir asignaciones usando los tiempos correctos de hospital_kam_distances
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

def main():
    print(f"\n🔧 CORRECCIÓN DE TIEMPOS EN ASIGNACIONES")
    print(f"Inicio: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    
    # 1. Obtener todas las asignaciones actuales
    print("\n📊 Cargando asignaciones actuales...")
    assignments = supabase.table('assignments').select('*').execute()
    
    if not assignments.data:
        print("No hay asignaciones para corregir")
        return 1
    
    print(f"Total asignaciones: {len(assignments.data)}")
    
    # 2. Verificar y corregir tiempos
    print("\n🔍 Verificando tiempos...")
    corrections_needed = []
    errors_found = 0
    
    for assignment in assignments.data:
        hospital_id = assignment['hospital_id']
        kam_id = assignment['kam_id']
        current_time = assignment['travel_time']
        
        # Buscar el tiempo correcto en hospital_kam_distances
        correct_time_result = supabase.table('hospital_kam_distances').select('travel_time').eq('hospital_id', hospital_id).eq('kam_id', kam_id).execute()
        
        if correct_time_result.data:
            correct_time = correct_time_result.data[0]['travel_time']
            
            # Si el tiempo es diferente, necesita corrección
            if current_time != correct_time:
                corrections_needed.append({
                    'id': assignment['id'],
                    'hospital_id': hospital_id,
                    'kam_id': kam_id,
                    'current_time': current_time,
                    'correct_time': correct_time
                })
                errors_found += 1
                
                if errors_found <= 5:  # Mostrar primeros 5 errores
                    print(f"  ❌ Error encontrado:")
                    print(f"     Hospital: {hospital_id[:8]}...")
                    print(f"     Tiempo actual: {current_time} segundos ({current_time/60:.1f} min)")
                    print(f"     Tiempo correcto: {correct_time} segundos ({correct_time/60:.1f} min)")
        else:
            # Si es territorio base (travel_time = 0), está bien
            if current_time != 0:
                print(f"  ⚠️ Sin tiempo en hospital_kam_distances para {hospital_id[:8]}... con KAM {kam_id[:8]}...")
    
    print(f"\n📈 Resumen:")
    print(f"  Total asignaciones: {len(assignments.data)}")
    print(f"  Errores encontrados: {errors_found}")
    print(f"  Porcentaje con error: {(errors_found/len(assignments.data)*100):.1f}%")
    
    if corrections_needed:
        print(f"\n🔧 Corrigiendo {len(corrections_needed)} asignaciones...")
        
        # Corregir en lotes
        batch_size = 100
        for i in range(0, len(corrections_needed), batch_size):
            batch = corrections_needed[i:i + batch_size]
            
            for correction in batch:
                result = supabase.table('assignments').update({
                    'travel_time': correction['correct_time']
                }).eq('id', correction['id']).execute()
                
                if not result.data:
                    print(f"  Error actualizando {correction['id']}")
            
            print(f"  Procesados {min(i + batch_size, len(corrections_needed))}/{len(corrections_needed)}")
        
        print(f"\n✅ {len(corrections_needed)} asignaciones corregidas")
    else:
        print("\n✅ No se encontraron errores en los tiempos")
    
    print(f"\nFin: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    return 0

if __name__ == '__main__':
    exit(main())