# Database Scripts - OpMap

Esta carpeta contiene todos los scripts SQL organizados por propósito. Cada subcarpeta tiene scripts específicos que deben ejecutarse en orden.

## 📁 Estructura de Carpetas

### 01_setup/
Scripts iniciales para crear la estructura de la base de datos.

**Orden de ejecución:**
1. `schema.sql` - Estructura principal de tablas
2. `create_rls_policies.sql` - Políticas de seguridad Row Level Security
3. `create-simple-auth-tables-safe.sql` - Tablas de autenticación
4. `create-users-contracts-tables.sql` - Tablas de usuarios y contratos
5. `create-hospital-history.sql` - Tabla de historial de hospitales
6. `create-storage-bucket.sql` - Configuración de Storage
7. `storage-policies.sql` - Políticas de Storage

### 02_migration/
Scripts para migrar y poblar datos iniciales.

**Orden de ejecución:**
1. `fix_departments.sql` - Corregir departamentos antes de migración
2. `migration_complete_no_departments.sql` - Migración principal de datos
3. `add_hospital_fields.sql` - Agregar campos adicionales a hospitales
4. `add-contract-fields.sql` - Agregar campos a contratos
5. `travel_time_cache.sql` - Crear tabla de caché de tiempos
6. `assignments_from_json.sql` - Cargar asignaciones desde JSON
7. `seed.sql` - Datos semilla adicionales

### 03_maintenance/
Scripts para mantenimiento y actualizaciones regulares.

**Scripts principales:**
- `update_all_assignments_final.sql` - Actualizar todas las asignaciones
- `update_assignment_travel_times.sql` - Actualizar tiempos de viaje
- `update_travel_times_from_cache.sql` - Actualizar desde caché
- `clean_haversine_from_cache.sql` - Limpiar cálculos Haversine
- `fix_excessive_assignments_now.sql` - Corregir asignaciones excesivas
- `fix_schema_lengths_complete.sql` - Ajustar longitudes de campos
- `update-contracts-structure.sql` - Actualizar estructura de contratos
- `update-assignments-table.sql` - Actualizar tabla de asignaciones
- `alter-hospital-history.sql` - Modificar historial de hospitales

### 04_utilities/
Scripts de utilidad para verificación y análisis.

**Scripts disponibles:**
- `show_all_tables_structure.sql` - Ver estructura completa de BD
- `show_tables_simple.sql` - Ver estructura simplificada
- `check_data_status.sql` - Verificar estado de los datos
- `verify_territory_base_rule.sql` - Verificar regla de territorio base
- `check-users.sql` - Verificar usuarios
- `verify-hospital-setup.sql` - Verificar configuración de hospitales

### archive/
Scripts obsoletos o temporales (NO EJECUTAR).

**Subdirectorios:**
- `debug/` - Scripts de debugging específicos
- `old_versions/` - Versiones anteriores de scripts
- `temporary_fixes/` - Arreglos temporales ya aplicados

## 🚀 Guía de Uso Rápido

### Setup inicial completo:
```bash
# Ejecutar todos los scripts de setup en orden
psql -d opmap -f 01_setup/schema.sql
psql -d opmap -f 01_setup/create_rls_policies.sql
# ... continuar con el resto en orden
```

### Actualización de asignaciones:
```bash
# Ejecutar el script principal de actualización
psql -d opmap -f 03_maintenance/update_all_assignments_final.sql
```

### Verificación del sistema:
```bash
# Ver estado actual de los datos
psql -d opmap -f 04_utilities/check_data_status.sql
```

## ⚠️ Notas Importantes

1. **SIEMPRE** ejecutar los scripts en el orden indicado
2. **NO EJECUTAR** scripts de la carpeta `archive/`
3. Hacer backup antes de ejecutar scripts de mantenimiento
4. Verificar conexión a la base de datos correcta antes de ejecutar

## 📊 Scripts más utilizados

1. **Ver estructura**: `04_utilities/show_all_tables_structure.sql`
2. **Actualizar asignaciones**: `03_maintenance/update_all_assignments_final.sql`
3. **Verificar datos**: `04_utilities/check_data_status.sql`
4. **Limpiar caché**: `03_maintenance/clean_haversine_from_cache.sql`