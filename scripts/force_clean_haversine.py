#!/usr/bin/env python3
"""
Forzar eliminación de TODAS las estimaciones haversine
"""

import os
from dotenv import load_dotenv
from supabase import create_client

# Cargar variables de entorno
load_dotenv()

# Configurar Supabase
url = os.getenv('SUPABASE_URL')
key = os.getenv('SUPABASE_ANON_KEY')
supabase = create_client(url, key)

print("🔥 ELIMINACIÓN FORZADA DE HAVERSINE\n")

# 1. Contar todos los registros
print("1. Contando registros en travel_time_cache...")
total = supabase.from_('travel_time_cache').select('id', count='exact').execute()
print(f"   Total de registros: {total.count}")

# 2. Contar haversine_estimate
haversine = supabase.from_('travel_time_cache').select('id', count='exact').eq('source', 'haversine_estimate').execute()
print(f"   Registros haversine_estimate: {haversine.count}")

# 3. Contar google_maps
google = supabase.from_('travel_time_cache').select('id', count='exact').eq('source', 'google_maps').execute()
print(f"   Registros google_maps: {google.count}")

# 4. ELIMINAR TODOS LOS HAVERSINE
if haversine.count > 0:
    print(f"\n2. Eliminando {haversine.count} registros haversine_estimate...")
    
    # Eliminar TODOS de una vez
    result = supabase.from_('travel_time_cache').delete().eq('source', 'haversine_estimate').execute()
    
    print("   ✅ Eliminación completada")
    
    # Verificar
    remaining = supabase.from_('travel_time_cache').select('id', count='exact').eq('source', 'haversine_estimate').execute()
    if remaining.count == 0:
        print("   ✅ CONFIRMADO: No quedan registros haversine_estimate")
    else:
        print(f"   ⚠️ ADVERTENCIA: Aún quedan {remaining.count} registros haversine")
else:
    print("\n✅ No hay registros haversine_estimate para eliminar")

# 5. Mostrar estado final
print("\n3. Estado final:")
total_final = supabase.from_('travel_time_cache').select('id', count='exact').execute()
google_final = supabase.from_('travel_time_cache').select('id', count='exact').eq('source', 'google_maps').execute()

print(f"   Total de registros: {total_final.count}")
print(f"   Registros google_maps: {google_final.count}")
print(f"   Registros eliminados: {total.count - total_final.count}")

# 6. Verificar algunas rutas sospechosas
print("\n4. Verificando rutas con tiempos sospechosos (<5 minutos)...")
suspicious = supabase.from_('travel_time_cache').select('*').lt('travel_time', 300).limit(5).execute()

if suspicious.data:
    print(f"   ⚠️ Encontradas {len(suspicious.data)} rutas con menos de 5 minutos:")
    for route in suspicious.data:
        minutes = route['travel_time'] / 60
        print(f"      - {minutes:.1f} min, source: {route['source']}")
        
print("\n✅ Proceso completado")
print("💡 Ahora ejecute el recálculo desde la interfaz web")