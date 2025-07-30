# Formato de Importación de Visitas

## Columnas requeridas en el archivo Excel:

| Columna | Nombre | Tipo | Descripción | Ejemplo |
|---------|--------|------|-------------|---------|
| A | kam_id o kam_name | Texto | ID del KAM (recomendado) o nombre completo | barranquilla o Juan Pérez |
| B | tipo_visita | Lista | Tipo de visita realizada | Visita efectiva |
| C | tipo_contacto | Lista | Modalidad de la visita | Visita presencial |
| D | latitud | Decimal | Coordenada latitud | 4.710989 |
| E | longitud | Decimal | Coordenada longitud | -74.072092 |
| F | fecha_reporte | Fecha | Fecha de la visita (YYYY-MM-DD) | 2024-01-15 |
| G | hospital_visitado | Texto | Nombre del hospital (opcional) | Hospital San Juan |
| H | observaciones | Texto | Notas adicionales (opcional) | Reunión exitosa |

## Valores permitidos:

### tipo_visita
- Visita efectiva
- Visita extra
- Visita no efectiva

### tipo_contacto
- Visita presencial
- Visita virtual

## Validaciones:
- **kam_id/kam_name**: 
  - Preferiblemente use el ID del KAM (ej: 'barranquilla', 'cali', 'medellin')
  - También puede usar el nombre completo si lo conoce exactamente
  - El sistema acepta las columnas: kam_id, kam, o kam_name
- **latitud**: Entre -90 y 90
- **longitud**: Entre -180 y 180
- **fecha_reporte**: Formato YYYY-MM-DD

## Notas importantes:
1. El archivo debe ser .xlsx o .xls
2. La primera fila debe contener los nombres de las columnas exactamente como se muestran
3. No dejar filas vacías entre los datos
4. Los campos opcionales pueden dejarse en blanco
5. El sistema intentará asociar automáticamente la visita con el hospital más cercano (máximo 5km)