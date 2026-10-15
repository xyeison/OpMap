# Estética del mapa (estilo autorizado por el dueño)

_Extraído de CLAUDE.md el 2026-10-11 (texto íntegro, solo reubicado). Cualquier cambio al estilo necesita autorización explícita del dueño._

## VISUALIZACIÓN DEL MAPA - IMPORTANTE

### Estética del Mapa (MANTENER SIEMPRE)
Estilo autorizado por el dueño el 2026-10-11 (rama `ui/mapa-estetica`; constantes en
`web/components/mapStyles.ts`). Cualquier cambio a este estilo necesita una nueva autorización explícita.

- **Una sola fuente de color por vista**: `colorForZone` (`web/components/MapComponent.tsx`). Vista por
  línea: color del Ejecutivo Comercial que cubre la zona (`executives.color`), con un tono por zona si
  cubre varias (ver "Tonos por zona"); vista de zonas: color de la zona (`kams.color`); vista de
  regiones: color de la región. Polígonos, puntos de IPS, insignias, tooltips y tarjetas usan siempre
  ese mismo color.
- **"Ver por" en la leyenda** (autorizado por el dueño el 2026-10-14: "vista por zonas o por ejecutivos
  comerciales, y que pueda cambiar el plano"; spec `docs/specs/2026-10-14-mapa-vista-de-zonas-para-todos.md`):
  arriba de la leyenda (tarjeta de escritorio y hoja inferior de celular), un selector segmentado "Ver por"
  con dos botones, "Ejecutivos Comerciales" y "Zonas" (`aria-pressed`; 32 px de alto en escritorio, 44 px en
  celular; el activo en blanco con sombra suave sobre fondo gris claro). "Ejecutivos Comerciales" es la vista por
  línea de siempre, con el selector "Línea de negocio" debajo; "Zonas" es la vista de zonas (`?mode=zones`,
  colores de `kams.color`, todas las zonas activas) y oculta el selector de línea. Volver a "Ejecutivos
  Comerciales" deja la línea elegida o la primera de la persona. "Vista de zonas" ya no va dentro del selector de
  línea. La vista de zonas la ve todo el que tiene `map:view` (antes solo `map:all-lines`); a quien no tiene
  `map:all-lines`, `/api/map/data` no le trae la cobertura ni las personas de las líneas que no ve. Quien no tiene
  líneas ve en "No tienes líneas asignadas" el botón "Ver el mapa por zonas"; en la leyenda "Ejecutivos
  Comerciales" queda desactivado (`aria-disabled`, sigue recibiendo foco) con el motivo visible debajo: "Sin líneas
  de negocio asignadas: solo puedes ver el mapa por zonas." El modo Regiones (`&viewMode=zones`) sigue siendo solo de
  `map:all-lines`. Colores, opacidades, polígonos, puntos, insignias, racimos, filtros y la vista por línea no
  cambiaron.
  - **Textos de tarjetas y tooltips en la vista de zonas sin `map:all-lines` (PENDIENTE de confirmar por el
    dueño)**: el dueño autorizó el selector, no estos textos. Son consecuencia de la regla de la spec (no mostrar
    personas de líneas que no ve): como solo llegan las personas de SUS líneas, el texto de siempre ("Ejecutivo
    Comercial: sin ejecutivo local") diría algo falso en una zona donde vive alguien de otra línea. Por eso, solo
    para quien no tiene `map:all-lines` y solo en la vista de zonas, las tarjetas dicen "Ejecutivo Comercial (tus
    líneas)" (con "ninguno" si no vive ninguna persona de sus líneas en la zona), igual que la vista por línea dice
    "Ejecutivo Comercial (<línea>)", y los tooltips "sin Ejecutivo Comercial de tus líneas". Con `map:all-lines`, los
    textos de siempre. Si el dueño prefiere otra redacción, se cambia en `zoneExecutivesText` / `zoneExecutiveLabel`
    (`web/components/MapComponent.tsx`).
  - Quien no tiene líneas ni `contracts:view` (rol `user` sin ejecutiva enlazada ni línea liderada, que antes no
    abría el mapa) no recibe contratos (`contractsIncluded: false`): sus tarjetas no muestran "Contratos" y "Solo con
    Contratos" no sale en "Filtros y visitas". Todos los demás, lo de siempre.
- **Tonos por zona** (pedido del dueño 2026-10-11: "los 4 de Bogotá se deberían diferenciar por
  colores"): solo en la vista por línea, si un Ejecutivo Comercial cubre n > 1 zonas (cobertura local,
  reach o manual), cada zona usa `zoneTint(color, índice, n)` (`web/components/mapStyles.ts`): mismo
  matiz HSL, luminosidad desplazada según la secuencia [0, +18, -16, +32, -26, +40, -34] (se repite
  desde la 8.ª zona), acotada a [26, 78]; al aclarar, saturación +6 (máx. 95). El índice es la posición
  de la zona entre las del Ejecutivo Comercial ordenadas por ciudad base (`localeCompare` 'es'); la
  primera conserva el color base. Ej. PerOssal: Yineth (#d62728) → Chapinero #d62728, Engativá #e85c5d,
  Kennedy #a21e1e, San Cristóbal #f09293; María Isabel (#8c564b) → Ibagué #8c564b, Pereira #b87467. NO
  aplica a la vista de zonas ni a la de regiones, ni al chip e iniciales del Ejecutivo Comercial en la
  leyenda ni a su racimo (color base). En la leyenda, bajo "n zonas · m IPS", una mini-muestra por zona
  (12 px, iniciales de la ciudad base, `title` = ciudad): tocarla resalta solo esa zona; tocar la fila
  resalta todas. La tarjeta de la zona dice "(zona 2 de 4)" junto al nombre del Ejecutivo Comercial.
- **Polígonos** (municipios y localidades de Bogotá, mismo estilo): con IPS objetivo (ganador por la
  regla de mayoría) relleno 0.55; de alcance (sin IPS hoy) mismo color a 0.22. Borde blanco fino
  (0.6 px, opacidad 0.7); nunca bordes gris oscuro ni negros. Hover (solo con cursor): relleno +0.15 y
  borde blanco de 1.5 px. Resaltar un Ejecutivo Comercial / zona desde la leyenda deja el resto a 0.08.
- **Estados con color fijo**: vacante en la línea (o territorio solo con IPS sin zona): relleno pizarra
  sólido #94a3b8 a 0.5 en municipios con IPS y 0.3 en los de alcance de la zona vacante, con borde
  pizarra #64748b sólido de 0.8 px (no blanco) para que se lea como "hueco" a escala país (antes
  #cbd5e1 a 0.35: el dueño pidió el 2026-10-11 que Bucaramanga se viera más); sin rayado ni borde rojo;
  conflicto #f59e0b a 0.4; sin equipo: rayado del color de la zona (capa SVG);
  fuera de alcance #e5e7eb a 0.5 con borde #9ca3af discontinuo de 0.8 px; sin acceso terrestre #d1d5db
  a 0.45 con trama de puntos (patrón SVG); pendiente blanco a 0.3 con borde #e5e7eb (solo lo que de
  verdad falta calcular). Localidades de Bogotá sin IPS: la zona residente o, si no hay, la zona que gana
  Bogotá (fila 11001 de `municipality_zone`; respaldo: misma regla de mayoría sobre las 20 localidades),
  pintadas como alcance (0.22).
- **Puntos de IPS**: círculo del color de la vista (0.95) con borde blanco de 1.5 px; radio 4 px, 5.5 desde
  100 camas y 7 desde 300 camas; compactos (2.5 px) por debajo de zoom 6. IPS sin zona en la vista
  (incluye departamentos excluidos, p. ej. San Andrés): gris claro #9ca3af de 3.5 px (`IPS_UNZONED_COLOR`).
  IPS de una zona vacante en la línea: pizarra #64748b (`VACANT_STATE_COLOR`) a tamaño normal; la
  leyenda los explica en filas separadas ("IPS sin zona", "IPS de zona vacante en la línea"). En celular los
  puntos se ven desde zoom 5. Van en un panel SVG propio (`opmapIps`, z 460) por encima de los nombres;
  el panel no recibe eventos, solo los círculos. Tocar un punto abre su tarjeta (en táctil, área de toque
  transparente de 11 px).
- **Insignias de zona** (una por zona, en su ciudad base): círculo de 32 px (28 en celular) con las
  iniciales de la ciudad base ("Ba", "Cú", "SC"; si dos coinciden, la segunda usa otra letra: "Cr") en
  letra 600 de 12 px (11 en celular), texto blanco u oscuro (#111827) según cuál dé más contraste WCAG
  con el color de la vista (`readableTextColor`, también en racimos y chips de la leyenda; si ninguno
  llega a 4.5:1, negro puro, así todo color y todo tono pasa de 4.5:1), anillo blanco de 2 px, sombra
  suave y punta corta. Zona vacante en la línea: insignia hueca con anillo pizarra #475569 de 2.5 px
  (`VACANT_BADGE_COLOR`), fondo blanco a 0.95 y "—" #475569 en 700.
- **Racimos**: las insignias que se tocan en pantalla (distancia entre centros < diámetro + 6 px; en
  vertical se suma la punta) se agrupan en una insignia "racimo" de 34 px (30 en celular) con el número
  de zonas; color base del Ejecutivo Comercial (sin tonos) si todas son suyas, hueco pizarra (#475569)
  si todas son vacantes, si no #334155. Tocar un racimo acerca el mapa a sus zonas (máx. zoom 10); si ya no se separan (misma
  ubicación o zoom máximo) abre una tarjeta con la lista de sus zonas. Ninguna zona se oculta sin estar
  en un racimo. En escritorio a zoom 5 Bogotá se junta con Ibagué, Pereira, Cali y Neiva ("8") porque
  sus insignias se tocan de verdad; el mapa de escritorio abre en zoom 6, donde sale "4".
- **Tarjetas al tocar**: IPS, IPS sin zona, zona y territorio abren una tarjeta (`MapPopups.tsx`); con
  cursor hay además un tooltip corto.
- **Filtro por Ejecutivo Comercial** (pedido del dueño 2026-10-11: "los filtros no son por zona, sino por
  ejecutivo comercial"): primera sección de la pestaña "Filtros" (panel "Filtros y visitas" en
  escritorio; en celular, hoja inferior → "Filtros", filas de 44 px), componente
  `web/components/MapGroupFilter.tsx`. Vista por línea: lista de los Ejecutivos Comerciales de la línea
  (chip de color, iniciales, nombre, "n zonas · m IPS"), casillas múltiples, "Todos" / "Ninguno" y
  "Solo" por fila. A diferencia del resaltado de la leyenda (que atenúa), el filtro OCULTA: los
  polígonos de los demás quedan como contexto gris #f1f5f9 a 0.5 con el borde blanco de siempre
  (`FILTERED_OUT_*` en `mapStyles.ts`, sin tooltip ni tarjeta), y sus IPS e insignias no se dibujan
  (los racimos se recalculan solo con las insignias visibles). Fuera de alcance, sin acceso terrestre y
  pendientes no cambian. "Mostrar vacantes" (zonas vacantes en la línea e IPS sin zona): por defecto sí
  sin filtro y no con filtro; las zonas en conflicto solo se ven sin filtro. Las visitas (mapa de calor y
  marcadores) se piden y se filtran por las zonas que quedan visibles (ejecutiva → kam_id vía
  `coverage.rows`). Estado en la URL: `/map?line=<código>&exec=<id1,id2>` (UUID de `executives`,
  coma sin codificar; `exec=` vacío = ninguno marcado; sin `exec` = sin filtro); se escribe con
  `history.replaceState` (sin ir al servidor) y sobrevive a recargar y a compartir el enlace. Cambiar de
  línea o de vista quita el filtro. Con filtro, la leyenda muestra solo los filtrados, "Filtro: n de m"
  y "Quitar filtro"; el resaltado sigue funcionando dentro del filtro. En celular la barra de la hoja
  cambia el botón "Filtros" por el chip "n ejecutivas" (en escritorio el botón "Filtros y visitas" lleva
  el mismo chip). Vista de zonas (`&mode=zones`): misma lista y
  mismo comportamiento, pero por zona, en `&zones=<id1,id2>` (kam_id). Las tarjetas no cambian.
- **Bloque "IPS" (Fase 3, servicios y capacidad del REPS)**: en la pestaña "Filtros", debajo de "Tipo de
  Hospital": casillas "Con quirófano", "Ortopedia", "Neurocirugía", "Columna" y rango de camas (filas de
  44 px en celular). Misma regla que la lista de IPS (`web/lib/hospital-service-filters.ts`, Y lógico).
  Solo OCULTA puntos de IPS (con y sin zona) y cambia "Mostrando N hospitales"; territorios, colores,
  insignias y leyenda no cambian. Una IPS sin datos del REPS no pasa un filtro de servicio (el bloque
  dice cuántas hay). Estado solo en memoria (no va en la URL).
- **Capa de nombres**: Esri World Light Gray Reference (o `NEXT_PUBLIC_BASEMAP_LABELS_URL`) en un panel
  propio (z 450) encima de los polígonos y debajo de los puntos de IPS y de las insignias, sin recibir
  toques; se oculta con un fundido mientras dura el zoom. Usa partes internas de Leaflet
  (`_tiles`, `_pruneTiles`): revisar `MapLabelsLayer.tsx` al actualizar Leaflet.
- **NO agregar marcadores de población (👥)**
- **NO agregar capas o elementos visuales nuevos sin autorización explícita**

### Lógica de Coloreado de Territorios Compartidos
Para cualquier territorio (municipio o localidad) donde múltiples KAMs tienen IPS:

1. **Cada IPS se asigna individualmente** al KAM más cercano por tiempo de viaje
2. **El territorio se colorea** según el KAM que "ganó" más IPS individuales (regla de mayoría)
3. **NO es por cantidad total**: No importa cuántas IPS tenga un KAM en total
4. **ES por competencia directa**: Cuántas IPS de ESE territorio específico están más cerca de cada KAM

**Ejemplos correctos**:
- Localidad Teusaquillo tiene 15 IPS totales
  - KAM Chapinero es el más cercano a 14 de esas IPS → 14 puntos
  - KAM San Cristóbal es el más cercano a 1 de esas IPS → 1 punto
  - Teusaquillo se colorea con el color de Chapinero porque ganó 14 vs 1

- Municipio Ibagué tiene 15 IPS totales
  - KAM Pereira es el más cercano a 14 de esas IPS → 14 puntos
  - KAM Neiva es el más cercano a 1 de esas IPS → 1 punto
  - Ibagué se colorea con el color de Pereira porque ganó 14 vs 1

- Municipio Soacha tiene 4 IPS totales
  - KAM Kennedy es el más cercano a las 4 IPS → 4 puntos
  - Soacha se colorea con el color de Kennedy (cian)
