# Sistema de Gestión de Proveedores - OpMap

## 📋 Descripción

Sistema completo de gestión de proveedores con análisis financiero e indicadores automatizados para licitaciones. Permite:
- Gestión centralizada de proveedores y competidores
- Análisis financiero con cálculo automático de indicadores
- Evaluación de cumplimiento para licitaciones
- Reportes estratégicos de competencia

## 🚀 Instalación

### 1. Ejecutar Scripts SQL en orden

```bash
# Desde la carpeta database/05_providers/

# 1. Crear las tablas y funciones
psql $DATABASE_URL < 01_create_providers_tables.sql

# 2. Migrar datos existentes (opcional, si ya tienes contratos)
psql $DATABASE_URL < 02_migrate_existing_providers.sql
```

### 2. Verificar la instalación

```sql
-- Verificar tablas creadas
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'proveedor%';

-- Verificar proveedores migrados
SELECT COUNT(*) as total_proveedores FROM proveedores;

-- Verificar contratos actualizados
SELECT COUNT(*) as contratos_con_proveedor 
FROM hospital_contracts 
WHERE proveedor_id IS NOT NULL;
```

## 📊 Estructura de Tablas

### Tablas Principales

1. **`proveedores`** - Información básica del proveedor
2. **`proveedor_finanzas`** - Estados financieros por año
3. **`proveedor_indicadores`** - Indicadores calculados automáticamente
4. **`proveedor_contactos`** - Contactos del proveedor
5. **`proveedor_documentos`** - Archivos y certificaciones

### Vistas Útiles

- **`v_proveedores_ultimos_indicadores`** - Proveedores con sus últimos indicadores
- **`v_competencia_hospitales`** - Mapa de competencia por hospital
- **`v_ranking_proveedores`** - Ranking por tamaño e ingresos

## 💻 Uso en la Aplicación

### API Endpoints Disponibles

```typescript
// Listar proveedores con filtros
GET /api/providers?search=medtronic&estado=activo&tipo_empresa=competidor

// Obtener un proveedor específico
GET /api/providers/{id}

// Crear nuevo proveedor
POST /api/providers
{
  "nit": "900123456-1",
  "nombre": "Proveedor SA",
  "tipo_empresa": "competidor"
}

// Actualizar proveedor
PUT /api/providers/{id}

// Buscar proveedores (para autocomplete)
GET /api/providers/search?q=medtronic

// Gestionar finanzas
GET /api/providers/{id}/finanzas
POST /api/providers/{id}/finanzas
PUT /api/providers/{id}/finanzas?anio=2024
```

### Componentes React

```tsx
// Selector de proveedor con creación en línea
import ProviderSelect from '@/components/providers/ProviderSelect';

<ProviderSelect 
  value={providerId}
  onChange={(id, provider) => setProviderId(id)}
  onProviderCreated={(provider) => console.log('Nuevo:', provider)}
/>
```

### Páginas Disponibles

- `/providers` - Listado de proveedores
- `/providers/{id}` - Perfil completo del proveedor
- `/providers/new` - Crear nuevo proveedor

## 📈 Indicadores Financieros

### Indicadores Obligatorios para Licitaciones

| Indicador | Fórmula | Requisito Típico |
|-----------|---------|------------------|
| Índice de Liquidez | Activo Corriente / Pasivo Corriente | ≥ 1.2 |
| Índice de Endeudamiento | Pasivo Total / Activo Total | ≤ 0.7 (70%) |
| Cobertura de Intereses | Utilidad Operacional / Gastos Intereses | ≥ 1.5 |

### Indicadores Estratégicos Adicionales

- **Rentabilidad**: ROE, ROA, Margen Operacional, Margen Neto
- **Eficiencia**: Rotación de Activos, Rotación de Cartera
- **Liquidez**: Prueba Ácida, Capital de Trabajo
- **Apalancamiento**: Pasivo Total / Patrimonio

## 🔄 Flujo de Trabajo

### 1. Crear/Actualizar Proveedor

```sql
-- El proveedor se crea manualmente o desde la app
INSERT INTO proveedores (nit, nombre, tipo_empresa) 
VALUES ('900123456-1', 'Competidor SA', 'competidor');
```

### 2. Agregar Información Financiera

```sql
-- Insertar estados financieros
INSERT INTO proveedor_finanzas (
  proveedor_id, anio, 
  activo_corriente, pasivo_corriente,
  activo_total, pasivo_total,
  ingresos_operacionales, utilidad_neta
) VALUES (
  'uuid-del-proveedor', 2024,
  5000, 3000,  -- En millones COP
  15000, 8000,
  12000, 1500
);

-- Los indicadores se calculan automáticamente por trigger
```

### 3. Consultar Indicadores

```sql
-- Ver proveedores que cumplen requisitos
SELECT * FROM obtener_proveedores_calificados(
  p_indice_liquidez := 1.2,
  p_indice_endeudamiento := 0.7,
  p_cobertura_intereses := 1.5
);

-- Análisis de competencia por departamento
SELECT * FROM analizar_competencia_departamento('08'); -- Atlántico
```

## 🛠️ Mantenimiento

### Actualizar NITs Temporales

Después de la migración, actualizar los NITs temporales:

```sql
-- Ver proveedores con NIT temporal
SELECT id, nombre, nit FROM proveedores 
WHERE nit LIKE 'TEMP-%';

-- Actualizar con NIT real
UPDATE proveedores 
SET nit = '900123456-1' 
WHERE nombre = 'PROVEEDOR EJEMPLO SA';
```

### Limpiar Datos Antiguos

```sql
-- Después de verificar que todo funciona
-- Opcional: eliminar campo antiguo
ALTER TABLE hospital_contracts 
DROP COLUMN current_provider;
```

## 📊 Reportes Disponibles

### 1. Ranking de Proveedores
```sql
SELECT * FROM v_ranking_proveedores
ORDER BY ranking_ingresos;
```

### 2. Mapa de Competencia
```sql
SELECT * FROM v_competencia_hospitales
WHERE department_name = 'ANTIOQUIA'
ORDER BY contract_value DESC;
```

### 3. Proveedores por Cumplimiento
```sql
SELECT * FROM v_proveedores_ultimos_indicadores
WHERE cumple_todos_requisitos = true
ORDER BY score_salud_financiera DESC;
```

## ⚠️ Consideraciones Importantes

1. **NITs únicos**: El sistema valida que no existan NITs duplicados
2. **Cálculo automático**: Los indicadores se recalculan automáticamente al actualizar finanzas
3. **Eliminación en cascada**: Al eliminar un proveedor se eliminan sus finanzas e indicadores
4. **Contratos protegidos**: No se puede eliminar un proveedor con contratos activos
5. **Valores en millones**: Los valores financieros se almacenan en millones de COP

## 🔐 Seguridad

- RLS (Row Level Security) habilitado en todas las tablas
- Roles diferenciados: admin, sales, viewer
- Auditoría de cambios mediante timestamps

## 📝 Próximos Pasos

1. **Completar información de proveedores migrados**:
   - Actualizar NITs reales
   - Agregar información de contacto
   - Clasificar tipo_empresa correctamente

2. **Cargar información financiera**:
   - Obtener estados financieros de Supersociedades
   - Ingresar datos históricos (últimos 3 años)

3. **Configurar alertas**:
   - Contratos próximos a vencer
   - Proveedores que no cumplen requisitos
   - Cambios significativos en indicadores

## 🆘 Soporte

Para problemas o consultas sobre el sistema de proveedores:
1. Revisar los logs de error en las respuestas de API
2. Verificar la consola del navegador para errores de frontend
3. Consultar las tablas de auditoría para cambios recientes