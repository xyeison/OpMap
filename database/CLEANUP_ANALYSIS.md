# Análisis de Limpieza - Carpeta Database

## Archivos Redundantes Identificados

### 1. Updates de Assignments (4 versiones!)
- `update_all_assignments.sql`
- `update_all_assignments_by_name.sql`
- `update_all_assignments_final.sql`
- `update_all_assignments_fixed.sql`

**Acción**: Mantener solo la versión más reciente (_final o _fixed)

### 2. Autenticación Simple (3 versiones)
- `create-simple-auth-tables.sql`
- `create-simple-auth-tables-safe.sql`
- `create-simple-auth-no-hash.sql`

**Acción**: Mantener solo `create-simple-auth-tables-safe.sql`

### 3. Schema Lengths (2 versiones)
- `fix_schema_lengths.sql`
- `fix_schema_lengths_complete.sql`

**Acción**: Mantener solo `fix_schema_lengths_complete.sql`

### 4. Migraciones (2 versiones)
- `migration_data.sql`
- `migration_complete_no_departments.sql`

**Acción**: Revisar cuál es la más completa

## Archivos Obsoletos o de Debug

### Candidatos para eliminación:
1. `check_valledupar_assignment.sql` - Debug específico
2. `test-hospital-operations.sql` - Script de prueba
3. `disable-rls-temporary.sql` - Temporal/peligroso
4. `debug-rls-policies.sql` - Debug específico
5. `diagnose_missing_travel_times.sql` - Diagnóstico temporal
6. `check_excessive_travel_times.sql` - Check temporal
7. `fix_excessive_assignments.sql` - Reemplazado por fix_excessive_assignments_now.sql

## Estructura Propuesta

```
database/
├── 01_schema/
│   ├── schema.sql                    # Schema principal
│   ├── create_rls_policies.sql       # Políticas RLS
│   └── indexes.sql                   # Índices (crear nuevo)
│
├── 02_migrations/
│   ├── 01_initial_migration.sql      # Migración inicial
│   ├── 02_fix_departments.sql        # Fix departamentos
│   └── 03_travel_time_cache.sql      # Caché de tiempos
│
├── 03_updates/
│   ├── update_assignments.sql        # Actualizar asignaciones
│   ├── update_contracts.sql          # Actualizar contratos
│   └── update_travel_times.sql       # Actualizar tiempos
│
├── 04_utilities/
│   ├── show_tables_structure.sql     # Ver estructura
│   ├── check_data_status.sql         # Verificar datos
│   └── clean_haversine_cache.sql     # Limpiar caché
│
└── archive/                          # Mover archivos obsoletos aquí
```

## Scripts Consolidados Propuestos

### 1. `setup_database.sql`
Combinar:
- schema.sql
- create_rls_policies.sql
- create-storage-bucket.sql

### 2. `migrate_data.sql`
Combinar la mejor versión de migración con:
- fix_departments.sql
- seed.sql

### 3. `maintenance.sql`
Combinar utilidades comunes:
- check_data_status.sql
- verify_territory_base_rule.sql