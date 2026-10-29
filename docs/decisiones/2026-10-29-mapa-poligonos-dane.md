# 2026-10-29 – Los polígonos del mapa son los municipios oficiales del DANE

**Contexto**: el dueño, con capturas de Zipaquirá y Nemocón: "Porque las lineas de los colores no respetan las
lineas fronterizas reales". El mapa pintaba sobre un archivo propio muy simplificado (Nemocón con 23 puntos, Zipaquirá
con 45) y con rendijas entre vecinos. Preguntó si con más detalle "se volverá lentísimo" y si el mapa no tenía ya los
vectores: el fondo de Esri son imágenes y sus líneas no sirven para pintar. Ante la propuesta (municipios del DANE,
fronteras compartidas, el peso de hoy en la vista de país y detalle al acercar, descarga de 72 MB del geoportal del
DANE) respondió "Si".

**Decisión**:
- Los polígonos salen del Marco Geoestadístico Nacional 2025 del DANE (`MGN2025_MPIO_GRAFICO.zip`).
- La vista de país pesa lo mismo que antes. Desde zoom 10 se pinta el detalle de los departamentos que se ven.
- Las localidades de Bogotá se ajustan al borde de Bogotá del DANE.
- Nuevo Belén de Bajirá (27493), que el DANE ya trae como municipio y la base no, se pinta dentro de Riosucio
  (27615), de donde salió.

**Consecuencias**:
- Solo cambia la forma de los bordes. No cambian colores, capas, reglas, asignaciones ni datos.
- Costo de Google: 0 USD.
- Agregar Nuevo Belén de Bajirá a la base queda para otra decisión, porque requiere una fila nueva, tiempos de Google y
  recálculo.
- Los polígonos ya no se editan a mano.

**Dónde vive en el código**:
- `web/scripts/build-geojson.ts` es el generador: hace la verificación de códigos, rendijas y encimes.
- `web/public/geo/` guarda los archivos generados.
- `web/lib/geo-detalle.ts` y `web/components/MapComponent.tsx` hacen la carga del detalle.
- La prueba que lo protege es `web/scripts/geo-detalle-check.ts`.
