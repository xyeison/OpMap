# Fase 7 · App de visita · F2 Configuración y calendario (contrato de implementación)  (2026-10-12)

Spec aprobada: `docs/specs/2026-10-12-app-de-visita-opmap.md` (secciones 6, 7, 9, 11 y 12). Decisiones del
dueño: `docs/decisiones/2026-10-12-app-de-visita.md`. F1 (terceros) ya está en producción:
`docs/fases/fase6-visitas-f1-terceros.md`. Este documento fija nombres de tablas, funciones, rutas, formas
JSON y permisos para que base de datos, código puro, API e interfaz se construyan en paralelo.

Alcance de F2: **configuración con vigencias** (metas, qué cuenta y con qué peso, perfiles y excepciones por
persona, parámetros generales, subtipos), **calendario** (festivos de Colombia calculados, días de empresa y
de ciudad), **días libres** de cada persona con plazo de gracia y **aprobación en bloque**, el **rol de
recursos humanos** y el **cálculo puro de la cuota** del periodo. No incluye reportar visitas, voz, la app
móvil ni los KPIs (F3 a F5). La regla de conteo de visitas se escribe y se prueba aquí como función pura,
pero ninguna visita la usa todavía.

## Reglas del dueño que F2 debe cumplir

- **Todo lo que mide es configurable, nada en código**: metas por tipo y subtipo, por zona (valor por
  defecto) y por persona (excepción), por día o por semana; qué subtipo suma a qué meta y con qué peso;
  perfiles; radio; telefónica; topes; plazo de gracia; días hábiles de la semana; aprobación; motivos.
- **Vigencias por rango de fechas**: cada valor tiene `vigente_desde` y `vigente_hasta` (inclusive; NULL =
  abierto), **sin rangos superpuestos** para la misma clave. Cambiar algo **no edita** el valor anterior:
  cierra su rango y abre uno nuevo. Los cálculos usan el valor que regía en cada fecha. Corregir el pasado
  es crear un rango que empieza antes de hoy: exige motivo, queda quién y cuándo, y la pantalla dice qué
  meses se recalculan antes de guardar.
- **Valores iniciales** (vigentes desde 2026-10-12): meta médica 6 al día y meta institucional 1 al día para
  toda la empresa; Compras y Autorizaciones suman a la meta institucional con peso 1; Químico farmacéutico,
  Programación y Otro son solo seguimiento; radio 500 m; plazo de gracia 24 horas; lunes a viernes hábiles;
  una visita por médico al día; telefónicas hasta 1 al día, peso 1, solo llamada o videollamada, habilitadas
  por persona (nadie habilitado al arrancar); días libres con aprobación de la directora o recursos humanos;
  primer mes de alguien nuevo al 50 %.
- **Calendario**: festivos de Colombia (Ley 51 de 1983: fijos, trasladados al lunes y los de Pascua)
  calculados por el sistema, guardados y corregibles; días de empresa (no laborables o laborables) y días por
  ciudad, que solo afectan a quienes trabajan en esa ciudad.
- **Días libres**: día completo o medio día, con motivo. Se registran **antes** o hasta el **plazo de gracia
  después** (24 horas por defecto, configurable). Pasado el plazo, la ejecutiva no puede registrarlo y el día
  cuenta como hábil. Si se exige aprobación quedan "por aprobar" (sin alarma) hasta que la directora o
  recursos humanos los aprueban **en bloque**.
- **Cuota del periodo** = meta × días hábiles del calendario de esa persona − días libres aprobados.
- **Quién edita qué**: la directora la configuración; recursos humanos el calendario y los días libres; la
  ejecutiva sus propios días libres; el líder de línea solo **ve** los días libres de las ejecutivas de sus
  líneas, sin aprobar; `viewer` recibe 403.
- Terminología visible: "Ejecutivo Comercial", "Zona", "Configuración", "Calendario", "Días libres". Nunca
  "KAM". Costo de Google: 0 (nada de esto llama a Google).

## Decisiones de implementación (tomadas por Claude; el dueño puede cambiarlas)

1. **Plazo de gracia**: cuenta desde el **final** del día libre. Con 24 horas, el lunes se puede registrar
   hasta el martes a las 23:59 (hora de Bogotá). Se usa el plazo vigente el día en que se registra, así que
   si la directora sube el plazo a 48 horas hoy, rige desde hoy.
2. **Registro tardío con rastro**: la ejecutiva no puede registrar fuera de plazo. Quien aprueba (directora,
   recursos humanos, admin) sí puede, con **justificación obligatoria**, y la fila queda marcada
   `fuera_de_plazo` (por ejemplo, una incapacidad que llega tarde).
3. **Quien aprueba y registra** un día para otra persona lo deja aprobado de una vez.
4. **Valor temporal**: si un cambio trae fecha "hasta", al terminar vuelve a regir el valor que había antes
   (se crea su continuación automáticamente). Sin "hasta", rige hasta el siguiente cambio ya programado o
   indefinidamente.
5. **Motivo**: obligatorio solo si el cambio empieza antes de hoy (corrige el pasado) o si anula o cierra un
   valor en el pasado. En los demás, opcional.
6. **Meta semanal**: se reparte entre los días hábiles de una semana estándar según "días hábiles de la
   semana" (con lunes a viernes, una meta de 10 a la semana es 2 por día hábil).
7. **Zona de la persona**: la zona base actual (`executives.base_kam_id`); no hay historial de cambios de zona.
   La ciudad para los días por ciudad es el municipio de esa zona (`left(kams.area_id, 5)`; las celdas de
   Bogotá son 11001).
8. **Valores semilla** vigentes desde 2026-10-12 (fecha de las decisiones). 24 y 31 de diciembre no se
   siembran: los declara recursos humanos o la directora si aplican.
9. **Sin configuración de una persona**: perfil médica e institucional, telefónica no habilitada, radio y
   tope de telefónicas los generales.

## Base de datos (migración `database/migrations/2026-10-12_0810_visitas_config_calendario.sql`, rollback `2026-10-12_9941_visitas_config_calendario_rollback.sql`)

Patrón de 0800: `BEGIN/COMMIT`, precondiciones, comentarios, RLS sin políticas, `REVOKE ALL ... FROM PUBLIC,
anon, authenticated`, `GRANT` a `service_role`, `COMMENT ON`, bloque `DO` final de comprobaciones con
sub-bloques que se deshacen (`RAISE SQLSTATE 'P0810'`). Re-ejecutable. Depende de 0800
(`subtipos_institucionales`).

**Extensión**: `CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;` (para las restricciones de
exclusión). El rollback no la borra.

### Columnas comunes de las 4 tablas de configuración

`id uuid pk default gen_random_uuid()`, `vigente_desde date not null`, `vigente_hasta date null` (inclusive),
`motivo text null`, `set_by uuid null references users(id)`, `created_at timestamptz not null default now()`,
`anulado_at timestamptz null`, `anulado_por uuid null references users(id)`, `anulado_motivo text null`,
`anterior_id uuid null references <la misma tabla>(id)` y `anterior_hasta date null` (la fila que este valor cortó o
reemplazó al registrarse y el `vigente_hasta` que esa tenía; `CHECK (anterior_id IS NOT NULL OR anterior_hasta IS
NULL)`; ver decisión 12), y una columna **generada** `clave text generated always as (...) stored`.

`set_by` y `anulado_por` van **sin `ON DELETE`** (NO ACTION): quien dejó rastro en la configuración no se borra (la app
solo desactiva usuarios; borrarlo da 23503). Con `ON DELETE SET NULL` el borrado chocaría con `config_inmutable` y la
acción declarada nunca se cumpliría (revisión del 2026-10-12).

- `CHECK (vigente_hasta IS NULL OR vigente_hasta >= vigente_desde)`.
- `EXCLUDE USING gist (clave WITH =, daterange(vigente_desde, vigente_hasta, '[]') WITH &&) WHERE (anulado_at
  IS NULL)` con nombre `<tabla>_sin_superposicion` (error 23P01).
- Disparador `config_inmutable` (BEFORE UPDATE OR DELETE): DELETE siempre falla; UPDATE solo puede cambiar
  `vigente_hasta`, `anulado_at`, `anulado_por`, `anulado_motivo`, y nunca una fila ya anulada.

| Tabla | Columnas propias | `clave` | Restricciones |
| --- | --- | --- | --- |
| `config_metas` | `scope text not null` ('general' \| 'zona' \| 'ejecutiva'), `kam_id uuid null references kams(id)`, `executive_id uuid null references executives(id)`, `tipo text not null` ('medica' \| 'institucional'), `subtipo_id uuid null references subtipos_institucionales(id)`, `periodo text not null` ('dia' \| 'semana'), `cantidad numeric(6,2) not null` | `scope ‖ ':' ‖ coalesce(kam_id::text, executive_id::text, '-') ‖ ':' ‖ tipo ‖ ':' ‖ coalesce(subtipo_id::text, '-')` | general → sin kam ni ejecutiva; zona → solo `kam_id`; ejecutiva → solo `executive_id`; `subtipo_id` solo con tipo institucional; `cantidad` entre 0 y 100 |
| `config_conteo` | `subtipo_id uuid not null references subtipos_institucionales(id)`, `modo text not null` ('suma_institucional' \| 'meta_propia' \| 'seguimiento'), `peso numeric(4,2) not null default 1` | `subtipo_id::text` | `peso > 0 AND peso <= 10` |
| `config_general` | `parametro text not null`, `valor jsonb not null` | `parametro` | `parametro IN` la lista de abajo; tipo jsonb mínimo por parámetro (número u objeto o arreglo); la validación completa la hace la API con zod |
| `config_personas` | `executive_id uuid not null references executives(id)`, `perfil text[] not null default '{medica,institucional}'`, `telefonica_habilitada boolean not null default false`, `tope_telefonicas_dia int null`, `radio_m int null` | `executive_id::text` | `cardinality(perfil) >= 1 AND perfil <@ ARRAY['medica','institucional']`; `tope_telefonicas_dia` entre 0 y 20; `radio_m` entre 50 y 5000 |

**Parámetros de `config_general` y semilla** (todos vigentes desde 2026-10-12, `motivo = 'Valor inicial
(decisión del dueño 2026-10-12)'`):

| `parametro` | `valor` semilla | Forma |
| --- | --- | --- |
| `radio_presencial_m` | `500` | entero 50..5000 |
| `plazo_gracia_horas` | `24` | entero 0..720 |
| `dias_habiles_semana` | `{"1":1,"2":1,"3":1,"4":1,"5":1,"6":0,"7":0}` | objeto con las claves "1" (lunes) a "7" (domingo), cada valor 0, 0.5 o 1 |
| `tope_visitas_medico_dia` | `1` | entero 1..10 |
| `telefonicas` | `{"tope_dia":1,"peso":1,"medios":["llamada","videollamada"]}` | `tope_dia` 0..20, `peso` >0..10, `medios` ⊆ {llamada, videollamada}, al menos uno |
| `aprobacion_dias_libres` | `{"requiere":true,"aprueban":["commercial_director","hr"]}` | `requiere` booleano; `aprueban` ⊆ {commercial_director, hr} (admin siempre puede) |
| `motivos_dia_libre` | `[{"codigo":"vacaciones","nombre":"Vacaciones"},{"codigo":"incapacidad","nombre":"Incapacidad"},{"codigo":"cita_medica","nombre":"Cita médica"},{"codigo":"capacitacion","nombre":"Capacitación"},{"codigo":"congreso","nombre":"Congreso"},{"codigo":"acompanamiento_cirugia","nombre":"Acompañamiento de cirugía"},{"codigo":"administrativo","nombre":"Administrativo"},{"codigo":"otro","nombre":"Otro"}]` | arreglo de 1 a 30 `{codigo ^[a-z_]{2,40}$, nombre 2..60}` sin códigos repetidos |
| `primer_mes_factor` | `0.5` | número 0..1 |
| `alertas_mezcla` | `{}` | objeto (umbral por tipo o subtipo; sin uso hasta F5) |

**Semilla de metas**: `general` · médica · día · 6 y `general` · institucional · día · 1 (sin subtipo).
**Semilla de conteo**: compras y autorizaciones `suma_institucional` peso 1; quimico_farmaceutico,
programacion y otro `seguimiento` peso 1 (buscar los subtipos por `codigo`).

### `calendario`

`id uuid pk`, `fecha date not null`, `alcance text not null` ('nacional' \| 'empresa' \| 'ciudad'),
`municipality_id varchar(5) null`, `tipo text not null` ('no_habil' \| 'habil'), `nombre text not null`,
`origen text not null default 'manual'` ('calculado' \| 'manual'), `created_by uuid null references users`,
`created_at`, `anulado_at`, `anulado_por`, `anulado_motivo`.

- `municipality_id` obligatorio si y solo si `alcance = 'ciudad'` (5 dígitos; si existe la tabla de
  municipios con ese id, con llave foránea).
- `alcance = 'nacional'` solo admite `tipo = 'no_habil'`; `origen = 'calculado'` solo con alcance nacional.
- Índice único parcial `(fecha, alcance, coalesce(municipality_id, ''))` `WHERE anulado_at IS NULL`.
- Nunca se borra: se anula con motivo (DELETE prohibido por disparador).

**Funciones**
- `calendario_festivos_colombia(p_anio int) RETURNS TABLE (fecha date, nombre text)`, IMMUTABLE: Pascua por
  el algoritmo gregoriano anónimo; fijos (1 ene Año Nuevo, 1 may Día del Trabajo, 20 jul Día de la
  Independencia, 7 ago Batalla de Boyacá, 8 dic Inmaculada Concepción, 25 dic Navidad); trasladados al lunes
  siguiente si no caen en lunes (6 ene Día de los Reyes Magos, 19 mar Día de San José, 29 jun San Pedro y San
  Pablo, 15 ago Asunción de la Virgen, 12 oct Día de la Raza, 1 nov Todos los Santos, 11 nov Independencia de
  Cartagena); de Pascua sin traslado (Pascua − 3 Jueves Santo, Pascua − 2 Viernes Santo); de Pascua al lunes
  (Pascua + 43 Ascensión del Señor, Pascua + 64 Corpus Christi, Pascua + 71 Sagrado Corazón de Jesús).
  Nombres exactamente como aquí. 18 por año.
- `calendario_cargar_festivos(p_anio int, p_user uuid) RETURNS int`: inserta los festivos del año como
  `nacional` · `no_habil` · `calculado`, saltando las fechas que ya tienen una fila nacional (activa **o
  anulada**: una corrección de recursos humanos no se revive). Devuelve cuántos insertó. Solo `service_role`.
- La migración carga 2026 y 2027.

**Festivos esperados** (oráculo para el bloque DO y para las pruebas puras):
- 2026 (Pascua 5 abr): 01-01, 01-12, 03-23, 04-02, 04-03, 05-01, 05-18, 06-08, 06-15, 06-29, 07-20, 08-07,
  08-17, 10-12, 11-02, 11-16, 12-08, 12-25. El 13 de julio no es festivo.
- 2027 (Pascua 28 mar): 01-01, 01-11, 03-22, 03-25, 03-26, 05-01, 05-10, 05-31, 06-07, 07-05, 07-20, 08-07,
  08-16, 10-18, 11-01, 11-15, 12-08, 12-25.

### `dias_libres`

`id uuid pk`, `executive_id uuid not null references executives(id)`, `fecha date not null`, `fraccion
numeric(2,1) not null` (0.5 o 1), `motivo text not null` (código de `motivos_dia_libre`; lo valida la API),
`nota text null` (hasta 500), `estado text not null` ('registrado' \| 'por_aprobar' \| 'aprobado' \|
'rechazado' \| 'anulado'), `registrado_por uuid null references users`, `registrado_at timestamptz not null
default now()`, `fuera_de_plazo boolean not null default false`, `justificacion text null`, `revisado_por uuid
null references users`, `revisado_at timestamptz null`, `motivo_revision text null`, `created_at`,
`updated_at` (disparador `update_updated_at_column`).

- Índice único parcial `(executive_id, fecha) WHERE estado IN ('registrado','por_aprobar','aprobado')`: un
  día libre vigente por persona y fecha (409 en la API).
- `fuera_de_plazo` exige `justificacion` de al menos 5 caracteres.
- `estado IN ('aprobado','rechazado','anulado')` exige `revisado_at`; rechazado y anulado exigen
  `motivo_revision`.
- Nunca se borra (DELETE prohibido); los errores se anulan.
- Cuentan como libres para la cuota: `registrado` (cuando no se exige aprobación) y `aprobado`.

### Rol de recursos humanos

`ALTER TABLE users DROP CONSTRAINT users_role_check, ADD CONSTRAINT users_role_check CHECK (role IN (...los 8
de hoy..., 'hr'))`. El rollback pasa a `viewer` a quien tenga `hr` (con NOTICE) y restaura la lista de 8.

### Funciones de configuración (las escrituras de la API pasan SIEMPRE por aquí)

- `config_registrar(p_tabla text, p_valores jsonb, p_desde date, p_hasta date, p_motivo text, p_user uuid)
  RETURNS uuid`, SECURITY INVOKER, solo `service_role`, atómica:
  1. `p_tabla` en ('config_metas', 'config_conteo', 'config_general', 'config_personas'); si no, 22023.
  2. Calcula la `clave` de la fila nueva con la misma expresión que la columna generada y toma
     `pg_advisory_xact_lock(hashtext(p_tabla || ':' || clave))`.
  3. Si `p_desde < hoy` (Bogotá) y el motivo tiene menos de 5 caracteres: 23514 "Para cambiar el pasado hace
     falta un motivo".
  4. Si `p_hasta` no es NULL y `p_hasta < p_desde`: 23514.
  5. Sobre las filas activas (no anuladas) de la misma clave: la que empieza **el mismo día** que `p_desde`
     se **anula** (`anulado_motivo = 'Reemplazado por un valor nuevo con la misma fecha de inicio'`); la que
     empieza antes y sigue vigente en `p_desde` se **corta** a `p_desde − 1`. Si cualquiera de esas dos
     seguía vigente después de `p_hasta` (porque era abierta o terminaba después), se crea su
     **continuación**: una copia de sus valores desde `p_hasta + 1` hasta su fin original, con `motivo =
     'Continúa después de un valor temporal'` y `set_by = p_user`. La fila nueva guarda en `anterior_id` /
     `anterior_hasta` cuál era esa fila (a lo sumo una) y su `vigente_hasta` de antes.
  6. `hasta` efectivo = `p_hasta` o, si es NULL, el día anterior al inicio de la siguiente fila activa de la
     clave (o NULL si no hay). Si `p_hasta` choca con una fila que empieza después de `p_desde`: 23P01 con
     mensaje "El rango se superpone con un valor que empieza el AAAA-MM-DD".
  7. Inserta la fila nueva con `p_valores` (columnas tipadas por tabla), `vigente_desde = p_desde`,
     `vigente_hasta = hasta efectivo`, `motivo`, `set_by = p_user`. Devuelve su id.
- `config_cerrar(p_tabla text, p_id uuid, p_hasta date, p_motivo text, p_user uuid) RETURNS void`: si `p_hasta
  >= vigente_desde`, pone `vigente_hasta = p_hasta` (solo si la fila está abierta o termina después); si
  `p_hasta < vigente_desde`, la **anula**. Motivo obligatorio (5+) si `p_hasta < hoy`. Fila anulada o
  inexistente: P0002. Después, en el hueco que deja (`[vigente_desde, fin]` al anular, `[p_hasta + 1, fin]` al
  acortar) **vuelve a regir el valor anterior** si la fila tenía `anterior_id`, hasta `min(fin original,
  anterior_hasta)` (decisión 12): si el anterior empezaba el mismo día (lo reemplazó y quedó anulado) se copian sus
  valores; si no, la fila activa de la clave que termina el día antes de la fila se alarga (si termina justo antes
  del hueco) o se copian sus valores (`motivo = 'Vuelve a regir el valor anterior'`, `set_by = p_user`).
- Bloque DO: tablas, RLS, privilegios, exclusión (insertar dos rangos superpuestos falla con 23P01), semillas
  (2 metas, 5 conteos, 9 parámetros), cortes y continuaciones de `config_registrar` (valor temporal, mismo
  día, pasado sin motivo rechazado, superposición con un valor futuro rechazada), `config_inmutable`
  (UPDATE de `cantidad` y DELETE rechazados), festivos 2026 y 2027 iguales a la lista esperada, índice único
  de calendario y de días libres, `fuera_de_plazo` sin justificación rechazado, rol `hr` aceptado en users
  (sub-bloque que se deshace); además `anterior_id`/`anterior_hasta`, cancelar o acortar devuelve el valor anterior
  (alarga, copia, mismo día, en cadena, y no revive lo que se registró en un hueco), llaves a `users` sin `ON
  DELETE` (borrar a quien dejó rastro da 23503) y la re-ejecución con una excepción real abierta (prueba k).

## Permisos (`web/lib/permissions.ts`)

Rol nuevo **`hr`** ("Recursos humanos"): `lines:view`, `executives:view`, `calendar:manage`,
`daysoff:approve`.

| Permiso | Para qué | Roles |
| --- | --- | --- |
| `visits:config` | Ver y cambiar la configuración, subtipos y la cuota de cualquier persona | admin, commercial_director |
| `calendar:manage` | Días de empresa y de ciudad, cargar festivos, anular días del calendario | admin, commercial_director, hr |
| `daysoff:approve` | Ver todos los días libres, aprobar o rechazar en bloque, registrar o anular por otra persona | admin, commercial_director, hr (además, el rol debe estar en `aprobacion_dias_libres.aprueban`, salvo admin) |
| `daysoff:view` | Ver, sin aprobar, los días libres de las ejecutivas de sus líneas (`executive_lines` en líneas con `business_lines.leader_user_id` = él) | line_leader |
| `visits:report` | Lo propio de una Ejecutiva Comercial: sus días libres y su cuota (requiere usuario enlazado a una ejecutiva; si no, 403 "Tu usuario no está enlazado con un Ejecutivo Comercial") | admin, commercial_director, line_leader, sales_manager |

Menú: **"Configuración"** → `/configuracion` con `visits:config`; **"Calendario"** → `/calendario` con
cualquiera de `calendar:manage`, `daysoff:approve`, `daysoff:view`, `visits:report`. `getAllowedRoutes`
igual. `getRoleTitle('hr') = 'Recursos humanos'`; la página `/users` ofrece el rol en sus tres selectores y
etiquetas. Íconos en `NavigationWithPermissions`.

## Código puro (`web/lib/visits-rules.ts` y `web/lib/visits-config-schemas.ts`)

Fechas como texto ISO `AAAA-MM-DD` (sin zona horaria); Colombia es UTC−5 sin horario de verano.

- Fechas: `sumarDias(fecha, n)`, `diaSemanaIso(fecha)` (1 lunes … 7 domingo), `rangoFechas(desde, hasta)`,
  `hoyBogota(ahora: Date)`, `mesDe(fecha)` → `AAAA-MM`, `limitesMes('AAAA-MM')` → `{ desde, hasta }`.
- Festivos: `pascua(anio)`, `festivosColombia(anio)` → `[{ fecha, nombre }]` ordenado, mismos nombres que la
  función SQL.
- Vigencias: tipo `Vigencia = { id?, vigente_desde, vigente_hasta, anulado_at? }`;
  `valorVigente(filas, fecha)` (ignora anuladas; si hay varias, la de inicio más reciente);
  `seSuperponen(a, b)`; `planearCierre(fila, { hasta, motivo? }, hoy, filasDeLaClave?)` → `{ accion, vigente_hasta,
  requiereMotivo, error, restaura: { deId, accion: 'extender' | 'copiar', desde, hasta } | null }` (espejo de
  `config_cerrar`, con el valor que vuelve a regir; sin las filas de la clave `restaura` es null);
  `planearCambio(filasDeLaClave, { desde, hasta }, hoy)` → `{ anular: id[], cortar: [{
  id, vigente_hasta }], continuar: [{ deId, vigente_desde, vigente_hasta }], hastaEfectivo, error: string |
  null, requiereMotivo: boolean }`, espejo exacto de los pasos 3 a 6 de `config_registrar` (la interfaz lo usa
  para la vista previa); `mesesAfectados(desde, hastaEfectivo, hoy)` → meses `AAAA-MM` desde el de `desde`
  hasta el de `min(hastaEfectivo, hoy)` si `desde < hoy`, si no `[]`.
- Configuración general: `GENERAL_POR_DEFECTO` (= la semilla), `generalVigente(filasGeneral, parametro,
  fecha)` con respaldo al valor por defecto. `PERFIL_POR_DEFECTO = ['medica','institucional']`.
- Metas: `resolverMeta({ metas, fecha, executiveId, kamId, tipo, subtipoId })` → `{ cantidad, periodo, origen:
  'ejecutiva' | 'zona' | 'general' | null, id }` (prioridad ejecutiva > zona > general);
  `metaDiaria(meta, diasHabilesSemana)` (semana → cantidad ÷ suma de fracciones de la semana).
- Calendario: `fraccionHabil({ fecha, diasHabilesSemana, calendario, municipio })` → 0..1. Precedencia:
  día de ciudad (del municipio de la persona) > día de empresa > festivo nacional > día de la semana. Un día
  `habil` de empresa o ciudad vale 1; `no_habil`, 0. Ignora anulados.
- Días libres: `fraccionLibre(diasLibres, fecha)` (registrado o aprobado), `fraccionPorAprobar(...)`;
  `venceRegistroDiaLibre(fecha, plazoHoras)` → instante (`Date`) = inicio del día siguiente en Bogotá + plazo;
  `puedeRegistrarDiaLibre({ fecha, ahora, plazoHoras, diasAdelanteMax = DIAS_ADELANTE_DIA_LIBRE (366) })` → `{ ok,
  error, venceAt }`; `estadoInicialDiaLibre(requiereAprobacion)` → 'por_aprobar' | 'registrado';
  `consultaMisDiasLibres(hoy)` → `{ desde: hoy − 90 }` (sin fin: "Mis días libres" muestra todo lo registrable);
  `MAX_IDS_REVISION` (200) y `enLotes(lista, tamano)` (la revisión en bloque va en lotes);
  `pestanasCalendario({ reporta, veDias, enlace })` → `{ pestanas, avisoSinEjecutiva }`.
- Cuota: `cuotaPeriodo({ desde, hasta, hoy?, persona: { executiveId, kamId, municipio, startedAt, leftAt },
  tipo, subtipoId?, metas, personas, general, calendario, diasLibres })` → `{ cuota, diasHabiles,
  diasHabilesTranscurridos, diasLibres, diasPorAprobar, metaDiaHoy, origenMeta, aplicaPerfil (hoy),
  aplicaEnPeriodo (el perfil incluye el tipo algún día del periodo), porDia: [{
  fecha, habil, libre, metaDia, factor, aporte }] }`. Por día: activo si `startedAt <= d` y (`leftAt` NULL o
  `d <= leftAt`); perfil vigente que incluya el tipo; `aporte = metaDia × max(0, habil − libre) × factor`, con
  `factor = primer_mes_factor` en el mes calendario de `startedAt` y 1 en los demás. Cuota redondeada a 2
  decimales. `ritmo(diasHabilesTranscurridos, diasHabiles)` → 0..1 (los transcurridos incluyen `hoy`).
- Conteo: `valorVisita({ conteo, fecha, tipo, subtipoId })` → `{ meta: 'medica' | 'institucional' |
  'subtipo' | null, subtipoId, peso }`: médica → médica peso 1; institucional según `config_conteo` vigente
  (`suma_institucional` → institucional con su peso; `meta_propia` → subtipo con su peso; `seguimiento` o sin
  fila → null, peso 0).
- Esquemas zod en `visits-config-schemas.ts`: `valorGeneralSchemas` (uno por parámetro, mensajes en español),
  `cambioConfigSchema` (unión discriminada por `tabla` con `valores`, `desde`, `hasta?`, `motivo?`),
  `cerrarConfigSchema`, `subtipoCreateSchema`, `subtipoUpdateSchema`, `calendarioDiaCreateSchema`,
  `anularSchema` (`motivo` 5..300), `cargarFestivosSchema` (`anio` 2020..2100), `diaLibreCreateSchema`
  (`fecha`, `fraccion` 0.5 \| 1, `motivo`, `nota?`), `diaLibrePorOtraSchema` (+ `executive_id`,
  `justificacion?`), `revisarDiasLibresSchema` (`ids` 1..200 uuid sin repetir, `accion` 'aprobar' \|
  'rechazar' \| 'anular', `motivo` obligatorio para rechazar y anular), `mesSchema` (`AAAA-MM`).
- Pruebas: `web/scripts/visits-check.ts` (puras, sin red) en `npm run test`.

## API (todas con `requirePermission`, `getSupabaseAdmin`, errores `{ error }`, 503 si falta la migración)

| Ruta | Permiso | Respuesta |
| --- | --- | --- |
| `GET /api/config-visitas` | visits:config | `{ hoy, metas, conteo, general, personas, subtipos, zonas: [{ id, nombre, municipio }], ejecutivas: [{ id, nombre, kam_id, zona, status }] }` (todas las filas, con cerradas y anuladas, y `set_by_nombre` / `anulado_por_nombre`) |
| `POST /api/config-visitas/vista-previa` | visits:config | cuerpo de `cambioConfigSchema` → `{ plan: planearCambio(...), meses_recalculados }` sin escribir |
| `POST /api/config-visitas/cambios` | visits:config | cuerpo de `cambioConfigSchema` → valida `valores` por tabla (y por parámetro en general; zona, ejecutiva y subtipo existen) → RPC `config_registrar` → 201 `{ id, meses_recalculados }`; 400 validación o motivo; 409 superposición (23P01) |
| `POST /api/config-visitas/cerrar` | visits:config | `{ tabla, id, hasta, motivo? }` → RPC `config_cerrar` → `{ id, accion, vigente_hasta, restaura, meses_recalculados }` (`restaura`: el valor anterior que vuelve a regir, de `planearCierre` con las filas de la clave) |
| `POST /api/config-visitas/subtipos` | visits:config | crea subtipo (`codigo` ^[a-z_]{2,40}$ único, `nombre`, `para_que`, `roles_sugeridos` ⊆ roles de contacto, `orden`, `vigente_desde`) y su conteo inicial `seguimiento` peso 1 desde la misma fecha (con `config_registrar`); 409 si el código existe |
| `PATCH /api/config-visitas/subtipos/[id]` | visits:config | `nombre`, `para_que`, `roles_sugeridos`, `orden`, `vigente_hasta` (apagar; nunca se borra) |
| `GET /api/config-visitas/cuota?executive_id=&mes=` | visits:config o daysoff:approve | igual que `/api/me/cuota` para esa persona |
| `GET /api/calendario?desde=&hasta=&municipio=` | calendar:manage, daysoff:approve, daysoff:view o visits:report | `{ dias: [{ id, fecha, alcance, municipality_id, ciudad, tipo, nombre, origen, anulado_at }] }` (anulados solo para calendar:manage); máximo 400 días por consulta |
| `POST /api/calendario` | calendar:manage | `{ fecha, alcance: 'empresa' \| 'ciudad', municipality_id?, tipo, nombre }` → `origen 'manual'`; 409 si ya hay un día activo igual |
| `POST /api/calendario/[id]/anular` | calendar:manage | `{ motivo }` |
| `POST /api/calendario/festivos` | calendar:manage | `{ anio }` → RPC `calendario_cargar_festivos` → `{ insertados }` |
| `GET /api/dias-libres?desde=&hasta=&estado=&executive_id=` | daysoff:approve (todos) o daysoff:view (sus líneas) | `{ items: [{ id, executive_id, ejecutiva, zona, fecha, fraccion, motivo, motivo_nombre, nota, estado, fuera_de_plazo, justificacion, registrado_por_nombre, registrado_at, revisado_por_nombre, revisado_at, motivo_revision }], puede_aprobar }` |
| `POST /api/dias-libres` | daysoff:approve | registra por otra persona (`diaLibrePorOtraSchema`): día hábil para ella, sin duplicado (409), motivo de la lista vigente; dentro del plazo o, fuera, con `justificacion` (marca `fuera_de_plazo`); queda `aprobado` con `revisado_por` = quien lo registra. 403 si la persona es la ejecutiva enlazada con quien registra (decisión 13) |
| `POST /api/dias-libres/revisar` | daysoff:approve (+ rol en `aprueban`, salvo admin) | `{ ids, accion, motivo? }`: aprobar y rechazar solo desde `por_aprobar`; anular desde registrado, por_aprobar o aprobado → `{ actualizados, omitidos: [{ id, razon }] }`; los días de la ejecutiva enlazada con quien revisa salen en `omitidos` (decisión 13) |
| `GET /api/me/dias-libres?desde=&hasta=` | visits:report | `{ ejecutiva: { id, nombre }, items, plazo_horas, requiere_aprobacion, motivos }` |
| `POST /api/me/dias-libres` | visits:report | `diaLibreCreateSchema`: `puedeRegistrarDiaLibre` con el plazo vigente hoy (400 con la fecha límite), día hábil para ella (400 "Ese día no es hábil en tu calendario"), sin duplicado (409), motivo de la lista vigente; estado inicial según `aprobacion_dias_libres.requiere` → 201 |
| `POST /api/me/dias-libres/[id]/anular` | visits:report | solo su propio día, en `por_aprobar`, o en `registrado` o `aprobado` con fecha ≥ hoy; `motivo_revision = 'Anulado por la ejecutiva'` |
| `GET /api/me/cuota?mes=AAAA-MM` | visits:report | `{ mes, ejecutiva: { id, nombre }, zona, municipio, perfil, medica: { cuota, meta_dia_hoy, origen }, institucional: { ... }, subtipos: [{ subtipo_id, nombre, cuota, ... }], dias_habiles, dias_habiles_transcurridos, dias_libres, dias_por_aprobar, ritmo }` |

Ninguna ruta llama a Google ni recalcula asignaciones. PostgREST corta en 1.000 filas: paginar con
`fetchAllRows` donde haga falta.

## Interfaz

**`/configuracion`** ("Configuración de visitas", `visits:config`), pestañas:
- **Metas**: valores generales (médica, institucional, subtipos con meta propia), excepciones por zona y por
  persona. Cada clave muestra el valor que rige hoy y su **línea de tiempo** (desde, hasta, valor, quién,
  cuándo, motivo; anulados tachados).
- **Qué cuenta**: por subtipo, modo (suma a la institucional, meta propia, solo seguimiento) y peso.
- **Personas**: por Ejecutivo Comercial activo, perfil (médica, institucional), telefónica habilitada, tope de
  telefónicas, radio propio, y su **cuota del mes** (vista previa con `/api/config-visitas/cuota`).
- **General**: radio, plazo de gracia, días hábiles de la semana (lunes a domingo: 0, ½, 1), tope por médico,
  telefónicas, aprobación de días libres (si se exige y quién aprueba), motivos de día libre (lista editable),
  factor del primer mes.
- **Subtipos**: lista, crear, renombrar, cargos sugeridos, orden, apagar.
- Todo cambio usa el mismo formulario: valor nuevo, "Rige desde" (por defecto hoy), "Hasta" opcional, motivo
  (obligatorio si "Rige desde" es anterior a hoy) y, antes de guardar, la **vista previa**: qué valor se corta,
  qué se anula, qué continúa y qué meses se recalculan.

**`/calendario`** ("Calendario"), pestañas según permiso:
- **Calendario**: mes con festivos nacionales, días de empresa y días por ciudad (filtro de ciudad); con
  `calendar:manage`: añadir día de empresa o ciudad (no hábil o hábil), anular con motivo, "Cargar festivos de
  AAAA". Los demás solo ven.
- **Días libres** (`daysoff:approve` o `daysoff:view`): lista filtrable (mes, estado, persona), con casillas y
  **"Aprobar seleccionados"** y "Rechazar seleccionados" (motivo) para quien aprueba; "Registrar por otra
  persona" (con justificación si está fuera de plazo). El líder solo ve.
- **Mis días libres** (`visits:report` con ejecutiva enlazada): registrar (fecha, día completo o medio día,
  motivo, nota), con la fecha límite del plazo de gracia visible; lista con estado; anular; tarjeta **"Mi
  cuota del mes"** (médica e institucional, días hábiles, días libres, por aprobar, ritmo).
- Estilo de `/terceros` y `/executives` (Tailwind); usable en celular (tarjetas, sin tablas anchas, ventanas
  por encima de la barra con las capas de `/terceros`). Nada de mapa.

## Verificación

- `web/scripts/visits-check.ts` (puras) y `web/scripts/visits-api-check.ts` (rutas con Supabase falso), en
  `npm run test`. Casos mínimos (criterios de la spec en el alcance de F2):
  - Festivos 2026 y 2027 exactamente como la lista esperada; 2 de noviembre de 2026 sí, 13 de julio no.
  - Programación "solo seguimiento" desde el 15: las del 14 suman, las del 15 no. Programación con peso 0,5:
    dos visitas suman 1. Compras peso 1 hasta el 31 de octubre y 0,5 desde el 1 de noviembre: octubre no
    cambia. Un rango que se superpone con un valor futuro se rechaza.
  - Corregir el pasado sin motivo se rechaza; con motivo, `mesesAfectados` lista los meses.
  - Meta médica de zona 6 al día y excepción de 4 para una persona, 20 días hábiles y 2 días libres
    aprobados: cuota 72; ritmo al día hábil 10: 50 %.
  - Un festivo de ciudad solo resta un día a quien trabaja en esa ciudad.
  - Plazo de 24 horas: registrar 30 horas después de terminar el día se rechaza; con 48 horas, se permite.
  - Perfil solo institucional: cuota médica 0. Meta semanal 10 con lunes a viernes: 2 por día. Primer mes al
    50 %. Medio día libre resta 0,5. Un día por aprobar no resta y sale en `diasPorAprobar`.
  - Rutas: `viewer` 403 en configuración y días libres; recursos humanos aprueba en bloque; el líder ve solo
    sus líneas y no aprueba; la ejecutiva registra el suyo dentro del plazo, recibe 400 fuera de plazo o en un
    día no hábil y 409 si repite; quien aprueba registra tarde con justificación (`fuera_de_plazo`); usuario
    sin ejecutiva enlazada recibe 403 en `/api/me/*`.
- `npm run check` y `next build` en verde; capturas de `/configuracion` y `/calendario` en escritorio y celular
  con la base migrada.
- La migración se prueba antes contra la base real en una transacción que se deshace (todas sus
  comprobaciones deben pasar) y se aplica con autorización del dueño, en la misma ventana que el despliegue.

## Estado: implementado y en producción (PR #14)

Rama `feat/visitas-f2-config-calendario`. **La migración 0810 está aplicada** (2026-10-12, con autorización del dueño
y en la misma ventana que el despliegue), seguida de `NOTIFY pgrst, 'reload schema';`. Su bloque DO pasó entero.
Resultado en producción: 2 metas generales (médica 6 y institucional 1 al día), 5 reglas de conteo, 9 parámetros, 36
festivos nacionales de 2026 y 2027 y el rol `hr`; las 6 funciones guardadas son idénticas a las del archivo (md5).
Verificado con la base real: la cuota de octubre de una ejecutiva de Barranquilla da 84 médica y 14 institucional
(21 días hábiles, metas desde el 12), ritmo 33 %. Si la base no tuviera la 0810, las rutas responden 503.

### Archivos

- Base de datos: `database/migrations/2026-10-12_0810_visitas_config_calendario.sql` y
  `2026-10-12_9941_visitas_config_calendario_rollback.sql` (las dos probadas contra la base real en transacciones
  que se deshicieron; no quedó nada); `database/migrations/README.md`; `docs/base-de-datos.md` (bloque Fase 7).
- Código puro: `web/lib/visits-rules.ts` (reglas, festivos, vigencias, cuota, conteo y tipos de las respuestas) y
  `web/lib/visits-config-schemas.ts` (zod).
- Permisos y menú: `web/lib/permissions.ts` (rol `hr`, 5 permisos, `PERMISOS_CALENDARIO`),
  `web/components/NavigationWithPermissions.tsx` (íconos), `web/app/users/page.tsx` (rol en los 3 selectores),
  `web/docs/ROLES_AND_PERMISSIONS.md`, `web/app/page.tsx` (quien no tiene mapa, como `hr`, va a `/calendario`).
- API: `web/app/api/config-visitas/_lib/visitas-server.ts` (helpers) y las 18 rutas de la tabla "API" en
  `web/app/api/config-visitas/**`, `web/app/api/calendario/**`, `web/app/api/dias-libres/**`,
  `web/app/api/me/dias-libres/**` y `web/app/api/me/cuota/route.ts`.
- Interfaz: `web/app/configuracion/page.tsx`, `web/app/calendario/page.tsx` y `web/components/visitas/**`
  (pestañas de configuración y de calendario, línea de tiempo, formulario único de cambio con vista previa,
  terminar o cancelar, cuota).
- Pruebas: `web/scripts/visits-check.ts` (puras) y `web/scripts/visits-api-check.ts` (las 18 rutas con Supabase
  falso, RPC incluidas), las dos en `npm run test` (`npm run visits:check`, `npm run visits-api:check`).

### Decisiones que este contrato no fijaba (el dueño puede cambiarlas)

1. **Formas de respuesta** que faltaban: `POST /cerrar` → `{ id, accion: 'cerrar'|'anular'|'nada', vigente_hasta,
   meses_recalculados }`; `POST /subtipos` → 201 `{ subtipo, conteo_id }`; `PATCH /subtipos/[id]` → `{ subtipo }`;
   `POST /api/calendario` → 201 `{ dia }` y `/anular` → `{ dia }`; `POST /api/dias-libres` y `/api/me/dias-libres`
   → 201 `{ dia }`; `/api/me/dias-libres/[id]/anular` → `{ dia }`. En las cuotas `?mes=` es opcional (sin él, el
   mes de hoy); `zona` es `{ id, nombre } | null`, `municipio` el código DANE, `ciudad` su nombre y cada tipo trae
   `aplica` (false si el perfil no incluye el tipo **ningún día del mes pedido**; antes era el perfil de hoy y la
   tarjeta escondía cuotas reales de otros meses: revisión del 2026-10-12). `meta_dia_hoy`, `origen` y `perfil` son
   los de hoy: la tarjeta solo los muestra en el mes en curso. `POST /cerrar` trae además `restaura` (decisión 12).
2. **`GET /api/dias-libres` trae también `plazo_horas` y `motivos` vigentes hoy**: recursos humanos no puede leer
   `/api/config-visitas` y los necesita para "Registrar por otra persona" (antes la pantalla usaba los de la
   semilla). La API los vuelve a validar al guardar.
3. **Registrar por otra persona** exige, además de `daysoff:approve`, que el rol esté en
   `aprobacion_dias_libres.aprueban` (admin siempre), porque el día queda aprobado de una vez; si no, 403 con el
   lugar donde se cambia. Fuera de plazo sin justificación → 400 que la pide.
4. **Vista previa sin la clave `motivo`**: no revisa el motivo (el plan y los meses salen antes de escribirlo);
   con la clave lo revisa igual que la base. La interfaz exige el motivo antes de guardar y la base al guardar.
5. **Subtipo nuevo**: su conteo inicial ("solo seguimiento", peso 1, motivo "Conteo inicial de un subtipo nuevo:
   solo seguimiento") va por `config_registrar`; si ese paso falla, el subtipo recién creado se quita para no
   dejarlo a medias. `orden` es obligatorio (0 a 1000) y el código se guarda en minúsculas.
6. **Revisión en bloque**: cada escritura exige que el estado siga siendo el leído; lo que cambió entretanto sale en
   `omitidos` ("Cambió mientras tanto: vuelve a cargar la lista"). La ejecutiva que anula un día rechazado o ya
   anulado recibe 409; fuera de la regla (registrado o aprobado en el pasado), 400.
7. **Líder de línea**: si pide `executive_id` de alguien fuera de sus líneas, 403.
8. **Cuota**: `metaDiaHoy` es la meta del día completo que rige hoy, con el perfil y el factor del primer mes (0 si
   la persona no está activa o su perfil no incluye el tipo); un día libre en un día no hábil no resta; los días
   hábiles solo cuentan mientras la persona está activa (`started_at`..`left_at`); sin `started_at`, activa todo
   el periodo y sin factor de primer mes. Los subtipos salen en la cuota solo si su modo es `meta_propia` algún
   día del periodo, y cada día solo cuenta si ese día lo es.
9. **Validaciones de `config_general`**: `dias_habiles_semana` exige al menos un día hábil; `aprueban` puede quedar
   vacío (entonces solo aprueba admin); `alertas_mezcla` se valida como un umbral 0..100 por clave, hasta 50 claves,
   y no tiene editor hasta F5.
10. **Migración, además del contrato**: `anulado_por`/`anulado_motivo` solo con `anulado_at`; rangos de los
    parámetros numéricos y las 7 claves de `dias_habiles_semana` en el CHECK; motivo de día libre con forma de
    código; anular un día del calendario exige motivo; nombre no vacío; `calendario.municipality_id` con llave
    foránea a `municipalities(code)`; si dos festivos caen el mismo día (2038-07-05), una sola fila con los dos
    nombres unidos por " y ". `service_role` no tiene DELETE ni TRUNCATE en las 6 tablas.
11. **Interfaz**: en valores generales, conteo y metas de toda la empresa solo se ofrece cancelar lo programado a
    futuro (terminar el vigente dejaría el valor por defecto o 0; para eso está "Cambiar"); en excepciones de zona
    o persona y en Personas sí se puede terminar el vigente. La vista previa de terminar o cancelar dice qué rige
    después: el valor anterior que vuelve (decisión 12) o, si no hay, el valor por defecto de esa configuración.
    `/calendario` abre en "Días libres" para quien aprueba, en "Mis días libres" para quien reporta y si no en
    "Calendario"; "Mis días libres" se oculta si `/api/me/dias-libres` responde 403 (usuario sin ejecutiva) y
    entonces una nota dice por qué y que pida a un administrador enlazar su usuario.
12. **Cancelar o acortar devuelve el valor anterior** (revisión del 2026-10-12): `config_registrar` corta el valor que
    rige en el momento de programar un cambio; antes, cancelar ese cambio dejaba un hueco (valor por defecto, meta 0,
    un subtipo que deja de sumar) aunque la pantalla decía "rige el valor anterior". Ahora cada fila guarda la que
    cortó o reemplazó (`anterior_id`, `anterior_hasta`) y `config_cerrar` la hace volver a regir en el hueco, solo
    hasta donde regía antes. Es lo mismo que registrar el cambio con "hasta" desde el principio (decisión 4). Un
    valor que se registró sobre un hueco (no cortó nada) no revive a nadie. Si el dueño prefiere que terminar el
    vigente de una excepción deje "sin excepción", basta con terminar también el valor que vuelve.
13. **Quien aprueba no se aprueba a sí misma**: `POST /api/dias-libres` responde 403 si la persona es la ejecutiva
    enlazada con quien registra (no hay registro tardío ni aprobado de una vez de lo propio), y `/revisar` deja en
    `omitidos` los días de la ejecutiva enlazada con quien revisa (aprobar, rechazar o anular). Aplica también a
    admin (pendiente del dueño si admin queda exento). Sus días los registra en "Mis días libres" y los aprueba otra
    persona que apruebe.
14. **Listas y lotes**: "Mis días libres" pide desde 90 días atrás y sin fin (`consultaMisDiasLibres`), así sale todo
    lo que se puede registrar (hasta 366 días adelante) y se puede anular; la revisión en bloque de más de 200 días se
    manda en lotes de 200 (`enLotes`), uno tras otro, sumando actualizados y omitidos (si falla un lote posterior, los
    anteriores quedan y el aviso lo dice).

### Verificación hecha (2026-10-12)

- `npm run check` y `next build` en verde (salida en el informe de integración). Pruebas: `visits-check` 370 bien;
  `visits-api-check` 151 bien (incluye las de la decisión 2, que fallan si la ruta devuelve los valores de la
  semilla: comprobado con una mutación temporal).
- **`planearCambio` (TS) frente a `config_registrar` (SQL)**: la función copiada tal cual del archivo de la
  migración (solo cambia el schema a `pg_temp`), sobre una tabla temporal en la base real, en un bloque que termina
  con `RAISE EXCEPTION` (no quedó nada), con 30 casos: valor abierto, corte, temporal con continuación, mismo día
  (anula), mismo día y temporal, hueco sin valor, tres tramos, superposición con un valor futuro (23P01), pasado
  sin motivo, con motivo de 4 o de solo espacios (23514), con motivo, `hasta < desde` (23514), valor de un solo
  día, contiguo, anulada que no cuenta. **29 de 30 idénticos** (mismas filas finales y mismo error). El caso 30
  es la única diferencia: `btrim()` de PostgreSQL solo quita espacios y `trim()` de JS también tabuladores, así
  que un motivo "\t\tabc\t\t" lo rechaza la vista previa y lo aceptaría la función. Por la API no ocurre: zod
  recorta el motivo con `trim()` antes de llamar a la base.
- `planearCierre` frente a `config_cerrar`: revisado a mano, mismo orden de reglas (no existe → anulada → motivo
  en el pasado → anular si `hasta < vigente_desde` → cerrar si estaba abierta o terminaba después → nada) y, desde la
  revisión, el mismo paso de "vuelve el valor anterior" (decisión 12): los casos del bloque DO (m1 a m5: alargar,
  copiar al acortar, mismo día, valor registrado en un hueco y en cadena) están también en `visits-check` (12d) y en
  el Supabase falso de `visits-api-check`.
- Revisión del 2026-10-12 (correcciones de los verificadores): `visits-check` 405 bien, `visits-api-check` 162 bien;
  0810 probada otra vez contra la base real en una transacción que terminó con `DRYRUN_OK` y 0810 + 9941 con
  `DRYRUN_ROLLBACK_OK` (no quedó nada: `to_regclass('public.config_metas')` NULL y `users_role_check` con 8 roles).
  Rastro del ensayo: el texto que se mandó (derivado sin `BEGIN;`/`COMMIT;` y con el `RAISE` final) es idéntico byte a
  byte al que sale hoy de la migración (sha256 de 0810 `9a016886…7252`, de 9941 `d2f6ca44…76d9`; en el de 9941 solo
  cambia el bloque final de comprobación). Consulta de solo lectura en la base real (2026-10-12, tarde): no existen
  `config_metas`, `calendario`, `dias_libres` ni las funciones de 0810, `users_role_check` sigue con los 8 roles y
  `btree_gist` no está instalada.
- **Capturas con datos de demostración (2026-10-12)**, todavía SIN la base migrada: la app real (`next dev`, páginas,
  componentes y las 18 rutas tal cual) en una copia aislada de `web/` sin `.env*`, contra un PostgREST falso en
  `127.0.0.1` con el núcleo de `scripts/visits-api-check.ts` (las funciones `config_registrar`, `config_cerrar` y
  `calendario_cargar_festivos`, índices y CHECK) y la semilla de 0810 más ejemplos inventados (excepciones, valores
  programados, un valor anulado, días de empresa y de ciudad, días libres en cada estado). Nada salió a la red
  (Chrome sin ventana registró cero peticiones fuera de 127.0.0.1) y no se tocó producción. 24 capturas, escritorio
  (1366) y celular (390): las cinco pestañas de Configuración, el formulario con vista previa (futuro y pasado), la
  cuota de una persona, Calendario y Días libres para directora, recursos humanos, líder y ejecutiva, aprobar en
  bloque, guardar un cambio y `viewer` con acceso denegado. Sin errores de consola ni desborde horizontal. La cuota de
  la ejecutiva de ejemplo cuadra a mano (octubre de 2026 en Bucaramanga: 21 días hábiles = 22 de lunes a viernes − 12
  de octubre − día de ciudad del 23 + sábado hábil de empresa del 31; médica 4 × 13 días desde el 12 = 52).
  Arreglos que salieron de las capturas: (1) las ventanas de F2 quedaban 1,5 rem más abajo y dejaban ver la barra,
  porque se abren dentro de contenedores `space-y-*` y esa regla le daba margin-top al fondo fijo: ahora
  `components/visitas/comun.tsx` exporta `Modal` (el de terceros dentro de una caja `display: contents`) y las
  ventanas de F2 lo importan de ahí; (2) la tarjeta "Mi cuota del mes" cortaba el título ("Mi cuota del ...") y las
  etiquetas ("Transcu...") en la columna angosta de escritorio: título encima del selector y cifras en 2 × 2.

### Pendiente

- Aplicar 0810 (autorización del dueño) y `NOTIFY pgrst, 'reload schema';`.
- Capturas de `/configuracion` y `/calendario` en escritorio y celular **con la base migrada** (hasta entonces
  las pantallas muestran el 503). Las de datos de demostración (arriba) ya muestran la interfaz; falta repetirlas
  contra la base real después de aplicar 0810.
- Decisión del dueño (decisión 13): si admin, cuando su usuario esté enlazado a un Ejecutivo Comercial, puede aprobarse
  o registrarse sus propios días libres (hoy no: aplica a todos).
- Decisión del dueño: `config_cerrar` exige motivo al cerrar en el pasado, pero si cierra sin anular no hay
  columna donde guardar ese motivo ni quién cerró (`config_inmutable` solo deja cambiar `vigente_hasta` y
  `anulado_*`). Si debe quedar rastro, hace falta `cerrado_por`, `cerrado_at` y `cerrado_motivo` en una migración
  nueva.
- 24 y 31 de diciembre no se siembran (decisión 8): los declara recursos humanos o la directora si aplican.
