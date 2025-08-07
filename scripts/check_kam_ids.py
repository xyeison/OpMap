#!/usr/bin/env python3
"""
Verificar los IDs reales de los KAMs en la base de datos
"""
from supabase import create_client

supabase_url = 'https://norvxqgohddgsdkggqzq.supabase.co'
supabase_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vcnZ4cWdvaGRkZ3Nka2dncXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMDExMjUsImV4cCI6MjA2ODc3NzEyNX0.BRWIYeD_5OlpVKIrP1QzUmkSx6HEVGzcEUUiSK8CmJs'

supabase = create_client(supabase_url, supabase_key)

print("🔍 IDs DE KAMs EN LA BASE DE DATOS")
print("="*60)

kams = supabase.table('kams').select('id, name, color').execute()

if kams.data:
    print("\nMapeo para usar en el frontend:")
    print("-"*40)
    print("const KAM_COLOR_MAPPING: Record<string, string> = {")
    
    for kam in kams.data:
        # Imprimir en formato JavaScript
        print(f"  '{kam['id']}': '{kam['color']}',  // {kam['name']}")
    
    print("}")

print("\n" + "="*60)