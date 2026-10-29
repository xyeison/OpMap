# Spec: buscador de municipios en el mapa  (2026-10-28)

**Estado**: aprobada por el dueño (es su pedido)

## Problema
El dueño: "si alguien esta en el mapa y escribe 'Yop' que pueda salir los municipios y si le doy clic que me lleve a ese
municipio con zoom moderado me lo centre … a veces quiero encontrar un municipio y no lo encuentro … este ejemplo seria
que me salga Yopal, Casanare y poder dar clic". La búsqueda de hoy tiene cuatro problemas:
- Está escondida en "Filtros y visitas" → "Buscar".
- Solo ve los municipios que tienen IPS: Recetor, por ejemplo, nunca sale.
- Distingue tildes ("cucuta" no encuentra Cúcuta).
- Lleva a zoom 13 sobre el promedio de las IPS, no al municipio.

## Resultado esperado
- Un campo "Buscar municipio…" siempre visible sobre el mapa. En escritorio va arriba a la derecha, junto al zoom; en el
  teléfono, arriba y a todo lo ancho.
- Desde 2 letras muestra hasta 8 resultados "Nombre, Departamento", sin importar tildes ni mayúsculas.
- Busca en los 1.120 municipios, las 20 localidades ("Usaquén, Bogotá D.C. · localidad") y la ciudad de Bogotá.
- Orden de los resultados: primero los nombres que empiezan por lo escrito, después los que tienen una palabra que
  empieza así, al final los que lo contienen.
- Clic, toque o Enter: el mapa encuadra el municipio completo, centrado y con zoom moderado (hasta 11; 13 para una
  localidad). Deja libres la leyenda y la hoja inferior.

## Criterios de aceptación (se convierten en pruebas)
- [ ] "Yop" → solo "Yopal, Casanare".
- [ ] "cucuta" → "San José de Cúcuta, Norte de Santander"; "gaitan" → "Puerto Gaitán, Meta" primero.
- [ ] "usaquen" → la localidad con tilde; "bogo" → la ciudad de Bogotá primero.
- [ ] Una sola letra o nada que coincida → sin resultados; como mucho 8.
- [ ] El encuadre de Yopal contiene su cabecera. La ciudad de Bogotá se encuadra sin Sumapaz.
- [ ] Preview en escritorio y celular: escribir, elegir y ver el municipio centrado.

## Fuera de alcance
- Buscar IPS: sigue en la pestaña "Buscar" de "Filtros y visitas".
- Resaltar el municipio o abrir su tarjeta al llegar.

## Impacto
- Datos o migración: no. Google: 0.
- Estética del mapa: un control nuevo, pedido por el dueño. No cambian colores, capas ni marcadores (anotado en
  `docs/mapa-estetica.md`).
- Permisos: ninguno. Usa los polígonos y nombres que el mapa ya carga.

## Plan
- `web/lib/buscar-territorios.ts`: normalizar, buscarTerritorios, territoriosBuscables, rectanguloDeGeometrias y
  geometriasDeTerritorio (puras).
- `web/components/MapSearchBox.tsx`: el campo con su lista; se maneja con teclado y es accesible (combobox).
- `web/components/MapComponent.tsx`: arma la lista y encuadra con `flyToBounds`.
- Pruebas en `web/scripts/mapa-buscar-check.ts`, incluidas en `npm run test`.
