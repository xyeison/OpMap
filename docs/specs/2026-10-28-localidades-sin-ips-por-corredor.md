# Spec: localidades de Bogotá sin IPS por corredor  (2026-10-28)

**Estado**: aprobada por el dueño (2026-10-28: "Si, hazlo", al aprobar los 4 sectores, que la incluyen) · PR #36

## Problema
El dueño, con el mapa de Bogotá a la vista: "Porque los colores no respetan geograficamente mira el verde esta arriba y
abajo del morado". Las cuatro localidades sin IPS objetivo (Santa Fe, La Candelaria, Usme y Sumapaz) no tienen zona
residente y el mapa les pone, como alcance, la Zona que gana Bogotá entera por camas (fila 11001 de
`municipality_zone`). Hoy es Engativá (5.243 camas en Bogotá), así que Santa Fe y Usme salen en verde claro al sur y al
oriente de San Cristóbal, al otro lado de la ciudad.

## Resultado esperado
Una localidad sin IPS y sin zona residente va con la celda de su corredor de salida, igual que los municipios vecinos
de afuera (regla de Bogotá del 2026-10-11): Usme por la vía al Llano, Sumapaz (se entra por Usme), Santa Fe por la vía
a Choachí y La Candelaria (rodeada por Santa Fe), las cuatro al corredor Oriente. Con la configuración de hoy
(Oriente → San Cristóbal) las cuatro se pintan como alcance de San Cristóbal. La celda del corredor es la que dejó el
último recálculo (la celda de Bogotá que más municipios del corredor recibieron en `municipality_zone`), no la
configuración guardada: igual que los municipios y las IPS, guardar la configuración no cambia el mapa hasta recalcular.

## Criterios de aceptación (se convierten en pruebas)
- [ ] Con el último recálculo hecho con k = 4 (Oriente → San Cristóbal), las cuatro salen con San Cristóbal y el
      corredor Oriente.
- [ ] Guardar k = 2 (Norte + Oriente → Chapinero) sin recalcular no las cambia; al recalcular, salen con Chapinero.
- [ ] Sin regla de Bogotá, con la celda del corredor inactiva o fuera de la asignación, o si la lectura falla, no
      salen (el mapa vuelve a la regla anterior: la Zona que gana Bogotá) y el resto de los municipios se pinta igual.
- [ ] Orden en el mapa: IPS asignadas (mayoría de camas) > zona residente > corredor > Zona que gana Bogotá > pendiente.
- [ ] La tarjeta y el globo dicen que la localidad va por su corredor, no "gana Bogotá".

## Fuera de alcance
- Las localidades con IPS (mayoría de camas) y las IPS de Bogotá: no cambia ninguna asignación ni ninguna cifra de camas.
- La propuesta de 4 sectores por localidad (pendiente del dueño).
- El Anexo B: las localidades sin IPS no entran en ningún anexo, antes ni ahora.
- La estética del mapa (colores, opacidades, capas): solo cambia de qué Zona es el alcance de esas cuatro localidades.

## Impacto
- Datos / migración: no. La lista de localidades y su corredor vive en `lib/bogota-corredores.ts`
  (`bogota_corredores` solo acepta municipios de 5 dígitos).
- Costo Google Maps: 0.
- Estética del mapa: no cambia la regla de color; cuatro localidades pasan de verde claro (Engativá) a morado claro
  (San Cristóbal).
- Permisos / roles: ninguno. GET /api/municipality-coverage suma el campo `localidades`.

## Plan (archivos e interfaces)
- `web/lib/bogota-corredores.ts`: `CORREDOR_DE_LOCALIDAD`, `celdasAplicadasPorCorredor` y
  `localidadesPorCorredor` (puras).
- `web/lib/territory-rules.ts`: `zonaDeLocalidadSinIps` (orden residente > corredor > Bogotá), pura.
- `web/lib/municipality-coverage.ts`: la respuesta de GET y del recálculo lleva `localidades` (código → celda y
  corredor) a partir de las filas de `municipality_zone` y de las celdas elegibles de siempre (`eligibleZones` +
  `isBogotaKam`); si esa lectura falla, `{}` con aviso en el registro.
- `web/app/api/municipality-coverage/route.ts`: devuelve `localidades`.
- `web/components/MapComponent.tsx`: `resolveTerritory` usa `zonaDeLocalidadSinIps`; globo y tarjeta.
- Pruebas en `web/scripts/bogota-check.ts` (sección 5, incluida la lectura de `MapComponent.tsx`) y
  `web/scripts/municipios-check.ts` (sección 7).

## Verificación final
`npm run check` y captura del mapa de Bogotá con Santa Fe, La Candelaria, Usme y Sumapaz en morado claro.
