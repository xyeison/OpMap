# Spec: servicios habilitados y capacidad instalada del REPS  (2026-10-11)

**Estado**: implementada (rama sin PR todavía; migración 0620 aplicada)

## Problema
Las IPS de OpMap no dicen qué tan grandes son ni qué servicios tienen. Pedido literal: la IPS "debe tener
servicios habilitados e info que me dé a entender qué tan grande es"; y "investiga si podemos capturar la
data de un PDF que se genera por mes".

## Resultado esperado
Un admin o gestor de datos exporta del portal del REPS (perfil invitado) las consultas "Servicios" y
"Capacidades instaladas" (Excel/texto, o un PDF con texto), las sube en `/hospitals/import`, ve una
simulación por IPS y la aplica. La lista de IPS y el mapa filtran por quirófano, ortopedia, neurocirugía,
columna y camas. Nada recalcula asignaciones.

## Criterios de aceptación (pruebas en `web/scripts/reps-import-check.ts`)
- [x] Encabezados con tildes / guion bajo / sinónimos; CSV con `;` y `,`; valores "12"; Excel con códigos numéricos.
- [x] Clasificación de servicios prioritarios (Res. 3100/2019) y quirófanos/camas desde la capacidad.
- [x] Cruce por `reps_code`, importación previa o NIT inequívoco; ambiguas y sin cruce no se guardan.
- [x] Simulación: servicios nuevos/retirados, `service_flags`, quirófanos, camas; reemplazar vs. solo añadir.
- [x] PDF con texto → tabla; PDF escaneado → "PDF sin texto (escaneado): requiere OCR".
- [x] Aplicar en una transacción con `hospital_history` 'import'; segunda aplicación bloqueada.

## Fuera de alcance
OCR de PDF escaneados; descarga automática del REPS (requiere login humano); cambiar el algoritmo de
asignación; vincular sedes ambiguas (lo hace la ficha, Fase 3 de sedes).

## Impacto
- Datos / migración: sí, `2026-10-11_0620_fase3_servicios.sql` (rollback `2026-10-11_9930_servicios_rollback.sql`).
- Costo Google Maps: 0.
- Estética del mapa: no cambia (bloque de filtro "IPS" que solo oculta puntos; autorizado en la Fase 3).
- Permisos: importar = `hospitals:edit` + rol admin o data_manager.

## Plan (archivos e interfaces)
`web/lib/reps-import.ts` (puro), `web/lib/reps-pdf.ts` (pdf.js), `web/lib/reps-import-fields.ts` y
`web/lib/hospital-service-filters.ts` (compartidos), `web/app/api/_lib/reps-import-server.ts`,
`/api/hospitals/import/{preview,apply}`, `/api/hospitals/[id]/reps-services`, `app/hospitals/import/page.tsx`,
filtros en `app/hospitals/page.tsx`, `components/MapControls.tsx`, `components/MapComponent.tsx`,
`/api/map/data`, `components/HospitalRepsPanel.tsx`.

## Verificación final
`cd web && npm run check`; simulación real contra Supabase con un CSV, un PDF con texto y uno escaneado;
prueba de `reps_import_apply` en una transacción deshecha. Detalle: `docs/fases/fase3-servicios-capacidad-reps.md`.
