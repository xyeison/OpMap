# Estructura de base de datos (Supabase)

_Extraído de CLAUDE.md el 2026-10-11 (texto íntegro, solo reubicado). Para las tablas de Fase 1/2/2b ver docs/fases/._

## ESTRUCTURA DE BASE DE DATOS (SUPABASE)

### Tablas Principales

#### 1. `hospitals`
Tabla central que contiene todas las instituciones prestadoras de salud (IPS).
```sql
- id: uuid (PK)
- code: varchar (código único de la IPS)
- name: varchar (nombre oficial)
- department_id: varchar (código del departamento)
- municipality_id: varchar (código del municipio) 
- locality_id: varchar (código de localidad, solo para Bogotá)
- lat, lng: numeric (coordenadas geográficas)
- beds: integer (número de camas)
- address: text
- phone: varchar
- email: varchar
- active: boolean (estado activo/inactivo)
- service_level: integer (nivel de servicio)
- services: text (servicios que ofrece)
- surgeries: integer (cirugías realizadas)
- ambulances: integer (número de ambulancias)
- municipality_name: varchar
- department_name: varchar
- locality_name: varchar
- created_at, updated_at: timestamp
```

#### 2. `kams`
Key Account Managers (vendedores) del sistema.
```sql
- id: uuid (PK)
- name: varchar (nombre del KAM)
- area_id: varchar (código del municipio/localidad base)
- lat, lng: numeric (ubicación del KAM)
- enable_level2: boolean (expansión a nivel 2)
- max_travel_time: integer (tiempo máximo de viaje en minutos)
- priority: integer (prioridad en caso de empate)
- color: varchar (color para visualización)
- active: boolean
- zone_id: uuid (FK → zones, ON DELETE SET NULL) — Región; SIN USO en la web desde el 2026-10-14
- created_at, updated_at: timestamp
```

#### Regiones: tabla `zones` (sin uso en la web desde el 2026-10-14)
Agrupación de zonas de una versión anterior (5 filas; ninguna zona tiene una asignada). Por pedido del dueño del
2026-10-14 (`docs/decisiones/2026-10-14-quitar-regiones.md`, spec `docs/specs/2026-10-14-quitar-regiones.md`) la web ya
no la lee ni la escribe: sin página `/zones`, sin "Por Regiones" ni columna Región en Zonas, sin modo Regiones en el
mapa, sin `/api/zones/**` ni `/api/kams/zone`, y `/api/kams/stats` y `/api/map/data` ya no leen `zones` ni
`kams.zone_id`; los permisos `zones:view` y `zones:edit` salieron. La tabla `zones`, la columna `kams.zone_id` y las
vistas `zone_statistics` y `zone_territory_assignments` siguen en la base, sin uso. Borrarlas sería una migración
aparte, con su rollback, y solo si el dueño lo pide.

#### 3. `assignments`
Asignaciones de hospitales a KAMs.
```sql
- id: uuid (PK)
- kam_id: uuid (FK → kams)
- hospital_id: uuid (FK → hospitals)
- travel_time: integer (tiempo de viaje en SEGUNDOS; dividir entre 60 para minutos)
- assignment_type: varchar (tipo de asignación)
- assigned_at: timestamp
- is_base_territory: boolean (si es territorio base del KAM)
```

#### 4. `hospital_kam_distances`
Tiempos de viaje hospital→KAM calculados (reemplaza a la antigua `travel_time_cache`, que ya no existe).
```sql
- id: uuid (PK)
- hospital_id: uuid (FK → hospitals)
- kam_id: uuid (FK → kams, ON DELETE CASCADE)
- travel_time: integer (tiempo en SEGUNDOS)
- distance: numeric (distancia, opcional)
- source: varchar (fuente del cálculo)
- calculated_at, updated_at: timestamp
```

#### 5. `hospital_contracts`
Contratos asociados a hospitales.
```sql
- id: uuid (PK)
- hospital_id: uuid (FK → hospitals)
- contract_value: numeric (valor anual)
- start_date: date
- end_date: date
- duration_months: integer
- current_provider: text (proveedor actual)
- contract_number: varchar
- contract_type: varchar
- description: text
- active: boolean
- created_by: uuid (FK → users)
- created_at, updated_at: timestamp
```

#### 6. `hospital_history`
Historial de cambios en hospitales.
```sql
- id: uuid (PK)
- hospital_id: uuid (FK → hospitals)
- user_id: uuid (FK → users)
- action: text (acción realizada)
- reason: text (razón del cambio)
- previous_state: boolean
- new_state: boolean
- changes: jsonb (cambios detallados)
- created_at: timestamp
- created_by: uuid
```

#### 7. `users`
Usuarios del sistema.
```sql
- id: uuid (PK)
- email: text (único)
- password: text (hash)
- full_name: text
- role: text (CHECK: 'admin', 'user', 'viewer', 'sales_manager', 'contract_manager', 'data_manager', 'line_leader', 'commercial_director'; la migración 0810 (aplicada 2026-10-12) añade 'hr' = recursos humanos; permisos por rol en web/lib/permissions.ts)
- active: boolean
- created_at: timestamp
```

#### 8. `departments`
Departamentos de Colombia.
```sql
- code: varchar (PK) (código DANE)
- name: varchar
- excluded: boolean (si está excluido del análisis)
```

#### 9. `municipalities`
Municipios de Colombia.
```sql
- code: varchar (PK) (código DANE)
- name: varchar
- department_code: varchar (FK → departments)
- lat, lng: numeric
- population_2025: integer
```

#### 10. `department_adjacency`
Matriz de adyacencia entre departamentos.
```sql
- department_code: varchar (FK → departments)
- adjacent_department_code: varchar (FK → departments)
```

#### 11. `opportunities`
Oportunidades comerciales (obsoleta, reemplazada por hospital_contracts).
```sql
- id: uuid (PK)
- hospital_id: uuid (FK → hospitals)
- annual_contract_value: numeric
- current_provider: varchar
- notes: text
- contract_end_date: date
- created_by: uuid
- created_at, updated_at: timestamp
```

#### Fase 3: servicios y capacidad del REPS (migración 0620)
Detalle en `docs/fases/fase3-servicios-capacidad-reps.md`. Las 3 tablas con RLS sin políticas (solo `service_role`).
```sql
hospital_services:    id, reps_code (12 dígitos | 10 | 'NIT-<nit>'), hospital_id (FK, SET NULL), service_code,
                      service_name, group_name, complexity, modality ('' = sin dato), source, imported_at
                      UNIQUE (reps_code, service_code, modality)
hospital_capacity:    id, reps_code, hospital_id, group_name ('camas'|'salas'|'ambulancias'|'otros'), concept,
                      quantity (≥ 0), source, imported_at   UNIQUE (reps_code, group_name, concept)
hospital_import_jobs: id (token), kind, mode, status, file_name, file_kind, file_sha256, rows (jsonb, se vacía
                      al aplicar), summary, result, created_by, created_at, expires_at (30 min), applied_at
hospitals (+):        quirofanos, reps_beds, service_flags jsonb NOT NULL DEFAULT '{}', reps_services_count,
                      reps_updated_at
hospital_history:     action admite además 'import' (una fila por IPS con cambios al importar del REPS)
función:              reps_import_apply(job uuid, payload jsonb) → jsonb (una transacción; solo service_role)
```

#### Fase 5: compras públicas SECOP (migraciones 0710, 0720 y 0730)
Detalle en `docs/fases/fase5-secop.md` y `docs/fases/fase5-fuentes-automaticas.md`. Tablas con RLS sin políticas (solo `service_role`).
```sql
secop_contratos:        contratos de SECOP; UNIQUE (fuente, id_contrato); fuente 'secop2' (jbjy-vk9h) | 'secop1' (f789-7hwg,
                        solo origen 'SECOPI'; 0730) | 'integrado' (rpmr-utcd); valor en COP (adjudicado al contratista)
secop_contratos (+0730): valor_proceso numeric(18,2) (secop1: cuantia_proceso, valor del PROCESO común a la constancia; NULL en otras)
                        valor_adiciones numeric(18,2) (secop1: valor_total_de_adiciones; valor ya las incluye; NULL en otras)
secop_contratos_unicos: vista sin doble conteo (+0730: estimado boolean = Integrado SECOP I, valor del proceso que secop_hechos()
                        reparte por partes iguales; las constancias que ya trae secop1 no entran del Integrado)
hospitals (+0730):      compra_publica boolean NULL (NULL = según el REPS; true/false = marca manual "Compra pública (SECOP)",
                        hospitals:edit; decide si la IPS es entidad objetivo de la carga de SECOP)
fuentes_estado:         estado de cada carga automática (+0730: fuente 'secop_i', cron 0 7 * * 2)
funciones:              secop_nits_ips() (publica = marca manual del NIT → REPS), secop_hechos(desde, hasta, nits, proveedores) → jsonb
                        (+0730: clave est), secop_marcar_atipicos(); solo service_role
```

#### Fase 6: app de visita · F1 Terceros (migración 0800)
Contrato en `docs/fases/fase6-visitas-f1-terceros.md`. Las 7 tablas con RLS sin políticas (solo `service_role`); `hospitals` no cambia.
```sql
cuentas:                  terceros-organización, una por identificación (UNIQUE tipo_identificacion + numero_identificacion; NIT 9 dígitos);
                          clase clinica|consultorio|eps|operador_logistico|otra, es_cliente, modalidad_facturacion (solo eps), origen hospitals|manual
sedes:                    lugares de cada cuenta (una es_principal por cuenta); reps_code UNIQUE (12 dígitos), hospital_id UNIQUE (IPS de OpMap),
                          lat/lng en Colombia, ubicacion_confirmada, origen hospitals|manual|gps_app; las de hospitals las mantiene el disparador
medicos:                  documento (UNIQUE tipo + número, protegido: solo terceros:manage), nombre, especialidades text[] (≥ 1), municipality_id;
                          un médico activo sin sede se rechaza al cerrar la transacción (constraint trigger diferido)
medico_sedes:             PK (medico_id, sede_id), rol consultorio|atiende, una principal por médico
medico_visitantes:        ejecutiva + línea + ciudad opcional por médico, desde/hasta (se terminan, no se borran); un vigente por combinación
contactos:                personas de una cuenta (y de una de sus sedes, misma cuenta por disparador), cargo_texto, rol (13 roles, default otro)
subtipos_institucionales: subtipos de visita institucional con roles_sugeridos y vigencia; semilla compras, quimico_farmaceutico,
                          autorizaciones, programacion, otro (desde 2026-10-12)
funciones:                terceros_crear_medico(p_medico, p_sedes, p_user) → uuid (médico + sedes en una transacción);
                          terceros_sincronizar_hospitals(p_hospital_id DEFAULT NULL) → jsonb (idempotente; disparador hospitals_terceros_sync)
```

#### Fase 7: app de visita · F2 Configuración y calendario (migración 0810, aplicada 2026-10-12)
Contrato en `docs/fases/fase7-visitas-f2-config-calendario.md`. Las 6 tablas con RLS sin políticas (solo `service_role`: SELECT, INSERT, UPDATE; nunca se borran).
Las 4 config_* tienen vigente_desde/vigente_hasta (inclusive; NULL = abierto), motivo, set_by, anulado_at/por/motivo (set_by y anulado_por
hacia users sin ON DELETE), anterior_id/anterior_hasta (el valor que la fila cortó o reemplazó al registrarse: vuelve a regir si se cancela o
se acorta), clave GENERADA, EXCLUDE <tabla>_sin_superposicion (sin rangos activos superpuestos por clave) y el disparador config_inmutable
(solo se cierran o se anulan).
```sql
config_metas:    metas por tipo (medica|institucional) y subtipo; scope general|zona (kam_id)|ejecutiva (executive_id); periodo dia|semana; cantidad 0..100
config_conteo:   por subtipo institucional: modo suma_institucional|meta_propia|seguimiento y peso >0..10 (clave = subtipo_id)
config_general:  9 parámetros (radio_presencial_m, plazo_gracia_horas, dias_habiles_semana, tope_visitas_medico_dia, telefonicas,
                 aprobacion_dias_libres, motivos_dia_libre, primer_mes_factor, alertas_mezcla) con valor jsonb (clave = parametro)
config_personas: por Ejecutivo Comercial: perfil text[] (medica, institucional), telefonica_habilitada, tope_telefonicas_dia, radio_m
calendario:      festivos nacionales (calculados, Ley 51 de 1983) y días de empresa o ciudad (municipality_id → municipalities); tipo no_habil|habil;
                 uno activo por fecha + alcance + municipio; se anula con motivo
dias_libres:     día (1) o medio día (0.5) por persona y fecha, motivo, estado registrado|por_aprobar|aprobado|rechazado|anulado; uno vigente por
                 persona y fecha; fuera_de_plazo exige justificación; se anula, no se borra
funciones:       config_registrar(...) → uuid y config_cerrar(...) (únicas escrituras de config_*), calendario_festivos_colombia(año),
                 calendario_cargar_festivos(año, user) → int; extensión btree_gist (schema extensions)
users (+0810):   rol 'hr' (recursos humanos) en users_role_check: calendario y días libres
```

#### Traspaso de Ejecutivos Comerciales (migración 0820, aplicada 2026-10-12)
Spec en `docs/specs/2026-10-12-traspaso-ejecutivo-comercial.md`. RLS sin políticas (solo `service_role`).
```sql
ejecutivas_traspasos:  historial INMUTABLE de traspasos (disparadores impiden UPDATE, DELETE y TRUNCATE; service_role solo SELECT e INSERT):
                       id, origen_id → executives, destino_id → executives NULL, destino_tipo existente|nueva|vacante|nadie
                       (nadie ⇔ destino_id NULL), lineas uuid[] (≥ 1), fecha, dar_de_baja, desactivar_usuario (true solo si se
                       desactivó: con baja, usuario activo de Ejecutivo Comercial sales_manager|user y distinto de quien lo hizo),
                       copiar_excepciones, motivo (≤ 500), resumen jsonb, created_by → users, created_at
medico_visitantes (+0820): fin_motivo manual|traspaso|baja|linea_quitada (NULL en las abiertas; manual por defecto al terminar sin motivo),
                       traspaso_id → ejecutivas_traspasos (llave diferida; el traspaso que la terminó o la creó)
funciones:             ejecutivas_traspasar(p jsonb, p_user uuid) → jsonb (traspaso atómico: líneas, zona de la persona nueva o vacante
                       (y su color si hay baja), ajustes manuales, nombre del territorio, visitantes (desde greatest(fecha, desde)),
                       excepciones opcionales, baja, usuario e historial)
disparadores:          executive_lines_termina_visitantes (AFTER DELETE ON executive_lines → visitantes de esa línea terminan, linea_quitada);
                       executives_baja_termina_visitantes (AFTER UPDATE OF status a inactive → todos sus visitantes terminan, baja)
```

#### App de visita · F3 visitas de la app (migración 0830, aplicada 2026-10-14)
Contrato en `docs/fases/fase8-visitas-f3-f4-reporte-y-app-movil.md` (sección "Base de datos"). `visits` (tabla del mapa de calor, 14
columnas originales; `lat/lng` numeric(10,6) NOT NULL) recibe 29 columnas; las 7.033 importadas de VMO quedan `source = 'vmo_import'` sin otro
cambio. RLS sin políticas (solo `service_role`); no hay columna de audio.
```sql
visits (+0830):    source vmo_import|app (default vmo_import), executive_id → executives, client_id uuid (UNIQUE parcial: idempotencia de la app),
                   tipo medica|institucional, subtipo_id → subtipos_institucionales + subtipo_codigo (copia), medico_id → medicos,
                   cuenta_id → cuentas, sede_id → sedes, contacto_id → contactos, modalidad presencial|telefonica, medio llamada|videollamada,
                   efectiva, failure_reason (≤ 300), retry_date, checked_in_at, reported_at, distance_m (Haversine en el servidor),
                   gps_accuracy_m, conclusion (≤ 2000), compromisos (≤ 2000), next_step_date, transcript (≤ 8000, interna),
                   input_mode voz|toques, out_of_territory (default false), created_by/updated_by → users, deleted_at + deleted_reason (anulada).
                   CHECK visits_source_check y visits_app_check (app ⇒ ejecutiva, client_id, tipo, sede, modalidad, efectiva, horas, input_mode,
                   kam_id; visit_date = fecha de checked_in_at en Bogotá; médica ⇒ médico y sin subtipo ni contacto; institucional ⇒ cuenta y
                   subtipo; presencial ⇒ distance_m y sin medio; telefónica ⇒ medio; no efectiva ⇒ motivo; next_step_date y retry_date ≥
                   visit_date; visit_type y contact_type coherentes)
                   Las de la app llenan kam_id (zona base), kam_name (ejecutiva), visit_type, contact_type, lat/lng, visit_date y hospital_id.
                   Telefónica: lat/lng = la sede, su municipio o la zona (nunca el GPS del teléfono; gps_accuracy_m NULL).
                   Una visita en una sede con ubicacion_confirmada = false se guarda pero no suma hasta que la confirmen (lo decide la API).
                   Índices visits_client_id_uidx, visits_executive_date_idx, visits_medico_idx, visits_cuenta_idx, visits_next_step_idx.
                   Disparadores update_visits_updated_at y visits_app_sin_borrar (una de la app no se borra: se anula)
visit_lines:       PK (visit_id → visits ON DELETE CASCADE, line_id → business_lines); service_role SELECT, INSERT, UPDATE, DELETE
funciones:         visitas_registrar(p jsonb, p_user uuid) → jsonb (una visita en una transacción: idempotente por client_id, mismo día, perfil,
                   radio, telefónica, topes, líneas); visitas_editar(p_id, p, p_user) y visitas_anular(p_id, p_motivo, p_user) (solo las suyas
                   del mismo día); visitas_config_vigente(executive_id, fecha) → jsonb { perfil, radio_m, tope_visitas_medico_dia,
                   telefonica }; visitas_distancia_m(lat1, lng1, lat2, lng2) → int (Haversine, radio 6371008.8 m)
```

#### App de visita · F4.1 agenda de visitas (migración 0840, aplicada 2026-10-14)
Contrato en `docs/fases/fase8-visitas-f3-f4-reporte-y-app-movil.md` (sección "F4.1"); spec
`docs/specs/2026-10-14-agenda-dictado-y-marca.md`. Una fila por cita; no se borra (se cancela). RLS sin políticas (solo `service_role`:
SELECT, INSERT, UPDATE; sin DELETE). Las escrituras pasan por `agenda_crear`, `agenda_cancelar` y `visitas_registrar` / `visitas_anular`.
```sql
visitas_agenda:    id, executive_id → executives, fecha date, hora time NULL (NULL solo en citas viejas: la API la exige desde el
                   2026-10-15), tipo medica|institucional,
                   medico_id → medicos (médica), cuenta_id → cuentas + subtipo_id → subtipos_institucionales (institucional),
                   sede_id → sedes NOT NULL, nota (≤ 300), estado pendiente|hecha|cancelada, visita_id → visits (la que la cumplió),
                   cancelada_at, cancelada_motivo (≤ 300), created_by → users, created_at (antes del día de la visita ⇒ "agendada"), updated_at
                   CHECK por tipo (médica: médico sin cuenta ni subtipo; institucional: cuenta y subtipo sin médico) y por estado
                   (pendiente: sin visita ni cancelación; hecha: con visita; cancelada: con cancelada_at y sin visita)
                   Índices únicos parciales visitas_agenda_medico_uidx (executive_id, fecha, medico_id; no canceladas),
                   visitas_agenda_cuenta_uidx (executive_id, fecha, cuenta_id, subtipo_id; no canceladas), visitas_agenda_visita_uidx;
                   visitas_agenda_executive_fecha_idx. Disparadores update_visitas_agenda_updated_at y visitas_agenda_sin_borrar
visits (+0840):    agenda_id → visitas_agenda (UNIQUE parcial visits_agenda_id_uidx: una visita no anulada por cita; la anulada conserva el
                   rastro), agendada boolean NOT NULL DEFAULT false; CHECK visits_agenda_check (agendada ⇒ agenda_id; agenda_id solo en las
                   de la app). Las 7.033 de VMO quedan agenda_id NULL y agendada false.
visits (+0910):    vmo_id bigint UNIQUE (ID de la visita en VMO; CHECK solo en source = 'vmo_import'): llave de la importación del
                   Excel de VMO › Visitas (2026-10-29). Las 7.033 viejas se borraron con respaldo (visits_vmo_respaldo_20261029,
                   visit_imports_respaldo_20261029); la importación nueva no usa visit_imports.
executives (+0910): vmo_nombre text UNIQUE (nombre del Ejecutivo Comercial como lo escribe VMO, normalizado: minúsculas, sin
                   tildes ni signos). Decisión: docs/decisiones/2026-10-29-visitas-vmo-mapa-de-calor.md.
funciones:         agenda_crear(p jsonb, p_user uuid) → jsonb { cita_id } (de hoy a hoy + 30 en Bogotá, no en día libre de día completo
                   registrado o aprobado, perfil en la fecha, sede activa de cuenta activa, médico que atiende en la sede o sede de la
                   cuenta y subtipo vigente, sin duplicados: 23505); agenda_cancelar(p_id, p_motivo, p_user) (pendiente de hoy o
                   futura, propia; P0002 ajena). visitas_registrar acepta agenda_id (validado; si no viene, vínculo automático con la
                   pendiente del mismo médico o cuenta ese día) y devuelve agenda_id y agendada; visitas_anular devuelve la cita a
                   pendiente.
```
**Hora obligatoria desde el 2026-10-15** (`docs/decisiones/2026-10-15-agenda-con-hora-y-calendario.md`): toda cita nueva
lleva hora; lo exige `citaCreateSchema` en `POST /api/me/agenda` ("Elige la hora de la cita"), no la base. `hora` sigue
`time NULL` a propósito: un `NOT NULL` rompería las citas viejas sin hora y las pruebas del bloque DO de la 0840. El
comentario de la columna (`COMMENT ON COLUMN visitas_agenda.hora`: "Hora de la cita (opcional; sin medias horas ni
ruteros)") quedó desactualizado: corregirlo en la próxima migración que haya (p. ej. "Hora de la cita (HH:MM; obligatoria
en las nuevas desde 2026-10-15, la exige la API; NULL solo en citas viejas)").
La 0850 lo corrige.

#### Actividades de campo · F1a persona de campo y agenda con resultado (migración 0850, ESCRITA, SIN APLICAR)
Spec `docs/specs/2026-10-15-actividades-de-campo.md` (F1a; decisiones A1–A17 en `docs/decisiones/`); contrato de la API en
`docs/fases/fase8-visitas-f3-f4-reporte-y-app-movil.md` (sección "F4.2"). Archivo
`database/migrations/2026-10-15_0850_persona_de_campo_y_agenda.sql`, rollback `2026-10-15_9945_persona_de_campo_y_agenda_rollback.sql`.
Quien visita y agenda es el USUARIO (`users`); el Ejecutivo Comercial pasa a ser opcional: las líderes de línea agendan y
reportan "como líder" (sin zona) y Paola (líder de una línea y Ejecutiva de otra) tiene una sola agenda. La dirección
comercial (`commercial_director`) no agenda ni reporta (A1). Transaccional, idempotente, con huellas md5 de cada función.
```sql
visits (+0850):    user_id → users (relleno desde executives.user_id en las de la app; la 0850 se detiene si alguna queda sin él).
                   visits_app_check reescrito: app ⇒ user_id; (executive_id IS NULL) = (kam_id IS NULL); out_of_territory solo con
                   Ejecutivo Comercial. Una visita "como líder": executive_id y kam_id NULL, kam_name = users.full_name.
                   Índices visits_user_date_idx (user_id, visit_date) y visits_user_next_step_idx (solo las de la app).
visitas_agenda:    + user_id → users NOT NULL (relleno desde executives.user_id), motivo_codigo, no_realizada_at, no_realizada_motivo
(+0850)            (≤ 300), eliminada_at, eliminada_por → users, viene_de → visitas_agenda ("otra fecha"); executive_id pasa a NULL
                   (NULL = como líder). 24 columnas.
                   estado pendiente | hecha | no_realizada | cancelada | eliminada; motivo_codigo cliente | prioridad | falta_tiempo |
                   fuerza_mayor | otro | salida (salida solo la pone el sistema); visitas_agenda_estado_datos_check por estado (otro
                   exige texto de 3 a 300); visitas_agenda_viene_de_check (no a sí misma).
                   Índices únicos parciales por user_id (medico_uidx y cuenta_uidx sobre pendiente y hecha; viene_de_uidx sin las
                   eliminadas: una sola "otra fecha"); visitas_agenda_user_fecha_idx. Disparador visitas_agenda_cancelar_con_motivo
                   (una cancelación nueva exige motivo_codigo).
funciones:         persona_lineas(user) (executive_lines del Ejecutivo Comercial ACTIVO ∪ líneas activas que lidera; vacío si inactivo
(nuevas)           o commercial_director); persona_de_campo(user) → jsonb {user_id, nombre, rol, executive_id, kam_id, lineas_ec,
                   lineas_lider}; ejecutivo_de_la_visita(user, lineas); medico_de_lineas(medico, lineas, fecha) (C9);
                   visitas_config_persona(executive_id | NULL, fecha) (con Ejecutivo Comercial, la suya; sin él, la general con perfil
                   médica e institucional y sin telefónica);
                   agenda_choque(user, fecha, hora, excluir) (media hora: |Δ| < 1800 s, solo pendientes y hechas con hora);
                   agenda_cerrar(p_id, p jsonb, p_user) ("no se hizo", desde su día); agenda_eliminar(p_id, p_user) (por error:
                   pendiente de hoy en adelante); agenda_otra_fecha(p_id, p, p_user) (cita nueva con viene_de);
                   agenda_cancelar_por_salida() (disparadores users_salida_cancela_agenda y executives_baja_cancela_agenda).
funciones          agenda_crear(p, p_user) (hora obligatoria; sin tope hacia adelante; hoy a una hora pasada no; `como`
(reescritas)       ejecutivo|lider; choque 23P01; viene_de); agenda_cancelar(p_id, p_motivo, p_user, p_motivo_codigo DEFAULT 'otro')
                   (reemplaza la de 3 argumentos); visitas_registrar, visitas_editar y visitas_anular por usuario (bloqueo
                   pg_advisory_xact_lock por usuario; el Ejecutivo Comercial de la visita lo decide ejecutivo_de_la_visita).
                   Todas SECURITY INVOKER, search_path = public, pg_temp, solo service_role.
```
- **Salida (A16)**: `users.active` de true a false cancela sus citas pendientes de hoy en adelante con motivo `salida`
  ("Salió de la empresa"). Un Ejecutivo Comercial que pasa a inactivo: si la persona se queda sin líneas, lo mismo; si
  sigue como líder, solo se cancelan sus citas como Ejecutivo Comercial ("Dejó de ser Ejecutivo Comercial", motivo `otro`:
  admiten otra fecha). La salida toma el candado por persona de `agenda_crear`, que lee la persona ya con el candado.
- **Otra fecha cierra la cita**: si la cita que cumplió una visita ya tiene otra fecha, `visitas_anular` no anula esa
  visita y `visitas_editar` no la pasa a efectiva ("La cita de esta visita ya tiene otra fecha: elimina primero esa otra
  fecha").
- **Mapa de asignación**: `/api/visits/filtered`, `/stats` y `/unvisited-zones` filtran `source <> 'app' OR executive_id IS
  NOT NULL` (una visita como líder no tiene zona y no pinta el mapa).
- **Rollback 9945**: se detiene (con cuentas) si hay citas `no_realizada`, `eliminada`, con `viene_de` o sin Ejecutivo
  Comercial, o visitas de la app sin Ejecutivo Comercial; si no, deja las funciones con los cuerpos exactos de la 0840/0830
  (huellas md5 comprobadas) y las tablas con 45 y 17 columnas.

#### Zonas por línea · líneas permitidas y redistribución (migraciones 0860 y 0870, escritas 2026-10-23, SIN APLICAR)
Spec `docs/specs/2026-10-23-zonas-por-linea-para-lideres.md`; decisión `docs/decisiones/2026-10-23-zonas-por-linea-las-lideres-asignan.md`.
RLS sin políticas (solo `service_role`). Se aplican solo con autorización del dueño, en la ventana del despliegue.
```sql
executive_allowed_lines (0860):  líneas que la dirección permite a una persona o vacante. SIN FILAS = SIN RESTRICCIÓN.
                                 executive_id → executives ON DELETE CASCADE, line_id → business_lines ON DELETE CASCADE,
                                 created_by → users NULL (NULL = lo puso una migración), created_at; PK (executive_id, line_id);
                                 índice executive_allowed_lines_line_id_idx. Regla que hace cumplir la API: executive_lines ⊆
                                 executive_allowed_lines cuando hay filas (PATCH /api/executives/[id] → 400; PUT
                                 /api/executives/[id]/lineas/[lineId] → 409). Si la tabla no existe, la API responde
                                 lineas_permitidas = null (sin 500). Rollback 9946: DROP TABLE.
executive_lines_respaldo_20261023 (0870): copia de executive_lines (executive_id, line_id, respaldado_en) tomada ANTES de borrar
                                 todas las líneas asignadas para redistribuirlas desde Zonas. Nunca se pisa un respaldo con filas;
                                 la app no lo lee; service_role solo SELECT. Conservar.
0870 (DATOS):                    respaldo → DELETE FROM executive_lines (el disparador executive_lines_termina_visitantes de la
                                 0820 termina los visitantes de cada línea borrada, fin_motivo linea_quitada) → dos restricciones en
                                 executive_allowed_lines: persona ACTIVE con base en la Zona area_id 08001 que llevaba perossal en el
                                 respaldo → perossal y reemplazo; vacante PLACEHOLDER con base en esa Zona → deportiva, columna y
                                 trauma (sin nombres en el SQL; RAISE si no hay exactamente una de cada). DESPUÉS: recalcular la
                                 cobertura (npm run fase2:recalculate o "Recalcular cobertura" en /lines). Rollback 9947: quita esas
                                 restricciones, restaura executive_lines desde el respaldo (ON CONFLICT DO NOTHING, conserva lo
                                 asignado después) y NO borra el respaldo ni reabre visitantes; después, recalcular. Orden: 9947 antes
                                 que 9946.
```

### Vistas

#### 1. `kam_statistics`
Vista que calcula estadísticas por KAM.
```sql
- id: uuid (KAM ID)
- name: varchar
- total_hospitals: bigint
- total_municipalities: bigint
- total_opportunity_value: numeric
- avg_travel_time: numeric
```

#### 2. `territory_assignments`
Vista que muestra asignaciones por territorio.
```sql
- municipality_id: varchar
- locality_id: varchar
- department_id: varchar
- kam_id: uuid
- kam_name: varchar
- kam_color: varchar
- hospital_count: bigint
```

### Tablas del Sistema (PostGIS)

- `spatial_ref_sys`: Sistemas de referencia espacial
- `geography_columns`: Columnas geográficas
- `geometry_columns`: Columnas geométricas

### Índices y Restricciones Importantes

1. **Unicidad**:
   - `hospitals.code` debe ser único
   - `users.email` debe ser único

2. **Claves Foráneas**:
   - Todas las referencias a `users`, `hospitals`, `kams` están protegidas
   - Cascada de eliminación configurada donde corresponde

3. **Índices de Rendimiento**:
   - Índices en coordenadas para búsquedas geoespaciales
   - Índices en claves foráneas para joins eficientes
   - Índices en campos de búsqueda frecuente (active, department_id, etc.)

### Políticas RLS (Row Level Security)

Tras el endurecimiento (database/hardening/) el acceso a datos se hace desde el servidor con
`service_role` (lib/supabase-admin.ts); las tablas sensibles tienen RLS sin políticas para
anon/authenticated. Los roles de la app (`admin`, `sales_manager`, `contract_manager`,
`data_manager`, `viewer`, `user`) se controlan en cada ruta API con requirePermission
(web/lib/require-role.ts + web/lib/permissions.ts), no con políticas RLS por rol.
