# Spec: app de visita de OpMap (reemplazo de VMO)  (2026-10-12, v3)

**Estado**: borrador v3 en revisión con el dueño (2026-10-12). Cambios respecto a v2, por instrucción del
dueño: **app móvil nativa** (no navegador), **reporte por voz como camino principal** (Whisper o similar +
confirmación breve), **bloqueo por distancia** (presencial solo cerca del lugar; si no, telefónica si la
persona la tiene habilitada), **mismo día y en tiempo real**, **consultorios como direcciones de los
médicos**, metas por tipo de tercero calculadas por el sistema con días hábiles y ausencias, y usuario de
**recursos humanos** para las ausencias.

Documento de referencia de VMO: `docs/referencias/2026-10-11-vmo-2026-documentacion-funcional.md`.

---

## 1. Problema

VG Medical reporta hoy la visita comercial en VMO 2026, una plataforma hecha para laboratorios farmacéuticos:
25 módulos de configuración, 28 reportes, 153 solicitudes de panel y unas 800 de días sin resolver. El dueño
(2026-10-12): "es muy complejo… está pensado para los laboratorios". Y sobre la gente: "son muy reacios a
hacer estos reportes, todos lo ven como un problema; coger formularios y comenzar a seleccionar, escribir,
les parece fastidioso, les quita el tiempo. Tiene que ser algo muy, muy sencillo".

Lo que VG necesita y VMO no distingue (dueño, 2026-10-12):

- **Generar demanda es visitar al médico** (para que ordene el producto al paciente) **y a compras** (para
  que la clínica o el cliente nos compre). Eso es una visita.
- **Gestionar un negocio ya ganado** (jefe que programa, quirófano, cartera: que el paciente se opere) es
  otra cosa. No es visita y hay que medir cuánto tiempo se va en eso.
- **Metas por tipo de tercero** (hoy: 6 médicos y 1 institución al día; "institución" = visitar a la jefe de
  compras), por día o por semana, configurables por zona y por ejecutiva. El sistema calcula la cuota del
  mes con los días hábiles menos permisos.
- Las **ausencias** se solicitan y se aprueban (la directora, o un usuario de recursos humanos), con
  aprobación masiva.
- La base de contactos es una y es **Odoo**: 2.359 médicos (1.325 ortopedistas, 192 neurocirujanos…) con
  especialidad, ReTHUS y ejecutiva asignada; 516 IPS; 315 clientes; EPS; personas de contacto con cargo.
- Las IPS de OpMap nacieron como **puntos de interés** para repartir zonas y encontrar médicos; los
  **consultorios** no están y hay que tenerlos como direcciones donde se visita al médico.

## 2. Principios

1. **La voz primero.** La ejecutiva sale de la visita, pulsa un botón, dice qué pasó; la app transcribe,
   entiende y le muestra una confirmación de tres líneas: a quién, conclusión, compromisos y próxima
   reunión. Un toque y listo. Los formularios existen solo como respaldo.
2. **App móvil nativa** (iOS y Android), con GPS, micrófono y guardado en tiempo real con internet.
3. **Tres registros**: visita a médico, visita a institución (compras) y gestión. La app decide cuál por a
   quién se vio.
4. **Odoo es el maestro de terceros**; OpMap añade lo que sabe de cada IPS y guarda las direcciones nuevas.
5. **Metas por tipo**, por zona y por ejecutiva; la cuota del periodo la calcula el sistema.
6. **Presencial solo en el sitio y el mismo día.** Lejos del lugar no se puede reportar presencial: queda
   la telefónica, si la persona la tiene habilitada, y se evalúa aparte.

Restricciones del repo: cero Google Maps (GPS del teléfono, distancias por Haversine), estética del mapa
intocable, terminología visible "Ejecutivo Comercial", "Zona", "IPS", "Médico", "Cliente", "Institución",
"Contacto" (nunca "KAM", "representante" ni "panel").

## 3. Resultado esperado por rol

**Ejecutiva Comercial (app móvil)**
- Abre la app y ve "Hoy": cuántas visitas a médico y a institución lleva frente a su meta del día, los
  compromisos vencidos y un botón grande **"Reportar"**.
- Pulsa "Reportar" y habla: "Estuve con el doctor Pérez en su consultorio, le mostré PerOssal y reemplazo,
  quedó de mandarme un caso la otra semana; también pasé por compras con la jefe Marta, van a cotizar". La
  app transcribe, identifica al médico y a la institución en Odoo, y muestra:
  > ¿Confirmas? **Dr. Pérez** (ortopedista) · hoy 10:42 · Consultorio Pérez · PerOssal, Reemplazo ·
  > Conclusión: enviará un caso · Compromiso: la otra semana · Próxima reunión: sin programar → ¿programar?
  > **Compras · Clínica X** · jefe Marta · cotización · gestión.
  Confirma, corrige un dato o dice "corrige: era neurocirujano". Dos registros guardados.
- Si la app no está segura (dos médicos con el mismo apellido, nadie cerca), pregunta solo eso.
- Presencial solo si el GPS está a menos del radio de un lugar conocido del tercero (consultorio, IPS,
  sede). Si está lejos, la app lo dice y ofrece "telefónica" si su perfil la permite, o "guardar este
  punto como dirección nueva del médico" cuando es un consultorio que no estaba.
- Pide ausencias desde la app y ve su meta ajustada.
- "Mis números": médicos e instituciones frente a meta, cobertura de sus médicos asignados, mezcla
  visita/gestión, médicos sin ver en 60 días.

**Directora comercial y recursos humanos (web)**: metas por zona y excepciones por persona; bandeja de
ausencias con aprobación en bloque; avisos semanales; corrección de registros con rastro.

**Líder de línea (web)**: tabla "Equipo" de su línea; en la ficha de cada IPS, visitas y gestiones de su
línea junto a compras SECOP y giros ADRES.

**Data manager (web)**: sincronización con Odoo, equivalencias de VMO, terceros sin cruce.

## 4. Alcance del MVP (lista cerrada)

1. **App móvil** (Expo / React Native, TypeScript, misma API de OpMap): inicio de sesión con la cuenta de
   OpMap, GPS, micrófono, guardado en tiempo real. Distribución por TestFlight y Play (pruebas internas) en
   el piloto; tiendas después.
2. **Reporte por voz**: grabación → transcripción en el servidor (API de OpenAI, modelo
   `gpt-4o-transcribe` o `whisper-1`, español) → extracción de campos con la API de Claude contra el
   esquema del registro → tarjeta de confirmación breve → un toque. Puede salir más de un registro de un
   solo dictado (médico + compras + gestión). Nada se guarda sin confirmar. Audio 12 meses en bucket
   privado; transcripción con el registro.
3. **Reporte por toques** (respaldo): a quién, dónde, cómo fue, líneas, nota, próximo paso.
4. **Terceros desde Odoo** (lectura diaria y "Actualizar ahora"): médicos, IPS, clientes, EPS, operadores
   logísticos, contactos con cargo, direcciones. Nunca cédulas ni pacientes.
5. **Direcciones**: las de Odoo más las que la ejecutiva guarda con GPS (consultorio nuevo, IPS donde
   atiende). Los consultorios viven como direcciones del médico (sección 5).
6. **Tipo de registro por rol del contacto**: compras, gerencia, dirección médica → institución; médico →
   médico; programación, quirófano, esterilización, instrumentación, almacén, cartera, autorizaciones →
   gestión (lista editable por la directora).
7. **Radio con bloqueo**: presencial solo a menos de N metros (500 por defecto, único) de un lugar conocido
   del tercero. Lejos: telefónica si está habilitada para esa persona, o "dirección nueva" si es un
   consultorio.
8. **Metas**: por zona y por ejecutiva, en médicos e instituciones por día o por semana; el sistema calcula
   la cuota del mes = meta × días hábiles − ausencias aprobadas.
9. **Ausencias**: solicitud desde la app; bandeja web con selección múltiple y aprobación en bloque para
   directora y recursos humanos; lectura opcional de las aprobadas en Odoo (decisión 2).
10. **Hoy, Mis números, Equipo, Metas, ficha de IPS, filtros del mapa de calor** (sin capas nuevas).
11. **Convivencia con VMO**: importador corregido (no borra visitas de la app), equivalencias, marca de
    sistema por ejecutiva.

### Después del MVP
Modo sin señal (cola local), "Mi semana", vínculo de gestiones con casos de paciente de Odoo (GCP),
ventas por médico, priorización automática, lectura de la confirmación en voz alta, visitas en el mapa
(requiere autorización: estética).

### Qué se conserva de VMO y qué se descarta

| Se conserva | Cómo queda |
| --- | --- |
| Visita a médico e institución con GPS; presencial o telefónica; efectiva o no con motivo | Igual, por voz o toques; la telefónica se habilita por persona y se evalúa aparte |
| Metas por tipo (6 médicos + 1 institución al día) y cuota del periodo con días hábiles | Por zona y ejecutiva, día o semana; el sistema calcula y descuenta ausencias |
| Solicitud y aprobación de ausencias | Se conserva, con aprobación masiva, directora o recursos humanos |
| Médicos con varias direcciones | Direcciones de Odoo más consultorios guardados con GPS |
| Reporte el mismo día | Mismo día y en el sitio, en tiempo real |
| Supervisores ven el equipo | Dirección todo; líder solo su línea |
| App móvil | Nativa, con voz |

| Se descarta | Por qué |
| --- | --- |
| Frecuencia 10 por médico, categorías A/B/C, "cumplimiento de frecuencia" | Da 3,5 %; las metas son por tipo y por persona |
| Operaciones (altas, bajas, reasignaciones) | El maestro es Odoo |
| Material, muestras, inventario, parrilla, ayudas visuales | Vacíos y ajenos a implantes |
| Agenda en medias horas, ruteros, "visita rápida" aparte | Cabe en "Hoy" y, después, "Mi semana" |
| Farmacias, pacientes, farmacovigilancia, cartera, transferencia de valor, cumpleaños, e-learning | No son el negocio; pacientes y cartera viven en Odoo |
| 28 reportes, 25 módulos | 6 KPIs, metas y un radio único |
| Formularios de varias pestañas | La voz y una tarjeta de confirmación |

## 5. Modelo de datos

### Decisión sobre IPS, médicos y consultorios (pregunta del dueño)

- `hospitals` **sigue siendo la tabla de IPS** (sedes REPS): puntos de interés que reparten zonas, mueven el
  algoritmo de asignación, el territorio y el gasto en Google. No se le meten consultorios.
- Los **médicos** son terceros (espejo de Odoo) y los **consultorios son direcciones del médico** en
  `tercero_direcciones` (`etiqueta = 'consultorio'`), con GPS. Si el consultorio es a la vez una sede
  habilitada en el REPS (profesional independiente o IPS pequeña), la dirección puede apuntar a esa sede
  (`reps_code`), pero no hace falta para visitar. Así un médico puede tener su consultorio, dos clínicas
  donde opera y un lugar nuevo que la ejecutiva guardó ayer, y ninguno contamina las zonas ni el mapa.
- Razón: las direcciones de médicos son muchas, cambian y se capturan con GPS; las IPS son pocas, estables
  y vienen del REPS. Mezclarlas en `hospitals` rompería asignación, territorio y la regla de "una IPS = una
  sede REPS".

### Qué se reutiliza tal cual
`hospitals`, `executives` (+ `odoo_employee_id`), `executive_lines`, `business_lines`, `kams`,
`territory_snapshots`, `fuentes_estado`, `visits` y `visit_imports` (se amplían).

### Terceros (espejo de Odoo, solo lectura; RLS sin políticas, solo `service_role`)

| Tabla | Columnas clave | Origen en Odoo |
| --- | --- | --- |
| `terceros` | `odoo_id` PK, `tipo` ('medico' \| 'ips' \| 'cliente' \| 'eps' \| 'operador_logistico' \| 'otro'), `roles` text[] (una clínica puede ser `ips` y `cliente`), `nombre`, `nit` (solo empresas), `hospital_id` FK (cruce por NIT y sede), `especialidades` text[], `rethus_vigente`, `prescribe`, `ciudad`, `executive_id` FK (desde `user_id` de Odoo), `activo`, `odoo_write_date`, `synced_at` | `res.partner`: `health_professional`, `health_provider_institution`, `customer`, `health_insurance_provider`, tags, `specialization_ids`, `rethus_status`, `user_id`, `vat` solo si `is_company` |
| `tercero_contactos` | `odoo_id` PK, `tercero_id`, `nombre`, `cargo_texto`, `rol` ('compras' \| 'direccion' \| 'direccion_medica' \| 'programacion_quirofano' \| 'esterilizacion' \| 'instrumentacion' \| 'almacen_farmacia' \| 'cartera_facturacion' \| 'autorizaciones' \| 'otro') por reglas, editable | personas con `parent_id` y `function` |
| `tercero_direcciones` | `id`, `tercero_id`, `odoo_id` NULL, `etiqueta` ('consultorio' \| 'ips' \| 'sede' \| 'otra'), `hospital_id` NULL, `reps_code` NULL, `direccion`, `ciudad`, `lat`, `lng`, `origen` ('odoo' \| 'gps_visita'), `created_by`, `enviada_a_odoo_at` NULL | dirección principal y contactos `delivery`/`other`; las de `gps_visita` las crea la ejecutiva |

No se sincroniza: cédula ni documento de personas, pacientes, pagarés, cartera, afiliación.

### Registros

**`visits` (existente) — columnas nuevas**: `source` ('vmo_import' | 'app'), `executive_id`, `client_id`
UNIQUE, `kind` ('medico' | 'institucion' | 'gestion'), `tercero_id`, `contacto_id`, `direccion_id`,
`place_name`, `gestion_tipo` ('programacion_cirugia' | 'acompanamiento_sala' | 'entrega' | 'cartera' |
'capacitacion' | 'autorizacion' | 'otro'), `checked_in_at`, `distance_m`, `gps_accuracy_m`,
`failure_reason`, `retry_date`, `conclusion` (texto corto), `compromisos` (texto), `next_step_date`,
`transcript`, `audio_path`, `input_mode` ('voz' | 'toques' | 'importada'), `out_of_territory`,
`created_by`, `updated_by`, `updated_at`, `deleted_at`. `visit_type` y `contact_type` conservan sus valores
('Visita efectiva' | 'Visita no efectiva'; 'Visita presencial' | 'Visita virtual' = telefónica).
`visit_lines` (`visit_id`, `line_id`).

CHECKs: presencial de la app exige `lat/lng`, `direccion_id` o `hospital_id` y `distance_m <= radio`
(la API rechaza si no); `kind` coherente con el tipo de tercero y el rol del contacto; `kind='gestion'`
exige `gestion_tipo`.

| Tabla | Columnas clave | Para qué |
| --- | --- | --- |
| `metas` | `scope` ('zona' \| 'ejecutiva'), `kam_id` NULL, `executive_id` NULL, `vigente_desde` date, `periodo` ('dia' \| 'semana'), `medicos` numeric, `instituciones` numeric, `set_by` | La de ejecutiva manda sobre la de su zona; el sistema calcula la cuota del mes |
| `ausencias` | `executive_id`, `fecha`, `fraccion` (1 \| 0,5), `motivo` ('vacaciones' \| 'incapacidad' \| 'cita_medica' \| 'capacitacion' \| 'congreso' \| 'administrativo' \| 'otro'), `estado` ('pendiente' \| 'aprobada' \| 'rechazada'), `solicitada_por`, `aprobada_por`, `aprobada_at`, `origen` ('opmap' \| 'odoo'), `odoo_leave_id` NULL | Solicitud desde la app; aprobación en bloque; descuenta de la cuota |
| `company_calendar_exceptions` | `date` PK, `kind` ('non_working' \| 'working'), `label` | Días de empresa; festivos nacionales en código (`holidays.ts`) |
| `perfiles_visita` (o columnas en `executives`) | `executive_id`, `telefonica_habilitada` bool, `radio_m` NULL (si se autoriza excepción) | Quién puede reportar telefónica |
| `vmo_representantes` | `vmo_name` PK, `executive_id`, `kam_id`, vigencia | Importador e histórico |

Columna nueva en `executives`: `visits_source` ('vmo' | 'app'). Rol nuevo de usuario: `hr`
(recursos humanos) con permiso de ausencias.

Migración `2026-10-XX_0800_visitas_app.sql` + rollback `9940`, escritas en Fase 2, aplicadas con
autorización del dueño.

### Voz: del audio al registro

1. La app graba (m4a, hasta 3 minutos) y lo sube con GPS, hora y el `client_id`.
2. El servidor transcribe (API de OpenAI, `gpt-4o-transcribe`; si no está disponible, `whisper-1`;
   idioma español, con un prompt de vocabulario: PerOssal, osteosíntesis, nombres de líneas).
3. La API de Claude (`claude-sonnet-5-5`) recibe la transcripción más el contexto cercano (terceros a
   menos de 1 km, médicos asignados, visitas recientes) y devuelve **salida estructurada** contra el
   esquema: lista de registros, cada uno con `kind`, candidato de tercero (nombre dicho + mejor cruce en
   `terceros` con puntaje), contacto, líneas, efectiva/no efectiva y motivo, conclusión, compromisos,
   próxima reunión (fecha o "sin programar"). Lo que no esté en las listas se descarta; nunca inventa un
   tercero: si no cruza, propone "¿quién es? no lo encuentro en Odoo".
4. La app muestra una tarjeta por registro y pide un toque. Si hay ambigüedad real (dos cruces con puntaje
   parecido), pregunta solo eso. La ejecutiva puede corregir hablando otra vez.
5. Todo lo confirmado se guarda en tiempo real; el audio va al bucket; si falla la transcripción, la app
   deja el audio en cola y ofrece el respaldo por toques.

## 6. KPIs (6)

| # | KPI | Fórmula | Datos |
| --- | --- | --- | --- |
| 1 | **Cumplimiento de metas** (médicos e instituciones) | efectivas del tipo ÷ cuota del periodo, con cuota = meta × días hábiles − ausencias aprobadas; ritmo = hábiles transcurridos ÷ hábiles del periodo | `visits.kind`, `metas`, `ausencias`, `holidays.ts` |
| 2 | **Cobertura** | médicos asignados con ≥ 1 visita efectiva en el trimestre ÷ asignados; IPS del Anexo A con ≥ 1 visita a compras en el mes ÷ Anexo A | `terceros.executive_id`, `territory_snapshots` |
| 3 | **Mezcla visita / gestión** | gestiones ÷ (visitas + gestiones) por ejecutiva y mes, con alerta | `visits.kind` |
| 4 | **Sin contacto reciente** | médicos asignados sin visita en 60 días; IPS del Anexo A sin compras en 90 días, ordenadas por camas, quirófanos y compras SECOP | `visits`, `hospitals`, SECOP |
| 5 | **Calidad del reporte** | % telefónicas, % no efectivas, % fuera de territorio, % reportes por toques frente a voz, % con dirección nueva | `visits` |
| 6 | **Visita → resultado** | IPS visitadas frente a compras SECOP y giros ADRES ("visitadas sin compra", "compran sin visita"); después, médicos frente a casos de paciente de Odoo | `visits`, SECOP, ADRES, Odoo |

## 7. Reglas de negocio no deducibles del código

- **Visita a médico**: tercero médico, en cualquiera de sus direcciones. Suma a "médicos".
- **Visita a institución**: IPS, cliente, EPS u operador logístico, con contacto de rol compras, dirección o
  dirección médica (o sin contacto). Suma a "instituciones". En los tableros se desglosa por rol del
  tercero (IPS, cliente, EPS, operador).
- **Gestión**: contacto de rol programación/quirófano, esterilización, instrumentación, almacén/farmacia,
  cartera/facturación o autorizaciones, o registro marcado gestión. No suma a metas; se mide en el KPI 3.
  Una llegada a una clínica puede dejar una visita a compras y una gestión con programación: dos registros.
- **Presencial solo en el sitio**: la API rechaza una visita presencial si `distance_m` al lugar elegido
  supera el radio (500 m por defecto, único; excepción por persona solo con autorización escrita). Sin
  coordenadas conocidas del lugar, la ejecutiva debe guardar el punto como dirección nueva antes de
  reportar, o reportar telefónica.
- **Telefónica**: sin GPS; solo para quien la tenga habilitada; cuenta para metas y se evalúa aparte en el
  KPI 5.
- **Mismo día, tiempo real**: la fecha y hora son las del teléfono al confirmar; no hay reporte de días
  anteriores desde la app. Dirección puede crear o corregir con rastro.
- **Consultorio nuevo**: el GPS de la ejecutiva se guarda como `tercero_direcciones` del médico
  (`gps_visita`) y, si el dueño lo autoriza, se envía a Odoo como dirección adicional.
- **Metas**: por zona con excepción por ejecutiva; periodo día o semana; nunca 0 para una ejecutiva activa;
  las vacantes no se miden. Días hábiles = lunes a viernes menos festivos de Colombia (código) menos
  `company_calendar_exceptions`.
- **Ausencias**: la ejecutiva solicita desde la app (fechas, fracción, motivo); directora o recursos humanos
  aprueban o rechazan en bloque; la aprobada descuenta de la cuota de inmediato. Si se activa la lectura
  de Odoo, las aprobadas allí entran como `origen='odoo'` y no se duplican.
- **Quién edita qué**: la ejecutiva solo sus registros del mismo día; dirección cualquiera con rastro;
  líder solo ve su línea; data manager sincroniza e importa; las ejecutivas no se ven entre sí.
- **Privacidad**: nunca cédula ni pacientes en OpMap; nombres de médicos y contactos vienen de Odoo; audio y
  transcripción son internos (ejecutiva, su líder, dirección).

## 8. Migración y convivencia con VMO

- Fase 0 verificada en el repo: `web/next.config.js` bloquea GPS y micrófono para la web (`geolocation=(self),
  microphone=(self)`, útil para la web de escritorio); `web/app/api/visits/import/route.ts` borra todas las
  visitas del mes sin filtrar por fuente (`WHERE source='vmo_import'`).
- Sincronización de terceros desde Odoo antes del piloto; 11 ejecutivas con cuenta enlazada y empleado de
  Odoo.
- Histórico de VMO con `source='vmo_import'` y `executive_id` por `vmo_representantes`.
- Piloto: 2 ejecutivas con la app móvil un mes; el resto sigue en VMO; corte con última importación.

## 9. Criterios de aceptación

- [ ] Dado un contacto con cargo "Programador de cirugía", cuando se elige o se dicta, entonces el registro
      queda `kind='gestion'`, no suma a metas y aparece en gestiones.
- [ ] Dado "Jefe de Compras" de una IPS del Anexo A, cuando se reporta efectiva, entonces suma 1 a
      instituciones y a la cobertura del Anexo A.
- [ ] Dado una visita presencial a 800 m del lugar elegido, cuando se envía, entonces la API la rechaza con
      un mensaje claro y la app ofrece telefónica (si está habilitada) o dirección nueva.
- [ ] Dado una ejecutiva sin telefónica habilitada, cuando intenta reportar telefónica, entonces la app no
      lo permite.
- [ ] Dado meta de zona 6 médicos y 1 institución por día, excepción de 4 y 1 para una ejecutiva, 20 días
      hábiles y 2 ausencias aprobadas, entonces su cuota del mes es 72 médicos y 18 instituciones y el ritmo
      al día hábil 10 es 50 %.
- [ ] Dado una meta semanal de 25 médicos, entonces la cuota del mes se calcula por semanas hábiles
      proporcionales (prueba pura).
- [ ] Dado la transcripción del ejemplo de la sección 3, cuando se procesa, entonces la función pura que
      valida la salida del modelo devuelve dos registros (médico Pérez con PerOssal y Reemplazo, efectiva,
      compromiso la otra semana; institución Clínica X con contacto Marta, cotización) y marca la gestión
      si Marta tiene rol de programación; nada se guarda sin confirmación.
- [ ] Dado un dictado que menciona a un médico que no cruza en `terceros`, entonces la propuesta dice que no
      lo encuentra y no crea ningún tercero.
- [ ] Dado "guardar este punto como dirección del médico", entonces existe `tercero_direcciones` con
      `origen='gps_visita'` y la próxima visita lo ofrece como lugar.
- [ ] Dado la sincronización de Odoo, entonces ninguna cédula ni paciente llega a OpMap (prueba del mapeo).
- [ ] Dado el mismo `client_id` dos veces, entonces hay una sola fila.
- [ ] Dado una visita de la app en octubre y una importación de VMO de octubre, entonces la visita de la app
      sigue existiendo.
- [ ] Dado un usuario `hr`, cuando abre Ausencias, entonces ve todas y puede aprobar varias en bloque; un
      líder de línea solo ve las de su línea; un `viewer` recibe 403.

## 10. Fuera de alcance, impacto, plan y verificación

**Fuera de alcance**: modo sin señal, "Mi semana", casos de paciente de Odoo, ventas por médico,
priorización automática, crear terceros desde OpMap, módulos descartados de VMO, estética del mapa, Google.

**Impacto**
- Migración 0800 + rollback 9940 (Fase 2), aplicadas con autorización.
- Google Maps: 0 USD.
- Voz: transcripción con la API de OpenAI (`gpt-4o-transcribe`, del orden de 0,006 USD por minuto; una
  visita ≈ 0,01 USD) y campos con la API de Claude (≈ 0,005 USD por dictado con `claude-sonnet-5-5`): menos
  de 10 USD al mes para el equipo. Variables `OPENAI_API_KEY` y `ANTHROPIC_API_KEY` en Vercel (las crea el
  dueño). Bucket privado `visit-audio`.
- App móvil: Expo / React Native en `mobile/` dentro del repo (TypeScript, comparte tipos y reglas puras
  con `web/lib`); compilación con EAS. Cuentas que crea el dueño: Apple Developer (99 USD al año) y Google
  Play (25 USD una vez). Piloto por TestFlight y pruebas internas de Play; tiendas después.
- Odoo: lectura con la cuenta de integración que ya usa el MCP; escritura de direcciones solo si se
  aprueba (decisión 1).
- Estética del mapa: sin cambios. Permisos nuevos: `visits:report`, `visits:team`, `visits:targets`,
  `absences:approve`; rol `hr`.

| Fase | Entrega | Evidencia |
| --- | --- | --- |
| **F0 Decisiones y prerrequisitos** | Respuestas del dueño en `docs/decisiones/`; `Permissions-Policy`; importador por fuente; cuentas enlazadas; cuentas de Apple, Google, OpenAI y Anthropic | `npm run check`; prueba del importador |
| **F1 Terceros desde Odoo** | `web/lib/odoo-terceros.ts` (mapeo puro), sincronización en "Fuentes de datos", cruce con `hospitals`, roles de contacto por reglas, direcciones | `odoo-terceros-check.ts`; conteos |
| **F2 Modelo y reglas** | Migración 0800 + rollback; `holidays.ts`; `visits-rules.ts` (tipo por rol, cuota por periodo, Haversine y bloqueo, esquema del dictado y su validación) | `visits-check.ts` puro |
| **F3 API** | `/api/me/*` (contexto cercano, registros idempotentes, `voz/transcribir`, `voz/proponer`, ausencias), `/api/visits/{team,metas,ausencias}`, alcance por rol | pruebas de alcance; dictado real de prueba |
| **F4 App móvil (piloto)** | Expo: inicio de sesión, Hoy, Reportar por voz con tarjeta de confirmación, respaldo por toques, dirección nueva, ausencias; TestFlight y Play interno; migración aplicada; 2 ejecutivas | capturas en iPhone y Android con un dictado real; `npm run check` |
| **F5 Web de dirección** | Mis números (también en la app), Equipo, Metas, bandeja de ausencias en bloque, ficha de IPS, filtros del mapa de calor | capturas; pruebas de KPIs |
| **F6 Corte de VMO** | Última importación; todas en 'app'; nota de decisión | conteo por fuente |

**Verificación final**: `npm run check` en cada PR (y la suite de `mobile/` cuando exista); pruebas puras
de mapeo de Odoo, tipo por rol, cuota por periodo, festivos 2026-2027, bloqueo por radio, esquema del
dictado; dictado real grabado en el piloto con su tarjeta; prueba de convivencia con el importador;
rollback de 0800 probado; ninguna línea nueva importa `google-distance.ts`.

## 11. Decisiones pendientes del dueño

Ya decididas el 2026-10-12: unidad de visita (médico, institución = compras, gestión aparte); metas por tipo
por zona y ejecutiva calculadas por el sistema; bloqueo por distancia con telefónica como alternativa
evaluada; mismo día y tiempo real; app móvil; voz con Whisper o similar y confirmación breve; consultorios
como direcciones de los médicos; ausencias las informa y aprueba la directora, con usuario de recursos
humanos.

| # | Pregunta | Recomendación |
| --- | --- | --- |
| 1 | ¿OpMap **devuelve a Odoo** las direcciones nuevas de médicos que la ejecutiva guarde con GPS? | **Sí**, como dirección adicional del tercero, para que la base única siga única. |
| 2 | ¿Las **ausencias** viven en OpMap (bandeja propia con aprobación en bloque) y además se leen las aprobadas en Odoo para no duplicar? | **Sí a ambas**: OpMap para la operación comercial; lectura de Odoo porque recursos humanos ya aprueba allí vacaciones, citas médicas y día de familia. |
| 3 | ¿La **telefónica** se habilita por persona (directora) y cuenta para la meta igual que la presencial, evaluada aparte? | **Sí.** Al inicio del piloto, habilitada para las dos ejecutivas; después se decide con datos. |
| 4 | ¿"**Instituciones**" es el nombre, e incluye IPS, clientes, EPS y operadores logísticos, con desglose por rol en los tableros? ¿O quieres una meta aparte para clientes que no son IPS? | **Una meta de instituciones con desglose**; si la mezcla muestra que las EPS y los operadores quedan sin visitar, se abre la meta aparte. |
| 5 | ¿Las **gestiones** solo se miden en el piloto (número y mezcla), sin meta? | **Sí.** |
| 6 | ¿Piloto con 2 ejecutivas un mes con la app móvil y corte de VMO al mes siguiente? | **Sí.** |

Las respuestas van a `docs/decisiones/2026-10-XX-app-de-visita.md` y la spec pasa a "aprobada por el dueño"
antes de abrir la Fase 0.
