# Pruebas del Control de Mapa de Calor

## Casos de Prueba

### 1. Mapa de calor sin filtros seleccionados
- [ ] Al marcar "Mostrar mapa de calor" sin meses seleccionados → Debe mostrar advertencia
- [ ] Al marcar "Mostrar mapa de calor" sin KAMs seleccionados → Debe mostrar advertencia
- [ ] No debe mostrar el mapa de calor si no hay filtros válidos

### 2. Mapa de calor con filtros válidos
- [ ] Seleccionar al menos un mes y un KAM
- [ ] Marcar "Mostrar mapa de calor" → Debe mostrar el mapa de calor
- [ ] Desmarcar "Mostrar mapa de calor" → Debe quitar el mapa de calor inmediatamente

### 3. Cambio de filtros con mapa de calor activo
- [ ] Con mapa de calor activo, quitar todos los meses → Debe ocultar el mapa de calor
- [ ] Con mapa de calor activo, quitar todos los KAMs → Debe ocultar el mapa de calor
- [ ] Volver a seleccionar filtros → Debe mostrar el mapa de calor nuevamente

## Correcciones Implementadas

1. **VisitsHeatmapLayer.tsx**:
   - Se limpia la capa anterior antes de crear una nueva
   - Se corrigió el problema de la función de limpieza que no removía la capa
   - Se usa una variable local `newHeatLayer` para evitar problemas con el estado

2. **MapComponent.tsx**:
   - Se simplificó la condición para mostrar el mapa de calor
   - Solo se muestra cuando `showHeatmap` es true Y hay visitas

3. **MapControls.tsx**:
   - Se agregaron mensajes de advertencia cuando el checkbox está marcado pero no hay filtros
   - Se limpian las visitas cuando no hay filtros válidos (meses o KAMs)
   - Se valida que haya al menos un mes Y un KAM seleccionado

## Estado Esperado

- ✅ El mapa de calor se quita correctamente al desmarcar el checkbox
- ✅ No se muestra el mapa de calor si no hay meses seleccionados
- ✅ No se muestra el mapa de calor si no hay KAMs seleccionados
- ✅ Se muestran mensajes de advertencia claros al usuario