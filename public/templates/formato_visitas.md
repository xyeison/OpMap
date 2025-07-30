# Formato de Importación de Visitas

## Columnas requeridas en el archivo Excel:

| Columna | Nombre | Tipo | Descripción | Ejemplo |
|---------|--------|------|-------------|---------|
| A | kam | Texto | KAM en formato "Kam [Ciudad]" | Kam Barranquilla |
| B | tipo_visita | Lista | Tipo de visita realizada | Visita efectiva |
| C | tipo_contacto | Lista | Modalidad de la visita | Visita presencial |
| D | latitud | Decimal | Coordenada latitud | 10.963889 |
| E | longitud | Decimal | Coordenada longitud | -74.796387 |
| F | fecha_reporte | Fecha | Fecha de la visita (YYYY-MM-DD) | 2024-01-15 |

## Valores permitidos:

### tipo_visita
- Visita efectiva
- Visita extra
- Visita no efectiva

### tipo_contacto
- Visita presencial
- Visita virtual

## Formato del KAM:
Use el formato estándar "Kam [Ciudad]":
- Kam Barranquilla
- Kam Bucaramanga
- Kam Cali
- Kam Cartagena
- Kam Cucuta
- Kam Medellin
- Kam Monteria
- Kam Neiva
- Kam Pasto
- Kam Pereira
- Kam Sincelejo
- Kam Chapinero
- Kam Engativa
- Kam Sancristobal
- Kam Kennedy
- Kam Valledupar

## Validaciones:
- **kam**: El sistema acepta las columnas kam_id, kam, o kam_name
- **latitud**: Entre -90 y 90
- **longitud**: Entre -180 y 180
- **fecha_reporte**: Formato YYYY-MM-DD

## Formato simplificado:
Este formato minimalista permite:
- Carga rápida de datos mensuales
- Identificación de zonas no visitadas
- Análisis de cobertura territorial
- Mapas de calor de actividad

## Notas importantes:
1. El archivo debe ser .xlsx o .xls
2. Solo se requieren 6 columnas de datos
3. No dejar filas vacías entre los datos
4. El sistema asocia automáticamente visitas con hospitales cercanos (máximo 5km)