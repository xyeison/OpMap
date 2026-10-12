# Spec: app de visita de OpMap (reemplazo de VMO)  (2026-10-12, v6)

**Estado**: borrador v6 en revisión con el dueño (2026-10-12). Es un **piloto de desarrollo**: el dueño
quiere un producto mínimo viable ya, organizar primero la información dentro de OpMap y, cuando funcione,
entregárselo a sus desarrolladores para pegarlo a Odoo. **Odoo queda fuera de este alcance** (ni terceros ni
ausencias). Modelo confirmado por el dueño: **dos tipos de visita**, **visita médica** (que el médico ordene)
y **visita institucional** (lo que hay que lograr dentro de una cuenta para que lo ordenado termine en
cirugía y factura), con **subtipos**: compras, químico farmacéutico, autorizaciones, programación y otro.
"Cuenta" es la organización que se visita (clínica, EPS, operador logístico, otra). A quién se le factura
depende de cómo trabaja cada EPS con VG (directo a la EPS o a través de la clínica), no de la visita. Nada se
trae de VMO; los médicos se crean siempre con tipo y número de identificación; telefónica por persona.

Documento de referencia de VMO: `docs/referencias/2026-10-11-vmo-2026-documentacion-funcional.md`.

---

## 1. Problema

VG Medical reporta hoy la visita comercial en VMO 2026, hecha para laboratorios: 25 módulos de
configuración, 28 reportes, 153 solicitudes de panel y unas 800 de días sin resolver. La gente "lo ve como
un problema; coger formularios, seleccionar, escribir, les parece fastidioso". Tiene que ser muy sencillo.

Lo que VG necesita distinguir (dueño, 2026-10-12), porque son **objetivos distintos** y hoy se mezclan:

| Qué hace la ejecutiva | Tipo | Subtipo | Hoy |
| --- | --- | --- | --- |
| Visitar al médico para que ordene el producto | **Visita médica** | — | Meta: 6 al día |
| Visitar a la jefe de compras para que nos compre a nosotros | **Visita institucional** | Compras | Meta: 1 institucional al día |
| Visitar al químico farmacéutico para que acepte y codifique el producto y compras pueda comprarlo | **Visita institucional** | Químico farmacéutico | Hay que verlo |
| Visitar a los contactos de la EPS para que acepten y autoricen el producto | **Visita institucional** | Autorizaciones | Hay que verlo |
| Visitar a la jefe que programa para que programen al paciente | **Visita institucional** | Programación | Hay que verlo |
| Lo que vaya apareciendo | **Visita institucional** | Otro (la directora crea subtipos) | |

Dos casos reales del dueño muestran por qué la visita no puede depender de "quién es el cliente":

| | Caso Proteger | Caso Nueva EPS |
| --- | --- | --- |
| VG le factura a | La EPS, directamente | La clínica, que a su vez le factura a la EPS |
| Cliente de VG en ese negocio | La EPS | La clínica |
| Visitas que importan | Médico; en la clínica, sobre todo programación | Médico; en la EPS, autorizaciones; en la clínica, químico farmacéutico, compras y programación |

La misma clínica es cliente en un negocio y no en otro. Por eso la visita registra a quién se vio y para
qué; a quién se factura es un dato de cómo trabaja cada EPS con VG (`modalidad de facturación`, sección 7).

El mismo equipo hace hoy médicos y cuentas. Mañana puede haber una persona que solo haga cuentas (un gerente
de cuentas clave): una persona puede tener metas solo en visita institucional. Y la directora debe poder ver
quién "se la pasa en la gestión del contrato y no en la inducción": la mezcla por subtipo lo muestra.

Las IPS de OpMap nacieron como puntos de interés para repartir zonas; faltan los consultorios y una base de
médicos, cuentas y contactos propia, que en este piloto vive en OpMap.

## 2. Principios

1. **La voz primero.** Sale de la visita, pulsa un botón, dice qué pasó; la app transcribe, entiende y
   muestra una confirmación de tres líneas. Un toque. Formularios solo como respaldo.
2. **App móvil nativa** (iPhone y Android) con GPS y micrófono; guarda en tiempo real con internet.
3. **Dos tipos de visita**: médica e institucional; la institucional siempre lleva **subtipo**. La app
   sugiere el subtipo por el cargo de la persona; la directora administra los subtipos.
4. **Metas por tipo (y, si se quiere, por subtipo), por zona y por persona**, en visitas por día o por
   semana; la cuota del periodo la calcula el sistema con días hábiles menos ausencias aprobadas.
5. **Presencial solo en el sitio y el mismo día**; lejos del lugar, telefónica si la persona la tiene
   habilitada, evaluada aparte.
6. **La información se organiza aquí**: médicos, cuentas, contactos y direcciones son tablas de OpMap,
   editables y creadas a mano desde la app o la web, sin bandeja de aprobación. Odoo, después.

Restricciones del repo: cero Google Maps (GPS del teléfono, Haversine), estética del mapa intocable,
terminología visible "Ejecutivo Comercial", "Zona", "IPS", "Médico", "Cuenta", "Contacto" (nunca "KAM",
"representante" ni "panel").

## 3. Vocabulario (confirmado por el dueño)

- **Médico**: persona que ordena. Tiene especialidad, identificación y una o varias **direcciones**
  (consultorio, clínicas donde opera).
- **Cuenta**: cualquier organización donde se trabaja la venta: clínica u hospital (IPS, con su sede REPS),
  EPS, operador logístico, otra. "Institución" y "cliente" no son entidades: "cliente" depende de cada
  negocio y "institucional" es el tipo de visita.
- **Contacto**: persona dentro de una cuenta, con **cargo** (compras, gerencia, químico farmacéutico,
  almacén, autorizaciones, programación de cirugía, quirófano, cartera…).
- **Visita**: lo que se reporta. **Médica** (a un médico) o **institucional** (a una cuenta, con subtipo).
- **Modalidad de facturación** (de cada EPS): "directa", VG le factura a la EPS; o "a través de la
  clínica", VG le factura a la clínica y la clínica a la EPS.

## 4. Resultado esperado por rol

**Ejecutiva Comercial (app móvil)**
- "Hoy": cuántas actividades lleva por tipo frente a su meta del día, compromisos vencidos y un botón grande
  **"Reportar"**.
- Habla: "Estuve con el doctor Pérez en su consultorio, le mostré PerOssal y reemplazo, quedó de mandarme un
  caso la otra semana; también pasé por compras con la jefe Marta, van a cotizar; y con el químico para que
  codifique el tornillo canulado". La app transcribe, reconoce a Pérez, a Marta y a la cuenta, y muestra tres
  tarjetas:
  > **Visita médica** · Dr. Pérez (ortopedista) · hoy 10:42 · Consultorio Pérez · PerOssal, Reemplazo ·
  > Conclusión: enviará un caso · Compromiso: la otra semana · Próxima reunión: sin programar → ¿programar?
  > **Visita institucional · Compras** · Clínica X · Marta (compras) · van a cotizar.
  > **Visita institucional · Químico farmacéutico** · Clínica X · tornillo canulado por codificar.
  Confirma con un toque, corrige hablando o cambia el subtipo si la app se equivocó.
- Si el médico o el contacto no existen, la app lo dice y ofrece crearlo ahí mismo, sin aprobación. Un
  médico se crea **siempre con tipo y número de identificación** (cédula, cédula de extranjería, pasaporte),
  nombre, especialidad y ciudad: si el documento ya existe, la app muestra al médico existente y no crea
  otro. Esto se digita, nunca se dicta. Un contacto se crea con cuenta, nombre y cargo (documento opcional).
- Presencial solo a menos del radio de una dirección conocida; lejos, telefónica si la tiene habilitada o
  "guardar este punto como dirección nueva" cuando es un consultorio.
- Solicita ausencias desde la app; ve su meta ajustada y "Mis números".

**Directora comercial (web)**: subtipos institucionales y cuáles cuentan para la meta; modalidad de
facturación de cada EPS; metas por zona y por persona; perfiles
(a quién se le mide qué); ausencias en bloque; avisos; corrección con rastro. **Recursos humanos**:
ausencias. **Líder de línea**: su línea. **Data manager**: revisión de médicos, cuentas y contactos
creados, duplicados, equivalencias de VMO.

## 5. Tipos y subtipos de visita

Dos tipos fijos. La visita institucional siempre lleva un subtipo; los subtipos los administra la directora
(añadir, renombrar, apagar, decidir si cuentan para la meta institucional). Arrancan estos cinco:

| Tipo | Subtipo | A quién | Para qué | Cargos que lo sugieren | Cuenta para la meta institucional al arrancar |
| --- | --- | --- | --- | --- | --- |
| Visita médica | — | Médico | Que ordene el producto | — | (meta propia: 6 / día) |
| Visita institucional | Compras | Jefe de compras de la clínica o del operador | Que nos compren: precio, condiciones, contrato | compras, gerencia, dirección médica | sí |
| Visita institucional | Químico farmacéutico | Químico, farmacia, almacén | Que acepten y codifiquen el producto | químico farmacéutico, almacén, farmacia | sí |
| Visita institucional | Autorizaciones | Contactos de la EPS | Que la EPS acepte y autorice el producto o el procedimiento | autorizaciones, auditoría médica | sí |
| Visita institucional | Programación | Jefe que programa, quirófano | Que programen al paciente | programación de cirugía, quirófano, esterilización, instrumentación | sí |
| Visita institucional | Otro | Cualquiera | Lo que aparezca; si se repite, la directora lo vuelve subtipo | otro | sí |

Recomendación para arrancar: **todos los subtipos cuentan** para la meta institucional (hoy 1 al día) y el
tablero muestra la mezcla por subtipo; con datos del piloto la directora decide si limita alguno (por
ejemplo, que programación no cuente) o le pone meta propia a un subtipo.

**Metas y perfiles**: la meta se fija por tipo (médica, institucional) y, opcionalmente, por subtipo; por
zona (valor por defecto) y por persona (excepción); en visitas por día o por semana. Una persona con meta
solo en visita institucional es, en la práctica, un gerente de cuentas clave; no hace falta un rol aparte.

**Modalidad de facturación por EPS**: cada cuenta de tipo EPS lleva "directa" o "a través de la clínica".
No cambia cómo se reporta; sirve para leer los tableros (en clínicas con pacientes de una EPS de facturación
directa no se espera visita a compras, sí a programación) y, después del MVP, para que el sistema sugiera qué
visitas faltan en cada cuenta.

## 6. Alcance del MVP (lista cerrada)

1. **App móvil** (Expo / React Native, TypeScript, misma API de OpMap): sesión de OpMap, GPS, micrófono,
   tiempo real. Piloto por TestFlight y pruebas internas de Play.
2. **Reporte por voz**: grabación → transcripción en el servidor (API de OpenAI, `gpt-4o-transcribe` o
   `whisper-1`, español con vocabulario de VG) → la API de Claude propone uno o varios registros contra el
   esquema (tipo y subtipo, médico o cuenta y contacto cruzados contra las tablas de OpMap, líneas,
   efectiva o no, conclusión, compromisos, próxima reunión) → tarjetas de confirmación → un toque. Nada se
   guarda sin confirmar. Audio 12 meses en bucket privado; transcripción con el registro.
3. **Reporte por toques** (respaldo) con los mismos campos.
4. **Médicos, cuentas, contactos y direcciones en OpMap**, creados a mano por el equipo (app y web), bien
   organizados: las 783 IPS entran como cuentas automáticamente (vinculadas a `hospitals`); los médicos
   se crean uno a uno con tipo y número de identificación (único en el sistema), nombre, especialidad,
   ciudad y, si se sabe, dirección; los contactos con cuenta, nombre y cargo. **Nada se importa de VMO.**
   No hay carga masiva por archivo en el MVP (decisión del dueño: se crean a mano, bien organizados).
   Asignación de médicos y cuentas a cada ejecutiva desde el territorio o a mano.
5. **Direcciones con GPS**: consultorio nuevo o clínica donde atiende, guardadas desde la app.
6. **Visita médica e institucional con subtipos** configurables (sección 5), sugerencia del subtipo por
   cargo y **modalidad de facturación** en las cuentas EPS.
7. **Radio con bloqueo** (500 m, único) y **telefónica por persona**.
8. **Metas** por tipo, zona y persona, día o semana; cuota del periodo calculada.
9. **Ausencias**: solicitud desde la app; bandeja web con aprobación en bloque (directora y recursos
   humanos).
10. **Hoy, Mis números, Equipo, Metas, Subtipos, ficha de IPS** (pestaña "Visitas" junto a compras SECOP y
    giros ADRES), **filtros del mapa de calor** (sin capas nuevas).
11. **Convivencia con VMO**: importador corregido (no borra visitas de la app), equivalencias, marca de
    sistema por ejecutiva. Ningún médico ni cliente de VMO se trae.

### Después del MVP
Integración con Odoo (la harán los desarrolladores del dueño sobre estas tablas), modo sin señal, "Mi
semana", vínculo de visitas institucionales con casos de paciente, ventas por médico, sugerencia de visitas
faltantes por cuenta según la modalidad de facturación, priorización automática, lectura de la confirmación
en voz alta, visitas en el mapa (requiere autorización: estética).

### Qué se conserva de VMO y qué se descarta

| Se conserva | Cómo queda |
| --- | --- |
| Visitas a médicos y a compras con GPS; presencial o telefónica; efectiva o no con motivo | Visita médica e institucional con subtipos; por voz o toques |
| Metas (6 médicos + 1 institución al día) | Metas por tipo y subtipo, zona y persona; cuota calculada con días hábiles y ausencias |
| Solicitud y aprobación de ausencias | Con aprobación masiva, directora o recursos humanos |
| Médicos con varias direcciones; clientes con contactos | Médicos, cuentas, contactos y direcciones en OpMap |
| Reporte el mismo día | Mismo día, en el sitio, en tiempo real |
| Supervisores ven el equipo; exportar | Dirección todo; líder su línea; CSV |

| Se descarta | Por qué |
| --- | --- |
| Frecuencia 10 por médico, categorías A/B/C, "cumplimiento de frecuencia" | Da 3,5 %; las metas son por tipo y por persona |
| Bandeja de altas y bajas con aprobación | 153 pendientes muestran que no sirve; se crea sin aprobación, con aviso de duplicados y revisión de data manager |
| Material, muestras, inventario, parrilla, ayudas visuales | Vacíos y ajenos a implantes |
| Agenda en medias horas, ruteros, "visita rápida" aparte | Cabe en "Hoy" y, después, "Mi semana" |
| Farmacias, pacientes, farmacovigilancia, cartera de crédito, transferencia de valor, cumpleaños, e-learning | No son el negocio |
| 28 reportes, 25 módulos, formularios de pestañas | 6 KPIs, metas, subtipos y una tarjeta de confirmación |

## 7. Modelo de datos

### IPS, cuentas, médicos y consultorios
- `hospitals` **sigue siendo la tabla de IPS** (sedes REPS, puntos de interés de las zonas): no se le meten
  consultorios ni cuentas que no sean IPS. Cada IPS activa tiene su **cuenta** (`cuentas.hospital_id`).
- Las **cuentas** que no son IPS (operadores logísticos, EPS, otras) viven solo en `cuentas`.
- Los **consultorios son direcciones del médico** (`direcciones` con `medico_id`), con GPS. Si el
  consultorio es además una sede del REPS, la dirección puede apuntar a `reps_code`, sin obligación.
- Razón: las IPS mueven asignación, territorio y gasto en Google; las direcciones de médicos son muchas,
  cambian y se capturan con GPS.

### Tablas nuevas (RLS sin políticas; solo `service_role` desde `lib/supabase-admin.ts`)

| Tabla | Columnas clave | Para qué |
| --- | --- | --- |
| `medicos` | `id`, `tipo_documento` ('CC' \| 'CE' \| 'PA' \| 'PEP' \| 'otro') NOT NULL, `numero_documento` NOT NULL, **UNIQUE (tipo_documento, numero_documento)**, `nombre`, `especialidades` text[] (ortopedia, neurocirugía, columna, deportiva, maxilofacial, fisiatría, cirugía general, otra), `ciudad`, `municipality_id`, `executive_id` (asignada), `telefono`, `email`, `origen` ('app' \| 'web'), `created_by`, `activo`, `notas` | Base de médicos propia; la identificación es la llave contra duplicados (regla del dueño); aviso adicional por nombre normalizado + ciudad |
| `cuentas` | `id`, `nombre`, `tipo` ('ips' \| 'eps' \| 'operador_logistico' \| 'otra'), `nit` NULL (UNIQUE si existe), `hospital_id` NULL UNIQUE, `modalidad_facturacion` NULL ('directa' \| 'via_clinica', solo EPS), `municipality_id`, `executive_id` NULL, `origen`, `activo` | Organizaciones; las IPS se crean solas desde `hospitals`; el NIT evita cuentas repetidas |
| `contactos` | `id`, `cuenta_id`, `nombre`, `cargo_texto`, `rol` ('compras' \| 'gerencia' \| 'direccion_medica' \| 'quimico_farmaceutico' \| 'almacen_farmacia' \| 'programacion_cirugia' \| 'quirofano' \| 'esterilizacion' \| 'instrumentacion' \| 'cartera_facturacion' \| 'autorizaciones' \| 'otro'), `tipo_documento` NULL, `numero_documento` NULL (UNIQUE si existe), `telefono`, `email`, `origen`, `activo` | Personas de la cuenta; el cargo sugiere el subtipo; aviso de duplicado por nombre + cuenta |
| `direcciones` | `id`, `medico_id` NULL, `cuenta_id` NULL (una de las dos), `etiqueta` ('consultorio' \| 'clinica' \| 'sede' \| 'otra'), `hospital_id` NULL, `reps_code` NULL, `direccion`, `ciudad`, `lat`, `lng`, `origen` ('manual' \| 'gps_app' \| 'hospitals'), `created_by` | Dónde se visita; las de `gps_app` las crea la ejecutiva |
| `subtipos_institucionales` | `id`, `codigo`, `nombre`, `para_que` (texto corto), `roles_sugeridos` text[], `cuenta_para_meta` bool, `activo`, `orden` | Los cinco de la sección 5; editable por la directora |
| `metas` | `scope` ('zona' \| 'ejecutiva'), `kam_id` NULL, `executive_id` NULL, `tipo` ('medica' \| 'institucional'), `subtipo_id` NULL (meta propia de un subtipo), `periodo` ('dia' \| 'semana'), `cantidad` numeric, `vigente_desde`, `set_by` | La de persona manda sobre la de zona; sin fila = sin meta (solo seguimiento) |
| `perfiles_visita` | `executive_id` PK, `telefonica_habilitada` bool, `radio_m` NULL | Telefónica por persona; radio distinto solo con autorización escrita |
| `ausencias` | `executive_id`, `fecha`, `fraccion` (1 \| 0,5), `motivo` ('vacaciones' \| 'incapacidad' \| 'cita_medica' \| 'capacitacion' \| 'congreso' \| 'administrativo' \| 'otro'), `estado` ('pendiente' \| 'aprobada' \| 'rechazada'), `solicitada_por`, `aprobada_por`, `aprobada_at`, `comentario` | Solicitud y aprobación en bloque; descuenta de la cuota |
| `company_calendar_exceptions` | `date` PK, `kind` ('non_working' \| 'working'), `label` | Días de empresa; festivos nacionales en `holidays.ts` |
| `vmo_representantes` | `vmo_name` PK, `executive_id`, `kam_id`, vigencia | Importador e histórico |

**`visits` (existente) — columnas nuevas**: `source` ('vmo_import' | 'app'), `executive_id`, `client_id`
UNIQUE, `tipo` ('medica' | 'institucional'), `subtipo_id` NULL (obligatorio si institucional), `subtipo_codigo`
(copia, para que el histórico no cambie si se renombra), `medico_id` NULL, `cuenta_id` NULL, `contacto_id`
NULL, `direccion_id` NULL, `place_name`,
`checked_in_at`, `distance_m`, `gps_accuracy_m`, `failure_reason`, `retry_date`, `conclusion`,
`compromisos`, `next_step_date`, `transcript`, `audio_path`, `input_mode` ('voz' | 'toques' | 'importada'),
`out_of_territory`, `created_by`, `updated_by`, `updated_at`, `deleted_at`. `hospital_id` sigue siendo la IPS
donde ocurrió si aplica. `visit_type` y `contact_type` conservan sus valores ('Visita efectiva' | 'Visita no
efectiva'; 'Visita presencial' | 'Visita virtual' = telefónica). `visit_lines` (`visit_id`, `line_id`).

CHECKs: médica exige `medico_id`; institucional exige `cuenta_id` y `subtipo_id`; presencial exige `lat/lng`,
una dirección o IPS y `distance_m <= radio` (la API rechaza si no). Columna nueva en `executives`:
`visits_source` ('vmo' | 'app'). Rol nuevo de usuario: `hr`.

Migración `2026-10-XX_0800_visitas_app.sql` + rollback `9940` (Fase 1), aplicadas con autorización. Incluye la
creación de una cuenta por IPS activa, la semilla de subtipos y la marca `source='vmo_import'` del histórico
de VMO (sin tipo ni subtipo: el histórico solo alimenta el mapa de calor).

### Voz: del audio al registro
1. La app graba (m4a, hasta 3 minutos) y sube audio, GPS, hora y `client_id`.
2. El servidor transcribe (OpenAI `gpt-4o-transcribe`, o `whisper-1`; español; prompt con vocabulario:
   PerOssal, osteosíntesis, nombres de líneas y de subtipos).
3. La API de Claude (`claude-sonnet-5-5`) recibe la transcripción y el contexto (médicos y cuentas a menos
   de 1 km, asignados a la ejecutiva, contactos de esas cuentas, subtipos activos) y devuelve salida
   estructurada: lista de visitas con tipo y subtipo, candidato (nombre dicho + mejor cruce con
   puntaje), contacto, líneas, efectiva o no y motivo, conclusión, compromisos, próxima reunión. Lo que no
   esté en las listas se descarta. Si no cruza, propone "no lo encuentro: ¿lo creo?".
4. Una tarjeta por registro; un toque; corrección hablando. Ambigüedad real → una sola pregunta.
5. Guardado en tiempo real; audio al bucket; si falla la transcripción, cola y respaldo por toques.

## 8. KPIs (6)

| # | KPI | Fórmula | Datos |
| --- | --- | --- | --- |
| 1 | **Cumplimiento de metas** (médica, institucional y subtipos con meta propia) | efectivas que cuentan ÷ cuota del periodo (meta × días hábiles − ausencias aprobadas); ritmo = hábiles transcurridos ÷ hábiles | `visits`, `metas`, `subtipos_institucionales.cuenta_para_meta`, `ausencias`, `holidays.ts` |
| 2 | **Cobertura** | médicos asignados con ≥ 1 visita médica efectiva en el trimestre ÷ asignados; cuentas IPS del Anexo A con ≥ 1 visita institucional efectiva en el mes ÷ Anexo A | `medicos.executive_id`, `territory_snapshots` |
| 3 | **Mezcla** | visitas médicas frente a institucionales, y las institucionales por subtipo (compras, químico, autorizaciones, programación, otro), por persona y mes, con alerta configurable | `visits.tipo`, `visits.subtipo_codigo` |
| 4 | **Sin contacto reciente** | médicos asignados sin visita en 60 días; cuentas del Anexo A sin visita institucional en 90 días, ordenadas por camas, quirófanos y compras SECOP | `visits`, `hospitals`, SECOP |
| 5 | **Calidad del reporte** | % telefónicas, % no efectivas, % fuera de territorio, % por toques frente a voz, % con dirección o médico nuevos | `visits` |
| 6 | **Actividad → resultado** | cuentas IPS visitadas frente a compras SECOP y giros ADRES ("visitadas sin compra", "compran sin visita") | `visits`, SECOP, ADRES |

## 9. Reglas de negocio no deducibles del código

- Una visita es médica o institucional. La institucional siempre lleva subtipo; solo los subtipos con
  `cuenta_para_meta` suman a la meta institucional; todos se miden en la mezcla.
- La app sugiere el subtipo por el cargo del contacto (compras → Compras; químico farmacéutico → Químico
  farmacéutico; autorizaciones de la EPS → Autorizaciones; programación → Programación); la ejecutiva puede
  cambiarlo.
- Una misma llegada a una clínica puede dejar varias visitas (médico, compras, químico, programación): son
  objetivos distintos y se miden aparte.
- La modalidad de facturación de la EPS no cambia el reporte; solo se usa para leer los tableros.
- Solo la actividad efectiva suma a metas y cobertura; la no efectiva se guarda con motivo.
- Presencial solo en el sitio: la API rechaza si `distance_m` supera el radio (500 m, único; excepción por
  persona solo con autorización escrita). Sin dirección conocida, la ejecutiva guarda el punto como
  dirección nueva antes de reportar, o reporta telefónica si la tiene habilitada.
- Mismo día y tiempo real: fecha y hora del teléfono al confirmar; no se reportan días anteriores desde la
  app; dirección corrige con rastro.
- Médicos, cuentas y contactos se crean sin aprobación (app o web). **Un médico no existe sin tipo y
  número de identificación**; la base rechaza un segundo médico con el mismo documento y la app muestra el
  existente. El documento se digita (nunca se dicta ni se extrae del audio), se guarda solo para quien tenga
  `contacts:manage` y no sale en listas, exportaciones ni tarjetas. Data manager revisa "creados esta
  semana" y fusiona duplicados por nombre.
- Metas: por tipo, zona y persona; periodo día o semana; sin fila no hay meta (solo seguimiento); las
  vacantes no se miden. Días hábiles = lunes a viernes menos festivos de Colombia (código) menos
  `company_calendar_exceptions`.
- Ausencias: la ejecutiva solicita; directora o recursos humanos aprueban o rechazan en bloque; la aprobada
  descuenta de inmediato.
- Quién edita qué: la ejecutiva sus registros del mismo día; dirección cualquiera con rastro; líder solo su
  línea; las ejecutivas no se ven entre sí.
- Privacidad: la identificación del médico se guarda porque es la llave contra duplicados y la que usará la
  integración con Odoo; se protege (solo `service_role`, visible solo con `contacts:manage`, fuera de
  exportaciones y de la voz). Nada de pacientes. Audio y transcripción internos. Pendiente del dueño: aviso
  de tratamiento de datos para médicos y contactos (Ley 1581), que hoy VMO tenía vacío.

## 10. Migración y convivencia con VMO

- Fase 0 verificada: `web/next.config.js` bloquea GPS y micrófono para la web; el importador de VMO borra
  todas las visitas del mes sin filtrar por fuente.
- Carga inicial de médicos, cuentas y contactos: **a mano por el equipo** (decisión del dueño: nada de VMO).
  Las IPS ya existen como cuentas. Antes del piloto, las dos ejecutivas crean sus médicos y contactos con
  identificación; es parte del trabajo de organizar la información.
- Histórico de VMO con `source='vmo_import'`; `executive_id` por `vmo_representantes`.
- Piloto: 2 ejecutivas con la app móvil un mes; corte con última importación.

## 11. Criterios de aceptación

- [ ] Dado un contacto con cargo químico farmacéutico, cuando se dicta o se elige, entonces la app propone
      "Visita institucional · Químico farmacéutico", suma a la meta institucional y aparece en la mezcla con
      ese subtipo.
- [ ] Dado "Jefe de Compras" de una cuenta IPS del Anexo A, cuando se reporta efectiva, entonces suma 1 a la
      meta institucional, al subtipo Compras y a la cobertura del Anexo A.
- [ ] Dado la directora marca que "Programación" no cuenta para la meta institucional, entonces esas visitas
      siguen en la mezcla y dejan de sumar a la cuota; dado que le pone meta propia de 2 por semana a una
      persona, entonces esa meta aparece en su "Hoy".
- [ ] Dado una persona con metas solo en visita institucional, entonces "Hoy" y "Mis números" no le muestran
      meta de médicos.
- [ ] Dado una cuenta EPS con modalidad "directa", entonces el tablero lo muestra junto a sus visitas y la
      modalidad no cambia ningún cálculo de metas.
- [ ] Dado una presencial a 800 m del lugar elegido, entonces la API la rechaza y la app ofrece telefónica (si
      está habilitada) o dirección nueva.
- [ ] Dado meta de zona 6 visitas médicas y 1 institucional por día, excepción de 4 y 1 para una persona, 20
      días hábiles y 2 ausencias aprobadas, entonces su cuota del mes es 72 y 18 y el ritmo al día hábil 10 es
      50 %.
- [ ] Dado una meta semanal de 25, entonces la cuota del mes se calcula por semanas hábiles proporcionales.
- [ ] Dado la transcripción del ejemplo de la sección 4, entonces la función pura devuelve tres visitas (médica;
      institucional Compras; institucional Químico farmacéutico) y nada se guarda sin confirmar; dado un
      médico que no cruza, propone crearlo y no lo crea solo.
- [ ] Dado "guardar este punto como dirección del médico", entonces existe `direcciones` con `origen='gps_app'`
      y la próxima visita lo ofrece como lugar.
- [ ] Dado un médico con cédula 12345678 ya creado, cuando otra ejecutiva intenta crear uno con la misma
      cédula, entonces la base lo rechaza y la app le muestra el existente para usarlo.
- [ ] Dado un intento de crear un médico sin tipo o número de identificación, entonces la API devuelve 400.
- [ ] Dado un dictado que menciona a un médico, entonces nunca produce ni muestra un número de documento.
- [ ] Dado el mismo `client_id` dos veces, entonces hay una sola fila.
- [ ] Dado una visita de la app en octubre y una importación de VMO de octubre, entonces la visita de la app
      sigue existiendo.
- [ ] Dado un usuario `hr` o la directora, entonces ve y aprueba ausencias en bloque; un líder de línea solo
      ve las de su línea, sin aprobar; `viewer` recibe 403.

## 12. Fuera de alcance, impacto, plan y verificación

**Fuera de alcance**: Odoo (terceros, ausencias, casos de paciente), modo sin señal, "Mi semana", ventas por
médico, priorización automática, módulos descartados de VMO, estética del mapa, Google.

**Impacto**: migración 0800 + rollback 9940 (Fase 1); Google 0 USD; voz ≈ 0,01 USD por visita (OpenAI) +
0,005 USD por dictado (Claude): unos 5 USD al mes en el piloto y 30 a 45 USD al mes con las 20 personas; `OPENAI_API_KEY` y `ANTHROPIC_API_KEY` en Vercel
(las crea el dueño); bucket privado `visit-audio`; app Expo en `mobile/` (comparte reglas puras con
`web/lib`), compilación con EAS, cuentas Apple Developer (99 USD al año) y Google Play (25 USD) que crea el
dueño; estética del mapa sin cambios; permisos nuevos `visits:report`, `visits:team`, `visits:targets`,
`absences:approve`, `contacts:manage`; rol `hr`.

| Fase | Entrega | Evidencia |
| --- | --- | --- |
| **F0 Decisiones y prerrequisitos** | Respuestas del dueño en `docs/decisiones/`; `Permissions-Policy`; importador por fuente; cuentas enlazadas; cuentas de Apple, Google, OpenAI y Anthropic | `npm run check`; prueba del importador |
| **F1 Información** | Migración 0800 + rollback; tablas de médicos, cuentas (con modalidad de facturación), contactos, direcciones, subtipos; cuenta por IPS; creación con identificación única; pantallas web de médicos, cuentas y contactos | `contactos-check.ts` puro |
| **F2 Reglas y metas** | `holidays.ts`; `visits-rules.ts` (subtipo por cargo, cuota por periodo, Haversine y bloqueo, esquema del dictado); metas, perfiles, ausencias; API y permisos | `visits-check.ts` puro; pruebas de alcance |
| **F3 Voz** | `/api/me/voz/transcribir` y `/voz/proponer`; esquema y validación; bucket | dictado real de prueba |
| **F4 App móvil (piloto)** | Expo: sesión, Hoy, Reportar por voz con tarjetas, respaldo por toques, crear médico o contacto, dirección nueva, ausencias; TestFlight y Play interno; migración aplicada; 2 ejecutivas | capturas en iPhone y Android con un dictado real |
| **F5 Web de dirección** | Mis números, Equipo, Metas, Subtipos, bandeja de ausencias, ficha de IPS, filtros del mapa de calor | capturas; pruebas de KPIs |
| **F6 Corte de VMO** | Última importación; todas en 'app'; nota de decisión | conteo por fuente |

**Verificación final**: `npm run check` en cada PR (y la suite de `mobile/`); pruebas puras de subtipo por
cargo, cuota por periodo, festivos 2026-2027, bloqueo por radio, esquema del dictado, duplicados; dictado real
en el piloto; convivencia con el importador; rollback de 0800 probado; nada importa `google-distance.ts`.

## 13. Decisiones pendientes del dueño

Ya decididas el 2026-10-12: Odoo fuera del piloto; **visita médica y visita institucional con subtipos**
(compras, químico farmacéutico, autorizaciones, programación, otro); la facturación (directa a la EPS o a
través de la clínica) es un dato de la EPS, no de la visita; metas por tipo, zona y persona calculadas por el
sistema, con meta opcional por subtipo; bloqueo por distancia; mismo día y tiempo real; app móvil; voz con
Whisper o similar y confirmación breve; consultorios como direcciones; ausencias en OpMap con aprobación
masiva (directora y recursos humanos); **"Cuenta"** como nombre; **nada se trae de VMO**; **médicos con tipo y
número de identificación**; telefónica por persona.

Las preguntas que siguen abiertas, con su recomendación, están en la sección 14.

## 14. Preguntas abiertas (2026-10-12, revisión independiente de la v6)

Tres revisores independientes (campo, dirección y metas, técnica y legal) leyeron la v6 contra lo que dijo
el dueño; 36 hallazgos depurados en estas preguntas. Las demás ya estaban resueltas o son detalle técnico.

**Decidir antes de construir**

| # | Pregunta | Recomendación |
| --- | --- | --- |
| 1 | Sin señal (sótano, quirófano, municipio): ¿la app guarda la visita con el punto y la hora tomados en el sitio y la envía sola cuando vuelve la señal, el mismo día? | **Sí**, versión mínima en el MVP: la distancia se mide con el punto tomado en el sitio; vale si llega antes de medianoche; queda marcada "enviada después". |
| 2 | Dirección nueva creada por la ejecutiva (consultorio): ¿la visita ahí suma de inmediato o cuando data manager confirma el punto? | **Cuando data manager la confirma** en su revisión semanal; y vale como lugar cualquier IPS o cuenta ubicada a menos de 500 m, para que crear direcciones sea la excepción. Sin esto, el bloqueo se esquiva desde la casa. |
| 3 | Si el médico no da la cédula en el momento o no autoriza sus datos, ¿la visita queda "en espera" y suma cuando se complete, o no se puede reportar? | **En espera 7 días**: la visita se guarda con nombre, especialidad y lugar; suma cuando se completan documento y autorización (el médico acepta en pantalla o por enlace). El médico sigue sin existir sin documento. |
| 4 | ¿Cada médico tiene una ejecutiva responsable **por línea** (no una sola), y si otra ejecutiva lo visita, le suma a quien lo visita? | **Sí**: responsable por médico y línea, tomada de la cobertura que OpMap ya calcula; la directora resuelve choques; la visita de otra suma a su meta, no a la cobertura de la responsable. |
| 5 | Al arrancar, ¿qué subtipos suman a la meta institucional? | **Cambio la recomendación anterior: solo Compras** (y Autorizaciones si la directora la considera apertura de venta); químico, programación y otro se ven en la mezcla sin sumar. Si todo suma, quien solo programa sale al 100 % y una parada en una clínica cumple tres días. |
| 6 | Día o medio día sin visitas no previsto (acompañar una cirugía, incapacidad, día cívico de su ciudad): ¿se puede registrar el mismo día o hasta 5 días después para descontarlo de la cuota? | **Sí**, con aprobación en bloque de la directora; mientras tanto se ve "por aprobar" y no en rojo; los días no hábiles se pueden marcar por ciudad. |
| 7 | ¿Cada médico suma como máximo **una visita al día**, y las telefónicas suman solo hasta un tope por persona? | **Sí**: una por médico al día (si van dos personas, una visita "acompañada por"); telefónicas con tope (sugerido 1 de las 6) y solo llamada o videollamada, nunca chat ni audio de WhatsApp. |
| 8 | ¿La cuenta es la **empresa (un NIT)** con sus sedes como direcciones, en lugar de una cuenta por sede? | **Sí**: compras es de la empresa y vale en cualquier sede; químico y programación son de su sede; una visita a compras cubre todas las sedes de esa empresa en el Anexo A. |
| 9 | ¿El audio se borra a los **30 días** de confirmada la visita (no a los 12 meses) y se enseña a no dictar datos de pacientes? | **Sí**; antes del piloto legal revisa los términos de OpenAI y Anthropic (cuentas a nombre de VG, sin uso para entrenar) y cada ejecutiva firma una autorización corta para su voz y su GPS. |

**Decidir durante el piloto**

| # | Pregunta | Recomendación |
| --- | --- | --- |
| 10 | ¿La cuota se calcula solo de lunes a viernes, y quien entra, sale o cambia de zona a mitad de mes se mide por sus días activos? | **Sí**; el sábado no genera cuota pero sus visitas suman; el primer mes de alguien nuevo, al 50 %. |
| 11 | Con 1 institucional al día (unas 20 al mes), ¿la cobertura de cuentas se mide sobre 15 a 20 **cuentas objetivo** por ejecutiva y por trimestre, no sobre todo el Anexo A cada mes? | **Sí**: la directora marca las cuentas objetivo (por defecto las primeras del Anexo A por camas, quirófanos y compras SECOP). |
| 12 | Antes de apagar VMO, ¿se exporta y archiva fuera de OpMap lo que vive solo allá (médicos, comentarios, solicitudes de días, soportes de Hábeas Data, transferencias de valor)? | **Sí**, archivo de VG con acceso restringido, sin cargarlo en OpMap; confirmar con legal si el reporte de transferencias de valor a médicos (Resolución 2881 de 2018) sale hoy de VMO. |

Siguen abiertas de la v6: **paso de VMO a OpMap** (A: piloto con dos ejecutivas un mes; B: todas el mismo
día; recomendación A) y **aviso de tratamiento de datos** de legal antes del piloto (recomendación sí;
ampliado por las preguntas 3 y 9).

Correcciones menores incorporadas: el costo de la voz para las 20 personas es de unos 30 a 45 USD al mes (no
"menos de 10", que vale para las 2 del piloto); las ausencias las aprueban la directora y recursos humanos,
no la líder de línea.
