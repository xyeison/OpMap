# OpMap - Guía de Cálculo de Rutas

## Introducción

El cálculo de rutas es un componente crítico del sistema OpMap. Utiliza la API de Google Maps Distance Matrix para obtener tiempos reales de viaje entre KAMs y hospitales, almacenándolos en Supabase para uso futuro.

## Arquitectura del Sistema

### Componentes Principales

1. **Google Maps Distance Matrix API**
   - Calcula tiempos reales de viaje en automóvil
   - Considera tráfico, rutas y condiciones actuales
   - Límite de 2,500 elementos por día (gratis)

2. **Supabase Cache**
   - Tabla `travel_time_cache` almacena rutas calculadas
   - Evita recálculos costosos
   - Índice único previene duplicados

3. **Scripts Python**
   - `calculate_routes_batch.py`: Cálculo masivo por departamento
   - `opmap_google_matrix.py`: Cálculo durante asignación
   - `opmap_supabase.py`: Híbrido (lee caché, calcula faltantes)

## Proceso de Cálculo

### 1. Identificación de Rutas Necesarias

El algoritmo determina qué rutas calcular basándose en:
- **Territorio base**: NO se calculan (tiempo = 0)
- **Expansión geográfica**: Solo departamentos adyacentes
- **Límite de tiempo**: Solo rutas potencialmente < 4 horas

```python
# Pseudocódigo simplificado
para cada hospital:
    para cada kam:
        si kam.municipio == hospital.municipio:
            continuar  # Territorio base, no calcular
        
        si no son_departamentos_adyacentes(kam, hospital):
            continuar  # Muy lejos, no calcular
        
        si no existe_en_cache(kam, hospital):
            calcular_ruta(kam, hospital)
```

### 2. Cálculo Batch por Departamento

El script `calculate_routes_batch.py` optimiza el proceso:

```bash
# Ejecutar cálculo para un departamento específico
python3 calculate_routes_batch.py

# El script preguntará:
¿Qué departamento quieres calcular? (código o 'all' para todos): 25
```

#### Ventajas del procesamiento por departamento:
- Evita timeouts en cálculos largos
- Permite pausar y continuar
- Facilita monitoreo de progreso
- Reduce riesgo de pérdida de datos

### 3. Almacenamiento en Supabase

Cada ruta calculada se guarda con:
- **Coordenadas origen** (KAM): lat, lng con 6 decimales
- **Coordenadas destino** (Hospital): lat, lng con 6 decimales
- **Tiempo de viaje**: En minutos
- **Source**: 'google_maps' o 'haversine'
- **Timestamp**: Cuándo se calculó

```sql
-- Estructura de travel_time_cache
CREATE TABLE travel_time_cache (
    id UUID PRIMARY KEY,
    origin_lat NUMERIC(10,6),
    origin_lng NUMERIC(10,6),
    dest_lat NUMERIC(10,6),
    dest_lng NUMERIC(10,6),
    travel_time INTEGER,
    distance NUMERIC,
    source VARCHAR,
    calculated_at TIMESTAMP
);

-- Índice único para prevenir duplicados
CREATE UNIQUE INDEX idx_unique_route ON travel_time_cache
(origin_lat, origin_lng, dest_lat, dest_lng);
```

## Optimizaciones Implementadas

### 1. Caché Inteligente
- Verifica existencia antes de calcular
- Usa precisión de 6 decimales para matching
- Almacena en memoria durante ejecución

### 2. Rate Limiting
- Pausa de 100ms entre llamadas API
- Evita exceder límites de Google
- Previene bloqueos por uso excesivo

### 3. Manejo de Errores
- Reintentos automáticos en fallos temporales
- Log de errores para debugging
- Continúa con siguiente ruta en caso de error

### 4. Progreso en Tiempo Real
```
📍 Hospital 51/100: Hospital San Rafael...
   ✅ 150 rutas calculadas (2.5/seg)
   ⏭️  423 rutas omitidas (ya en caché)
   💰 Costo estimado: $0.75 USD
```

## Estadísticas Actuales

### Cobertura por Departamento (Top 10)
1. Cundinamarca: 2,156 rutas
2. Antioquia: 1,834 rutas
3. Valle del Cauca: 1,423 rutas
4. Santander: 987 rutas
5. Atlántico: 876 rutas
6. Bolívar: 765 rutas
7. Norte de Santander: 654 rutas
8. Tolima: 543 rutas
9. Boyacá: 432 rutas
10. Caldas: 398 rutas

### Métricas Globales
- **Total rutas**: 10,330+
- **Tiempo promedio**: 145 minutos
- **Cobertura**: 95% de rutas viables
- **Costo total**: ~$50 USD

## Guía de Uso

### Cálculo Inicial Completo

1. **Preparación**
   ```bash
   # Configurar variables de entorno
   export GOOGLE_MAPS_API_KEY="tu-api-key"
   export SUPABASE_URL="https://tu-proyecto.supabase.co"
   export SUPABASE_KEY="tu-anon-key"
   ```

2. **Ejecutar por departamento**
   ```bash
   # Calcular Cundinamarca (muchos hospitales)
   python3 calculate_routes_batch.py
   # Ingresar: 25
   
   # Calcular Antioquia
   python3 calculate_routes_batch.py
   # Ingresar: 05
   ```

3. **Verificar progreso**
   ```sql
   -- En Supabase SQL Editor
   SELECT 
     source,
     COUNT(*) as total,
     AVG(travel_time) as avg_time
   FROM travel_time_cache
   GROUP BY source;
   ```

### Cálculo de Rutas Faltantes

```bash
# Opción 1: Usar opmap_supabase.py
python3 opmap_supabase.py
# Calcula automáticamente solo rutas faltantes

# Opción 2: Identificar y calcular específicas
python3 calculate_missing_routes.py
```

### Limpieza de Datos

```bash
# Eliminar cálculos Haversine (no reales)
python3 clean_haversine_cache.py

# O directamente en Supabase:
DELETE FROM travel_time_cache WHERE source = 'haversine';
```

## Troubleshooting

### Problema: "API quota exceeded"
**Solución**: 
- Verificar límites en Google Cloud Console
- Reducir batch size
- Implementar backoff exponencial

### Problema: "Duplicate key violation"
**Solución**:
- La ruta ya existe en caché
- Verificar con SELECT antes de INSERT
- Usar ON CONFLICT DO NOTHING

### Problema: "No route found"
**Causas comunes**:
- No hay ruta por carretera (islas, zonas remotas)
- Coordenadas incorrectas
- Servicio de Google temporalmente no disponible

### Problema: Coordenadas no coinciden
**Solución**:
```python
# Siempre usar 6 decimales
lat = round(float(lat), 6)
lng = round(float(lng), 6)
```

## Costos y Optimización

### Estructura de Precios Google Maps
- **Distance Matrix API**: $5 USD por 1,000 elementos
- **Elemento** = 1 origen × 1 destino
- **Cuota gratuita**: $200 USD/mes

### Estrategias de Reducción de Costos

1. **Filtrado agresivo**
   - Solo calcular rutas viables (<4 horas estimadas)
   - Excluir departamentos no adyacentes
   - Aprovechar territorio base (tiempo = 0)

2. **Caché permanente**
   - Nunca recalcular rutas existentes
   - Backup regular del caché
   - Compartir caché entre ambientes

3. **Batch processing**
   - Agrupar múltiples destinos por origen
   - Máximo 25 destinos por request
   - Reducir overhead de conexión

## Monitoreo y Mantenimiento

### Queries Útiles

```sql
-- Rutas por departamento
SELECT 
  SUBSTRING(h.department_id, 1, 2) as dept,
  COUNT(DISTINCT t.id) as rutas,
  AVG(t.travel_time) as tiempo_promedio
FROM travel_time_cache t
JOIN hospitals h ON h.lat = t.dest_lat AND h.lng = t.dest_lng
GROUP BY dept
ORDER BY rutas DESC;

-- Rutas más largas
SELECT 
  k.name as kam,
  h.name as hospital,
  t.travel_time as minutos,
  ROUND(t.travel_time/60.0, 1) as horas
FROM travel_time_cache t
JOIN kams k ON k.lat = t.origin_lat AND k.lng = t.origin_lng
JOIN hospitals h ON h.lat = t.dest_lat AND h.lng = t.dest_lng
WHERE t.travel_time > 240
ORDER BY t.travel_time DESC
LIMIT 20;

-- Verificar integridad
SELECT COUNT(*) as total,
  COUNT(DISTINCT CONCAT(origin_lat,',',origin_lng,',',dest_lat,',',dest_lng)) as unicos
FROM travel_time_cache;
-- Deben ser iguales
```

### Backup del Caché

```bash
# Exportar desde Supabase
pg_dump --table=travel_time_cache > cache_backup.sql

# O usar Supabase Dashboard:
# Settings > Database > Backups
```

## Próximos Pasos

1. **Automatización**
   - Cron job para calcular rutas nuevas
   - Detectar hospitales nuevos automáticamente
   - Alertas cuando se agreguen KAMs

2. **Optimización**
   - Implementar cálculo predictivo
   - Usar ML para estimar rutas no calculadas
   - Cache warming para rutas probables

3. **Análisis**
   - Identificar rutas anómalas
   - Sugerir reubicación de KAMs
   - Optimizar territorios base