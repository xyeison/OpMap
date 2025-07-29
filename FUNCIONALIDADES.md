# OpMap - Documentación de Funcionalidades

## Resumen Ejecutivo

OpMap es un sistema de asignación territorial optimizada que asigna hospitales (IPS) a vendedores (KAMs) basándose en tiempos reales de viaje calculados con Google Maps. El sistema consta de una aplicación web en producción (Next.js/Vercel) y scripts Python para procesamiento backend.

## Funcionalidades Principales

### 1. Asignación Inteligente de Territorios

#### Algoritmo de Asignación
- **Territorio Base Garantizado**: Cada KAM tiene asignación automática de hospitales en su municipio/localidad de residencia
- **Expansión Geográfica Controlada**:
  - Nivel 1: Departamentos fronterizos directos
  - Nivel 2: Departamentos fronterizos de los fronterizos (habilitado para todos)
- **Competencia por Proximidad**: Hospitales sin KAM local se asignan al KAM más cercano por tiempo de viaje
- **Regla de Mayoría**: En territorios compartidos, el color del territorio corresponde al KAM con más hospitales asignados

#### Reglas Especiales para Bogotá
- Solo KAMs de localidades de Bogotá pueden competir por hospitales dentro de Bogotá
- KAMs de Bogotá pueden expandirse a Cundinamarca y departamentos vecinos
- Las localidades funcionan como municipios independientes

### 2. Visualización Interactiva (Aplicación Web)

#### Mapa Principal
- **Territorios coloreados**: Cada territorio (municipio/localidad) se colorea según el KAM asignado
- **Marcadores de hospitales**: Puntos coloreados según el KAM, tamaño según nivel de servicio
- **Marcadores de KAMs**: Iconos de usuario con el color del KAM
- **Zonas vacantes**: Territorios sin cobertura en gris con borde rojo

#### Información Detallada (Tooltips)
- **Hospitales**:
  - Nombre, código NIT, ubicación
  - Número de camas y nivel de servicio
  - KAM asignado y tiempo de viaje
  - Valor de contratos activos
- **Territorios**:
  - Población y número de hospitales
  - Total de camas y ratio camas/1000 habitantes
  - KAM asignado o indicador de zona vacante
- **Hospitales sin asignar**:
  - Lista de tiempos de viaje a cada KAM
  - Sugerencias de asignación si están cerca del límite

### 3. Gestión de Tiempos de Viaje

#### Caché en Supabase
- **10,330+ rutas calculadas** con Google Maps Distance Matrix API
- **Precisión de 6 decimales** en coordenadas para matching exacto
- **Evita duplicados** mediante índices únicos en origin/destination
- **Source tracking**: Identifica si el tiempo viene de Google Maps o cálculo Haversine

#### Cálculo Batch por Departamento
- Script `calculate_routes_batch.py` procesa rutas sistemáticamente
- Evita timeouts procesando un departamento a la vez
- Muestra progreso en tiempo real y estimación de costos
- Omite rutas ya calculadas para optimizar recursos

### 4. API REST (Next.js)

#### `/api/recalculate-assignments`
- Recalcula todas las asignaciones usando el algoritmo OpMap
- Actualiza la base de datos con nuevas asignaciones
- Retorna número de asignaciones procesadas

#### `/api/travel-times/unassigned`
- Lista hospitales sin asignar con tiempos a cada KAM
- Usa datos reales de Google Maps desde Supabase
- Ordena KAMs por proximidad para cada hospital

#### `/api/geojson/[type]/[id]`
- Sirve archivos GeoJSON para municipios y localidades
- Usado por el mapa para renderizar territorios

### 5. Base de Datos (Supabase)

#### Tablas Principales
- **hospitals**: 768 IPS activas con coordenadas y metadatos
- **kams**: 16 vendedores con configuración de expansión
- **assignments**: Relaciones KAM-Hospital con tiempos de viaje
- **travel_time_cache**: Caché de rutas calculadas
- **hospital_contracts**: Contratos activos por hospital

#### Vistas Optimizadas
- **kam_statistics**: Estadísticas agregadas por KAM
- **territory_assignments**: Asignaciones por territorio con colores

### 6. Seguridad y Control de Acceso

#### Row Level Security (RLS)
- **admin**: Acceso completo a todas las operaciones
- **sales**: Acceso limitado a sus territorios asignados
- **viewer**: Solo lectura en tablas permitidas

#### Autenticación
- Sistema de usuarios con roles diferenciados
- Sesiones manejadas por Supabase Auth
- API keys protegidas en variables de entorno

### 7. Optimizaciones de Rendimiento

#### Algoritmo
- **Exclusión temprana**: No calcula rutas a municipios con KAM residente
- **Filtrado geográfico**: Solo evalúa rutas geográficamente viables
- **Caché multinivel**: Memoria + Supabase para acceso rápido

#### Base de Datos
- Índices en coordenadas para búsquedas geoespaciales
- Índices en claves foráneas para joins eficientes
- Paginación automática para consultas grandes

#### Frontend
- React Query para caché y sincronización de estado
- Renderizado condicional de componentes pesados
- Lazy loading de datos geográficos

### 8. Monitoreo y Análisis

#### Métricas del Sistema
- Total de hospitales asignados vs sin asignar
- Distribución de hospitales por KAM
- Tiempos promedio de viaje por territorio
- Valor total de contratos por KAM

#### Diagnóstico
- Validación de regla de territorio base
- Detección de asignaciones duplicadas
- Verificación de integridad referencial

## Casos de Uso Principales

### 1. Visualización de Cobertura Actual
- Ver qué hospitales atiende cada KAM
- Identificar zonas sin cobertura (vacantes)
- Analizar distribución de carga entre KAMs

### 2. Optimización de Territorios
- Recalcular asignaciones con nuevos parámetros
- Ajustar límites de tiempo máximo de viaje
- Evaluar impacto de agregar/remover KAMs

### 3. Análisis de Oportunidades
- Identificar hospitales de alto valor sin cobertura
- Priorizar expansión basada en contratos disponibles
- Evaluar viabilidad de nuevos territorios

### 4. Planificación de Rutas
- Ver tiempos reales de viaje entre puntos
- Optimizar visitas basadas en proximidad
- Planificar expansión territorial

## Limitaciones Conocidas

1. **Departamentos Excluidos**: 7 departamentos remotos sin cobertura
2. **Límite de 4 horas**: Hospitales a más de 240 minutos quedan sin asignar
3. **Dependencia de Google Maps**: Requiere API key y tiene costo por uso
4. **Actualización manual**: Cambios en hospitales requieren recálculo manual

## Roadmap Futuro

1. **Automatización**:
   - Recálculo automático nocturno
   - Notificaciones de cambios importantes
   - Sincronización con sistemas externos

2. **Análisis Avanzado**:
   - Predicción de crecimiento por territorio
   - Optimización multi-objetivo (tiempo + valor)
   - Simulación de escenarios what-if

3. **Mejoras UX**:
   - Filtros avanzados en el mapa
   - Exportación de reportes
   - Vista móvil optimizada