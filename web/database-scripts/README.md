# Scripts de Base de Datos

## add-contract-fields.sql

Este script actualiza la estructura de la tabla `hospital_contracts` para agregar los campos necesarios para la nueva funcionalidad de edición de contratos.

### Campos que agrega:
- `contract_number`: Número del contrato
- `contract_type`: Tipo de contrato (capita, evento, pgp)
- `end_date`: Fecha de finalización del contrato

### Cómo ejecutar:

1. Ve a tu proyecto en Supabase
2. Navega a SQL Editor
3. Crea una nueva consulta
4. Copia y pega el contenido del archivo `add-contract-fields.sql`
5. Ejecuta la consulta

### Qué hace el script:

1. Agrega las columnas nuevas si no existen
2. Migra datos de campos antiguos (si existen):
   - Calcula `end_date` usando `start_date` + `duration_months`
   - Usa `current_provider` como base para `contract_number`
3. Genera valores por defecto para registros existentes:
   - `contract_number`: Genera un código único automático
   - `contract_type`: Por defecto 'capita'
   - `end_date`: 12 meses desde `start_date`
4. Muestra estadísticas de los cambios realizados

### Importante:

Después de ejecutar el script, la aplicación podrá:
- Editar contratos desde la vista de contratos y desde el detalle del hospital
- Mostrar número de contrato, tipo y fechas de inicio/fin
- Calcular automáticamente la duración en meses