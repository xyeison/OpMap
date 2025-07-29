# OpMap - Integración con Supabase

## Visión General

Supabase es la columna vertebral de la aplicación OpMap, proporcionando:
- Base de datos PostgreSQL con extensiones geoespaciales
- Autenticación y autorización
- APIs REST automáticas
- Almacenamiento de archivos
- Funciones Edge (serverless)

## Arquitectura de la Integración

### 1. Cliente Python (Backend)

```python
# src/utils/supabase_client.py
from supabase import create_client
import os

class SupabaseClient:
    def __init__(self):
        self.client = create_client(
            os.getenv('SUPABASE_URL'),
            os.getenv('SUPABASE_KEY')
        )
```

**Operaciones principales:**
- Lectura/escritura de travel_time_cache
- Gestión de asignaciones
- Consultas de hospitales y KAMs

### 2. Cliente TypeScript (Frontend)

```typescript
// web/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
```

**Uso en componentes:**
```typescript
// Ejemplo de consulta
const { data, error } = await supabase
  .from('hospitals')
  .select('*')
  .eq('active', true)
```

## Esquema de Base de Datos

### Tablas Core

#### hospitals
```sql
CREATE TABLE hospitals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR UNIQUE NOT NULL,
  name VARCHAR NOT NULL,
  lat NUMERIC(10,6) NOT NULL,
  lng NUMERIC(10,6) NOT NULL,
  department_id VARCHAR,
  municipality_id VARCHAR,
  locality_id VARCHAR,
  beds INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  -- ... más campos
);

-- Índices para rendimiento
CREATE INDEX idx_hospitals_location ON hospitals(lat, lng);
CREATE INDEX idx_hospitals_municipality ON hospitals(municipality_id);
CREATE INDEX idx_hospitals_active ON hospitals(active);
```

#### travel_time_cache
```sql
CREATE TABLE travel_time_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  origin_lat NUMERIC(10,6) NOT NULL,
  origin_lng NUMERIC(10,6) NOT NULL,
  dest_lat NUMERIC(10,6) NOT NULL,
  dest_lng NUMERIC(10,6) NOT NULL,
  travel_time INTEGER NOT NULL,
  source VARCHAR DEFAULT 'google_maps',
  calculated_at TIMESTAMP DEFAULT NOW()
);

-- Índice único para prevenir duplicados
CREATE UNIQUE INDEX idx_unique_route 
ON travel_time_cache(origin_lat, origin_lng, dest_lat, dest_lng);
```

### Row Level Security (RLS)

```sql
-- Habilitar RLS
ALTER TABLE hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;

-- Política para admins
CREATE POLICY "Admins have full access" ON hospitals
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin');

-- Política para vendedores
CREATE POLICY "Sales can view their territories" ON assignments
  FOR SELECT TO authenticated
  USING (
    kam_id IN (
      SELECT id FROM kams 
      WHERE user_id = auth.uid()
    )
  );
```

## Operaciones Comunes

### 1. Consultar Tiempos de Viaje

```python
# Python
def get_travel_time(self, origin_lat, origin_lng, dest_lat, dest_lng):
    """Obtiene tiempo de viaje del caché"""
    result = self.client.table('travel_time_cache').select('travel_time').eq(
        'origin_lat', round(origin_lat, 6)
    ).eq(
        'origin_lng', round(origin_lng, 6)
    ).eq(
        'dest_lat', round(dest_lat, 6)
    ).eq(
        'dest_lng', round(dest_lng, 6)
    ).maybe_single().execute()
    
    return result.data['travel_time'] if result.data else None
```

```typescript
// TypeScript
async function getTravelTime(
  originLat: number, originLng: number,
  destLat: number, destLng: number
): Promise<number | null> {
  const { data } = await supabase
    .from('travel_time_cache')
    .select('travel_time')
    .eq('origin_lat', parseFloat(originLat.toFixed(6)))
    .eq('origin_lng', parseFloat(originLng.toFixed(6)))
    .eq('dest_lat', parseFloat(destLat.toFixed(6)))
    .eq('dest_lng', parseFloat(destLng.toFixed(6)))
    .maybeSingle()
  
  return data?.travel_time || null
}
```

### 2. Guardar Asignaciones

```python
# Python - Guardar múltiples asignaciones
def save_assignments(self, assignments):
    """Guarda asignaciones nuevas"""
    # Eliminar anteriores
    self.client.table('assignments').delete().neq('id', '00000000-0000-0000-0000-000000000000').execute()
    
    # Insertar nuevas
    result = self.client.table('assignments').insert(assignments).execute()
    return len(result.data)
```

### 3. Paginación para Consultas Grandes

```python
# Python - Obtener todos los registros con paginación
def get_all_travel_times(self):
    """Obtiene todos los tiempos con paginación"""
    all_data = []
    page_size = 1000
    offset = 0
    
    while True:
        response = self.client.table('travel_time_cache') \
            .select('*') \
            .range(offset, offset + page_size - 1) \
            .execute()
        
        if not response.data:
            break
            
        all_data.extend(response.data)
        
        if len(response.data) < page_size:
            break
            
        offset += page_size
    
    return all_data
```

### 4. Consultas Complejas con Joins

```typescript
// TypeScript - Obtener asignaciones con datos relacionados
const { data: assignments } = await supabase
  .from('assignments')
  .select(`
    *,
    hospitals!inner(
      id, name, code, beds,
      municipality_name, department_name
    ),
    kams!inner(
      id, name, color
    )
  `)
  .order('travel_time', { ascending: true })
```

## Manejo de Errores

### Python
```python
try:
    result = self.client.table('hospitals').select('*').execute()
    return result.data
except Exception as e:
    print(f"Error al consultar hospitales: {e}")
    return []
```

### TypeScript
```typescript
const { data, error } = await supabase
  .from('hospitals')
  .select('*')

if (error) {
  console.error('Error fetching hospitals:', error)
  return { error: error.message }
}
```

## Optimizaciones

### 1. Índices Estratégicos
```sql
-- Índices para consultas frecuentes
CREATE INDEX idx_assignments_kam ON assignments(kam_id);
CREATE INDEX idx_assignments_hospital ON assignments(hospital_id);
CREATE INDEX idx_contracts_hospital ON hospital_contracts(hospital_id);
CREATE INDEX idx_contracts_active ON hospital_contracts(active);
```

### 2. Vistas Materializadas
```sql
-- Vista para estadísticas de KAM
CREATE MATERIALIZED VIEW kam_statistics AS
SELECT 
  k.id,
  k.name,
  COUNT(DISTINCT a.hospital_id) as total_hospitals,
  COUNT(DISTINCT h.municipality_id) as total_municipalities,
  COALESCE(SUM(hc.contract_value), 0) as total_opportunity_value,
  AVG(a.travel_time) as avg_travel_time
FROM kams k
LEFT JOIN assignments a ON k.id = a.kam_id
LEFT JOIN hospitals h ON a.hospital_id = h.id
LEFT JOIN hospital_contracts hc ON h.id = hc.hospital_id AND hc.active = true
GROUP BY k.id, k.name;

-- Refrescar periódicamente
REFRESH MATERIALIZED VIEW kam_statistics;
```

### 3. Funciones de Base de Datos
```sql
-- Función para obtener hospitales sin asignar cercanos
CREATE OR REPLACE FUNCTION get_nearby_unassigned_hospitals(
  kam_lat NUMERIC,
  kam_lng NUMERIC,
  max_distance_km INTEGER DEFAULT 100
)
RETURNS TABLE(
  hospital_id UUID,
  hospital_name VARCHAR,
  distance_km NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    h.id,
    h.name,
    ST_Distance(
      ST_MakePoint(h.lng, h.lat)::geography,
      ST_MakePoint(kam_lng, kam_lat)::geography
    ) / 1000 as distance_km
  FROM hospitals h
  LEFT JOIN assignments a ON h.id = a.hospital_id
  WHERE a.id IS NULL
    AND h.active = true
    AND ST_DWithin(
      ST_MakePoint(h.lng, h.lat)::geography,
      ST_MakePoint(kam_lng, kam_lat)::geography,
      max_distance_km * 1000
    )
  ORDER BY distance_km;
END;
$$ LANGUAGE plpgsql;
```

## Seguridad

### 1. Variables de Entorno
```bash
# .env.local (Frontend)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# .env (Backend Python)
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... # Solo backend
```

### 2. Políticas de Acceso
- **Anon Key**: Solo operaciones públicas permitidas
- **Service Key**: Bypass RLS (solo backend)
- **User JWT**: Acceso según rol del usuario

### 3. Validación de Datos
```typescript
// Validar coordenadas antes de guardar
function validateCoordinates(lat: number, lng: number): boolean {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
}

// Sanitizar entrada
function sanitizeInput(value: string): string {
  return value.replace(/[^a-zA-Z0-9\s\-_.]/g, '')
}
```

## Monitoreo y Debugging

### 1. Logs de Supabase
- Dashboard > Logs > API logs
- Filtrar por endpoint o error
- Analizar queries lentas

### 2. Métricas de Rendimiento
```sql
-- Queries más lentas
SELECT 
  query,
  mean_exec_time,
  calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Tamaño de tablas
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### 3. Health Checks
```typescript
// API endpoint para verificar conexión
export async function GET() {
  try {
    const { count } = await supabase
      .from('hospitals')
      .select('*', { count: 'exact', head: true })
    
    return NextResponse.json({
      status: 'healthy',
      database: 'connected',
      hospitalCount: count
    })
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      message: error.message
    }, { status: 500 })
  }
}
```

## Migración y Backup

### 1. Exportar Datos
```bash
# Usando Supabase CLI
supabase db dump -f backup.sql

# O desde el dashboard
# Settings > Database > Backups > Download
```

### 2. Migración Entre Ambientes
```sql
-- Exportar solo estructura
pg_dump --schema-only > schema.sql

-- Exportar datos específicos
COPY (SELECT * FROM travel_time_cache) 
TO '/tmp/travel_times.csv' CSV HEADER;

-- Importar en nuevo ambiente
COPY travel_time_cache FROM '/tmp/travel_times.csv' CSV HEADER;
```

### 3. Sincronización de Caché
```python
# Script para sincronizar caché entre ambientes
def sync_cache(source_client, target_client):
    """Sincroniza travel_time_cache entre dos instancias"""
    # Obtener todos los registros del origen
    source_data = source_client.get_all_travel_times()
    
    # Insertar en destino (ignorar duplicados)
    for batch in chunks(source_data, 1000):
        target_client.table('travel_time_cache') \
            .upsert(batch, on_conflict='origin_lat,origin_lng,dest_lat,dest_lng') \
            .execute()
```

## Mejores Prácticas

1. **Siempre usar transacciones** para operaciones múltiples
2. **Implementar retry logic** para manejar fallos temporales
3. **Cachear agresivamente** en frontend con React Query
4. **Usar conexiones pooled** para aplicaciones serverless
5. **Monitorear uso de API** para evitar límites
6. **Backup regular** de datos críticos
7. **Documentar cambios de esquema** en migraciones
8. **Usar tipos TypeScript** generados desde el esquema

## Recursos

- [Documentación Supabase](https://supabase.com/docs)
- [Cliente Python](https://github.com/supabase-community/supabase-py)
- [Cliente JavaScript](https://github.com/supabase/supabase-js)
- [PostGIS para consultas geoespaciales](https://postgis.net/documentation/)