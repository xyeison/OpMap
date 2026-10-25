# Fase 5 (2026-10-11): fuentes de datos que se actualizan solas y carga de SECOP

Rama `feat/secop-compras-publicas` (PR 7). Pregunta del dueño: "¿estamos haciendo algo que consulte estas
fuentes y esté actualizado?". Respuesta: hasta el 2026-10-11 **no** (todas las cargas se corrían a mano).
Desde este PR las cargas ligeras corren solas en Vercel Cron, la pesada (ADRES) en GitHub Actions, y cada
corrida deja su estado en la tabla `fuentes_estado`, que el panel "Fuentes de datos" de `/inteligencia`
muestra (solo admin) con el botón "Actualizar ahora".

Este documento cubre la **carga** (tablas, reglas, cron, Actions, qué configurar). La API y la UI de
compras públicas están en `docs/fases/fase5-secop.md`. Nada de esto recalcula asignaciones ni llama a Google.

## Qué se actualiza, cuándo y cómo

Horas en UTC (Bogotá = UTC − 5). En el plan Hobby de Vercel un cron corre como mucho una vez al día y puede
dispararse en cualquier minuto de la hora indicada; todos los de OpMap son diarios o menos frecuentes.

| Fuente (`fuentes_estado.fuente`) | Qué carga | Cuándo | Quién | Cómo sabe que hay datos nuevos |
| --- | --- | --- | --- | --- |
| `secop_ii` | SECOP II Contratos (`jbjy-vk9h`) → `secop_contratos` | Diario 06:00 | Vercel Cron `/api/cron/secop_ii` | `ultima_actualizacion ≥ última vista − 3 días` |
| `secop_i` | SECOP I Procesos (`f789-7hwg`: contratista y valor **adjudicado** por contratista, desde 2017-2018) → `secop_contratos` (`fuente = 'secop1'`) | Martes 07:00 | Vercel Cron `/api/cron/secop_i` | `ultima_actualizacion` **o** `fecha_de_firma ≥ última vista − 30 días` |
| `secop_integrado` | SECOP Integrado (`rpmr-utcd`, SECOP I + II; para SECOP I solo respaldo estimado de lo que `f789-7hwg` no trae, sobre todo antes de 2018) → `secop_contratos` | Lunes 07:00 | Vercel Cron `/api/cron/secop_integrado` | `fecha_de_firma ≥ última vista − 30 días` |
| `secop_procesos` | SECOP II Procesos (`p6dx-8zbt`): procesos de ortopedia o neurocirugía de las IPS públicas, **sin contrato** → `secop_procesos` (tabla aparte; nunca suman a las compras) | Diario 06:30 | Vercel Cron `/api/cron/secop_procesos` | No hay marca de agua fiable: cada pasada relee lo publicado en los últimos 120 días y hace upsert |
| `reps_sedes` | Sedes del REPS (`c36g-9fc2`) → `reps_sedes` | Día 2, 08:00 | Vercel Cron `/api/cron/reps_sedes` | `rowsUpdatedAt` del dataset más nuevo que la última carga |
| `bdua` | BDUA contributivo y subsidiado → `bdua_afiliados` | Día 4, 08:00 | Vercel Cron `/api/cron/bdua` | El corte de `rowsUpdatedAt` no está en `bdua_afiliados` |
| `minsalud_cifras` | Cifras de afiliación de MinSalud → `afiliacion_cifras` | Día 5, 08:00 | Vercel Cron `/api/cron/minsalud_cifras` | La página de MinSalud enlaza un ZIP de un mes posterior al último corte cargado |
| `adres_identifica` | ADRES "Identifica tu Giro" → `adres_giros_detalle` | Día 3, 07:00 | GitHub Actions `.github/workflows/datos.yml` | Carga el mes anterior completo (reanudable) |
| (todas) | Sigue las pasadas que quedaron a medias | Diario 09:30 | Vercel Cron `/api/cron/continuar` | `fuentes_estado.estado = 'corriendo'` |

### Cómo funciona una invocación

- **Un solo ejecutor** (`web/lib/fuentes-runner.ts → ejecutarFuente`) para el cron, el botón "Actualizar
  ahora" (`POST /api/fuentes/[fuente]/actualizar`) y el script de carga inicial. Mismo código siempre.
- **Bloqueo**: antes de empezar toma `fuentes_estado.bloqueo_hasta` con un UPDATE condicional; si otra
  invocación lo tiene, responde "ocupada" y no hace nada. Caduca solo (75 s en Vercel; 30 min en el script).
- **Presupuesto**: cada invocación trabaja como máximo 50 s (Vercel corta a los 60 s; `maxDuration = 60`).
  Si no termina, deja el avance en `fuentes_estado.cursor`, cierra con estado `corriendo` y la siguiente
  invocación (o el cron diario `continuar`, o el siguiente clic) sigue desde ahí.
- **Cierre**: `ok` (terminó; actualiza `ultimo_ok`), `corriendo` (pasada a medias) o `error` (con el mensaje;
  el cursor se conserva para reintentar). Siempre fija `siguiente_programado` con la expresión cron.
- **Seguridad**: el middleware deja pasar `/api/cron/*` sin sesión porque Vercel Cron no manda cookie; la ruta
  exige `Authorization: Bearer <CRON_SECRET>` (comparación en tiempo constante). Sin `CRON_SECRET` responde
  503 y no carga nada. El botón del panel exige sesión con el permiso `fuentes:manage` (solo admin).

## Lo que tiene que hacer el dueño (una sola vez)

### 1. Vercel: `CRON_SECRET` (enciende las cargas automáticas)
1. Generar un valor aleatorio largo, por ejemplo en una terminal: `openssl rand -hex 32`.
2. Vercel → proyecto de OpMap → **Settings → Environment Variables → Add New**.
   Nombre `CRON_SECRET`, valor el del paso 1, entorno **Production**. Guardar.
3. **Deployments** → el último despliegue de producción → **Redeploy** (las variables nuevas solo se leen al
   desplegar). Vercel enviará `Authorization: Bearer <CRON_SECRET>` en cada llamada del cron.
4. Comprobar: en Vercel → Settings → **Cron Jobs** aparecen los 7 trabajos de `web/vercel.json`; ahí mismo
   "Run" lanza uno a mano. En `/inteligencia` → pestaña "Fuentes de datos" desaparece el aviso de
   `CRON_SECRET` y, al día siguiente, `SECOP II` muestra "Último OK" de esa madrugada.
5. Opcional: `SOCRATA_APP_TOKEN` (token de aplicación gratuito de datos.gov.co) sube el límite de peticiones;
   la carga lo usa si existe. Sin él funciona igual.

### 2. GitHub: secretos para la carga de la ADRES
1. GitHub → repositorio `OpMap` → **Settings → Secrets and variables → Actions → New repository secret**.
2. `NEXT_PUBLIC_SUPABASE_URL` = la URL del proyecto de Supabase (la misma que está en Vercel).
3. `SUPABASE_SERVICE_ROLE_KEY` = Supabase → Project Settings → API → `service_role` (secreta: solo en GitHub
   Secrets, nunca en el código, un issue o un chat).
4. Probar: pestaña **Actions** → "Datos ADRES (mensual)" → **Run workflow** (campo "desde" vacío = mes anterior).
   El job marca `adres_identifica` como "corriendo" al empezar y "ok" o "error" al terminar, con el enlace a la
   corrida, en el panel "Fuentes de datos".
5. Riesgo conocido: si el firewall de la ADRES bloquea las IP de GitHub, el job termina en error (el script
   se detiene, no lo evade) y el panel lo dice. Entonces se corre desde un equipo propio:
   `cd web && node scripts/adres-identifica-giro.mjs --desde <AAAA-MM>`.

## SECOP: modelo (migración 0710, aplicada el 2026-10-11; `2026-10-12_0730` añade `secop1`, `valor_proceso`, `valor_adiciones` y `hospitals.compra_publica`)

| Tabla / objeto | Qué guarda |
| --- | --- |
| `secop_proveedores_vigilados` | NIT (9 dígitos) de los proveedores de material que se vigilan. Semilla: 76 de Odoo (`es_empresa` y no intercompañía, con `compras_gcp_cop`); `origen` odoo_gcp / manual, `activo`, `nota` |
| `secop_contratos` | Un contrato por fila. `fuente` secop2 / secop1 / integrado, `origen` SECOPI / SECOPII, `id_contrato` (único por fuente), entidad (NIT a 9 dígitos, nombre, departamento, municipio, nivel), `hospital_id` (IPS principal de ese NIT), proveedor (`documento_proveedor` a 9 dígitos si es empresa; `proveedor_hash` si es persona), `proveedor_vigilado_id`, `es_persona`, tipo, modalidad, UNSPSC, objeto, descripción, `linea` + `lineas`, `especialidad_medico`, valores (`valor`, `valor_pagado`; `valor_proceso` y `valor_adiciones` solo en secop1), fechas, estado, URL, `ultima_actualizacion`, `atipico` |
| `secop_contratos_unicos` (vista) | Para sumar sin doble conteo: el Integrado repite los contratos de SECOP II (mismo `CO1.PCCNTR…`) y los de SECOP I (misma constancia y entidad que `secop1`); la vista se queda con la fila de SECOP II / `secop1` y marca `estimado` las de SECOP I que solo trae el Integrado |
| `secop_ajustes` | La sal aleatoria del hash de documentos (generada en la migración; solo `service_role`) |
| `fuentes_estado` | Estado de cada carga (ver arriba) |
| `secop_nits_ips()` | NIT de las IPS activas → IPS principal (más camas) y si es entidad de compra pública: `hospitals.compra_publica` manual (true/false) o, si es null, pública o mixta en el REPS |
| `secop_marcar_atipicos()` | Recalcula `atipico` al cerrar cada pasada |

### Alcance (qué entra)
- **Entidades objetivo**: NIT de IPS activas con alguna sede Pública o Mixta en `reps_sedes` (cruce por NIT), o
  marcadas a mano "Compra pública: sí" (`hospitals.compra_publica = true`; la migración `0730` marca 10 sin
  ninguna sede REPS pública/mixta con su NIT: las 6 UPRES de la Policía, HOCEN, HONAC, ESE San Marcos y ESE
  Corozal). Con `false` la IPS queda fuera aunque el
  REPS diga Pública. Eran **131** el 2026-10-11 por REPS (128 si se cruza por `hospitals.reps_code`).
- De ellas entra un contrato si **clasifica en una línea**, si es de un **proveedor vigilado** o si es un
  **servicio de especialista** (ortopedia, neurocirugía, columna, deportiva). Lo demás (aseo, vigilancia,
  medicamentos, laboratorio…) no se guarda.
- De los **proveedores vigilados** entran **todos** sus contratos con cualquier entidad (para ver dónde venden).
- Un NIT que se añade a la lista vigilada (o una IPS pública nueva) trae su histórico completo en la siguiente
  pasada incremental (tarea "histórico"), sin tener que recargar todo.

### SECOP I (`f789-7hwg`, `fuente = 'secop1'`): valor adjudicado por contratista (2026-10-12)
El dataset "SECOP I - Procesos de Compra Pública" trae una fila por contrato-contratista con `cuantia_contrato`,
`valor_total_de_adiciones` y `valor_contrato_con_adiciones`, además de `cuantia_proceso`. Comprobado con la
constancia 20-4-11235766 del Erasmo Meoz (proceso SS20-417, 1.189,8 M): Promed Quirúrgicos 30 M y UT VD Salud
1.159,8 M; el Integrado daba 1.189,8 M a cada uno (repartido por partes iguales: 594,9 M). Mapeo
(`mapSecopRow('secop1', …)` en `web/lib/secop.ts`, probado en `secop-check` con esas dos filas reales):
- `valor` = `valor_contrato_con_adiciones` si > 0, si no `cuantia_contrato`; `valor_proceso` = `cuantia_proceso`;
  `valor_adiciones` = `valor_total_de_adiciones` (las otras dos fuentes dejan estas dos columnas en null).
- `numero_contrato` = `numero_de_constancia` (igual al `numero_del_contrato` del Integrado: por ahí la vista
  `secop_contratos_unicos` descarta la fila del Integrado de la misma constancia y entidad); `referencia` =
  `numero_de_proceso`; `proceso` = `numero_de_contrato` (número interno de la entidad); `id_contrato` =
  `SECOPI|<id_adjudicacion>` cuando es numérica (una por contrato-contratista; funde las filas duplicadas del
  dataset), si no ("Sin Adjudicar", vacía) el compuesto del Integrado.
- Texto: `objeto` = `objeto_del_contrato_a_la` (si falta, `detalle_del_objeto_a_contratar`); `descripcion` = el
  detalle cuando difiere. **`objeto_a_contratar` no se usa**: en SECOP I es el segmento UNSPSC ("Servicios de
  Salud", "Equipo Médico, Accesorios y Suministros"), genérico y con palabras ("equipo", "suministros") que
  confunden la regla servicio/producto. `nombre_clase` tampoco: la clase la elige la entidad a ojo (851221
  "Servicios de rehabilitación" para material de osteosíntesis). `categoria_unspsc` = `id_clase` (clase UNSPSC de
  6 dígitos): como en SECOP II, solo decide cuando el texto no dice nada y nunca contra una exclusión.
- Contratista: `identificacion_del_contratista` + `tipo_identifi_del_contratista`, misma regla de persona natural
  (hash) o empresa (NIT a 9 dígitos). Sin identificación ni nombre ("No Definido": convocados, "Sin Firma",
  terminados anormalmente) la fila se descarta con error: no es un contrato adjudicado.
- Entidad: `nit_de_la_entidad` (texto, sin DV), `nombre_entidad` (ojo: no `nombre_de_la_entidad` como en el
  Integrado), `nivel_entidad`, departamento y municipio. URL: `ruta_proceso_en_secop_i`.
- Consulta: entidades por `nit_de_la_entidad in (…)` con las tres variantes del NIT; proveedores por
  `starts_with(identificacion_del_contratista, …)` con y sin puntos; prefiltro inicial sobre
  `objeto_del_contrato_a_la` y `detalle_del_objeto_a_contratar` más `id_clase like '4232%'`. Con 40 entidades la
  URL quedaría en 9,2 KB (con los tres campos de texto, 12 KB): las tareas de entidades de `secop1` son de **30**
  NIT (8,7 KB). Incremental: desde la marca por `ultima_actualizacion` **o** `fecha_de_firma_del_contrato` (la
  primera puede ser anterior a la firma: en la constancia de arriba 2020-11-03 frente a 2020-11-18), solape de 30
  días; la marca de agua de cada fila es la mayor de las dos. Cron los martes 07:00 UTC (`/api/cron/secop_i`).
- Cobertura: detalle por contrato desde 2017-2018; para antes solo existe el Integrado (valor del proceso
  repartido por partes iguales y marcado **estimado**; reglas de suma en `docs/fases/fase5-secop.md`).

### NIT
Siempre 9 dígitos (`normalizeNit` en `web/lib/secop.ts`): `900294380`, `9002943801`, `900.294.380-1`,
`900294380 1`, `860.529.890 - 0`, `830.035.101 ¿ 8` y `860.529.8900` dan `900294380` / `860529890` /
`830035101`. La consulta pide cada NIT en sus formas (sin DV, con DV pegado y con guion; en SECOP II
`nit_entidad` es numérico y solo admite las dos primeras; en SECOP I el proveedor se busca por prefijo con y
sin puntos). DV con la regla de la DIAN (`nitCheckDigit`).

### Clasificación por línea (v2, `clasificarContrato` en `web/lib/secop.ts`)
Sobre objeto + descripción sin tildes:
1. **Servicio profesional** sin compra de material ("médico especialista en ortopedia", "ejecutar los procesos
   de ortopedia", agremiaciones sindicales) → sin línea; va a `especialidad_medico`.
2. **Líneas específicas**: neurocirugía (neurocirug, craneal/cráneo, hidrocefalia, válvulas de derivación y
   aneurisma salvo el de aorta: endoprótesis aórticas o endovasculares son cirugía vascular, excluida), columna (columna vertebral, cirugía de columna, vértebra, pedicular, intersomático, fusión;
   "espinal" salvo anestesia y el municipio El Espinal), reemplazo (artroplastia, prótesis o reemplazo de
   cadera/rodilla/hombro, reemplazos articulares, cotilo), deportiva (artroscopia, medicina deportiva,
   ligamento, menisco, anclajes de sutura, manguito rotador) y trauma (osteosíntesis general/básica, fijación
   o fijador externo, tutor externo, trauma, fractura, clavo endo/intramedular, Kirschner, Steinmann,
   tornillo canulado). Placas, clavos y tornillos sueltos **no** cuentan (ferretería); con calificativo
   ortopédico o anatómico ("tornillo cortical", "placa tibia proximal", "placa DCP", "clavo intra medular")
   son trauma **solo si no aparece otra línea** (los tornillos de un cotilo son de reemplazo; el tornillo
   interferencial es de deportiva). Esto lo añadió la v2: en SECOP I muchas filas son ítems sueltos.
3. **Ninguna específica**: "osteosíntesis" → trauma; ortopedia genérica (ortopédico, traumatología, injerto,
   sustituto o tejido óseo, órtesis) → `otros_implantes`; categoría UNSPSC `4232xxxx` (implantes ortopédicos)
   → `otros_implantes`. Lo dental, oftálmico, cardiovascular, auditivo y los medicamentos nunca entran por
   genérico ni por UNSPSC; los contratos de residuos (recolección, incineración) nunca clasifican.
4. **Una específica**: esa línea ("osteosíntesis para neurocirugía" → neurocirugía), salvo un contrato de
   "osteosíntesis de ortopedia" que nombra la otra línea después, o para varias "especialidades" → trauma.
   "Ortopedia (artroscopia)" manda la línea calificada.
5. **Varias**: si nombra trauma u osteosíntesis → trauma (contrato general); si no, la primera del texto.
`lineas` guarda todas las detectadas (la principal primero). `clasificacion_version = 'v2'` (revisión del
2026-10-11: 1.135 ítems de osteosíntesis pasaron de sin clasificar a trauma y 18 contratos de aneurisma de
aorta dejaron de contar como neurocirugía y salieron del alcance). Si las reglas
cambian, se reclasifica desde `objeto` y `descripcion` guardados. El prefiltro SoQL de la carga inicial es
un superconjunto de estas reglas (lo comprueba `secop-check`).

### Privacidad de los médicos
Información pública de contratación estatal. Se guarda nombre, entidad, objeto, valor, fechas, URL y
especialidad. **Nunca el número de documento en claro**: `proveedor_hash = sha256(sal + ':' + dígitos)`, con
la sal de `secop_ajustes` (aleatoria, en la base, no en el código ni en variables de entorno). Un CHECK de la
tabla impide guardar documento si `es_persona`. También se trata como persona un "NIT" que no es de persona
jurídica (no son 9 dígitos que empiezan por 8 o 9: es la cédula + DV). En el Integrado, el identificador
compuesto del contrato usa un prefijo del hash, nunca la cédula.

### Atípicos
`atipico = valor > 50.000 millones` o `valor > p99 de los contratos de su entidad` (este segundo criterio
solo si la entidad tiene 100 contratos o más; si no, su mayor contrato siempre sería "atípico"). Lo recalcula
`secop_marcar_atipicos()` sobre la vista sin duplicados. `esAtipico()` en TypeScript aplica la misma regla.

### Carga incremental (cursor)
Una **pasada** recorre tareas (grupos de 40 NIT de entidades y de proveedores; 30 entidades en SECOP I, cuyo
prefiltro es más largo) y, por tarea, páginas SoQL
ordenadas por `:id`. La primera es la inicial (entidades con prefiltro de texto; proveedores sin filtro). Las
siguientes son incrementales sin prefiltro desde la marca de agua − solape. El cursor (`fuentes_estado.cursor`)
guarda modo, desde, tarea, offset, máxima marca vista (ignorando fechas futuras mal digitadas), contadores y
los NIT ya cubiertos. Si una consulta no cabe en los 50 s, se reintenta en la siguiente invocación; a la
tercera vez seguida la fuente queda en error pidiendo correr el script.

### Comandos
```bash
cd web
npx tsx scripts/secop-load.ts --inicial               # carga inicial completa de las tres fuentes (≈ 20–35 min)
npx tsx scripts/secop-load.ts                         # ponerse al día (sigue la pasada o hace la incremental)
npx tsx scripts/secop-load.ts --fuente secop1         # una sola fuente (secop1, secop2, integrado o todas)
npx tsx scripts/secop-load.ts --fuente secop1 --dry-run --max-paginas 2   # leer y clasificar sin escribir
npm run secop:check                                    # pruebas puras (también dentro de npm run test)
```

## Procesos de SECOP II sin contrato (`secop_procesos`, 2026-10-25)

Spec `docs/specs/2026-10-25-secop-procesos-radar.md` y decisión
`docs/decisiones/2026-10-25-procesos-secop-radar-comercial.md`. Radar comercial: 83 de las 141 IPS públicas publican sus
compras solo como **procesos** de "Contratación régimen especial" y nunca crean el contrato electrónico. Se cargan aparte,
en `public.secop_procesos` (migración `2026-10-25_0890_secop_procesos.sql`, **aplicada el 2026-10-25**, con carga inicial de 24 meses ese día: 10.967 filas leídas, 2.203 procesos; rollback
`…_9949_…`), que no tiene columnas `valor` ni `fecha_firma`: compras, ranking, `/inteligencia` y `secop_hechos` no la
conocen. La carga no toca `secop_contratos` ni llama a `secop_marcar_atipicos()`.

- **Código**: reglas puras en `web/lib/secop-procesos.ts` (mapeo, estado, proveedor que figura, redacción de pacientes,
  lotes, URL SoQL) y la pasada en `web/lib/secop-procesos-sync.ts` (`sincronizarSecopProcesos`). Rama propia en
  `web/lib/fuentes-runner.ts` (antes, una fuente sin rama caía en la carga de MinSalud; ahora lanza un error).
- **Fuente**: `fuentes_estado.fuente = 'secop_procesos'` ("SECOP II · Procesos sin contrato"), cron `30 6 * * *` en
  `web/vercel.json` (06:30 UTC = 01:30 en Bogotá), va después de las tres de contratos en `FUENTES`. Sale en "Fuentes de
  datos" con "Actualizar ahora" (mismo ejecutor y mismos 50 s) y la sigue el cron diario `continuar` si quedó a medias.
- **Qué se lee**: `nit_entidad in (…)` con lotes de **50 NIT** de las IPS públicas objetivo (`secop_nits_ips().publica`),
  en 9 dígitos y 10 con DV (sin guion: no aparece nunca), el prefiltro ortopédico (`SECOP_PREFILTRO_RAICES` sobre
  `nombre_del_procedimiento` y `descripci_n_del_procedimiento`, o `codigo_principal_de_categoria like 'V1.4232%'`) y
  `fecha_de_publicacion_del >= desde`, ordenado por `id_del_proceso`, con el User-Agent de OpMap (`fetchJsonSocrata`).
- **Modos**: `inicial` (la primera vez o con `--inicial`): desde el primer día de hace 24 meses (la ventana de la ficha).
  `incremental` (las demás): desde hoy − 120 días. p6dx-8zbt no tiene marca de agua fiable (`:updated_at` se recarga
  entero cada día y `fecha_de_ultima_publicaci` es igual a la de publicación en el 100 % de las filas), así que cada
  pasada RELEE la ventana y los cambios de estado de esos 120 días entran solos. Los NIT que no estaban en la última
  pasada completa traen su histórico de 24 meses en una tarea extra.
- **Cursor** (`fuentes_estado.cursor`): modo, `desde`, `desde_historico`, tarea, offset, contadores, `ultima_pasada`,
  `ultima_inicial`, `nits_completos` y `agotados`. Se guarda tras cada página junto con la renovación del bloqueo. Si la
  lista de tareas cambia a mitad de una pasada, vuelve a la tarea 0 con las mismas fechas. Si una consulta no cabe en los
  50 s, se reintenta en la siguiente invocación; a la tercera vez seguida la fuente queda en error pidiendo el script.
  Además, una invocación no empieza una página que, por la duración de la anterior, no cabría en lo que queda.
- **Lotes**: un proceso con varios lotes trae una fila por lote. Si una página viene llena, las filas de su último
  proceso no se guardan todavía: el offset avanza solo hasta donde empieza ese proceso y la página siguiente lo relee
  entero, así ningún proceso queda partido entre páginas (el upsert reemplaza, no acumula). `agregarLotes` los junta en
  una fila (valor adjudicado = suma de los lotes).
- **Qué se guarda**: upsert por `id_proceso` (`onConflict`) en lotes de 500, con `hospital_id` (IPS principal del NIT),
  `proveedor_vigilado_id`, `ultima_lectura` (`imported_at` queda con la primera lectura) y la descripción redactada.
  Estados: publicado, evaluación, abierto, seleccionado, adjudicado y cancelado (Borrador, En aprobación y Aprobado no se
  guardan). No se guardan los servicios de médicos, lo que solo clasifica por UNSPSC sin texto ortopédico (Yolombó) ni lo
  que no clasifica en una línea. Lo que se muestra lo decide la vista `secop_procesos_radar` (sin contrato cargado).
- **Privacidad**: una persona natural nunca se guarda con nombre ni documento (solo `proveedor_hash` con la sal de
  `secop_ajustes`, y un CHECK lo impide); el título del proceso (`nombre_del_procedimiento`) no se guarda; nombre y
  documento de pacientes en la descripción se reemplazan por "[dato personal omitido]" antes de guardar.
- **Volumen y tiempo**: la inicial son unas 10.600 filas prefiltradas en 3 peticiones (una por tarea, páginas de 5.000).
  Dry-run real de solo lectura del 2026-10-25: la tarea 1 (50 NIT, 24 meses) devolvió 2.797 filas en 30,7 s (1.021 mapeadas, 643
  procesos; descartadas: 1.463 servicios, 308 sin línea, 5 solo por UNSPSC). Costo de Google: 0.

```bash
cd web
npx tsx scripts/secop-procesos-load.ts --dry-run --max-paginas 1   # lee y mapea SIN escribir nada (ni fuentes_estado)
npx tsx scripts/secop-procesos-load.ts --dry-run --max-paginas 1 --nit 900042103,891079999   # solo esas IPS
npx tsx scripts/secop-procesos-load.ts --inicial      # carga inicial de 24 meses (tras aplicar la 0890, con autorización)
npx tsx scripts/secop-procesos-load.ts                # ponerse al día (sigue la pasada a medias o relee 120 días)
npm run secop-procesos-sync:check                     # pruebas sin red de la carga (también dentro de npm run test)
```

El dry-run funciona aunque la migración 0890 no esté aplicada; sin `--dry-run` la carga comprueba primero que la tabla
existe y, si no, para antes de pedir nada a datos.gov.co (en el cron queda en error con el motivo). `--page-size N` (por
defecto 5.000, de 100 a 50.000); `--nit` solo con `--dry-run`.

## Carga inicial real (2026-10-11)

Corrida con `npx tsx scripts/secop-load.ts --inicial --page-size 10000` y después `secop-reclasificar.ts --apply`
(ajuste de reglas: 317 contratos cambiaron de línea y 19 quedaron fuera del alcance y se borraron).

| Paso | Leídas | Guardadas (upserts) | Tiempo |
| --- | --- | --- | --- |
| SECOP II, pasada inicial | 5.040 | 3.627 | 1,5 min |
| SECOP Integrado, pasada inicial | 67.892 | 55.908 | 11,0 min + 2,6 min (la tarea 4 superó el límite de 180 s de una consulta; se reanudó desde el cursor) |
| SECOP II, incremental desde el cron (desde 2026-10-06) | 485 | 9 | 8,2 s |
| SECOP Integrado, incremental desde el cron (desde 2026-09-08) | 4.704 | 56 | 7,3 s |

Estado de `secop_contratos` al terminar (consultado con SELECT el 2026-10-11):

- Filas: SECOP II **3.197**; Integrado **45.424** (SECOP I 42.260, SECOP II 3.164). Sin doble conteo
  (`secop_contratos_unicos`): **45.563** contratos, firmados entre 2005-03-04 y 2026-10-08.
- Por línea (vista sin duplicados; valor en miles de millones): trauma **23.069** ($ 2.575,9), otros
  ortopédicos **3.409** ($ 855,6), neurocirugía **720** ($ 107,0), reemplazo **180** ($ 15,9), deportiva **148**
  ($ 34,7), columna **68** ($ 9,6) y sin línea **17.969** ($ 1.494,9: servicios de especialistas y contratos de
  vigilados que no son ortopedia, p. ej. material dental de un vigilado).
- Entidades objetivo con contratos: **116 de 131**.
- Proveedores vigilados con contratos: **54 de 76** (21.708 contratos en 172 entidades, $ 1,811 billones; en
  SECOP II 45 proveedores, 953 contratos, $ 0,408 billones —igual a la consulta exploratoria previa—; en SECOP I
  50 proveedores, 20.688 contratos, $ 1,398 billones).
- Médicos (personas con especialidad): **797 personas distintas** (por hash), 5.318 contratos, 101 entidades:
  ortopedia 644, neurocirugía 148, deportiva 7, columna 3. Además 1.921 contratos de empresas de especialistas.
- Atípicos: **400** (3 por encima de 50.000 millones).
- Personas con documento en claro: **0** (lo impide además un CHECK de la tabla).

Tras la reclasificación v2 de la revisión (2026-10-11, `secop-reclasificar.ts --apply`: 48.603 filas
actualizadas, 18 borradas por quedar fuera del alcance), la vista sin duplicados tiene **45.547** contratos:
trauma **24.205** ($ 2.586,1), otros ortopédicos **3.408** ($ 855,6), neurocirugía **704** ($ 105,0),
reemplazo **180**, deportiva **148**, columna **68** y sin línea **16.834** ($ 1.484,7). Médicos distintos tras
los incrementales: **799**; atípicos (las dos fuentes): **449**.

**Pendiente (2026-10-12)**: tras aplicar la migración `2026-10-12_0730`, carga inicial de `secop1`
(`npx tsx scripts/secop-load.ts --fuente secop1 --inicial`) y una pasada de `todas` para el histórico de las 10
entidades marcadas `compra_publica`. Las cifras de SECOP I de arriba (valor del proceso) bajan al valor
adjudicado; anotar aquí las nuevas. Dry-run del 2026-10-12 (`--fuente secop1 --dry-run --max-paginas 1`, sin
escribir, costo 0): 131 entidades objetivo (sin la migración aún no entran las 10 manuales), 76 vigilados,
7 tareas; la primera tarea (30 NIT) leyó 2.629 filas → 1.321 guardables (vigilado 167, línea 318,
especialidad 836), 901 fuera de alcance y 407 ilegibles (todas "SECOP I sin contratista": procesos no
adjudicados).

## Refactor de los scripts existentes (sin cambio de comportamiento)

Para que el cron use el mismo código que las cargas manuales:
- `scripts/reps-load-sedes.ts`: columnas, fila y mapeo → `lib/reps-sedes-sync.ts`. Comprobado con
  `--dry-run` sobre el CSV de marzo: 76.821 filas, 22.164 sedes a cargar, igual que antes.
- `scripts/bdua-load.ts`: consulta, agregación, cuadre, upsert y poda por dataset → `lib/bdua-sync.ts`
  (`cargarDatasetBdua`). `--dry-run`: 50.137.787 afiliados, cuadran con el total de cada dataset, 7.469 sin cruce.
- `scripts/minsalud-cifras-load.ts`: todo lo que no es leer el disco → `lib/cifras-sync.ts` (`cargarCifras`).
  `--dry-run` sobre los 14 ZIP: los 14 cuadran; agosto-2026 igual al tablero (52.553.613 / 53.451.430).
- `scripts/_poblacion-db.ts` → `lib/poblacion-db.ts` (el script re-exporta). `upsertBatches` acepta `quiet`.

## Limitaciones (decirlas al mostrar cifras)

- **SECOP I en el Integrado** repite el valor del PROCESO en cada contratista: por eso SECOP I entra por
  `f789-7hwg` (`secop1`) con el valor adjudicado, y el Integrado solo aporta las constancias que ese dataset no
  trae (sobre todo antes de 2018; la marca `estimado` no mira la fecha), repartidas por partes iguales y
  marcadas **estimadas** (`docs/fases/fase5-secop.md`).
  `f789-7hwg` también trae filas duplicadas: el upsert por `id_adjudicacion` las funde.
- En `f789-7hwg` la `ultima_actualizacion` puede ser anterior a la firma del contrato; el incremental de `secop1`
  pide `ultima_actualizacion` **o** `fecha_de_firma` desde la marca para no saltarse contratos firmados tarde.
- El Integrado trae procesos "Convocado" sin contratista: se guardan con su estado; filtrar por estado si se
  quiere solo lo adjudicado.
- La pasada incremental del Integrado solo ve contratos nuevos por fecha de firma (30 días de solape): los
  cambios de estado o valor de contratos viejos de SECOP I no se refrescan. Correr `secop-load.ts --inicial`
  de vez en cuando (p. ej. cada trimestre). SECOP II sí se refresca por `ultima_actualizacion`.
- El código UNSPSC lo elige cada entidad y a veces no corresponde al objeto: por eso solo cuenta cuando el
  texto no dice nada y nunca contra una exclusión.
- La clasificación es por palabras: un contrato general de "material médico quirúrgico" que incluye
  osteosíntesis sin nombrarla no clasifica (salvo por UNSPSC).
