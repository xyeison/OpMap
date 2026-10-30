# Fase 6 · App de visita · F1 Terceros (contrato de implementación)  (2026-10-12)

Spec aprobada: `docs/specs/2026-10-12-app-de-visita-opmap.md` (secciones 3, 9 y 11). Decisiones:
`docs/decisiones/2026-10-12-app-de-visita.md`. Este documento fija nombres de tablas, rutas, formas JSON y
permisos para que base de datos, API e interfaz se construyan en paralelo sin desencontrarse.

Alcance de F1: **cuentas con sus sedes, médicos completos, sedes donde atiende cada médico, visitantes del
médico por línea y ciudad, contactos y la semilla de subtipos institucionales**, con pantallas web para
crearlos y consultarlos. No incluye visitas, metas, configuración, calendario ni la app móvil (F2 a F4).

## Reglas del dueño que F1 debe cumplir

- **Una sola tabla de terceros-organización** (`cuentas`) con sede principal y sedes. Una cuenta puede ser
  clínica, cliente o las dos (`clase` + `es_cliente`). Una cuenta por identificación (no se repite el NIT).
- **Los consultorios son IPS**: cuenta de clase `consultorio` con su sede (código de habilitación del REPS si
  lo tiene).
- **Médicos completos desde el inicio o no se crean**: tipo y número de identificación, nombre, al menos una
  especialidad, municipio y al menos una sede donde atiende. Un médico sin sede no puede quedar guardado.
  Un segundo médico con el mismo documento se rechaza y se muestra el existente.
- **Visitantes, no responsable**: varias ejecutivas por médico, cada una por una línea, incluso dos de la
  misma línea en ciudades distintas.
- **Nada se trae de VMO** y no hay carga masiva: los terceros se crean a mano. La única carga automática es la
  de las 783 IPS activas de `hospitals` como sedes agrupadas por NIT (ya existen en OpMap).
- `hospitals` **no cambia** y los consultorios o sedes nuevas **no entran** a `hospitals` (zonas, mapa, rutas).
- El documento del médico es dato protegido: solo lo ve quien tiene `terceros:manage`; nunca sale en listas,
  exportaciones ni respuestas de quien no tiene ese permiso.
- Terminología visible: "Cuenta", "Sede", "Médico", "Contacto", "Ejecutivo Comercial", "Zona". Nunca "KAM".

## Base de datos (migración `database/migrations/2026-10-12_0800_visitas_terceros.sql`, rollback `2026-10-12_9940_visitas_terceros_rollback.sql`)

Todas las tablas: RLS activado sin políticas; `REVOKE ALL ... FROM PUBLIC, anon, authenticated`; `GRANT` a
`service_role`; `COMMENT ON`; `created_at` / `updated_at timestamptz default now()`; `created_by uuid NULL
REFERENCES users(id) ON DELETE SET NULL` donde aplique.

| Tabla | Columnas | Restricciones |
| --- | --- | --- |
| `cuentas` | `id uuid pk default gen_random_uuid()`, `nombre text not null`, `clase text not null`, `es_cliente boolean not null default false`, `tipo_identificacion text not null`, `numero_identificacion text not null`, `codigo_prestador text null`, `modalidad_facturacion text null`, `notas text null`, `activo boolean not null default true`, `origen text not null default 'manual'` | `clase IN ('clinica','consultorio','eps','operador_logistico','otra')`; `tipo_identificacion IN ('NIT','CC','CE','PA','otro')`; `numero_identificacion ~ '^[0-9A-Z]{3,20}$'` (NIT a 9 dígitos sin DV, como `hospitals.nit`); `UNIQUE (tipo_identificacion, numero_identificacion)`; `modalidad_facturacion IN ('directa','via_clinica')` y solo si `clase = 'eps'`; `origen IN ('hospitals','manual')`; `length(trim(nombre)) >= 2` |
| `sedes` | `id`, `cuenta_id uuid not null references cuentas on delete restrict`, `nombre text not null`, `es_principal boolean not null default false`, `reps_code text null`, `hospital_id uuid null references hospitals on delete set null`, `direccion text null`, `municipality_id varchar(5) null`, `ciudad text null`, `lat numeric(9,6) null`, `lng numeric(9,6) null`, `ubicacion_confirmada boolean not null default false`, `activo boolean not null default true`, `origen text not null default 'manual'` | `UNIQUE (reps_code)`, `reps_code ~ '^[0-9]{12}$'`; `UNIQUE (hospital_id)`; índice único parcial `(cuenta_id) WHERE es_principal`; `origen IN ('hospitals','manual','gps_app')`; lat/lng ambos o ninguno, dentro de Colombia (lat -5..14, lng -82..-66) |
| `medicos` | `id`, `tipo_documento text not null`, `numero_documento text not null`, `nombre text not null`, `especialidades text[] not null`, `municipality_id varchar(5) not null`, `telefono text null`, `email text null`, `notas text null`, `activo boolean not null default true` | `tipo_documento IN ('CC','CE','PA','PEP','PPT','otro')`; `numero_documento ~ '^[0-9A-Z]{3,20}$'`; `UNIQUE (tipo_documento, numero_documento)`; `length(trim(nombre)) >= 3`; `cardinality(especialidades) >= 1` y `especialidades <@ ARRAY['ortopedia','neurocirugia','columna','deportiva','maxilofacial','fisiatria','cirugia_general','otra']`; **al menos una fila en `medico_sedes`**: constraint trigger `DEFERRABLE INITIALLY DEFERRED` sobre `medicos` (insert) y `medico_sedes` (delete/update) que lanza error si un médico activo queda sin sede al cerrar la transacción |
| `medico_sedes` | `medico_id uuid not null references medicos on delete cascade`, `sede_id uuid not null references sedes on delete restrict`, `rol text not null`, `principal boolean not null default false` | `PRIMARY KEY (medico_id, sede_id)`; `rol IN ('consultorio','atiende')`; índice único parcial `(medico_id) WHERE principal` |
| `medico_visitantes` | `id`, `medico_id uuid not null references medicos on delete cascade`, `executive_id uuid not null references executives`, `line_id uuid not null references business_lines`, `municipality_id varchar(5) null`, `desde date not null default (now() at time zone 'America/Bogota')::date`, `hasta date null` | `hasta IS NULL OR hasta >= desde`; índice único parcial `(medico_id, executive_id, line_id, coalesce(municipality_id, ''))` `WHERE hasta IS NULL` |
| `contactos` | `id`, `cuenta_id uuid not null references cuentas on delete restrict`, `sede_id uuid null references sedes on delete set null`, `nombre text not null`, `cargo_texto text null`, `rol text not null default 'otro'`, `telefono text null`, `email text null`, `activo boolean not null default true` | `rol IN ('compras','gerencia','direccion_medica','quimico_farmaceutico','almacen_farmacia','autorizaciones','auditoria_medica','programacion_cirugia','quirofano','esterilizacion','instrumentacion','cartera_facturacion','otro')`; trigger: si `sede_id` no es null, la sede debe ser de la misma cuenta |
| `subtipos_institucionales` | `id`, `codigo text not null unique`, `nombre text not null`, `para_que text not null`, `roles_sugeridos text[] not null default '{}'`, `orden int not null`, `vigente_desde date not null`, `vigente_hasta date null` | Semilla (vigente desde 2026-10-12): `compras` (roles compras, gerencia, direccion_medica), `quimico_farmaceutico` (quimico_farmaceutico, almacen_farmacia), `autorizaciones` (autorizaciones, auditoria_medica), `programacion` (programacion_cirugia, quirofano, esterilizacion, instrumentacion), `otro` (otro) |

**Funciones**
- `terceros_crear_medico(p_medico jsonb, p_sedes jsonb, p_user uuid) RETURNS uuid` (SECURITY INVOKER, solo
  `service_role`): inserta el médico y sus `medico_sedes` en una sola transacción; error si `p_sedes` está vacío;
  marca principal la primera si ninguna viene marcada. La API la usa para crear médicos (PostgREST no tiene
  transacciones).
- `terceros_sincronizar_hospitals()` idempotente + trigger `AFTER INSERT OR UPDATE OF active, name, reps_code,
  lat, lng, address, municipality_id ON hospitals`: toda IPS activa de `hospitals` tiene su sede
  (`origen='hospitals'`, `hospital_id`, `reps_code`, `nombre = hospitals.name`, `direccion = address`,
  `municipality_id`, `ciudad = municipality_name`, `lat/lng`, `ubicacion_confirmada = true`) dentro de la cuenta
  de su NIT (`tipo 'NIT'`, `clase 'clinica'`, `origen 'hospitals'`); crea la cuenta si no existe (nombre: el
  `nombre_prestador` más frecuente en `reps_sedes` para ese NIT, o el de la sede con más camas). Si la IPS se
  renombra, se mueve o cambia de código, actualiza la sede; si se desactiva, `sedes.activo = false`. Nunca
  borra. La sede principal de cada cuenta cargada es la de más camas (desempate por nombre). La migración la
  ejecuta una vez: resultado esperado 703 cuentas y 783 sedes (47 cuentas con más de una sede).
- Bloque `DO` final que comprueba todo y aborta si algo no cuadra (conteos, restricciones con INSERT de prueba
  deshechos, médico sin sede rechazado, privilegios solo `service_role`).

## Permisos (`web/lib/permissions.ts`)

| Permiso | Para qué | Roles |
| --- | --- | --- |
| `terceros:view` | Ver cuentas, sedes, médicos (sin documento), contactos | admin, commercial_director, line_leader, sales_manager, data_manager, viewer |
| `terceros:create` | Crear cuentas, sedes, médicos y contactos | admin, commercial_director, line_leader, sales_manager, data_manager |
| `terceros:manage` | Editar o desactivar cualquiera, ver documentos, confirmar sedes, marcar cliente y modalidad | admin, commercial_director, data_manager |
| `visitantes:manage` | Asignar y terminar visitantes de un médico | admin, commercial_director, line_leader (solo líneas donde `business_lines.leader_user_id` = ella) |

Menú: "Terceros" → `/terceros` para `terceros:view`.

## Código puro (`web/lib/terceros.ts` y `web/lib/terceros-schemas.ts`)

- Constantes: `CLASES_CUENTA`, `TIPOS_ID_CUENTA`, `TIPOS_DOC_MEDICO`, `ESPECIALIDADES` (con etiqueta en español),
  `ROLES_CONTACTO` (con etiqueta), `SUBTIPOS_SEMILLA`.
- `normalizarIdentificacion(tipo, numero)`: quita espacios, puntos y guiones, mayúsculas; NIT a 9 dígitos sin DV
  (reutiliza `normalizeNit` de `web/lib/secop.ts`); CC solo dígitos; devuelve `null` si no es válido.
- `normalizarNombre(nombre)` para buscar parecidos (minúsculas, sin tildes, sin "dr.", "dra.", espacios
  colapsados) y `nombresParecidos(a, b)`.
- `rolDesdeCargo(cargoTexto)` → rol de contacto por reglas ("jefe de compras" → compras; "químico" →
  quimico_farmaceutico; "programación", "programador de cirugía" → programacion_cirugia; "quirófano", "salas de
  cirugía" → quirofano; "esterilización" → esterilizacion; "instrumentador" → instrumentacion; "almacén",
  "farmacia" → almacen_farmacia; "cartera", "facturación" → cartera_facturacion; "autorizaciones" →
  autorizaciones; "auditor médico" → auditoria_medica; "gerente", "director" → gerencia; "director científico",
  "director médico" → direccion_medica; resto → otro).
- `subtipoSugerido(rol, subtipos)` → código del subtipo cuyo `roles_sugeridos` contiene el rol, o `otro`.
- Esquemas zod: `cuentaCreateSchema` (incluye la sede principal), `cuentaUpdateSchema`, `sedeCreateSchema`,
  `sedeUpdateSchema`, `medicoCreateSchema` (`sedes` mínimo 1: `{ sede_id, rol }`), `medicoUpdateSchema`,
  `medicoVerificarSchema`, `visitanteCreateSchema`, `contactoCreateSchema`, `contactoUpdateSchema`.
- Pruebas: `web/scripts/terceros-check.ts` (puras, sin red), añadidas a `npm run test`.

## API (todas con `requirePermission`, `supabaseAdmin`, errores `{ error }`)

| Ruta | Permiso | Respuesta |
| --- | --- | --- |
| `GET /api/terceros/cuentas?q=&clase=&cliente=&page=` | terceros:view | `{ items: [{ id, nombre, clase, es_cliente, tipo_identificacion, numero_identificacion*, modalidad_facturacion, sedes: n, activo }], total, page }` (* el número de identificación de una cuenta `consultorio` con tipo CC/CE/PA solo con terceros:manage; el NIT sí se muestra) |
| `POST /api/terceros/cuentas` | terceros:create | crea cuenta + sede principal; 409 con `{ existente: { id, nombre } }` si ya hay una cuenta con esa identificación |
| `GET /api/terceros/cuentas/[id]` | terceros:view | `{ cuenta, sedes: [...], contactos: [...] }` |
| `PATCH /api/terceros/cuentas/[id]` | terceros:manage | edita nombre, clase, es_cliente, modalidad, notas, activo |
| `POST /api/terceros/sedes` | terceros:create | crea sede de una cuenta (`origen 'manual'`, `ubicacion_confirmada false`); 409 si el `reps_code` ya existe |
| `PATCH /api/terceros/sedes/[id]` | terceros:manage | edita; `ubicacion_confirmada`; `es_principal` (cambia la principal de la cuenta) |
| `GET /api/terceros/sedes?q=&municipio=` | terceros:view | buscador de sedes para vincular médicos: `{ items: [{ id, nombre, cuenta_id, cuenta_nombre, ciudad, reps_code }] }` |
| `GET /api/terceros/medicos?q=&municipio=&visitante=me` | terceros:view | `{ items: [{ id, nombre, especialidades, municipality_id, ciudad, sedes: [{ id, nombre, rol }], visitantes: [{ executive, line }], activo }], total, page }` sin documento |
| `POST /api/terceros/medicos/verificar` | terceros:create | `{ existente: { id, nombre } \| null, parecidos: [{ id, nombre, ciudad }] }` |
| `POST /api/terceros/medicos` | terceros:create | crea con `terceros_crear_medico`; 409 con `existente` si el documento ya existe; 400 si falta algo |
| `GET /api/terceros/medicos/[id]` | terceros:view | detalle (documento solo con terceros:manage) |
| `PATCH /api/terceros/medicos/[id]` | terceros:manage | edita datos (no permite quitar el documento) |
| `POST /api/terceros/medicos/[id]/sedes` · `DELETE /api/terceros/medicos/[id]/sedes?sede_id=` | terceros:create · terceros:manage | vincula / desvincula; no deja al médico sin sede (400) |
| `POST /api/terceros/medicos/[id]/visitantes` | visitantes:manage | `{ executive_id, line_id, municipality_id? }`; line_leader solo sus líneas (403); la ejecutiva debe llevar esa línea (`executive_lines`) |
| `PATCH /api/terceros/medicos/[id]/visitantes/[visitanteId]` | visitantes:manage | `{ hasta }` termina la asignación (nunca se borra) |
| `POST /api/terceros/contactos` · `PATCH /api/terceros/contactos/[id]` | terceros:create · terceros:manage | `rol` por defecto `rolDesdeCargo(cargo_texto)` |
| `GET /api/terceros/subtipos` | terceros:view | subtipos vigentes |

## Interfaz (`/terceros`)

- Pestañas **Cuentas** y **Médicos**, buscador, filtros (clase, cliente, ciudad), en escritorio y celular.
- Cuenta: lista; detalle con sedes (principal marcada, IPS de OpMap con enlace a su ficha, consultorios) y
  contactos (cargo y rol). Formularios: nueva cuenta con su sede principal; nueva sede; nuevo contacto (el rol
  se sugiere por el cargo, editable). Con terceros:manage: editar, marcar cliente y modalidad (solo EPS),
  confirmar ubicación de sedes nuevas.
- Médico: lista con especialidades, sedes y visitantes. **Nuevo médico**: tipo y número de documento →
  "Verificar" (si existe, muestra el existente y no deja crear), nombre, especialidades, municipio, sedes donde
  atiende (buscador de sedes + rol consultorio/atiende; al menos una; si su consultorio no existe, crear la
  cuenta consultorio con su sede desde ahí). Detalle con visitantes: añadir (ejecutiva, línea, ciudad
  opcional) y terminar, para quien tenga visitantes:manage.
- Estilo de las páginas existentes (Tailwind, como `/executives`); nada de mapa.

## Estado: implementado y en producción (PR #13)

Rama `feat/visitas-f1-terceros` (2026-10-12). **La migración 0800 está aplicada** (2026-10-12, con autorización
del dueño y en la misma ventana que el despliegue), seguida de `NOTIFY pgrst, 'reload schema';`. Su bloque DO pasó
entero. Resultado en producción: 703 cuentas (origen hospitals, 681 con código de prestador del REPS), 783 sedes
activas (727 con código de habilitación, todas con coordenadas válidas), 47 cuentas con más de una sede (la mayor:
Clínica Colsanitas, 10) y una principal por cuenta. Las 5 funciones guardadas son idénticas a las del archivo.
Si la base no tuviera la 0800, las rutas `/api/terceros/**` responden 503 con un mensaje claro.

Archivos:
- Base de datos: `database/migrations/2026-10-12_0800_visitas_terceros.sql`,
  `database/migrations/2026-10-12_9940_visitas_terceros_rollback.sql`, `database/migrations/README.md` (fila 16),
  `docs/base-de-datos.md`.
- Código puro y permisos: `web/lib/terceros.ts`, `web/lib/terceros-schemas.ts`, `web/lib/permissions.ts`,
  `web/docs/ROLES_AND_PERMISSIONS.md`.
- API: `web/app/api/terceros/_lib/terceros-server.ts`, `web/app/api/terceros/_lib/listas.ts` (listas de cuentas y
  médicos, compartidas por GET y POST `.../buscar`) y las rutas `cuentas`, `cuentas/buscar`, `cuentas/[id]`, `sedes`,
  `sedes/[id]`, `medicos`, `medicos/buscar`, `medicos/verificar`, `medicos/[id]`, `medicos/[id]/sedes`,
  `medicos/[id]/visitantes`, `medicos/[id]/visitantes/[visitanteId]`, `contactos`, `contactos/[id]` y `subtipos`
  (todas bajo `web/app/api/terceros/`).
- Interfaz: `web/app/terceros/page.tsx` ("Cuentas clave" desde el 2026-10-29) y `web/components/terceros/` (`comun`,
  `MunicipioSelector`, `CuentasTab`, `CuentaDetalleModal`, `CuentaForm`, `SedeForm`, `ContactoForm`). Desde el
  2026-10-29 Médicos está en "Próximamente" (`/medicos`): se borraron `MedicosTab`, `MedicoForm`, `MedicoDetalleModal`
  y `SedeBuscador` (siguen en git) y asignar visitantes queda sin pantalla hasta que vuelva Médicos; la API
  `/api/terceros/medicos/**` y la app de visita no cambian. Menú en `web/lib/permissions.ts`
  (`docs/specs/2026-10-29-menu-por-grupos.md`).
- Pruebas (puras, sin red, dentro de `npm run test`): `web/scripts/terceros-check.ts` (`npm run terceros:check`) y
  `web/scripts/terceros-api-check.ts` (`npm run terceros-api:check`, Supabase falso en memoria).

Decisiones de implementación que el contrato no fijaba:
- `terceros_sincronizar_hospitals(p_hospital_id uuid DEFAULT NULL)`: sin argumento sincroniza todas las IPS (la
  llamada del contrato); con un id, solo esa IPS (la usa el disparador). El disparador escucha además `code` (cambio
  de NIT: la sede pasa a la cuenta del NIT nuevo) y `municipality_name` (alimenta `sedes.ciudad`). Lo que no cabe en
  las restricciones (coordenadas fuera de Colombia, municipio que no es de 5 dígitos, código de habilitación que ya
  tiene otra sede) queda en NULL con WARNING: una escritura en `hospitals` nunca falla por la sincronización.
- CHECK de más en la base: NIT a 9 dígitos, `municipality_id` de 5 dígitos, nombre no vacío en sedes y contactos,
  `roles_sugeridos` dentro de los 13 roles de contacto; `created_by` también en `medico_sedes` y
  `subtipos_institucionales`; el médico sin sede también se comprueba al reactivarlo (`UPDATE OF activo`).
- NIT: 9 dígitos; si viene el DV debe ser el de la DIAN. Una persona natural se registra con su cédula (CC). La
  identificación de cualquier cuenta que no sea NIT (no solo consultorios con CC/CE/PA) solo sale con
  `terceros:manage`, y sin ese permiso buscar por número solo encuentra NIT.
- **El NIT no se repite cambiando el tipo** (revisión del 2026-10-12; la llave de la base sigue siendo tipo + número):
  una cuenta CC, CE, PA u "otro" no admite un dígito de verificación tras guion ("900.123.456-7", o el NIT de una
  persona "79.123.456-1": la cédula va sin DV); "otro" no admite un número con forma de NIT (9 dígitos, 9 + "-DV" o 10
  que empiezan por 8 o 9 con el DV del NIT) y debe ir como NIT; y si el número (9 dígitos, o 10 con el DV del NIT)
  es el de una cuenta NIT que ya existe, `POST /api/terceros/cuentas` responde 409 con esa cuenta en `existente`. Al
  revés también: un NIT nuevo igual a una cuenta CC/CE/PA/otro (solo o con su DV pegado) es 409. Reglas puras en
  `validarIdentificacionCuenta`, `nitsEquivalentes` y `numerosEquivalentesANit` (`web/lib/terceros.ts`). Queda sin
  cubrir la sincronización con `hospitals` (base de datos): si alguien creara a mano una CC de 9 dígitos y después
  entrara a `hospitals` una IPS con ese NIT, quedarían dos cuentas (caso raro: el NIT de una empresa empieza por 8
  o 9).
- **Búsquedas sin documentos en la URL** (revisión del 2026-10-12): la interfaz busca con `POST
  /api/terceros/cuentas/buscar` y `POST /api/terceros/medicos/buscar` (`terceros:view`), con los mismos filtros que el
  GET en el cuerpo (`{ q, clase, cliente, municipio, activo, page }` y `{ q, municipio, visitante: 'me', activo, page
  }`) y la misma respuesta. Solo ahí, y solo con `terceros:manage`, un número busca también la identificación de una
  persona (CC/CE/PA/otro de una cuenta) o el documento del médico. Por GET un número solo busca NIT y en médicos solo
  se busca por nombre: lo que va en una URL queda en los logs de peticiones de Vercel y del proxy. Filtros validados
  con `busquedaCuentasSchema` / `busquedaMedicosSchema`.
- **Parecidos de verificar sin tope**: `POST /api/terceros/medicos/verificar` lee todos los candidatos de cada palabra
  en páginas de 1.000 (antes se cortaba en 1.000 por id y el parecido de verdad podía quedar fuera en silencio).
- **Visitantes que dejan de cumplir la regla**: la ejecutiva debe llevar la línea y estar activa al asignar. Desde la
  migración 0820 (decisión del dueño del 2026-10-12, ver abajo) quitarle la línea o darla de baja **termina sola** la
  asignación vigente (disparadores `executive_lines_termina_visitantes` y `executives_baja_termina_visitantes`,
  `fin_motivo` 'linea_quitada' o 'baja'), y `visitante=me` ignora al Ejecutivo Comercial inactivo. Queda como red de
  seguridad el `aviso` en listas y detalle ("El Ejecutivo Comercial ya no lleva esta línea", "... está inactivo", "La
  línea está inactiva"; `avisoVisitante` en `web/lib/terceros.ts`) que la interfaz marca "Revisar": hoy solo puede
  salir por una línea desactivada o por datos de antes de la 0820.
- Marcar cliente o modalidad al crear una cuenta sin `terceros:manage` responde 403. `PATCH` de cuenta también acepta
  `codigo_prestador`.
- Una sede que es una IPS de OpMap (`hospital_id`) solo admite `es_principal` por `PATCH /api/terceros/sedes/[id]`:
  sus demás datos los pisa la sincronización y se cambian en la ficha de la IPS (400 si se intenta aquí).
- Filtro "ciudad": `GET /api/terceros/cuentas?municipio=` (cuentas con alguna sede activa en ese municipio) y
  `GET /api/terceros/medicos?municipio=`. Filtro opcional `?activo=` en ambas listas.
- Las creaciones responden 201 con `{ id, <objeto> }` (cuenta además con su `sede`); las acciones sobre un médico
  (vincular, desvincular, visitantes) devuelven también `{ medico }` con el detalle. El 409 por código de
  habilitación trae `existente` con `cuenta_id` y `cuenta_nombre`.
- El detalle de un médico trae los visitantes vigentes y, como historia, los terminados (con `hasta`); las listas
  solo los vigentes. `hasta` va de `desde` a hoy (hora de Colombia); terminar una asignación ya terminada es 409.
- Cambiar el cargo de un contacto no recalcula su rol. El municipio es obligatorio en toda sede nueva.

Pendiente: aplicar 0800 (dueño), revisión con el subagente `revisor`, preview con sesión y la base migrada
(escritorio y celular) y el PR. **Decisión del dueño (RESUELTA el 2026-10-12)**: al quitarle una línea a una
ejecutiva o darla de baja, sus asignaciones vigentes de esa línea se terminan solas ("si alguien se va o se le quita,
pues ya no está") y lo suyo se pasa a otra persona con el traspaso en un paso: ver
[`docs/decisiones/2026-10-12-traspaso-de-ejecutivas.md`](../decisiones/2026-10-12-traspaso-de-ejecutivas.md) y la spec
`docs/specs/2026-10-12-traspaso-ejecutivo-comercial.md` (migración 0820, escrita y sin aplicar).
