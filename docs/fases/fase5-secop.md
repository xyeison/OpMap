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
| SECOP Integrado (SECOP I + II desde 2005) | `rpmr-utcd` | Carga semanal; da el histórico (`fuente = 'integrado'`, `origen` SECOPI / SECOPII) |
| SECOP I · Procesos | `f789-7hwg` | Solo respaldo (no se carga) |
| SECOP II · Procesos | `p6dx-8zbt` | Licitaciones abiertas (oportunidades): opcional, no cargado |

La API suma siempre sobre la vista `secop_contratos_unicos` (el Integrado repite los contratos de SECOP II;
la vista se queda con la fila de SECOP II).

## Alcance

- **Entidades**: NIT de IPS activas con alguna sede Pública o Mixta en el REPS (`reps_sedes.naturaleza`):
  131 NIT el 2026-10-11. De ellas entra un contrato si clasifica en una línea, si es de un proveedor vigilado
  o si es un servicio de especialista.
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
- **SECOP I: valor del proceso repetido por contratista.** SECOP I publica el valor del PROCESO en cada uno de
  sus contratistas (misma constancia `numero_contrato`, mismo valor). La API cuenta esas filas una vez,
  repartiendo el valor por partes iguales entre ellas (`repartirProcesosSecopI()` en la ficha y la misma regla
  en `secop_hechos()`); la ficha lo dice en cada contrato. Medido el 2026-10-11: SECOP I pasa de
  $ 5,09 a $ 3,82 billones en total; en la Samaritana (NIT 899999032), "trauma" de $ 780 mil millones (352
  filas, 84 procesos) a $ 44,8 mil millones. El reparto entre contratistas es una estimación (SECOP I no
  publica la parte de cada uno).
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
  Bogotá). La ficha muestra 24 meses y el histórico completo.
- **IPS pública**: REPS Pública o Mixta para su NIT, o el NIT figura como entidad en SECOP. Si no, la ficha
  muestra una sola línea: "IPS privada: sin contratación pública (SECOP)".
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
| `GET /api/secop/hospital/[id]?page=&linea=` | Naturaleza (REPS), nombre en SECOP, resumen 24 meses e histórico por línea, sin clasificar y fuera de escala aparte, compras por año, proveedores (vigilado, valor, último contrato, líneas), médicos (especialidad, nº de contratos, último; marca "Empresa"), contratos con enlace al expediente (20 por página; `linea` = código, `no_clasificado`, `medicos` o `atipicos` = p99 y fuera de escala) |
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

## UI

- **Ficha de IPS** (`web/components/HospitalSecopCard.tsx`, una línea en `app/hospitals/[id]/page.tsx`,
  después de "Giros ADRES"): tarjeta "Contratación pública (SECOP)" solo para IPS públicas y solo para quien
  tiene `intelligence:view`. KPIs por línea (24 meses e histórico), columnas por año apiladas por línea
  (`SecopAnnualChart.tsx`, al ancho real del contenedor), proveedores con marca "Vigilado" (enlace al detalle
  del proveedor), médicos contratados, contratos paginados con filtro y "Ver expediente en SECOP".
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

## Cómo añadir un NIT a la lista vigilada

1. Entrar como admin a `/inteligencia` → pestaña "Compras públicas" → sección "Lista vigilada de
   proveedores" (al final).
2. Escribir el NIT de la empresa: 9 dígitos, con o sin DV (`900123456`, `9001234567` o `900.123.456-7`; si
   trae DV se valida con la regla de la DIAN) y, opcional, el nombre. "Añadir NIT".
3. Sus contratos ya cargados con IPS públicas se marcan "Vigilado" de inmediato. Su histórico con cualquier
   entidad llega en la siguiente pasada incremental de la carga (tarea "histórico", ver
   `fase5-fuentes-automaticas.md`); para no esperar al cron: "Fuentes de datos" → SECOP II / SECOP Integrado
   → "Actualizar ahora".
4. "Desactivar" quita la marca sin borrar la fila; con "Ver inactivos" se puede "Activar" de nuevo.

Por API: `POST /api/secop/vigilados` con `{"nit": "900123456", "nombre": "…"}` (sesión de admin).

## Código

- `web/lib/compras-publicas.ts` (puro): líneas y rótulos, NIT/DV, ficha (`summarizeHospitalSecop`), ranking
  (`aggregateSecopRanking`), proveedor (`summarizeProveedorSecop`), parámetros, CSV, horario cron en hora de
  Colombia, semáforo de fuentes y las formas de respuesta de la API.
- `web/app/api/secop/_lib/secop-server.ts`: único archivo que conoce las columnas de las tablas de SECOP.
- `web/app/api/fuentes/_lib/catalogo.ts` (catálogo derivado de `FUENTES`) y `runner.ts` (puente a
  `ejecutarFuente`).

## Pruebas

`cd web && npm run secop-api:check` (también dentro de `npm run test`): 137 pruebas puras sin red con datos
ficticios (NIT y DV, líneas y "Sin clasificar", ficha con ventana de 24 meses, fuera de escala y servicios
aparte, atípico p99 que sí suma, reparto de procesos de SECOP I,
persona proveedora vs. médico, médicos sin documento, paginación y filtros, ranking por los 4 grupos con
reparto por camas, filtros de línea y departamento, ámbito, proveedor × hospital, proveedor, parámetros, CSV,
horario cron y semáforo de fuentes).

## Límites

- Mientras la carga inicial del Integrado no termina, el histórico está incompleto (el panel "Fuentes de
  datos" dice en qué tarea va).
- El reparto de SECOP I corrige el valor del proceso repetido, pero no las filas que SECOP I trae con valores
  distintos para el mismo contratista, ni los contratos generales de "material médico quirúrgico" que la
  clasificación pone en "trauma" porque nombran osteosíntesis entre muchos ítems (ver
  `fase5-fuentes-automaticas.md`, "Limitaciones").
- SECOP I a veces registra a una empresa con tipo de documento "Nit de Persona Natural" (se vio un contrato
  de "MDT MEDICAL TECHNOLOGY SAS" así): la carga la guarda como persona (sin documento, solo hash), y en la
  ficha aparece sin NIT, con la marca "Persona natural" y sin enlace al detalle del proveedor.
