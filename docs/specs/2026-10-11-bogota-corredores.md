# Spec: Bogotá como una sola ciudad hacia afuera, con reparto por corredores  (2026-10-11)

**Estado**: aprobada por el dueño (chat 2026-10-11: "Autorizo todo. Procede.") | **implementada** en la rama `feat/bogota-corredores`, PR 3 pendiente. Migración 0700 aplicada (aditiva); asignaciones sin recalcular y `kams.max_travel_time` sin tocar: los decide el dueño tras ver la simulación.

## Problema
Hoy las cuatro celdas de Bogotá (Chapinero 1100102, Engativá 1100110, Kennedy 1100108, San Cristóbal
1100104) compiten por las IPS de fuera de Bogotá cada una por su cuenta y con topes distintos: Chapinero
tiene `max_travel_time` 360 y las otras 240. Resultado visto por el dueño: una IPS a 4 h 31 de Engativá
y 4 h 33 de Chapinero queda en Chapinero "porque alcanza" y Engativá "fuera de rango". Pedido literal:
"Bogotá o toda ciudad súper grande que se parta debe tener una subconfiguración… bogotá inicialmente voy
a dividirlo en 1, o en 2, o en 3… y que se vaya calculando la asignación… en eso tú decide lo mejor".

## Resultado esperado
1. Dentro de Bogotá nada cambia: las IPS de cada localidad se asignan por la regla de mayoría entre las
   celdas de Bogotá (solo celdas de Bogotá compiten por localidades de Bogotá).
2. Hacia afuera, Bogotá compite como UNA ciudad: para cada IPS fuera de Bogotá, el tiempo de "Bogotá" es
   el mejor tiempo real entre sus celdas activas, y se compara con las demás zonas con el mismo tope
   (240 min). Si Bogotá gana, la IPS entra al "cupo Bogotá".
3. El reparto del cupo Bogotá entre celdas se hace por **corredor de salida** (configuración, no tiempo):
   Norte → Chapinero; Occidente → Engativá; Sur → Kennedy; Oriente → San Cristóbal. El corredor de cada
   municipio se toma de una tabla `bogota_corredores` (department_code / municipality_code → corredor),
   sembrada por departamento (Boyacá, Santander, Norte de Santander, Casanare norte → Norte; Cundinamarca
   occidental, Tolima, Eje Cafetero, Antioquia, Caldas → Occidente; Soacha, Fusagasugá, Girardot, Huila,
   Caquetá → Sur; Meta, Casanare sur, Guaviare, Vichada → Oriente) con excepciones por municipio.
4. Subconfiguración "Bogotá en k celdas" (k = 1..4) en `/kams` (solo admin): k = 4 usa los cuatro
   corredores; k = 2 agrupa Norte+Oriente y Sur+Occidente; k = 1 todo a una celda elegida. Cambiar k
   deja la asignación pendiente hasta que el dueño recalcule (no recalcula sola).
5. Los topes de las cuatro celdas pasan a 240 (una sola regla); si el dueño quiere una celda de largo
   alcance, se declara explícitamente en la configuración, no por un tope distinto.
6. La ficha de la IPS muestra "Bogotá (corredor Norte) → Chapinero" cuando aplique, y el mapa no cambia
   de estética (solo cambia quién gana).

## Criterios de aceptación (se convierten en pruebas puras en web/scripts/*-check.ts)
- [x] Dado una IPS fuera de Bogotá a 200 min de Engativá y 215 de Chapinero, y Pereira a 230, cuando se
      asigna, entonces gana Bogotá (200) y la celda la decide el corredor del municipio, no los 15 min.
- [x] Dado una IPS a 4 h 33 de Chapinero y 4 h 31 de Engativá, con tope 240 para todas, entonces queda sin
      zona (fuera de alcance) salvo asignación forzada.
- [x] Dado k = 2, cuando el corredor es Oriente, entonces la IPS va a la celda del grupo Norte+Oriente.
- [x] Dado una IPS en una localidad de Bogotá, entonces la regla de mayoría por localidad no cambia
      (prueba de regresión con el caso Teusaquillo del algoritmo).
- [x] La simulación (`scripts/bogota-simulate.ts`, solo lectura) lista qué IPS cambian de celda y cuántas
      quedan fuera de alcance al unificar el tope; el dueño la ve antes de recalcular.

## Fuera de alcance
Cobertura por línea (`coverage`), municipios de alcance (`municipality_zone`) y la estética del mapa no
cambian en este PR; si el reparto por corredor mueve IPS, `municipality_zone` se recalcula con el botón
existente (sin Google).

## Impacto
- Datos / migración: sí (`bogota_corredores`, columna de configuración k y celda por defecto; rollback).
  Se aplica junto con el despliegue. Cambio de `kams.max_travel_time` de Chapinero 360 → 240: lo decide el
  dueño al recalcular (la simulación muestra el efecto).
- Costo Google Maps: 0 (usa `hospital_kam_distances` existente).
- Estética del mapa: no cambia.
- Permisos: configuración solo admin; recálculo con `recalculate:complete`.

## Plan (archivos e interfaces)
- `web/lib/opmap-algorithm-simplified.ts`: paso "Bogotá como una ciudad" en la competencia externa +
  reparto por corredor (funciones puras exportadas, probadas).
- `web/lib/bogota-corredores.ts` (puro) + migración + semilla por departamento.
- `web/app/api/kams/bogota-config` (GET/PUT, admin) y UI en `/kams`.
- `web/scripts/bogota-simulate.ts` (solo lectura) y pruebas en `web/scripts/bogota-check.ts`.
- Ficha de IPS: texto del corredor. Docs: `docs/algoritmo-asignacion.md` (sección Bogotá) y
  `docs/decisiones/2026-10-11-bogota-corredores.md`.

## Verificación final
`GOOGLE_ROUTES_DISABLED=true npm run check`; salida de la simulación con el antes/después; captura de
`/kams` con la configuración y de una ficha con "Bogotá (corredor …)".

## Dato verificado (2026-10-11)
Las IPS de Bogotá con más de 4 h son asignaciones FORZADAS vigentes (`forced_assignments`): Villavicencio
(50001) y Acacías (50313) → San Cristóbal (15 IPS, 7 h 44 – 9 h 26) y Yopal (85001) → Kennedy (7 IPS,
≈ 7 h). Más 5 IPS competitivas de Chapinero en Boyacá y Santander entre 4 h 25 y 5 h 46 gracias al tope
360. Con los corredores, Villavicencio/Acacías (Oriente) caerían en San Cristóbal por regla y Yopal
(Casanare) en el corredor que decida el dueño (Norte u Oriente); las forzadas se conservan hasta que el
dueño las retire, y la simulación las lista aparte.

## Resultado de la implementación (2026-10-11)
- Criterios de aceptación: pruebas puras en `web/scripts/bogota-check.ts` (63) y
  `web/scripts/corredores-config-check.ts` (56), dentro de `npm run test`.
- Simulación real (k = 4, tope 240, solo lectura): Chapinero 42 → 62, Engativá 85 → 59, Kennedy 24 → 24,
  San Cristóbal 31 → 32; cupo Bogotá 43 IPS (Norte 26, Occidente 8, Sur 7, Oriente 2); 32 movimientos
  (27 entre celdas, 1 de Bogotá a Bucaramanga: Vélez, 4 a sin zona); 4 fuera de alcance (Miraflores, Soatá y
  dos de Sogamoso); 0 municipios sin corredor; forzadas conservadas (3 territorios, 22 IPS).
- Punto 5 (topes a 240): hacia afuera manda el tope único `bogota_config.max_travel_minutes`; el
  `kams.max_travel_time` de Chapinero (360) no se tocó; con la regla activa solo se usa dentro de Bogotá, donde los tiempos son cortos. Bajarlo
  lo decide el dueño.
- `POST /api/hospitals/assign-to-kam` usa la misma regla (`competeForHospital`) que el recálculo completo.
