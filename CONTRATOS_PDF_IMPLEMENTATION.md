# Implementación de Carga de PDFs para Contratos

## Cambios Realizados

### 1. Base de Datos
Se creó el script `/database/03_maintenance/add_contract_pdf_support.sql` que:
- Agrega columnas a la tabla `hospital_contracts`:
  - `pdf_url`: URL del archivo en Supabase Storage
  - `pdf_filename`: Nombre original del archivo
  - `pdf_uploaded_at`: Fecha de carga
- Crea el bucket 'contracts' en Supabase Storage
- Configura políticas RLS para el bucket
- Actualiza la vista `hospital_contracts_view`

### 2. Componente Frontend
Se creó `/web/components/ContractsListWithPDF.tsx` que incluye:
- Campo para subir PDF al crear nuevo contrato
- Botón para subir PDF a contratos existentes
- Botón para descargar PDFs
- Botón para eliminar PDFs
- Indicadores visuales de PDFs adjuntos

### 3. Integración
Se actualizó `/web/app/hospitals/HospitalActionsComplete.tsx` para usar el nuevo componente.

## Pasos para Desplegar a Producción

### 1. Ejecutar el Script SQL en Supabase
```bash
# En el dashboard de Supabase, ir a SQL Editor y ejecutar:
/database/03_maintenance/add_contract_pdf_support.sql
```

### 2. Verificar el Bucket de Storage
En el dashboard de Supabase:
1. Ir a Storage
2. Verificar que existe el bucket 'contracts'
3. Confirmar que las políticas RLS están aplicadas

### 3. Desplegar la Aplicación Web
```bash
cd web
npm run build
vercel --prod
```

## Características Implementadas

1. **Subir PDF**: Al crear o editar un contrato
2. **Ver PDF**: Indicador visual cuando un contrato tiene PDF
3. **Descargar PDF**: Botón para descargar el archivo
4. **Eliminar PDF**: Opción para remover el PDF del contrato
5. **Seguridad**: Bucket privado con autenticación requerida

## Notas de Seguridad

- Los PDFs se almacenan en un bucket privado
- Solo usuarios autenticados pueden acceder a los archivos
- Las URLs de descarga son públicas pero requieren autenticación
- Tamaño máximo de archivo: 10MB

## Uso

1. Al crear un nuevo contrato, se puede adjuntar un PDF
2. En contratos existentes, usar el botón "Subir PDF"
3. Los contratos con PDF muestran un indicador morado
4. Click en "Descargar PDF" para obtener el archivo
5. Click en "Eliminar PDF" para remover el archivo