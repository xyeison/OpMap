#!/usr/bin/env python3
"""
Script para ejecutar SQL en Supabase
"""

import os
from supabase import create_client, Client
from dotenv import load_dotenv
import sys

# Cargar variables de entorno
load_dotenv()

# Configuración de Supabase
url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")

if not url or not key:
    print("❌ Error: Falta SUPABASE_URL o SUPABASE_KEY en .env")
    sys.exit(1)

# Crear cliente
supabase: Client = create_client(url, key)

# Leer el archivo SQL
sql_file = "database/add_kam_participation_field.sql"
with open(sql_file, 'r', encoding='utf-8') as f:
    sql_content = f.read()

print(f"📄 Ejecutando SQL desde {sql_file}...")
print("=" * 50)

try:
    # Ejecutar el SQL usando RPC (necesitamos una función especial o usar la API REST directamente)
    # Como Supabase no permite ejecutar SQL arbitrario directamente, vamos a hacer las operaciones una por una
    
    # Primero verificar si la columna ya existe
    result = supabase.table('kams').select('*').limit(1).execute()
    
    # Si podemos acceder a los datos, verificar si la columna existe
    if result.data and len(result.data) > 0:
        first_kam = result.data[0]
        if 'participates_in_assignment' in first_kam:
            print("✅ La columna participates_in_assignment ya existe")
        else:
            print("❌ La columna participates_in_assignment NO existe aún")
            print("⚠️  Necesitas ejecutar el SQL directamente en Supabase Dashboard:")
            print("   1. Ve a https://supabase.com/dashboard")
            print("   2. Selecciona tu proyecto")
            print("   3. Ve a SQL Editor")
            print("   4. Pega y ejecuta el contenido de database/add_kam_participation_field.sql")
    else:
        print("⚠️  No hay KAMs en la base de datos para verificar")
        
except Exception as e:
    print(f"❌ Error: {e}")
    print("\n⚠️  Para ejecutar el SQL:")
    print("   1. Ve a https://supabase.com/dashboard")
    print("   2. Selecciona tu proyecto")
    print("   3. Ve a SQL Editor")
    print("   4. Pega y ejecuta el contenido de database/add_kam_participation_field.sql")