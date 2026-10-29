# Estética del mapa (estilo autorizado por el dueño)

_Extraído de CLAUDE.md el 2026-10-11 (texto íntegro, solo reubicado). Cualquier cambio al estilo necesita autorización explícita del dueño._

## VISUALIZACIÓN DEL MAPA - IMPORTANTE

### Estética del Mapa (MANTENER SIEMPRE)
Estilo autorizado por el dueño el 2026-10-11 (rama `ui/mapa-estetica`; constantes en
`web/components/mapStyles.ts`). Cualquier cambio a este estilo necesita una nueva autorización explícita.

- **El mismo color de Zona en las dos vistas** (dueño, 2026-10-28: "Porque los colores cambian para mapa de ejecutivo
  comerciales y Zonas. Deberia ser el mismo. Maneja el mismo color de Zonas."; decisión
  `docs/decisiones/2026-10-28-mapa-un-color-por-zona.md`): `colorForZone` (`web/components/MapComponent.tsx`) da el
  color de la Zona (`kams.color`) en la vista de Zonas y en la vista por Ejecutivos Comerciales (línea). En la línea
  mandan los estados (`colorDeZonaEnLinea`, `web/components/mapStyles.ts`): sin cobertura, gris de la Zona; conflicto,
  ámbar; sin datos, #cccccc. Polígonos, puntos de IPS, insignias, tooltips, tarjetas y el rayado de "sin equipo" usan
  ese mismo color. El color del Ejecutivo Comercial (`executives.color`) ya no se usa en el mapa. Hasta esa fecha, la
  vista por línea pintaba con el color de la persona y un tono por zona (ver "Tonos por zona", superado).
  - *2026-10-28, pedido del dueño* ("Cambia los tonos de los colores de 4 zonas de bogotá para que se
    diferencie"): `kams.color` de las 4 zonas de Bogotá pasó a Chapinero `#2563EB` (azul, norte), Engativá
    `#16A34A` (verde, occidente), Kennedy `#DC2626` (rojo, sur) y San Cristóbal `#9333EA` (morado, oriente),
    para que se distingan entre sí y de sus vecinas (Engativá se confundía con Cúcuta, Chapinero con Medellín y
    Kennedy con Bucaramanga). Colores anteriores y cifras en `docs/decisiones/2026-10-28-colores-zonas-bogota.md`.
    Es un cambio de datos (como editarlos en `/kams/colors`); opacidades, bordes y capas siguen igual.
- **Sin modo Regiones** (quitado por pedido del dueño del 2026-10-14: "Eso de región deberíamos quitarlo al fin";
  spec `docs/specs/2026-10-14-quitar-regiones.md`): ya no existe la vista de regiones (`?viewMode=zones`, color de la
  región de cada zona, leyenda "Regiones", título "Vista de regiones"); un `?viewMode=zones` viejo en la URL no hace
  nada y el mapa ya no llama a `/api/zones`. La vista por línea y la vista de zonas (`?mode=zones`, colores de
  `kams.color`) no cambiaron en nada: ni colores, ni opacidades, ni capas, ni marcadores.
- *(Desde el 2026-10-29 "Ver por" y la línea de negocio están en Filtros → "Vista", no en la leyenda; mismos botones y
  mismo comportamiento: ver "2026-10-29 · Una sola lista (en la leyenda), un panel de Filtros y un buscador".)*
  **"Ver por" en la leyenda** (autorizado por el dueño el 2026-10-14: "vista por zonas o por ejecutivos
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
  de negocio asignadas: solo puedes ver el mapa por zonas." (El modo Regiones, `&viewMode=zones`, se quitó el
  2026-10-14: ver "Sin modo Regiones".) Colores, opacidades, polígonos, puntos, insignias, racimos, filtros y la vista
  por línea no cambiaron.
  - **Textos de tarjetas y tooltips en la vista de zonas sin `map:all-lines` (PENDIENTE de confirmar por el
    dueño)**: el dueño autorizó el selector, no estos textos. Son consecuencia de la regla de la spec (no mostrar
    personas de líneas que no ve): como solo llegan las personas de SUS líneas, el texto de siempre ("Ejecutivo
    Comercial: sin ejecutivo local") diría algo falso en una zona donde vive alguien de otra línea. Por eso, solo
    para quien no tiene `map:all-lines` y solo en la vista de zonas, las tarjetas dicen "Ejecutivo Comercial (tus
    líneas)" (con "ninguno" si no vive ninguna persona de sus líneas en la zona), igual que la vista por línea dice
    "Ejecutivo Comercial (<línea>)", y los tooltips "sin Ejecutivo Comercial de tus líneas". Con `map:all-lines`, los
    textos de siempre. Si el dueño prefiere otra redacción, se cambia en `zoneExecutivesText` / `zoneExecutiveLabel`
    (`web/components/MapComponent.tsx`).
  - *(Superado el 2026-10-24.)* Hasta esa fecha, quien no tenía líneas ni `contracts:view` no recibía los contratos
    cargados a mano (`contractsIncluded: false`) y los demás veían la fila "Contratos" y el interruptor "Solo con
    Contratos". Desde el 2026-10-24 el mapa no manda contratos a nadie: la fila, la sección "Contratos activos" y el
    interruptor desaparecieron y las tarjetas muestran giros ADRES y compras SECOP de 12 meses (ver "2026-10-24 ·
    Giros ADRES y compras SECOP en las tarjetas").
- *(Superado el 2026-10-28: cada zona va con su propio color en las dos vistas; `zoneTint` se quitó. Sigue "(zona 2 de
  4)" en la tarjeta; la mini-muestra por zona de la leyenda se quitó el 2026-10-29 con el resaltado. El chip del
  Ejecutivo Comercial en la leyenda y el filtro lleva el color de la Zona donde es local; si no es local en ninguna, el
  de la primera de sus Zonas — `colorDeEjecutivoEnLinea`.)* **Tonos por zona** (pedido del dueño 2026-10-11: "los 4 de
  Bogotá se deberían diferenciar por colores"): solo en la vista por línea, si un Ejecutivo Comercial cubre n > 1 zonas (cobertura local,
  reach o manual), cada zona usa `zoneTint(color, índice, n)` (`web/components/mapStyles.ts`): mismo
  matiz HSL, luminosidad desplazada según la secuencia [0, +18, -16, +32, -26, +40, -34] (se repite
  desde la 8.ª zona), acotada a [26, 78]; al aclarar, saturación +6 (máx. 95). El índice es la posición
  de la zona entre las del Ejecutivo Comercial ordenadas por ciudad base (`localeCompare` 'es'); la
  primera conserva el color base. Ej. PerOssal: Yineth (#d62728) → Chapinero #d62728, Engativá #e85c5d,
  Kennedy #a21e1e, San Cristóbal #f09293; María Isabel (#8c564b) → Ibagué #8c564b, Pereira #b87467. NO
  aplica a la vista de zonas, ni al chip e iniciales del Ejecutivo Comercial en la
  leyenda ni a su racimo (color base). En la leyenda, bajo "n zonas · m IPS", una mini-muestra por zona
  (12 px, iniciales de la ciudad base, `title` = ciudad): tocarla resalta solo esa zona; tocar la fila
  resalta todas. La tarjeta de la zona dice "(zona 2 de 4)" junto al nombre del Ejecutivo Comercial.
- **Polígonos** (municipios y localidades de Bogotá, mismo estilo): con IPS objetivo (ganador por la
  regla de mayoría) relleno 0.55; de alcance (sin IPS hoy) mismo color a 0.22. Borde blanco fino
  (0.6 px, opacidad 0.7); nunca bordes gris oscuro ni negros. Hover (solo con cursor): relleno +0.15 y
  borde blanco de 1.5 px. Fuera de "Ver solo" el territorio queda con su color a 0.08 (desde el 2026-10-29; antes era el
  resaltado desde la leyenda).
- **Estados con color fijo**: vacante en la línea (o territorio solo con IPS sin zona, o cuya mayoría de IPS está sin
  zona; desde el 2026-10-28 un territorio con la mayoría asignada se pinta con su Zona, `mayoriaAsignada`): relleno pizarra
  sólido #94a3b8 a 0.5 en municipios con IPS y 0.3 en los de alcance de la zona vacante, con borde
  pizarra #64748b sólido de 0.8 px (no blanco) para que se lea como "hueco" a escala país (antes
  #cbd5e1 a 0.35: el dueño pidió el 2026-10-11 que Bucaramanga se viera más); sin rayado ni borde rojo;
  conflicto #f59e0b a 0.4; sin equipo: rayado del color de la zona (capa SVG);
  fuera de alcance #e5e7eb a 0.5 con borde #9ca3af discontinuo de 0.8 px; sin acceso terrestre #d1d5db
  a 0.45 con trama de puntos (patrón SVG); pendiente blanco a 0.3 con borde #e5e7eb (solo lo que de
  verdad falta calcular). Localidades de Bogotá sin IPS: la celda de su sector (corredor) según el último
  recálculo (desde el 2026-10-28, `CORREDOR_DE_LOCALIDAD`; hoy Santa Fe, La Candelaria, Usme y Sumapaz, del
  Oriente); si no está, la zona residente; si no, la zona que gana Bogotá (fila 11001 de `municipality_zone`;
  respaldo: misma regla de mayoría sobre las 20 localidades), pintadas como alcance (0.22). Las insignias de las
  Zonas de Bogotá llevan su sector (N, Oc, S, Or; `bogotaSectorInitials`), no la localidad de su punto base.
- **Puntos de IPS**: círculo del color de la vista (0.95) con borde blanco de 1.5 px; radio 4 px, 5.5 desde
  100 camas y 7 desde 300 camas; compactos (2.5 px) por debajo de zoom 6. IPS sin zona en la vista
  (incluye departamentos excluidos, p. ej. San Andrés): gris claro #9ca3af de 3.5 px (`IPS_UNZONED_COLOR`).
  IPS de una zona vacante en la línea: pizarra #64748b (`VACANT_STATE_COLOR`) a tamaño normal; la
  leyenda los explica en filas separadas ("IPS sin zona", "IPS de Zona sin cobertura en la línea"). En celular los
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
  de zonas; el color de sus Zonas si todas tienen el mismo (desde el 2026-10-28, `colorDeRacimo`; antes, el color
  base del Ejecutivo Comercial si todas eran suyas), hueco pizarra (#475569) si todas son vacantes, si no #334155. Tocar un racimo acerca el mapa a sus zonas (máx. zoom 10); si ya no se separan (misma
  ubicación o zoom máximo) abre una tarjeta con la lista de sus zonas. Ninguna zona se oculta sin estar
  en un racimo. En escritorio a zoom 5 Bogotá se junta con Ibagué, Pereira, Cali y Neiva ("8") porque
  sus insignias se tocan de verdad; el mapa de escritorio abre en zoom 6, donde sale "4".
- **Tarjetas al tocar**: IPS, IPS sin zona, zona y territorio abren una tarjeta (`MapPopups.tsx`); con
  cursor hay además un tooltip corto.
- *(Superado el 2026-10-29 por "Ver solo" en la lista de la leyenda: ver "2026-10-29 · Una sola lista (en la leyenda),
  un panel de Filtros y un buscador". Siguen la URL `exec=` / `zones=`, "Mostrar vacantes" (desde ese día "Sin
  cobertura e IPS sin Zona") y las visitas por zonas visibles; la lista sale de Filtros, el chip "n ejecutivas" pasa al subtítulo de la leyenda y se quitan las casillas,
  el gris #f1f5f9 y el resaltado de la leyenda.)* **Filtro por Ejecutivo Comercial**
  (pedido del dueño 2026-10-11: "los filtros no son por zona, sino por
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
- **Bloque "IPS" (Fase 3, servicios y capacidad del REPS)**: en la pestaña "Filtros", debajo de "Tipo"
  (antes "Tipo de Hospital"; desde el 2026-10-29 en la misma sección "IPS"): casillas "Con quirófano", "Ortopedia", "Neurocirugía", "Columna" y rango de camas (filas de
  44 px en celular). Misma regla que la lista de IPS (`web/lib/hospital-service-filters.ts`, Y lógico).
  Solo OCULTA puntos de IPS (con y sin zona) y cambia "Mostrando N IPS en el mapa"; territorios, colores,
  insignias y leyenda no cambian. Una IPS sin datos del REPS no pasa un filtro de servicio (el bloque
  dice cuántas hay). Estado solo en memoria (no va en la URL).
- **Capa de nombres**: Esri World Light Gray Reference (o `NEXT_PUBLIC_BASEMAP_LABELS_URL`) en un panel
  propio (z 450) encima de los polígonos y debajo de los puntos de IPS y de las insignias, sin recibir
  toques; se oculta con un fundido mientras dura el zoom. Usa partes internas de Leaflet
  (`_tiles`, `_pruneTiles`): revisar `MapLabelsLayer.tsx` al actualizar Leaflet.
- **NO agregar marcadores de población (👥)**
- **NO agregar capas o elementos visuales nuevos sin autorización explícita**

### 2026-10-23 · Grises por Zona en la vista por línea

Autorizado por el dueño el 2026-10-23 (decisión `docs/decisiones/2026-10-23-zonas-por-linea-las-lideres-asignan.md`,
spec `docs/specs/2026-10-23-zonas-por-linea-para-lideres.md`). Con sus palabras: "yo diría que borrarla [la asignación
de líneas] y que ellas tengan una opción de ver todas las zonas. Sí, las zonas se van a ver grises. Pero vas a tener que
manejar distintos tonos de grises para que ellos las puedan ver". Es el único cambio a la estética del 2026-10-11, y
solo en la vista por línea:

- **Qué cambia**: una Zona **sin cobertura** en la línea (`coverage.kind = 'vacant'`: nadie la lleva dentro del tope)
  ya no va en el pizarra único #94a3b8, sino en **gris con un tono distinto por Zona**, para que las líderes las
  distingan mientras redistribuyen las líneas desde "Zonas". Lo usan el relleno de sus municipios (con las opacidades
  de siempre: 0.5 con IPS, 0.3 de alcance), sus puntos de IPS (tamaño normal), su insignia hueca (anillo y "—") y el
  punto de color de su tarjeta.
- **Cómo se calcula**: `grisDeZona(kam_id, zonas)` en `web/components/mapStyles.ts`: luminosidad HSL en rampa del 42 %
  al 80 % sobre las Zonas recibidas ordenadas por su nombre visible (`zoneDisplayName`, `localeCompare` 'es'; desempate
  por id), saturación 8 % y el matiz del color propio de la Zona (`kams.color`; 160 si falta o no es #RRGGBB). Con una
  sola Zona, luminosidad 61 %. Determinista: la misma Zona da el mismo gris sea cual sea el orden de entrada, y con 16
  Zonas salen 16 valores distintos (`scripts/mapa-estilo-check.ts`). El mapa le pasa las Zonas de `/api/map/data`
  (activas con territorio) y convierte el `hsl()` a #RRGGBB (`MapComponent.tsx`, `hslCssToHex`) porque `safeColor`, las
  muestras de la leyenda y los patrones SVG de "sin equipo" solo aceptan hexadecimal.
- **Qué NO cambia**: el borde pizarra #64748b de 0.8 px de la Zona sin cobertura; el "IPS sin Zona" (territorio que
  solo tiene IPS sin zona, también en la vista de zonas) sigue en pizarra #94a3b8 con sus IPS #9ca3af; el racimo en
  que todas las insignias son huecas sigue en #475569 (`ZoneBadgeLayer.tsx`); conflicto, sin equipo, fuera de alcance,
  sin acceso terrestre, pendiente, opacidades, tonos por zona (`zoneTint`), filtros, racimos, tarjetas y la vista de
  zonas quedan como el 2026-10-11.
- **Textos**: la leyenda dice "Sin cobertura en esta línea (gris, un tono por Zona)" (antes "Vacante en esta línea (sin
  Ejecutivo Comercial)") e "IPS sin Zona" (antes "Vacante (IPS sin zona)"); el tooltip de la insignia, "Sin cobertura en
  esta línea"; la tarjeta, "Sin cobertura (más cercana: <nombre> a 4 h 39)" o "Sin cobertura (nadie lleva esta línea)".
  "Vacante" queda solo para la persona por contratar (`executives.status = 'placeholder'`).

### 2026-10-24 · Giros ADRES y compras SECOP en las tarjetas (contenido, no estilo)

Pedido del dueño el 2026-10-24 (spec `docs/specs/2026-10-24-mapa-giros-y-compras-12-meses.md`, decisión
`docs/decisiones/2026-10-24-mapa-giros-y-compras.md`). Con sus palabras: "tenemos una información de contratos y
proveedores con nombre propio […] está súper desactualizado. […] Yo quiero que ESA [giros de la ADRES y SECOP] sea la
información que sale en el mapa […] si le doy clic al municipio, que me diga cuánto tiene en total en giros, cuánto en
compras, cuáles son los proveedores. SECOP trae cosas viejísimas; quiero los últimos 12 meses". **No cambia nada del
estilo autorizado el 2026-10-11**: polígonos, puntos, insignias, racimos, colores, opacidades, capas y globos (tooltips,
siguen sin cifras) quedan igual y `scripts/mapa-estilo-check.ts` sigue en verde. Cambia solo el CONTENIDO de las tarjetas
que ya existían, con los estilos `.opmap-popup__section`, `__section-title`, `__rows`, `__row--stacked`, `__note` y
`__secondary` que ya había en `web/app/globals.css` (ningún color ni clase nueva).

- **Qué se quitó**: la fila "Contratos" de las dos tarjetas de IPS, la sección "Contratos activos" de la tarjeta de
  municipio o localidad y el interruptor "Solo con Contratos" de "Filtros y visitas". Eran los contratos cargados a mano
  (`hospital_contracts`: 92 "activos" vencidos, sin editar desde 2025-12-30) y ya no viajan en `/api/map/data`.
- **Qué se añadió** (`GirosComprasSection` en `web/components/MapPopups.tsx`), solo para quien tiene `intelligence:view`
  (`/api/map/data` lo dice con `inteligenciaIncluida`; sin el permiso, la tarjeta de siempre, sin llamada y sin error):
  - Tarjeta de municipio o localidad con IPS: debajo de "Estadísticas hospitalarias" y antes de "Población", la sección
    "Giros ADRES · oct-2025 a sep-2026" (Total, Contributivo, Subsidiado, Otro, "NIT con giro: n de m", último giro) y la
    sección "Compras públicas de material ortopédico y neurocirugía (SECOP) · nov-2025 a hoy" (Valor adjudicado,
    Contratos, Entidades; proveedores empresa ordenados por valor con NIT, contratos, último contrato, líneas y la marca
    "Vigilado"; 5 visibles y "Ver los N proveedores" dentro de la tarjeta; aparte y en una línea "Sin clasificar
    (proveedores vigilados)", "Servicios de especialistas" y "Personas naturales", siempre sin nombres). Pie "Fuentes:
    ADRES Identifica tu Giro (giro del NIT repartido por camas) · SECOP I/II (valor adjudicado)" con el rango de cada una.
  - Tarjeta de IPS (con Zona y sin Zona): debajo de "Tiempo de llegada", las mismas dos secciones con la parte de LA
    SEDE (giro del NIT repartido por camas entre sus sedes activas; si son varias, "Parte de esta sede: 1 de n sedes del
    NIT X, reparto por camas. La ficha muestra el NIT completo."). IPS privada → solo giros y "IPS privada: sin
    contratación pública (SECOP)"; pública sin hechos en la ventana → "Sin contratos de ortopedia o neurocirugía en SECOP
    en los últimos 12 meses" (nunca "sin compras"). El botón "Ver ficha →" sigue igual.
  - Municipio con IPS pero ninguna pública: los giros y la línea "Sin entidades públicas de compra en OpMap en este
    municipio". Municipio de alcance sin IPS (tarjeta `kind:'other'`): una sola línea, "Giros y compras se cuentan donde
    está la IPS; este municipio no tiene IPS en OpMap", sin llamada.
  - Estados visibles: "Cargando giros y compras…" y "No se pudieron cargar · Reintentar". Los dos botones de texto
    ("Reintentar", "Ver los N proveedores") van subrayados, con el color del texto de la nota, sin estilo nuevo.
- **Cómo llega el dato**: carga perezosa al abrir la tarjeta (`useQuery(['map-detalle', tipo, code])`, 5 min de caché,
  patrón de `unassigned-optimized`): `GET /api/map/detalle/territorio?tipo=municipio|localidad&code=…` y
  `GET /api/map/detalle/ips/[id]`. Los globos (tooltips) y `territoryTooltipHtml` no cambian.


**Alto de las tarjetas (2026-10-25, arreglo de uso, sin cambio de colores ni capas).** Con giros, compras y proveedores una
tarjeta de municipio llegaba a 1.248 px y su final (lo aparte, las fuentes, la población y la Zona) quedaba fuera de la
pantalla sin forma de verlo. Ahora la tarjeta tiene un alto máximo (el del mapa menos los márgenes del encuadre, y en
celular menos la hoja inferior) y se desplaza por dentro; se vuelve a medir cuando llegan los datos o se despliegan todos
los proveedores (`popupMaxHeight` y `MapPopup` en `components/MapPopups.tsx`).

### 2026-10-25 · Procesos de SECOP II sin contrato en las tarjetas (contenido, no estilo)

Pedido del dueño el 2026-10-25 (spec `docs/specs/2026-10-25-secop-procesos-radar.md`, decisión
`docs/decisiones/2026-10-25-procesos-secop-radar-comercial.md`): "por lo menos le das herramienta al comercial para que se
pregunte quién es VG Medical". 83 de las 141 IPS públicas publican en SECOP II solo el proceso (régimen especial) y nunca
el contrato, así que la tarjeta decía "Sin contratos…" aunque la entidad compra. **No cambia nada del estilo autorizado el
2026-10-11** (colores, opacidades, capas, marcadores, insignias, racimos y globos sin cifras siguen igual;
`scripts/mapa-estilo-check.ts` en verde): cambia el CONTENIDO de las tarjetas de IPS (con y sin Zona) y de municipio o
localidad, con las clases `.opmap-popup__section`, `__section-title`, `__rows`, `__row--stacked`, `__note` y `__secondary`
que ya había (ninguna clase ni color nuevo).

- **Desde el 2026-10-25 (pedido del dueño: "súper conciso, que vea el nombre de las empresas") la tarjeta del mapa solo
  lista empresas**: título "Empresas en procesos sin contrato (SECOP II) · nov-2025 a hoy", una empresa por línea en
  negrita (`.opmap-popup__empresas`, la única clase nueva: lista sin viñetas de 13 px) con "(N)" si figura en varios
  procesos, 6 visibles y "Ver las N empresas", "N procesos sin empresa publicada" y el aviso "Figuran en procesos
  publicados sin contrato registrado. Confirmar con la entidad." Sin precio base, fechas, referencias ni enlaces: el
  detalle por proceso queda en la ficha de la IPS (`HospitalProcesosCard`). Lo que sigue describe la primera versión,
  reemplazada:
- **Sección nueva, primera versión** (`ProcesosSection` en `web/components/MapPopups.tsx`; textos en `web/lib/mapa-procesos-ui.ts` y
  `MAPA_DETALLE_TEXTOS`), justo debajo de "Compras públicas…" y antes de las notas y el pie de fuentes:
  - Título "Procesos publicados sin contrato (SECOP II) · nov-2025 a hoy" (la ventana de SECOP del mapa: 12 meses por
    fecha de publicación) y la nota fija "Precio base de la convocatoria. La entidad no registró el contrato en SECOP:
    confirmar con la entidad. No suma a las compras."
  - Cada fila: el proveedor que FIGURA como rótulo ("VG MEDICAL SAS"; "… · según el título del proceso" si salió del
    título; "· Vigilado" si está en la lista vigilada; "Proveedor persona natural", sin nombre ni documento; "Proveedor no
    publicado" si no hay), "Precio base $ 1,8 mil M · publicado 10 mar 2026" y, en gris, la entidad (solo en la tarjeta de
    municipio o localidad, con el nombre de la IPS en OpMap), las líneas y "Ref. 000039-2026"; debajo el enlace "Ver
    proceso" (expediente en SECOP, otra pestaña, `rel="noopener noreferrer"`).
  - Más recientes primero; 3 visibles y "Ver los N procesos" / "Ver menos" dentro de la tarjeta (el servidor manda como
    máximo 20; si hay más, "Se muestran los 20 más recientes de N"). El precio base nunca se suma: no hay total de valor.
  - **Sin procesos no aparece nada** (ni título ni "sin procesos"): tampoco en IPS privadas, marcadas "No" o sin NIT.
    Nunca "abierto", "en curso", "licitación" ni "adjudicado a"; el título del proceso no se muestra.
- **Quién la ve**: con `intelligence:view`, debajo de giros y compras; con solo `secop:procesos` (Ejecutivos Comerciales,
  `sales_manager`) la tarjeta muestra SOLO esta sección (ni giros ni compras; mientras carga, "Cargando procesos…"). Sin
  ninguno de los dos, la tarjeta de siempre, sin llamada. `/api/map/data` lo dice con `procesosIncluidos`.
- **Cómo llega el dato**: en la misma llamada perezosa de giros y compras (`GET /api/map/detalle/*`, campo `procesos` y
  `alcance` 'completo' o 'procesos'); sin la migración 0890 llega `procesos: null` y la tarjeta queda como antes.

### 2026-10-28 · Buscador de municipios (control nuevo, pedido del dueño)

- Pedido: "si alguien esta en el mapa y escribe 'Yop' que pueda salir los municipios y si le doy clic que me lleve a ese
  municipio con zoom moderado". Spec: `docs/specs/2026-10-28-mapa-buscar-municipio.md`.
- Campo "Buscar municipio…" sobre el mapa: arriba a la derecha, junto al zoom, en escritorio (320 px), y a lo ancho
  arriba en el teléfono. Mismo estilo de tarjeta que la leyenda: blanco 95 %, borde gris, sombra suave, 44 px de alto.
- Busca sin tildes ni mayúsculas en los 1.120 municipios, las 20 localidades y la ciudad de Bogotá; como mucho 8
  resultados, "Nombre, Departamento". Lógica en `web/lib/buscar-territorios.ts`, con pruebas en
  `web/scripts/mapa-buscar-check.ts`.
- Al elegir, el mapa encuadra el polígono con `flyToBounds`: hasta zoom 11 para un municipio o la ciudad y 13 para una
  localidad, dejando libres el buscador, la leyenda (escritorio) y la hoja inferior (teléfono). No resalta, no abre
  tarjeta ni añade capas o marcadores.
- *(Desde el 2026-10-29 es el único buscador: encuentra también departamentos e IPS y la pestaña "Buscar" de "Filtros
  y visitas" se quitó. Ver "2026-10-29 · Una sola lista (en la leyenda), un panel de Filtros y un buscador".)*

### 2026-10-29 · Fronteras oficiales del DANE (forma de los bordes, no estilo)

- Pedido: "Porque las lineas de los colores no respetan las lineas fronterizas reales" (Zipaquirá y Nemocón); el
  dueño dijo "Si" el 2026-10-29. Spec: `docs/specs/2026-10-29-mapa-poligonos-dane.md`. Decisión:
  `docs/decisiones/2026-10-29-mapa-poligonos-dane.md`.
- Los polígonos salen del Marco Geoestadístico Nacional 2025 del DANE (capa `MGN_ADM_MPIO_GRAFICO`) y los genera
  `web/scripts/build-geojson.ts`. No se editan a mano: se vuelven a generar con el script.
- Vista de país (`public/geo/municipios.json` y `localidades.json`): umbral de 600 m (las localidades, 150 m),
  1,40 MB y 0,38 MB con gzip; antes pesaba 1,47 MB y 0,40 MB. Desde zoom 10 (`DETALLE_ZOOM`) el mapa pide
  `public/geo/detalle/<dd>.json` (umbral de 30 m; Cundinamarca 1,09 MB, 0,33 MB con gzip) de cada departamento con algún
  municipio a la vista (11 = las localidades) y al alejar vuelve a la vista de país (`web/lib/geo-detalle.ts`).
- El detalle cambia por lotes: se pinta cuando llegaron todos los departamentos que se ven; mientras tanto sigue el
  lote anterior y, si uno falla, vuelve la vista de país. Una capa por departamento: el detalle de uno llega sin volver
  a crear los demás. Cada capa de polígonos que entra se manda al fondo del canvas, para que las visitas queden encima.
  El rayado "sin equipo" y la trama "sin acceso terrestre" usan la misma geometría que el relleno.
- Cada nivel sale de una sola pasada de mapshaper sobre todo el país: los vecinos comparten la misma frontera, sin
  rendijas ni encimes. El generador lo mide; las pruebas están en `web/scripts/geo-detalle-check.ts`.
- Localidades: recortadas con el polígono de Bogotá del DANE; cada pedazo de Bogotá que ninguna cubría pasa a la
  localidad con la que comparte más frontera.
- Nuevo Belén de Bajirá (27493) no está en la base: su área se pinta dentro de Riosucio (27615).
- No cambian los colores, las opacidades, el borde blanco de 0,6 px, las capas, las tarjetas ni el buscador.

### 2026-10-29 · Una sola lista (en la leyenda), un panel de Filtros y un buscador (organización, no estilo)

- Pedido del dueño: "Yo dejaría un tema de leyendas, solamente las leyendas, y tendría filtros y vistas aparte… Si yo
  solamente voy a ver a Johanna, solamente debería verse la zona que tiene ella asignada… se pone lo demás blanco"; dijo
  "Sí, hazlo así" el 2026-10-29. Al ver la primera versión pidió no repetir la lista: "no noto que haya simplificado
  nada… tienes en la pestaña de filtros y visitas las opciones de elegir a los ejecutivos comerciales. También en
  Leyenda lo tienes". Spec: `docs/specs/2026-10-29-mapa-filtros-y-leyenda.md`.
- **Leyenda** (`web/components/MapLegend.tsx`): arriba, la ÚNICA lista de personas (vista por línea) o de Zonas (vista
  de zonas), con su chip, iniciales y "n zonas · m IPS" (`MapGroupFilter.tsx`, regla en `web/lib/mapa-ver-solo.ts`,
  pruebas en `web/scripts/mapa-filtros-check.ts`). Quien cubre varias Zonas lleva debajo una mini-muestra por Zona
  (12 px, su color y las iniciales de su insignia, como pide la decisión del 2026-10-28), ahora solo para leer: ya no
  resaltan una Zona sola. Es la clave de colores y "Ver solo": filas que se tocan
  (`aria-pressed`, 34 px; 44 px en celular). Sin filtro, tocar a alguien deja solo a esa persona; tocar otra la suma;
  tocar una marcada la quita; si no queda nadie, o si quedan todas, vuelve a todo. "Ver todos" quita el filtro; con
  filtro, las no marcadas van atenuadas y dice "Viendo 1 de 11". Reemplaza las casillas de Filtros ("Todos", "Ninguno",
  "Solo") y el resaltado de la leyenda. Debajo, los estados, los marcadores y las notas de siempre, sin botones. Con
  filtro, el subtítulo de la tarjeta de escritorio dice "Sustitutos óseos · 1 ejecutiva" (se lee también plegada) y
  el de la hoja del celular "Ver solo: <nombre>".
- **Panel "Filtros y visitas"** (escritorio: el panel flotante; celular: hoja inferior → "Filtros"). Pestaña
  "Filtros", en orden:
  1. **Vista** (`MapVista.tsx`): "Ver por" (Ejecutivos Comerciales o Zonas) y "Línea de negocio", los mismos botones y
     el mismo selector que estaban en la leyenda.
  2. **Mostrar** (`MapSwitch.tsx`): "Puntos de IPS", "Municipios de alcance" y "Sin cobertura e IPS sin Zona" (en la
     vista de zonas, "IPS sin Zona"; antes "Mostrar vacantes": "vacante" es solo la persona por contratar, regla del
     2026-10-23). Por defecto sí sin filtro y no con filtro, como antes. Los dos primeros estaban en la leyenda.
  3. **IPS**: una sola sección (antes eran dos con el mismo título y una lista aparte de cuántas había de cada
     tipo): "Tipo" con la cifra de cada tipo en sus opciones ("Públicas (142)"), "Servicios", "Camas", "Limpiar" (quita
     el tipo, los servicios y las camas) y "Mostrando N IPS en el mapa" ("Puntos de IPS apagados" si están
     apagados en "Mostrar"). Mismas reglas de antes.
  La pestaña "Visitas" dice a quién siguen las visitas ("Visitas de 1 de 11 Ejecutivos Comerciales") y que se elige
  en la leyenda. El botón del panel (y el "Filtros" del celular) solo lleva el chip "IPS filtradas" cuando el bloque IPS
  oculta puntos. En escritorio el panel flotante llega hasta debajo del buscador y de los botones de zoom (alto máximo
  `100vh - 212px`): antes los tapaba al abrirse.
- **Fuera de "Ver solo"**: el territorio (con IPS, de alcance o sin cobertura) queda con el color de su Zona a 0.08
  (`DIMMED_FILL_OPACITY`) y el borde a 0.3, sin tooltip ni tarjeta: el "blanco" que pidió el dueño, el mismo del
  resaltado de antes. Sus IPS, insignias y visitas no se dibujan (los racimos se recalculan con las insignias
  visibles). Fuera de alcance, sin acceso terrestre y pendiente no cambian. Antes el filtro dejaba esos territorios en
  gris #f1f5f9 a 0.5 (`FILTERED_OUT_*`, quitado).
- **Se quitó**: el resaltado desde la leyenda (sus mini-muestras quedan, solo para leer), la lista repetida en Filtros
  y la pestaña "Buscar".
- **Buscador único** (`MapSearchBox.tsx`, `web/lib/buscar-territorios.ts`, pruebas en
  `web/scripts/mapa-buscar-check.ts`): "Buscar municipio, departamento o IPS…". Además de municipios, localidades y la
  ciudad de Bogotá, trae los 32 departamentos ("Casanare, departamento": encuadra sus municipios, hasta zoom 9) y las
  IPS activas con punto, por nombre o código ("…, IPS en Yopal": el mapa va a su punto, zoom 15 como mínimo, y abre su
  tarjeta, aunque esté fuera de "Ver solo" u oculta por otro filtro: se buscó a propósito). A igualdad, primero los
  territorios. Cada resultado va en dos renglones (nombre y, debajo, "Casanare", "departamento" o "IPS en Yopal"; antes
  "Nombre, Departamento" en uno) para que el nombre largo de una IPS no esconda su municipio. En escritorio el campo
  pasa de 320 a 352 px para que quepa el texto de ayuda. Con su lista abierta, el buscador va por encima del panel de
  Filtros.
- **Tarjetas**: el margen de arriba al encuadrarlas pasa de 12 a 68 px (`POPUP_TOP_PADDING`, `MapPopups.tsx`) para no
  quedar bajo el buscador, y su alto máximo baja lo mismo (56 px); su contenido y su estilo no cambian.
- **Enlaces**: `?exec=` (vista por línea) y `?zones=` (vista de zonas) siguen abriendo lo mismo; cambiar de línea o de
  vista quita el filtro.
- No cambian los colores, las opacidades, los bordes, las capas, los marcadores, el contenido de las tarjetas ni los
  racimos.

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
  - Soacha se colorea con el color de Kennedy (rojo desde el 2026-10-28; antes cian)
