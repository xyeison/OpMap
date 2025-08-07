#!/usr/bin/env python3
"""
Ejecutar migración a tabla hospital_kam_distances
"""
import os
import sys
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from supabase import create_client, Client

# Cargar variables de entorno
load_dotenv()

# URL correcta de Supabase
supabase_url = 'https://norvxqgohddgsdkggqzq.supabase.co'
supabase_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vcnZ4cWdvaGRkZ3Nka2dncXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMDExMjUsImV4cCI6MjA2ODc3NzEyNX0.BRWIYeD_5OlpVKIrP1QzUmkSx6HEVGzcEUUiSK8CmJs'

supabase: Client = create_client(supabase_url, supabase_key)

print("🚀 Ejecutando migración a hospital_kam_distances...")

# Leer y ejecutar el SQL
with open('database/03_maintenance/create_hospital_kam_distances.sql', 'r') as f:
    sql = f.read()

# Nota: Supabase Python client no soporta ejecutar SQL directamente
# Necesitamos hacerlo via API REST o usar la consola de Supabase

print("\n📋 Por favor ejecuta el siguiente SQL en el SQL Editor de Supabase:")
print("=" * 60)
print(sql)
print("=" * 60)
print("\n✅ Una vez ejecutado, la migración estará completa.")