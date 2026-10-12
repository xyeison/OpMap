# Spec: SECOP I con valor real por contratista y entidades públicas sin REPS  (2026-10-12)

**Estado**: aprobada por el dueño (chat 2026-10-11: "Toma todas las decisiones adicionales tú; tú tomas la
buena decisión") | **implementada (PR pendiente)** en la rama `feat/secop-i-valores-reales` el 2026-10-12.
Migración 0730 escrita, NO aplicada (se aplica con el despliegue). Desvíos respecto al plan, con su porqué, en
los criterios de abajo y en `docs/fases/fase5-fuentes-automaticas.md` ("SECOP I (f789-7hwg)").

## Problema

1. **SECOP I infla las compras.** Hoy SECOP I entra solo por el dataset "SECOP Integrado" (`rpmr-utcd`), cuya
   columna `valor_contrato` es el **valor del proceso** repetido en cada contratista. La regla vigente
   (repartir por partes iguales) corrige el doble conteo entre contratistas, pero no el hecho de que el
   proceso vale mucho más que lo adjudicado. El dueño lo objetó: "SECOP I no dice quién fue el adjudicado y
   el valor adjudicado". Comprobado el 2026-10-11 con el dataset **SECOP I - Procesos de Compra Pública**
   (`f789-7hwg`), que sí trae contratista (`identificacion_del_contratista`, `nom_razon_social_contratista`)
   y valor adjudicado (`cuantia_contrato`, `valor_contrato_con_adiciones`), además de `cuantia_proceso`:
   - Proceso SS20-417 del Erasmo Meoz (constancia 20-4-11235766), valor del proceso 1.189,8 M: Promed
     Quirúrgicos 30 M y UT VD Salud (VG) 1.159,8 M. El reparto por partes iguales daba 594,9 M a cada uno.
   - La Samaritana (NIT 899999032) en `f789-7hwg`: 5.342 filas; suma de `cuantia_proceso` 3,63 billones,
     de `cuantia_contrato` 0,71 billones, con adiciones 0,90 billones. Cuatro a cinco veces menos.
   - `f789-7hwg` solo tiene detalle por contrato desde 2017-2018 (2016: 15.196 filas en todo el país;
     2018: 1.049.543). Para 2014-2017 el único dato sigue siendo el Integrado (valor del proceso).
2. **Entidades públicas que no se cargan.** Una IPS solo es "entidad objetivo" de SECOP si su NIT tiene alguna
   sede en `reps_sedes` con naturaleza Pública o Mixta (`secop_nits_ips()`: cruce por NIT, no por
   `hospitals.reps_code`). Las 6 UPRES de la Policía, el Hospital Central de la Policía (HOCEN), el Hospital
   Naval (HONAC), la ESE San Marcos y la ESE de Corozal no tienen ninguna; las UPRES no existen en el REPS con
   su NIT (régimen de excepción). Solo en SECOP II: UPRES Santander 4.438 contratos, HONAC 5.141, HOCEN 2.009;
   VG le vendió ~3.175 M a UPRES Atlántico en 2022-2024 y OpMap no lo muestra.
   **Revisión 2026-10-12** (SELECT de solo lectura en producción): otras 3 ESE sin `reps_code` (HU de
   Sincelejo 892280033, ESE Nuestra Señora del Carmen 900196346, ESE Universitaria del Atlántico 901536799) SÍ
   tienen sedes Públicas en `reps_sedes` con su NIT y ya se cargaban; la primera versión de esta spec las
   contaba entre las excluidas ("5 ESE"). Son 10 las entidades fuera, no 13.

## Resultado esperado

1. Para cada contrato de SECOP I desde 2017-2018 la ficha, el ranking y el proveedor muestran el **valor
   adjudicado a ese contratista** (con adiciones) tomado de `f789-7hwg`, y se conserva el valor del proceso
   como dato ("Proceso: 1.189,8 M · adjudicado: 1.159,8 M").
2. Los contratos de SECOP I que solo existen en el Integrado (antes de 2018, o que `f789-7hwg` no trae)
   siguen entrando con la regla actual (valor del proceso repartido por partes iguales) y quedan marcados
   como **estimados**; la ficha dice cuántos son y por cuánto.
3. Nada se cuenta dos veces: si `f789-7hwg` trae una constancia, las filas del Integrado de esa misma
   constancia y entidad salen de `secop_contratos_unicos`.
4. Una IPS puede marcarse a mano como **"Compra pública (SECOP)": según REPS / sí / no** (quien tenga
   `hospitals:edit`). Con "sí", la carga semanal trae su histórico y su ficha muestra compras. Las 10
   entidades sin sede REPS pública/mixta (6 UPRES, HOCEN, HONAC, ESE San Marcos, ESE Corozal) quedan marcadas
   "sí" en la migración; HU de Sincelejo ESE, ESE Nuestra Señora del Carmen y ESE Universitaria del Atlántico
   se dejan en "según REPS" porque el REPS ya las da públicas (regla `null` = según REPS, sin marcas
   redundantes).
5. Nueva fuente automática `secop_i` (SECOP I · Contratos, `f789-7hwg`) en el panel "Fuentes de datos",
   con cron semanal y "Actualizar ahora", misma mecánica (cursor, prefiltro, incremental) que las otras dos.
6. Reglas 2 y 3 de la spec anterior se confirman sin cambios: fuera de escala > 50.000 M no suma (p99
   "valor alto" sí suma), clasificación v2.

## Criterios de aceptación (se convierten en pruebas)

- [x] Dado una fila cruda de `f789-7hwg` (constancia 20-4-11235766, contratista 901080496, cuantia_proceso
      1.189.800.000, cuantia_contrato 1.159.800.000, adiciones 0), cuando se mapea con `fuente = 'secop1'`,
      entonces `origen = 'SECOPI'`, `numero_contrato = '20-4-11235766'`, `valor = 1.159.800.000`,
      `valor_proceso = 1.189.800.000`, `documento_proveedor = '901080496'` e `id_contrato` usa
      `id_adjudicacion` (`SECOPI|10476120`). → `secop-check` ("Mapeo SECOP I", con las dos filas reales de la
      constancia: también Promed, 30 M). Nota: la columna del nombre de la entidad en `f789-7hwg` es
      `nombre_entidad` (no `nombre_de_la_entidad`); `id_adjudicacion` solo se usa si es numérica (en filas no
      adjudicadas vale "Sin Adjudicar").
- [x] Dado una fila de `f789-7hwg` sin contratista (proceso no adjudicado, "Sin Firma"), cuando se mapea,
      entonces devuelve error y no se guarda. → `secop-check` (fila real "Sin Firma" / "Sin Adjudicar").
- [x] Dado `valor_contrato_con_adiciones` > 0, se usa ese valor; si es 0 o nulo, se usa `cuantia_contrato`.
      → `secop-check` (0, vacío, > 0, sin cuantía → null).
- [x] Dado la URL SoQL de `secop1` para una tarea de entidades, entonces filtra por `nit_de_la_entidad`
      con las variantes del NIT, aplica el prefiltro ortopédico sobre `objeto_del_contrato_a_la` y
      `detalle_del_objeto_a_contratar` más `id_clase like '4232%'`, y en incremental filtra por
      `ultima_actualizacion` **o** `fecha_de_firma_del_contrato`; la URL con prefiltro cabe en 9,5 KB: el
      tamaño de tarea de `secop1` bajó a **30 entidades** (8,7 KB; con 40 daría 9,2 KB). → `secop-check`
      ("URLs SoQL", pruebas SECOP I). **Desvíos** (comprobados con datos reales el 2026-10-12): `objeto_a_contratar`
      NO entra en el prefiltro ni en la clasificación porque en `f789-7hwg` es el segmento UNSPSC ("Servicios de
      Salud", "Equipo Médico, Accesorios y Suministros"), genérico y con palabras que confunden la regla
      servicio/producto (y con tres campos la URL pasaba de 12 KB con cualquier tamaño de tarea); el
      incremental añade la fecha de firma porque en la fila real `ultima_actualizacion` (2020-11-03) es
      anterior a la firma (2020-11-18) y solo por ella se perderían contratos firmados tarde.
- [x] Dado dos contratos de `fuente = 'integrado'`/`SECOPI` con la misma constancia y valor, el reparto por
      partes iguales sigue aplicando; dado los mismos con `fuente = 'secop1'`, NO se reparte. →
      `secop-api-check` (el reparto se decide por la marca `estimado` de la vista, que es exactamente
      `fuente = 'integrado' AND origen = 'SECOPI'`; `SecopContrato.fuente` es la etiqueta de UI) y bloque DO
      de la migración (`secop_hechos()`: 300 + 500 repartido = 800 en 3 contratos, 500 estimados).
- [x] Dado hechos con `estimado = true`, el resumen de la ficha reporta cuántos contratos y cuánto valor
      son estimados, y el total no los excluye. → `secop-api-check` (`estimados` = {5, 2300} dentro de un
      total de 5000 / 8; no cuenta fuera de escala, sin clasificar ni médicos).
- [x] Dado una IPS con `compra_publica = true` y sin REPS, `secop_nits_ips()` la devuelve con
      `publica = true`; con `false`, `publica = false` aunque el REPS diga Pública; con `null`, manda el REPS
      (comprobación en el bloque DO de la migración, con una IPS real y deshecha al final). La marca del NIT
      es `bool_or` de sus IPS activas marcadas (una marca en una sede no principal no se pierde). En la API,
      `resolverCompraPublica()` con 9 pruebas en `secop-api-check`.
- [x] Dado `PUT /api/hospitals/[id]` con `compra_publica: true | false | null`, se guarda; otro valor → 400.
      → `ips-routes-check` (sección 5, `updateHospitalSchema` y `patchHospitalSchema`: `'true'`, `1`, `'si'`,
      `''` rechazados; sin la clave no se toca la columna).
- [x] Regresión: las 199 + 137 pruebas actuales de `secop-check` y `secop-api-check` siguen en verde (ahora
      241 + 154; `npm run check` completo en verde el 2026-10-12).

## Fuera de alcance

- Procesos abiertos de SECOP II (`p6dx-8zbt`, tubería de licitaciones) y órdenes de la Tienda Virtual
  (`rgxm-mmea`): spec aparte, `docs/specs/2026-10-12-secop-procesos-abiertos.md` (siguiente PR).
- Columnas nuevas del REPS "Prestadores" (nivel, carácter, vencimiento): spec aparte,
  `docs/specs/2026-10-12-reps-prestadores-nivel-caracter.md`.
  Las dos specs futuras viajan en este PR solo como documentos (sin código): `fase5-secop.md` ya enlaza la
  primera y así quedan ambas revisadas junto con esta decisión.
- `web/scripts/dev-session.ts` (ayuda local para firmar una cookie de sesión de desarrollo) NO es parte de este
  cambio: estaba sin seguimiento en el árbol desde antes de esta spec y se movió a `web/scripts-dev/` (carpeta
  ignorada por git para ayudas locales). Si algún día se quiere versionar, va en su propio cambio con una
  línea en `docs/arquitectura-y-scripts.md`.
- Cambiar la clasificación por línea o los umbrales de atípicos.
- Estética del mapa: no se toca.

## Impacto

- Datos / migración: sí. `database/migrations/2026-10-12_0730_secop_i_y_compra_publica.sql` (aditiva:
  columna `hospitals.compra_publica`, columnas `secop_contratos.valor_proceso` y `valor_adiciones`,
  constraints de `fuente`/`origen` con `secop1`, índice, vista `secop_contratos_unicos` con `estimado`,
  `secop_hechos()` y `secop_nits_ips()` nuevos, semilla de las 10 entidades) con rollback
  `2026-10-12_9931_secop_i_rollback.sql`. Se aplica junto con el despliegue; después, carga inicial de
  `secop1` (`npx tsx scripts/secop-load.ts --fuente secop1 --inicial`) y una pasada de `todas` para el
  histórico de las 10 entidades nuevas; luego `secop_marcar_atipicos()` corre sola al cerrar la pasada.
- Costo Google Maps: 0 (datos.gov.co es gratis y sin token).
- Estética del mapa: no cambia.
- Permisos: el campo `compra_publica` lo edita quien tenga `hospitals:edit` (igual que `reps_code`); ver
  las compras sigue con `intelligence:view`.

## Plan (archivos e interfaces)

- `web/lib/secop.ts`: `SecopFuente` += `'secop1'`; `SECOP_DATASETS.secop1 = 'f789-7hwg'`;
  `SECOP_FUENTE_ESTADO.secop1 = 'secop_i'`; `SECOP_SOLAPE_DIAS.secop1 = 30`; `mapSecopRow` para `secop1`
  (campos de arriba; `valor_proceso`, `valor_adiciones` en `SecopContratoRow`, null en las otras fuentes);
  `prefiltroSoql`, `buildSecopUrl` (entidades: `nit_de_la_entidad`; proveedores: `starts_with(
  identificacion_del_contratista, …)` como el Integrado; incremental: `ultima_actualizacion`),
  `watermarkDeFila`; tamaño de tarea por fuente si hace falta para el límite de 9,5 KB.
- `web/lib/secop-sync.ts` (etiqueta, columnas del upsert), `web/scripts/secop-load.ts` (`--fuente secop1`,
  `todas` = las tres), `web/lib/fuentes-estado.ts` (`FuenteId`/`FUENTES`/`FUENTES_AUTOMATICAS` con
  `secop_i`, cron `0 7 * * 2`), `web/lib/fuentes-runner.ts` (`SECOP_DE_FUENTE`),
  `web/app/api/fuentes/_lib/catalogo.ts`, `web/vercel.json` (cron `/api/cron/secop_i`), comentario en
  `web/app/api/cron/[fuente]/route.ts`.
- `database/migrations/2026-10-12_0730_…sql` + rollback (arriba). `secop_hechos()`: el reparto solo para
  `fuente = 'integrado' AND origen = 'SECOPI'`; añade `'est'` (estimado) al jsonb. Vista: columna
  `estimado` = (`fuente = 'integrado' AND origen = 'SECOPI'`); las filas del Integrado SECOPI cuya
  (`nit_entidad`, `numero_contrato`) exista en `secop1` no entran.
- `web/lib/compras-publicas.ts`: `repartirProcesosSecopI` solo para `fuente === 'integrado'`; `SecopFact`
  y `SecopContrato` con `estimado`/`fuente`/`valor_proceso`; resumen con `estimados: { contratos, valor }`;
  textos de notas.
- `web/app/api/secop/_lib/secop-server.ts` (columnas nuevas y `est`), `web/app/api/secop/hospital/[id]/route.ts`
  (`publica` = `compra_publica` manual → REPS → contratos > 0; notas), `ranking`, `proveedor/[nit]` (texto
  de fuente "SECOP I, SECOP II y SECOP Integrado").
- `web/components/HospitalSecopCard.tsx`: etiqueta "SECOP I" y "estimado" en la lista; línea "Estimados
  (SECOP I sin valor adjudicado): N contratos · $ X" en el resumen; aviso "Compra pública: marcada a mano".
  **Desvío** (revisión 2026-10-12): el plan decía "Estimados (SECOP I antes de 2018)", pero la marca `estimado`
  de la vista es solo `fuente = 'integrado' AND origen = 'SECOPI'` sin fila `secop1` de la constancia, sin
  condición de fecha (todo estimado mientras no termine la carga inicial de `secop1`; y para siempre las
  constancias que `f789-7hwg` omite o cuya fila no pasa el prefiltro). Por eso la etiqueta por contrato y el
  tooltip dicen la causa real ("SECOP I sin valor adjudicado: solo el Integrado publica esta constancia") y
  "antes de 2018" queda solo como nota general de la API. Prueba en `secop-api-check` ("la marca estimado no
  depende de la fecha").
- `web/app/api/hospitals/[id]/route.ts` (`updateHospitalSchema` += `compra_publica: z.boolean().nullable().optional()`),
  modal de edición de la ficha (`web/app/hospitals/[id]/page.tsx` o el componente que use): selector
  "Compra pública (SECOP)" con Según REPS / Sí / No. GET de la ficha devuelve `compra_publica`.
- Pruebas: `web/scripts/secop-check.ts` (mapeo `secop1` con la fila real del Erasmo Meoz, errores, URL,
  prefiltro, marca de agua, huella) y `web/scripts/secop-api-check.ts` (reparto solo Integrado, estimados
  en el resumen, `publica` con la marca manual).
- Docs: `docs/fases/fase5-secop.md` (tabla de fuentes, reglas), `docs/fases/fase5-fuentes-automaticas.md`
  (cron nuevo), `docs/decisiones/2026-10-12-secop-i-valores-reales-y-compra-publica.md`, una línea en
  `CLAUDE.md`.

## Verificación final

`cd web && GOOGLE_ROUTES_DISABLED=true npm run check` en verde; `npx next build`; migración con su bloque
DO de comprobaciones (no aplicada hasta el despliegue); dry-run `npx tsx scripts/secop-load.ts --fuente
secop1 --dry-run --max-paginas 2` mostrando filas de `f789-7hwg` mapeadas con valor adjudicado; capturas
de la ficha (escritorio y celular) con un contrato SECOP I y con la marca "Compra pública".
