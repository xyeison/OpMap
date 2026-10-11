# Migraciones — Fase 1: zonas y equipo

> **ESTADO: NADA DE ESTO SE HA EJECUTADO.** Los scripts se generaron el 2026-10-10 a partir del
> estado vivo del proyecto `norvxqgohddgsdkggqzq`, consultado solo con `SELECT`. No se ha lanzado
> ningún DDL/DML contra la base. Ejecutarlos es decisión del dueño.

## Modelo

La Fase 1 separa tres cosas que hoy se mezclan en el "KAM":

| Concepto | Dónde vive | Nota |
|---|---|---|
| **Zona** (geografía, ciudad base, tiempo de viaje) | `kams` (no se renombra) | En la UI "KAM" pasa a llamarse **Zona**; la tabla `zones` actual se muestra como **Región**. En código sigue siendo `kam_id`. |
| **Persona** (ejecutiva) | `executives` | Zona base (`base_kam_id`), usuario de la app opcional, id de empleado de Odoo, estado `active` / `placeholder` / `inactive`. |
| **Línea** | `business_lines` | PerOssal, Reemplazo articular, Medicina deportiva, Columna, Trauma. |

Tablas de relación: `executive_lines` (qué líneas lleva cada ejecutiva), `line_zones` (en qué
zonas opera cada línea según los equipos), `coverage` y `coverage_overrides` (se crean ahora, se
llenan en la Fase 2).

Las 6 tablas nacen con **RLS activado, sin políticas y sin privilegios para `anon`/`authenticated`**:
solo el servidor las usa con `service_role`. Es lo mismo que fija `database/hardening/02` y `03`.

## Orden

| # | Archivo | Qué hace | Destructivo |
|---|---|---|---|
| 1 | `2026-10-10_0100_fase1_schema.sql` | Crea las 6 tablas, índices, triggers `updated_at`, RLS, REVOKE y comentarios | No |
| 2 | `2026-10-10_0200_fase1_seed.sql` | 5 líneas, 11 ejecutivas + 2 placeholders, líneas por ejecutiva, matriz línea × zona (16 zonas × 5 líneas = 80 filas) | No |
| 3 | `2026-10-10_0300_fase1_zonas.sql` | Activa Cartagena (13001) e Ibagué (73001); borra `KAM Barranquilla MD` y `Kam Valledupar MD` tras comprobar que no tienen datos ligados | Sí (borra 2 filas de `kams`, sin dependientes) |
| — | `2026-10-10_9900_fase1_rollback.sql` | Sección A: borra las 6 tablas. Sección B: re-desactiva Cartagena e Ibagué | Sí |

`0300` es independiente de `0100`/`0200` y puede ir antes o después, pero el orden recomendado es
el de la tabla. **Inmediatamente después de `0300` hay que recalcular las asignaciones desde la
app** (botón de recálculo de la página principal → `POST /api/recalculate-simplified`): el script
no toca `assignments`, y hasta recalcular Cartagena e Ibagué aparecen en el mapa con 0 IPS.

Cuándo ejecutar: `0100` y `0200` antes de desplegar el código que usa `/api/business-lines` y
`/api/executives` (sin las tablas esas rutas fallan). `0300` en una ventana en la que se pueda
recalcular enseguida.

## Cómo ejecutar

1. Supabase Dashboard → SQL Editor (rol `postgres`): pegar el archivo entero y ejecutar.
   O bien: `psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f <archivo>`.
2. Cada archivo es una transacción (`BEGIN … COMMIT`) con comprobaciones al final. Si algo no
   queda como se espera, lanza `RAISE EXCEPTION` y **no se aplica nada de ese archivo**.
3. Todos son re-ejecutables. Matices de `0200`:
   - No pisa lo editado desde la app en campos de gestión (líder de línea, `max_reach_minutes`,
     `active`, estado de la ejecutiva, `user_id`/`notes` ya rellenados).
   - `executive_lines` y `line_zones` solo añaden; nunca quitan lo que se haya desmarcado.
   - Los placeholders se identifican por `full_name`. Si al contratar se renombra
     "Nueva Barranquilla" o "Nueva Bogotá" (lo recomendado), volver a correr `0200` crearía otro
     placeholder. **No re-ejecutar `0200` una vez se empiece a editar desde la app.**
4. Mensajes esperados (`NOTICE`): `Fase 1 seed OK: 5 líneas, 13 ejecutivas, 16 zonas en la matriz
   (80 filas)` y `Fase 1 zonas OK. SIGUIENTE PASO: recalcular asignaciones desde la app.`

## Datos comprobados con SELECT (2026-10-10)

- Ninguna de las 6 tablas existe todavía. `update_updated_at_column()` existe. PostgreSQL 17.4.
- Zonas por `area_id` (excluyendo las filas "MD"): 05001 Medellín, 08001 Barranquilla,
  1100102 Chapinero, 13001 Cartagena, 20001 Valledupar, 23001 Montería, 52001 Pasto,
  54001 Cúcuta, 66001 Pereira, 68001 Bucaramanga, 73001 Ibagué, 76001 Cali — una fila cada una.
  08001 y 20001 tienen además la fila "MD"; `0200` las descarta por nombre (`\sMD$`).
- Usuarios existentes en `users`: líderes `m.cobo@`, `sramirez@`, `mn@`; ejecutivas
  `carmenbarrios@` y `m.buelvas@`. Las otras 9 ejecutivas no tienen usuario: quedan con
  `user_id = NULL` hasta que se les cree.
- `KAM Barranquilla MD` y `Kam Valledupar MD`: inactivas, 0 asignaciones, 0 distancias,
  0 asignaciones forzadas, 0 visitas. `KAM Cartagena` tiene 191 visitas históricas (no se borra).
- Neiva (41001) sigue activa (zona vacante); Sincelejo (70001) sigue inactiva.

## Cómo volver atrás

`2026-10-10_9900_fase1_rollback.sql`, por secciones (cada una es su propia transacción):

- **A** — borra las 6 tablas (con todos sus datos) y quita el comentario de `kams`.
- **B** — re-desactiva Cartagena e Ibagué; luego **recalcular desde la app**. Las zonas MD
  borradas no se reactivan con un UPDATE (ya no existen); al final de B va comentado el INSERT
  con sus valores exactos por si hicieran falta.

---

# Migraciones — Fase 2: cobertura por línea

> **ESTADO: NADA DE ESTO SE HA EJECUTADO.** Generado el 2026-10-11 a partir del estado vivo de
> `norvxqgohddgsdkggqzq`, consultado solo con `SELECT`. Requiere la Fase 1 aplicada.

## Qué cambia

| Tabla | Cambio |
|---|---|
| `users` | `users_role_check` admite 8 roles: los 6 de antes + `line_leader` (líder de línea) y `commercial_director` (dirección comercial). |
| `users` | 2 usuarios nuevos `line_leader`: Stefania Andrea Gonzalez Torres (`s.gonzalez@`, Medicina deportiva) y Yineth Paola Jiménez Escobar (`y.jimenez@`, Trauma). Contraseña aleatoria en bcrypt (pgcrypto `crypt(gen_random_uuid()::text, gen_salt('bf', 12))`): **nadie la conoce; el admin la cambia desde /users** antes de entregar el acceso. |
| `users` | `m.cobo@`, `sramirez@`, `mn@` → `line_leader`; `laurab@` → `commercial_director` (los 4 eran `sales_manager`). |
| `business_lines` | Líder de `deportiva` → `s.gonzalez@`; de `trauma` → `y.jimenez@` (solo si estaba vacío). Las 5 líneas quedan con líder. |
| `executives` | `y.jimenez@` queda ligada a su usuario nuevo. Nueva columna `color` (`#RRGGBB`, CHECK de formato, NULL permitido) con un color por ejecutiva. |
| `kams` | Nueva columna `base_city` y renombre de las 17 zonas por `area_id` (tabla abajo). |
| `coverage` | `kind` admite `conflict`; columnas nuevas `nearest_executive_id` (FK a `executives`, `ON DELETE SET NULL`), `nearest_minutes`, `has_equipment` (NOT NULL, default true) y `note`. |

### Zonas: nombre nuevo y ciudad base

| area_id | Nombre hoy | Nombre nuevo (`kams.name`) | `base_city` |
|---|---|---|---|
| 08001 | Barranquilla | Atlántico y Magdalena | Barranquilla |
| 13001 | Cartagena | Bolívar | Cartagena de Indias |
| 23001 | Montería | Córdoba y Sucre | Montería |
| 20001 | Valledupar | Cesar y La Guajira | Valledupar |
| 68001 | Bucaramanga | Santander | Bucaramanga |
| 54001 | Cúcuta | Norte de Santander | San José de Cúcuta |
| 05001 | Medellín | Antioquia | Medellín |
| 66001 | Pereira | Eje Cafetero | Pereira |
| 73001 | Ibagué | Tolima | Ibagué |
| 76001 | Cali | Valle y Cauca | Cali |
| 52001 | Pasto | Nariño | Pasto |
| 41001 | Neiva | Huila y Caquetá | Neiva |
| 1100102 | Chapinero | Bogotá – Chapinero | Chapinero |
| 1100110 | Engativá | Bogotá – Engativá | Engativá |
| 1100108 | Kennedy | Bogotá – Kennedy | Kennedy |
| 1100104 | San Cristóbal | Bogotá – San Cristóbal | San Cristóbal |
| 70001 | Sincelejo (inactiva) | Sucre (Sincelejo) | Sincelejo |

`base_city` sale de `municipalities.name` (area_id de 5 dígitos) o del `locality_name` más
frecuente de las IPS con ese `locality_id` (7 dígitos; en 1100108 hay 7 IPS "Kennedy" y 1
"Rafael Uribe Uribe", dato sucio). **Ojo con el importador de visitas:** los nombres DANE de
13001 y 54001 son "Cartagena de Indias" y "San José de Cúcuta". Un Excel que traiga "Cartagena"
o "Cúcuta" no casa ni con el nombre nuevo de la zona ni con `base_city` exacto; el importador debe
aceptar también esos nombres cortos (o comparar por prefijo / sin "de Indias", "San José de").

### Colores de ejecutiva

Paleta categórica de 13 colores, sin gris (`#9ca3af` = Vacante en el mapa) ni ámbar
(`#f59e0b` = Conflicto). Vecinas en el mapa que comparten línea quedan en familias distintas.

| Ejecutiva | Zona base | Color |
|---|---|---|
| Carmen Barrios | Barranquilla | `#1f77b4` azul |
| Alexa Ocampo | Cartagena | `#ad494a` ladrillo |
| Mileydis Buelvas | Montería | `#2ca02c` verde |
| Leyda Santiago | Valledupar | `#9467bd` violeta |
| Diana Caicedo | Bucaramanga | `#d95f02` naranja oscuro |
| Linda Barrera | Cúcuta | `#17becf` cian |
| Viviana Delgado | Medellín | `#e377c2` rosa |
| María Isabel Díaz | Pereira | `#8c564b` marrón |
| Joana Gálvez | Cali | `#393b79` azul marino |
| Diana Guerrero | Pasto | `#bcbd22` oliva |
| Yineth Paola Jiménez | Bogotá (Chapinero) | `#d62728` rojo |
| Nueva Barranquilla (placeholder) | Barranquilla | `#7b4173` ciruela |
| Nueva Bogotá (placeholder) | Bogotá (Chapinero) | `#637939` musgo |

Las ejecutivas que se creen desde la app nacen con `color = NULL`: la app debe usar un color por
defecto y permitir elegirlo en /executives.

## Orden y despliegue

| # | Archivo | Qué hace | Destructivo |
|---|---|---|---|
| 4 | `2026-10-11_0400_fase2_cobertura.sql` | Todo lo de arriba, con comprobaciones finales | No (cambia nombres de zona y roles; reversible con 9910) |
| — | `2026-10-11_9910_fase2_rollback.sql` | Deshace 0400 | Sí (borra `coverage`, colores, `base_city`; borra o desactiva los 2 usuarios nuevos) |

**0400 y el código de Fase 2 van en la misma ventana.** Con la base migrada y el código viejo,
`line_leader` y `commercial_director` no existen en `lib/permissions.ts` y `hasPermission()` les
niega todo: las 3 líderes actuales y Laura se quedan sin acceso hasta desplegar. Con el código
nuevo y la base sin migrar fallan las consultas a `kams.base_city`, `executives.color` y las
columnas nuevas de `coverage`. Lo más limpio: ejecutar 0400 e inmediatamente desplegar.

Después de desplegar:

1. **Recalcular la cobertura**: /lines → "Recalcular cobertura" (`POST /api/coverage/recalculate`).
   Hasta entonces `coverage` está vacía y el mapa por línea no tiene qué pintar.
2. **Cambiar la contraseña** de `s.gonzalez@` y `y.jimenez@` desde /users y entregársela.

Mensaje esperado (`NOTICE`): `Fase 2 OK: 8 roles, 2 usuarios nuevos, 5 líneas con líder, 17 zonas
con base_city y nombre nuevo, 13 colores, coverage ampliada. …`. Si aparece un `WARNING` de
colores repetidos, no aborta: revisar en /executives.

Re-ejecutable: usuarios nuevos `ON CONFLICT DO NOTHING`; líderes, `executives.user_id`,
`base_city` y `color` solo se rellenan si están vacíos. **Los roles y los nombres de zona se
re-aplican siempre**: si ya se editaron desde la app, re-ejecutar 0400 los devuelve a estos valores.

## Datos comprobados con SELECT (2026-10-10/11)

- `users_role_check` = admin, user, viewer, sales_manager, contract_manager, data_manager.
- `m.cobo@`, `sramirez@`, `mn@`, `laurab@` existen, activos, `sales_manager`. `s.gonzalez@` y
  `y.jimenez@` no existen.
- pgcrypto 1.3 en el esquema `extensions` (el script llama `extensions.crypt` /
  `extensions.gen_salt`). Probado con SELECT: produce `$2a$12$…` de 60 caracteres, que
  `lib/passwords.ts` reconoce como bcrypt (bcryptjs verifica `$2a$`).
- `business_lines`: perossal → m.cobo@, reemplazo → sramirez@, columna → mn@, deportiva y
  trauma sin líder; las 5 con `max_reach_minutes = 240`.
- `executives`: 11 con correo + 2 placeholders; y.jimenez@ con `user_id` NULL.
- `kams`: 17 filas, un `area_id` por fila; los 12 de 5 dígitos existen en `municipalities.code`
  y los 4 de 7 dígitos tienen IPS con ese `locality_id`.
- `coverage` y `coverage_overrides`: 0 filas. `coverage_kind_check` sin `conflict`.
- El rol se lee de `users` en cada petición (`lib/auth-server.ts`), así que el cambio de rol
  aplica sin cerrar sesión.

## Cómo volver atrás

Primero volver a desplegar el código anterior a la Fase 2; luego ejecutar
`2026-10-11_9910_fase2_rollback.sql` (una transacción): vacía `coverage` y quita sus 4 columnas
y `conflict`; quita `executives.color`; devuelve los nombres de zona del 2026-10-10 y quita
`base_city`; deja deportiva y trauma sin líder; pasa a `sales_manager` a todo usuario
`line_leader`/`commercial_director`; borra `s.gonzalez@` y `y.jimenez@` (o, si ya tienen datos
ligados, los desactiva como `viewer`); y restaura el CHECK de 6 roles.

---

# Migraciones — Fase 2b: municipios y anexos de territorio

> **ESTADO: NADA DE ESTO SE HA EJECUTADO.** Generado el 2026-10-11 a partir del estado vivo de
> `norvxqgohddgsdkggqzq`, consultado solo con `SELECT`. Requiere las Fases 1 y 2 aplicadas.

## Regla de negocio (decisión del dueño, va al contrato)

El mapa cubre **todos** los municipios, con dos intensidades:

- **Con IPS objetivo (visitar)**: color fuerte. La zona sale de la asignación de IPS, con la
  misma regla de mayoría con la que el mapa colorea territorios.
- **Sin IPS hoy**: color suave. Se reparten por **tiempo real de carretera** (Google Distance
  Matrix, modo `driving`) desde la ciudad base de cada zona, **nunca por distancia en línea
  recta**: dos municipios vecinos pueden no tener carretera entre sí, y no se entrega a nadie
  un municipio al que no puede llegar. Si mañana abre allí una clínica, ya se sabe qué zona la
  atiende.
  - Google no encuentra ruta → **sin acceso terrestre** (`no_road`): no se asigna a nadie.
  - La ruta supera el tope de la zona (`kams.max_travel_time`, minutos) → **fuera de alcance**
    (`out_of_reach`): no se asigna; la zona más cercana se guarda solo como dato.
  - Candidatas: zonas activas del departamento del municipio o de departamentos adyacentes de
    nivel 1 o 2 (`department_adjacency`, en los dos sentidos). Mismo criterio que las IPS.

## Qué crea

| Tabla | Para qué |
|---|---|
| `municipality_travel_times` | Caché **permanente** de tiempos zona → municipio de Google. `status`: `ok` (minutos y km), `no_route` (sin ruta por carretera), `error` (se reintenta). Un par `ok`/`no_route` nunca se vuelve a pedir. Único por (`kam_id`, `municipality_code`). |
| `municipality_zone` | Zona de cada municipio: `ips`, `reach`, `out_of_reach`, `no_road`, `pending`. `kam_id` solo en `ips`/`reach` (CHECK). Se recalcula completo; no editar a mano. |
| `territory_snapshots` | Versiones **inmutables** del territorio de un ejecutivo comercial en una línea (resumen, anexo A = IPS, anexo B = municipios por departamento, `content_hash` sha256). Únicas por (línea, ejecutivo, etiqueta). |
| `line_territory_names` | Nombre comercial de la zona de cada ejecutivo comercial por línea (PK línea + ejecutivo; `updated_at` con trigger). |

Seguridad: las 4 con **RLS activado, sin políticas, sin privilegios para `anon`/`authenticated`/
`PUBLIC`** y `GRANT` explícito a `service_role`. En `territory_snapshots` `service_role` solo
tiene `SELECT` e `INSERT` (el `pg_default_acl` de `postgres` le daría también UPDATE/DELETE/
TRUNCATE; se revocan).

**Inmutabilidad**: función `territory_snapshots_immutable()` (search_path fijo, sin EXECUTE para
anon/authenticated) y dos triggers: `BEFORE UPDATE OR DELETE` por fila y `BEFORE TRUNCATE` por
sentencia. Lanzan `SQLSTATE OPM01`; ni `service_role` ni `postgres` los saltan. Para "cambiar" un
anexo se guarda otra versión con otra etiqueta.

Decisiones además de la especificación:

- `municipality_zone.nearest_kam_id` con `ON DELETE SET NULL` (igual que `kam_id`): es un dato
  recalculable y no debe impedir borrar una zona.
- CHECKs de coherencia: `status = 'ok'` ⇔ `travel_minutes` no nulo; minutos, km e `ips_count` ≥ 0.
- FKs de `territory_snapshots` sin acción: no se puede borrar un usuario que haya guardado una
  versión (los usuarios se desactivan) ni una línea o ejecutivo con versiones.

## Orden y despliegue

| # | Archivo | Qué hace | Destructivo |
|---|---|---|---|
| 5 | `2026-10-11_0500_fase2b_municipios_anexos.sql` | Crea las 4 tablas, índices, triggers, RLS, REVOKE/GRANT y comentarios; comprueba todo | No |
| — | `2026-10-11_9920_fase2b_rollback.sql` | Borra las 4 tablas y la función | Sí (incluida la caché pagada a Google) |

1. Ejecutar `0500` **antes** de desplegar el código de Fase 2b (sin las tablas fallan
   `/api/municipality-coverage` y `/api/territory/**`). Con la base migrada y el código viejo
   no pasa nada: nadie usa las tablas.
2. Desplegar.
3. `cd web && npx tsx scripts/fase2b-municipios.ts` (por defecto `--dry-run`, **no llama a
   Google**): da municipios por tipo, pares pendientes y el costo estimado exacto.
4. Con la autorización del dueño sobre esa cifra: `--run --max-elements N` y luego `--assign`.

Mensaje esperado (`NOTICE`): `Fase 2b OK: 4 tablas con RLS, 0 políticas, 0 privilegios para
anon/authenticated, territory_snapshots inmutable (UPDATE/DELETE/TRUNCATE bloqueados). …`

El bloque final hace una **prueba real** de inmutabilidad: inserta una versión
`__autoprueba_0500__`, intenta UPDATE, DELETE y TRUNCATE, y lo deshace todo dentro de la misma
transacción (no queda ninguna fila). Usa la primera línea y el primer ejecutivo existentes.

Re-ejecutable: sí (`IF NOT EXISTS` / `OR REPLACE`). Si una tabla ya existiera con otra forma, el
bloque final lo detecta (cuenta las 30 columnas y las 11 FKs) y aborta.

## Datos comprobados con SELECT (2026-10-10/11)

- `municipalities`: **`PRIMARY KEY (code)`** (`municipalities_pkey`), `code varchar(10) NOT NULL`,
  1.121 filas, todas de 5 dígitos, 0 sin lat/lng, 11001 (Bogotá) presente. La FK desde `text`
  funciona (varchar se compara con el operador de text).
- Ninguna de las 4 tablas existe; no existe `territory_snapshots_immutable()`.
- `kams.id`, `business_lines.id`, `executives.id`, `users.id`: uuid PK. `kams.max_travel_time`
  existe. 5 líneas, 13 ejecutivos (los 13 con color: Fase 2 aplicada).
- `gen_random_uuid()` disponible (PostgreSQL 17.4). `update_updated_at_column()` existe.
- `pg_default_acl` de `postgres` en `public` ya no concede nada a anon/authenticated
  (hardening/03 aplicado), pero sí `arwdDxtm` a `service_role`.
- Las consultas de verificación del bloque final (aclexplode, has_table_privilege con
  TRUNCATE, has_function_privilege, conteo de columnas/FKs) se probaron como SELECT sobre
  tablas existentes.

## Cómo volver atrás

Primero volver a desplegar el código anterior a la Fase 2b; luego
`2026-10-11_9920_fase2b_rollback.sql` (una transacción). **Va antes que 9910 y 9900**: las 4
tablas tienen FKs hacia `business_lines`, `executives` y `users`.

- Borra `municipality_travel_times`: la caché de Google se pierde y re-aplicar la Fase 2b
  obligaría a pagar de nuevo. Si solo se quiere apagar la función, revertir el código y dejar
  las tablas.
- Si `territory_snapshots` tiene versiones (documentos contractuales), el script **se niega**
  salvo que antes, en la misma sesión, se ejecute `SET opmap.rollback_drop_snapshots = 'on';` (en el SQL Editor: esa línea encima
  del script, ejecutando todo junto). Exportarlas primero.

---

# Migraciones — Fase 3: sedes del REPS (IPS por código de habilitación)

> **ESTADO: APLICADA** el 2026-10-11 en `norvxqgohddgsdkggqzq` (autorizado: es aditiva). Detalle del
> modelo, reglas del cruce, scripts y UI en `docs/fases/fase3-reps.md`.

| # | Archivo | Qué hace | Destructivo |
|---|---|---|---|
| 6 | `2026-10-11_0600_fase3_reps.sql` | Crea `reps_sedes` (PK código de habilitación, 24 columnas, RLS sin políticas, solo `service_role`); añade a `hospitals` `reps_code` (UNIQUE, 12 dígitos), `nit` (GENERADA desde `code`), `reps_matched_at`, `reps_match_status` (CHECK y coherencia `matched` ⇔ `reps_code`), índice por `nit` | No |
| — | `2026-10-11_9930_reps_rollback.sql` | Quita las 4 columnas de `hospitals` (se pierden los vínculos, también los manuales) y borra `reps_sedes` | Sí |

- `reps_code` no tiene FOREIGN KEY a `reps_sedes` a propósito ("FK suave"): la tabla se recarga con
  cada corte mensual del REPS y una sede puede desaparecer; la app valida al vincular.
- `nit` es columna generada (STORED): añadirla reescribe la tabla sin disparar triggers de fila
  (`updated_at` no cambia). No se puede escribir: un INSERT/UPDATE que la incluya falla.
- Después de aplicar: `scripts/reps-load-sedes.ts --file <csv>` y `scripts/reps-match.ts` (informe) →
  `--apply`. Las escrituras de `--apply` sí mueven `updated_at` (disparador
  `update_hospitals_updated_at`); la cola de pendientes no lo usa.
- Rollback: si otra migración de la Fase 3 creó FOREIGN KEY hacia `reps_sedes` o `hospitals.reps_code`,
  su rollback va antes. Exportar antes los vínculos si importan.

---

# Migraciones — Fase 3: giros directos de la ADRES

> **ESTADO: APLICADA** el 2026-10-11 en `norvxqgohddgsdkggqzq` (aditiva: 2 tablas y 1 función nuevas;
> no toca tablas existentes). Detalle de la fuente, limitaciones, script de carga, API y UI en
> `docs/fases/fase3-adres.md`.

| # | Archivo | Qué hace | Destructivo |
|---|---|---|---|
| 7 | `2026-10-11_0610_fase3_adres.sql` | Crea `adres_giros` (UNIQUE nit+periodo+regimen+tipo+EPS, CHECKs de formato, índice por periodo) y `adres_fetch_log` (bitácora ok / sin_registros / error); función `adres_giros_resumen(desde, hasta, regimen)` → jsonb por NIT y mes (SECURITY INVOKER, EXECUTE solo `service_role`). RLS sin políticas, sin privilegios para anon/authenticated/PUBLIC | No |
| — | `2026-10-11_9930_adres_rollback.sql` | Borra la función y las 2 tablas | Sí (solo datos públicos descargados de la ADRES; se recargan con el script) |

- Aplicada con el MCP de Supabase sin el `BEGIN/COMMIT` del archivo (la herramienta ya envuelve en una
  transacción); el bloque final de comprobaciones pasó (RLS, 0 políticas, 0 privilegios para
  anon/authenticated, `service_role` con SELECT/INSERT/UPDATE/DELETE, función solo `service_role`,
  22 columnas).
- Después de aplicar: `cd web && node scripts/adres-giros.mjs --desde 2023-07` (todos los NIT de IPS
  activas; reanudable). El 2026-10-11 se probó con 3 NIT (512 filas) y después se lanzó la carga completa (701 NIT,
  `--desde 2023-07`); el estado real está en `adres_fetch_log`.
- Rollback independiente: las tablas no tienen FKs hacia ni desde otras tablas.

---

# Migraciones — Fase 3: servicios habilitados y capacidad instalada del REPS

> **ESTADO: APLICADA** el 2026-10-11 en `norvxqgohddgsdkggqzq` (aditiva: 3 tablas, 5 columnas en
> `hospitals`, 1 función; el CHECK de `hospital_history.action` solo se amplía con `'import'`). Detalle
> del procedimiento, reglas, API y UI en `docs/fases/fase3-servicios-capacidad-reps.md`.

| # | Archivo | Qué hace | Destructivo |
|---|---|---|---|
| 8 | `2026-10-11_0620_fase3_servicios.sql` | Crea `hospital_services` (UNIQUE reps_code+service_code+modality), `hospital_capacity` (UNIQUE reps_code+group_name+concept; grupo camas/salas/ambulancias/otros) y `hospital_import_jobs` (token de la simulación, caduca a los 30 min); añade a `hospitals` `quirofanos`, `reps_beds`, `service_flags` (jsonb NOT NULL default `{}`), `reps_services_count`, `reps_updated_at`; amplía `hospital_history_action_check` con `import` conservando los valores que ya admita; función `reps_import_apply(uuid, jsonb)` (una transacción, `FOR UPDATE` del job, EXECUTE solo `service_role`). RLS sin políticas, sin privilegios para anon/authenticated/PUBLIC | No |
| — | `2026-10-11_9930_servicios_rollback.sql` | Borra la función, las 3 tablas y las 5 columnas; las filas de `hospital_history` con `import` pasan a `edited` con `changes.original_action = 'import'` (la cola de pendientes las ignora: no tienen `zone_fields`) y se quita `import` del CHECK | Sí (lo importado del REPS; se reimporta desde los archivos) |

- Aplicada con el MCP de Supabase sin el `BEGIN/COMMIT` del archivo; el bloque final de comprobaciones
  pasó (5 columnas, RLS en las 3 tablas, 0 políticas, 0 privilegios para anon/authenticated, función
  solo `service_role`, CHECK de `hospital_history` = activated, deactivated, edited, import).
- `service_flags NOT NULL DEFAULT '{}'` no reescribe la tabla (default constante, PostgreSQL ≥ 11). Las
  escrituras del importador sí mueven `hospitals.updated_at` (disparador); la cola de pendientes no lo usa.
- Si otra migración redefine `hospital_history_action_check`, debe conservar `'import'` (si no,
  `reps_import_apply` falla y no se aplica nada: es una sola transacción).
- Prueba de la función en una transacción deshecha (2026-10-11): 1 IPS real con servicios, capacidad,
  banderas e historial → todo correcto, segunda aplicación bloqueada (OPM11); 30.000 servicios en
  729 ms. Después de deshacer: 0 filas en las tablas nuevas y 0 IPS tocadas.
- Rollback independiente de 9930_reps y 9930_adres (las tablas no tienen FKs hacia `reps_sedes`).

---

# Migraciones — Fase 4: población (BDUA, cifras de MinSalud, proyecciones DANE)

> **ESTADO: APLICADA** el 2026-10-11 en `norvxqgohddgsdkggqzq` (aditiva: 4 tablas nuevas; no toca
> tablas existentes). Detalle de las fuentes, el modelo, los alias, los scripts y las cifras cargadas en
> `docs/fases/fase4-poblacion.md`.

| # | Archivo | Qué hace | Destructivo |
|---|---|---|---|
| 10 | `2026-10-11_0640_poblacion.sql` | Crea `municipio_alias` (PK fuente+departamento+nombre normalizado, FK a `municipalities`, semilla de 55 alias de la BDUA verificados), `bdua_afiliados` (UNIQUE corte+régimen+nombres de la fuente+EPS+estado+zona; código DANE derivado, NULL = sin cruce), `afiliacion_cifras` (UNIQUE corte+municipio; corte = último día del mes, CHECK) y `dane_proyecciones` (PK municipio+año, CHECK cabecera+resto=total). RLS sin políticas, sin privilegios para anon/authenticated/PUBLIC, GRANT a `service_role` | No |
| — | `2026-10-11_9930_poblacion_rollback.sql` | Borra las 4 tablas | Sí (datos públicos descargados y los alias; se recuperan re-aplicando 0640 y corriendo los 3 scripts) |

- Aplicada con el MCP de Supabase sin el `BEGIN/COMMIT` del archivo; el bloque final de comprobaciones
  pasó (RLS en las 4, 0 políticas, 0 privilegios para anon/authenticated, `service_role` con
  SELECT/INSERT/UPDATE/DELETE, 43 columnas, 55 alias `bdua`).
- Después de aplicar (desde `web/`): `npx tsx scripts/dane-proyecciones-load.ts --file <xlsx 2020-2035>`,
  `npx tsx scripts/minsalud-cifras-load.ts --dir <carpeta de ZIP>` y `npx tsx scripts/bdua-load.ts`.
  Cargados el 2026-10-11: 7.854 / 15.792 / 53.634 filas.
- Sin FOREIGN KEY en los códigos de las 3 tablas de datos (las fuentes usan 00000, "-SM", 27086, 27493,
  94663, que no están en `municipalities`). `municipio_alias` sí tiene FK.
- Rollback independiente de los demás. Si una migración posterior crea funciones sobre estas tablas
  (p. ej. 0660 de la API de población), su rollback va antes.

# Migraciones — Fase 4: funciones de lectura de la API de población

| # | Archivo | Qué hace | Destructivo |
|---|---|---|---|
| 11 | `2026-10-11_0660_poblacion_api.sql` | Crea `poblacion_cortes()` (cortes de `afiliacion_cifras` y `bdua_afiliados`, años de `dane_proyecciones`) y `poblacion_bdua_resumen(p_corte, p_top_eps = 12)` (afiliados activos por municipio y régimen, las N EPS más grandes por municipio y sus nombres), en un jsonb cada una. SECURITY INVOKER, `search_path` fijo, EXECUTE solo `service_role`. No toca tablas ni datos | No |
| — | `2026-10-11_9930_poblacion_api_rollback.sql` | Borra las 2 funciones | No (no hay datos) |

- Aplicada el 2026-10-11 con el MCP de Supabase sin el `BEGIN/COMMIT` del archivo; el bloque final pasó
  (sin EXECUTE para anon/authenticated, `service_role` sí; formas `{cifras, bdua, dane}` y
  `{municipios, eps, nombres}`).
- Por qué: `bdua_afiliados` tiene 53.634 filas en el corte del 2026-10-02 (PostgREST pagina de a 1.000)
  y PostgREST no tiene DISTINCT para listar los cortes. La usan `GET /api/intelligence/poblacion` y la
  tarjeta "Entorno del municipio" (ver `docs/fases/fase4-poblacion.md`, "API y vista").
- Comprobado con SELECT tras aplicar: 1.121 municipios, 10.232 filas de EPS, 61 eps_id; contributivo
  22.925.548 + subsidiado 27.009.982 = activos 49.942.999 − 7.469 sin municipio cruzado.
- Rollback: antes del de 0640. Sin estas funciones la API sigue respondiendo, pero sin BDUA (sin EPS
  dominantes) y con solo el corte más reciente.

---

# Migraciones — Giros ADRES "Identifica tu Giro" (detalle por giro)

> **ESTADO: APLICADA** el 2026-10-11 en `norvxqgohddgsdkggqzq` (aditiva: 1 tabla, 1 vista y 1 función
> nuevas; no toca `adres_giros` ni `adres_giros_resumen()`). Fuente, regla de régimen, script, API y UI en
> `docs/fases/fase3-adres.md` (sección "Identifica tu Giro").

| # | Archivo | Qué hace | Destructivo |
|---|---|---|---|
| 9 | `2026-10-11_0630_adres_detalle.sql` | Crea `adres_giros_detalle` (una fila por giro; UNIQUE `huella` sha256; CHECKs de NIT, régimen contributivo/subsidiado/otro, ocurrencia y huella; índices por nit+fecha y por fecha), la vista `adres_giros_mensual` (`security_invoker`) y la función `adres_giros_intel(fuente, desde, hasta, regimen)` → jsonb por NIT para las dos fuentes (SECURITY INVOKER, EXECUTE solo `service_role`). RLS sin políticas, sin privilegios para anon/authenticated/PUBLIC | No |
| — | `2026-10-11_9930_adres_detalle_rollback.sql` | Borra la función, la vista y la tabla, y las filas de `adres_fetch_log` con `fuente = 'adres_identifica_giro'` | Sí (solo datos públicos de la ADRES; se recargan con el script) |

- Aplicada con el MCP de Supabase sin el `BEGIN/COMMIT` del archivo; el bloque final pasó (RLS, 0
  políticas, 0 privilegios para anon/authenticated en tabla y vista, vista `security_invoker`, función
  solo `service_role`, 14 columnas, la función responde con la forma esperada en las dos fuentes).
- Comprobado con SELECT: `adres_giros_intel('reporte29', 2024-07-01, 2025-06-30)` suma lo mismo que
  `adres_giros_resumen()` ($ 15.967.511.745.238).
- Después de aplicar: `cd web && node scripts/adres-identifica-giro.mjs --desde 2025-04` (todos los NIT
  de IPS activas; reanudable). El 2026-10-11 solo se cargaron los 3 NIT de prueba (987 filas).
- Rollback: va **antes** de `2026-10-11_9930_adres_rollback.sql` si se deshacen los dos
  (`adres_giros_intel()` lee `adres_giros`). Volver a desplegar antes el código anterior.

---

# Migraciones — Bogotá hacia afuera: una ciudad, cuatro corredores (PR 3)

> **ESTADO: APLICADA** el 2026-10-11 en `norvxqgohddgsdkggqzq` (aditiva: 2 tablas nuevas y 1 columna NULL en
> `assignments`; no cambia ninguna asignación ni `kams.max_travel_time`). Regla, semilla completa y
> simulación en `docs/algoritmo-asignacion.md` ("Bogotá hacia afuera: una ciudad, cuatro corredores");
> decisión en `docs/decisiones/2026-10-11-bogota-corredores.md`.

| # | Archivo | Qué hace | Destructivo |
|---|---|---|---|
| 12 | `2026-10-11_0700_bogota_corredores.sql` | Crea `bogota_config` (una fila, `id = 1`: `k` 1–4, `max_travel_minutes` 60–600, `grupos` jsonb corredor → kam_id, `updated_at` con trigger, `updated_by` → users `ON DELETE SET NULL`) sembrada con k = 4, 240 min y las 4 celdas leídas de `kams` por `area_id`; crea `bogota_corredores` (`UNIQUE NULLS NOT DISTINCT (department_code, municipality_code)`, CHECK de corredor y formatos) con 29 departamentos y los 116 municipios de Cundinamarca por provincia; añade `assignments.detail` jsonb NULL (CHECK objeto). `assignment_type` no tiene CHECK hoy: si alguien lo hubiera creado, lo amplía con `bogota_corredor` conservando sus valores. RLS sin políticas, sin privilegios para anon/authenticated/PUBLIC, GRANT a `service_role` | No |
| — | `2026-10-11_9930_bogota_rollback.sql` | Pasa las asignaciones `bogota_corredor` a `competitive`, quita `assignments.detail` y borra las 2 tablas | Sí (la configuración de Bogotá y las excepciones por municipio editadas a mano) |

- Aplicada con el MCP de Supabase sin el `BEGIN/COMMIT` del archivo; el bloque final pasó (RLS, 0 políticas,
  0 privilegios para anon/authenticated, `service_role` con SELECT/INSERT/UPDATE/DELETE, 10 columnas, los 4
  corredores apuntan a celdas activas de Bogotá, 29 departamentos, 116 municipios de Cundinamarca, ninguno
  inexistente ni faltante). Comprobado después con SELECT: `assignments` sigue con 766 filas (forced 22,
  competitive 389, base_territory 351, majority_rule 4) y 0 `detail` no nulos.
- Re-ejecutable (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`): no pisa lo editado desde `/kams` ni las
  excepciones por municipio.
- Sin las tablas el motor se comporta como antes (cada celda compite sola); la ficha y `/kams` necesitan
  `assignments.detail` y `bogota_config`, así que con el código nuevo el rollback va después de volver a
  desplegar el código anterior.
- Rollback independiente de los demás (nada tiene FKs hacia estas tablas).

---

# Migraciones — Compras públicas (SECOP) y fuentes de datos automáticas (PR 7)

> **ESTADO: APLICADA** el 2026-10-11 en `norvxqgohddgsdkggqzq` (aditiva: 4 tablas, 1 vista y 2 funciones
> nuevas; no toca tablas existentes). Fuentes, reglas, carga, cron y lo que debe configurar el dueño en
> `docs/fases/fase5-fuentes-automaticas.md`; API y UI en `docs/fases/fase5-secop.md`.

| # | Archivo | Qué hace | Destructivo |
|---|---|---|---|
| 13 | `2026-10-11_0710_secop.sql` | Crea `secop_proveedores_vigilados` (PK NIT de 9 dígitos; semilla: 76 proveedores de Odoo, es_empresa y no intercompañía), `secop_contratos` (UNIQUE fuente+id_contrato; NIT a 9 dígitos; FK suave a `hospitals` y a la lista vigilada con `ON DELETE SET NULL`; CHECK de línea, especialidad, fuente/origen y **persona natural sin documento en claro**), `secop_ajustes` (una fila con la sal aleatoria del hash de documentos, solo SELECT/INSERT para `service_role`) y `fuentes_estado` (estado de cada carga automática: último OK, intento, estado ok/error/corriendo, filas, mensaje, cursor jsonb, siguiente programado, bloqueo); vista `secop_contratos_unicos` (`security_invoker`; quita del Integrado lo que ya vino de SECOP II); funciones `secop_nits_ips()` y `secop_marcar_atipicos()` (SECURITY INVOKER, `search_path` fijo, EXECUTE solo `service_role`). Siembra las 6 fuentes y el último OK de las cargas manuales previas (REPS, BDUA, MinSalud, ADRES). RLS sin políticas, sin privilegios para anon/authenticated/PUBLIC | No |
| — | `2026-10-11_9930_secop_rollback.sql` | Borra la vista, las 2 funciones y las 4 tablas | Sí (contratos descargados —se recargan con `scripts/secop-load.ts`—, la lista vigilada manual, las notas y el historial de `fuentes_estado`; no toca las tablas que cargan esas fuentes) |

- Aplicada con el MCP de Supabase sin el `BEGIN/COMMIT` del archivo; el bloque final pasó (RLS en las 4,
  0 políticas, 0 privilegios para anon/authenticated, `service_role` puede leer, funciones solo
  `service_role`, 76 proveedores, 1 sal, 6 fuentes). Tras aplicarla hubo que recargar la caché de esquema
  de PostgREST (`NOTIFY pgrst, 'reload schema'`).
- Después de aplicar: `cd web && npx tsx scripts/secop-load.ts --inicial` (carga inicial de SECOP II y del
  Integrado; ≈ 15–25 min). Después el cron mantiene todo al día.
- Re-ejecutable (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`, `CREATE OR REPLACE`): no pisa la lista vigilada
  editada ni la sal (cambiar la sal rompería la deduplicación de médicos).
- Rollback independiente de los demás. Antes, quitar los `crons` de `web/vercel.json` y volver a desplegar
  el código anterior (si no, `/api/cron/*`, `/api/secop/*` y `/api/fuentes/*` responden 503).

### 0720 — Lectura agregada para la API de compras públicas

> **ESTADO: APLICADA** el 2026-10-11 en `norvxqgohddgsdkggqzq` (aditiva: 1 función de solo lectura; depende
> de la vista de 0710). Uso en `docs/fases/fase5-secop.md` ("Migración 0720").

| # | Archivo | Qué hace | Destructivo |
|---|---|---|---|
| 14 | `2026-10-11_0720_secop_api.sql` | Crea `secop_hechos(p_desde, p_hasta, p_nits, p_proveedores)` → jsonb con los contratos de `secop_contratos_unicos` agregados por entidad, proveedor, persona, especialidad, línea, atípico, fuera de escala (> 50.000 M) y año de firma (PostgREST corta en 1.000 filas). SECURITY INVOKER, `search_path` fijo, EXECUTE solo `service_role` | No |
| — | `2026-10-11_9929_secop_api_rollback.sql` | Borra la función | No (sin datos; la API vuelve a leer contrato por contrato) |

- Aplicada con el MCP de Supabase sin el `BEGIN/COMMIT` del archivo; el bloque final pasó (anon y
  authenticated sin EXECUTE, `service_role` sí, rango vacío → `[]`). Se volvió a aplicar dos veces el mismo
  día (CREATE OR REPLACE) para agrupar también por "fuera de escala" y repartir el valor de los procesos de
  SECOP I repetido en cada contratista. Comprobado con SELECT tras la carga inicial: 45.563 contratos → 9.087
  grupos, misma suma de contratos que la vista y de valor que la vista con el reparto ($ 3,82 billones; sin
  reparto $ 5,09 billones), 3 fuera de escala.
- Rollback: **antes** de `2026-10-11_9930_secop_rollback.sql` si se deshacen los dos.
