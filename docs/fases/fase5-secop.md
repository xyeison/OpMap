# Fase 5 (2026-10-11): compras públicas (SECOP) — API, ficha, /inteligencia y lista vigilada

Rama `feat/secop-compras-publicas` (PR 7). Pedido del dueño: "Dale. Pero… ¿estamos haciendo algo que
consulte estas fuentes y esté actualizado?". Este documento cubre lo que se **ve y se consulta**: la API
`/api/secop/*` y `/api/fuentes/*`, la tarjeta de la ficha de IPS, la pestaña "Compras públicas" y el panel
"Fuentes de datos" de `/inteligencia`, y la lista vigilada. La carga, el cron, el esquema 0710 y lo que debe
configurar el dueño (`CRON_SECRET` en Vercel, secretos de GitHub) están en
**`docs/fases/fase5-fuentes-automaticas.md`**.

Nada de esto recalcula asignaciones ni llama a Google.

## Fuentes

Datos abiertos de Colombia Compra Eficiente en datos.gov.co (API Socrata/SoQL, pública, sin token):

| Conjunto | Id | Uso |
| --- | --- | --- |
| SECOP II · Contratos electrónicos | `jbjy-vk9h` | Carga diaria incremental por `ultima_actualizacion` (`secop_contratos.fuente = 'secop2'`) |
| SECOP I · Procesos de Compra Pública | `f789-7hwg` | **Fuente principal de SECOP I** (desde 2026-10-12): una fila por contrato-contratista con el **valor adjudicado** a cada uno (`valor_contrato_con_adiciones`; si es 0, `cuantia_contrato`) y el valor del proceso (`cuantia_proceso`) como dato; detalle por contrato desde 2017-2018. Carga semanal (martes) incremental (`fuente = 'secop1'`, `origen = 'SECOPI'`) |
| SECOP Integrado (SECOP I + II desde 2005) | `rpmr-utcd` | Carga semanal (lunes). Para SECOP II, respaldo de lo que no venga de `jbjy-vk9h`; para SECOP I, **solo respaldo estimado**: trae el valor del PROCESO repetido en cada contratista y sus filas entran únicamente cuando `f789-7hwg` no trae esa constancia (en la práctica, antes de 2018), marcadas `estimado` (`fuente = 'integrado'`, `origen` SECOPI / SECOPII) |
| SECOP II · Procesos | `p6dx-8zbt` | Licitaciones abiertas (oportunidades): spec aparte (`docs/specs/2026-10-12-secop-procesos-abiertos.md`), no cargado |

La API suma siempre sobre la vista `secop_contratos_unicos` (migración 0730): entran `secop2` y `secop1`
siempre; del Integrado, SECOP II solo si no vino ya de `secop2` (mismo `CO1.PCCNTR…`) y SECOP I solo si
`secop1` no trae esa constancia (`nit_entidad` + `numero_contrato`). La vista añade la columna `estimado`
(= Integrado SECOP I). Decisión del dueño y evidencia en
`docs/decisiones/2026-10-12-secop-i-valores-reales-y-compra-publica.md`.

## Alcance

- **Entidades**: NIT de IPS activas que son **entidad de compra pública**: marcadas a mano "Compra pública
  (SECOP): Sí" (`hospitals.compra_publica = true`) o, sin marca (`null`), con alguna sede Pública o Mixta en el
  REPS (`reps_sedes.naturaleza`); con "No" quedan fuera aunque el REPS diga Pública (`secop_nits_ips()`, 0730:
  la marca del NIT es `bool_or` de sus IPS activas marcadas). Eran 131 NIT por REPS el 2026-10-11; la
  migración 0730 marca "Sí" 10 más sin sede REPS pública/mixta (6 UPRES de la Policía, HOCEN, HONAC, ESE San
  Marcos y ESE Corozal; HU de Sincelejo, ESE N. S. del Carmen y ESE Universitaria del Atlántico ya salen públicas
  por el REPS y no se marcan). De ellas
  entra un contrato si clasifica en una línea, si es de un proveedor vigilado o si es un servicio de
  especialista.
- **Proveedores vigilados**: todos sus contratos con cualquier entidad pública (para ver dónde venden).
- **NIT** siempre a 9 dígitos, sin DV, para entidad y proveedor (SECOP lo guarda a veces con DV y con
  variantes de nombre). El DV se valida con la regla de la DIAN.

## Clasificación por línea de producto

La hace la carga (`clasificarContrato` en `web/lib/secop.ts`, versión v2; detalle en
`fase5-fuentes-automaticas.md`) con objeto, descripción y UNSPSC. La API solo agrupa y rotula
(`normalizeLinea()` / `lineaLabel()` en `web/lib/compras-publicas.ts`):

| Línea (código) | Rótulo en la UI | Idea |
| --- | --- | --- |
| `trauma` | Trauma y osteosíntesis | osteosíntesis, fijación externa, fracturas, clavos endomedulares, ítems con calificativo ("tornillo cortical", "placa tibia")… |
| `reemplazo` | Reemplazo articular | artroplastia, prótesis de cadera / rodilla / hombro |
| `columna` | Columna | columna vertebral, pedicular, intersomático, fusión |
| `deportiva` | Medicina deportiva | artroscopia, ligamento, menisco, anclajes |
| `neurocirugia` | Neurocirugía | craneal, aneurisma (no de aorta), hidrocefalia, válvulas |
| `otros_implantes` → `otros` | Otros implantes | ortopedia genérica, UNSPSC 4232xxxx |
| `no_clasificado` | Sin clasificar | contratos de proveedores vigilados sin línea ortopédica detectada |

Dental, oftálmico, cardiovascular (incluidas endoprótesis aórticas), auditivo y medicamentos no entran por
genérico ni por UNSPSC. Del UNSPSC solo cuenta la familia 4232 (implantes ortopédicos); 42294200 y 42241700
resultaron ruidosos con los datos reales y no clasifican solos.

## Reglas de la API

- **Total ortopédico = las 6 líneas.** "Sin clasificar" se muestra aparte (tarjeta punteada "no suma" en la
  ficha; atenuado en el desglose del ranking) y solo suma con el filtro "Todas (incluye sin clasificar)"
  (`linea=todas`) o eligiéndolo (`linea=no_clasificado`).
- **SECOP I: valor adjudicado por contratista; el del proceso solo como dato.** Desde 2026-10-12 SECOP I
  entra por `f789-7hwg` (`fuente = 'secop1'`), que trae el valor **adjudicado** a cada contratista (con
  adiciones; si no las hay, `cuantia_contrato`). La ficha, el ranking y el proveedor suman ese valor tal cual
  y conservan el del proceso como dato (`valor_proceso`; la ficha dice "Proceso: 1.189,8 M · adjudicado a este
  contratista: 1.159,8 M"). Comprobado con la constancia 20-4-11235766 del Erasmo Meoz: Promed 30 M y UT VD
  Salud 1.159,8 M, frente a los 594,9 M por cabeza que daba el reparto del Integrado.
  Las constancias que `f789-7hwg` no trae (sobre todo las anteriores a 2018, pero la marca no mira la fecha:
  también las que ese dataset omite o cuya fila `secop1` no pasa el prefiltro, y todas mientras no termine la
  carga inicial de `secop1`) siguen entrando por el Integrado con el valor del
  PROCESO repetido en cada contratista: se cuentan una vez, repartidas por partes iguales
  (`repartirProcesosSecopI()` en la ficha, misma regla en `secop_hechos()`), y quedan marcadas **estimado**
  (`secop_contratos_unicos.estimado`, clave `est` del jsonb). El reparto se aplica SOLO a los estimados: dos
  filas de `secop1` con la misma constancia y valor son dos contratos reales y no se parten. Los estimados
  **sí suman** en el total; la ficha dice cuántos son y por cuánto ("Estimados (SECOP I sin valor adjudicado):
  N contratos · $ X", `summary.estimados`; "antes de 2018" solo va en la nota general de la API, nunca como
  etiqueta por contrato). Referencia del 2026-10-11, solo con el Integrado: SECOP I pasaba de
  $ 5,09 a $ 3,82 billones con el reparto; en La Samaritana (NIT 899999032) el valor por proceso es 4 a 5
  veces el adjudicado (3,63 frente a 0,90 billones), así que las cifras de SECOP I bajan de forma importante
  al cargar `secop1` (anotar las nuevas en `fase5-fuentes-automaticas.md` tras la carga inicial).
- **Fuera de escala** (un contrato —o su parte del proceso— de más de 50.000 millones, el umbral `VALOR_ATIPICO_COP` de la carga):
  se lista con la marca "Fuera de escala, no suma" y no suma en ningún total (suelen ser errores de
  digitación o el valor de un proceso entero; el 2026-10-11 eran 3 contratos por $ 680 mil millones). La
  ficha y el ranking dicen cuántos se excluyeron y por cuánto.
- **Valor alto para la entidad**: los demás contratos que la carga marca `atipico` (por encima del p99 de su
  entidad con 100+ contratos) son contratos grandes reales: **suman** y se marcan para revisar. Se decidió
  así porque excluirlos quitaba el 1 % más grande de cada hospital (397 contratos, varios de menos de
  1.000 millones; en el Hospital General de Medellín pesaban más que todo lo demás).
- **Servicios de especialistas aparte**: un contrato con `especialidad_medico` y sin línea de producto
  (persona natural o empresa de especialistas) va a "Médicos contratados", no a compras ni a proveedores.
  Una persona natural con línea ortopédica (p. ej. suministro de osteosíntesis) es un proveedor de material
  más (se muestra su nombre, nunca su documento).
- **Una entidad = un NIT.** Si el NIT tiene varias sedes activas en OpMap, su compra se reparte entre ellas en
  proporción a las camas (misma regla que los giros ADRES, `sedeShares()`) para agregar por zona o Ejecutivo
  Comercial; el total no se duplica. Un contrato cuenta (en número) en cada fila que toca.
- **Ámbito**: por defecto solo entidades que son IPS de OpMap. Al agrupar por proveedor se puede pedir
  "Todas las entidades públicas" (`ambito=todas`; sin filtro de departamento).
- **Rango** del ranking por fecha de firma; por defecto los 24 meses que terminan en el mes actual (hora de
  Bogotá). La ficha muestra 24 meses y el histórico completo. **El mapa** (tarjetas de municipio, localidad e IPS,
  desde 2026-10-24) usa **12 meses** calendario hasta hoy (`MAPA_VENTANA_MESES` en `lib/types/mapa-detalle.ts`;
  cuentas puras en `lib/mapa-detalle.ts`, mismas reglas de suma que aquí, que no se toca): solo material de las 6
  líneas, con "sin clasificar" aparte y con valor, servicios de especialistas y personas naturales aparte, contados y
  sin nombres. La ficha y el ranking siguen en 24 (spec `docs/specs/2026-10-24-mapa-giros-y-compras-12-meses.md`).
- **Entidad de compra pública** (`resolverCompraPublica()` en `lib/compras-publicas.ts`): manda la marca
  manual `hospitals.compra_publica` (true/false; campo "Compra pública (SECOP)" del modal "Editar
  Información", permiso `hospitals:edit`, también por `PUT`/`PATCH /api/hospitals/[id]`, otro valor → 400);
  si es `null`, el REPS (Pública o Mixta); si tampoco, que el NIT figure como entidad contratante en SECOP. La
  respuesta de la ficha trae `compra_publica` y `publica_origen` (`manual` | `reps` | `contratos` |
  `ninguno`). Si no es pública, la ficha muestra una sola línea ("IPS privada: sin contratación pública
  (SECOP)" o, con la marca en "No", 'Compra pública (SECOP): marcada a mano como "No"'). Cambiar la marca no
  recalcula nada ni llama a Google: la carga semanal trae el histórico de la entidad (tarea "histórico").
- **Vigilado**: el NIT del proveedor está activo en `secop_proveedores_vigilados` (también los añadidos a
  mano, al instante).

## Privacidad de los médicos

Es información pública de contratación estatal. Se guarda nombre, entidad, objeto, valor, fechas, URL y
especialidad detectada. **Nunca el número de cédula en claro**: la carga guarda
`proveedor_hash = sha256(sal del proyecto : dígitos)` solo para deduplicar (la sal vive en `secop_ajustes`,
solo `service_role`), y un CHECK impide guardar documento de una persona. La API identifica a cada persona
por ese hash (`persona:<hash>`) y no devuelve documentos.

## API

Permiso `intelligence:view` salvo donde se indica. Sin las tablas de 0710 las rutas responden 503 con un
mensaje claro.

| Ruta | Qué devuelve |
| --- | --- |
| `GET /api/secop/hospital/[id]?page=&linea=` | Naturaleza (REPS), `publica` con `compra_publica` (marca manual) y `publica_origen`, nombre en SECOP, resumen 24 meses e histórico por línea, sin clasificar y fuera de escala aparte, `estimados` (contratos y valor de SECOP I que solo trae el Integrado; ya sumados), compras por año, proveedores (vigilado, valor, último contrato, líneas), médicos (especialidad, nº de contratos, último; marca "Empresa"), contratos con enlace al expediente, fuente ("SECOP I" / "SECOP II"), `estimado` y `valorProceso` (20 por página; `linea` = código, `no_clasificado`, `medicos` o `atipicos` = p99 y fuera de escala) |
| `GET /api/secop/hospital/[id]/procesos` | **Permiso `secop:procesos`** (los roles con `intelligence:view` y los Ejecutivos Comerciales, `sales_manager`). Procesos de SECOP II publicados sin contrato (radar comercial, spec `docs/specs/2026-10-25-secop-procesos-radar.md`) del NIT de la IPS: `ProcesosDetalle` `{ ventana, total, procesos }` de la vista `secop_procesos_radar` (estados del radar y sin contrato cargado de la misma entidad), 24 meses por fecha de publicación (desde el día 1 de hace 23 meses hasta hoy en Bogotá), más recientes primero, como máximo 50 (`total` los cuenta todos: se lee la ventana entera del NIT y se corta en `resumirProcesos`). Cada proceso: proveedor que figura (empresa con NIT, nombre o título; persona natural sin nombre ni documento; o ninguno), precio base (nunca sumado), fecha, referencia, líneas y url del expediente; nunca título, descripción, documentos ni hashes. IPS activa (404 si no); solo si es entidad de compra pública con la regla de la ficha (marca manual → REPS → contratos cargados, este último por existencia: `select id … limit 1`); si no, sin NIT o sin la vista (0890 sin aplicar) → 200 con `total: 0`. Pruebas: `npm run secop-procesos-api:check` |
| `GET /api/secop/ranking?group=hospital\|proveedor\|zona\|ejecutivo&linea=&desde=YYYY-MM&hasta=YYYY-MM&line=&departamento=&ambito=ips\|todas` | KPIs (total, contratos, entidades, proveedores, % a vigilados, médicos, fuera de escala), desglose por línea antes del filtro, ranking y tabla proveedor × hospital (300 pares de más valor). `line` (línea de negocio) es obligatoria para `ejecutivo` y debe ser del usuario (403) |
| `GET /api/secop/proveedor/[nit]` | Dónde vende un proveedor (NIT con o sin DV): total, parte ortopédica, a IPS de OpMap, por línea y año, y por entidad (marca "IPS de OpMap") |
| `GET /api/secop/vigilados` | Lista vigilada con sus ventas de material en SECOP y `canEdit` |
| `POST /api/secop/vigilados` `{nit, nombre?, nota?, activo?}` | Alta manual (origen `manual`, DV calculado) o (re)activación. Solo admin (`fuentes:manage`) |
| `DELETE /api/secop/vigilados?nit=` | Desactiva (baja lógica; la fila se conserva). Solo admin. 404 si no está |
| `GET /api/fuentes` | Estado de cada fuente: `fuentes_estado` + catálogo (`lib/fuentes-estado.ts`), horario en hora de Colombia, próxima ejecución, semáforo y si existe `CRON_SECRET` (sin revelarla). Solo admin |
| `POST /api/fuentes/[fuente]/actualizar` | Una ronda (≤ 50 s) de la carga con el MISMO ejecutor del cron (`ejecutarFuente` de `lib/fuentes-runner.ts`, bloqueo y cursor en `fuentes_estado`): `{ok, terminado, estado, filas, mensaje, duracionMs}`. Solo admin; 409 para la ADRES (GitHub Actions); `estado: 'ocupada'` si el cron la tiene tomada |

Permiso nuevo **`fuentes:manage`** (solo admin): panel de fuentes, "Actualizar ahora" y edición de la lista
vigilada.

### Migración 0720 (aplicada el 2026-10-11, aditiva)

`database/migrations/2026-10-11_0720_secop_api.sql` crea `secop_hechos(p_desde, p_hasta, p_nits,
p_proveedores)`: los contratos de `secop_contratos_unicos` agregados por entidad, proveedor, persona,
especialidad, línea, atípico, fuera de escala (> 50.000 M) y año, en UN jsonb (PostgREST corta en 1.000
filas), con el reparto de los procesos de SECOP I (calculado antes de filtrar por fecha o proveedor).
Comprobado tras la carga inicial: 45.563 contratos → 9.087 grupos, misma suma de contratos que la vista y
suma de valor = la de la vista con el reparto ($ 3.818.338.834.812; sin reparto $ 5.093.633.512.703), 3 fuera
de escala; anon sin EXECUTE. El ranking con todo el histórico bajó de ≈ 6 s a ≈ 1,4 s. Se aplicó tres veces
el mismo día (CREATE OR REPLACE): la primera sin "fuera de escala" ni reparto. Sin la función la API sigue funcionando (lee contrato
por contrato). Rollback `2026-10-11_9929_secop_api_rollback.sql` (antes de `9930_secop_rollback`).

### Migración 0730 (escrita el 2026-10-12, **NO aplicada**; aditiva)

`database/migrations/2026-10-12_0730_secop_i_y_compra_publica.sql`: `hospitals.compra_publica` boolean
(null = según REPS); `secop_contratos.valor_proceso` y `valor_adiciones` numeric(18,2); `fuente` admite
`secop1` (solo con `origen = 'SECOPI'`); índice parcial por constancia; vista `secop_contratos_unicos` con
`estimado` y sin las filas del Integrado cuya constancia ya trae `secop1`; `secop_hechos()` con la clave `est`
y el reparto solo para `fuente = 'integrado' AND origen = 'SECOPI'`; `secop_nits_ips()` con la marca manual;
semilla de las 10 entidades sin REPS pública/mixta y de la fuente `secop_i`. Un bloque DO final prueba constraints, regla de la
constancia, reparto (300 + 500 repartido = 800 en 3 contratos, 500 estimados) y la semántica de la marca con
filas de prueba que se deshacen. Se aplica con autorización del dueño, en la misma ventana que el despliegue
del código (antes de ella el código nuevo falla con "column does not exist" en la ficha y en el upsert de la
carga); después, `NOTIFY pgrst, 'reload schema'` y la carga inicial de `secop1`. Rollback
`2026-10-12_9931_secop_i_rollback.sql` (antes de 9929 y 9930). Detalle en `database/migrations/README.md`.

## UI

- **Ficha de IPS** (`web/components/HospitalSecopCard.tsx`, una línea en `app/hospitals/[id]/page.tsx`,
  después de "Giros ADRES"): tarjeta "Contratación pública (SECOP)" solo para entidades de compra pública y
  solo para quien tiene `intelligence:view`. KPIs por línea (24 meses e histórico), columnas por año apiladas
  por línea (`SecopAnnualChart.tsx`, al ancho real del contenedor), proveedores con marca "Vigilado" (enlace
  al detalle del proveedor), médicos contratados, contratos paginados con filtro y "Ver expediente en SECOP".
  Desde 2026-10-12: cada contrato muestra su fuente ("SECOP I" / "SECOP II") y, si es estimado, el chip
  "Estimado" con la nota "Valor estimado: SECOP Integrado publica el valor del proceso (X) en cada uno de sus N
  contratistas; aquí cuenta su parte"; si es un adjudicado real cuyo valor difiere del del proceso, "Proceso:
  X · adjudicado a este contratista: Y". En el KPI total, la línea ámbar "Estimados (SECOP I sin valor
  adjudicado): N contratos · $ X". Si la IPS está marcada a mano, el chip ámbar "Compra pública: marcada a
  mano" en la
  cabecera. En el modal "Editar Información" (Información Básica, tras Tipo) el selector "Compra pública
  (SECOP)": Según REPS / Sí / No; en "Información General" se ve "Compra pública (SECOP): Sí/No (marcada a
  mano)" solo si está marcada.
- **Ficha de IPS, procesos sin contrato** (desde 2026-10-25, `web/components/HospitalProcesosCard.tsx`, justo después
  de "Contratación pública (SECOP)"): tarjeta aparte "Procesos publicados sin contrato (SECOP II)" con "Últimos 24 meses
  (<rango>) · N procesos", la nota fija "Precio base de la convocatoria. La entidad no registró el contrato en SECOP:
  confirmar con la entidad. No suma a las compras." y, por proceso, "Proveedor que figura: <empresa> · NIT …" (con
  "según el título del proceso" si sale del título y "Vigilado" si aplica; "persona natural" sin nombre; "Proveedor no
  publicado" si no figura nadie), el precio base, "Publicado el dd/mm/aaaa · Ref. …", las líneas y "Ver proceso". 5
  filas visibles y "Ver los N"; si hay más de 50, "Se muestran los 50 más recientes de N". Solo con `secop:procesos`
  (también los Ejecutivos Comerciales, que no ven la tarjeta de compras). Sin procesos, mientras carga o si la ruta
  falla, no aparece nada.
- **`/inteligencia`** ahora tiene pestañas (`?tab=`): "Giros y población" (lo de siempre), "Compras públicas"
  (`IntelligenceSecop.tsx`) y, solo admin, "Fuentes de datos" (`FuentesDatosPanel.tsx`).
  - Compras públicas: filtros (línea de producto, línea de negocio para ejecutivo, departamento, entidades,
    desde, hasta, Restablecer, Exportar CSV), KPIs, barras por línea, ranking Hospital / Proveedor / Zona /
    Ejecutivo Comercial, tabla proveedor × hospital con buscador, panel del proveedor
    (`?proveedor=<nit>`) y, solo admin, "Lista vigilada de proveedores" (`SecopVigilados.tsx`).
  - Fuentes de datos: una tarjeta por fuente con horario, último OK, último intento, filas, siguiente
    programado, mensaje, semáforo (Al día / Atrasada / Error / En curso / Sin cargar) y "Actualizar ahora"
    (sigue solo hasta 10 rondas de 50 s; "Detener tras esta ronda"). Aviso si falta `CRON_SECRET`.
- CSV para Excel en español (BOM, `;`, CRLF, sin fórmulas): ranking + sección proveedor × hospital.
- Celular: tarjetas en lugar de tablas, KPIs en 2 columnas, botones y campos de al menos 44 px; el panel del
  proveedor es una hoja inferior que empieza debajo de la barra superior.
- **Mapa** (desde 2026-10-24, `GirosComprasSection` en `web/components/MapPopups.tsx`; detalle en
  `docs/mapa-estetica.md`, "2026-10-24"): las tarjetas de municipio, localidad e IPS muestran "Compras públicas de
  material ortopédico y neurocirugía (SECOP) · <rango de 12 meses>" junto a los giros ADRES, solo con `intelligence:view`
  y pidiendo `GET /api/map/detalle/*` al abrir la tarjeta. Proveedores empresa por valor (NIT, contratos, último,
  líneas, "Vigilado"; 5 y "Ver los N proveedores"); "Sin clasificar", "Servicios de especialistas" y "Personas
  naturales" aparte y sin nombres; IPS privada → "IPS privada: sin contratación pública (SECOP)"; pública sin hechos →
  "Sin contratos de ortopedia o neurocirugía en SECOP en los últimos 12 meses". Reemplaza a los contratos cargados a
  mano (`hospital_contracts`), que ya no van en el mapa; `/contracts` y `/providers` siguen vivos.

## Cómo añadir un NIT a la lista vigilada

1. Entrar como admin a `/inteligencia` → pestaña "Compras públicas" → sección "Lista vigilada de
   proveedores" (al final).
2. Escribir el NIT de la empresa: 9 dígitos, con o sin DV (`900123456`, `9001234567` o `900.123.456-7`; si
   trae DV se valida con la regla de la DIAN) y, opcional, el nombre. "Añadir NIT".
3. Sus contratos ya cargados con IPS públicas se marcan "Vigilado" de inmediato. Su histórico con cualquier
   entidad llega en la siguiente pasada incremental de la carga (tarea "histórico", ver
   `fase5-fuentes-automaticas.md`); para no esperar al cron: "Fuentes de datos" → SECOP II / SECOP I / SECOP
   Integrado → "Actualizar ahora".
4. "Desactivar" quita la marca sin borrar la fila; con "Ver inactivos" se puede "Activar" de nuevo.

Por API: `POST /api/secop/vigilados` con `{"nit": "900123456", "nombre": "…"}` (sesión de admin).

## Código

- `web/lib/compras-publicas.ts` (puro): líneas y rótulos, NIT/DV, ficha (`summarizeHospitalSecop`, con
  `estimados`), reparto solo de los estimados (`repartirProcesosSecopI`), entidad de compra pública
  (`resolverCompraPublica`), ranking (`aggregateSecopRanking`), proveedor (`summarizeProveedorSecop`),
  parámetros, CSV, horario cron en hora de Colombia, semáforo de fuentes y las formas de respuesta de la API.
- `web/app/api/secop/_lib/secop-server.ts`: único archivo que conoce las columnas de las tablas de SECOP.
- `web/app/api/fuentes/_lib/catalogo.ts` (catálogo derivado de `FUENTES`) y `runner.ts` (puente a
  `ejecutarFuente`).

## Pruebas

`cd web && npm run secop-api:check` (también dentro de `npm run test`): 153 pruebas puras sin red con datos
ficticios (NIT y DV, líneas y "Sin clasificar", ficha con ventana de 24 meses, fuera de escala y servicios
aparte, atípico p99 que sí suma, SECOP I con valor adjudicado intacto y reparto SOLO de los estimados,
`estimados` del resumen sumados en el total, `resolverCompraPublica` (manual → REPS → contratos), persona
proveedora vs. médico, médicos sin documento, paginación y filtros, ranking por los 4 grupos con reparto por
camas, filtros de línea y departamento, ámbito, proveedor × hospital, proveedor, parámetros, CSV, horario
cron y semáforo de fuentes). El mapeo de `f789-7hwg` con las filas reales del Erasmo Meoz, las URL SoQL de
`secop1` y la fuente `secop_i` están en `npm run secop:check` (241); la validación zod de `compra_publica`
(true/false/null; otro valor → 400) en `npm run ips:check`; la regla SQL (vista, `secop_hechos()`,
`secop_nits_ips()`) en el bloque DO de la migración 0730.

`npm run secop-procesos-api:check` (también en `npm run test`): `GET /api/secop/hospital/[id]/procesos` contra un
Supabase falso con la vista `secop_procesos_radar` calculada con la regla SQL de la 0890 y la tabla sembrada pasando
filas reales de `p6dx-8zbt` (HU del Caribe y HU de Santander) por `mapSecopProceso`: 403 sin `secop:procesos` sin leer
tablas, 200 para `sales_manager` con la misma respuesta que admin, el proceso de VG MEDICAL SAS (NIT 901080496, 1.760 M),
fuera los que tienen contrato cargado (por portafolio y por noticeUID), los cancelados, los anteriores a 24 meses y los
servicios; vista ausente → 200 total 0; IPS privada o marcada "No" → total 0 sin leer la vista; sin título, descripción,
documentos, hashes ni nombres de personas; textos prohibidos en la respuesta y en la tarjeta.

## Límites

- Mientras la carga inicial de una fuente no termina, el histórico está incompleto (el panel "Fuentes de
  datos" dice en qué tarea va). Hasta que se aplique la migración 0730 y se cargue `secop1`, SECOP I sigue
  entrando solo por el Integrado (todo estimado).
- `f789-7hwg` solo tiene detalle por contrato desde 2017-2018: las cifras de SECOP I de 2014-2017 son
  estimadas (valor del proceso repartido por partes iguales) y la ficha lo dice. El reparto no corrige los
  contratos generales de "material médico quirúrgico" que la clasificación pone en "trauma" porque nombran
  osteosíntesis entre muchos ítems (ver `fase5-fuentes-automaticas.md`, "Limitaciones").
- SECOP I a veces registra a una empresa con tipo de documento "Nit de Persona Natural" (se vio un contrato
  de "MDT MEDICAL TECHNOLOGY SAS" así): la carga la guarda como persona (sin documento, solo hash), y en la
  ficha aparece sin NIT, con la marca "Persona natural" y sin enlace al detalle del proveedor.
