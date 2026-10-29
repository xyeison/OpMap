# Spec: polígonos oficiales del DANE en el mapa  (2026-10-29)

**Estado**: aprobada por el dueño ("Si", 2026-10-29). Implementación en `feat/mapa-poligonos-dane`.

## Problema
Los colores de las Zonas no siguen las fronteras reales (dueño, con capturas de Zipaquirá y Nemocón: "Porque las
lineas de los colores no respetan las lineas fronterizas reales"). El mapa pinta sobre un archivo propio muy
simplificado: Nemocón tiene 23 puntos y Zipaquirá 45, y la fuente vieja ya traía unos 135 por municipio. Además
quedan rendijas entre vecinos. El fondo gris (Esri) son imágenes: sus líneas no sirven para pintar. El dueño
preguntó si con más detalle "se volverá lentísimo".

## Resultado esperado
- Los bordes de los colores siguen las fronteras del Marco Geoestadístico Nacional del DANE (MGN 2025).
- No hay rendijas ni partes encimadas: cada frontera se guarda una vez y la usan los dos vecinos.
- La vista de país pesa lo mismo que hoy. Al acercar (zoom 10 o más) el mapa pide solo el detalle de los
  departamentos que se ven.
- No cambian colores, opacidades, capas, reglas, tarjetas ni el buscador: solo la forma de los bordes.

## Criterios de aceptación (se convierten en pruebas)
- [ ] `public/geo/municipios.json`: 1.120 municipios (todos los de `municipalities` menos 11001), un código una
      sola vez, `properties = { code, name, dept }` y `dept` = los dos primeros dígitos del código.
- [ ] `public/geo/localidades.json`: las 20 localidades (1100101…1100120).
- [ ] Las 20 localidades cubren el polígono de Bogotá del DANE: lo que sobra o falta es menos de 0,01 km².
- [ ] Sin rendijas ni encimes en la vista de país ni en el detalle (lo mide el generador y lo dice su informe).
- [ ] La vista de país (municipios + localidades) no pesa más que hoy: 1,47 MB sin comprimir.
- [ ] `public/geo/detalle/<dd>.json`: un archivo por departamento con exactamente sus municipios (11 = las 20
      localidades); entre todos, los mismos códigos de la vista de país.
- [ ] Desde zoom 10 el mapa pinta con el detalle los departamentos que se ven; al alejar vuelve a la vista de país.
      El rayado "sin equipo" y la trama "sin acceso terrestre" usan la misma geometría que el relleno.
- [ ] Pruebas puras (`scripts/geo-detalle-check.ts`): archivos, departamentos visibles y combinación del detalle.

## Fuera de alcance
- Nuevo Belén de Bajirá (27493): el DANE ya lo trae como municipio, pero no está en `municipalities`. Su área se
  pinta con Riosucio (27615), de donde salió; en el mapa de hoy el 99 % de esa área ya era Riosucio. Agregarlo a la
  base es otra decisión del dueño (fila nueva, tiempos de Google y recálculo).
- Cambiar el fondo, el estilo, los colores o las capas del mapa.
- Recalcular asignaciones o tiempos: no cambia ningún dato ni se llama a Google.
- Las dos IPS de Bogotá con la localidad mal guardada (ver memoria del 2026-10-28): no dependen de los polígonos.

## Impacto
- Datos / migración: no. Solo archivos estáticos en `web/public/geo`.
- Costo Google Maps: 0 USD.
- Estética del mapa: cambia solo la forma de los bordes (autorizado por el dueño el 2026-10-29).
- Permisos / roles: no.

## Plan (archivos e interfaces)
- `web/scripts/build-geojson.ts`: reescrito. Lee la capa `MGN_ADM_MPIO_GRAFICO` del MGN 2025 (zip del geoportal del
  DANE, WGS84). Ajusta las localidades al polígono de Bogotá del DANE: las recorta y cada pedazo de Bogotá sin
  localidad pasa a la localidad con la que comparte más frontera. Simplifica en una sola pasada de mapshaper por
  nivel: vista de país con el umbral en metros más fino que quepa en el peso de hoy, y detalle por departamento.
  Verifica códigos, rendijas y encimes, y da el informe de pesos.
- `web/lib/geo-detalle.ts` (puro): rectángulo de cada departamento, departamentos en la vista, agrupación por
  departamento y combinación con el detalle.
- `web/components/MapComponent.tsx`: una capa por departamento (y una de localidades) para que llegue el detalle de
  un departamento sin redibujar los demás; el rayado y la trama usan la colección combinada.
- `web/scripts/geo-detalle-check.ts` en `npm run test`.
- Documentos: `docs/mapa-estetica.md`, `docs/fases/fase2b-municipios-y-anexos.md` y la decisión
  `docs/decisiones/2026-10-29-mapa-poligonos-dane.md`.

## Verificación final
- `npm run check` y el informe del generador (pesos, códigos, rendijas, encimes).
- Preview: capturas de antes y después en Zipaquirá y Nemocón, en escritorio y celular. Medir el peso descargado
  y el tiempo de carga de la vista de país y del detalle.
