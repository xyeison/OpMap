# Sistema de Contratos con Indicadores Requeridos

## 🎯 Resumen de Cambios

Se ha implementado un sistema completo para gestionar contratos con indicadores financieros requeridos, permitiendo evaluar si los proveedores cumplen con los requisitos de cada contrato.

## 📋 Características Implementadas

### 1. **Página de Edición/Creación de Contratos** (`/contracts/[id]/edit`)
- Formulario completo en página separada (no popup)
- Sección de información básica del contrato
- Sección dedicada a indicadores requeridos con:
  - Índice de Liquidez (mínimo)
  - Índice de Endeudamiento (máximo)
  - Cobertura de Intereses (mínimo)
  - Capital de Trabajo Neto (mínimo)
  - Margen de Rentabilidad (mínimo)
  - Experiencia en años (mínimo)
  - Requisitos adicionales personalizados

### 2. **Vista de Cumplimiento** (`/compliance`)
- Dashboard con estadísticas generales
- Tabla con evaluación de cumplimiento por contrato
- Comparación visual de valores actuales vs. requeridos
- Filtros por estado de cumplimiento
- Enlaces directos para ver y editar contratos

### 3. **Base de Datos Actualizada**
Nuevos campos en `hospital_contracts`:
- `proveedor_id`: Relación con proveedores
- `requires_liquidez`, `min_liquidez`
- `requires_endeudamiento`, `max_endeudamiento`
- `requires_cobertura`, `min_cobertura`
- `requires_capital_trabajo`, `min_capital_trabajo`
- `requires_rentabilidad`, `min_rentabilidad`
- `requires_experiencia`, `min_experiencia_years`
- `custom_requirements`: Requisitos adicionales en texto

### 4. **Vista SQL `contract_compliance`**
Vista que evalúa automáticamente el cumplimiento combinando:
- Requisitos del contrato
- Indicadores actuales del proveedor
- Evaluación de cumplimiento por indicador

## 🚀 Instalación

### 1. Ejecutar el Script SQL en Supabase

```sql
-- Ejecutar en el SQL Editor de Supabase:
-- Copiar y pegar el contenido de: database/02_migration/add_contract_requirements.sql
```

### 2. Rutas Disponibles

- **Crear nuevo contrato**: `/contracts/new/edit`
- **Editar contrato existente**: `/contracts/[id]/edit`
- **Ver cumplimiento**: `/compliance`
- **Ver detalle de contrato**: `/contracts/[id]`

## 💡 Uso

### Crear/Editar un Contrato

1. Navegar a `/contracts/new/edit` para crear un nuevo contrato
2. Completar información básica (hospital, número, valor, fechas)
3. En la sección "Indicadores Requeridos":
   - Activar los indicadores que requiere el contrato
   - Establecer valores mínimos/máximos según corresponda
   - Agregar requisitos adicionales si es necesario
4. Guardar el contrato

### Evaluar Cumplimiento

1. Navegar a `/compliance`
2. Ver el dashboard con:
   - Total de contratos
   - Contratos que cumplen/no cumplen
   - Valor total por estado
3. Revisar la tabla detallada con:
   - Estado de cada indicador
   - Valores actuales vs. requeridos
   - Estado general de cumplimiento

### Flujo de Trabajo Recomendado

1. **Configurar indicadores del proveedor**: En `/providers/[id]` agregar datos financieros
2. **Crear contrato con requisitos**: En `/contracts/new/edit` definir indicadores requeridos
3. **Asignar proveedor al contrato**: Seleccionar el proveedor en el formulario
4. **Evaluar cumplimiento**: Revisar en `/compliance` si el proveedor cumple

## 🔧 API Endpoints

- `GET /api/contracts/compliance`: Obtiene evaluación de cumplimiento
- `GET /api/contracts/[id]`: Obtiene detalle de contrato
- `POST /api/contracts`: Crea nuevo contrato
- `PUT /api/contracts/[id]`: Actualiza contrato existente

## 📊 Indicadores Evaluados

| Indicador | Tipo | Descripción | Valor Típico |
|-----------|------|-------------|--------------|
| Liquidez | Mínimo | Capacidad de pago a corto plazo | ≥ 1.2 |
| Endeudamiento | Máximo | Proporción de deuda | ≤ 70% |
| Cobertura | Mínimo | Capacidad de pagar intereses | ≥ 1.5x |
| Capital Trabajo | Mínimo | Recursos para operación | Variable |
| Rentabilidad | Mínimo | Margen de utilidad | Variable |
| Experiencia | Mínimo | Años en el sector | Variable |

## 🎨 Interfaz de Usuario

- **Colores de Estado**:
  - Verde: Cumple requisitos ✅
  - Rojo: No cumple requisitos ❌
  - Gris: No requerido

- **Navegación**:
  - Enlaces directos desde la tabla de cumplimiento
  - Botones de acción para ver/editar contratos
  - Filtros rápidos por estado

## 📝 Notas Importantes

1. Los indicadores del proveedor deben estar actualizados para una evaluación correcta
2. La vista `contract_compliance` toma automáticamente los indicadores más recientes del proveedor
3. Los contratos sin proveedor asignado no pueden ser evaluados
4. Los requisitos personalizados (`custom_requirements`) son informativos y no se evalúan automáticamente

## 🔄 Próximos Pasos Sugeridos

1. Agregar notificaciones cuando un proveedor no cumpla requisitos
2. Implementar histórico de cumplimiento
3. Agregar reportes exportables
4. Crear alertas de vencimiento de contratos
5. Implementar evaluación de requisitos personalizados