# Propuesta de Optimización OpMap

## Problemas actuales

1. **No detecta cambios de ubicación de KAM**
   - Si mueves un KAM, el sistema no sabe que debe recalcular
   - Debes hacer clic manual en "Recalcular Asignaciones"

2. **Recálculo ineficiente**
   - Recalcula TODAS las asignaciones (768 hospitales)
   - No distingue qué cambió específicamente

3. **Uso excesivo de Google Maps API**
   - Cada recálculo puede generar miles de consultas
   - No aprovecha que la mayoría de datos no cambian

## Soluciones propuestas

### 1. Detección automática de cambios

```typescript
// Agregar campo en tabla kams
ALTER TABLE kams ADD COLUMN location_hash VARCHAR(64);

// Al actualizar un KAM
const newHash = crypto.createHash('md5')
  .update(`${kam.lat},${kam.lng}`)
  .digest('hex');

if (oldHash !== newHash) {
  // Ubicación cambió - marcar para recálculo
  await markKamForRecalculation(kam.id);
}
```

### 2. Recálculo incremental

```typescript
// En lugar de recalcular TODO:
async function recalculateOnlyAffected(kamId: string) {
  // 1. Obtener hospitales actualmente asignados a este KAM
  const currentAssignments = await getAssignmentsByKam(kamId);
  
  // 2. Obtener hospitales en departamentos cercanos
  const nearbyHospitals = await getHospitalsNearKam(kamId);
  
  // 3. Recalcular solo estos hospitales (50-100 vs 768)
  await recalculateSpecificHospitals([
    ...currentAssignments,
    ...nearbyHospitals
  ]);
}
```

### 3. Caché inteligente con TTL

```typescript
// Agregar timestamp a travel_time_cache
ALTER TABLE travel_time_cache 
ADD COLUMN created_at TIMESTAMP DEFAULT NOW();

// Usar caché si es reciente
const CACHE_TTL_DAYS = 90; // 3 meses

if (cachedTime && daysSince(cachedTime.created_at) < CACHE_TTL_DAYS) {
  return cachedTime; // Usar caché
} else {
  // Consultar Google Maps solo si es necesario
  const newTime = await googleMapsAPI.getDistance(origin, dest);
  await updateCache(origin, dest, newTime);
}
```

### 4. Modo simulación

```typescript
// Botón "Simular cambios" antes de aplicar
async function simulateChanges(kamChanges: KamChange[]) {
  const affected = {
    hospitalsToReassign: [],
    newApiCallsNeeded: 0,
    estimatedCost: 0
  };
  
  // Mostrar preview sin hacer consultas reales
  return affected;
}
```

## Beneficios

1. **Reducción de costos**: 80-90% menos consultas a Google Maps
2. **Mayor velocidad**: Recálculos en segundos vs minutos
3. **Mejor UX**: Detección automática de cambios
4. **Transparencia**: Preview de cambios antes de aplicar

## Implementación por fases

**Fase 1**: Detección de cambios de ubicación (1 semana)
**Fase 2**: Recálculo incremental (2 semanas)
**Fase 3**: Caché con TTL (1 semana)
**Fase 4**: Modo simulación (1 semana)