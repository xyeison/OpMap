#!/usr/bin/env python3
"""
Script para debuggear por qué Cartagena KAM no está recibiendo hospitales asignados
"""

import os
import json
from supabase import create_client, Client

# Conectar con Supabase usando las credenciales del proyecto
url = "https://norvxqgohddgsdkggqzq.supabase.co"
key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vcnZ4cWdvaGRkZ3Nka2dncXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMDExMjUsImV4cCI6MjA2ODc3NzEyNX0.BRWIYeD_5OlpVKIrP1QzUmkSx6HEVGzcEUUiSK8CmJs"

supabase: Client = create_client(url, key)

def debug_cartagena():
    """Investigar el problema de asignación de Cartagena"""
    
    print("🔍 Investigando asignaciones de Cartagena...\n")
    
    # 1. Buscar información del KAM de Cartagena
    print("1️⃣ Buscando información del KAM de Cartagena:")
    try:
        response = supabase.table('kams').select("*").eq('name', 'KAM Cartagena').execute()
        
        if response.data and len(response.data) > 0:
            cartagena_kam = response.data[0]
            print(f"✅ KAM encontrado:")
            print(f"   - ID: {cartagena_kam['id']}")
            print(f"   - Nombre: {cartagena_kam['name']}")
            print(f"   - Area ID: {cartagena_kam['area_id']}")
            print(f"   - Lat/Lng: {cartagena_kam['lat']}, {cartagena_kam['lng']}")
            print(f"   - Max Travel Time: {cartagena_kam['max_travel_time']} minutos")
            print(f"   - Enable Level 2: {cartagena_kam['enable_level2']}")
            print(f"   - Priority: {cartagena_kam['priority']}")
            print(f"   - Activo: {cartagena_kam.get('active', 'Campo no encontrado')}")
            
            kam_id = cartagena_kam['id']
            area_id = cartagena_kam['area_id']
        else:
            print("❌ No se encontró el KAM de Cartagena")
            return
    except Exception as e:
        print(f"❌ Error buscando KAM: {e}")
        return
    
    print("\n" + "="*60 + "\n")
    
    # 2. Buscar hospitales en el municipio de Cartagena
    print(f"2️⃣ Buscando hospitales en el municipio {area_id}:")
    try:
        response = supabase.table('hospitals').select("*").eq('municipality_id', area_id).execute()
        
        if response.data:
            print(f"✅ Encontrados {len(response.data)} hospitales en Cartagena:")
            for i, hospital in enumerate(response.data[:5]):  # Mostrar solo los primeros 5
                print(f"   {i+1}. {hospital['name']} (Código: {hospital['code']})")
            if len(response.data) > 5:
                print(f"   ... y {len(response.data) - 5} más")
        else:
            print("❌ No se encontraron hospitales en Cartagena")
    except Exception as e:
        print(f"❌ Error buscando hospitales: {e}")
    
    print("\n" + "="*60 + "\n")
    
    # 3. Verificar asignaciones actuales
    print(f"3️⃣ Verificando asignaciones actuales del KAM de Cartagena (ID: {kam_id}):")
    try:
        response = supabase.table('assignments').select("*, hospitals(name, code)").eq('kam_id', kam_id).execute()
        
        if response.data:
            print(f"✅ Encontradas {len(response.data)} asignaciones:")
            for i, assignment in enumerate(response.data[:5]):
                hospital_info = assignment.get('hospitals', {})
                print(f"   {i+1}. {hospital_info.get('name', 'Sin nombre')} (Código: {hospital_info.get('code', 'N/A')})")
                print(f"      - Tipo: {assignment['assignment_type']}")
                print(f"      - Tiempo de viaje: {assignment['travel_time']} minutos")
        else:
            print("❌ No se encontraron asignaciones para este KAM")
    except Exception as e:
        print(f"❌ Error buscando asignaciones: {e}")
    
    print("\n" + "="*60 + "\n")
    
    # 4. Verificar si hay otros KAMs que pudieran estar compitiendo
    print("4️⃣ Buscando otros KAMs que podrían competir por Cartagena:")
    try:
        # Buscar KAMs en departamentos cercanos (Bolívar = 13)
        response = supabase.table('kams').select("*").execute()
        
        if response.data:
            bolivar_kams = [k for k in response.data if k['area_id'].startswith('13')]
            atlantico_kams = [k for k in response.data if k['area_id'].startswith('08')]  # Atlántico
            sucre_kams = [k for k in response.data if k['area_id'].startswith('70')]  # Sucre
            
            print(f"   - KAMs en Bolívar: {len(bolivar_kams)}")
            for kam in bolivar_kams:
                print(f"     • {kam['name']} (Area: {kam['area_id']})")
            
            print(f"   - KAMs en Atlántico: {len(atlantico_kams)}")
            for kam in atlantico_kams[:3]:  # Solo mostrar los primeros 3
                print(f"     • {kam['name']} (Area: {kam['area_id']})")
                
            print(f"   - KAMs en Sucre: {len(sucre_kams)}")
            for kam in sucre_kams[:3]:
                print(f"     • {kam['name']} (Area: {kam['area_id']})")
    except Exception as e:
        print(f"❌ Error buscando KAMs competidores: {e}")
    
    print("\n" + "="*60 + "\n")
    
    # 5. Verificar el departamento y municipio
    print("5️⃣ Verificando información del municipio:")
    try:
        response = supabase.table('municipalities').select("*").eq('code', area_id).execute()
        
        if response.data and len(response.data) > 0:
            muni = response.data[0]
            print(f"✅ Municipio encontrado:")
            print(f"   - Código: {muni['code']}")
            print(f"   - Nombre: {muni['name']}")
            print(f"   - Departamento: {muni['department_code']}")
            print(f"   - Población 2025: {muni['population_2025']:,}")
    except Exception as e:
        print(f"❌ Error buscando municipio: {e}")

if __name__ == "__main__":
    debug_cartagena()