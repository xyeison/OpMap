# 2026-10-28 – El mapa pinta cada Zona con su color también en la vista por Ejecutivos Comerciales

**Contexto**: el mapa tenía dos fuentes de color. En la vista de Zonas cada Zona iba con su color (`kams.color`). En la
vista por Ejecutivos Comerciales (por línea) iba con el color de la persona que la cubre (`executives.color`) y, si cubría
varias Zonas, con un tono de ese color por Zona (`zoneTint`, 2026-10-11). Al cambiar de vista, la misma Zona cambiaba de
color, y las 4 de Bogotá, cubiertas por una sola persona en cada línea, salían en tonos casi iguales (diferencia de
color de 2,2 a 3,7 en los municipios de alcance). El dueño: "Porque los colores cambian para mapa de ejecutivo
comerciales y Zonas. Deberia ser el mismo. Maneja el mismo color de Zonas."

**Decisión** (autorización explícita del dueño para este cambio de la estética):
1. En las dos vistas, una Zona cubierta se pinta con el color de la Zona (`kams.color`): polígonos, puntos de IPS,
   insignia, tarjeta y rayado de "sin equipo".
2. En la vista por línea los estados no cambian: sin cobertura, gris propio de la Zona (2026-10-23); conflicto, ámbar.
3. Leyenda y filtro de la vista por línea: el chip de cada Ejecutivo Comercial lleva el color de la Zona donde es local
   (si no es local en ninguna, el de la primera de sus Zonas por ciudad base); si cubre varias, una mini-muestra por
   Zona con el color de cada una. Sigue "(zona 2 de 4)" en la tarjeta.
4. Racimos (regla única para las dos vistas): con un solo color entre sus Zonas, ese color; con colores distintos,
   neutro (#334155); todas sin cobertura, hueco pizarra. En la vista de Zonas solo cambia algo si dos Zonas que se
   juntan tienen el mismo color (hoy todas son distintas); en la línea, un racimo de Zonas "sin datos" va en #cccccc.
5. Se quitan los tonos por Zona (`zoneTint`). `executives.color` sigue guardado, pero el mapa ya no lo usa.

**Consecuencias**:
- Las dos vistas se ven iguales salvo los estados de la línea (sin cobertura y conflicto). Lo que distingue a las
  personas en la vista por línea es la leyenda (chip, mini-muestras, "n zonas · m IPS"), el resaltado desde la leyenda,
  el filtro y la tarjeta.
- Nada más de la estética cambia: opacidades, bordes, capas, marcadores, insignias y globos.

**Dónde vive en el código**: `colorDeZonaEnLinea`, `colorDeEjecutivoEnLinea` y `colorDeRacimo` en
`web/components/mapStyles.ts` (pruebas en `web/scripts/mapa-estilo-check.ts`); `zoneLineColor`, leyenda y filtro en
`web/components/MapComponent.tsx`; racimos en `web/components/ZoneBadgeLayer.tsx`. Spec:
`docs/specs/2026-10-28-mapa-color-de-zona-en-las-dos-vistas.md`.
