# 🔧 Solución: Error al Analizar Rutas Faltantes

## 📋 Diagnóstico del Problema

El error "Error al analizar rutas faltantes" puede ocurrir por varias razones:

1. **Tabla faltante** en la base de datos
2. **Problemas de autenticación**
3. **Datos incompletos** (hospitales/KAMs sin coordenadas)
4. **Timeout** en la consulta

## ✅ Pasos para Solucionar

### 1. Verificar Conexión y Tablas

Primero, accede a la ruta de test en tu navegador:
```
http://localhost:3002/api/routes/test
```

Deberías ver algo como:
```json
{
  "success": true,
  "tests": {
    "connection": "OK",
    "hasDistanceTable": true,
    "hospitalCount": 768,
    "kamCount": 16,
    "testHospital": {
      "found": true,
      "name": "Hospital Name",
      "hasCoordinates": true
    }
  }
}
```

### 2. Crear Tabla `hospital_kam_distances` (si no existe)

Si `hasDistanceTable` es `false`, ejecuta este SQL en Supabase:

```sql
-- Crear tabla hospital_kam_distances
CREATE TABLE IF NOT EXISTS hospital_kam_distances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  kam_id UUID NOT NULL REFERENCES kams(id) ON DELETE CASCADE,
  distance_km NUMERIC(10, 2),
  travel_time_seconds INTEGER,
  source VARCHAR(50) DEFAULT 'google_maps',
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(hospital_id, kam_id)
);

-- Crear índices
CREATE INDEX idx_hospital_kam_distances_hospital_id ON hospital_kam_distances(hospital_id);
CREATE INDEX idx_hospital_kam_distances_kam_id ON hospital_kam_distances(kam_id);
```

### 3. Verificar Datos de Hospitales

Ejecuta en Supabase SQL Editor:

```sql
-- Verificar hospitales de prueba
SELECT id, name, lat, lng, municipality_name, department_name
FROM hospitals
WHERE id IN (
  '0a014185-801f-40f0-9cee-8cd7706068df',
  '18bb319b-00f7-4e4b-99a8-edacecbb8b41',
  '1f720e20-d731-437e-897b-134de313519b'
)
LIMIT 3;
```

Todos deberían tener valores de `lat` y `lng`.

### 4. Verificar KAMs

```sql
-- Verificar KAMs activos
SELECT id, name, lat, lng, area_id, active
FROM kams
WHERE active = true;
```

Todos deberían tener coordenadas y `area_id`.

### 5. Revisar Logs de la Consola

Abre las herramientas de desarrollo (F12) y revisa:

1. **Pestaña Console** del navegador:
   - Busca mensajes que empiecen con `RouteCalculator:`
   - Verifica si hay errores de red

2. **Terminal del servidor** (donde ejecutas `npm run dev`):
   - Busca mensajes que empiecen con `analyze-missing:`
   - Revisa errores de Supabase

## 🛠️ Mejoras Implementadas

### Logs Detallados
- Se agregaron logs en cada paso del proceso
- Los errores ahora muestran detalles específicos
- Test de conexión automático al cargar el componente

### Validaciones Adicionales
- Verificación de coordenadas antes de procesar
- Manejo de hospitales/KAMs sin ubicación
- Mensajes de error más descriptivos

### Endpoint de Test
- `/api/routes/test` para verificar conexión
- Detecta si existe la tabla necesaria
- Valida datos de hospitales específicos

## 📊 Información de Debug

Cuando ejecutes "Analizar Rutas Faltantes", verás en la consola:

```
RouteCalculator: Connection test: {...}
analyze-missing: Starting route analysis...
analyze-missing: Auth header present: true
analyze-missing: Request params: { hospitalIds: 18, includeAll: false }
analyze-missing: Hospitals fetched: 18
analyze-missing: KAMs fetched: 16
analyze-missing: Starting analysis for hospitals...
analyze-missing: Analysis complete: {...}
```

## 🚨 Errores Comunes y Soluciones

### Error: "No autorizado"
**Causa**: No hay sesión activa o el usuario no es admin
**Solución**: 
1. Cerrar sesión y volver a iniciar como admin
2. Verificar que el usuario tenga rol 'admin' en la tabla `users`

### Error: "relation \"hospital_kam_distances\" does not exist"
**Causa**: La tabla no existe en Supabase
**Solución**: Ejecutar el script SQL de creación de tabla (paso 2)

### Error: "Hospital sin coordenadas"
**Causa**: Algunos hospitales no tienen lat/lng
**Solución**: Actualizar los hospitales con coordenadas válidas

### Error: Timeout
**Causa**: Demasiados registros para procesar
**Solución**: 
1. Usar solo los 18 hospitales de prueba
2. Aumentar el timeout en el componente si es necesario

## ✅ Verificación Final

Después de aplicar las soluciones:

1. **Recargar la página** del Dashboard
2. **Click en "Analizar Rutas Faltantes"**
3. Deberías ver la lista de rutas faltantes
4. Los logs en consola mostrarán el progreso

## 📝 Script SQL Completo

Si necesitas recrear la tabla desde cero:

```sql
-- Eliminar tabla si existe (¡CUIDADO! Perderás datos)
DROP TABLE IF EXISTS hospital_kam_distances CASCADE;

-- Crear tabla nueva
CREATE TABLE hospital_kam_distances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  kam_id UUID NOT NULL REFERENCES kams(id) ON DELETE CASCADE,
  distance_km NUMERIC(10, 2),
  travel_time_seconds INTEGER,
  source VARCHAR(50) DEFAULT 'google_maps',
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(hospital_id, kam_id)
);

-- Crear índices
CREATE INDEX idx_hkd_hospital ON hospital_kam_distances(hospital_id);
CREATE INDEX idx_hkd_kam ON hospital_kam_distances(kam_id);
CREATE INDEX idx_hkd_source ON hospital_kam_distances(source);

-- Verificar creación
SELECT COUNT(*) FROM hospital_kam_distances;
```

## 🎯 Estado Actual

Con estas mejoras implementadas:
- ✅ Mejor manejo de errores
- ✅ Logs detallados para debugging
- ✅ Validación de datos antes de procesar
- ✅ Test de conexión automático
- ✅ Mensajes de error más claros
- ✅ Documentación de solución de problemas