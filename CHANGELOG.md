# Changelog - OpMap

## [2025-08-07] - Seguridad y Gestión de Usuarios

### 🔒 Seguridad y RLS (Row Level Security)

#### Cambios Implementados:
1. **Habilitación de RLS en todas las tablas críticas**
   - ✅ Habilitado RLS en: assignments, hospitals, kams, users, visits, hospital_contracts, etc.
   - ✅ Creadas políticas específicas para cada tabla según el rol del usuario
   - ✅ Tabla `spatial_ref_sys` (PostGIS) marcada para ignorar (es tabla del sistema)

2. **Corrección de vistas con SECURITY DEFINER**
   - ✅ Recreadas todas las vistas sin SECURITY DEFINER
   - ✅ Vistas afectadas: visit_statistics, kam_statistics, territory_statistics, hospital_contracts_view, territory_assignments
   - ✅ Eliminadas dependencias de funciones inexistentes

3. **Sistema de autenticación mejorado**
   - ✅ Políticas RLS para tabla `users` que permiten autenticación
   - ✅ API endpoints actualizados para usar `service_role_key` cuando es necesario
   - ✅ Validación de permisos mejorada en endpoints críticos

### 👥 Gestión de Usuarios

#### Funcionalidades agregadas:
1. **Página de gestión de usuarios** (`/users`)
   - Crear nuevos usuarios con roles específicos
   - Activar/desactivar usuarios
   - Cambiar roles dinámicamente
   - Cambiar contraseñas de usuarios
   - Búsqueda y filtrado de usuarios

2. **Sistema de roles y permisos**
   - `admin`: Control total del sistema
   - `sales_manager`: Gestión de ventas y KAMs
   - `contract_manager`: Gestión de contratos
   - `data_manager`: Actualización de datos
   - `viewer`: Solo lectura
   - `user`: Acceso básico

3. **API Endpoints actualizados**
   - `/api/users/[id]`: Actualización de usuarios con bypass RLS para admins
   - `/api/users/[id]/password`: Cambio de contraseñas
   - Uso de `SUPABASE_SERVICE_ROLE_KEY` para operaciones administrativas

### 🏥 Territorios y Asignaciones Forzadas

#### Nueva funcionalidad:
1. **Sistema de asignaciones forzadas**
   - Tabla `forced_assignments` para override manual de territorios
   - Modal de asignación forzada en la página de territorios
   - Historial de cambios y razones documentadas

2. **Página de Territorios** (`/territories`)
   - Vista de todos los municipios y localidades
   - Fichas detalladas con estadísticas por territorio
   - Integración con asignaciones forzadas
   - Búsqueda y filtrado avanzado

### 📁 Estructura del Proyecto

#### Organización de archivos SQL:
```
database/
├── 01_setup/           # Scripts iniciales
├── 02_migration/       # Migraciones de datos
├── 03_maintenance/     # Scripts de mantenimiento
├── 04_utilities/       # Utilidades y consultas
├── 05_security_fixes/  # Correcciones de seguridad RLS
└── 06_forced_assignments/ # Sistema de asignaciones forzadas
```

### 🔧 Configuración

#### Variables de entorno requeridas:
```env
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key  # NUEVO - Requerido para operaciones admin
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
GOOGLE_MAPS_API_KEY=your_google_maps_key
```

### 🐛 Correcciones

1. **Error "Error al actualizar usuario"**
   - Causa: RLS bloqueaba actualizaciones de admin
   - Solución: Uso de service_role_key en API endpoints

2. **Problemas de autenticación después de habilitar RLS**
   - Causa: Políticas muy restrictivas en tabla users
   - Solución: Política pública de SELECT para autenticación

3. **Vistas con SECURITY DEFINER**
   - Causa: Configuración heredada de Supabase
   - Solución: Recreación de vistas con security_invoker

### 📝 Notas Importantes

- **NUNCA** exponer `SUPABASE_SERVICE_ROLE_KEY` en el frontend
- La tabla `spatial_ref_sys` siempre mostrará advertencia de RLS (ignorar)
- Todas las operaciones administrativas requieren rol `admin`
- El sistema mantiene al menos un admin activo siempre

### 🚀 Próximos Pasos

1. Implementar auditoría de cambios
2. Agregar 2FA para usuarios admin
3. Dashboard de actividad de usuarios
4. Exportación de logs de seguridad