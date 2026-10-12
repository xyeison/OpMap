# Spec: app de visita de OpMap  (2026-10-12, v7)

**Estado**: **aprobada por el dueño (2026-10-12)**, v7 con la regla de vigencias por rango de fechas. Decisiones
en `docs/decisiones/2026-10-12-app-de-visita.md`. Producto mínimo viable que se construye en
OpMap para organizar la información de visitas; cuando funcione, los desarrolladores del dueño lo pegarán a
Odoo. **Fuera de alcance: Odoo y VMO** (VMO se apaga; no hay convivencia, piloto ni importación).

Cambios de v7 por decisión del dueño: todo lo que mide (qué suma a cada meta, plazos, radio, topes) es
**configurable, nada en código**; un **calendario** con festivos de Colombia precargados, días de empresa y
días libres de cada persona, que se registran antes o hasta un plazo de gracia configurable (24 horas por
defecto) después; **una sola tabla de terceros** (cuenta = empresa, con sede principal y sedes; una clínica
puede ser además cliente); **el audio no se guarda** (se transcribe y se desecha); sin piloto.

---

## 1. Problema

El equipo comercial (unas 20 personas) es reacio a reportar: "coger formularios, seleccionar, escribir, les
parece fastidioso, les quita el tiempo". VMO, hecho para laboratorios, no distingue lo que VG necesita medir.

Lo que VG necesita distinguir (dueño, 2026-10-12):

| Qué hace la ejecutiva | Tipo | Subtipo |
| --- | --- | --- |
| Visitar al médico para que ordene el producto (hoy 6 al día) | **Visita médica** | — |
| Visitar a la jefe de compras para que nos compre a nosotros | **Visita institucional** | Compras |
| Visitar al químico farmacéutico para que acepte y codifique el producto | **Visita institucional** | Químico farmacéutico |
| Visitar a los contactos de la EPS para que acepten y autoricen el producto | **Visita institucional** | Autorizaciones |
| Visitar a la jefe que programa para que programen al paciente | **Visita institucional** | Programación |
| Lo que vaya apareciendo | **Visita institucional** | Otro (la directora crea subtipos) |

A quién se le factura no depende de la visita sino de cómo trabaja cada EPS con VG:

| | Caso Proteger | Caso Nueva EPS |
| --- | --- | --- |
| VG le factura a | La EPS, directamente | La clínica, que a su vez le factura a la EPS |
| Cliente de VG en ese negocio | La EPS | La clínica |
| Visitas que importan | Médico; en la clínica, sobre todo programación | Médico; en la EPS, autorizaciones; en la clínica, químico, compras y programación |

La directora necesita ver quién "se la pasa en la gestión del contrato y no en la inducción", y poder tener
mañana a una persona que solo haga cuentas (un gerente de cuentas clave).

## 2. Principios

1. **La voz primero.** La ejecutiva sale, pulsa un botón y dice qué pasó; la app transcribe, entiende y
   muestra una confirmación corta: a quién vio, conclusión, compromisos, próxima reunión. Un toque.
2. **App móvil nativa** (iPhone y Android) con GPS y micrófono; guarda en tiempo real con internet.
3. **Dos tipos de visita**: médica e institucional; la institucional siempre lleva subtipo.
4. **Todo lo que mide es configurable** por la directora, sin tocar código: qué cuenta para cada meta, metas
   por tipo y subtipo, por zona y por persona, por día o por semana, radio, plazos, topes, telefónica.
5. **Un calendario** decide los días hábiles: festivos de Colombia precargados, días de empresa, días por
   ciudad y días libres de cada persona.
6. **Presencial solo en el sitio y el mismo día**; lejos del lugar, telefónica si la persona la tiene
   habilitada, evaluada aparte.
7. **Una sola tabla de terceros**: la cuenta es la empresa (clínica, EPS, operador logístico, consultorio,
   otra) con su sede principal y sus sedes; puede ser clínica, cliente o las dos. Los médicos se crean
   completos o no se crean.

Restricciones del repo: cero Google Maps (GPS del teléfono, Haversine), estética del mapa intocable,
terminología visible "Ejecutivo Comercial", "Zona", "IPS", "Médico", "Cuenta", "Sede", "Contacto" (nunca
"KAM", "representante" ni "panel").

## 3. Vocabulario (confirmado por el dueño)

- **Cuenta**: la empresa, un NIT (o la identificación del profesional, si es un consultorio de profesional
  independiente). Tiene **clase** (clínica, consultorio, EPS, operador logístico, otra) y puede ser
  **cliente** (VG le factura). Una clínica puede ser cliente o no; Proteger es cliente; una clínica donde solo
  se opera a pacientes de Proteger es clínica, no cliente.
- **Sede**: cada lugar de la cuenta, con una **principal** y las demás. Las sedes de clínicas y consultorios
  son **IPS** (con su código de habilitación del REPS); las de una EPS u operador son oficinas.
- **Médico**: persona que ordena. Tiene identificación obligatoria, especialidad y varias sedes donde
  atiende: su consultorio y las clínicas.
- **Visitantes del médico**: las ejecutivas que lo visitan, cada una por sus líneas; puede haber dos de la
  misma línea en ciudades distintas (el médico que trabaja dos semanas en Bogotá y dos en Barranquilla).
- **Contacto**: persona de una cuenta (y, si aplica, de una sede), con cargo.
- **Visita**: médica o institucional (con subtipo).
- **Modalidad de facturación** (de cada EPS): "directa" o "a través de la clínica".

## 4. Resultado esperado por rol

**Ejecutiva Comercial (app móvil)**
- "Hoy": sus visitas por tipo frente a la meta del día, compromisos vencidos y un botón grande **"Reportar"**.
- Habla: "Estuve con el doctor Pérez en su consultorio, le mostré PerOssal y reemplazo, quedó de mandarme un
  caso la otra semana; también pasé por compras con la jefe Marta, van a cotizar; y con el químico para que
  codifique el tornillo canulado". La app transcribe, reconoce a Pérez, a Marta y a la cuenta, y muestra:
  > **Visita médica** · Dr. Pérez (ortopedista) · hoy 10:42 · Consultorio Pérez · PerOssal, Reemplazo ·
  > Conclusión: enviará un caso · Compromiso: la otra semana · Próxima reunión: sin programar → ¿programar?
  > **Visita institucional · Compras** · Clínica X, sede norte · Marta (compras) · van a cotizar.
  > **Visita institucional · Químico farmacéutico** · Clínica X, sede norte · tornillo canulado por codificar.
  Confirma con un toque, corrige hablando o cambia el subtipo.
- Si el médico no existe, la app ofrece crearlo **completo**: tipo y número de identificación, nombre,
  especialidad, ciudad y al menos una sede donde atiende. Si falta algo, no se crea; si el documento ya
  existe, muestra al médico existente. Esto se digita, nunca se dicta.
- Presencial solo a menos del radio de una sede conocida del médico o de la cuenta. Lejos: telefónica si la
  tiene habilitada, o "crear esta sede" cuando el médico atiende en un consultorio que no está.
- Registra sus días libres en el calendario antes o dentro del plazo de gracia; ve su meta ajustada.
- "Mis números": cumplimiento por tipo y subtipo, cobertura de sus médicos y cuentas, mezcla, sin contacto
  reciente.

**Directora comercial (web)**: toda la configuración (sección 6); visitantes de los médicos; aprobación en
bloque de días libres; avisos; corrección de visitas con rastro. **Recursos humanos**: calendario y días
libres. **Líder de línea**: su línea, sus visitantes. **Data manager**: revisión de terceros creados,
duplicados y sedes por confirmar.

## 5. Tipos y subtipos de visita

Dos tipos fijos: **médica** e **institucional**. La institucional siempre lleva subtipo. Semilla (los que
vienen precargados; la directora añade, renombra o apaga):

| Subtipo | A quién | Para qué | Cargos que lo sugieren |
| --- | --- | --- | --- |
| Compras | Jefe de compras de la clínica o del operador | Que nos compren: precio, condiciones, contrato | compras, gerencia, dirección médica |
| Químico farmacéutico | Químico, farmacia, almacén | Que acepten y codifiquen el producto | químico farmacéutico, almacén, farmacia |
| Autorizaciones | Contactos de la EPS | Que la EPS acepte y autorice el producto o el procedimiento | autorizaciones, auditoría médica |
| Programación | Jefe que programa, quirófano | Que programen al paciente | programación de cirugía, quirófano, esterilización, instrumentación |
| Otro | Cualquiera | Lo que aparezca | otro |

## 6. Configuración (todo editable por la directora; nada en código)

| Qué se configura | Opciones | Valor inicial |
| --- | --- | --- |
| **Metas** | Por tipo (médica, institucional) y por subtipo; por zona (valor por defecto) y por persona (excepción); por día o por semana; vigentes desde una fecha | Médica 6 al día; institucional 1 al día |
| **Qué cuenta para cada meta** | Para cada subtipo: suma a la meta institucional, tiene meta propia, o solo seguimiento; con un **peso** (por ejemplo, una visita de programación vale 0,5) | Ver pregunta 1 de la sección 14 |
| **Perfiles** | Qué metas tiene cada persona (una persona solo con institucional es un gerente de cuentas clave) | Todas las ejecutivas con médica e institucional |
| **Radio de presencial** | Metros, global y excepción por persona | 500 m |
| **Telefónica** | Habilitada por persona; tope por día; si suma igual o con peso | Ver pregunta 4 |
| **Tope por médico** | Visitas que suman por médico al día | Ver pregunta 4 |
| **Plazo de gracia de días libres** | Horas después del día en que se pueden registrar | 24 horas |
| **Aprobación de días libres** | Si necesitan aprobación y quién aprueba (directora, recursos humanos) | Directora o recursos humanos, en bloque |
| **Motivos de día libre** | Lista editable | Vacaciones, incapacidad, cita médica, capacitación, congreso, acompañamiento de cirugía, administrativo, otro |
| **Días hábiles de la semana** | Qué días generan cuota y con qué fracción | Lunes a viernes, 1 |
| **Subtipos y cargos** | Subtipos, sus cargos sugeridos y su orden | La semilla de la sección 5 |
| **Alertas de mezcla** | Umbral por subtipo o por tipo | Sin umbral al arrancar |

**Vigencias por rango de fechas (regla del dueño, 2026-10-12)**: toda configuración que pueda cambiar un
resultado pasado (qué cuenta y con qué peso, metas, perfiles, radio, telefónica, topes, plazo de gracia, días
hábiles de la semana, subtipos y sus cargos, alertas) se guarda como una **línea de tiempo**: cada valor tiene
`vigente_desde` y `vigente_hasta` (abierta mientras rige), sin rangos superpuestos. Cambiar algo **no edita**
el valor anterior: cierra su rango y abre uno nuevo. Los cálculos de cualquier periodo usan el valor que regía
en la fecha de cada visita o de cada día, así que hasta una fecha rige una condición y desde ahí otra, y el
pasado no cambia por un cambio de hoy. Si la directora necesita corregir el pasado a propósito, crea un rango
que empieza en una fecha anterior; queda quién, cuándo y por qué, y la pantalla avisa qué meses se recalculan.

## 7. Calendario

- **Festivos de Colombia** precargados para 2026 y 2027 (Ley 51 de 1983: fijos, trasladados al lunes y los que
  dependen de Pascua), calculados por el sistema y guardados en el calendario para que la directora o
  recursos humanos puedan corregir uno si hace falta.
- **Días de empresa**: los que VG declara no laborables (24 y 31 de diciembre, día de la familia) o laborables.
- **Días por ciudad**: días cívicos o festivos locales que solo aplican a quienes trabajan en esa ciudad.
- **Días libres de cada persona**: día completo o medio día, con motivo. Se registran **antes** o hasta el
  **plazo de gracia** después (24 horas por defecto, configurable). Pasado el plazo, la app no deja
  registrarlos y el día cuenta como hábil sin visitas en los indicadores. Si la configuración exige
  aprobación, quedan "por aprobar" (no en rojo) hasta que la directora o recursos humanos los aprueben en
  bloque.
- **Cuota del periodo** = meta × días hábiles del calendario de esa persona − días libres aprobados.

## 8. Alcance del MVP (lista cerrada)

1. **App móvil** (Expo / React Native, TypeScript, misma API de OpMap): sesión de OpMap, GPS, micrófono,
   tiempo real. Distribución por TestFlight y pruebas internas de Play al inicio; tiendas después.
2. **Reporte por voz**: grabación → transcripción en el servidor (API de OpenAI, `gpt-4o-transcribe` o
   `whisper-1`, español con vocabulario de VG) → **el audio se desecha** → la API de Claude propone una o
   varias visitas contra el esquema (tipo y subtipo, médico o cuenta, sede y contacto cruzados contra las
   tablas de OpMap, líneas, efectiva o no, conclusión, compromisos, próxima reunión) → tarjetas de
   confirmación → un toque. Nada se guarda sin confirmar; se guarda la transcripción con la visita.
3. **Reporte por toques** (respaldo) con los mismos campos.
4. **Terceros en OpMap**, creados a mano por el equipo (app y web), sin carga masiva: cuentas con sus sedes
   (las 783 IPS de hoy entran como sedes agrupadas en cuentas por NIT, con su sede principal), médicos
   completos, contactos. Visitantes de cada médico por línea y ciudad.
5. **Sedes nuevas desde la app** (el consultorio que no estaba), con código de habilitación del REPS si lo
   tiene y el GPS del sitio.
6. **Visita médica e institucional con subtipos**, sugerencia del subtipo por cargo, modalidad de facturación
   en las EPS.
7. **Configuración** completa (sección 6) y **calendario** (sección 7).
8. **Radio con bloqueo** y **telefónica por persona**.
9. **Hoy, Mis números, Equipo, Configuración, Calendario, ficha de IPS** (pestaña "Visitas" junto a compras
   SECOP y giros ADRES), **filtros del mapa de calor** existente (sin capas nuevas).

### Después del MVP
Integración con Odoo, importación de datos que el dueño decida traer, modo sin señal completo, "Mi semana",
vínculo de visitas institucionales con casos de paciente, ventas por médico, sugerencia de visitas faltantes
por cuenta según la modalidad de facturación, priorización automática, visitas en el mapa (requiere
autorización: estética).

### Qué no se hace (de lo que hace VMO)
Frecuencia por médico y categorías A/B/C; bandejas de altas y bajas; material, muestras, inventario,
parrilla y ayudas visuales; agenda en medias horas y ruteros; farmacias, pacientes, farmacovigilancia,
cartera de crédito, transferencia de valor, cumpleaños, e-learning; 28 reportes y 25 módulos; formularios de
varias pestañas; ubicación en tiempo real cada 5 minutos.

## 9. Modelo de datos

### Terceros: una sola tabla de cuentas con sus sedes
- **`cuentas`** es la tabla única de terceros-organización: clínicas, consultorios, EPS, operadores
  logísticos y otras, cada una con sus marcas de clínica y cliente. Una clínica cliente es una sola fila.
- **`sedes`**: cada lugar de una cuenta, con una principal. Las sedes que son IPS llevan `reps_code` (código
  de habilitación, llave contra duplicados) y, si son una de las 783 de hoy, `hospital_id`.
- `hospitals` **no cambia**: sigue siendo el conjunto de IPS que reparten zonas, mueven el algoritmo de
  asignación, el territorio y las rutas de Google. Los consultorios y las sedes nuevas **no entran** ahí, para
  no mover territorios ni gastar en Google cada vez que se crea uno; si el dueño quiere que cuenten para las
  zonas, se promueven después.
- Cuando se integre a Odoo, `cuentas` + `sedes` corresponden a la empresa con sus direcciones, y `medicos` y
  `contactos` a las personas.

### Tablas nuevas (RLS sin políticas; solo `service_role` desde `lib/supabase-admin.ts`)

| Tabla | Columnas clave | Para qué |
| --- | --- | --- |
| `cuentas` | `id`, `nombre`, `clase` ('clinica' \| 'consultorio' \| 'eps' \| 'operador_logistico' \| 'otra'), `es_cliente` bool, `tipo_identificacion` ('NIT' \| 'CC' \| 'CE' \| 'otro'), `numero_identificacion` UNIQUE con el tipo, `codigo_prestador` NULL (REPS), `modalidad_facturacion` NULL ('directa' \| 'via_clinica', solo EPS), `activo`, `created_by` | Tabla única de terceros-organización |
| `sedes` | `id`, `cuenta_id`, `nombre`, `es_principal` bool (una por cuenta), `reps_code` NULL UNIQUE, `hospital_id` NULL UNIQUE, `direccion`, `municipality_id`, `ciudad`, `lat`, `lng`, `ubicacion_confirmada` bool, `origen` ('hospitals' \| 'manual' \| 'gps_app'), `activo` | Lugares de cada cuenta; las IPS de hoy se cargan aquí por NIT |
| `medicos` | `id`, `tipo_documento` ('CC' \| 'CE' \| 'PA' \| 'PEP' \| 'otro') NOT NULL, `numero_documento` NOT NULL, UNIQUE (tipo, número), `nombre` NOT NULL, `especialidades` text[] NOT NULL, `municipality_id` NOT NULL, `telefono`, `email`, `activo`, `created_by` | Médicos completos o no se crean |
| `medico_sedes` | `medico_id`, `sede_id`, `rol` ('consultorio' \| 'atiende'), `principal` bool; al menos una por médico | Dónde atiende cada médico |
| `medico_visitantes` | `medico_id`, `executive_id`, `line_id`, `municipality_id` NULL, `desde`, `hasta` NULL; UNIQUE (médico, ejecutiva, línea, ciudad) | Quién lo visita y por qué línea |
| `contactos` | `id`, `cuenta_id`, `sede_id` NULL, `nombre`, `cargo_texto`, `rol` (lista de la sección 5 más gerencia, cartera, otro), `telefono`, `email`, `activo` | Personas de la cuenta; el cargo sugiere el subtipo |
| `subtipos_institucionales` | `id`, `codigo`, `nombre`, `para_que`, `roles_sugeridos` text[], `orden`, `vigente_desde`, `vigente_hasta` NULL | Semilla de la sección 5; un subtipo se apaga cerrando su rango, nunca se borra |
| `config_metas` | `scope` ('zona' \| 'ejecutiva'), `kam_id` NULL, `executive_id` NULL, `tipo`, `subtipo_id` NULL, `periodo` ('dia' \| 'semana'), `cantidad`, `vigente_desde`, `vigente_hasta` NULL, `set_by`, `motivo` | Metas, como línea de tiempo |
| `config_conteo` | `subtipo_id`, `modo` ('suma_institucional' \| 'meta_propia' \| 'seguimiento'), `peso` numeric, `vigente_desde`, `vigente_hasta` NULL, `set_by`, `motivo` | Qué cuenta y cuánto, como línea de tiempo |
| `config_general` | `clave`, `valor` jsonb, `vigente_desde`, `vigente_hasta` NULL, `set_by`, `motivo` | Radio, plazo de gracia, días hábiles de la semana, tope por médico, alertas, aprobación |
| `config_personas` | `executive_id`, `perfil` (metas que aplican), `telefonica_habilitada`, `tope_telefonicas_dia`, `radio_m` NULL, `vigente_desde`, `vigente_hasta` NULL, `set_by`, `motivo` | Excepciones por persona, como línea de tiempo |
| `calendario` | `fecha`, `alcance` ('nacional' \| 'empresa' \| 'ciudad'), `municipality_id` NULL, `tipo` ('no_habil' \| 'habil'), `nombre`, `origen` ('calculado' \| 'manual') | Festivos y días de empresa y ciudad |
| `dias_libres` | `executive_id`, `fecha`, `fraccion` (1 \| 0,5), `motivo`, `estado` ('registrado' \| 'por_aprobar' \| 'aprobado' \| 'rechazado'), `registrado_at`, `aprobado_por`, `aprobado_at` | Días libres de cada persona, con el plazo de gracia |

**`visits` (existente) — columnas nuevas**: `source` ('vmo_import' | 'app'), `executive_id`, `client_id`
UNIQUE, `tipo` ('medica' | 'institucional'), `subtipo_id`, `subtipo_codigo` (copia), `medico_id`, `cuenta_id`,
`sede_id`, `contacto_id`, `checked_in_at`, `distance_m`, `gps_accuracy_m`, `failure_reason`, `retry_date`,
`conclusion`, `compromisos`, `next_step_date`, `transcript`, `input_mode` ('voz' | 'toques'),
`out_of_territory`, `created_by`, `updated_by`, `updated_at`, `deleted_at`. No hay columna de audio.
`visit_type` y `contact_type` conservan sus valores para el mapa de calor; las 7.033 visitas importadas de VMO
quedan como `source='vmo_import'` solo como histórico del mapa. `visit_lines` (`visit_id`, `line_id`).

CHECKs: médica exige `medico_id` y `sede_id`; institucional exige `cuenta_id`, `sede_id` y `subtipo_id`;
presencial exige `lat/lng` y `distance_m <= radio` vigente (la API rechaza si no). En las tablas de
configuración, una restricción de exclusión impide rangos superpuestos para la misma clave, zona o persona.
Rol nuevo de usuario: `hr`.

Migración `2026-10-XX_0800_visitas_app.sql` + rollback `9940`, aplicadas con autorización. Incluye: carga de
las 783 IPS como sedes agrupadas en cuentas por NIT (la sede con más camas como principal, editable),
semilla de subtipos, configuración inicial y festivos 2026-2027.

### Voz: del audio al texto (sin guardar audio)
1. La app graba (m4a, hasta 3 minutos) y sube audio, GPS, hora y `client_id`.
2. El servidor transcribe (OpenAI `gpt-4o-transcribe`, o `whisper-1`; español; vocabulario de VG) y **borra el
   audio en cuanto tiene el texto**; no se escribe en disco ni en bucket. Si la transcripción falla, la app
   conserva el audio en el teléfono solo hasta reintentar, y ofrece el respaldo por toques.
3. La API de Claude (`claude-sonnet-5-5`) recibe la transcripción y el contexto (sedes y médicos a menos de
   1 km, los médicos que ella visita, contactos de esas cuentas, subtipos activos) y devuelve salida
   estructurada: visitas con tipo y subtipo, candidato con puntaje, sede, contacto, líneas, efectiva o no,
   conclusión, compromisos, próxima reunión. Nunca inventa un tercero ni produce un número de documento.
4. Una tarjeta por visita; un toque; corrección hablando. Ambigüedad real → una sola pregunta.

## 10. KPIs (6)

| # | KPI | Fórmula | Datos |
| --- | --- | --- | --- |
| 1 | **Cumplimiento de metas** (médica, institucional, subtipos con meta propia) | visitas efectivas × peso ÷ cuota del periodo; ritmo = días hábiles transcurridos ÷ del periodo | `visits`, `config_*`, `calendario`, `dias_libres` |
| 2 | **Cobertura** | médicos que ella visita con ≥ 1 visita suya en el trimestre ÷ esos médicos; cuentas de su territorio con ≥ 1 visita institucional en el periodo ÷ esas cuentas | `medico_visitantes`, `territory_snapshots`, `sedes` |
| 3 | **Mezcla** | médica frente a institucional, e institucional por subtipo, por persona y mes, con alerta configurable | `visits` |
| 4 | **Sin contacto reciente** | médicos que ella visita sin visita en 60 días; cuentas del territorio sin visita institucional en 90 días, ordenadas por camas, quirófanos y compras SECOP | `visits`, `hospitals`, SECOP |
| 5 | **Calidad del reporte** | % telefónicas, % no efectivas, % fuera de territorio, % por toques frente a voz, % de sedes o médicos nuevos, días hábiles sin visitas | `visits`, `calendario` |
| 6 | **Visita → resultado** | cuentas visitadas frente a compras SECOP y giros ADRES ("visitadas sin compra", "compran sin visita") | `visits`, SECOP, ADRES |

## 11. Reglas de negocio no deducibles del código

- Una visita es médica o institucional; la institucional siempre lleva subtipo. Qué suma y cuánto lo decide
  `config_conteo` vigente en la fecha de la visita.
- **Nada que cambie hoy reescribe el pasado**: toda configuración es una línea de tiempo con rangos de
  fechas; los cálculos usan el valor que regía en cada fecha. Corregir el pasado exige crear un rango con
  fecha anterior, con motivo y rastro.
- La app sugiere el subtipo por el cargo del contacto; la ejecutiva puede cambiarlo.
- Una llegada a una clínica puede dejar varias visitas (médico, compras, químico, programación).
- Solo la visita efectiva suma; la no efectiva se guarda con motivo.
- **Presencial solo en el sitio**: la API rechaza si `distance_m` a la sede elegida supera el radio vigente.
  Si el médico atiende en un consultorio que no está, la ejecutiva crea la sede (con código de habilitación
  si lo tiene y el GPS del sitio) antes de reportar, o reporta telefónica si la tiene habilitada.
- **Mismo día, tiempo real**: fecha y hora del teléfono al confirmar; no se reportan días anteriores desde la
  app; la directora corrige con rastro.
- **Médicos completos o no se crean** (dueño, 2026-10-12): identificación, nombre, especialidad, ciudad y al
  menos una sede. Sin médico creado no hay visita médica. El documento se digita, se guarda protegido
  (visible solo con permiso de administrar terceros, fuera de listas, exportaciones, voz y tarjetas).
- **Una cuenta por identificación**: no puede haber dos cuentas con el mismo NIT; una clínica cliente es una
  sola cuenta con sus sedes. Compras es de la cuenta y vale en cualquier sede; químico y programación son de
  su sede.
- **Visitantes del médico**: varias ejecutivas por médico, cada una por sus líneas, incluso dos de la misma
  línea en ciudades distintas. Una visita a un médico del que no es visitante suma a su meta, la app le ofrece
  pedir ser su visitante y no suma a la cobertura de nadie hasta que la directora o el líder lo acepten.
- **Días libres**: antes o dentro del plazo de gracia; después no se pueden registrar y el día cuenta como
  hábil sin visitas.
- **Quién edita qué**: la ejecutiva sus visitas del mismo día y sus días libres; la directora la
  configuración, los visitantes y cualquier visita con rastro; recursos humanos el calendario y los días
  libres; el líder ve su línea y propone visitantes; las ejecutivas no se ven entre sí.
- **Privacidad**: nada de pacientes; el audio no se guarda; la transcripción es interna (ejecutiva, su líder,
  dirección); documento del médico protegido. Pendiente: aviso de tratamiento de datos de legal (pregunta 5).

## 12. Criterios de aceptación

- [ ] Dado un contacto con cargo químico farmacéutico, cuando se dicta o se elige, entonces la app propone
      "Visita institucional · Químico farmacéutico" y suma según `config_conteo` vigente.
- [ ] Dado que la directora configura Programación como "solo seguimiento" desde el día 15, entonces las de
      antes del 15 siguen sumando y las de después solo aparecen en la mezcla.
- [ ] Dado Programación con peso 0,5 en la meta institucional, entonces dos visitas de programación suman 1.
- [ ] Dado Compras con peso 1 hasta el 31 de octubre y peso 0,5 desde el 1 de noviembre, entonces el
      cumplimiento de octubre no cambia al registrar el nuevo valor y el de noviembre usa 0,5; dado un intento de
      crear un rango que se superpone con otro, la base lo rechaza.
- [ ] Dado que la directora crea un rango con fecha anterior para corregir el pasado, entonces queda su motivo
      y la pantalla lista los meses que se recalculan antes de guardar.
- [ ] Dado una persona con perfil solo institucional, entonces "Hoy" y "Mis números" no le muestran meta médica.
- [ ] Dado una presencial a 800 m de la sede elegida, entonces la API la rechaza y la app ofrece telefónica (si
      está habilitada) o crear la sede.
- [ ] Dado meta médica de zona 6 al día y excepción de 4 para una persona, 20 días hábiles en su calendario y
      2 días libres aprobados, entonces su cuota médica del mes es 72 y el ritmo al día hábil 10 es 50 %.
- [ ] Dado un festivo de su ciudad marcado en el calendario, entonces solo las personas de esa ciudad tienen un
      día hábil menos.
- [ ] Dado plazo de gracia de 24 horas, cuando una ejecutiva intenta registrar un día libre 30 horas después,
      entonces la app no lo permite y ese día cuenta como hábil sin visitas; dado que la directora sube el plazo
      a 48 horas, entonces sí lo permite.
- [ ] Dado los festivos de 2026, entonces el 2 de noviembre está y el 13 de julio no (prueba pura).
- [ ] Dado la transcripción del ejemplo de la sección 4, entonces la función pura devuelve tres visitas y nada se
      guarda sin confirmar; dado un médico que no cruza, propone crearlo completo y no lo crea solo.
- [ ] Dado un dictado procesado, entonces el audio no existe en el servidor ni en Supabase después de transcribir.
- [ ] Dado un intento de crear un médico sin identificación, nombre, especialidad, ciudad o sede, entonces la
      API devuelve 400 y no queda nada guardado; dado el mismo documento de otro médico, la app muestra el
      existente.
- [ ] Dado dos cuentas con el mismo NIT, entonces la base rechaza la segunda; dado una clínica con 5 sedes de las
      783, entonces queda una cuenta con 5 sedes y una principal.
- [ ] Dado un médico con dos visitantes de la misma línea, en Bogotá y en Barranquilla, entonces cada una lo ve
      en su "Hoy" y en su cobertura, y la visita de una no cuenta en la cobertura de la otra.
- [ ] Dado el mismo `client_id` dos veces, entonces hay una sola fila.
- [ ] Dado un usuario `hr` o la directora, entonces aprueban días libres en bloque; un líder solo ve los de su
      línea, sin aprobar; `viewer` recibe 403.

## 13. Fuera de alcance, impacto, plan y verificación

**Fuera de alcance**: Odoo; VMO (sin importación, piloto ni convivencia; el importador actual de `/visits` se
deshabilita para que no borre visitas de la app, porque hoy borra todas las del mes sin distinguir fuente);
modo sin señal completo; "Mi semana"; casos de paciente; ventas por médico; priorización automática; estética
del mapa; Google.

**Impacto**: migración 0800 + rollback 9940; Google 0 USD; voz ≈ 0,01 USD por visita (OpenAI) + 0,005 USD por
dictado (Claude), unos 30 a 45 USD al mes para 20 personas; `OPENAI_API_KEY` y `ANTHROPIC_API_KEY` en Vercel
(las crea el dueño); sin almacenamiento de audio; app Expo en `mobile/` (comparte reglas puras con `web/lib`),
compilación con EAS; cuentas Apple Developer (99 USD al año) y Google Play (25 USD) a nombre de VG, que crea el
dueño; estética del mapa sin cambios; `web/next.config.js` deja de bloquear GPS y micrófono para la web;
permisos nuevos `visits:report`, `visits:team`, `visits:config`, `calendar:manage`, `daysoff:approve`,
`terceros:manage`; rol `hr`.

| Fase | Entrega | Evidencia |
| --- | --- | --- |
| **F0 Prerrequisitos** | Respuestas del dueño en `docs/decisiones/`; importador de VMO deshabilitado; `Permissions-Policy`; cuentas de usuario enlazadas; cuentas de Apple, Google, OpenAI y Anthropic | `npm run check` |
| **F1 Terceros** | Migración 0800 + rollback; cuentas, sedes (783 IPS agrupadas por NIT), médicos, `medico_sedes`, visitantes, contactos; pantallas web de terceros; reglas de unicidad | `terceros-check.ts` puro |
| **F2 Configuración y calendario** | Tablas `config_*`, `calendario`, `dias_libres`; festivos calculados; pantallas web de Configuración y Calendario; aprobación en bloque | `visits-check.ts`: festivos, plazo de gracia, cuota, pesos, vigencias |
| **F3 Reglas, API y voz** | `visits-rules.ts` (subtipo por cargo, cuota, Haversine y bloqueo, esquema del dictado); `/api/me/*` (contexto, visitas idempotentes, `voz/transcribir` sin guardar audio, `voz/proponer`); alcance por rol | pruebas puras y de alcance; dictado real de prueba |
| **F4 App móvil** | Expo: sesión, Hoy, Reportar por voz, respaldo por toques, crear médico o sede, días libres, Mis números; TestFlight y Play interno | capturas en iPhone y Android con un dictado real |
| **F5 Web de dirección** | Equipo, ficha de IPS con visitas, filtros del mapa de calor | capturas; pruebas de KPIs |

**Verificación final**: `npm run check` en cada PR (y la suite de `mobile/`); pruebas puras de subtipo por
cargo, conteo con pesos y vigencias, cuota con calendario y días libres, plazo de gracia, festivos 2026-2027,
bloqueo por radio, esquema del dictado, unicidad de médicos y cuentas; un dictado real de punta a punta;
prueba de que el audio no queda guardado; rollback de 0800 probado; nada importa `google-distance.ts`.

## 14. Decisiones

Todas tomadas por el dueño el 2026-10-12 (detalle y citas en `docs/decisiones/2026-10-12-app-de-visita.md`):

- Piloto de desarrollo en OpMap, sin Odoo ni VMO; sin pruebas piloto; el importador de VMO se deshabilita.
- App móvil nativa; voz con Whisper o similar; el audio se desecha al transcribir; confirmación breve.
- Visita médica e institucional con subtipos (compras, químico farmacéutico, autorizaciones, programación,
  otro); la facturación es un dato de la EPS.
- Todo lo que mide es configurable y **con rangos de fechas**: un cambio no reescribe el pasado.
- Valores iniciales de conteo: Compras y Autorizaciones suman a la meta institucional con peso 1; Químico
  farmacéutico, Programación y Otro, solo seguimiento.
- Calendario con festivos de Colombia, días de empresa y por ciudad; días libres antes o hasta 24 horas
  después (plazo configurable), con aprobación en bloque de la directora o recursos humanos.
- Una sola tabla de cuentas con sede principal y sedes; clínica, cliente o las dos; consultorios como IPS.
- Médicos completos o no se crean; visitantes del médico por línea y ciudad.
- Presencial bloqueada lejos de la sede; mismo día y tiempo real; telefónica por persona.
- Sin señal: la app guarda la visita con el punto y la hora del sitio y la envía sola al volver la señal,
  antes de medianoche.
- Sede nueva creada por la ejecutiva: suma al instante si trae código de habilitación del REPS que cruza con
  el municipio; si no, cuando data manager la confirma.
- Topes iniciales (configurables): una visita por médico al día; telefónicas hasta 1 de las 6 diarias, solo
  llamada o videollamada.
- Legal entrega el aviso de tratamiento de datos de médicos y contactos y revisa los términos de OpenAI y
  Anthropic, con cuentas a nombre de VG y sin uso de los datos para entrenar.
- Quien entra, sale o cambia de zona a mitad de mes se mide por sus días activos (el primer mes de alguien
  nuevo al 50 %, configurable); la cobertura de cuentas se mide sobre cuentas objetivo que marca la directora
  (por defecto las primeras por camas, quirófanos y compras SECOP).
