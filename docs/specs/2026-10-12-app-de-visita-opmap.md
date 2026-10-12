# Spec: app de visita de OpMap (reemplazo de VMO)  (2026-10-12, v2)

**Estado**: borrador v2 en revisión con el dueño (2026-10-12). La v1 asumía que "la unidad de visita es la
llegada a una IPS con sus interlocutores"; el dueño la corrigió el mismo día y esta v2 parte de su modelo:
se visitan **médicos**, **compras** de clínicas y clientes (EPS, operadores logísticos) y, aparte, se hacen
**gestiones** sobre negocios ya ganados (programación de cirugía, quirófano, cartera), que no son visitas.

Documento de referencia de VMO: `docs/referencias/2026-10-11-vmo-2026-documentacion-funcional.md`.

---

## 1. Problema

VG Medical reporta hoy la visita comercial en VMO 2026 (vmo.com.co), una plataforma hecha para laboratorios
farmacéuticos. El dueño, el 2026-10-12:

> "Es muy complejo, tiene demasiadas características que hace complejo su uso. Está pensado para los
> laboratorios y como tienen muchos clientes todo el tiempo lo están actualizando según la necesidad de
> cada cliente."

Tres cifras del recorrido de VMO del 2026-10-11: **25 módulos de configuración**, **28 reportes** y **153
solicitudes de alta y baja más unas 800 solicitudes de días sin resolver** desde agosto de 2025 (los dos
circuitos de aprobación están muertos y la cuota nunca se ajusta por ausencias).

Lo que VMO no distingue y VG necesita medir (dueño, 2026-10-12):

- **Generar demanda es visitar al médico** para que ordene el producto al paciente, y **visitar a compras**
  para que la clínica o el cliente nos compre a nosotros. Eso es una visita.
- **Gestionar un negocio ya ganado** es otra cosa: ir a hablar con la jefe que programa, con quirófano, con
  cartera, para que el paciente se opere y la venta se materialice. Es necesario, pero no es una visita, y
  hay que saber cuánto del tiempo de cada ejecutiva se va en eso ("99 % visitando a la jefe de central").
- Las metas son **por tipo de tercero** (hoy: 6 médicos y 1 institución por día) y tienen que poder
  fijarse **por zona y por ejecutiva**: a una zona pequeña no se le puede exigir lo mismo que a Bogotá.
- Las ausencias **sí se solicitan**, y quien aprueba necesita **aprobación masiva**: la directora gestiona
  cerca de 20 personas.

La base de contactos ya existe y es una sola: **Odoo**. Allí están 2.359 profesionales de la salud (1.325
ortopedistas, 192 neurocirujanos, 310 cirujanos generales, 163 fisiatras…) con especialidad, validación
ReTHUS y **ejecutiva asignada**; 516 IPS; 315 clientes; 13 EPS; y las personas de contacto de cada empresa
con su cargo (jefe de compras, programador de cirugía, coordinadora de sala de cirugía, jefe de almacén,
central de esterilización…). Odoo también lleva las **ausencias del personal** (módulo Ausencias: en 2026 van
más de 270 solicitudes aprobadas de vacaciones, citas médicas, día de familia, sufragio…), con solicitud de
la empleada y aprobación, incluida la masiva.

OpMap tiene hoy un módulo `/visits` que solo importa el Excel mensual de VMO (7.033 visitas de 2025) y lo
pinta en un mapa de calor. Esta spec lo convierte en la app de visita propia.

## 2. Principios

1. **Tres cosas distintas, tres registros**: visita a médico, visita a institución (compras) y gestión de
   negocio. La app decide cuál es según a quién se vio; la ejecutiva no puede registrar una "visita" con la
   jefe de quirófano.
2. **Odoo es el maestro de terceros**. Médicos, IPS, clientes, EPS, operadores logísticos y sus personas de
   contacto se leen de Odoo; OpMap no crea ni duplica terceros. Lo que OpMap añade es lo que sabe de cada
   IPS (REPS, compras SECOP, giros ADRES, territorio).
3. **Reportar en pocos toques o dictando**. Una hoja: ¿a quién viste?, ¿dónde?, ¿cómo fue?, ¿qué sigue? Y
   "Dictar": la ejecutiva habla, la app transcribe, propone los campos y ella confirma en un toque.
4. **Metas por tipo de tercero, por zona y por ejecutiva**, ajustadas por ausencias aprobadas. Sin "cuota
   de frecuencia" ni categorías A/B/C.
5. **Medir, no castigar.** Radio, virtual, tardía y fuera de territorio se guardan siempre y se ven como
   calidad del reporte; nada bloquea el registro.

Restricciones del repo que no se negocian: cero llamadas a Google Maps (distancias por Haversine, GPS solo
del teléfono), estética del mapa intocable, terminología visible "Ejecutivo Comercial", "Zona", "IPS",
"Médico", "Cliente", "Contacto" (nunca "KAM", "representante" ni "panel").

## 3. Resultado esperado por rol

**Ejecutiva Comercial (celular; también en escritorio)**
- Abre "Hoy": sus médicos e instituciones cerca (GPS, Haversine), cuántas visitas a médico y a institución
  lleva en el día frente a su meta, los próximos pasos vencidos y el botón "Reportar".
- Reporta en una hoja: busca al médico o a la institución (la lista prioriza lo cercano y lo asignado a
  ella), elige dónde fue (consultorio, IPS, otro lugar con GPS), presencial o virtual, efectiva o no, líneas,
  nota o dictado, próximo paso. Si la persona es de quirófano, programación, cartera o almacén, la app lo
  registra como **gestión**, con su propio tipo (programación de cirugía, acompañamiento en sala, cartera,
  entrega, capacitación, autorización, otro).
- Si el médico no tiene dirección o está en un sitio nuevo, puede **guardar su GPS como dirección del
  médico** (consultorio, IPS). Así el directorio se completa sin Google.
- Pide sus ausencias donde ya lo hace (ver decisión 2) y ve su meta ajustada.
- Ve "Mis números": médicos del mes frente a meta, instituciones frente a meta, cobertura de sus médicos
  asignados, mezcla visita/gestión, médicos sin ver en 60 días.

**Líder de línea**: tabla "Equipo" de su línea (metas, cumplimiento, cobertura, mezcla, calidad) y, en la
ficha de cada IPS, visitas y gestiones de su línea junto a compras SECOP y giros ADRES.

**Directora comercial**: todo lo anterior para todas; fija metas por zona y excepciones por ejecutiva;
aprueba ausencias en bloque (ver decisión 2); corrige visitas de días anteriores dejando rastro; lista
semanal de avisos (fuera de territorio, lejos, tardías, mezcla desbalanceada).

**Data manager**: mantiene la sincronización con Odoo (estado, errores, terceros sin cruce con IPS de OpMap),
sigue importando el Excel de VMO durante la transición, mantiene la tabla de equivalencias de nombres de VMO.

## 4. Alcance del MVP (lista cerrada)

1. **Terceros desde Odoo** (lectura, diaria y "Actualizar ahora", en el panel "Fuentes de datos"): médicos
   (nombre, especialidades, ReTHUS vigente, ciudad, ejecutiva asignada, direcciones), IPS y clientes
   (NIT, nombre, cruce con `hospitals` por NIT), EPS y operadores logísticos, y personas de contacto con
   cargo. Nunca se sincroniza la cédula de una persona ni datos de pacientes.
2. **Hoy** (celular): cercanos por GPS, contadores del día frente a meta, próximos pasos, "Reportar".
3. **Reportar visita a médico**: médico (buscador con cercanos y asignados primero), lugar (dirección
   conocida o nueva con GPS), presencial/virtual, efectiva/no efectiva con motivo, líneas, nota o dictado,
   próximo paso.
4. **Reportar visita a institución**: cliente o IPS, persona de compras o dirección (o "sin contacto"),
   mismos campos.
5. **Registrar gestión**: IPS o cliente, contacto (quirófano, programación, esterilización, almacén,
   cartera, facturación, autorizaciones), tipo de gestión, nota o dictado, próximo paso. Cuenta aparte.
6. **Dictar** (voz) en los tres registros: graba, transcribe en el navegador, propone campos con la API de
   Claude, confirmación en un toque; audio y transcripción guardados.
7. **Guardar GPS como dirección** del médico o del contacto (propuesta a Odoo: se escribe en OpMap y se
   envía a Odoo como dirección nueva del tercero, si el dueño lo autoriza; si no, queda solo en OpMap).
8. **Mis números** y **Equipo** (escritorio): 6 KPIs (sección 6), filtros por mes, línea y zona, CSV.
9. **Metas**: por zona (valor por defecto) y por ejecutiva (excepción), para médicos/día e instituciones/día;
   "copiar del mes anterior".
10. **Ausencias**: lectura de las aprobadas (decisión 2) y ajuste de la meta; la directora ve pendientes y
    aprueba en bloque desde donde se decida.
11. **Ficha de IPS**: pestaña "Visitas y gestiones" junto a compras SECOP y giros ADRES.
12. **Mapa de calor existente**: filtro de fuente (App | VMO histórico), tipo (médico | institución |
    gestión) y ejecutiva. Sin capas, marcadores ni colores nuevos.
13. **Convivencia con VMO**: importador conservado y corregido (no borra visitas de la app), equivalencias
    de nombres, marca de sistema por ejecutiva.

### Después del MVP
Modo sin señal (PWA), "Mi semana" (repartir pendientes en los días), vínculo de cada gestión con el caso de
paciente de Odoo (GCP) para cerrar gestión → cirugía → venta, ventas de Odoo por médico, priorización
automática de a quién visitar, visitas en el mapa por ejecutiva (requiere autorización: estética del mapa).

### Qué se conserva de VMO y qué se descarta

| Se conserva | Cómo queda |
| --- | --- |
| Visita a médico y a institución con GPS, presencial o virtual, efectiva o no con motivo | Igual, en una hoja; la virtual no valida ubicación y se mide aparte |
| Metas por tipo de tercero (hoy 6 médicos + 1 institución al día) | Metas por zona y por ejecutiva, ajustadas por ausencias aprobadas |
| Solicitud y aprobación de ausencias | Se conserva, con aprobación masiva (decisión 2) |
| Médicos con varias direcciones | Direcciones de Odoo más las que la ejecutiva guarde con GPS |
| Reportar sin agendar; reportar el mismo día | Igual; el día siguiente queda "tardío"; después solo dirección |
| Supervisores ven el equipo | Dirección todo; líder solo su línea |
| Exportar CSV | Visitas, gestiones y tabla Equipo |

| Se descarta | Por qué |
| --- | --- |
| Frecuencia 10 por médico, categorías A/B/C, "cumplimiento de frecuencia" | Da 3,5 % y no gestiona; las metas son por tipo de tercero y por persona |
| Operaciones de altas, bajas, reasignaciones | El maestro es Odoo; 153 pendientes muestran que la bandeja no se usa |
| Material y muestras, inventario, parrilla, ayudas visuales, productos por marca | Vacíos hoy y ajenos a implantes; las líneas ya son el catálogo |
| Agenda a 30 días en medias horas, ruteros, "visita rápida" aparte | Cabe en "Hoy" y, después, en "Mi semana" |
| Farmacias, pacientes, farmacovigilancia, cartera de crédito, transferencia de valor, cumpleaños, e-learning, cronómetro | No son el negocio de VG; pacientes y cartera viven en Odoo |
| 28 reportes y 25 módulos de configuración | 6 KPIs, metas y un radio único |
| Ubicación en tiempo real cada 5 minutos | Solo GPS al reportar |
| Comentario obligatorio, tope duro de virtuales | Castigan; se miden como calidad |

## 5. Modelo de datos

### Qué se reutiliza tal cual
`hospitals` (IPS con REPS, servicios, capacidad, SECOP, ADRES), `executives` (+ `odoo_employee_id`, ya
existe), `executive_lines`, `business_lines`, `kams` (zonas), `territory_snapshots` (Anexo A),
`fuentes_estado`, `visits` y `visit_imports` (se amplían, no se reemplazan).

### Terceros (espejo de Odoo, solo lectura; RLS sin políticas, solo `service_role`)

| Tabla | Columnas clave | Origen en Odoo |
| --- | --- | --- |
| `terceros` | `odoo_id` PK, `tipo` CHECK ('medico' \| 'ips' \| 'cliente' \| 'eps' \| 'operador_logistico' \| 'otro'), `nombre`, `nit` (solo empresas), `hospital_id` FK `hospitals` (cruce por NIT y sede), `especialidades` text[], `rethus_vigente` bool, `prescribe` bool, `ciudad`, `executive_id` FK (desde `user_id` de Odoo → `executives`), `activo`, `odoo_write_date`, `synced_at` | `res.partner`: `health_professional`, `health_provider_institution`, `customer`, `health_insurance_provider`, tags, `specialization_ids`, `rethus_status`, `user_id`, `vat` (solo `is_company`) |
| `tercero_contactos` | `odoo_id` PK, `tercero_id` FK, `nombre`, `cargo_texto` (como está en Odoo), `rol` CHECK ('compras' \| 'direccion' \| 'direccion_medica' \| 'programacion_quirofano' \| 'esterilizacion' \| 'instrumentacion' \| 'almacen_farmacia' \| 'cartera_facturacion' \| 'autorizaciones' \| 'otro') normalizado por reglas desde `cargo_texto` (editable en OpMap) | personas con `parent_id` y `function` |
| `tercero_direcciones` | `id`, `tercero_id`, `odoo_id` NULL, `etiqueta` ('consultorio' \| 'ips' \| 'sede' \| 'otra'), `hospital_id` NULL, `direccion`, `ciudad`, `lat`, `lng`, `origen` ('odoo' \| 'gps_visita'), `created_by` | dirección principal y contactos tipo `delivery`/`other`; las de `gps_visita` las crea la ejecutiva |

Lo que **no** se sincroniza: cédula ni documento de personas, pacientes (`patient`), pagarés, cartera,
datos de afiliación. El cruce IPS ↔ `hospitals` es por NIT (9 dígitos) y, si hay varias sedes, por la sede
REPS vinculada; lo que no cruce aparece en "Fuentes de datos" para resolver a mano.

### Registros de la app

**`visits` (existente) — columnas nuevas**: `source` ('vmo_import' | 'app'), `executive_id`, `client_id`
UNIQUE (idempotencia), `kind` CHECK ('medico' | 'institucion' | 'gestion'), `tercero_id` FK `terceros`
NULL, `contacto_id` FK `tercero_contactos` NULL, `direccion_id` FK `tercero_direcciones` NULL, `place_name`
(lugar no listado), `gestion_tipo` CHECK ('programacion_cirugia' | 'acompanamiento_sala' | 'entrega' |
'cartera' | 'capacitacion' | 'autorizacion' | 'otro') NULL, `checked_in_at`, `distance_m`,
`gps_accuracy_m`, `failure_reason` ('no_estaba' | 'no_atendio' | 'cerrado' | 'reprogramada'),
`retry_date`, `note`, `transcript`, `audio_path`, `input_mode` ('toques' | 'voz' | 'importada'),
`next_step`, `next_step_date`, `out_of_territory`, `reported_late`, `created_by`, `updated_by`,
`updated_at`, `deleted_at`. `hospital_id` sigue siendo la IPS donde ocurrió (si aplica).
`visit_type` ('Visita efectiva' | 'Visita no efectiva') y `contact_type` ('Visita presencial' | 'Visita
virtual') conservan sus valores para no romper el mapa de calor ni el histórico.

CHECKs: `kind='medico'` exige `tercero_id` de tipo médico; `kind='institucion'` exige tercero IPS/cliente/EPS/
operador; `kind='gestion'` exige `gestion_tipo`; presencial de la app exige `lat/lng`. `visit_lines`
(`visit_id`, `line_id`) para las líneas tratadas.

| Tabla | Columnas clave | Para qué |
| --- | --- | --- |
| `metas` | `scope` ('zona' \| 'ejecutiva'), `kam_id` NULL, `executive_id` NULL, `year`, `month`, `medicos_por_dia` numeric, `instituciones_por_dia` numeric, `set_by`; UNIQUE por ámbito y mes | Meta diaria por tipo; la de ejecutiva manda sobre la de su zona |
| `ausencias` | `executive_id`, `fecha`, `fraccion` (1 \| 0,5), `motivo`, `origen` ('odoo' \| 'opmap'), `odoo_leave_id` NULL, `estado` ('pendiente' \| 'aprobada' \| 'rechazada'), `aprobada_por`, `aprobada_at` | Ajuste de la meta; ver decisión 2 |
| `company_calendar_exceptions` | `date` PK, `kind` ('non_working' \| 'working'), `label` | Días de empresa; los festivos nacionales van en código (`holidays.ts`) |
| `vmo_representantes` | `vmo_name` PK, `executive_id`, `kam_id`, vigencia | Equivalencias para el importador y el histórico |

Columna nueva en `executives`: `visits_source` ('vmo' | 'app').

Migración `2026-10-XX_0800_visitas_app.sql` con rollback `9940`, escrita en la Fase 1 y aplicada solo con
autorización del dueño en la misma ventana que el código. Incluye el backfill del histórico de VMO
(`source='vmo_import'`, `kind` según la columna de tipo de panel del Excel si existe; si no, 'institucion').

## 6. KPIs (6)

| # | KPI | Fórmula | Datos |
| --- | --- | --- | --- |
| 1 | **Cumplimiento de metas** (médicos y instituciones, por ejecutiva, mes) | visitas efectivas del tipo ÷ (meta diaria × días hábiles − ausencias aprobadas) y ritmo esperado = hábiles transcurridos ÷ hábiles del mes | `visits.kind`, `metas`, `ausencias`, `holidays.ts` |
| 2 | **Cobertura** | médicos asignados a la ejecutiva (Odoo) con ≥ 1 visita efectiva en el trimestre ÷ asignados; IPS del Anexo A con ≥ 1 visita a compras en el mes ÷ Anexo A | `terceros.executive_id`, `territory_snapshots` |
| 3 | **Mezcla visita / gestión** | registros de gestión ÷ (visitas + gestiones), por ejecutiva y mes, con alerta configurable (p. ej. > 50 %) | `visits.kind` |
| 4 | **Sin contacto reciente** | médicos asignados sin visita efectiva en 60 días e IPS del Anexo A sin visita a compras en 90 días, ordenados por camas, quirófanos y compras SECOP de la línea | `visits`, `hospitals`, SECOP |
| 5 | **Calidad del reporte** | % virtual, % presenciales a > 500 m, % tardías, % fuera de territorio (avisos, no castigos) | `visits` |
| 6 | **Visita → resultado** | IPS del Anexo A visitadas en el trimestre frente a compras SECOP de la línea y giros ADRES: "visitadas sin compra" y "compran sin visita"; después del MVP, médicos visitados frente a casos de paciente en Odoo | `visits`, `secop_contratos`, giros ADRES, Odoo |

## 7. Reglas de negocio no deducibles del código

**Qué es visita y qué es gestión**
- Visita a médico: tercero de tipo médico, en cualquiera de sus direcciones (consultorio, IPS) o en un
  lugar nuevo con GPS. Cuenta para "médicos/día".
- Visita a institución: IPS, cliente, EPS u operador logístico, con un contacto de rol compras, dirección,
  dirección médica (o sin contacto). Cuenta para "instituciones/día".
- Gestión: contacto de rol programación/quirófano, esterilización, instrumentación, almacén/farmacia,
  cartera/facturación o autorizaciones, o cualquier registro marcado "gestión". **No cuenta como visita**;
  se mide en el KPI 3 y en su propia lista. Si la ejecutiva elige un contacto de esos roles, la app pasa el
  registro a gestión y lo dice en pantalla.
- Una misma llegada a una clínica puede dejar dos registros (visita a compras y gestión con programación):
  son dos cosas y se miden aparte.
- Solo la visita efectiva suma a metas y cobertura; la no efectiva se guarda con motivo.

**Terceros**
- OpMap no crea médicos, IPS ni clientes: si falta uno, se crea en Odoo (quien tenga permiso) y aparece en
  la siguiente sincronización. "Lugar no listado" solo guarda nombre y GPS en el registro.
- La ejecutiva ve primero sus médicos asignados y las IPS de su Anexo A, pero puede visitar cualquier
  tercero: el registro queda `out_of_territory` y cuenta en metas, no en cobertura.
- La dirección nueva con GPS se guarda como `gps_visita` y queda como propuesta para Odoo (decisión 1).

**GPS y radio**: presencial exige GPS al reportar (`enableHighAccuracy`, 15 s); radio único de 500 m que
solo avisa; sin coordenadas conocidas del lugar no hay alerta; ninguna captura fuera del toque de reportar.

**Virtual**: sin GPS; cuenta igual para metas; se vigila en el KPI 5. Sin nota obligatoria ni tope.

**Plazo**: la fecha válida es la del teléfono al reportar; mismo día; hasta las 23:59 del siguiente queda
`reported_late`; después solo dirección (`updated_by`).

**Metas y ausencias**
- Meta diaria por tipo (médicos, instituciones) por zona, con excepción por ejecutiva; nunca 0 para una
  ejecutiva activa; las vacantes no se miden.
- Días hábiles = lunes a viernes menos festivos de Colombia (código) menos `company_calendar_exceptions`.
- Ausencia aprobada descuenta `fraccion` de día de la meta del mes. La solicitud la hace la ejecutiva y la
  aprueba la directora, en bloque (decisión 2).

**Reporte por voz**: igual que en v1: transcripción en el navegador, campos propuestos con la API de Claude
contra el esquema de la visita (tipo de registro, tercero por nombre con búsqueda en `terceros`, contacto,
líneas, resultado, próximo paso), confirmación obligatoria, audio 12 meses en bucket privado, texto en
`transcript`. Si el dictado menciona un médico que no está en Odoo, la app lo dice y ofrece "lugar/persona
no listada" sin crear el tercero.

**Quién edita qué**: la ejecutiva sus registros del mismo día; dirección cualquier registro con rastro; el
líder de línea ve su línea; data manager sincroniza e importa. Las ejecutivas no ven los registros de sus
compañeras.

**Privacidad**: nunca cédula ni documento de personas en OpMap; nada de pacientes. Los nombres de médicos y
contactos vienen de Odoo, que ya los trata con su política; el audio y la transcripción son internos.

## 8. Migración y convivencia con VMO

- Arreglos previos verificados (Fase 0): `web/next.config.js` línea 8 bloquea GPS y micrófono
  (`geolocation=(self), microphone=(self)`); `web/app/api/visits/import/route.ts` líneas 82-86 borra todas
  las visitas del mes sin filtrar por fuente (`WHERE source='vmo_import'`).
- Sincronización de terceros desde Odoo antes del piloto; las 11 ejecutivas con cuenta enlazada
  (`executives.user_id`) y empleado de Odoo (`odoo_employee_id`).
- Histórico de VMO conservado con `source='vmo_import'`; `executive_id` por `vmo_representantes`.
- Piloto con 2 ejecutivas un mes; corte con última importación del Excel; fecha en `docs/decisiones/`.

## 9. Criterios de aceptación

- [ ] Dado un contacto de Odoo con cargo "Programador de cirugía", cuando la ejecutiva lo elige, entonces el
      registro queda `kind='gestion'`, no suma a metas y aparece en la lista de gestiones.
- [ ] Dado un contacto con cargo "Jefe de Compras" de una IPS, cuando se reporta efectiva, entonces suma 1 a
      "instituciones" del día y a la cobertura del Anexo A si la IPS está en él.
- [ ] Dado un médico asignado a otra ejecutiva, cuando la ejecutiva lo visita, entonces se guarda, suma a su
      meta de médicos, queda `out_of_territory` y no suma a su cobertura.
- [ ] Dado una meta de zona de 6 médicos y 1 institución, y una excepción de 4 y 1 para una ejecutiva, cuando
      se calculan sus números, entonces manda la excepción.
- [ ] Dado 20 días hábiles, 2 ausencias aprobadas y meta de 6 médicos/día, entonces la meta ajustada del mes
      es 108 y el ritmo esperado al día hábil 10 es 50 %.
- [ ] Dado la sincronización de Odoo, cuando corre, entonces ningún campo de documento de persona ni
      registro con `patient=true` llega a OpMap (prueba del mapeo puro).
- [ ] Dado una IPS de Odoo con NIT 800014918, cuando se sincroniza, entonces queda cruzada con la sede de
      `hospitals` del mismo NIT (y si hay varias, con la sede REPS vinculada o sin cruce con aviso).
- [ ] Dado "Guardar GPS como dirección", cuando se confirma, entonces existe una fila en
      `tercero_direcciones` con `origen='gps_visita'` y la próxima visita a ese médico la ofrece como lugar.
- [ ] Dado la transcripción "estuve con el doctor Pérez en su consultorio, le mostré PerOssal, quiere
      cotización el martes", cuando se pide la propuesta, entonces la función pura devuelve `kind='medico'`,
      candidato "Pérez" buscado en `terceros`, línea PerOssal, efectiva, próximo paso "cotización" el martes;
      y nada se guarda sin confirmación.
- [ ] Dado una visita presencial a 800 m, cuando se guarda, entonces se guarda con aviso, sin bloqueo.
- [ ] Dado el mismo `client_id` dos veces, entonces hay una sola fila.
- [ ] Dado una visita de la app en octubre y una importación de VMO de octubre, entonces la visita de la app
      sigue existiendo.
- [ ] Dado un líder de línea, cuando abre "Equipo" o llama a la API, entonces solo ve su línea; `viewer`
      recibe 403.

## 10. Fuera de alcance, impacto, plan y verificación

**Fuera de alcance**: modo sin señal, "Mi semana", vínculo con casos de paciente (GCP) de Odoo, ventas por
médico, priorización automática, crear terceros desde OpMap, app nativa, cualquier módulo descartado de VMO,
cambios de estética del mapa, llamadas a Google.

**Impacto**: migración 0800 + rollback 9940 (escritas en Fase 1, aplicadas con autorización); Google 0 USD;
dictado del orden de 0,001 USD por visita con `ANTHROPIC_API_KEY` en Vercel (la crea el dueño); Odoo solo
lectura con la cuenta de integración que ya usa el MCP (más escritura de direcciones si se aprueba la
decisión 1); estética del mapa sin cambios; permisos nuevos `visits:report`, `visits:team`, `visits:targets`;
las ejecutivas necesitan cuenta `sales_manager` enlazada.

| Fase | Entrega | Evidencia |
| --- | --- | --- |
| **F0 Decisiones y prerrequisitos** | Respuestas del dueño en `docs/decisiones/`; `Permissions-Policy`; importador por fuente; cuentas enlazadas | `npm run check`; prueba del importador |
| **F1 Terceros desde Odoo** | `web/lib/odoo-terceros.ts` (mapeo puro, con pruebas), sincronización en "Fuentes de datos", cruce con `hospitals`, roles de contacto por reglas | `odoo-terceros-check.ts`; conteos antes/después |
| **F2 Modelo y reglas** | Migración 0800 + rollback; `holidays.ts`; `visits-rules.ts` (tipo de registro por rol, metas ajustadas, Haversine, tardía, fuera de territorio) | `visits-check.ts` puro |
| **F3 API y permisos** | `/api/me/*` (terceros cercanos, registros idempotentes, propuesta por voz), `/api/visits/{team,metas,ausencias}`, alcance por rol | pruebas de alcance |
| **F4 Piloto de campo** | "Hoy" y hoja de reporte (médico, institución, gestión, dictado, GPS como dirección); migración aplicada; 2 ejecutivas | capturas en celular (Android e iOS) y escritorio |
| **F5 Números, equipo, metas, ficha, mapa** | "Mis números", "Equipo", "Metas", ausencias, pestaña en la ficha de IPS, filtros del mapa de calor | capturas; pruebas de KPIs |
| **F6 Corte de VMO** | Última importación; todas en 'app'; nota de decisión | conteo por fuente |

**Verificación final**: `npm run check` en cada PR; pruebas puras de mapeo de Odoo, tipo de registro por
rol, metas ajustadas, festivos 2026-2027, Haversine con nulos, idempotencia, esquema del dictado; capturas en
celular real de Hoy, reporte a médico, a institución, gestión y dictado; prueba de convivencia con el
importador; rollback de 0800 probado antes de producción; ninguna línea nueva importa `google-distance.ts`.

## 11. Decisiones que debe tomar el dueño

| # | Pregunta | Recomendación |
| --- | --- | --- |
| 1 | ¿**Odoo es el maestro de terceros** (médicos con su ejecutiva asignada, IPS, clientes, EPS, operadores, contactos con cargo) y OpMap solo lo lee? ¿Y las direcciones nuevas con GPS se devuelven a Odoo? | **Sí a lo primero**; lo segundo también, como dirección adicional del tercero, para que la base única siga siendo única. |
| 2 | ¿Las **ausencias** se piden y aprueban en el módulo Ausencias de Odoo (ya en uso en 2026, con aprobación masiva) y OpMap solo lee las aprobadas para ajustar la meta? ¿O se hacen en OpMap con su propia bandeja y aprobación en bloque? | **Odoo.** Ya existe, ya lo usan y evita dos sitios para lo mismo; OpMap muestra a la directora las pendientes con enlace. Si prefieres todo en OpMap, se hace la bandeja con selección múltiple. |
| 3 | ¿Qué **cargos cuentan como visita a institución** y cuáles como **gestión**? Propuesta: institución = compras, gerencia o dirección, dirección médica o científica, jefe de almacén o farmacia cuando decide la compra; gestión = programación o quirófano, esterilización, instrumentación, cartera o facturación, autorizaciones. | **Sí**, con la lista editable en OpMap por la directora (los cargos de Odoo vienen en texto libre y se normalizan por reglas). |
| 4 | ¿Las **metas** se fijan por zona con excepción por ejecutiva, en médicos/día e instituciones/día (hoy 6 y 1)? | **Sí.** Mes a mes, con "copiar del anterior". |
| 5 | ¿Las **gestiones** tienen meta o solo se miden (número por día y mezcla frente a visitas, con alerta)? | **Solo medir** en el MVP; cuando haya dos meses de datos se decide si se limitan. |
| 6 | ¿**EPS y operadores logísticos** cuentan como instituciones (meta de 1/día) y entran en la cobertura? | **Cuentan como instituciones**, pero no en la cobertura del Anexo A (que es de IPS); se listan aparte. |
| 7 | ¿**Más de 500 m** solo advierte; plazo del mismo día con el siguiente "tardío"; ejecutivas no ven a sus compañeras; líder solo su línea? | **Sí** a todo. |
| 8 | ¿**Piloto** con 2 ejecutivas un mes en producción y fecha de corte con última importación de VMO? | **Sí.** |
| 9 | ¿**Dictado** con transcripción en el navegador, campos con la API de Claude y audio 12 meses en bucket privado? | **Sí.** |

Las respuestas van a `docs/decisiones/2026-10-XX-app-de-visita.md` y la spec pasa a "aprobada por el dueño"
antes de abrir la Fase 0.
