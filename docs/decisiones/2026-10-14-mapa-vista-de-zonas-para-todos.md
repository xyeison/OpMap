# 2026-10-14 – Todos los que ven el mapa pueden verlo por zonas

**Contexto**: las líderes de línea solo veían en el mapa las zonas con un Ejecutivo Comercial de su línea. La vista
de zonas existía, pero solo para quien ve todas las líneas (`map:all-lines`). El dueño, con sus palabras: "yo quiero
que ellas tengan un espacio para poder ver todas las zonas cómo se distribuyen… en la leyenda, vista por zonas o por
ejecutivos comerciales".

**Decisión del dueño (2026-10-14)**:
1. **Selector en la leyenda:** la leyenda del mapa tiene "Ver por: Ejecutivos Comerciales | Zonas".
2. **Quién ve la vista de zonas:** todo el que tiene `map:view`. Muestra todas las zonas activas con su color de zona,
   sin importar quién las cubre.
3. **Cambio de estética autorizado:** este selector. Nada más del mapa cambia.

**Consecuencias**:
- Quien no ve todas las líneas no recibe la cobertura ni los Ejecutivos Comerciales de líneas que no ve. En la vista
  de zonas, sus tarjetas dicen "Ejecutivo Comercial (tus líneas)". Ese texto está pendiente de que el dueño lo
  confirme.
- Los contratos solo los recibe quien ya los recibía.
- El modo Regiones sigue solo para `map:all-lines`.
- RR. HH., que no tiene mapa, recibe 403 también en la API.

**Dónde vive en el código**:
- `web/app/api/map/data/route.ts`.
- `web/lib/map-view.ts`, en la función `resolveMapView`.
- `web/components/MapLegend.tsx`.
- La prueba `web/scripts/mapa-zonas-api-check.ts`.
- Detalle en `docs/specs/2026-10-14-mapa-vista-de-zonas-para-todos.md` y en `docs/mapa-estetica.md`.
