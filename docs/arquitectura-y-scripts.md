# Arquitectura, scripts y archivos del proyecto

_Extraído de CLAUDE.md el 2026-10-11 (texto íntegro, solo reubicado)._

## ESTADO ACTUAL DEL PROYECTO

### Aplicación Web (Next.js/TypeScript) - EN PRODUCCIÓN

La aplicación web está desplegada en Vercel y permite visualizar las asignaciones en tiempo real:

1. **Arquitectura**:
   - Frontend: Next.js 14 con TypeScript
   - Base de datos: Supabase (PostgreSQL)
   - Mapas: Leaflet con react-leaflet
   - Estado: React Query para caché y sincronización
   - Despliegue: Vercel

2. **Funcionalidades principales**:
   - Visualización de territorios asignados por KAM con colores distintivos
   - Marcadores de hospitales coloreados según KAM asignado
   - Hospitales sin asignar (zonas vacantes) con tiempos de viaje reales a cada KAM
   - Tooltips detallados con información de hospitales, contratos y territorios
   - API para recálculo de asignaciones (`/api/recalculate-assignments`)
   - Vista de hospitales sin asignar con tiempos reales de Google Maps desde Supabase

3. **Integración con Supabase**:
   - Tabla `hospital_kam_distances`: tiempos hospital→KAM calculados con Google Maps (9,859 filas a 2026-10-10; `travel_time` en SEGUNDOS). La antigua `travel_time_cache` ya no existe
   - Tabla `assignments`: Asignaciones actuales KAM-Hospital
   - Tabla `hospitals`: Base de datos de IPS activas
   - Tabla `kams`: Zonas (desde la Fase 1 cada fila es una zona, no una persona). 19 filas, 14 activas a 2026-10-10
   - Precisión de coordenadas: 6 decimales para matching exacto

### Scripts Python (Procesamiento Backend)

1. **`opmap_bogota_complete.py`** - Sistema completo con algoritmo y visualización
   - Algoritmo de asignación con lógica especial para Bogotá
   - Visualización de mapas con regla de mayoría corregida
   - Soporte para tiempos reales de Google Maps

2. **`opmap_google_matrix.py`** - Versión con Google Distance Matrix API
   - Calcula y cachea tiempos reales de viaje
   - Utiliza el mismo algoritmo de asignación

3. **`resume_google_calculations.py`** - Script para usar caché existente
   - Ejecuta el algoritmo sin hacer nuevas consultas a Google Maps
   - Genera mapas con los tiempos ya calculados

4. **`calculate_routes_batch.py`** - Calculador masivo de rutas
   - Procesa rutas por departamento para evitar timeouts
   - Integración directa con Supabase
   - Muestra progreso y estimación de costos en tiempo real

### Algoritmo Implementado

1. **Clase `BogotaOpMapAlgorithm`**: Extiende la lógica base con reglas especiales para Bogotá
   - Solo KAMs de Bogotá compiten por localidades dentro de Bogotá
   - Asignación por mayoría en localidades compartidas
   - KAMs de Bogotá pueden competir en Cundinamarca y departamentos vecinos

2. **Expansión de Nivel 2**: 
   - Todos los KAMs tienen `enableLevel2: true` en `sellers.json`
   - Permite buscar en departamentos limítrofes de limítrofes
   - Resuelve casos como Plato (Magdalena) que ahora se asigna correctamente a Sincelejo

3. **Visualización con `CleanMapVisualizer`**:
   - Solo muestra territorios con IPS asignadas
   - Departamentos excluidos en gris oscuro (#4A4A4A)
   - Marcadores de KAM con icono de usuario del color del territorio
   - Tooltips en IPS con información de camas, municipio y KAM asignado
   - **Regla de mayoría corregida**: Los territorios se colorean según el KAM con más IPS
   - Colores distintivos para cada KAM (evita confusiones)
   - Leyenda mejorada con convenciones profesionales

### Ejecución

```bash
# Para uso en desarrollo/testing local
python3 opmap_bogota_complete.py        # Con distancia Haversine (rápido, sin costo)
python3 opmap_google_matrix.py          # Con tiempos reales de Google Maps (requiere API key)
python3 resume_google_calculations.py   # Usando caché existente de Google Maps

# PRODUCCIÓN: Usando Supabase como backend
python3 opmap_supabase.py              # Lee de Supabase, calcula faltantes con Google
python3 resume_supabase_calculations.py # Solo lee de Supabase (no hace llamadas API)
python3 calculate_routes_batch.py       # Calcula rutas masivamente por departamento

# Aplicación Web (Next.js)
cd web
npm install
npm run dev                             # Desarrollo local
vercel                                  # Desplegar a producción
```

## ARCHIVOS CLAVE DEL PROYECTO

### Código Principal

#### Aplicación Web (web/)
- **`web/app/`**: Aplicación Next.js con App Router
- **`web/lib/opmap-algorithm-bogota-fixed.ts`**: Algoritmo OpMap portado a TypeScript
- **`web/components/MapComponent.tsx`**: Componente principal del mapa interactivo
- **`web/app/api/recalculate-assignments/`**: API para recálculo de asignaciones
- **`web/app/api/travel-times/unassigned/`**: API para hospitales sin asignar

#### Scripts Python
- **`opmap_bogota_complete.py`**: Sistema completo con algoritmo y visualización mejorada
- **`opmap_google_matrix.py`**: Versión que calcula tiempos reales con Google Maps
- **`resume_google_calculations.py`**: Script para usar caché existente sin nuevas consultas
- **`calculate_routes_batch.py`**: Calculador masivo de rutas por departamento
- **`opmap_supabase.py`**: Versión que usa Supabase como backend (recomendado)
- **`resume_supabase_calculations.py`**: Lee solo de Supabase sin hacer nuevas llamadas API
- **`migrate_cache_to_supabase.py`**: Migra caché JSON existente a Supabase

### Datos de Entrada
- **`data/json/sellers.json`**: Configuración de los 16 KAMs con expansión nivel 2 habilitada
- **`data/json/excluded_departments.json`**: Lista de departamentos excluidos [27, 97, 99, 88, 95, 94, 91]
- **`data/psv/hospitals.psv`**: Base de datos de 768 IPS (excluyendo departamentos remotos)
- **`data/json/adjacency_matrix.json`**: Matriz de departamentos limítrofes

### Caché y Resultados
- **Supabase `hospital_kam_distances`**: tiempos de viaje hospital→KAM en segundos (producción; `travel_time_cache` ya no existe)
- **`data/cache/google_distance_matrix_cache.json`**: Caché local (desarrollo)
- **`output/`**: Carpeta con resultados JSON y mapas HTML generados
- **`.env`**: Variables de entorno:
  - `GOOGLE_MAPS_API_KEY`: API key de Google Maps
  - `SUPABASE_URL`: URL de la instancia de Supabase
  - `SUPABASE_KEY`: API key de Supabase

## ESTRUCTURA DE ARCHIVOS DEL PROYECTO

### Código Principal
```
/
├── opmap_bogota_complete.py      # Sistema completo con algoritmo y visualización
├── opmap_google_matrix.py        # Versión con Google Distance Matrix API
├── resume_google_calculations.py # Script para usar caché existente
├── opmap_supabase.py            # Versión con Supabase (recomendado)
├── resume_supabase_calculations.py # Solo lectura desde Supabase
├── migrate_cache_to_supabase.py # Migración de caché JSON a Supabase
├── clean_google_cache.py         # Limpieza de cálculos Haversine del caché
├── SUPABASE_SETUP.md            # Guía de configuración de Supabase
└── .env                          # Variables de entorno
```

### Base de Datos
```
database/
├── README.md                     # Guía de uso de scripts SQL
├── 01_setup/                     # Scripts iniciales de configuración
│   ├── schema.sql               # Estructura principal
│   ├── create_rls_policies.sql  # Políticas RLS
│   ├── create-simple-auth-tables-safe.sql
│   ├── create-users-contracts-tables.sql
│   ├── create-hospital-history.sql
│   ├── create-storage-bucket.sql
│   └── storage-policies.sql
│
├── 02_migration/                 # Scripts de migración de datos
│   ├── fix_departments.sql
│   ├── migration_complete_no_departments.sql
│   ├── add_hospital_fields.sql
│   ├── add-contract-fields.sql
│   ├── travel_time_cache.sql
│   ├── assignments_from_json.sql
│   └── seed.sql
│
├── 03_maintenance/               # Scripts de mantenimiento
│   ├── update_all_assignments_final.sql
│   ├── update_assignment_travel_times.sql
│   ├── update_travel_times_from_cache.sql
│   ├── clean_haversine_from_cache.sql
│   ├── fix_excessive_assignments_now.sql
│   └── [otros scripts de actualización]
│
├── 04_utilities/                 # Scripts de utilidad
│   ├── show_all_tables_structure.sql
│   ├── show_tables_simple.sql
│   ├── check_data_status.sql
│   ├── verify_territory_base_rule.sql
│   ├── check-users.sql
│   └── verify-hospital-setup.sql
│
└── archive/                      # Scripts obsoletos (NO USAR)
    ├── debug/
    ├── old_versions/
    └── temporary_fixes/
```

### Datos
```
data/
├── cache/
│   └── google_distance_matrix_cache.json  # 3,399 tiempos calculados
├── json/
│   ├── sellers.json              # Configuración de KAMs
│   ├── adjacency_matrix.json     # Matriz de departamentos limítrofes
│   └── excluded_departments.json # Departamentos excluidos
├── psv/
│   └── hospitals.psv             # Base de datos de 768 IPS
└── geojson/                      # Archivos GeoJSON de territorios
    ├── departments/
    └── municipalities/
```

### Salida
```
output/
├── [archivos recientes].json     # Resultados de asignaciones
├── [archivos recientes].html     # Mapas generados
└── archive_2024/                 # Archivos antiguos archivados
```

### Código Fuente
```
src/
├── algorithms/
│   ├── opmap_algorithm.py
│   └── opmap_algorithm_bogota.py
├── visualizers/
│   └── clean_map_visualizer.py
└── utils/
    ├── distance_calculator.py
    └── google_maps_client.py
```
