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
      gana a Bogotá 140); empate → prioridad.
- [x] Sin corredor, o con la celda del corredor inactiva: la celda más rápida; k = 2 usa los grupos.
- [x] Sin cambios: par pendiente → `pending`; sin ruta → `no_road`; Bogotá misma (departamento 11); municipios
      con IPS (mayoría) y municipios base.
- [x] Mismo resultado que `competeForHospital` (motor de IPS) con los mismos tiempos.

## Fuera de alcance
- Asignaciones forzadas (Villavicencio, Granada → San Cristóbal; **Yopal → Kennedy**, "trayecto aéreo"): no se
  tocan. Yopal queda en Kennedy dentro del oriente; se le pregunta al dueño.
- Corredores (`bogota_corredores`) y k: sin cambios.
- La cobertura por línea (`coverage`) no depende de las asignaciones de IPS ni de los municipios.
- Los tonos por zona de la vista por línea (un Ejecutivo Comercial con varias zonas) no cambian.

## Impacto
- Datos / migración: **sin migración**. Datos (autorizados por el dueño, "Si dale."): respaldo
  `assignments_respaldo_20261028` y `municipality_zone_respaldo_20261028`; `bogota_config.max_travel_minutes`
  240 → 360; recálculo completo de IPS y de municipios desde la caché.
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
- Tras desplegar: respaldos, `bogota_config` a 360, `npx tsx scripts/fase1-recalculate.ts --yes` y
  `npx tsx scripts/fase2b-municipios.ts --assign` con `GOOGLE_ROUTES_DISABLED=true`; consultas de control
  (Puerto Gaitán, San Carlos de Guaroa, Chía, Tunja, Gachetá) y capturas del mapa (vista de Zonas) en escritorio
  y celular.
