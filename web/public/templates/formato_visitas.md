# Formato de Importación de Visitas

## Formato del Archivo

El archivo debe ser CSV (separado por punto y coma `;`) con las siguientes columnas:

| Columna | Descripción | Formato | Ejemplo |
|---------|-------------|---------|---------|
| **Representante** | KAM que realizó la visita | Kam [Ciudad] | Kam Barranquilla |
| **Tipo de visitas** | Tipo de visita realizada | Texto exacto | Visita efectiva |
| **Tipo de contacto** | Modalidad de la visita | Texto exacto | Visita presencial |
| **Latitud** | Coordenada latitud | Decimal | 10.963889 |
| **Longitud** | Coordenada longitud | Decimal | -74.796387 |
| **Fecha de la visita** | Fecha y hora de la visita | DD MMM YYYY HH:mm:ss | 23 Ene 2025 15:30:00 |

## Valores Permitidos

### Representante (KAM)
Debe usar el formato exacto "Kam [Ciudad]":
- Kam Barranquilla
- Kam Bucaramanga
- Kam Cali
- Kam Cartagena
- Kam Cúcuta (o Kam Cucuta)
- Kam Medellín (o Kam Medellin)
- Kam Montería (o Kam Monteria)
- Kam Neiva
- Kam Pasto
- Kam Pereira
- Kam Sincelejo
- Kam Valledupar
- Kam Chapinero
- Kam Engativá (o Kam Engativa)
- Kam San Cristóbal (o Kam San Cristobal)
- Kam Kennedy

### Tipo de visitas
- Visita efectiva
- Visita extra
- Visita no efectiva

### Tipo de contacto
- Visita presencial
- Visita virtual

## Ejemplo de Archivo CSV

```csv
Representante;Tipo de visitas;Tipo de contacto;Latitud;Longitud;Fecha de la visita
Kam Barranquilla;Visita efectiva;Visita presencial;10.963889;-74.796387;15 Ene 2024 09:00:00
Kam Cali;Visita extra;Visita virtual;3.451647;-76.531985;16 Ene 2024 14:30:00
Kam Engativá;Visita efectiva;Visita presencial;4.703464;-74.113736;17 Ene 2024 10:00:00
```

## Notas Importantes

1. **Separador**: El archivo debe usar punto y coma (`;`) como separador de columnas
2. **Formato de fecha**: DD MMM YYYY HH:mm:ss (ejemplo: 23 Ene 2025 15:30:00)
3. **Coordenadas**: Usar punto (`.`) como separador decimal
4. **Acentos**: Se aceptan tanto con acentos (Engativá) como sin acentos (Engativa)
5. **Mayúsculas/Minúsculas**: El sistema no distingue entre mayúsculas y minúsculas en el nombre del KAM

## Validaciones

El sistema validará:
- Que el KAM exista en el sistema
- Que las coordenadas sean válidas (latitud entre -90 y 90, longitud entre -180 y 180)
- Que los tipos de visita y contacto sean válidos
- Que la fecha sea válida

Los registros con errores serán reportados con el número de fila para facilitar la corrección.