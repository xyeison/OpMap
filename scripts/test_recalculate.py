#!/usr/bin/env python3
"""
Test del endpoint de recalcular asignaciones
"""
import requests
import json

# URL del endpoint (ajustar si es necesario)
url = "http://localhost:3000/api/recalculate-assignments"

print("🚀 Probando endpoint de recalcular asignaciones...")
print("="*60)

try:
    # Hacer POST request
    response = requests.post(url, timeout=300)
    
    if response.status_code == 200:
        data = response.json()
        print("✅ Respuesta exitosa:")
        print(json.dumps(data, indent=2))
    else:
        print(f"❌ Error: Status code {response.status_code}")
        print(response.text)
        
except requests.exceptions.ConnectionError:
    print("❌ Error de conexión. Asegúrate de que el servidor Next.js esté corriendo en localhost:3000")
    print("   Ejecuta: cd web && npm run dev")
except requests.exceptions.Timeout:
    print("⏱️ Timeout - el cálculo está tardando más de 5 minutos")
except Exception as e:
    print(f"❌ Error: {e}")