# 2026-10-11 – Una IPS es una sede del REPS; las coordenadas nuevas salen de Google Maps por nombre y con certeza

**Contexto**: en la Fase 3 el dueño pidió (2026-10-11): "un NIT puede tener varias sedes… debe ser por
código de habilitación y debe tener servicios habilitados e info que me dé a entender qué tan grande es;
también podemos hacer inteligencia de negocio con los giros directos de la ADRES por NIT", y luego "Dale
procede". Sobre de dónde sacar la ubicación de una sede: "Yo no confiaría incluso en la dirección que
esté en el REPS. Yo buscaría en Google Maps y si hay certeza de que esa es la dirección [se usa], si se
coloca de otra forma, no".

**Decisión**:

a) **Una IPS = una sede del REPS**, identificada por su **código de habilitación** (12 dígitos:
   código de prestador de 10 + número de sede de 2). El NIT identifica al prestador, no a la sede.
   `hospitals.reps_code` (UNIQUE) guarda la sede y `hospitals.nit` es solo un dato derivado de `code`
   (columna generada). El sufijo tras el guion de `hospitals.code` no es el dígito de verificación de
   la DIAN (647 de 787 no cuadran con el módulo 11) ni el número de sede: de las 79 IPS vinculadas con
   sufijo distinto de 1, solo 9 coinciden con el número de sede de su código de habilitación. Por eso el
   cruce usa solo los 9 dígitos del NIT.

b) **Coordenadas de sedes nuevas: solo desde Google Maps**, buscando por el **nombre** de la sede, y solo
   si el resultado da **certeza** de que es esa sede. Nunca se geocodifica la dirección del REPS
   (`reps_sedes.direccion_sede` no se usa para ubicar). Sin certeza, la sede queda **"sin ubicar"**: no
   recibe coordenadas aproximadas, no entra en la cola de rutas y no se asigna a ninguna zona hasta que
   alguien la ubique.

c) **Crear o editar una IPS no recalcula** la asignación, y tampoco vincular una sede del REPS ni
   importar servicios o capacidad. Estas acciones solo guardan; la IPS entra en la cola de pendientes
   cuando corresponde (`docs/ips-pendientes.md`) y el dueño decide cuándo correr "Calcular rutas y
   asignar pendientes". Ninguna acción de la Fase 3 llama a Google.

d) **El giro de la ADRES es por NIT** (prestador). Cuando un NIT tiene varias sedes activas en OpMap, el
   giro se **reparte entre ellas en proporción a sus camas** (`hospitals.beds`), o a partes iguales si
   ninguna tiene camas. El reparto solo se usa para agregar por municipio, zona o Ejecutivo Comercial, y
   así el total nunca se cuenta dos veces. La ficha de la IPS muestra el giro del NIT completo y avisa si
   el NIT es compartido.

**Consecuencias**:
- **Datos**: tabla `reps_sedes` (cargas mensuales) y vínculo explícito IPS → sede. Las ambiguas (35) y
  las sin cruce (22) se resuelven a mano en la ficha. La sugerida nunca se aplica sola.
- **Costo**: la geocodificación (pendiente D4) usará Google Maps. Antes de correrla hacen falta una spec,
  un dry-run con número de elementos × 0,005 USD y la autorización explícita del dueño. En la Fase 3 el
  gasto es 0.
- **Queda descartado**:
  - Usar la dirección del REPS, o geocodificar una dirección, para ubicar una sede.
  - Ubicar una sede en el centroide del municipio.
  - Identificar sedes por el sufijo de `code`.
  - Sumar el giro de un NIT completo en cada una de sus sedes.
- **Contratos**: el Anexo A del territorio sigue listando IPS (= sedes). Una sede "sin ubicar" no aparece
  en ningún territorio hasta que se ubique.

**Dónde vive en el código**:
- a) `web/lib/reps-match.ts` (cruce puro, `nitFromCode()`), migración
  `database/migrations/2026-10-11_0600_fase3_reps.sql` (columna generada `nit`, `reps_code` UNIQUE),
  `PATCH /api/hospitals/[id]/reps-link`. Prueba: `web/scripts/reps-check.ts` (secciones 2 y 4).
- b) Todavía no implementada (pendiente D4). Ningún código de la Fase 3 escribe coordenadas desde el
  REPS: `scripts/reps-load-sedes.ts` solo guarda la dirección como dato.
- c) `web/app/api/_lib/pending-assignment.ts`, `POST/PUT /api/hospitals`, `reps-link` y
  `/api/hospitals/import/apply` (no llaman a Google ni a `runFullRecalculation`). Prueba:
  `web/scripts/ips-routes-check.ts`.
- d) `sedeShares()` en `web/lib/adres-intelligence.ts`, y `nitFromHospitalCode()` en
  `web/lib/adres-parse.mjs`. Prueba: `web/scripts/adres-check.ts` (sección 5: "reparto por camas 75/25",
  "sin camas: a partes iguales", "total sin contar dos veces el NIT compartido").
