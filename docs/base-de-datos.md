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
- created_at, updated_at: timestamp
```

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
- role: text (CHECK: 'admin', 'sales_manager', 'contract_manager', 'data_manager', 'viewer', 'user'; permisos por rol en web/lib/permissions.ts)
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
