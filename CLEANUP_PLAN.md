# Plan de Limpieza del Proyecto OpMap

## Resumen Ejecutivo

El proyecto OpMap tiene **múltiples archivos redundantes y desorganizados** que dificultan su mantenimiento:
- **50+ archivos SQL duplicados** (en raíz Y en /database/)
- **4-5 versiones** de los mismos scripts
- **100+ archivos** en output sin organización
- **Archivos de debug** específicos mezclados con código principal

### Archivos a Eliminar: ~200 archivos
### Archivos a Reorganizar: ~50 archivos
### Tiempo estimado: 2-3 horas

## Problemas Identificados

### 1. **Archivos SQL Duplicados**
- **50+ archivos SQL** están duplicados en el directorio raíz Y en `/database/`
- Esto es extremadamente confuso y propenso a errores

### 2. **Múltiples Versiones del Mismo Archivo**
- `update_all_assignments*.sql` (4 versiones!)
- `create-simple-auth-tables*.sql` (3 versiones)
- `fix_schema_lengths*.sql` (2 versiones)
- `migration_*.sql` (2 versiones)
- `fix_excessive_assignments*.sql` (2 versiones)

### 3. **Archivos de Debug/Test Dispersos**
- **Python**: `debug_cartagena*.py` (4 archivos!)
- **JavaScript**: `diagnose_malaga_issue.js`, `test_*.js`
- **SQL**: Scripts de debug específicos (`check_valledupar_assignment.sql`)
- Scripts temporales que no deberían estar en producción

### 4. **Carpetas Obsoletas**
- `data/geojson_old2/` - Versión antigua de geojson
- `data/geojson/localities_old/` - Localidades antiguas

### 5. **Carpeta Output Sobrecargada**
- **100+ archivos** en `/output/`
- Múltiples versiones de mapas y resultados
- Sin organización por fecha o tipo

### 6. **Código Fuente Duplicado**
- `src/enhanced_map_visualizer*.py` (5 versiones!)
- `src/opmap_algorithm*.py` (4 versiones!)

### 7. **Falta de Organización**
- No hay estructura clara de qué ejecutar primero
- Mezcla de scripts de setup, migración, mantenimiento y debug

## Acciones de Limpieza Propuestas

### Paso 1: Eliminar Duplicados
```bash
# Eliminar todos los archivos SQL del directorio raíz
rm *.sql

# Eliminar archivos Python de debug específicos
rm debug_cartagena*.py
rm diagnose_malaga_issue.js
rm test_*.js

# Eliminar carpetas obsoletas
rm -rf data/geojson_old2
rm -rf data/geojson/localities_old
```

### Paso 2: Crear Estructura Organizada
```
database/
├── 01_setup/
│   ├── 01_schema.sql              # Schema principal
│   ├── 02_create_auth_tables.sql  # Autenticación
│   ├── 03_create_rls_policies.sql # Políticas RLS
│   └── 04_create_storage.sql      # Storage buckets
│
├── 02_migration/
│   ├── 01_fix_departments.sql     # Pre-migración
│   ├── 02_migrate_data.sql        # Migración principal
│   ├── 03_travel_time_cache.sql   # Caché de tiempos
│   └── 04_seed_data.sql          # Datos semilla
│
├── 03_maintenance/
│   ├── update_assignments.sql     # Actualizar asignaciones
│   ├── update_contracts.sql       # Actualizar contratos
│   ├── update_travel_times.sql    # Actualizar tiempos
│   └── clean_haversine_cache.sql  # Limpiar caché
│
├── 04_utilities/
│   ├── show_tables_structure.sql  # Ver estructura
│   ├── check_data_status.sql      # Estado de datos
│   └── verify_territory_base.sql  # Verificaciones
│
└── archive/                       # Archivos obsoletos (NO ejecutar)
    ├── old_versions/
    ├── debug_scripts/
    └── temporary_fixes/
```

### Paso 3: Reorganizar Código Python
```
src/
├── algorithms/
│   ├── opmap_algorithm.py          # Versión base
│   └── opmap_algorithm_bogota.py   # Versión con lógica Bogotá
│
├── visualizers/
│   └── clean_map_visualizer.py     # Visualizador principal
│
└── utils/
    ├── distance_calculator.py
    └── google_maps_implementation.py

# Eliminar versiones antiguas
rm src/enhanced_map_visualizer*.py
rm src/opmap_algorithm_enhanced.py
rm src/opmap_algorithm_fixed.py
rm src/map_visualizer.py  # Versión antigua
```

### Paso 4: Limpiar Output
```bash
# Crear carpeta de archivo
mkdir output/archive_2024

# Mover archivos antiguos (mantener solo los últimos)
mv output/*_202507[12]*.* output/archive_2024/

# Mantener solo los más recientes
ls -t output/*.json | tail -n +6 | xargs rm
ls -t output/*.html | tail -n +6 | xargs rm
```

### Paso 5: Archivos a Eliminar Definitivamente
1. Todas las versiones antiguas (_by_name, _fixed, etc.)
2. Scripts de debug específicos (check_valledupar, etc.)
3. Scripts temporales (disable-rls-temporary, etc.)
4. Archivos de test

### Paso 6: Crear README en /database/
```markdown
# Database Scripts

## Orden de Ejecución

### Setup Inicial
1. `01_setup/01_schema.sql`
2. `01_setup/02_create_auth_tables.sql`
3. `01_setup/03_create_rls_policies.sql`
4. `01_setup/04_create_storage.sql`

### Migración de Datos
1. `02_migration/01_fix_departments.sql`
2. `02_migration/02_migrate_data.sql`
3. `02_migration/03_travel_time_cache.sql`

### Mantenimiento Regular
- Ver carpeta `03_maintenance/`

### Utilidades
- Ver carpeta `04_utilities/`
```

### Paso 7: Scripts a Consolidar
```
scripts/
├── cache/
│   ├── clean_haversine_cache.sql
│   ├── load_google_cache.js
│   └── verify_cache.js
│
├── migration/
│   ├── migrate_to_supabase.py
│   └── json_to_sql.py
│
└── utilities/
    ├── check_hospitals.js
    └── calculate_distances.js
```

## Beneficios Esperados

1. **Claridad**: Saber exactamente qué archivo ejecutar
2. **Seguridad**: No ejecutar accidentalmente scripts peligrosos
3. **Mantenibilidad**: Fácil encontrar el script correcto
4. **Limpieza**: Menos archivos, más organización
5. **Documentación**: README claro en cada carpeta importante

## Próximos Pasos

1. Confirmar qué versiones de archivos mantener
2. Mover archivos a las carpetas correctas
3. Eliminar duplicados y versiones antiguas
4. Crear documentación clara
5. Actualizar CLAUDE.md con la nueva estructura

## Script de Limpieza Rápida

```bash
#!/bin/bash
# cleanup_opmap.sh

echo "🧹 Iniciando limpieza de OpMap..."

# 1. Eliminar SQL duplicados del raíz
echo "Eliminando archivos SQL duplicados..."
rm *.sql 2>/dev/null

# 2. Eliminar archivos de debug
echo "Eliminando archivos de debug..."
rm debug_*.py 2>/dev/null
rm diagnose_*.js 2>/dev/null
rm test_*.js 2>/dev/null

# 3. Eliminar carpetas obsoletas
echo "Eliminando carpetas obsoletas..."
rm -rf data/geojson_old2
rm -rf data/geojson/localities_old

# 4. Limpiar output (mantener solo últimos 5 de cada tipo)
echo "Limpiando carpeta output..."
mkdir -p output/archive_2024
find output -name "*.json" -o -name "*.html" | sort -r | tail -n +11 | xargs -I {} mv {} output/archive_2024/

# 5. Eliminar versiones antiguas en src
echo "Limpiando código fuente..."
rm src/enhanced_map_visualizer*.py 2>/dev/null
rm src/opmap_algorithm_enhanced.py 2>/dev/null
rm src/opmap_algorithm_fixed.py 2>/dev/null

echo "✅ Limpieza completada!"
echo "📊 Archivos eliminados/movidos: $(find output/archive_2024 -type f | wc -l)"
```

## Resultado Esperado

### Antes: ~500 archivos dispersos
### Después: ~100 archivos organizados

La estructura será más clara, mantenible y profesional.