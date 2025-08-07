#!/usr/bin/env python3
"""
Verificar hospitales específicos mencionados por el usuario
"""
from supabase import create_client

supabase_url = 'https://norvxqgohddgsdkggqzq.supabase.co'
supabase_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vcnZ4cWdvaGRkZ3Nka2dncXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMDExMjUsImV4cCI6MjA2ODc3NzEyNX0.BRWIYeD_5OlpVKIrP1QzUmkSx6HEVGzcEUUiSK8CmJs'

supabase = create_client(supabase_url, supabase_key)

print("🔍 VERIFICACIÓN DE HOSPITALES ESPECÍFICOS")
print("="*60)

# Hospitales mencionados por el usuario
hospital_codes = [
    '900958564-2',  # Estaba asignado a San Cristóbal, debería ser Kennedy
    '890701718-1'   # No tenía distancia con Pereira
]

for code in hospital_codes:
    print(f"\n📋 HOSPITAL: {code}")
    print("-"*40)
    
    # Buscar hospital
    hospital = supabase.table('hospitals').select('*').eq('code', code).single().execute()
    
    if hospital.data:
        h = hospital.data
        print(f"Nombre: {h['name']}")
        print(f"Municipio: {h['municipality_name']}")
        print(f"Departamento: {h['department_name']}")
        print(f"Coordenadas: ({h['lat']}, {h['lng']})")
        
        # Buscar asignación actual
        assignment = supabase.table('assignments').select('*, kams(name)').eq('hospital_id', h['id']).execute()
        
        if assignment.data and len(assignment.data) > 0:
            print(f"\n✅ ASIGNACIÓN ACTUAL:")
            print(f"  KAM: {assignment.data[0]['kams']['name']}")
            travel_time = assignment.data[0].get('travel_time')
            if travel_time is not None:
                print(f"  Tiempo: {travel_time} segundos")
                print(f"  En minutos: {travel_time/60:.1f} min")
            else:
                print(f"  Tiempo: No calculado")
            print(f"  Tipo: {assignment.data[0]['assignment_type']}")
        else:
            print("\n❌ Sin asignación")
        
        # Buscar todas las distancias disponibles
        distances = supabase.table('hospital_kam_distances').select('*, kams(name)').eq('hospital_id', h['id']).execute()
        
        if distances.data:
            print(f"\n📊 DISTANCIAS CALCULADAS ({len(distances.data)} KAMs):")
            # Ordenar por tiempo
            sorted_distances = sorted(distances.data, key=lambda x: x['travel_time'] if x['travel_time'] else 999999)
            
            for d in sorted_distances[:5]:  # Mostrar los 5 más cercanos
                time_sec = d['travel_time']
                time_min = time_sec / 60 if time_sec else 0
                print(f"  - {d['kams']['name']}: {time_sec} seg ({time_min:.1f} min)")
        else:
            print("\n❌ Sin distancias calculadas")
    else:
        print(f"❌ Hospital no encontrado")

print("\n" + "="*60)

# Verificar específicamente Puerto Boyacá
print("\n🏥 CASO ESPECIAL: PUERTO BOYACÁ")
print("-"*40)

puerto_boyaca = supabase.table('hospitals').select('*').ilike('municipality_name', '%puerto%boyac%').execute()

if puerto_boyaca.data:
    for h in puerto_boyaca.data:
        print(f"\nHospital: {h['name']}")
        print(f"Código: {h['code']}")
        
        # Buscar distancias
        distances = supabase.table('hospital_kam_distances').select('*, kams(name)').eq('hospital_id', h['id']).execute()
        
        if distances.data:
            print(f"Distancias disponibles:")
            sorted_distances = sorted(distances.data, key=lambda x: x['travel_time'] if x['travel_time'] else 999999)
            
            for d in sorted_distances[:3]:
                time_sec = d['travel_time']
                time_min = time_sec / 60 if time_sec else 0
                time_hrs = time_sec / 3600 if time_sec else 0
                
                if time_hrs > 1:
                    print(f"  - {d['kams']['name']}: {time_hrs:.1f} horas")
                else:
                    print(f"  - {d['kams']['name']}: {time_min:.0f} minutos")
                    
                # Verificar si el tiempo es razonable
                if time_min < 30:
                    print(f"    ⚠️ SOSPECHOSO: Muy corto para Puerto Boyacá")
        else:
            print("  Sin distancias calculadas")

print("\n" + "="*60)