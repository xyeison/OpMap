#!/usr/bin/env python3
"""
Actualizar colores de KAMs en la base de datos para que coincidan con el mapeo del frontend
"""
from supabase import create_client

supabase_url = 'https://norvxqgohddgsdkggqzq.supabase.co'
supabase_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vcnZ4cWdvaGRkZ3Nka2dncXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMDExMjUsImV4cCI6MjA2ODc3NzEyNX0.BRWIYeD_5OlpVKIrP1QzUmkSx6HEVGzcEUUiSK8CmJs'

supabase = create_client(supabase_url, supabase_key)

# Mapeo de colores del frontend
KAM_COLOR_MAPPING = {
    'barranquilla': '#FF6B6B',  # Rojo coral
    'bucaramanga': '#4ECDC4',   # Turquesa
    'cali': '#45B7D1',          # Azul cielo
    'cartagena': '#96CEB4',     # Verde menta
    'cucuta': '#FECA57',        # Amarillo dorado
    'medellin': '#FF9FF3',      # Rosa
    'monteria': '#54A0FF',      # Azul brillante
    'neiva': '#8B4513',         # Marrón
    'pasto': '#1DD1A1',         # Verde esmeralda
    'pereira': '#FF7675',       # Rojo claro
    'sincelejo': '#A29BFE',     # Lavanda
    'chapinero': '#FD79A8',     # Rosa chicle
    'engativa': '#FDCB6E',      # Amarillo
    'sancristobal': '#6C5CE7',  # Púrpura
    'kennedy': '#00D2D3',       # Cian
    'valledupar': '#2ECC71'     # Verde
}

print("🎨 ACTUALIZACIÓN DE COLORES DE KAMs")
print("="*60)

# 1. Obtener todos los KAMs
kams = supabase.table('kams').select('*').execute()

if kams.data:
    print(f"\nTotal KAMs encontrados: {len(kams.data)}")
    print("\n" + "-"*40)
    
    for kam in kams.data:
        kam_id = kam['id']
        kam_name = kam['name']
        current_color = kam.get('color', 'Sin color')
        
        # Buscar el color correcto en el mapeo
        # El ID del KAM en la DB parece ser un UUID, pero necesitamos mapear por nombre
        # Convertir nombre a ID esperado (ej: "KAM Kennedy" -> "kennedy")
        kam_key = kam_name.replace('KAM ', '').lower().replace(' ', '').replace('á', 'a').replace('é', 'e').replace('í', 'i').replace('ó', 'o').replace('ú', 'u')
        
        # Caso especial para San Cristóbal
        if 'cristóbal' in kam_name.lower() or 'cristobal' in kam_name.lower():
            kam_key = 'sancristobal'
        
        new_color = KAM_COLOR_MAPPING.get(kam_key)
        
        if new_color:
            print(f"\n{kam_name}:")
            print(f"  Color actual: {current_color}")
            print(f"  Color nuevo:  {new_color}")
            
            if current_color != new_color:
                # Actualizar color
                result = supabase.table('kams').update({'color': new_color}).eq('id', kam_id).execute()
                if result.data:
                    print(f"  ✅ Color actualizado")
                else:
                    print(f"  ❌ Error actualizando")
            else:
                print(f"  ✓ Color ya correcto")
        else:
            print(f"\n{kam_name}:")
            print(f"  ⚠️ No se encontró mapeo para '{kam_key}'")
            print(f"  Color actual: {current_color}")

print("\n" + "="*60)
print("✅ Proceso completado")
print("\nNOTA: El frontend usa el ID del KAM para buscar el color")
print("Si los IDs en la DB son UUIDs, el frontend debería usar kam.id")
print("para buscar en kamColors, no el nombre transformado.")