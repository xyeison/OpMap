# Spec: mapa con un solo buscador, una sola lista (en la leyenda) y un panel de Filtros  (2026-10-29)

**Estado**: aprobada por el dueño ("Sí, hazlo así", 2026-10-29), sobre los bordes del DANE (PR #42). Ajustada el mismo
día tras ver la primera versión en local: "no noto que haya simplificado nada, porque veo que tienes en la pestaña de
filtros y visitas las opciones de elegir a los ejecutivos comerciales. También en Leyenda lo tienes… Debes mejorarlo
para simplificarlo". La lista de personas queda solo en la leyenda.

## Problema
El dueño: "tengo un filtro y tengo una leyenda, y en la leyenda también tengo ejecutivos comerciales… siento que
estamos repitiendo muchas cosas. Esta usabilidad está como confusa. Yo dejaría… solamente las leyendas, y tendría
filtros y vistas aparte… tenemos dos opciones de buscar en el mapa… Si yo solamente voy a ver a Johanna, solamente
debería verse la zona que tiene ella asignada… si yo pongo a Johanna, se pone lo demás blanco."

Hoy hay dos mecanismos para lo mismo:
- La leyenda resalta: al tocar a una persona, su Zona queda en color y lo demás casi blanco.
- Filtros filtra: las casillas esconden los puntos de los demás y los dejan en gris.

Además, "Ver por" y la línea de negocio están en la leyenda, y hay dos buscadores: el del mapa (municipios) y la
pestaña "Buscar" (IPS, municipios y departamentos).

## Resultado esperado
- **Un solo buscador**, sobre el mapa: municipio, localidad, ciudad de Bogotá, departamento o IPS (por nombre o
  código, como la pestaña de antes). Una IPS abre su tarjeta. La pestaña "Buscar" desaparece.
- **Una sola lista de personas (o de Zonas), en la leyenda**: es la clave de colores y "Ver solo". Al tocar a una,
  solo su Zona queda en color; lo demás pasa a blanco y se esconden sus puntos, insignias y visitas. Tocar otra la
  suma; tocar una marcada la quita; "Ver todos" vuelve a todo. Es el único mecanismo: reemplaza las casillas de
  Filtros y el resaltado de la leyenda. Debajo, cada estado y cada marcador, sin botones.
- **Un solo panel "Filtros"**, con la pestaña Filtros y la de Visitas. Filtros tiene, en orden:
  1. **Vista**: ver por Ejecutivos Comerciales o por Zonas, y la línea de negocio.
  2. **Mostrar**: puntos de IPS, municipios de alcance y Zonas sin cobertura con IPS sin zona.
  3. **IPS**: tipo, servicios y camas, con las mismas reglas de hoy, en una sola sección (hoy son dos con el mismo
     título y una lista aparte de cuántas hay de cada tipo, que pasa a las opciones de "Tipo").
  Visitas dice a quién siguen las visitas ("Ver solo: 1 de 11") y que se elige en la leyenda.
- En escritorio el panel abierto no tapa el buscador ni los botones de zoom.
- **Celular**: la misma hoja inferior. "Leyenda" abre la lista (con "Ver solo") y "Filtros" el panel; el subtítulo de
  la barra dice "Ver solo: <nombre>". El botón "Filtros" solo cambia de aspecto cuando el bloque IPS oculta puntos.
- Los enlaces compartidos (`?exec=` y `?zones=`) siguen abriendo lo mismo.

## Criterios de aceptación
- [ ] La lista de personas (o de Zonas) aparece una sola vez: en la leyenda. Filtros no la tiene.
- [ ] Tocar en la lista sin filtro deja solo esa persona; tocar otra la suma; tocar una marcada la quita (si no
      queda ninguna, sin filtro); con todas marcadas, sin filtro. Prueba pura en `scripts/mapa-filtros-check.ts`.
- [ ] Fuera del filtro, el territorio va con el color de su Zona casi transparente (como el resaltado de antes) y
      sin tooltip ni tarjeta; puntos, insignias y visitas de los demás no se dibujan.
- [ ] El buscador encuentra departamentos e IPS además de municipios, localidades y la ciudad de Bogotá. Prueba en
      `scripts/mapa-buscar-check.ts`.
- [ ] La leyenda no tiene "Ver por", línea ni interruptores, y el panel de Filtros no tiene pestaña "Buscar".
- [ ] Capturas de escritorio y de celular con "Ver solo Johanna".

## Fuera de alcance
"Prioridades de visita" (queda para después, por decisión del dueño). La estética de colores, insignias y racimos no
cambia. Los filtros de IPS y de Visitas no cambian.

## Impacto
- Datos / migración: no. Costo Google Maps: 0.
- Estética del mapa: el territorio fuera del filtro pasa de gris (#f1f5f9 al 50 %) al color de su Zona al 8 %, el
  "blanco" que pidió el dueño. Se quita el resaltado de una sola Zona dentro de una persona.
- Permisos: iguales.

## Plan (archivos e interfaces)
- `web/lib/mapa-ver-solo.ts`: `alternarVerSolo` (pura).
- `web/lib/buscar-territorios.ts`: tipos `departamento` e `ips` y su armado.
- `web/components/MapLegend.tsx`: la lista con "Ver solo" (MapGroupFilter), estados y marcadores; "Ver por", línea
  y "Mostrar" salen de aquí.
- `web/components/MapVista.tsx` (nuevo): "Ver por" y línea de negocio.
- `web/components/MapGroupFilter.tsx`: la lista de la leyenda con "Ver solo" (sin scroll propio).
- `web/components/MapControls.tsx`: Filtros (Vista, Mostrar, IPS) y Visitas; sin la pestaña "Buscar" ni su código.
- `web/components/MapComponent.tsx`: sin el estado de resaltado; un solo filtro; buscador con IPS y departamentos.
- `web/components/mapStyles.ts`: sin `FILTERED_OUT_*` (fuera del filtro se usa `DIMMED_FILL_OPACITY`).
- `web/components/MapBottomSheet.tsx`, `web/app/map/page.tsx` y `web/lib/map-view.ts`: textos y comentarios ("Filtros y
  visitas"; la línea se cambia en Filtros, no en la leyenda).
- `web/components/HospitalMarker.tsx` y `ZoneBadgeLayer.tsx`: sin `dimmed`.
- Se borra `web/components/MapWithVisitsSimple.tsx`, que nadie usa.

## Verificación final
`npm run check`; preview en escritorio y en celular con "Ver solo" y con el buscador (municipio, departamento e IPS).
