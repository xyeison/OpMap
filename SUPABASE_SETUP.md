# Configuración de Supabase para OpMap

Este documento explica cómo configurar y usar Supabase como backend para OpMap, permitiendo que funcione tanto localmente como en Vercel.

## 🚀 Configuración Inicial

### 1. Configurar Variables de Entorno

Edita el archivo `.env` y agrega tus credenciales de Supabase:

```env
# Google Maps API (existente)
GOOGLE_MAPS_API_KEY=tu_api_key_aqui

# Supabase Configuration
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=tu_anon_key_aqui
```

Para obtener estas credenciales:
1. Ve a [https://app.supabase.io](https://app.supabase.io)
2. Selecciona tu proyecto
3. Ve a **Settings > API**
4. Copia:
   - **Project URL** → `SUPABASE_URL`
   - **anon public key** → `SUPABASE_ANON_KEY`

### 2. Instalar Dependencias

```bash
pip install supabase
```

### 3. Crear la Tabla en Supabase

Ejecuta este SQL en el SQL Editor de Supabase:

```sql
-- Crear tabla travel_time_cache si no existe
CREATE TABLE IF NOT EXISTS travel_time_cache (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    origin_lat numeric(10,6) NOT NULL,
    origin_lng numeric(10,6) NOT NULL,
    dest_lat numeric(10,6) NOT NULL,
    dest_lng numeric(10,6) NOT NULL,
    travel_time integer NOT NULL,
    distance numeric(10,2),
    source varchar(50) DEFAULT 'google_maps',
    calculated_at timestamp with time zone DEFAULT now(),
    UNIQUE(origin_lat, origin_lng, dest_lat, dest_lng)
);

-- Crear índices para mejorar el rendimiento
CREATE INDEX idx_travel_time_coords ON travel_time_cache(origin_lat, origin_lng, dest_lat, dest_lng);
CREATE INDEX idx_travel_time_source ON travel_time_cache(source);
```

## 📊 Migrar Datos Existentes

Si tienes un caché JSON existente, puedes migrarlo a Supabase:

```bash
python migrate_cache_to_supabase.py
```

Este script:
- Lee el archivo `data/cache/google_distance_matrix_cache.json`
- Migra todas las rutas a Supabase
- Evita duplicados
- Muestra un resumen del proceso

## 🔧 Nuevos Scripts Disponibles

### 1. `opmap_supabase.py`
Script principal que usa Supabase como backend:
- Lee tiempos de viaje desde Supabase
- Si no encuentra una ruta, la calcula con Google Maps
- Guarda nuevas rutas en Supabase automáticamente
- NO guarda cálculos Haversine (solo los usa temporalmente)

```bash
python opmap_supabase.py
```

### 2. `resume_supabase_calculations.py`
Script de solo lectura (ideal para producción):
- Solo lee datos existentes de Supabase
- NO hace llamadas a Google Maps API
- Carga todo el caché en memoria para mejor rendimiento
- Ideal para ejecutar análisis sin costos adicionales

```bash
python resume_supabase_calculations.py
```

## 🌐 Despliegue en Vercel

### 1. Configurar Variables de Entorno en Vercel

En tu proyecto de Vercel, ve a **Settings > Environment Variables** y agrega:

```
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=tu_anon_key_aqui
GOOGLE_MAPS_API_KEY=tu_api_key_aqui
```

### 2. Crear API Route

Crea un archivo `api/opmap.py` en tu proyecto:

```python
from http.server import BaseHTTPRequestHandler
import json
import os
import sys

# Importar los módulos de OpMap
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from src.utils.supabase_client import SupabaseClient
from src.algorithms.opmap_algorithm_bogota import BogotaOpMapAlgorithm

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            # Usar Supabase para obtener tiempos
            supabase = SupabaseClient()
            
            # Función para obtener tiempo desde caché
            def get_travel_time(origin_lat, origin_lng, dest_lat, dest_lng, max_time=240):
                return supabase.get_travel_time(origin_lat, origin_lng, dest_lat, dest_lng)
            
            # Ejecutar algoritmo
            algorithm = BogotaOpMapAlgorithm(travel_time_func=get_travel_time)
            results = algorithm.run()
            
            # Responder con JSON
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(results).encode())
            
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode())
```

## 📈 Ventajas de Usar Supabase

1. **Persistencia**: Los tiempos de viaje se guardan permanentemente
2. **Compartido**: Múltiples instancias pueden compartir el mismo caché
3. **Escalable**: Funciona igual en local y en la nube
4. **Economía**: Reduce llamadas a Google Maps API al máximo
5. **Rendimiento**: Consultas rápidas con índices optimizados

## 🔍 Monitoreo y Mantenimiento

### Ver estadísticas del caché en Supabase:

```sql
-- Total de rutas almacenadas
SELECT COUNT(*) as total_routes FROM travel_time_cache;

-- Rutas por fuente
SELECT source, COUNT(*) as count 
FROM travel_time_cache 
GROUP BY source;

-- Rutas más recientes
SELECT * FROM travel_time_cache 
ORDER BY calculated_at DESC 
LIMIT 10;

-- Limpiar cálculos Haversine (si es necesario)
DELETE FROM travel_time_cache WHERE source = 'haversine';
```

## ⚠️ Consideraciones Importantes

1. **NO guardar Haversine**: Por requerimiento, los cálculos Haversine no se guardan en Supabase
2. **Límites de API**: Supabase tiene límites en el plan gratuito (500MB de base de datos)
3. **Seguridad**: Usa RLS (Row Level Security) si necesitas control de acceso
4. **Backup**: Considera hacer backups regulares del caché

## 🆘 Solución de Problemas

### Error: "SUPABASE_URL y SUPABASE_ANON_KEY deben estar configurados"
- Verifica que el archivo `.env` existe y tiene las variables correctas
- Asegúrate de que no hay espacios alrededor del `=`

### Error: "relation "travel_time_cache" does not exist"
- Ejecuta el SQL de creación de tabla en Supabase

### Rendimiento lento
- Verifica que los índices estén creados
- Considera usar `resume_supabase_calculations.py` que carga todo en memoria

## 📚 Próximos Pasos

1. Configurar RLS para mayor seguridad
2. Crear funciones Edge para cálculos en la nube
3. Implementar webhooks para notificaciones
4. Agregar métricas y dashboards