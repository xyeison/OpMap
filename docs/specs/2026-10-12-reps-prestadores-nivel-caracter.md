# Spec: nivel, carácter y vencimiento de la habilitación desde el REPS "Prestadores"  (2026-10-12)

**Estado**: aprobada por el dueño por delegación (chat 2026-10-11) | pendiente de implementar (PR pequeño)

## Problema
El dueño exportó del portal del REPS la tabla **Prestadores** (`1Prestadores.xls`, HTML disfrazado de
Excel, corte 2026-10-11 17:03, 61.396 prestadores habilitados, 36 columnas, un renglón por código de
habilitación de 10 dígitos). Trae datos que OpMap no tiene de datos.gov.co: `nivel` (1, 2, 3; solo públicas),
`caracter` (departamental, municipal, distrital, nacional, indígena), `fecha_radicacion` y
`fecha_vencimiento` de la habilitación, `numero_sede_principal` (número de sedes), `rep_legal` (29 %),
`telefono_adicional`/`email_adicional` (31 %) y marcas de municipio PDET, ZOMAC, PNIS y PNSR. Cruce con las
783 IPS activas: 699 por código de habilitación (`left(reps_code, 10)`), 61 solo por NIT, 23 sin cruce.
No trae sedes, servicios ni capacidad (para eso faltan los exportes "Servicios" y "Capacidad instalada").

## Resultado esperado
1. Un script carga el archivo en la tabla `reps_prestadores` (clave `codigo_habilitacion`), reemplazando
   la carga anterior; guarda la fecha de corte del archivo.
2. La ficha de la IPS muestra, bajo la sección REPS: "Nivel 2 · Carácter departamental · Habilitación
   vence 2027-03-01 · 3 sedes" (solo los datos que existan) y la fecha de corte.
3. El cruce usa `left(hospitals.reps_code, 10)`; si no hay `reps_code`, el NIT (si es único en el archivo).
4. Nada de esto recalcula asignaciones ni llama a Google.

## Criterios de aceptación (se convierten en pruebas)
- [ ] Dado el HTML con la fila de encabezados y una fila de datos (latin1, entidades HTML), el parser
      devuelve los 36 campos con texto limpio y fechas 'YYYY-MM-DD'.
- [ ] Dado `nivel` vacío → null; `ese` "SI"/"NO" → boolean; `habilitado` "SI" → true.
- [ ] Dado una IPS con `reps_code` '110010123401', se cruza con el prestador '1100101234'.
- [ ] Dado una IPS sin `reps_code` y un NIT con un único prestador en el archivo, se cruza por NIT; con
      varios, no se cruza.
- [ ] `npm run check` en verde.

## Fuera de alcance
Servicios y capacidad instalada (ya tienen importador en `/hospitals/import`), vincular sedes nuevas,
cambiar el algoritmo o el mapa, usar `rep_legal` fuera de la ficha.

## Impacto
- Datos / migración: sí, `2026-10-1x_0750_reps_prestadores.sql` + rollback (tabla `reps_prestadores`, RLS
  sin políticas, solo service_role).
- Costo Google Maps: 0.
- Estética del mapa: no cambia.
- Permisos: ver con `hospitals:view`; cargar solo desde el script (admin).

## Plan (archivos e interfaces)
- `web/lib/reps-prestadores.ts` (puro): `parsePrestadoresHtml()`, `cruzarPrestador()`.
- `web/scripts/reps-prestadores-load.ts <archivo.xls>`: parsea y hace upsert en lotes de 500.
- `web/app/api/hospitals/[id]/route.ts` (GET añade `reps_prestador`), `web/components/HospitalRepsPanel.tsx`.
- Pruebas: `web/scripts/reps-prestadores-check.ts` (en `npm run test`).
- Docs: `docs/fases/fase3-reps-adres.md`.

## Verificación final
`npm run check`; carga real del archivo del dueño y captura de la ficha con nivel y vencimiento.
