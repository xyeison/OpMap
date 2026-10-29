# 2026-10-28 – Un municipio con la mayoría de sus IPS asignada se pinta con su Zona

**Contexto**: el tope de Bogotá en 6 h 20 dejó a 5 de las 7 IPS de Yopal en Bogotá Oriente. Las otras 2 quedaron a
6 h 20 y 6 h 21, sin Zona. En la vista de Zonas, el mapa pintaba como vacante (gris) cualquier territorio con al menos
una IPS sin zona, así que Yopal se veía gris aunque su municipio está en Bogotá Oriente. El dueño, con el mapa en el
celular: "Yopal tiene puntos [morados] pero el municipio aún está sin asignar". Ante la opción de cambiar la regla de
color: "Si si está asignada la mayoría si".

**Decisión**: un territorio (municipio o localidad) con IPS asignadas y otras sin zona se pinta con su Zona si la
mayoría está asignada. La mayoría se mide como en el resto del mapa: primero las camas asignadas contra las camas sin
zona; si empatan, el número de IPS. Un empate total no cuenta como mayoría. Si la mayoría está sin zona, sigue gris de
vacante, con la tarjeta "Zona sin Ejecutivo Comercial". Las IPS sin zona siguen como puntos grises. El tope de Bogotá
no cambia (6 h 20).

**Consecuencias**:
- Hoy solo cambia Yopal, el único territorio con IPS asignadas y sin zona a la vez. Tiene 204 camas asignadas contra
  124 sin zona, así que se pinta con Bogotá Oriente y su tarjeta dice "Zona: Bogotá Oriente".
- Colores, opacidades y capas no cambian; solo cambia cuándo se usa el estado vacante en la vista de Zonas. La vista
  por línea sigue con sus estados.

**Dónde vive en el código**: `mayoriaAsignada` en `web/lib/territory-rules.ts` (pruebas en
`web/scripts/mapa-estilo-check.ts`, sección 7). El mapa la aplica en `territoryAnalysis`, dentro de
`web/components/MapComponent.tsx`.
