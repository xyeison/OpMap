# 🏗️ Estructura Limpia del Proyecto OpMap

## 📁 Archivos Python Principales (Raíz)

### ✅ USAR ESTOS:
- **`opmap_supabase.py`** - Algoritmo principal con Supabase
- **`resume_supabase_calculations.py`** - Usar caché existente sin nuevas llamadas API
- **`calculate_routes_batch.py`** - Calcular rutas masivamente por departamento

### 📁 `/web` - Aplicación Next.js

#### `/web/app/api/` - APIs Limpias y Funcionales

##### ✅ APIs PRINCIPALES:
- **`/recalculate-assignments`** - Recálculo completo del sistema
- **`/recalculate-zone`** - Recálculo al activar/desactivar KAM
- **`/hospital-operations`** - CRUD completo de hospitales con recálculo
- **`/kam-operations`** - CRUD completo de KAMs con recálculo  
- **`/check-recalculation`** - Verificar y procesar cambios pendientes
- **`/calculate-missing-routes`** - Calcular rutas faltantes con Google Maps

##### APIs de Datos:
- **`/hospitals`** - Gestión de hospitales
- **`/kams`** - Gestión de KAMs
- **`/users`** - Gestión de usuarios
- **`/visits`** - Registro de visitas
- **`/travel-times`** - Consulta de tiempos de viaje
  - `/unassigned` - Hospitales sin asignar (solo caché)
  - `/unassigned-complete` - Con cálculo de rutas faltantes
  - `/unassigned-optimized` - Versión optimizada

##### APIs de Utilidad:
- **`/geojson`** - Datos geográficos para mapas
- **`/google-maps`** - Proxy para Google Maps API
- **`/locations`** - Información de ubicaciones
- **`/auth`** - Autenticación
- **`/cache-status`** - Estado del caché
- **`/cache-coverage-analysis`** - Análisis de cobertura
- **`/analyze-unassigned`** - Análisis de hospitales sin asignar
- **`/check-storage`** - Verificación de almacenamiento
- **`/debug`** - Información de depuración

#### `/web/lib/` - Lógica Principal

##### ✅ ALGORITMO PRINCIPAL:
- **`opmap-algorithm-bogota-fixed.ts`** - Algoritmo OpMap completo y corregido

##### Utilidades:
- **`supabase.ts`** - Cliente de Supabase
- **`format-utils.ts`** - Formateo de tiempos (horas:minutos)

#### `/web/components/` - Componentes React

##### Principales:
- **`MapComponent.tsx`** - Mapa interactivo principal
- **`EditKamModal.tsx`** - Modal para editar KAMs
- **`EditHospitalModal.tsx`** - Modal para editar hospitales
- **`ProtectedRoute.tsx`** - Rutas protegidas
- **`UserContext.tsx`** - Contexto de usuario

### 📁 `/database` - Scripts SQL

#### Estructura:
- **`/01_setup`** - Scripts de configuración inicial
- **`/02_migration`** - Scripts de migración
- **`/03_maintenance`** - Scripts de mantenimiento
  - `create_recalculation_triggers.sql` - Triggers automáticos ✅
- **`/04_utilities`** - Utilidades
  - `structure_for_sql_editor.sql` - Ver estructura en Supabase
  - `compact_structure.sql` - Vista compacta
  - `master_structure_query.sql` - Consulta maestra

### 📁 `/data` - Datos del Sistema

- **`/json`**
  - `sellers.json` - Configuración de KAMs
  - `adjacency_matrix.json` - Matriz de adyacencia
  - `excluded_departments.json` - Departamentos excluidos
- **`/psv`**
  - `hospitals.psv` - Base de datos de hospitales
- **`/geojson`** - Archivos geográficos

### 📁 `/src` - Código Fuente Python

- **`/algorithms`**
  - `opmap_algorithm.py` - Algoritmo base
  - `opmap_algorithm_bogota.py` - Extensión para Bogotá
- **`/visualizers`**
  - `clean_map_visualizer.py` - Visualización de mapas
- **`/utils`**
  - `distance_calculator.py` - Cálculos de distancia
  - `google_maps_client.py` - Cliente de Google Maps

### 📁 `/output` - Resultados Generados
- Archivos JSON con asignaciones
- Mapas HTML generados

### 📁 `/Trash` - Código Obsoleto (NO USAR)
- **`/python_scripts`** - Scripts Python viejos
- **`/web_apis`** - APIs duplicadas o de prueba
- **`/old_scripts`** - Scripts de prueba y debug

## 🚀 Cómo Usar

### Para Desarrollo Local:
```bash
# Aplicación Web
cd web
npm install
npm run dev

# Algoritmo Python (si necesitas debug)
python3 opmap_supabase.py
```

### Para Producción:
```bash
# La aplicación web ya está en Vercel
# El algoritmo se ejecuta automáticamente al:
# - Activar/desactivar KAMs o Hospitales
# - Crear nuevos KAMs o Hospitales
# - Modificar atributos críticos
```

## ⚠️ IMPORTANTE

- **NO USAR** archivos en `/Trash`
- **NO USAR** Haversine para cálculos
- **SIEMPRE** consultar `travel_time_cache` primero
- **SIEMPRE** respetar `max_travel_time` de cada KAM
- **El algoritmo principal está en** `web/lib/opmap-algorithm-bogota-fixed.ts`

## 📊 Estado del Sistema

- ✅ 775 hospitales activos
- ✅ 17 KAMs configurados
- ✅ 15,000+ rutas en caché
- ✅ 94.8% cobertura de asignación
- ✅ Recálculo automático funcionando
- ✅ Sistema en producción en Vercel

---
*Proyecto limpio y organizado - Enero 2025*