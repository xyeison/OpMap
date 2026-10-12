# Spec: app de visita de OpMap (reemplazo de VMO)  (2026-10-12)

**Estado**: borrador para el dueño (2026-10-12)

Base: propuesta "Campo" (la Ejecutiva Comercial con el celular en la mano), la mejor valorada por los dos
jueces (64 puntos sobre 80, frente a 59 de "Dirección" y 54 de "Datos"). Se le injertan las piezas que los
jueces rescatan de las otras dos: de "Dirección", medir contra la versión vigente del Anexo A y cruzar
visita con compras SECOP y giros ADRES; de "Datos", los dos arreglos técnicos previos obligatorios, los
festivos calculados en código, la tabla de equivalencias con VMO y el alcance por persona en la API.
Documento de referencia de VMO: `docs/referencias/2026-10-11-vmo-2026-documentacion-funcional.md`.

---

## 1. Problema

VG Medical reporta hoy la visita comercial en VMO 2026 (vmo.com.co), una plataforma hecha para laboratorios
farmacéuticos. El dueño, el 2026-10-12:

> "Es muy complejo, tiene demasiadas características que hace complejo su uso. Está pensado para los
> laboratorios y como tienen muchos clientes todo el tiempo lo están actualizando según la necesidad de
> cada cliente."

Tres cifras del recorrido de VMO del 2026-10-11 lo muestran:

| Cifra | Qué significa para VG |
| --- | --- |
| **25 módulos de configuración** (radio por usuario, parrilla promocional, inventario de muestras, campos dinámicos, bricks, menús por rol...) | Nadie en VG sabe hoy si el radio de 500 m bloquea o solo advierte; dos ejecutivas no tienen validación, una tiene 200 m y dos tienen cuota 0. |
| **28 reportes** y listas de 36 columnas | Los indicadores que importan quedan enterrados; el "cumplimiento de frecuencia" da 3,5 % porque la frecuencia por defecto es 10 visitas por médico al mes. |
| **153 solicitudes de alta/baja y unas 800 solicitudes de días autorizados sin resolver** desde agosto de 2025 | Los dos circuitos de aprobación están muertos: el panel está desactualizado y la cuota nunca se ajusta por ausencias. |

Además, VMO modela la visita del laboratorio: una fila por médico. En VG, una llegada a una clínica donde se
ve a compras, al ortopedista y a instrumentación serían tres visitas distintas. Y VMO no sabe nada de lo que
OpMap ya sabe: cuál es el territorio de cada Ejecutiva Comercial (Anexo A), qué líneas lleva, cuántas camas
y quirófanos tiene cada IPS, qué compra por SECOP y cuánto recibe de la ADRES.

OpMap tiene hoy un módulo `/visits` que solo importa el Excel mensual de VMO (7.033 visitas de enero a
octubre de 2025, 11 ejecutivas) y lo pinta en un mapa de calor. Esta spec lo convierte en la app de visita
propia.

## 2. Principios de diseño

1. **Una visita se reporta en una sola hoja y en 4 toques** en el caso normal: IPS preseleccionada por GPS,
   "Llegué", interlocutores, Guardar. Todo lo demás es opcional. **O se dicta por voz al salir**: la
   ejecutiva habla, la app transcribe, propone los campos y ella confirma en un toque (requisito del dueño,
   2026-10-12: "Recuerda lo de reportar con voz").
2. **La unidad es la llegada a una IPS**, con los interlocutores vistos (compras, cirujano, instrumentación...)
   y las líneas tratadas. No una visita por médico.
3. **El territorio ya existe**: "mi territorio" es el Anexo A vigente de la ejecutiva. No hay panel que
   construir, ni altas, ni bajas, ni reasignaciones que aprobar.
4. **Sin aprobaciones.** Los días no laborados los anota dirección y descuentan de inmediato. Lo único que
   requiere revisión es una lista semanal de avisos (visitas fuera de territorio, lejos de la IPS, tardías),
   que no bloquea nada.
5. **Medir, no castigar.** El radio de 500 m, la visita virtual, el reporte tardío y la visita fuera de
   territorio se guardan siempre y se ven como indicadores de calidad; nunca impiden reportar.

Y tres restricciones del repo que no se negocian: cero llamadas a Google Maps (distancias por Haversine),
estética del mapa intocable (el flujo de visita es una lista, no un mapa) y terminología visible "Ejecutivo
Comercial", "Zona", "IPS", "Interlocutor" (nunca "KAM", "representante" ni "panel").

## 3. Resultado esperado por rol

**Ejecutiva Comercial (celular, también funciona en escritorio)**
- Abre OpMap en el celular y ve "Hoy": sus IPS del Anexo A ordenadas por distancia, cuántas visitas lleva en
  el día y un botón grande "Reportar visita".
- Reporta una visita presencial en 4 toques; una virtual sin GPS; una no efectiva con motivo y fecha de
  reintento; todo en la misma hoja.
- O la **dicta al salir**: toca "Dictar", cuenta qué pasó ("estuve con compras y con el ortopedista, les
  mostré PerOssal, quieren cotización la otra semana"), y la app le muestra la visita ya armada
  (interlocutores, líneas, efectiva, nota y próximo paso) para confirmarla en un toque o corregir un chip.
- Ve "Mi territorio" (IPS sin visitar este mes primero, con último contacto y tamaño) y "Mis números"
  (cobertura del Anexo A, efectivas vs cuota, ritmo del mes).
- Puede visitar una IPS fuera de su territorio o un lugar que no es sede REPS (consultorio privado) sin
  pedir permiso: queda marcado y cuenta como visita, no como cobertura.
- Edita o borra sus propias visitas solo el mismo día.

**Líder de línea**
- Ve en escritorio la tabla "Equipo" de las ejecutivas de su línea: cobertura del Anexo A de la línea,
  efectivas vs cuota, profundidad de cuenta, indicadores de calidad.
- Ve en la ficha de cada IPS las visitas de su línea junto a las compras SECOP y giros ADRES del mismo
  periodo.

**Directora comercial**
- Todo lo del líder, para todas las líneas y ejecutivas.
- Fija la cuota mensual por ejecutiva y registra los días no laborados (sin solicitud ni aprobación).
- Recibe la lista semanal de avisos y puede crear o corregir visitas de días anteriores dejando rastro.

**Data manager**
- Sigue importando el Excel de VMO durante la transición para las ejecutivas que aún reportan allí.
- Mantiene la tabla de equivalencias "nombre en VMO → Ejecutiva Comercial" y marca en qué sistema reporta
  cada persona.
- Puede vincular a una sede REPS un "lugar no listado" que una ejecutiva reportó.

## 4. Alcance del MVP (lista cerrada)

1. Pantalla **Hoy** (celular): con el GPS del teléfono, IPS del Anexo A ordenadas por distancia (Haversine en
   el cliente), contador del día, pendientes de la semana y botón "Reportar visita".
2. **Reportar visita presencial** en una hoja: IPS preseleccionada (la más cercana, cambiable con búsqueda),
   "Llegué" captura GPS y hora, chips de interlocutor (Compras, Cirujano, Instrumentación, Dirección/Gerencia,
   Almacén/Farmacia, Otro), chips de mis líneas (preseleccionadas si llevo una sola), Efectiva/No efectiva,
   nota opcional, Guardar.
3. **Reportar visita virtual**: misma hoja, sin GPS, buscando la IPS en mi territorio; queda marcada
   "virtual".
4. **Visita no efectiva** con 4 motivos (no estaba, no me atendió, cerrado, reprogramada) y fecha opcional de
   reintento.
5. **Cirujano como interlocutor con especialidad** (ortopedia, neurocirugía, columna, deportiva, otra). Sin
   nombre en el MVP (ver decisión 6), sin directorio, sin aprobación.
6. **Acompañamiento en cirugía** como un chip más en la misma hoja (soporte técnico en sala): cuenta como
   visita efectiva con sus interlocutores; no es una pantalla aparte.
7. **Mi territorio**: IPS del Anexo A agrupadas en "Sin visitar este mes", "Visitadas" y búsqueda por nombre
   y municipio; ordenadas por camas y quirófanos del REPS (grande primero) y, si hay, compras SECOP de mis
   líneas. Toque para reportar.
8. **Mis números**: cobertura del Anexo A, efectivas vs cuota ajustada, ritmo ("vas al día" / "te faltan n"),
   % virtual, IPS sin visitar en más de 60 días.
9. **Otra IPS** (cualquier sede activa de `hospitals`, marcada fuera de territorio) y **Lugar no listado**
   (nombre + GPS, para consultorios privados y sitios que no son sede REPS; no crea IPS ni entra en la cola de
   pendientes).
10. **Equipo** (escritorio, dirección y líderes): tabla por ejecutiva y línea con los 6 KPIs, filtro de mes y
    línea, lista semanal de avisos, exportación CSV.
11. **Metas** (dirección): cuota mensual por ejecutiva con "copiar del mes anterior" y días no laborados.
12. **Ficha de IPS** (existente): pestaña "Visitas" con historial de visitas de la app junto a compras SECOP
    por línea y giros ADRES del mismo periodo.
13. **Mapa de calor existente**: filtro de fuente "App" | "VMO histórico" y por ejecutiva. Sin capas,
    marcadores ni colores nuevos.
14. **Convivencia con VMO**: importador conservado, corregido para no borrar visitas de la app, con tabla de
    equivalencias y marca de sistema por ejecutiva.
15. **Reporte por voz** (primer nivel, no "después del MVP"): botón "Dictar" en la misma hoja. La app graba
    (MediaRecorder), transcribe en el navegador (Web Speech API: Chrome en Android, Safari en iOS; costo 0)
    y, con la transcripción, un modelo de lenguaje (API de Claude, `claude-haiku-5-5`) propone los campos
    de la visita: interlocutores con especialidad, líneas tratadas, efectiva/no efectiva y motivo, nota
    resumida y próximo paso con fecha. La ejecutiva ve la propuesta como chips ya marcados y confirma en un
    toque o corrige. **Nada se guarda sin confirmar.** Se guardan la transcripción (`visits.transcript`) y
    el audio en un bucket privado de Supabase Storage (`visit-audio`, 12 meses). Si el navegador no soporta
    dictado o no hay conexión, el botón se oculta y queda la hoja de toques.

### Después del MVP (se decide con datos del piloto)

- **Sin señal** (PWA instalable, cola local, sincronización idempotente): el MVP exige conexión; el
  `client_id` ya queda preparado para la cola.
- **Mi semana**: repartir IPS pendientes en los días L-V (sin horas). Planear nunca será requisito.
- **Directorio de cirujanos**: nombre y vínculo a IPS, con aviso de privacidad del área legal; sugerencias
  desde SECOP (851 médicos con especialidad, fuente pública, por hash).
- **Ventas Odoo** por NIT de IPS y línea para cerrar visita → venta en IPS privadas.
- **Priorización automática** de a quién visitar (camas, giros ADRES, compras SECOP, días sin visita).
- Visitas por ejecutiva en el mapa: solo con autorización explícita del dueño (estética del mapa).

### Qué se conserva de VMO / qué se descarta y por qué

| Se conserva | Cómo queda en OpMap |
| --- | --- |
| Reporte con GPS del dispositivo y distancia al punto visible para dirección | "Llegué" captura GPS y hora; `distance_m` por Haversine contra `hospitals.lat/lng` |
| Presencial / virtual; la virtual no valida ubicación | Igual; la virtual se mide aparte como indicador de calidad |
| Efectiva / no efectiva con motivo y fecha de reintento | 4 motivos (VMO tiene 15) |
| Reportar sin agendar | La agenda no existe en el MVP; nunca será requisito |
| Mes como periodo, días hábiles con festivos descontados, cuota mensual | Festivos calculados en código (VMO los carga a mano y le falta el 2 de noviembre) |
| Cobertura = visitados ÷ miembros del panel | Misma fórmula sobre el Anexo A vigente, que sí es la meta real |
| Días autorizados que ajustan la cuota | Días no laborados que anota dirección, sin solicitud ni aprobación |
| Reportar el mismo día | Igual; el día siguiente queda marcado "tardío"; después solo dirección |
| Supervisores ven las visitas del equipo | Dirección todo; líder de línea solo su línea |
| Una sola hoja de reporte | Igual, con los chips en lugar de pestañas |
| Exportar CSV | Visitas y tabla Equipo |

| Se descarta | Por qué |
| --- | --- |
| Una visita por médico, frecuencia 10 por médico, categorías A/B/C, cuota de frecuencia | En VG la unidad es la IPS con sus interlocutores; el indicador de frecuencia da 3,5 % y no gestiona nada |
| Material promocional, muestras, inventario, despachos, "Entrega de material" | Vacíos hoy y ajenos a implantes |
| Parrilla promocional, ayudas visuales, productos por marca | Las líneas de negocio ya son el catálogo |
| Operaciones (altas, bajas, reasignaciones, reactivaciones) | 153 pendientes demuestran que no se usa; la IPS viene del REPS y la cobertura la decide OpMap |
| Solicitud y aprobación de días autorizados con 14 motivos | 800 sin resolver; dirección anota y descuenta |
| Agenda a 30 días en medias horas, ruteros, modo planeación, "Visita rápida" como vista aparte | Todo cabe en "Hoy", "Mi territorio" y, después, "Mi semana" |
| Panel potencial, farmacias, pacientes, farmacovigilancia, cartera, transferencia de valor, cumpleaños, e-learning, cronómetro, "Solicitar asistencia" | No son el negocio de VG |
| Hábeas Data con foto en cada visita | La IPS es persona jurídica; para cirujanos, aviso único fuera de la visita cuando legal lo entregue |
| 28 reportes, 25 módulos de configuración, parámetros por país y por usuario | Un tablero de 6 KPIs y un radio único para todas |
| Ubicación en tiempo real, envío cada 5 minutos, "Reportar ubicación" | Solo se captura GPS al tocar "Llegué" (confianza del equipo) |
| Comentario obligatorio, tope del 30 % de virtuales, nota obligatoria en virtual | Castigan en vez de medir; empujan a subreportar |
| 33 especialidades, "Visita Médica / Comercial" como tipo de actividad | 5 especialidades; la actividad se deduce de los interlocutores y el chip de cirugía |

## 5. Modelo de datos

### Qué se reutiliza tal cual
- `hospitals` (783 sedes REPS activas con `lat/lng`, `reps_beds`, `quirofanos`, `service_flags`): la IPS de la
  visita siempre es una fila de aquí.
- `executives` (la persona), `executive_lines` (sus líneas), `business_lines`.
- `kams` (la zona; `visits.kam_id` sigue siendo la zona de la IPS, derivada de `assignments`), `coverage`.
- `territory_snapshots` (por `line_id`, `executive_id`, `version_label`; `annex_a` jsonb): "mi territorio"
  es la unión de los `annex_a` de la última versión de cada línea de la ejecutiva. Se resuelve en
  TypeScript reutilizando `web/lib/territory.ts`, no en una vista SQL sobre jsonb. Si una línea no tiene
  snapshot, se usa la asignación en vivo y se avisa en pantalla.
- SECOP (`secop_contratos` y vistas por línea) y giros ADRES para la pestaña "Visitas" de la ficha.
- `visits` y `visit_imports`: se amplían, no se reemplazan, para que el mapa de calor,
  `/api/visits/filtered`, `/api/visits/stats` y el histórico sigan funcionando.

### `visits` (existente) — columnas nuevas

| Columna | Tipo | Para qué |
| --- | --- | --- |
| `source` | text NOT NULL DEFAULT 'vmo_import' CHECK ('vmo_import' \| 'app') | Separar el histórico de VMO de las visitas nativas en todo cálculo |
| `executive_id` | uuid NULL FK `executives` | La persona que visitó (hoy solo existe `kam_id` = zona) |
| `client_id` | uuid NULL UNIQUE | Idempotencia: el teléfono genera el id; reenviar no duplica |
| `checked_in_at` | timestamptz NULL | Hora de "Llegué" en el teléfono (no la de envío) |
| `distance_m` | integer NULL | Haversine servidor entre GPS y `hospitals.lat/lng`; NULL en virtual o sin coordenadas de la IPS |
| `gps_accuracy_m` | numeric NULL | Precisión que reportó el GPS; explica los falsos "lejos" dentro de edificios |
| `hospital_match` | text NOT NULL DEFAULT 'nearest' CHECK ('declared' \| 'nearest' \| 'none') | 'declared' en la app (la ejecutiva eligió la IPS); 'nearest' en el histórico (IPS más cercana a 5 km) |
| `activity_kind` | text NOT NULL DEFAULT 'visita' CHECK ('visita' \| 'acompanamiento_cirugia') | El chip de acompañamiento en cirugía |
| `failure_reason` | text NULL CHECK ('no_estaba' \| 'no_atendio' \| 'cerrado' \| 'reprogramada') | Motivo de la no efectiva |
| `retry_date` | date NULL | Fecha de reintento |
| `note` | text NULL (≤ 500) | Nota opcional |
| `out_of_territory` | boolean NOT NULL DEFAULT false | Calculado al guardar contra el Anexo A vigente |
| `place_name` | text NULL | "Lugar no listado": nombre libre cuando `hospital_id` es NULL |
| `reported_late` | boolean NOT NULL DEFAULT false | Guardada después del día de la llegada |
| `input_mode` | text NOT NULL DEFAULT 'toques' CHECK ('toques' \| 'voz' \| 'importada') | Cómo se reportó; sirve para medir la adopción del dictado |
| `transcript` | text NULL (≤ 4000) | Transcripción del dictado tal como la entendió el navegador |
| `audio_path` | text NULL | Ruta del audio en el bucket privado `visit-audio` (12 meses; se borra después) |
| `next_step` | text NULL (≤ 300) | Próximo paso que propuso el dictado o escribió la ejecutiva |
| `next_step_date` | date NULL | Fecha del próximo paso (alimenta "pendientes de la semana" en Hoy) |
| `created_by`, `updated_by` | uuid NULL FK `users` | Quién creó y quién corrigió |
| `updated_at`, `deleted_at` | timestamptz NULL | Corrección y borrado lógico (nunca borrado físico de visitas de la app) |

Cambios de restricciones: `lat`/`lng` pasan a NULL permitido con CHECK (si `source='app'` y
`contact_type='Visita presencial'` entonces `lat` y `lng` NOT NULL); `hospital_id` NULL solo si
`place_name` no es NULL. Índice UNIQUE parcial `(executive_id, hospital_id, visit_date) WHERE source='app'
AND hospital_id IS NOT NULL AND deleted_at IS NULL`: una visita por ejecutiva, IPS y día; si vuelve a la
misma IPS el mismo día, la app abre la visita existente y añade interlocutores (el segundo envío edita, no
duplica). `visit_type` y `contact_type` conservan sus valores actuales; la app escribe 'Visita efectiva' o
'Visita no efectiva' y 'Visita presencial' o 'Visita virtual'; 'Visita extra' solo llega por importación.

### Tablas nuevas (todas con RLS activa sin políticas; acceso solo con `service_role` desde `lib/supabase-admin.ts`, patrón de Fase 2b)

| Tabla | Columnas clave | Para qué |
| --- | --- | --- |
| `visit_lines` | `visit_id` FK ON DELETE CASCADE, `line_id` FK `business_lines`, PK ambas | Líneas tratadas en la visita; sustituye "productos promocionados"; necesaria para cobertura por línea y para el líder de línea |
| `visit_contacts` | `visit_id` FK, `role` CHECK ('compras' \| 'cirujano' \| 'instrumentacion' \| 'direccion' \| 'almacen' \| 'otro'), `specialty` text NULL CHECK ('ortopedia' \| 'neurocirugia' \| 'columna' \| 'deportiva' \| 'otra') | Interlocutores vistos; sin nombre ni documento en el MVP (decisión 6) |
| `executive_quotas` | `executive_id`, `year`, `month`, `quota` int ≥ 0, `set_by`, `set_at`; UNIQUE (ejecutiva, año, mes) | Cuota mensual fijada por dirección; la cuota ajustada no se guarda, se calcula |
| `executive_non_working_days` | `executive_id`, `date`, `fraction` numeric CHECK (0.5 \| 1), `reason` CHECK ('vacaciones' \| 'incapacidad' \| 'capacitacion' \| 'congreso' \| 'administrativo' \| 'otro'), `note`, `created_by`; UNIQUE (ejecutiva, fecha) | Días no laborados que anota dirección; descuentan cuota de inmediato |
| `company_calendar_exceptions` | `date` PK, `kind` CHECK ('non_working' \| 'working'), `label` | Solo días de empresa (24 y 31 de diciembre, día de la familia). Los festivos nacionales NO van en tabla |
| `vmo_representantes` | `vmo_name` text PK (columna "Representante" del Excel, normalizada), `executive_id` FK NULL, `kam_id` FK NULL, `valid_from`, `valid_to` | Equivalencias para el importador y el backfill; reemplaza la búsqueda difusa actual |

Columna nueva en `executives`: `visits_source` text NOT NULL DEFAULT 'vmo' CHECK ('vmo' | 'app'): en qué
sistema reporta hoy cada persona. El importador ignora filas de ejecutivas en 'app'.

Festivos de Colombia: `web/lib/holidays.ts` (Ley 51 de 1983: fijos, trasladados al lunes y los que dependen
de Pascua) con pruebas puras para 2026 y 2027 en `scripts/visits-check.ts`. Evita repetir el error de VMO
(2 de noviembre ausente, 13 de julio sobrante) y no exige que nadie cargue 2027 a tiempo.

Migración: `database/migrations/2026-10-XX_0800_visitas_app.sql` con rollback
`2026-10-XX_9940_visitas_app_rollback.sql`. Se escribe en la Fase 1 y se aplica solo con autorización del
dueño, en la misma ventana que el código. Incluye el backfill del histórico (ver sección 8).

### Cómo nace el panel de médicos

En el MVP **no hay panel de médicos**. El cirujano se registra como interlocutor con rol y especialidad, que
es lo que necesita el KPI de profundidad de cuenta (¿vimos a compras y a un cirujano en esta IPS este
trimestre?). Razones: el nombre de un médico ya es dato personal (Ley 1581 de 2012) y VMO tenía las 6
plantillas de Hábeas Data vacías; el directorio de VMO trae 2.178 médicos con 166 duplicados y 99 sin
representante; y la bandeja de altas y bajas es justo lo que el dueño quiere dejar atrás.

Cuando el dueño decida añadir nombres (después del MVP y con el aviso de privacidad del área legal), el
directorio nacería así, en este orden y sin bandeja de aprobación:
1. **Sugerencias desde SECOP**: 851 médicos contratados por IPS públicas con especialidad, identificados por
   el hash que ya existe (`proveedor_hash`), fuente pública. Se ofrecen como autocompletar al escribir el
   interlocutor cirujano en esa IPS; nunca se copia el documento.
2. **Texto libre `hospitals.doctors`**: la columna existe en la base y la usa la ficha de la IPS, pero no
   aparece en las migraciones del repo; hay que verificarla antes de usarla como semilla. Si sirve, un
   script `--dry-run` propone nombres por IPS para que la ejecutiva confirme o descarte.
3. **Export de VMO**: solo si el dueño lo decide; el cruce con IPS es por nombre y ciudad, y lo que no cruce
   no entra.
Deduplicación por nombre normalizado + IPS, con aviso en pantalla; sin pedir cédula a la ejecutiva (digitarla
para hashearla sigue siendo capturar el dato en el dispositivo).

## 6. KPIs (6)

| # | KPI | Fórmula | De dónde sale |
| --- | --- | --- | --- |
| 1 | **Cobertura del Anexo A** (mes, por ejecutiva y por línea) | IPS del Anexo A vigente con ≥ 1 visita efectiva en el mes ÷ IPS del Anexo A | `visits` (source 'app', efectiva, `hospital_id`), `visit_lines`, `territory_snapshots.annex_a` de la última versión de cada línea |
| 2 | **Cumplimiento de cuota ajustada** y ritmo | efectivas ÷ (cuota × (días hábiles − días no laborados) ÷ días hábiles); ritmo esperado = hábiles transcurridos ÷ hábiles del mes | `executive_quotas`, `executive_non_working_days`, `holidays.ts`, `company_calendar_exceptions` |
| 3 | **Profundidad de cuenta** (trimestre móvil) | IPS del Anexo A donde se vio a Compras Y a un Cirujano ÷ IPS del Anexo A | `visit_contacts.role` |
| 4 | **IPS sin visita en más de 60 días** | Lista del Anexo A sin visita efectiva en 60 días, ordenada por camas, quirófanos y compras SECOP de la línea | `visits`, `hospitals.reps_beds`, `hospitals.quirofanos`, SECOP por línea |
| 5 | **Calidad del reporte** (alertas, no castigos) | % virtuales; % presenciales con `distance_m` > 500 m; % tardías; % fuera de territorio. Alerta si virtuales > 30 % o lejanas > 10 % | `visits.contact_type`, `distance_m`, `reported_late`, `out_of_territory` |
| 6 | **Visita → resultado** (trimestre, por IPS del Anexo A) | Visitas efectivas frente a compras SECOP de la línea y giros ADRES; dos listas: "visitadas sin compra" y "compran sin visita" | `visits`, `secop_contratos` por línea, giros ADRES |

La cuota (KPI 2) es la segunda métrica, no la primera: VMO midió 140 visitas al mes por inercia y la
cobertura quedó de adorno. En OpMap la primera pregunta es "¿qué parte de mi territorio he visto?".

## 7. Reglas de negocio no deducibles del código

**La visita**
- Una visita = una Ejecutiva Comercial + una IPS (o lugar no listado) + un día, con 1..n interlocutores y
  1..n líneas. Si vuelve a la misma IPS el mismo día, se edita la visita existente (se añaden
  interlocutores); no hay "visita extra" para visitas nuevas.
- La IPS siempre es una sede activa de `hospitals` (REPS). La ejecutiva no crea IPS: "Lugar no listado"
  guarda nombre y GPS en la propia visita, cuenta como visita, no como cobertura, y no entra en la cola de
  IPS pendientes (que se deriva de `hospitals` y dispararía gasto de Google). Data manager puede vincularla
  después a una sede.
- "Otra IPS" (sede activa fuera de mi Anexo A) se permite, se marca `out_of_territory`, cuenta como visita y
  no suma cobertura.
- Solo la visita efectiva suma a cuota y cobertura; la no efectiva se guarda con motivo y no suma.

**GPS y radio**
- Presencial exige GPS al tocar "Llegué" (`enableHighAccuracy`, 15 s); se guardan `checked_in_at`,
  `lat/lng`, `gps_accuracy_m` y `distance_m` por Haversine contra `hospitals.lat/lng`.
- Radio único de 500 m para todas: más de 500 m **no bloquea**; marca "lejos de la IPS" y entra al KPI 5. El
  GPS dentro de hospitales y sótanos da errores de 50-300 m; bloquear haría que dejaran de reportar en sitio.
- Si la IPS no tiene coordenadas (sedes "sin ubicar"), `distance_m` queda NULL y no genera alerta.
- Ninguna captura de ubicación fuera del toque "Llegué". No hay rastreo continuo.

**Visita virtual**
- Sin GPS ni validación de distancia; se marca y cuenta aparte. Cuenta para la cuota (ver decisión 2) y se
  vigila con el KPI 5. Sin nota obligatoria ni tope duro.

**Plazo para reportar**
- La fecha válida es la de "Llegué" en el teléfono (`visit_date` en hora de Bogotá). Se reporta el mismo
  día. Hasta las 23:59 del día siguiente se guarda marcada `reported_late`. Después solo dirección puede
  crearla o corregirla, y queda `updated_by`.

**Días no laborados y cuota**
- La cuota mensual la fija dirección en visitas efectivas por ejecutiva; nunca 0 para una ejecutiva activa;
  las vacantes (`placeholder`) no se miden.
- Días hábiles = lunes a viernes menos festivos de Colombia (código) menos `company_calendar_exceptions`.
  El sábado no cuenta (VMO lo contaba al 50 %).
- El día no laborado lo registra dirección sin solicitud ni aprobación y descuenta cuota de inmediato
  (`fraction` 1 o 0,5). Los ~800 "días autorizados" sin resolver de VMO no se migran: el histórico 2025 se
  conserva tal como está, sin ajuste.

**Quién edita qué**
- La ejecutiva crea, edita y borra (lógicamente) solo sus visitas y solo el mismo día.
- Dirección (`commercial_director`, `admin`) crea y corrige cualquier visita de cualquier fecha; queda quién
  y cuándo.
- Líder de línea ve las visitas de las ejecutivas de su línea; no edita.
- Data manager importa VMO, mantiene `vmo_representantes` y `executives.visits_source`, vincula lugares no
  listados.
- Las ejecutivas no ven las visitas de sus compañeras (salvo decisión 7 del dueño).

**Reporte por voz**
- El dictado nunca guarda solo: la propuesta de campos siempre pasa por la confirmación de la ejecutiva.
- La transcripción se hace en el navegador (Web Speech API); al servidor viaja solo el texto. La
  extracción de campos usa la API de Claude con un prompt fijo y salida estructurada contra el mismo
  esquema de la visita (interlocutores, especialidad, líneas, resultado, motivo, próximo paso); si el modelo
  no responde en 8 s, la hoja se muestra vacía con la transcripción en la nota y se reporta por toques.
- El audio se guarda en el bucket privado `visit-audio` (solo `service_role`; lo oye la ejecutiva y
  dirección) y se borra a los 12 meses; la transcripción se conserva con la visita.
- Si el dictado menciona nombres de médicos, quedan solo en la transcripción y la nota (texto interno,
  visible para la ejecutiva, su líder y dirección); los campos estructurados siguen sin nombre (decisión 6).

**Privacidad**
- Sin nombre ni documento de cirujano en el MVP. Nunca cédula, ni en claro ni digitada para hashear.

## 8. Migración y convivencia con VMO

**Dos arreglos previos obligatorios (verificados en el repo, Fase 0)**
1. `web/next.config.js` línea 8 envía `Permissions-Policy: camera=(), microphone=(), geolocation=()`: el
   navegador niega el GPS y el micrófono en toda la app (verificado el 2026-10-12). Pasar a
   `geolocation=(self), microphone=(self)` (la cámara sigue cerrada): sin esto no hay "Llegué" ni dictado.
2. `web/app/api/visits/import/route.ts` líneas 82-86 borra TODAS las visitas del mes por `visit_date`, sin
   filtrar por fuente. Con una sola visita de la app guardada, la siguiente importación de VMO la destruiría.
   Cambiar a `DELETE ... WHERE source='vmo_import' AND visit_date en el mes`.

**Backfill del histórico (en la migración 0800, solo SQL, sin Google)**
- Las 7.033 filas actuales quedan `source='vmo_import'`, `hospital_match='nearest'` (o 'none' si
  `hospital_id` es NULL), `distance_m` por Haversine SQL contra la IPS asignada.
- `executive_id` se rellena desde `vmo_representantes` por `kam_name`; segunda pasada: zonas con exactamente
  una ejecutiva cuyo `base_kam_id` es ese `kam_id`. Lo que no cruce queda NULL y se lista en `/visits` como
  "sin ejecutiva" para mapear a mano. No bloquea el MVP: el histórico no entra en cobertura ni ritmo (se
  separa por `source`), solo en el mapa de calor.
- No se recalcula `hospital_id` ni se tocan `visit_imports`.

**Convivencia**
- Cada ejecutiva reporta en un solo sistema a la vez (`executives.visits_source`). El importador descarta
  las filas de ejecutivas en 'app' y las reporta como "ya en OpMap".
- El importador resuelve la ejecutiva por `vmo_representantes` y deja de adivinar por nombre.
- La cobertura por radio de 5 km (`/visits/coverage`, `unvisited-zones`) se mantiene solo para
  `source='vmo_import'`; para 'app' se usa el `hospital_id` declarado.

**Apagado**
- Piloto: 2 ejecutivas en 'app' durante un mes, el resto sigue en VMO con importación mensual.
- Corte: fecha fijada por el dueño (decisión 8). Ese mes se hace la última importación de VMO, todas pasan a
  'app', el importador queda en modo histórico (sigue sirviendo 2025) y se anota en `docs/decisiones/`.

## 9. Criterios de aceptación

- [ ] Dado una ejecutiva con cuenta enlazada (`executives.user_id`) y GPS activo, cuando abre "Hoy", entonces
      ve sus IPS del Anexo A vigente ordenadas por distancia Haversine y ninguna llamada a Google.
- [ ] Dado la hoja de reporte con la IPS más cercana preseleccionada, cuando toca "Llegué", elige "Compras" y
      "Cirujano · Ortopedia" y toca Guardar, entonces queda una fila en `visits` (source 'app',
      `hospital_match` 'declared', `checked_in_at`, `distance_m`) con dos filas en `visit_contacts` y sus
      líneas en `visit_lines`, en 4 toques.
- [ ] Dado una visita presencial a 800 m de la IPS, cuando se guarda, entonces se guarda igual, marcada
      "lejos de la IPS", y aparece en el KPI de calidad; nunca se bloquea.
- [ ] Dado una visita virtual, cuando se guarda sin GPS, entonces `lat/lng` y `distance_m` quedan NULL,
      `contact_type` = 'Visita virtual' y cuenta aparte en el KPI 5.
- [ ] Dado "No efectiva" con motivo "no me atendió" y fecha de reintento, cuando se guarda, entonces
      `visit_type` = 'Visita no efectiva', `failure_reason` y `retry_date` quedan guardados y no suma cuota ni
      cobertura.
- [ ] Dado el mismo `client_id` enviado dos veces, cuando llega el segundo POST, entonces no se crea una
      segunda fila (idempotencia).
- [ ] Dado una segunda visita efectiva a la misma IPS el mismo día, cuando la ejecutiva la reporta, entonces la
      app abre la existente y añade interlocutores; en la base sigue habiendo una sola fila.
- [ ] Dado una visita a una sede activa fuera del Anexo A vigente, cuando se guarda, entonces
      `out_of_territory` = true, cuenta en "visitas del mes" y no en "cobertura".
- [ ] Dado "Lugar no listado" con nombre y GPS, cuando se guarda, entonces `hospital_id` es NULL,
      `place_name` tiene el nombre, no se crea ninguna fila en `hospitals` y la cola de IPS pendientes no
      cambia.
- [ ] Dado una ejecutiva con cuota 100, un mes de 20 días hábiles y 2 días no laborados, cuando se calculan
      sus números, entonces la cuota ajustada es 90 y el ritmo esperado al día hábil 10 es 50 %; los festivos
      de 2026 y 2027 (incluido el 2 de noviembre y excluido el 13 de julio) salen de `holidays.ts` y están
      cubiertos por pruebas puras.
- [ ] Dado un líder de línea, cuando llama a `GET /api/visits/filtered` o abre "Equipo", entonces solo recibe
      visitas de ejecutivas de su línea; un `viewer` o `user` recibe 403 (hoy `requireUser` deja pasar a
      cualquiera).
- [ ] Dado una visita de la app en octubre y una importación del Excel de VMO de octubre, cuando corre la
      importación, entonces la visita de la app sigue existiendo, solo se reemplazan filas
      `source='vmo_import'` y las filas de ejecutivas con `visits_source='app'` se descartan con aviso.
- [ ] Dado la transcripción "estuve con compras y con el ortopedista, les mostré PerOssal y reemplazo,
      quieren cotización el martes", cuando se pide la propuesta de campos, entonces la función pura que
      arma el esquema devuelve interlocutores Compras y Cirujano · Ortopedia, líneas PerOssal y Reemplazo,
      efectiva, próximo paso "cotización" con la fecha del martes siguiente; y la respuesta del modelo se
      valida contra el esquema (cualquier valor fuera de las listas se descarta, nunca se inventa una IPS).
- [ ] Dado una propuesta por voz, cuando la ejecutiva cierra la hoja sin confirmar, entonces no queda ninguna
      fila en `visits` ni archivo en `visit-audio`.

## 10. Fuera de alcance, impacto, plan y verificación

### Fuera de alcance
- Modo sin señal (PWA, service worker, IndexedDB), "Mi semana", directorio de cirujanos con nombre,
  ventas Odoo, priorización automática, visitas en el mapa por ejecutiva, app nativa en tiendas.
- Cualquier módulo de VMO de la tabla "se descarta".
- Crear IPS desde la app de visita; recalcular asignaciones; llamar a Google.
- Cambiar `web/components/mapStyles.ts` o añadir capas o marcadores.

### Impacto
- **Datos / migración**: sí. `2026-10-XX_0800_visitas_app.sql` (amplía `visits`, crea `visit_lines`,
  `visit_contacts`, `executive_quotas`, `executive_non_working_days`, `company_calendar_exceptions`,
  `vmo_representantes`, `executives.visits_source`; backfill del histórico) y rollback
  `2026-10-XX_9940_visitas_app_rollback.sql`. Se aplica solo con autorización del dueño, en la misma ventana
  que el código; el rollback se prueba antes.
- **Costo Google Maps**: 0 elementos × 0,005 USD = 0 USD. Ninguna pantalla geocodifica, autocompleta ni pide
  rutas. "Optimizar la ruta del día" queda fuera y exigiría dry-run y autorización.
- **Costo del dictado**: transcripción en el navegador, 0 USD. Extracción de campos con la API de Claude
  (`claude-haiku-5-5`, unas 600 palabras por visita): del orden de 0,001 USD por visita, menos de 1 USD al
  mes para todo el equipo. Variable nueva `ANTHROPIC_API_KEY` en Vercel (la crea el dueño). Bucket privado
  `visit-audio` en Supabase Storage (≈ 1 MB por minuto de audio; 12 meses de retención).
- **Estética del mapa**: no cambia. El flujo de visita es una lista. El mapa de calor existente solo gana un
  filtro de fuente y de ejecutiva.
- **Permisos / roles** (`web/lib/permissions.ts`):
  - Nuevo `visits:report` (crear/editar visitas propias): `sales_manager`, `line_leader`,
    `commercial_director`, `admin`; la API limita a la ejecutiva enlazada por `executives.user_id`.
  - Nuevo `visits:team` (ver visitas y KPIs del equipo): `admin`, `commercial_director`, `data_manager`
    (todas), `line_leader` (solo su línea, reutilizando `resolveUserLines`).
  - Nuevo `visits:targets` (cuotas y días no laborados): `admin`, `commercial_director`.
  - `visits:view` y `visits:manage` existentes se conservan. `GET /api/visits/filtered`, `stats` y
    `unvisited-zones` pasan de `requireUser` a `resolveVisitScope(user)` (propias / líneas que lidera / todas).
  - Menú: entrada "Visitar" (`/visitar`) para quien tenga `visits:report`; "Visitas" sigue para `visits:view`.
- **Prerrequisito de cuentas**: las 11 ejecutivas activas necesitan `users` con rol `sales_manager` enlazado
  en `executives.user_id`. Es criterio de salida de la Fase 0, no un riesgo.
- **Celular**: OpMap es web; el GPS exige HTTPS y permiso del navegador. Los previews de Vercel por rama
  piden login SSO, así que el piloto de campo se hace en producción. Captura en celular obligatoria en cada
  PR con pantalla nueva.

### Plan por fases (un PR pequeño por fase, rama `feat/visitas-<fase>` desde `master`, revisor antes de `/entregar`)

| Fase | Entrega | Pruebas / evidencia |
| --- | --- | --- |
| **F0 Decisiones y prerrequisitos** | Esta spec aprobada; respuestas del dueño en `docs/decisiones/2026-10-XX-app-de-visita.md`; `geolocation=(self)` en `next.config.js`; importador borra solo `source='vmo_import'`; 11 cuentas enlazadas | `npm run check`; prueba del importador con una visita 'app' sembrada que sobrevive |
| **F1 Modelo** | Migración 0800 + rollback escritos (no aplicados); `web/lib/holidays.ts`; `web/lib/visits-rules.ts` (Haversine, cuota ajustada, fuera de territorio, tardía, fusión del mismo día) | `scripts/visits-check.ts` puro, sin red: festivos 2026-2027, días hábiles, cuota ajustada, distancia con coordenadas nulas, idempotencia |
| **F2 API y permisos** | `resolveVisitScope`; `GET /api/me/territory`, `POST/GET /api/me/visits` (idempotente por `client_id`), `GET /api/me/kpis`; `GET /api/visits/team`; `GET/PUT /api/visits/quotas`, `/api/visits/days-off`, `/api/visits/vmo-representantes`; permisos nuevos | `npm run check`; pruebas de alcance por rol |
| **F3 Piloto de campo** | Pantallas `/visitar` (Hoy) y hoja "Reportar visita" (presencial, virtual, no efectiva, Otra IPS, Lugar no listado, acompañamiento) **con "Dictar"** (`web/lib/visit-voice.ts`: esquema de salida, validación y prompt; `POST /api/me/visits/propose` con la API de Claude; bucket `visit-audio`); misma hoja en escritorio. Migración aplicada con autorización. 2 ejecutivas en 'app' | Captura en celular (Android e iOS) y escritorio, incluida una visita dictada; `npm run check` con pruebas puras de la validación del esquema |
| **F4 Territorio, números y equipo** | "Mi territorio", "Mis números", tabla "Equipo" con los 6 KPIs, "Metas" (cuotas, días no laborados), lista semanal de avisos, CSV | Capturas; pruebas de KPIs en `visits-check.ts` |
| **F5 Ficha y mapa** | Pestaña "Visitas" en `/hospitals/[id]` con SECOP y ADRES; filtro de fuente y ejecutiva en el mapa de calor existente; `unvisited-zones` por `hospital_id` para 'app' | Captura del mapa sin cambios de estilo |
| **F6 Corte de VMO** | Última importación, todas en 'app', importador en modo histórico, nota de decisión | Conteo de visitas por fuente antes y después |
| **Después** | PWA sin señal (su propia spec), "Mi semana", directorio de cirujanos con aviso legal, Odoo, priorización | Specs propias |

Archivos previstos: `web/lib/holidays.ts`, `web/lib/visits-rules.ts`, `web/lib/visit-scope.ts`,
`web/app/api/me/*`, `web/app/api/visits/{team,quotas,days-off,vmo-representantes}/route.ts`,
`web/app/visitar/**`, `web/app/visits/metas/page.tsx`, cambios en `web/lib/permissions.ts`,
`web/app/api/visits/{filtered,stats,unvisited-zones}/route.ts`, `web/app/api/visits/import/route.ts`,
`web/next.config.js`, `web/scripts/visits-check.ts` (añadir a `npm run test`), `database/migrations/*0800*`
y `*9940*`, `docs/fases/fase6-visitas.md`.

### Verificación final
- `npm run check` en verde en cada PR, con la salida pegada.
- `npm run test` incluye `visits-check` (puras, sin red): festivos, días hábiles, cuota ajustada, Haversine
  con nulos, fuera de territorio, tardía, fusión del mismo día, alcance por rol.
- Captura en celular real de: Hoy, hoja de reporte con GPS capturado y distancia, visita virtual, no
  efectiva, Mis números. Captura en escritorio de Equipo y Metas.
- Prueba de convivencia: visita 'app' sembrada en el mes + importación del Excel de VMO del mismo mes → la
  visita 'app' sigue.
- Rollback de la migración 0800 probado en la base antes de aplicarla en producción.
- Ninguna línea nueva importa `lib/google-distance.ts`; `GOOGLE_ROUTES_DISABLED=true` no cambia nada en el
  flujo de visita.

## 11. Decisiones que debe tomar el dueño

| # | Pregunta (sí / no) | Recomendación |
| --- | --- | --- |
| 1 | ¿La unidad de visita es la **llegada a una IPS** con sus interlocutores (compras, cirujano, instrumentación...), y no una visita por médico como en VMO? | **Sí.** Tres personas vistas en una clínica son una visita con tres interlocutores; es lo que permite medir profundidad de cuenta. |
| 2 | ¿La cuota es **una cifra mensual de visitas efectivas por ejecutiva** fijada por dirección, y las **virtuales cuentan igual** (vigiladas con alerta si pasan del 30 %)? | **Sí a ambas**, pero la cobertura del Anexo A va primero en el tablero; la cuota de 140 de VMO se revisa por ejecutiva antes del piloto. |
| 3 | ¿Una visita presencial a **más de 500 m** de la IPS se guarda con aviso (y no se bloquea)? | **Sí, solo advierte.** El GPS dentro de hospitales falla 50-300 m; bloquear hace que no reporten en sitio. Radio único para todas. |
| 4 | ¿El plazo de reporte es **el mismo día, con el día siguiente marcado "tardío"** y después solo dirección? | **Sí.** Conserva la hora y el GPS reales sin perder visitas por un olvido de una noche. |
| 5 | ¿Se permite **"Lugar no listado"** (consultorios privados y sitios que no son sede REPS) guardando nombre y GPS en la visita, sin crear IPS, contando como visita pero no como cobertura? | **Sí.** Es la única forma de registrar la visita al ortopedista en su consultorio sin ensuciar `hospitals` ni gastar Google. |
| 6 | ¿En el MVP el cirujano se registra **solo con rol y especialidad, sin nombre**, hasta que el área legal entregue el aviso de privacidad? | **Sí.** El nombre ya es dato personal (Ley 1581) y VMO tenía el Hábeas Data vacío; el directorio nace después, con SECOP como primera fuente. |
| 7 | ¿Los **días no laborados los registra directamente la directora** (sin solicitud ni aprobación), el líder de línea ve solo su línea y las ejecutivas no ven las visitas de sus compañeras? | **Sí a las tres.** Elimina las 800 solicitudes sin resolver; la auditoría es `created_by`. |
| 8 | ¿**Piloto con 2 ejecutivas un mes** en paralelo con VMO (en producción, app web en el celular, sin tienda), y **fecha de corte** al cierre del mes siguiente con última importación del Excel? | **Sí.** Permite medir adopción y calidad del GPS antes de mover a las 11; la fecha exacta la fija el dueño en `docs/decisiones/`. |
| 9 | ¿El **dictado por voz** transcribe en el navegador (costo 0, exige Chrome en Android o Safari en iOS y conexión), arma la visita con la API de Claude y **guarda el audio 12 meses** en un bucket privado? | **Sí.** Es lo que pediste ("reportar con voz"); la confirmación en un toque evita errores del modelo y el audio permite revisar una visita dudosa. Si prefieres no guardar audio, se conserva solo la transcripción. |

Las respuestas se anotan en `docs/decisiones/2026-10-XX-app-de-visita.md` (plantilla en `docs/decisiones/TEMPLATE.md`)
y esta spec pasa a "aprobada por el dueño" antes de abrir la rama de la Fase 0.
