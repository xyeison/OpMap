# Spec: los municipios sin IPS también siguen la regla de Bogotá (corredores)  (2026-10-28)

**Estado**: aprobada por el dueño en el chat ("Si dale.", 2026-10-28) · implementada en la rama
`fix/municipios-regla-bogota`

## Problema
El dueño preguntó por qué Puerto Gaitán (Meta) quedaba en Chapinero, si Villavicencio y todo el Meta son de San
Cristóbal: "Si tu partes bogotá en cuatro. Arriba a la derecha todo lo que haya es para X […] Pero mira —
Después de Villavicencio hay uno rojo que es zona Chapinero cuando el morado es San Cristóbal".

Causa (investigada el 2026-10-27/28, solo lectura):
1. El motor de **municipios** (`web/lib/municipality-coverage.ts`) nunca aplicó la regla "Bogotá como una ciudad"
   del 2026-10-11: cada celda competía sola con su `kams.max_travel_time` (Chapinero 360, las otras 240).
   Puerto Gaitán: San Cristóbal 333 min, Kennedy 340, Chapinero 355, Engativá 362 → solo Chapinero "alcanzaba".
2. Las IPS y los municipios se calcularon por última vez el 2026-10-11 a las 13:05 UTC, **antes** de guardar
   `bogota_config` (19:57 UTC): ninguna asignación `bogota_corredor` en la base. El motor de IPS ya tenía la
   regla, pero nunca se recalculó con ella.

## Resultado esperado
- Fuera de Bogotá, un municipio sin IPS que gana "Bogotá" va a la celda de su **corredor** (norte → Chapinero,
  occidente → Engativá, sur → Kennedy, oriente → San Cristóbal), igual que una IPS en ese municipio.
- "Bogotá" compite con su mejor tiempo y un **tope único** (`bogota_config.max_travel_minutes`); las demás zonas
  con el suyo. El dueño fijó ese tope en **360 min (6 h)**, como el que ya tenía Chapinero.
- IPS y municipios recalculados (sin costo de Google); Puerto Gaitán y San Carlos de Guaroa en San Cristóbal.

## Criterios de aceptación (pruebas en `web/scripts/municipios-check.ts`, en `npm run test`)
- [x] Puerto Gaitán (oriente) con tope 360 → San Cristóbal a 333 min; sin la regla se reproduce el error
      (Chapinero 355).
- [x] Con tope 240, Puerto Gaitán y San Carlos de Guaroa quedan fuera de alcance; la "más cercana" es la celda
      del corredor y el tope propio de Chapinero ya no cuenta hacia afuera.
- [x] El corredor decide la celda aunque otra sea más rápida (Boyacá → Chapinero; Fusagasugá, fila por
      municipio, → Kennedy); los minutos guardados son los de esa celda.
- [x] "Bogotá" compite con las demás zonas por su mejor tiempo (Tolima: Bogotá 140 gana a Ibagué 150; Ibagué 130
      gana a Bogotá 140). Empate exacto, como `competeForHospital`: la prioridad de la celda más rápida y, si sigue el
      empate, el lugar de la primera celda candidata por nombre (Chapinero), que va antes que "Ibagué".
- [x] Sin corredor, o con la celda del corredor inactiva: la celda más rápida; k = 2 usa los grupos.
- [x] Fuera de alcance, la "más cercana" es la zona que lo recibiría con menos minutos: "Bogotá" cuenta como la
      celda de su corredor con el tiempo de esa celda (Huila: Neiva 370 y no Kennedy 380, aunque Engativá tenga 365).
- [x] Sin cambios: par pendiente → `pending`; sin ruta → `no_road`; Bogotá misma (departamento 11); municipios
      con IPS (mayoría) y municipios base. Con o sin la regla se piden los mismos pares a Google.
- [x] Mismo resultado que `competeForHospital` (motor de IPS) con los mismos tiempos y las zonas en su orden (por
      nombre). Prueba diferencial de la revisión: 0 diferencias en 14.212 filas de 3.000 casos al azar.

## Fuera de alcance
- Asignaciones forzadas (Villavicencio, Granada → San Cristóbal; **Yopal → Kennedy**, "trayecto aéreo"): no se
  tocan. Yopal queda en Kennedy dentro del oriente; se le pregunta al dueño.
- Corredores (`bogota_corredores`) y k: sin cambios.
- La cobertura por línea (`coverage`) no depende de las asignaciones de IPS ni de los municipios.
- Los tonos por zona de la vista por línea (un Ejecutivo Comercial con varias zonas) no cambian.

## Impacto
- Datos / migración: sin cambios de esquema. Datos (autorizados por el dueño, "Si dale."): la 0900 respalda
  `assignments` y `municipality_zone` y sube `bogota_config.max_travel_minutes` de 240 a 360 (**APLICADA el
  2026-10-28, antes del merge**); después, recálculo completo de IPS y de municipios desde la caché.
- Asignaciones forzadas: el dueño pidió quitarlas ("quiero revisar el propio sistema que propone"). La 0901 las
  desactiva con respaldo, pero **no se aplica todavía**: los tiempos de las IPS de Meta y Casanare desde Bogotá son del
  2025-08-07, con la vía al Llano cerrada (Villavicencio a 441–471 min y ~375 km; lo normal es ~2 h 30). Sin
  recalcularlos con Google (dry-run y autorización del dueño), las 22 IPS de Villavicencio, Granada y Yopal quedarían
  sin zona.
- Costo Google Maps: **0** (las IPS usan `hospital_kam_distances` y los municipios `municipality_travel_times`).
- Estética del mapa: no cambia el estilo. Aparte, el dueño pidió el 2026-10-28 cambiar los colores de las
  4 zonas de Bogotá (`docs/decisiones/2026-10-28-colores-zonas-bogota.md`).
- Permisos / roles: ninguno.

Simulación en memoria (2026-10-28, solo lectura, tope 360, k = 4):
- IPS: 766 asignadas antes y después; 27 cambian, todas entre celdas de Bogotá; ninguna sale ni entra de otra
  zona y ninguna queda fuera de alcance. Chapinero 42 → 67, Engativá 85 → 59, Kennedy 24 → 24, San Cristóbal
  31 → 32. El recálculo sin la regla da lo mismo que la base (no hay deriva de datos).
- Municipios: 47 cambian, ninguno pierde zona y uno la gana (San Cristóbal). Chapinero → San Cristóbal 23,
  Engativá → Chapinero 12, Chapinero → Engativá 8, Engativá → Kennedy 3. Fuera de Bogotá: Chapinero 150,
  San Cristóbal 46, Engativá 36, Kennedy 18. Tipos: con IPS 136, de alcance 840 → 841, fuera de alcance
  79 → 78, sin acceso terrestre 66.

## Plan (archivos e interfaces)
- `web/lib/municipality-coverage.ts`: `MunicipalityInputs.bogota` / `bogotaRuleStatus` (cargados con
  `loadBogotaRule(db)`); `decideByTravelTime` sustituye las celdas por un candidato "Bogotá"
  (`bogotaVirtualCandidate`) y, si gana, elige la celda con `chooseBogotaCell` (mismas funciones que el motor de
  IPS). Informes (`buildDryRunReport`, `recomputeAndSaveMunicipalityZones`) dicen qué regla se usó.
- `web/lib/opmap-algorithm-simplified.ts`: `loadBogotaRule(db?)` acepta el cliente del llamador.
- `web/scripts/fase2b-municipios.ts`: imprime la regla de Bogotá en `--dry-run` y `--assign`.
- `web/scripts/municipios-check.ts` (nuevo) en `npm run test`.

## Verificación final
- `cd web && npm run check`.
- **Antes del merge** (recomendación de la revisión): aplicar la 0900 (respaldos y `bogota_config` a 360). Así,
  cualquier recálculo que alguien dispare entre el despliegue y el recálculo final ya usa 360 y ningún municipio
  pierde zona en ese intervalo. Con el código de `master` no cambia nada: el motor de municipios viejo no lee
  `bogota_config` y el de IPS pasa al valor buscado.
- **Después del despliegue**: `npx tsx scripts/fase1-recalculate.ts --yes` y `npx tsx scripts/fase2b-municipios.ts
  --assign` con `GOOGLE_ROUTES_DISABLED=true`; consultas de control (Puerto Gaitán, San Carlos de Guaroa, Chía, Tunja,
  Gachetá) y capturas del mapa en escritorio y celular.
