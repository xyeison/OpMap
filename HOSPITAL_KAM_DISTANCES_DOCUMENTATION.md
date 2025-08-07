# 📊 DOCUMENTACIÓN: Tabla hospital_kam_distances

## ⚠️ IMPORTANTE: UNIDADES DE TIEMPO

**La tabla `hospital_kam_distances` almacena los tiempos de viaje en SEGUNDOS**

## Estructura de la Tabla

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID | Identificador único |
| `kam_id` | UUID | ID del KAM |
| `hospital_id` | UUID | ID del Hospital |
| `travel_time` | INTEGER | **Tiempo de viaje en SEGUNDOS** |
| `distance` | FLOAT | Distancia en kilómetros |
| `source` | TEXT | Fuente del cálculo (google_maps) |

## 🔄 Conversión de Unidades

### Para mostrar en la aplicación:

```javascript
// Convertir segundos a minutos
const minutes = Math.round(travel_time / 60);

// Convertir segundos a horas y minutos
const hours = Math.floor(travel_time / 3600);
const remainingMinutes = Math.floor((travel_time % 3600) / 60);

// Formato de visualización
const displayTime = hours > 0 
  ? `${hours}h ${remainingMinutes}min`
  : `${remainingMinutes} min`;
```

### En el algoritmo de asignación:

```typescript
// El límite máximo de tiempo debe estar en SEGUNDOS
const MAX_TRAVEL_TIME_SECONDS = 240 * 60; // 240 minutos = 14,400 segundos

// Comparar tiempos
if (travel_time <= MAX_TRAVEL_TIME_SECONDS) {
  // Asignar hospital al KAM
}
```

## 📈 Estadísticas Actuales

- **Total registros**: 8,163
- **Hospitales únicos**: 98
- **KAMs únicos**: 3
- **Rango de tiempos**: 60 - 46,672 segundos (1 min - 12.9 horas)

## 🚨 Notas Importantes

1. **NO convertir a minutos al guardar** - Mantener siempre en segundos en la base de datos
2. **Convertir solo para visualización** - El frontend debe hacer la conversión
3. **Límites en segundos** - Todos los límites de tiempo (max_travel_time) deben manejarse en segundos
4. **API responses** - Las APIs deben devolver los tiempos en segundos

## 🔧 Scripts de Mantenimiento

### Verificar rangos de tiempo:
```sql
-- Ver estadísticas de tiempos en segundos
SELECT 
  MIN(travel_time) as min_seconds,
  MAX(travel_time) as max_seconds,
  AVG(travel_time) as avg_seconds,
  MIN(travel_time)/60 as min_minutes,
  MAX(travel_time)/60 as max_minutes,
  AVG(travel_time)/60 as avg_minutes
FROM hospital_kam_distances
WHERE travel_time IS NOT NULL;
```

### Buscar tiempos sospechosos:
```sql
-- Tiempos mayores a 8 horas (28,800 segundos)
SELECT 
  h.name as hospital,
  k.name as kam,
  hkd.travel_time/60 as minutes,
  hkd.travel_time/3600 as hours
FROM hospital_kam_distances hkd
JOIN hospitals h ON h.id = hkd.hospital_id
JOIN kams k ON k.id = hkd.kam_id
WHERE hkd.travel_time > 28800
ORDER BY hkd.travel_time DESC;
```

## 📝 Historial de Cambios

- **2025-08-06**: Importación inicial de 8,163 registros desde CSV
- **2025-08-06**: Documentación de que la tabla usa SEGUNDOS
- **Anteriormente**: La tabla tenía mezcla de segundos y minutos (corregido)

## ⚠️ Tabla Deprecada

`travel_time_cache` está deprecada y puede ser eliminada. Usar únicamente `hospital_kam_distances`.