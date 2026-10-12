# Spec: app de visita de OpMap (reemplazo de VMO)  (2026-10-12, v4)

**Estado**: borrador v4 en revisión con el dueño (2026-10-12). Es un **piloto de desarrollo**: el dueño
quiere un producto mínimo viable ya, organizar primero la información dentro de OpMap y, cuando funcione,
entregárselo a sus desarrolladores para pegarlo a Odoo. **Odoo queda fuera de este alcance** (ni terceros ni
ausencias). Cambios frente a v3: terceros propios de OpMap, **tipos de actividad configurables por
objetivo** (inducción al médico, inducción a la compra, gestiones), metas por tipo de actividad por zona y
por persona (una persona puede tener solo visitas a cuentas, como un gerente de cuentas clave), y "cuenta"
como nombre de la organización que se visita.

Documento de referencia de VMO: `docs/referencias/2026-10-11-vmo-2026-documentacion-funcional.md`.

---

## 1. Problema

VG Medical reporta hoy la visita comercial en VMO 2026, hecha para laboratorios: 25 módulos de
configuración, 28 reportes, 153 solicitudes de panel y unas 800 de días sin resolver. La gente "lo ve como
un problema; coger formularios, seleccionar, escribir, les parece fastidioso". Tiene que ser muy sencillo.

Lo que VG necesita distinguir (dueño, 2026-10-12), porque son **objetivos distintos** y hoy se mezclan:

| Qué hace la ejecutiva | Objetivo | A quién | Hoy |
| --- | --- | --- | --- |
| Visitar al médico para que ordene el producto | **Inducción al médico** (generar demanda) | Médico, en consultorio o clínica | Meta: 6 al día |
| Visitar a la jefe de compras para que nos compre a nosotros | **Inducción a la compra** | Compras de una clínica, un operador logístico o una EPS | Meta: 1 al día |
| Ir donde el químico farmacéutico o almacén para que codifiquen el producto y compras pueda comprarlo | **Gestión** (codificación) | Cuenta | Sin meta; hay que verlo |
| Ir donde la jefe que programa para que programen al paciente | **Gestión** (programación de cirugía) | Cuenta | Sin meta; hay que verlo |
| Y los que vayan apareciendo | Configurable | | |

El mismo equipo hace hoy las dos cosas (visita médicos y se sienta con compras). Mañana puede haber una
persona que solo haga cuentas (un gerente de cuentas clave): la configuración debe permitir que una persona
tenga metas solo en un tipo. Y la directora debe poder decidir si una gestión lleva meta o solo seguimiento:
"este comercial se la pasa en la gestión del contrato y no en la inducción".

Las IPS de OpMap nacieron como puntos de interés para repartir zonas; faltan los consultorios y una base de
médicos, cuentas y contactos propia, que en este piloto vive en OpMap.

## 2. Principios

1. **La voz primero.** Sale de la visita, pulsa un botón, dice qué pasó; la app transcribe, entiende y
   muestra una confirmación de tres líneas. Un toque. Formularios solo como respaldo.
2. **App móvil nativa** (iPhone y Android) con GPS y micrófono; guarda en tiempo real con internet.
3. **Cada registro tiene un tipo de actividad con un objetivo**: inducción al médico, inducción a la compra
   o gestión. Los tipos los configura la directora; la app sugiere el tipo por a quién se vio.
4. **Metas por tipo de actividad, por zona y por persona**, en visitas por día o por semana; la cuota del
   periodo la calcula el sistema con días hábiles menos ausencias aprobadas.
5. **Presencial solo en el sitio y el mismo día**; lejos del lugar, telefónica si la persona la tiene
   habilitada, evaluada aparte.
6. **La información se organiza aquí**: médicos, cuentas, contactos y direcciones son tablas de OpMap,
   editables, cargables por archivo y creables desde la app sin bandeja de aprobación. Odoo, después.

Restricciones del repo: cero Google Maps (GPS del teléfono, Haversine), estética del mapa intocable,
terminología visible "Ejecutivo Comercial", "Zona", "IPS", "Médico", "Cuenta", "Contacto" (nunca "KAM",
"representante" ni "panel").

## 3. Vocabulario (propuesta para cerrar la confusión "institución / cliente")

- **Médico**: persona que ordena. Tiene especialidad y una o varias **direcciones** (consultorio, clínicas
  donde opera).
- **Cuenta**: cualquier organización que compra o decide: clínica u hospital (IPS, con su sede REPS), operador
  logístico, EPS, otra. Una clínica es una cuenta aunque no compre todavía. "Institución" y "cliente" dejan
  de usarse como nombres de entidad: son **tipos de cuenta**.
- **Contacto**: persona dentro de una cuenta, con **cargo** (compras, gerencia, dirección médica, químico
  farmacéutico, almacén, programación de cirugía, quirófano, esterilización, cartera, autorizaciones…).
- **Actividad**: lo que se reporta. Tiene un **tipo** (sección 5) con un **objetivo**: inducción al médico,
  inducción a la compra o gestión.

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
  > **Visita a compras** · Clínica X · Marta (compras) · van a cotizar.
  > **Gestión de codificación** · Clínica X · químico farmacéutico · tornillo canulado.
  Confirma con un toque, corrige hablando o cambia el tipo si la app se equivocó.
- Si el médico o el contacto no existen, la app lo dice y ofrece crearlo ahí mismo (nombre, especialidad o
  cargo, cuenta) con aviso de posibles duplicados; sin aprobación.
- Presencial solo a menos del radio de una dirección conocida; lejos, telefónica si la tiene habilitada o
  "guardar este punto como dirección nueva" cuando es un consultorio.
- Solicita ausencias desde la app; ve su meta ajustada y "Mis números".

**Directora comercial (web)**: tipos de actividad y si llevan meta; metas por zona y por persona; perfiles
(a quién se le mide qué); ausencias en bloque; avisos; corrección con rastro. **Recursos humanos**:
ausencias. **Líder de línea**: su línea. **Data manager**: carga por archivo de médicos, cuentas y
contactos, duplicados, equivalencias de VMO.

## 5. Tipos de actividad (configurables; semilla inicial)

| Tipo | Objetivo | Dirigido a | Cargos sugeridos | Meta por defecto | Presencial |
| --- | --- | --- | --- | --- | --- |
| Visita médica | inducción al médico | Médico | — | 6 / día | sí (o telefónica si habilitada) |
| Visita a compras | inducción a la compra | Cuenta | compras, gerencia, dirección médica | 1 / día | sí |
| Gestión de codificación | gestión | Cuenta | químico farmacéutico, almacén, farmacia | seguimiento | sí |
| Gestión de programación | gestión | Cuenta | programación de cirugía, quirófano, esterilización | seguimiento | sí |
| Gestión de cartera | gestión | Cuenta | cartera, facturación, autorizaciones | seguimiento | sí o telefónica |
| Acompañamiento en sala | gestión | Cuenta | instrumentación, quirófano | seguimiento | sí |

Cada tipo tiene: nombre, objetivo (inducción_medico | inducción_compra | gestión), dirigido a (médico |
cuenta), cargos que lo sugieren, si **cuenta para meta** (por defecto sí en las inducciones, no en las
gestiones; la directora lo cambia), si exige presencial, y si está activo. La app propone el tipo por el
cargo del contacto (químico farmacéutico → codificación) y la ejecutiva puede cambiarlo.

**Metas y perfiles**: la meta se fija por tipo de actividad, por zona (valor por defecto) y por persona
(excepción), en actividades por día o por semana. Una persona cuyo perfil solo tiene metas en "Visita a
compras" es, en la práctica, un gerente de cuentas clave; no hace falta un rol aparte. Las gestiones sin
meta se miden igual (número, tiempo, mezcla) y la directora puede ponerles meta cuando quiera.

## 6. Alcance del MVP (lista cerrada)

1. **App móvil** (Expo / React Native, TypeScript, misma API de OpMap): sesión de OpMap, GPS, micrófono,
   tiempo real. Piloto por TestFlight y pruebas internas de Play.
2. **Reporte por voz**: grabación → transcripción en el servidor (API de OpenAI, `gpt-4o-transcribe` o
   `whisper-1`, español con vocabulario de VG) → la API de Claude propone uno o varios registros contra el
   esquema (tipo de actividad, médico o cuenta y contacto cruzados contra las tablas de OpMap, líneas,
   efectiva o no, conclusión, compromisos, próxima reunión) → tarjetas de confirmación → un toque. Nada se
   guarda sin confirmar. Audio 12 meses en bucket privado; transcripción con el registro.
3. **Reporte por toques** (respaldo) con los mismos campos.
4. **Médicos, cuentas, contactos y direcciones en OpMap**: carga por archivo (Excel o CSV, con el mismo
   patrón del importador del REPS: detección de columnas, simulación, aplicar), las 783 IPS entran como
   cuentas automáticamente (vinculadas a `hospitals`), creación desde la app y desde la web con aviso de
   duplicados, asignación de médicos y cuentas a cada ejecutiva (desde el territorio o a mano).
5. **Direcciones con GPS**: consultorio nuevo o clínica donde atiende, guardadas desde la app.
6. **Tipos de actividad** configurables (sección 5) y sugerencia por cargo.
7. **Radio con bloqueo** (500 m, único) y **telefónica por persona**.
8. **Metas** por tipo, zona y persona, día o semana; cuota del periodo calculada.
9. **Ausencias**: solicitud desde la app; bandeja web con aprobación en bloque (directora y recursos
   humanos).
10. **Hoy, Mis números, Equipo, Metas, Tipos de actividad, ficha de IPS** (pestaña "Actividades" junto a
    compras SECOP y giros ADRES), **filtros del mapa de calor** (sin capas nuevas).
11. **Convivencia con VMO**: importador corregido, equivalencias, marca de sistema por ejecutiva; el export
    de VMO puede servir de carga inicial de médicos y cuentas si el dueño lo decide.

### Después del MVP
Integración con Odoo (la harán los desarrolladores del dueño sobre estas tablas), modo sin señal, "Mi
semana", vínculo de gestiones con casos de paciente, ventas por médico, priorización automática, lectura de
la confirmación en voz alta, visitas en el mapa (requiere autorización: estética).

### Qué se conserva de VMO y qué se descarta

| Se conserva | Cómo queda |
| --- | --- |
| Visitas a médicos y a compras con GPS; presencial o telefónica; efectiva o no con motivo | Tipos de actividad con objetivo; por voz o toques |
| Metas (6 médicos + 1 institución al día) | Metas por tipo de actividad, zona y persona; cuota calculada con días hábiles y ausencias |
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
| 28 reportes, 25 módulos, formularios de pestañas | 6 KPIs, metas, tipos de actividad y una tarjeta de confirmación |

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
| `medicos` | `id`, `nombre`, `especialidades` text[] (ortopedia, neurocirugía, columna, deportiva, maxilofacial, fisiatría, cirugía general, otra), `ciudad`, `municipality_id`, `executive_id` (asignada), `telefono`, `email`, `origen` ('archivo' \| 'app' \| 'vmo'), `created_by`, `activo`, `notas`; sin documento | Base de médicos propia; aviso de duplicado por nombre normalizado + ciudad |
| `cuentas` | `id`, `nombre`, `tipo` ('ips' \| 'operador_logistico' \| 'eps' \| 'otra'), `nit` NULL, `hospital_id` NULL UNIQUE, `municipality_id`, `executive_id` NULL, `origen`, `activo` | Organizaciones; las IPS se crean solas desde `hospitals` |
| `contactos` | `id`, `cuenta_id`, `nombre`, `cargo_texto`, `rol` ('compras' \| 'gerencia' \| 'direccion_medica' \| 'quimico_farmaceutico' \| 'almacen_farmacia' \| 'programacion_cirugia' \| 'quirofano' \| 'esterilizacion' \| 'instrumentacion' \| 'cartera_facturacion' \| 'autorizaciones' \| 'otro'), `telefono`, `email`, `origen`, `activo` | Personas de la cuenta; el rol sugiere el tipo de actividad |
| `direcciones` | `id`, `medico_id` NULL, `cuenta_id` NULL (una de las dos), `etiqueta` ('consultorio' \| 'clinica' \| 'sede' \| 'otra'), `hospital_id` NULL, `reps_code` NULL, `direccion`, `ciudad`, `lat`, `lng`, `origen` ('archivo' \| 'gps_app' \| 'hospitals'), `created_by` | Dónde se visita; las de `gps_app` las crea la ejecutiva |
| `tipos_actividad` | `id`, `codigo`, `nombre`, `objetivo` ('induccion_medico' \| 'induccion_compra' \| 'gestion'), `dirigido_a` ('medico' \| 'cuenta'), `roles_sugeridos` text[], `cuenta_para_meta` bool, `exige_presencial` bool, `activo`, `orden` | Semilla de la sección 5; editable por la directora |
| `metas` | `scope` ('zona' \| 'ejecutiva'), `kam_id` NULL, `executive_id` NULL, `tipo_actividad_id`, `periodo` ('dia' \| 'semana'), `cantidad` numeric, `vigente_desde`, `set_by` | La de persona manda sobre la de zona; sin fila = sin meta (solo seguimiento) |
| `perfiles_visita` | `executive_id` PK, `telefonica_habilitada` bool, `radio_m` NULL | Telefónica por persona; radio distinto solo con autorización escrita |
| `ausencias` | `executive_id`, `fecha`, `fraccion` (1 \| 0,5), `motivo` ('vacaciones' \| 'incapacidad' \| 'cita_medica' \| 'capacitacion' \| 'congreso' \| 'administrativo' \| 'otro'), `estado` ('pendiente' \| 'aprobada' \| 'rechazada'), `solicitada_por`, `aprobada_por`, `aprobada_at`, `comentario` | Solicitud y aprobación en bloque; descuenta de la cuota |
| `company_calendar_exceptions` | `date` PK, `kind` ('non_working' \| 'working'), `label` | Días de empresa; festivos nacionales en `holidays.ts` |
| `vmo_representantes` | `vmo_name` PK, `executive_id`, `kam_id`, vigencia | Importador e histórico |

**`visits` (existente) — columnas nuevas**: `source` ('vmo_import' | 'app'), `executive_id`, `client_id`
UNIQUE, `tipo_actividad_id`, `objetivo` (copia del tipo, para que el histórico no cambie si se edita el
tipo), `medico_id` NULL, `cuenta_id` NULL, `contacto_id` NULL, `direccion_id` NULL, `place_name`,
`checked_in_at`, `distance_m`, `gps_accuracy_m`, `failure_reason`, `retry_date`, `conclusion`,
`compromisos`, `next_step_date`, `transcript`, `audio_path`, `input_mode` ('voz' | 'toques' | 'importada'),
`out_of_territory`, `created_by`, `updated_by`, `updated_at`, `deleted_at`. `hospital_id` sigue siendo la IPS
donde ocurrió si aplica. `visit_type` y `contact_type` conservan sus valores ('Visita efectiva' | 'Visita no
efectiva'; 'Visita presencial' | 'Visita virtual' = telefónica). `visit_lines` (`visit_id`, `line_id`).

CHECKs: la app exige `medico_id` si el tipo es a médico y `cuenta_id` si es a cuenta; presencial exige
`lat/lng`, una dirección o IPS y `distance_m <= radio` (la API rechaza si no); `objetivo` coherente con el
tipo. Columna nueva en `executives`: `visits_source` ('vmo' | 'app'). Rol nuevo de usuario: `hr`.

Migración `2026-10-XX_0800_visitas_app.sql` + rollback `9940` (Fase 2), aplicadas con autorización. Incluye la
creación de una cuenta por IPS activa y el backfill del histórico de VMO (`source='vmo_import'`,
`objetivo` según la columna de tipo de panel del Excel si existe).

### Voz: del audio al registro
1. La app graba (m4a, hasta 3 minutos) y sube audio, GPS, hora y `client_id`.
2. El servidor transcribe (OpenAI `gpt-4o-transcribe`, o `whisper-1`; español; prompt con vocabulario:
   PerOssal, osteosíntesis, nombres de líneas y de tipos de actividad).
3. La API de Claude (`claude-sonnet-5-5`) recibe la transcripción y el contexto (médicos y cuentas a menos
   de 1 km, asignados a la ejecutiva, contactos de esas cuentas, tipos de actividad activos) y devuelve
   salida estructurada: lista de registros con tipo de actividad, candidato (nombre dicho + mejor cruce con
   puntaje), contacto, líneas, efectiva o no y motivo, conclusión, compromisos, próxima reunión. Lo que no
   esté en las listas se descarta. Si no cruza, propone "no lo encuentro: ¿lo creo?".
4. Una tarjeta por registro; un toque; corrección hablando. Ambigüedad real → una sola pregunta.
5. Guardado en tiempo real; audio al bucket; si falla la transcripción, cola y respaldo por toques.

## 8. KPIs (6)

| # | KPI | Fórmula | Datos |
| --- | --- | --- | --- |
| 1 | **Cumplimiento de metas** por tipo de actividad | efectivas del tipo ÷ cuota del periodo (meta × días hábiles − ausencias aprobadas); ritmo = hábiles transcurridos ÷ hábiles | `visits`, `metas`, `ausencias`, `holidays.ts` |
| 2 | **Cobertura** | médicos asignados con ≥ 1 visita médica efectiva en el trimestre ÷ asignados; cuentas IPS del Anexo A con ≥ 1 visita a compras en el mes ÷ Anexo A | `medicos.executive_id`, `territory_snapshots` |
| 3 | **Mezcla por objetivo** | inducción al médico / inducción a la compra / gestión, en número y en tiempo estimado, por persona y mes, con alerta configurable | `visits.objetivo` |
| 4 | **Sin contacto reciente** | médicos asignados sin visita en 60 días; cuentas del Anexo A sin compras en 90 días, ordenadas por camas, quirófanos y compras SECOP | `visits`, `hospitals`, SECOP |
| 5 | **Calidad del reporte** | % telefónicas, % no efectivas, % fuera de territorio, % por toques frente a voz, % con dirección o médico nuevos | `visits` |
| 6 | **Actividad → resultado** | cuentas IPS visitadas frente a compras SECOP y giros ADRES ("visitadas sin compra", "compran sin visita") | `visits`, SECOP, ADRES |

## 9. Reglas de negocio no deducibles del código

- Un registro tiene un tipo de actividad; el tipo tiene un objetivo. Solo los tipos con `cuenta_para_meta`
  suman a la cuota; todos se miden en mezcla, número y tiempo.
- La app sugiere el tipo por el cargo del contacto (compras → visita a compras; químico farmacéutico →
  codificación; programación → programación); la ejecutiva puede cambiarlo; la directora puede exigir que
  ciertos cargos solo admitan gestión.
- Una misma llegada a una clínica puede dejar varios registros (compras, codificación, programación): son
  objetivos distintos y se miden aparte.
- Solo la actividad efectiva suma a metas y cobertura; la no efectiva se guarda con motivo.
- Presencial solo en el sitio: la API rechaza si `distance_m` supera el radio (500 m, único; excepción por
  persona solo con autorización escrita). Sin dirección conocida, la ejecutiva guarda el punto como
  dirección nueva antes de reportar, o reporta telefónica si la tiene habilitada.
- Mismo día y tiempo real: fecha y hora del teléfono al confirmar; no se reportan días anteriores desde la
  app; dirección corrige con rastro.
- Médicos, cuentas y contactos se crean sin aprobación (app o web) con aviso de duplicado; data manager
  revisa la lista de "creados esta semana" y fusiona duplicados.
- Metas: por tipo, zona y persona; periodo día o semana; sin fila no hay meta (solo seguimiento); las
  vacantes no se miden. Días hábiles = lunes a viernes menos festivos de Colombia (código) menos
  `company_calendar_exceptions`.
- Ausencias: la ejecutiva solicita; directora o recursos humanos aprueban o rechazan en bloque; la aprobada
  descuenta de inmediato.
- Quién edita qué: la ejecutiva sus registros del mismo día; dirección cualquiera con rastro; líder solo su
  línea; las ejecutivas no se ven entre sí.
- Privacidad: nunca cédula de médicos ni contactos; nada de pacientes; audio y transcripción internos.

## 10. Migración y convivencia con VMO

- Fase 0 verificada: `web/next.config.js` bloquea GPS y micrófono para la web; el importador de VMO borra
  todas las visitas del mes sin filtrar por fuente.
- Carga inicial de médicos, cuentas y contactos: por archivo (plantilla), o desde el export de VMO si el
  dueño lo decide (cruce de clientes con IPS por nombre y ciudad; lo que no cruce queda como cuenta "otra"
  para revisar).
- Histórico de VMO con `source='vmo_import'`; `executive_id` por `vmo_representantes`.
- Piloto: 2 ejecutivas con la app móvil un mes; corte con última importación.

## 11. Criterios de aceptación

- [ ] Dado un contacto con rol químico farmacéutico, cuando se dicta o se elige, entonces la app propone
      "Gestión de codificación", no suma a metas y aparece en la mezcla como gestión.
- [ ] Dado "Jefe de Compras" de una cuenta IPS del Anexo A, cuando se reporta efectiva, entonces suma 1 a
      "Visita a compras" y a la cobertura del Anexo A.
- [ ] Dado la directora marca "Gestión de programación" con meta 2 por semana para una persona, entonces esa
      gestión empieza a sumar a su cuota y las demás siguen solo en seguimiento.
- [ ] Dado una persona con metas solo en "Visita a compras", entonces "Hoy" y "Mis números" no le muestran
      meta de médicos y su cumplimiento se calcula solo sobre compras.
- [ ] Dado una presencial a 800 m del lugar elegido, entonces la API la rechaza y la app ofrece telefónica (si
      está habilitada) o dirección nueva.
- [ ] Dado meta de zona 6 visitas médicas y 1 a compras por día, excepción de 4 y 1 para una persona, 20 días
      hábiles y 2 ausencias aprobadas, entonces su cuota del mes es 72 y 18 y el ritmo al día hábil 10 es 50 %.
- [ ] Dado una meta semanal de 25, entonces la cuota del mes se calcula por semanas hábiles proporcionales.
- [ ] Dado la transcripción del ejemplo de la sección 4, entonces la función pura devuelve tres registros con
      sus tipos y nada se guarda sin confirmar; dado un médico que no cruza, propone crearlo y no lo crea solo.
- [ ] Dado "guardar este punto como dirección del médico", entonces existe `direcciones` con `origen='gps_app'`
      y la próxima visita lo ofrece como lugar.
- [ ] Dado la carga por archivo de 2.000 médicos con 30 nombres repetidos en la misma ciudad, entonces la
      simulación marca los 30 como posibles duplicados y no los crea sin decisión.
- [ ] Dado el mismo `client_id` dos veces, entonces hay una sola fila.
- [ ] Dado una visita de la app en octubre y una importación de VMO de octubre, entonces la visita de la app
      sigue existiendo.
- [ ] Dado un usuario `hr`, entonces ve y aprueba ausencias en bloque; un líder solo las de su línea; `viewer`
      recibe 403.

## 12. Fuera de alcance, impacto, plan y verificación

**Fuera de alcance**: Odoo (terceros, ausencias, casos de paciente), modo sin señal, "Mi semana", ventas por
médico, priorización automática, módulos descartados de VMO, estética del mapa, Google.

**Impacto**: migración 0800 + rollback 9940 (Fase 2); Google 0 USD; voz ≈ 0,01 USD por visita (OpenAI) +
0,005 USD por dictado (Claude), menos de 10 USD al mes; `OPENAI_API_KEY` y `ANTHROPIC_API_KEY` en Vercel
(las crea el dueño); bucket privado `visit-audio`; app Expo en `mobile/` (comparte reglas puras con
`web/lib`), compilación con EAS, cuentas Apple Developer (99 USD al año) y Google Play (25 USD) que crea el
dueño; estética del mapa sin cambios; permisos nuevos `visits:report`, `visits:team`, `visits:targets`,
`absences:approve`, `contacts:manage`; rol `hr`.

| Fase | Entrega | Evidencia |
| --- | --- | --- |
| **F0 Decisiones y prerrequisitos** | Respuestas del dueño en `docs/decisiones/`; `Permissions-Policy`; importador por fuente; cuentas enlazadas; cuentas de Apple, Google, OpenAI y Anthropic | `npm run check`; prueba del importador |
| **F1 Información** | Migración 0800 + rollback; tablas de médicos, cuentas, contactos, direcciones, tipos de actividad; cuenta por IPS; importador por archivo con simulación y duplicados; pantallas web de médicos, cuentas y contactos | `contactos-check.ts` puro; carga real de prueba |
| **F2 Reglas y metas** | `holidays.ts`; `visits-rules.ts` (tipo por cargo, cuota por periodo, Haversine y bloqueo, esquema del dictado); metas, perfiles, ausencias; API y permisos | `visits-check.ts` puro; pruebas de alcance |
| **F3 Voz** | `/api/me/voz/transcribir` y `/voz/proponer`; esquema y validación; bucket | dictado real de prueba |
| **F4 App móvil (piloto)** | Expo: sesión, Hoy, Reportar por voz con tarjetas, respaldo por toques, crear médico o contacto, dirección nueva, ausencias; TestFlight y Play interno; migración aplicada; 2 ejecutivas | capturas en iPhone y Android con un dictado real |
| **F5 Web de dirección** | Mis números, Equipo, Metas, Tipos de actividad, bandeja de ausencias, ficha de IPS, filtros del mapa de calor | capturas; pruebas de KPIs |
| **F6 Corte de VMO** | Última importación; todas en 'app'; nota de decisión | conteo por fuente |

**Verificación final**: `npm run check` en cada PR (y la suite de `mobile/`); pruebas puras de tipo por
cargo, cuota por periodo, festivos 2026-2027, bloqueo por radio, esquema del dictado, duplicados; dictado real
en el piloto; convivencia con el importador; rollback de 0800 probado; nada importa `google-distance.ts`.

## 13. Decisiones pendientes del dueño

Ya decididas el 2026-10-12: Odoo fuera del piloto; objetivos distintos (inducción al médico, inducción a la
compra, gestiones) con tipos configurables; metas por tipo, zona y persona calculadas por el sistema;
gestiones con meta opcional configurable por la directora; bloqueo por distancia; mismo día y tiempo real;
app móvil; voz con Whisper o similar y confirmación breve; consultorios como direcciones; ausencias en
OpMap con aprobación masiva (directora y recursos humanos).

| # | Pregunta | Recomendación |
| --- | --- | --- |
| 1 | ¿Te sirve **"Cuenta"** como nombre de la organización que se visita (clínica, operador logístico, EPS, otra), con "tipo de cuenta", en lugar de "institución" y "cliente"? | **Sí.** Resuelve la confusión y encaja con "gerente de cuentas clave". |
| 2 | ¿La **semilla de tipos de actividad** de la sección 5 es la correcta para arrancar (visita médica, visita a compras, codificación, programación, cartera, acompañamiento en sala)? | **Sí**, y la directora agrega los que aparezcan. |
| 3 | ¿La **carga inicial** de médicos, cuentas y contactos sale del export de VMO (2.178 médicos, 785 clientes) más la plantilla por archivo, o solo de la plantilla? | **VMO más plantilla**: ahorra digitar; los 166 médicos y 249 clientes duplicados de VMO se resuelven en la simulación. |
| 4 | ¿La ejecutiva puede **crear médicos y contactos desde la app** sin aprobación, con aviso de duplicado y revisión semanal de data manager? | **Sí.** |
| 5 | ¿**Telefónica** habilitada por persona por la directora, cuenta para la meta y se evalúa aparte? | **Sí**, habilitada para las dos del piloto al inicio. |
| 6 | ¿Piloto con 2 ejecutivas un mes con la app móvil y corte de VMO al mes siguiente? | **Sí.** |

Las respuestas van a `docs/decisiones/2026-10-XX-app-de-visita.md` y la spec pasa a "aprobada por el dueño"
antes de abrir la Fase 0.
