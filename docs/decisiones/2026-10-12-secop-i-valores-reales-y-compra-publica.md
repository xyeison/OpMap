# 2026-10-12 – SECOP I se cuenta por el valor adjudicado a cada contratista; las entidades públicas sin REPS se marcan a mano

**Contexto**: al pedirle al dueño que confirmara las tres reglas de SECOP (reparto de SECOP I por partes
iguales, fuera de escala > 50.000 M, clasificación v2) objetó: "Pero el SECOP uno no dice quién fue el
adjudicado y el valor adjudicado. Toma todas las decisiones adicionales tú; tú tomas la buena decisión".
Comprobado con datos (2026-10-11): el Integrado (`rpmr-utcd`) repite el **valor del proceso** por
contratista; el dataset SECOP I (`f789-7hwg`) sí trae contratista y valor adjudicado (`cuantia_contrato`,
`valor_contrato_con_adiciones`). En La Samaritana el valor por proceso es 4 a 5 veces el adjudicado
(3,63 frente a 0,90 billones). Además, al comparar con buscadorsecop.com con el NIT de VG, faltaban sus
contratos con las UPRES de la Policía: OpMap solo carga entidades cuyo NIT tiene alguna sede Pública o Mixta
en el REPS (cruce por NIT, no por `hospitals.reps_code`), y las UPRES (y HOCEN, HONAC, ESE San Marcos, ESE
Corozal) no existen en el REPS con su NIT.

**Decisión**:
1. SECOP I entra por `f789-7hwg` (`fuente = 'secop1'`) con el valor adjudicado al contratista (con
   adiciones; si no hay, `cuantia_contrato`). El valor del proceso se guarda como dato (`valor_proceso`).
2. El Integrado queda como respaldo para SECOP I: solo sus constancias que `f789-7hwg` no trae (en la
   práctica, antes de 2018). Para ellas sigue el reparto por partes iguales y se marcan **estimadas**.
3. Las reglas 2 (fuera de escala > 50.000 M no suma; "valor alto" sobre el p99 sí suma) y 3
   (clasificación v2) quedan confirmadas sin cambios.
4. `hospitals.compra_publica` (null = según REPS, true/false = marca manual) decide si una IPS es entidad
   objetivo de SECOP. Se marcan "sí" las 6 UPRES, HOCEN, HONAC, ESE San Marcos y ESE Corozal (10 NIT).
   **Revisión 2026-10-12**: la primera redacción marcaba también HU de Sincelejo ESE, ESE Nuestra Señora del
   Carmen y ESE Universitaria del Atlántico, pero una consulta de solo lectura en producción mostró que sus
   NIT ya tienen sedes Públicas en `reps_sedes` y la carga ya las cubría (116 y 6 contratos cargados de las
   dos primeras). No se siembran: siguen "según REPS", para no fijar a mano lo que el REPS resuelve; el bloque
   DO de la migración avisa si dejaran de salir públicas.
5. Procesos abiertos de SECOP II (tubería de licitaciones) y órdenes TVEC: sí se harán, en el siguiente PR
   con su propia spec (`docs/specs/2026-10-12-secop-procesos-abiertos.md`). Las columnas nuevas del REPS
   "Prestadores" (nivel, carácter, vencimiento) también, aparte
   (`docs/specs/2026-10-12-reps-prestadores-nivel-caracter.md`). Las dos specs entran en este PR solo como
   documentos.
6. Los contratos estimados se explican en la UI por su causa real ("SECOP I sin valor adjudicado: solo el
   Integrado publica esta constancia"), no como "antes de 2018": la marca `estimado` va por fuente, sin
   condición de fecha (revisión 2026-10-12). "Antes de 2018" queda solo como contexto en la nota general.

**Consecuencias**: los totales de SECOP I bajan de forma importante (el 2026-10-11 el bruto del Integrado
SECOP I era 3,94 billones); las cifras de compras por año para 2014-2017 siguen siendo estimadas y la
ficha lo dice. Entran los contratos de SECOP II de las 10 entidades nuevas (solo los ortopédicos tras el
prefiltro; la cifra bruta de ~24.000 estimada el 2026-10-11 contaba 13 entidades, 3 de las cuales ya se
cargaban, así que es un tope). Costo: 0 (datos.gov.co). Las versiones del territorio y los giros ADRES no
cambian.

**Dónde vive en el código**: `web/lib/secop.ts` (`mapSecopRow` para `secop1`, `buildSecopUrl`),
`database/migrations/2026-10-12_0730_secop_i_y_compra_publica.sql` (vista `secop_contratos_unicos`,
`secop_hechos()`, `secop_nits_ips()`), `web/lib/compras-publicas.ts` (`repartirProcesosSecopI` solo
Integrado), ficha `web/app/api/secop/hospital/[id]/route.ts`. Pruebas: `web/scripts/secop-check.ts` y
`web/scripts/secop-api-check.ts`. Spec: `docs/specs/2026-10-12-secop-i-valores-reales-y-compra-publica.md`.
