# Spec: carga automática de servicios y capacidad del REPS  (2026-10-12)

**Estado**: idea guardada, sin priorizar (el dueño pidió guardarla el 2026-10-12 y pasar a la app de visita)

## Problema
Los servicios habilitados y la capacidad instalada de las IPS salen del portal del REPS
(`prestadores.minsalud.gov.co/habilitacion`, consultas "Registro actual" con sesión de invitado que el
propio portal prellena). El 2026-10-12 se cargaron a mano guiando el navegador: 33 exportes de Servicios
(123 MB, 160.370 filas, 12.615 sedes IPS del país) y 33 de Capacidad (16 MB), filtrados a las sedes de OpMap
e importados por `/hospitals/import`. Cada trimestre habría que repetirlo.

## Resultado esperado
Fuente automática `reps_servicios` (GitHub Actions mensual, como la ADRES) que: abre el portal, reenvía el
formulario de invitado tal como el portal lo trae prellenado (sin ninguna clave en el código), pide los
exportes de Servicios y Capacidad por departamento (`serviciossedes_reps.aspx` y
`capacidadesinstaladas_reps.aspx`, botón `ibText`, `;`, iso-8859-15, filas separadas por `\r`), filtra a
`hospitals.reps_code`, importa con el mismo motor de `/hospitals/import` (modo replace) y registra el
resultado en `fuentes_estado`. Avisa de las IPS cuyo código de sede ya no existe en el REPS (el 2026-10-12
eran 32: 24 prestadores sin servicios con su código y 8 con la sede renumerada) para re-vincularlas con
"Cambiar sede"; `scripts/reps-match.ts` puede proponer candidatas por nombre y municipio.

## Fuera de alcance
Vincular sedes automáticamente (decisión humana), capturar el PDF mensual del REPS.

## Impacto
Sin migración nueva (usa `hospital_services`, `hospital_capacity`, `hospital_import_jobs`,
`fuentes_estado`). Costo Google: 0. Tiempo de corrida: ~15 min, 140 MB; va en GitHub Actions.

## Plan
`web/lib/reps-portal.ts` (cliente HTTP del portal, puro en lo posible), `web/scripts/reps-portal-load.ts`,
fila en `fuentes-estado.ts`, job en `.github/workflows/datos.yml`, pruebas `reps-portal-check.ts`.
