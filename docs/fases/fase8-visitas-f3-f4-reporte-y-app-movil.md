# Fase 8 · App de visita · F3 reporte de visitas y voz + F4 app móvil (contrato de implementación)  (2026-10-13)

Spec aprobada: `docs/specs/2026-10-12-app-de-visita-opmap.md` (secciones 2, 4, 5, 8, 9 "Voz", 10, 11 y 12).
Decisiones del dueño: `docs/decisiones/2026-10-12-app-de-visita.md` y
`docs/decisiones/2026-10-13-dias-libres-admin-y-dias-de-empresa.md`. F1 (terceros, 0800), F2 (configuración y
calendario, 0810) y el traspaso (0820) ya están en producción. Este documento fija nombres de tablas, funciones,
rutas, formas JSON, permisos y pantallas para que base de datos, código puro, API y app se construyan en paralelo.

Alcance: **F3** = la visita como dato (`visits` ampliada, `visit_lines`), las reglas que la validan (radio, mismo
día, topes, perfil, telefónica), la API de la ejecutiva (`/api/me/*`: contexto, visitas, voz), la **sesión para el
teléfono** (token de portador) y la voz (transcribir con OpenAI y proponer con Claude, **sin guardar audio**).
**F4** = la app móvil (Expo / React Native, iPhone y Android) en `mobile/`: sesión, Hoy, Reportar por voz con
respaldo por toques, crear médico completo o sede nueva, Mis días libres, Mis números. No incluye el tablero de
dirección ni los KPIs 2 a 6 (F5).

## Reglas del dueño que F3 y F4 deben cumplir

- **La voz primero**: la ejecutiva pulsa un botón, dice qué pasó, la app transcribe, propone una o varias visitas
  y muestra una confirmación corta; un toque. Corrige hablando o cambia el subtipo. El respaldo por toques tiene
  los mismos campos.
- **El audio no se guarda**: se transcribe en el servidor y se desecha; en el teléfono se conserva solo hasta que
  la transcripción llega. Se guarda la transcripción con la visita.
- **Dos tipos de visita**: médica (médico + sede donde atiende) e institucional (cuenta + sede + subtipo).
  Una llegada a una clínica puede dejar varias visitas.
- **Presencial solo en el sitio y el mismo día**: a menos del radio vigente (500 m por defecto, excepción por
  persona) de la sede elegida; la API rechaza si no. Lejos: telefónica si la persona la tiene habilitada (tope
  diario, solo llamada o videollamada) o crear la sede nueva con el GPS del sitio antes de reportar.
- **Mismo día, tiempo real**: fecha y hora del teléfono al confirmar; sin señal, la app guarda con el punto y la
  hora del sitio y envía sola al volver la señal, antes de medianoche; no se reportan días anteriores desde la app.
- **Médicos completos o no se crean**: tipo y número de documento (se digita, nunca se dicta), nombre,
  especialidad, ciudad y al menos una sede. Si el documento existe, se muestra el existente. La IA nunca inventa
  un tercero ni produce un número de documento.
- **Topes iniciales** (configurables en Configuración): una visita por médico al día; telefónicas hasta 1 de las 6.
- **Solo la visita efectiva suma**; la no efectiva se guarda con motivo. Qué suma y con qué peso lo decide la
  configuración vigente en la fecha (F2: `valorVisita`).
- **Sede nueva desde la app**: suma al instante si trae código de habilitación del REPS que cruza con el
  municipio; si no, cuando data manager la confirma (`ubicacion_confirmada`). La visita se guarda igual y NO suma
  mientras la sede esté por confirmar; al confirmarla suma sola (la API mira la sede al contar: decisión 29).
- **Visita a un médico del que no es visitante**: suma a su meta, queda marcada `out_of_territory` y la app
  ofrece "pedir ser su visitante" (en F3 queda la marca; la asignación la hace quien tiene visitantes:manage).
- **Privacidad**: nada de pacientes; documento del médico fuera de listas, voz y tarjetas; la transcripción es
  interna (ejecutiva, su líder, dirección). Cuentas de OpenAI y Anthropic a nombre de VG, sin uso de los datos
  para entrenar (el dueño las crea hoy; hasta entonces la voz responde 503 con mensaje claro y el respaldo por
  toques funciona).
- Terminología visible: "Ejecutivo Comercial", "Zona", "IPS", "Médico", "Cuenta", "Sede", "Contacto", "Visita".
  Nunca "KAM", "representante" ni "panel". Nada llama a Google Maps.

## Decisiones de implementación (Claude; el dueño puede cambiarlas)

1. **Sesión del teléfono**: el mismo token firmado de la web (`signSession`, 7 días) pero entregado en el cuerpo
   de `POST /api/auth/login` cuando la petición trae `cliente: 'movil'`, sin cookie; la app lo guarda en el
   almacén seguro del teléfono y lo manda en `Authorization: Bearer`. El servidor acepta el portador **solo en
   rutas `/api/`** (cookie para las páginas). Cambiar la contraseña revoca el token (claim `pv`). Cerrar sesión en
   la app = olvidar el token.
2. **CORS solo en desarrollo**: para verificar la app en el navegador (React Native Web en `localhost:8081`), el
   middleware responde CORS a ese origen únicamente cuando `NODE_ENV !== 'production'`. En producción no hay CORS
   (las apps nativas no lo necesitan).
3. **La visita vive en `visits`** (tabla existente del mapa de calor) con columnas nuevas; las 7.033 importadas de
   VMO quedan `source = 'vmo_import'` sin tocar. Para que el mapa de calor siga igual, las de la app también llenan
   `kam_id` (zona base de la ejecutiva), `kam_name` (nombre de la ejecutiva), `visit_type` ('Visita efectiva' |
   'Visita no efectiva'), `contact_type` ('Visita presencial' | 'Visita virtual' para telefónica), `lat/lng`,
   `visit_date` y `hospital_id` (si la sede es una IPS de OpMap).
4. **Idempotencia por `client_id`**: la app genera un uuid por visita; el mismo `client_id` dos veces devuelve la
   misma fila (`repetida: true`), nunca duplica. Así el reintento sin señal es seguro.
5. **Fecha y hora**: la app manda `checked_in_at` (instante del sitio, ISO con zona) y `reported_at` (al
   confirmar). `visit_date` = fecha de `checked_in_at` en Bogotá y debe ser hoy (Bogotá) al llegar al servidor;
   la cola sin señal reintenta hasta las 23:59 de ese día; después queda "no enviada" con aviso en la app.
6. **Radio y distancia**: la distancia se calcula con Haversine en el servidor contra la sede elegida (nunca se
   confía en la que manda el teléfono; esa se guarda como `gps_accuracy_m` y referencia). Presencial exige
   `distance_m <= radio efectivo` (config_personas.radio_m vigente o config_general.radio_presencial_m vigente).
   Sede sin coordenadas: presencial rechazada con mensaje "esta sede no tiene ubicación: confírmala o crea la
   sede"; telefónica sí.
7. **Médica**: `medico_id` activo y `sede_id` entre sus sedes (`medico_sedes`); si no es visitante del médico →
   `out_of_territory = true`. **Institucional**: `cuenta_id` + `sede_id` de esa cuenta + `subtipo_id` vigente;
   `contacto_id` opcional (de la cuenta). Compras vale en cualquier sede de la cuenta; las demás son de su sede
   (solo informativo en F3; no se rechaza).
8. **Topes**: presencial o telefónica cuentan igual para el tope por médico (`tope_visitas_medico_dia`, solo
   efectivas); telefónicas al día por persona (`telefonicas.tope_dia` o `config_personas.tope_telefonicas_dia`),
   solo si `telefonica_habilitada` vigente; `medio` ∈ `telefonicas.medios`. Rechazo con mensaje claro (400).
9. **Perfil**: si el tipo no está en el perfil vigente de la persona → 400 "Tu perfil no incluye visitas médicas".
10. **Edición**: la ejecutiva corrige **solo el mismo día** (conclusión, compromisos, próxima reunión, efectiva y
    motivo, líneas) y anula con motivo el mismo día (`deleted_at`); no cambia tipo, médico ni sede (anula y vuelve a
    reportar). La directora corrige después con rastro (F5).
11. **Transcripción**: OpenAI `gpt-4o-transcribe` (respaldo `whisper-1` si el modelo no está disponible), idioma
    `es`, con un prompt de vocabulario de VG (líneas, subtipos, "PerOssal", "tornillo canulado", "reemplazo",
    "codificar"). Audio m4a/webm/mp4 ≤ 3 minutos y ≤ 25 MB, leído a memoria y enviado; nunca escrito en disco ni en
    bucket; no se registra en logs. 503 `{ error: 'La transcripción no está configurada (falta OPENAI_API_KEY)' }`
    si falta la llave; 502 si OpenAI falla, con el respaldo por toques sugerido.
12. **Propuesta**: Claude `claude-sonnet-5-5` con salida estructurada (herramienta `proponer_visitas` con esquema
    cerrado), temperatura baja, contexto = la respuesta de `/api/me/contexto` (sedes a menos de 1 km con sus
    cuentas, los médicos que ella visita y sus sedes, contactos de esas cuentas, subtipos vigentes, sus líneas).
    Solo puede elegir ids que estén en el contexto; un nombre que no cruza sale como `medico_nombre_dicho` con
    `medico_id: null` y `sugerir_crear: true`. Nunca recibe ni devuelve documentos. 503 si falta
    `ANTHROPIC_API_KEY`. Costo estimado por dictado ≈ 0,005 USD. Workspace (2026-10-15): una llave personal o de
    cuenta de servicio **no asignada a un workspace** recibe 400 ("anthropic-workspace-id is required when
    authenticating with an identity-linked API key"), así pasó en producción. O se usa una llave asignada a un
    workspace, o se pone `ANTHROPIC_WORKSPACE_ID` (`wrkspc_…`, opcional) y el cliente manda la cabecera
    `anthropic-workspace-id` (`cabecerasAnthropic`; un valor sin esa forma no se manda). Ver `web/VERCEL_ENV_VARS.md`.
13. **Compromisos vencidos** en Hoy: visitas de ella con `next_step_date < hoy` sin una visita posterior al mismo
    médico o cuenta.
14. **Sede nueva desde la app**: `POST /api/terceros/sedes` acepta `origen: 'gps_app'` con `lat`, `lng` y
    `gps_accuracy_m` (la sede nace `ubicacion_confirmada = false` salvo que traiga `reps_code` válido que cruce
    con el municipio de la cuenta principal o de la sede, **que sea del mismo prestador** (`reps_sedes.nit` =
    `cuentas.numero_identificacion`, `mismoPrestador`; corrección 38) **y** que el GPS quede a menos de 20 km del centro
    de ese municipio —`sedeAppConfirmada`, `MAX_M_SEDE_APP_AL_MUNICIPIO`; las 783 IPS de OpMap están a menos de 26 km
    del suyo, el 99 % a menos de 16 km—: entonces `true`); el permiso sigue siendo `terceros:create` (las ejecutivas lo
    tienen). Sin la distancia, un código público del REPS de otra ciudad confirmaba una sede creada desde la casa; sin
    el NIT, lo hacía el de cualquier IPS de la misma ciudad.
15. **Permiso**: `visits:report` (ya existe: admin, commercial_director, line_leader, sales_manager) exige usuario
    enlazado a un Ejecutivo Comercial activo; si no, 403 con el mensaje de F2.
16. **Mis números en F3**: solo KPI 1 (cumplimiento médica, institucional y subtipos con meta propia = visitas
    efectivas × peso ÷ cuota del periodo) y "días hábiles sin visitas"; el resto en F5.
17. **App**: Expo SDK 57 con TypeScript estricto y `expo-router`; sin mapa (lista de sedes cercanas con
    distancia); `expo-location`, `expo-audio` (grabación), `expo-secure-store` (token), AsyncStorage (cola sin
    señal). URL del servidor: `EXPO_PUBLIC_API_URL` (producción `https://op-map-umber.vercel.app`; en desarrollo
    `http://localhost:3000`). Distribución: hoy Expo Go (QR); TestFlight y Play cuando el dueño cree las cuentas
    (EAS). Verificación en este repo: React Native Web en `localhost:8081` contra el servidor local.
18. **CI**: trabajo nuevo `app movil · typecheck · pruebas` en `.github/workflows/ci.yml` (`npm ci` y
    `npm run check` en `mobile/`).

## Base de datos (migración `database/migrations/2026-10-13_0830_visitas_app.sql`, rollback `2026-10-13_9943_visitas_app_rollback.sql`)

Patrón de 0810/0820: `BEGIN/COMMIT`, precondiciones (0800, 0810, 0820 aplicadas; columnas reales de `visits`),
re-ejecutable, comentarios, privilegios, bloque `DO` con pruebas que se deshacen (`RAISE SQLSTATE 'P0830'`),
prueba real deshecha antes de aplicar.

### `visits` (columnas nuevas; las filas importadas no cambian)

| Columna | Tipo | Regla |
| --- | --- | --- |
| `source` | text not null default 'vmo_import' | IN ('vmo_import','app'); las 7.033 filas quedan 'vmo_import' |
| `executive_id` | uuid null → executives | not null si source = 'app' |
| `client_id` | uuid null | UNIQUE (índice parcial `WHERE client_id IS NOT NULL`); not null si app |
| `tipo` | text null | IN ('medica','institucional'); not null si app |
| `subtipo_id` | uuid null → subtipos_institucionales | institucional ⇒ not null; médica ⇒ null |
| `subtipo_codigo` | text null | copia de `subtipos_institucionales.codigo` al registrar |
| `medico_id` | uuid null → medicos | médica ⇒ not null; institucional ⇒ null |
| `cuenta_id` | uuid null → cuentas | institucional ⇒ not null |
| `sede_id` | uuid null → sedes | app ⇒ not null |
| `contacto_id` | uuid null → contactos | solo institucional |
| `modalidad` | text null | IN ('presencial','telefonica'); app ⇒ not null |
| `medio` | text null | telefónica ⇒ IN ('llamada','videollamada'); presencial ⇒ null |
| `efectiva` | boolean null | app ⇒ not null |
| `failure_reason` | text null | no efectiva ⇒ not null (≤ 300) |
| `retry_date` | date null | |
| `checked_in_at` | timestamptz null | app ⇒ not null; `visit_date` = su fecha en Bogotá |
| `reported_at` | timestamptz null | app ⇒ not null |
| `distance_m` | int null | presencial ⇒ not null ≥ 0 |
| `gps_accuracy_m` | int null | |
| `conclusion` | text null | ≤ 2000 |
| `compromisos` | text null | ≤ 2000 |
| `next_step_date` | date null | |
| `transcript` | text null | ≤ 8000; **no hay columna de audio** |
| `input_mode` | text null | IN ('voz','toques'); app ⇒ not null |
| `out_of_territory` | boolean not null default false | |
| `created_by`, `updated_by` | uuid null → users | |
| `updated_at` | ya existe | disparador `update_updated_at_column` si no lo tiene |
| `deleted_at` | timestamptz null | anulada |
| `deleted_reason` | text null | deleted_at ⇒ not null |

CHECK con nombre `visits_app_check` que reúne las reglas "app ⇒ …" de la tabla; índices
`visits_executive_date_idx (executive_id, visit_date) WHERE source = 'app'`, `visits_medico_idx (medico_id,
visit_date)`, `visits_cuenta_idx (cuenta_id, visit_date)`, `visits_next_step_idx (executive_id, next_step_date)
WHERE deleted_at IS NULL`. `visit_lines (visit_id uuid → visits ON DELETE CASCADE, line_id uuid →
business_lines, PRIMARY KEY)`, RLS sin políticas, solo service_role.

### Funciones

- `visitas_registrar(p jsonb, p_user uuid) RETURNS jsonb`, SECURITY INVOKER, solo service_role, atómica:
  `p = { client_id, executive_id, tipo, subtipo_id?, medico_id?, cuenta_id?, sede_id, contacto_id?, modalidad,
  medio?, efectiva, failure_reason?, retry_date?, checked_in_at, reported_at, lat?, lng?, gps_accuracy_m?,
  conclusion?, compromisos?, next_step_date?, transcript?, input_mode, lineas: uuid[] }`.
  1. Si ya existe `client_id` → devuelve `{ visita_id, repetida: true }` sin tocar nada.
  2. Ejecutiva activa con zona; `visit_date` = `checked_in_at` en Bogotá = hoy Bogotá (23514 "Solo se reportan
     visitas del mismo día"); `reported_at >= checked_in_at`.
  3. Perfil vigente incluye el tipo (config_personas o por defecto).
  4. Médica: médico activo, sede ∈ `medico_sedes`; `out_of_territory` = no hay `medico_visitantes` vigente de ella
     para ese médico (cualquier línea). Institucional: sede de la cuenta, subtipo vigente en la fecha (copia
     `subtipo_codigo`), contacto de la cuenta si viene.
  5. Presencial: lat/lng obligatorios; sede con coordenadas (si no, 23514 con el mensaje de la decisión 6);
     `distance_m` = Haversine (metros, entero) ≤ radio efectivo (23514 "Estás a N m de <sede>; el radio es R m").
     Telefónica: `telefonica_habilitada` vigente (23514 "No tienes habilitada la visita telefónica"), `medio` en
     los medios vigentes, telefónicas efectivas de hoy < tope (23514).
  6. Tope por médico: efectivas de ella a ese médico hoy (no anuladas) < `tope_visitas_medico_dia` (23514 "Ya
     reportaste una visita a este médico hoy"). Solo si `efectiva`.
  7. Líneas: al menos una, todas de la ejecutiva (`executive_lines`); se insertan en `visit_lines`.
  8. Inserta en `visits` con los campos del mapa de calor (decisión 3) y devuelve
     `{ visita_id, repetida: false, out_of_territory, distance_m, visit_date }`.
- `visitas_editar(p_id uuid, p jsonb, p_user uuid) RETURNS void`: solo `source = 'app'`, de esa ejecutiva
  (`p ->> 'executive_id'`), no anulada, `visit_date` = hoy; cambia conclusion, compromisos, next_step_date,
  efectiva, failure_reason, retry_date, lineas; al cambiar `efectiva` a true revalida los topes.
- `visitas_anular(p_id uuid, p_motivo text, p_user uuid) RETURNS void`: mismas condiciones; `deleted_at`,
  `deleted_reason` (5..300), `updated_by`.
- Bloque DO: estructura y privilegios; filas importadas intactas (count y checksum de `visit_type` antes y
  después); con una ejecutiva real y médicos/sedes/visitantes de prueba: registrar médica presencial dentro del
  radio, repetida por `client_id`, lejos (rechazo con la distancia), sede sin coordenadas, telefónica sin
  habilitar y con tope, tope por médico, perfil sin médica, institucional con subtipo y contacto, out_of_territory,
  líneas ajenas, ayer rechazado, editar y anular el mismo día, anular dos veces, importada no editable.

## Código puro (`web/lib/reporte-visitas.ts` y `web/lib/reporte-visitas-schemas.ts`)

- `haversineM(a, b)` → metros enteros (misma fórmula que el SQL; radio 6371008.8 m).
- `fechaBogota(iso)` → `AAAA-MM-DD`; `esHoyBogota(iso, ahora)`.
- `radioEfectivo(general, persona)`, `telefonicaEfectiva(general, persona)` → `{ habilitada, tope_dia, medios }`.
- `validarVisita({ datos, contexto, config, hoy, ahora, visitasDeHoy })` → `{ ok, errores: [{ campo, mensaje }],
  distance_m, out_of_territory }`: espejo de los pasos 2 a 7 de `visitas_registrar` (misma tabla de casos).
- `compromisosVencidos(visitas, hoy)`; `resumenHoy(visitas, metasDia)`; `cumplimientoMes({ visitas, conteo,
  cuota })` (usa `valorVisita` de F2) → `{ medica, institucional, subtipos: [...], dias_sin_visitas }`.
- `sedesCercanas(sedes, punto, maxM = 1000, max = 20)`; `contextoDictado(...)` → el JSON compacto que recibe
  Claude (sin documentos ni teléfonos).
- `vocabularioVG(lineas, subtipos)` → prompt de transcripción; `PROMPT_PROPUESTA` (sistema) y
  `esquemaPropuesta` (zod) con `propuestaSchema` para validar lo que devuelve Claude; `normalizarPropuesta`
  (descarta ids que no estén en el contexto).
- Esquemas zod: `loginMovilSchema`, `contextoQuerySchema`, `visitaCreateSchema` (client_id uuid, tipo discriminado,
  modalidad discriminada, lineas 1..10 uuid sin repetir, textos con tope, fechas ISO), `visitaUpdateSchema`,
  `anularSchema`, `proponerSchema` (transcript 1..8000, lat/lng opcionales, hora ISO), `numerosQuerySchema`.
- Pruebas `web/scripts/reporte-check.ts` (puras) y `web/scripts/reporte-api-check.ts` (rutas con Supabase falso y
  OpenAI/Claude falsos inyectados), en `npm run test`.

## Sesión del teléfono y CORS (`web/lib/auth-server.ts`, `web/middleware.ts`, `web/app/api/auth/login/route.ts`)

- `getUserFromRequest`: sin cookie, lee `Authorization: Bearer <token>` solo si la ruta empieza por `/api/`
  (mismo `verifySession` + `pv`). El middleware acepta el portador en `/api/*` con `verifySessionEdge`.
- `POST /api/auth/login` con `{ email, password, cliente: 'movil' }` → 200 `{ token, expira_at, usuario: { id,
  full_name, role }, ejecutiva: { id, full_name, zona } | null }` sin `Set-Cookie`; mismos límites de intentos.
  Sin `cliente` sigue igual que hoy (cookie). `POST /api/auth/logout` con portador → 200.
- `GET /api/auth/me` con portador → el usuario y su ejecutiva enlazada (lo que la app necesita al abrir).
- **Un solo ingreso con la web** (la app en el navegador, `/campo`, 2026-10-30; spec
  `docs/specs/2026-10-30-agendamiento-lider-un-ingreso.md`):
  - `POST /api/auth/login` con `cliente: 'campo-web'` responde como el móvil y además pone la cookie de la web.
  - `POST /api/auth/sesion-app` toma la cookie de la web y devuelve el mismo token, con la forma del login móvil.
    Solo para las líderes (`campo:app` del rol): otro rol → 403. Solo con portador o sin nada → 401; desde otro
    sitio → 403.
  - La app en el navegador lo pide al abrir si no tiene un token vigente ni la marca `opmap.salida-pendiente.v1`
    (cerrar sesión sin señal). Sus peticiones de datos van sin la cookie (`credentials: 'omit'`): el servidor responde
    como la persona del token. Sigue lo que otra pestaña hace con el token (evento `storage`).
  - La web olvida `opmap.token.v1`, `opmap.perfil.v1`, `opmap.contexto.v1` y la marca al entrar y al salir; la cola sin
    señal se queda.
- CORS solo con `NODE_ENV !== 'production'` para `http://localhost:8081` y `http://127.0.0.1:8081`:
  `Access-Control-Allow-Origin` (el origen pedido, si está en la lista), `-Headers: authorization, content-type`,
  `-Methods: GET, POST, PATCH, DELETE, OPTIONS`, `OPTIONS` → 204. Pruebas: en producción ninguna cabecera CORS.

- **Médicos y contactos sin duplicados** (dueño, 2026-10-30, `docs/decisiones/2026-10-30-medicos-y-contactos-sin-duplicados.md`):
  - la visita institucional exige `contacto_id` (`visitaCreateSchema` → 400 en `contacto_id`; la app,
    `validarBorrador`);
  - la tarjeta institucional ofrece "Nuevo contacto" (`contacto/nuevo`: nombre y teléfono y/o correo; el 409 ofrece
    el que ya está);
  - Agendar ofrece "Crear médico" (el mismo Nuevo médico, solo CC o CE) y lo elige al volver. El de una líder ya es
    de sus líneas (`medico_lineas`, 0940).

## API (todas con `requirePermission('visits:report')` salvo auth; `getSupabaseAdmin`; errores `{ error }`; 503 si falta la migración)

| Ruta | Respuesta |
| --- | --- |
| `POST /api/me/contexto` `{ lat, lng, precision }` (con el punto: la app usa esta; la ubicación va en el cuerpo y no en la URL, que queda en los logs de peticiones del proveedor) · `GET /api/me/contexto` (sin punto; por compatibilidad acepta aún `?lat=&lng=&precision=`) | `{ ejecutiva: { id, nombre, zona, municipio, lineas: [{ id, code, name }] }, hoy: { fecha, meta: { medica, institucional }, hechas: { medicas, institucionales, telefonicas, no_efectivas }, cuota_dia_ok }, config: { radio_m, telefonica: { habilitada, tope_dia, medios }, tope_visitas_medico_dia, perfil }, sedes_cerca: [{ id, nombre, cuenta_id, cuenta_nombre, cuenta_clase, ciudad, lat, lng, distancia_m, hospital_id, ubicacion_confirmada }], mis_medicos: [{ id, nombre, especialidades, municipality_id, lineas: [id], sedes: [{ id, nombre, cuenta_nombre, distancia_m }] }], contactos: [{ id, cuenta_id, sede_id, nombre, cargo_texto, rol }], subtipos: [{ id, codigo, nombre, roles_sugeridos }], compromisos_vencidos: [{ visita_id, fecha, con, next_step_date }], voz: { transcribir: bool, proponer: bool } }` (sin lat/lng: `sedes_cerca` vacío y `mis_medicos` sin distancias; nunca documentos ni teléfonos) |
| `GET /api/me/visitas?fecha=` | `{ fecha, items: [{ id, client_id, tipo, subtipo, medico: { id, nombre } \| null, cuenta: { id, nombre } \| null, sede: { id, nombre }, contacto, modalidad, medio, efectiva, failure_reason, checked_in_at, distance_m, conclusion, compromisos, next_step_date, lineas: [id], input_mode, out_of_territory, cuenta_para: 'medica' \| 'institucional' \| 'subtipo' \| null, peso, sede_por_confirmar, editable }] }` (`peso` con el de la telefónica; `sede_por_confirmar`: efectiva en una sede aún sin confirmar, `cuenta_para` null y `peso` 0 hasta que la confirmen; 0850: con Ejecutivo Comercial, lo hecho como líder no suma a su cuota, C4: `cuenta_para` null y `peso` 0, igual que en `hoy.hechas` y Mis números) |
| `POST /api/me/visitas` | `visitaCreateSchema` → pre-validación pura (`validarVisita`, 400 con `errores`) → RPC `visitas_registrar` → 201 `{ visita, repetida }`; 23514 → 400 con el mensaje de la base |
| `PATCH /api/me/visitas/[id]` | `visitaUpdateSchema` → RPC `visitas_editar` → `{ visita }`; 400 / 404 |
| `POST /api/me/visitas/[id]/anular` | `{ motivo }` → RPC `visitas_anular` → 200 |
| `POST /api/me/voz/transcribir` | multipart `audio` (campo `audio`, ≤ 25 MB, ≤ 180 s **leídos del propio archivo**: m4a/mp4 `mvhd`, webm `Duration` o el último bloque; si no se deja leer, la declarada `duracion_s`) → `{ transcript, duracion_s, modelo }`; 400 formato o sin duración legible ni declarada; 413 tamaño o duración; 429 más de 6 por minuto o 40 por hora por persona; 503 sin llave; 502 fallo del proveedor |
| `POST /api/me/voz/proponer` | `proponerSchema` → contexto (como `/contexto`) → Claude → `{ visitas: [{ tipo, subtipo_codigo, subtipo_id, medico_id, medico_nombre_dicho, sugerir_crear_medico, cuenta_id, sede_id, contacto_id, contacto_nombre_dicho, lineas, efectiva, failure_reason, conclusion, compromisos, next_step_date, modalidad_sugerida, confianza, preguntas: [string] }], aviso }`; 429 más de 10 por minuto o 60 por hora por persona; 503 sin llave; 502 fallo |
| `GET /api/me/numeros?mes=AAAA-MM` | `{ mes, cuota: (de /api/me/cuota), hechas: { medica, institucional, subtipos: [...] }, cumplimiento: { medica, institucional, subtipos: [...] }, dias_habiles_sin_visitas, telefonicas, no_efectivas, fuera_de_territorio, sede_por_confirmar }` |
| `POST /api/terceros/sedes` | además: `origen: 'gps_app'`, `lat`, `lng`, `gps_accuracy_m` (decisión 14) |

Ninguna ruta escribe el audio en disco ni lo registra; `transcript` no sale en logs. PostgREST corta en 1.000
filas: `fetchAllRows` donde haga falta.

**Logs de la voz** (`resumenErrorVoz`, 2026-10-14): ante un error de la API de Anthropic u OpenAI el log lleva el
proveedor, el estado HTTP (o "tiempo agotado" / "sin conexión"), el tipo de error de la API (`invalid_request_error`,
`rate_limit_error`…, y el `code` de OpenAI), el parámetro que nombra el mensaje si se reconoce (`tool_choice`,
`thinking.type.between_tools`, `tools.0.custom.input_schema`, la cabecera `anthropic-beta`…; en OpenAI, su `param`), el
`request_id` y el mensaje de la API **saneado**: uno de más de 1.000 caracteres no se analiza ni se imprime; lo que va
entre comillas solo se queda si es un nombre técnico (sin espacios, ASCII); se tapan correos, llaves y los números de 6
o más dígitos aunque vengan con espacios, puntos o guiones (300 123 4567, 1.020.304.050, 900.123.456-7; una fecha ISO
como la de una beta queda a la vista). El mensaje **no** se imprime ("mensaje omitido") si tiene caracteres fuera del
ASCII (los mensajes de la API vienen en inglés), una tilde escapada (`\u00e1`, `\xe1`, `&aacute;`, `%C3%A1`), una
palabra fuera de la **lista cerrada** de vocabulario técnico en inglés de los errores de la API (`VOCABULARIO_API`: así
no pasa ningún nombre, apellido corto como Gil o Paz, ni trozo de palabra, esté o no en lo enviado), una palabra de 3 o
más letras de lo enviado (la transcripción y los valores del contexto: nombres de médicos, cuentas, sedes, contactos)
o un número de 3 o más dígitos que sea parte de un número de lo enviado (una extensión, el final de un teléfono).
Se recorta a 160 caracteres. Nunca audio, transcripción, contexto ni nombres. Si un mensaje técnico real sale omitido
por una palabra que falta en la lista, se añade la palabra (nunca un nombre propio). Ejemplo: `POST
/api/me/voz/proponer: fallo al proponer (Anthropic 400 invalid_request_error · parámetro anthropic-beta · request_id
req_… · mensaje: Unexpected value(s) …)`. Pruebas: `web/scripts/reporte-api-check.ts`, secciones 7b y 7c (y campos en
la 14).

## App móvil (`mobile/`)

- Expo SDK 57, TypeScript estricto, `expo-router`, `react-native-web` para verificación; `app.json` con nombre
  "OpMap Visitas", `slug opmap-visitas`, `scheme opmap`, permisos de ubicación y micrófono con textos en español
  (iOS `NSLocationWhenInUseUsageDescription`, `NSMicrophoneUsageDescription`; Android `ACCESS_FINE_LOCATION`,
  `RECORD_AUDIO`), `userInterfaceStyle automatic`, ícono y splash sencillos (sin marca de terceros).
- `mobile/lib/api.ts` (cliente con `EXPO_PUBLIC_API_URL`, token de SecureStore, 401 → cerrar sesión, errores
  `{ error }` legibles), `mobile/lib/sesion.ts`, `mobile/lib/cola.ts` (cola sin señal: AsyncStorage, `client_id`
  por visita, reintento al volver a primer plano o al reconectar, descarte avisado pasada la medianoche),
  `mobile/lib/geo.ts` (Haversine, formato de distancia), `mobile/lib/fechas.ts` (Bogotá), `mobile/lib/tipos.ts`
  (formas JSON de la API, copiadas del contrato).
- Pantallas (`app/`): `(auth)/login` (email y contraseña; nunca guarda la contraseña), `(app)/hoy` (meta del día
  frente a hechas, visitas de hoy, compromisos vencidos, cola pendiente, botón grande **Reportar**),
  `(app)/reportar` (1. ubicación y sedes cercanas; 2. **Hablar** (grabar hasta 3 min, nivel visible, cancelar) →
  transcribiendo → tarjetas propuestas editables (tipo, subtipo, médico/cuenta, sede, contacto, líneas, efectiva,
  conclusión, compromisos, próxima reunión) → "Confirmar" por tarjeta; o **Por toques** con los mismos campos; 3.
  resultado con lo que se guardó y lo que quedó en cola), `(app)/visita/[id]` (ver, corregir o anular el mismo
  día), `(app)/medico/nuevo` (documento → verificar → datos completos → sedes donde atiende con el buscador de
  sedes y "crear consultorio"), `(app)/sede/nueva` (nombre, cuenta, código de habilitación opcional, GPS del sitio),
  `(app)/dias-libres` (registrar con la fecha límite visible, lista, anular), `(app)/numeros` (cuota y cumplimiento
  del mes), `(app)/ajustes` (quién soy, servidor, cerrar sesión, versión).
- Reglas visibles: presencial bloqueada si la sede elegida está más lejos que el radio (mensaje con la distancia
  y las opciones telefónica o crear sede); telefónica solo si está habilitada; médico inexistente → "crear
  completo" (documento digitado); nada se guarda sin confirmar; el audio se borra del teléfono al recibir la
  transcripción (o si se cancela).
- Pruebas: `mobile/scripts/movil-check.ts` (puras: Haversine igual que el servidor con los mismos casos, cola
  (reintento, descarte a medianoche, idempotencia por client_id), fechas en Bogotá, mapeo de errores de la API) con
  `tsx`; `npm run check` en `mobile/` = `tsc --noEmit` + pruebas. `mobile/README.md`: cómo correr (`npx expo start`,
  Expo Go, `--tunnel`), variables, cómo verificar en web, cómo compilar con EAS cuando existan las cuentas.
- Verificación en este repo: servidor local (`npm run dev` en `web/`, con la 0830 aplicada) + `npx expo start --web
  --port 8081`; sesión de prueba inyectada en el almacén web (nunca se digitan contraseñas); capturas a 390 px de
  Hoy, Reportar (lista de sedes, grabación, tarjetas), Nuevo médico, Mis días libres y Mis números.

## Verificación

- `web/scripts/reporte-check.ts` y `web/scripts/reporte-api-check.ts` con los criterios de la spec que caben en F3:
  subtipo sugerido por cargo y suma según `valorVisita`; presencial a 800 m rechazada con las opciones; mismo
  `client_id` dos veces → una fila; médico sin documento → 400 y nada guardado; documento repetido → existente;
  transcripción de ejemplo → tres visitas propuestas (con Claude falso) y nada guardado sin confirmar; médico que
  no cruza → `sugerir_crear_medico` y no se crea; audio no persiste (el falso de OpenAI comprueba que no hay
  escritura en disco); 503 sin llaves; perfil solo institucional → médica 400; tope por médico; telefónica sin
  habilitar; ayer rechazado; usuario sin ejecutiva 403; portador en páginas no vale; CORS ausente en producción.
- `npm run check` (web) y `npm run check` (mobile) en verde; `next build` en verde; prueba real deshecha de 0830 y
  9943; capturas de la app a 390 px con la base migrada; `grep` de "KAM|representante|panel" sin textos visibles.

## Estado: implementado (PR pendiente)

Rama `feat/visitas-f3-f4-app-movil` (2026-10-13/14). **La migración 0830 está escrita y probada con una prueba real
deshecha, pero NO está aplicada**: se aplica solo con autorización del dueño, en la misma ventana que el despliegue,
y después `NOTIFY pgrst, 'reload schema';`. Mientras no se aplique, `/api/me/contexto`, `/api/me/visitas` y
`/api/me/numeros` responden 503 con "falta aplicar la migración 0830" y el resto de la web y de la app (días libres,
cuota) sigue igual.

### Archivos

- Base de datos: `database/migrations/2026-10-13_0830_visitas_app.sql` (md5 `57aaafce5dbfb36e26c49a98a4eef4f2`) y
  `2026-10-13_9943_visitas_app_rollback.sql` (md5 `409da3aec7b0fc5e25fcfa793182e1f1`), `database/migrations/README.md`,
  `docs/base-de-datos.md`. Además de lo del contrato: `visitas_distancia_m` (Haversine igual a `haversineM`) y
  `visitas_config_vigente(executive_id, fecha)`; disparador `visits_app_sin_borrar` (una visita de la app no se
  borra). El rollback 9943 va antes de 9942/9941/9940 (9941 no tiene guarda propia para la 0830).
- Código puro: `web/lib/reporte-visitas.ts`, `web/lib/reporte-visitas-schemas.ts`; pruebas
  `web/scripts/reporte-check.ts` (284) y `web/scripts/reporte-api-check.ts` (194), las dos en `npm run test` (18 suites).
- Sesión y CORS: `web/lib/auth-server.ts`, `web/middleware.ts`, `web/app/api/auth/{login,logout,me}/route.ts`.
- API: `web/app/api/me/_lib/reporte-server.ts`, `web/app/api/me/{contexto,numeros}/route.ts` (contexto: POST con el
  punto en el cuerpo; GET sin punto),
  `web/app/api/me/visitas/route.ts`, `.../visitas/[id]/route.ts`, `.../visitas/[id]/anular/route.ts`,
  `web/app/api/me/voz/{transcribir,proponer}/route.ts`; `calcularCuotaDetallada` en
  `web/app/api/config-visitas/_lib/visitas-server.ts`; `origen: 'gps_app'` y la confirmación por REPS a menos de 20 km del municipio en `web/app/api/terceros/sedes/route.ts` y
  `web/lib/terceros-schemas.ts`; dependencias `openai` y `@anthropic-ai/sdk` en `web/package.json`.
- Rutas viejas que tocan `visits` (para convivir con las visitas de la app): `web/app/api/visits/filtered/route.ts`
  (solo las 14 columnas originales, sin anuladas), `web/app/api/visits/stats/route.ts` y
  `web/app/api/visits/unvisited-zones/route.ts` (sin anuladas; ayuda común en `web/app/api/visits/_lib/visitas-mapa.ts`)
  y `web/app/api/visits/import/route.ts` (sigue deshabilitado; si se reactiva, borra solo `source = 'vmo_import'` y no
  inserta si el borrado falla). Las cuatro funcionan antes y después de la 0830.
- App: `mobile/` completo (Expo SDK 57); pantallas `app/(app)/{hoy,reportar,visita/[id],medico/nuevo,sede/nueva,
  dias-libres,numeros,ajustes}.tsx`; `components/reporte/*` (TarjetaBorrador, Grabador, Selector, Buscador,
  ListaSedes, SelectorMunicipio, CamposVisita); `lib/{tipos,claves-api,propuesta,terceros,grabacion,audio,retorno,
  api,cola,contexto-guardado,…}.ts` y `lib/montaje.tsx` (`SoloEnFoco`); pruebas `mobile/scripts/movil-check.ts` (199); `mobile/README.md`. CI: trabajo
  `app movil · typecheck · pruebas` en `.github/workflows/ci.yml`.

### Decisiones de implementación que se sumaron (el dueño puede cambiarlas)

19. **Llegada en el futuro**: `visitas_registrar` rechaza un `checked_in_at` más de 5 minutos por delante del reloj del
    servidor ("La hora de llegada está en el futuro"); `validarVisita` lo repite (`TOLERANCIA_RELOJ_SEGUNDOS = 300`).
20. **Punto del mapa de calor**: presencial = el punto del teléfono (ya validado contra el radio); telefónica = la sede,
    o el municipio de la sede, o la ciudad base de la zona — **nunca el GPS del teléfono** (en una telefónica la
    ejecutiva no está en la sede, puede estar en su casa): ni la app lo manda
    ni la API ni `visitas_registrar` lo guardan (`lat`, `lng` y `gps_accuracy_m` en null) (`visits.lat/lng` son NOT
    NULL). `kam_name` de las visitas de la app = el nombre de la ejecutiva. Las visitas de la app solo las ve en el mapa
    quien tiene `visits:view` (corrección 39).
21. **Propuesta tolerante y cerrada**: el esquema de la herramienta escribe las uniones con null como `anyOf` y sin
    límites (los vuelve a aplicar zod); `propuestaSchema` completa con valores seguros lo que falte; `normalizarPropuesta`
    arma cada visita campo a campo (nunca copia claves desconocidas), descarta ids fuera del contexto y cambia
    números de 7 dígitos o más por "[número omitido]". Claude Sonnet 5.5: `tool_choice: auto` + herramienta estricta +
    un reintento si no la llama, `thinking: between_tools` con `effort: low`, `fallbacks: 'default'` (beta
    `server-side-fallback-2026-07-01`; si cae a Sonnet 5 corre sin razonamiento), sin temperatura.
    **Respaldo de petición mínima** (2026-10-14, `pedirHerramienta`, vale para proponer y para campos): en producción
    Anthropic respondió 400 (`invalid_request_error`) a la petición completa y nunca se había probado con la API real.
    Si la completa falla con un **400** de Anthropic, se reintenta UNA vez con la petición mínima: el mismo modelo,
    system (con su `cache_control`) y mensaje; la herramienta **sin** `strict` (lo devuelto lo validan después
    `propuestaSchema` / `camposSchema`); **sin** betas, `fallbacks` ni `thinking`; **con** `effort: low` (GA, sin beta: en
    Sonnet 5.5 el effort de serie es `high` y, sin `between_tools`, el razonamiento adaptativo con `high` no cabría en los
    60 s de la ruta, del SDK y de la app; si el effort fuera la causa del 400, la mínima también fallaría y el aviso diría
    "parámetro output_config.effort"); `tool_choice` sigue en `auto` con una sola llamada (Sonnet 5.5 rechaza con 400 el
    forzado `tool`/`any`, así que forzarlo haría fallar también la mínima); `max_tokens` 8.000 (el razonamiento cuenta
    dentro del tope; solo se cobra lo generado). Si la mínima también falla, la ruta responde el 502 de siempre. Un
    `refusal`, un 429, un 5xx, la red o el tiempo agotado **no** usan el respaldo (la mínima no los arreglaría). Cuando
    se usa, queda un `console.warn` "Claude rechazó la petición completa de `<herramienta>` (…); se reintenta con la
    petición mínima" con el resumen seguro del porqué (ver "Logs de la voz" abajo): en Vercel se ve qué parámetro rechazó
    Anthropic. Cuando se sepa, se corrige ese parámetro en la completa y se recuperan los demás.
22. **Tope de telefónicas en la app**: con la lista de hoy (servidor + cola) se cuentan ahí; nunca contexto + lista.
23. **Crear desde Reportar**: Reportar pasa a Nuevo médico / Nueva sede un "pedido" en memoria (nombre dicho,
    municipio, sedes cercanas, punto), nunca en la URL; al volver, lo creado queda puesto en la tarjeta que lo pidió.
    "Crear consultorio" crea una cuenta `consultorio` con el documento del médico como identificación (si ya existe,
    usa su sede principal). "Atiende en <sede>" vincula una sede cercana al médico (`terceros:create`).
24. **Corregir hablando**: la nueva grabación se suma a la transcripción anterior ("Corrección: …") y la propuesta
    reemplaza las tarjetas de voz aún sin confirmar.
25. **Rechazo del servidor al confirmar**: la visita sale de la cola (no quedó guardada), la tarjeta sigue con el
    mensaje y las salidas (telefónica si hay cupo, crear la sede aquí) y toma un `client_id` nuevo.
26. **Visita de otro día** (desde un compromiso vencido): `visita/[id]?fecha=AAAA-MM-DD` (no hay GET por id).
27. **Claves de las formas JSON**: una sola lista (`mobile/lib/claves-api.ts`) verificada al compilar contra los tipos
    de la app, en `movil-check` contra este contrato y en `reporte-api-check` contra las respuestas reales; además
    `reporte-api-check` comprueba al compilar que los tipos de `web/lib/reporte-visitas.ts` y `mobile/lib/tipos.ts`
    se asignan entre sí (`modalidad_sugerida` quedó sin null en los dos lados; `Role` es más amplio en la app a
    propósito).
28. `gps_accuracy_m` de una sede nueva se valida pero no se guarda (`sedes` no tiene esa columna).

### Correcciones del 2026-10-14 (hallazgos del verificador; el dueño puede cambiarlas)

29. **Sede por confirmar**: una visita en una sede con `ubicacion_confirmada = false` (sede nueva de la app sin REPS
    que cruce) se registra (la regla del radio la mide contra el GPS con el que se creó) pero **no suma** a la meta
    ni a la del día hasta que data manager la confirme: `valorReporte` (web/lib/reporte-visitas.ts) mira la sede al
    contar, en Hoy (`cuota_dia_ok`), Mis números (`sede_por_confirmar`) y `GET /api/me/visitas` (`sede_por_confirmar`,
    `cuenta_para` null, `peso` 0). Al confirmarla, sus visitas suman solas (no se toca la visita). La app lo muestra:
    "Sede por confirmar: aún no suma" / "Suma cuando data manager confirme la sede". Hoy las 783 sedes están
    confirmadas: nada cambia en lo que ya existe.
30. **Peso de la telefónica**: una telefónica efectiva suma `peso del conteo × config_general.telefonicas.peso` vigente
    en su fecha (sin configuración, 1), en Hoy, Mis números y `GET /api/me/visitas`. Con 0,5, 120 presenciales y 20
    telefónicas = 130, no 140.
31. **Fechas de la visita**: `next_step_date` y `retry_date` no pueden ser anteriores a `visit_date` (si no, la visita
    nacía como compromiso vencido): 400/23514 "La próxima reunión no puede ser anterior a la fecha de la visita" /
    "La fecha para reintentar…" en `validarVisita`, `visitas_registrar`, `visitas_editar` y `visits_app_check`; la app
    lo avisa en la tarjeta y al corregir; `normalizarPropuesta` y la app descartan una fecha propuesta anterior a hoy.
32. **Cuenta y contacto activos**: la cuenta de la sede debe estar activa (médica e institucional: "La cuenta de esa sede
    está inactiva"; desactivar una cuenta no desactiva sus sedes) y el contacto también ("Ese contacto está inactivo"),
    en `validarVisita` y `visitas_registrar`. La app solo ofrece las sedes activas de una cuenta buscada y del
    consultorio existente.
33. **Hora del reporte**: `reported_at` tampoco puede ir más de 5 minutos por delante del reloj del servidor ("La hora
    del reporte está en el futuro"), como `checked_in_at`.
34. **Costo de la voz**: además del tope de 3 minutos leído del archivo, cada Ejecutivo Comercial tiene un límite de
    llamadas (`LIMITES_VOZ`: transcribir 6 por minuto y 40 por hora; proponer 10 por minuto y 60 por hora), en la
    memoria de cada instancia como el del login; solo cuentan las llamadas que llegan al proveedor; 429 con
    Retry-After. Riesgo que queda: un audio con la cabecera falsificada y sin duración legible pasa con la declarada
    (acotado por el límite).
35. **Rutas viejas de /visits**: `GET /api/visits/stats` y `GET /api/visits/unvisited-zones` excluyen las anuladas
    (`web/app/api/visits/_lib/visitas-mapa.ts`), antes y después de la 0830 (stats pregunta antes si existe
    `deleted_at`, porque un HEAD que falla no trae el código del error).
36. **App: pantallas que no se desmontan**. Nuevo médico, Nueva sede y Visita (pestañas ocultas) se montan de cero cada
    vez que se abren (`SoloEnFoco`, mobile/lib/montaje.tsx): ya no arrastran el pedido, el GPS ni el formulario de la
    vez anterior ni el "Visita anulada" de otra visita. Reportar sigue montada (vuelve de crear un médico o una sede
    con las tarjetas), pero al recibir el foco decide con `debeReiniciarReporte` si es una llegada nueva (sin tarjetas
    pendientes, o con tarjetas de hace más de 10 minutos, o de otro día) o el mismo reporte (grabando, volviendo de
    crear, o tarjetas recientes).
37. **App: sin señal y la cola**. Hoy y Reportar guardan el último contexto del día (mobile/lib/contexto-guardado.ts,
    solo esa persona y ese día; se olvida al cerrar sesión): si Reportar abre sin señal, arma las tarjetas con él y la
    visita queda en la cola con el punto y la hora del sitio (las distancias a las sedes de los médicos quedan
    "desconocidas" y decide el servidor). Pasada la medianoche una pendiente pasa a "por confirmar" y se pregunta una
    vez al servidor (que busca el `client_id` antes de la regla del día): si ya estaba, queda enviada; si no, "no
    enviada" con el aviso. Una visita de la cola que el servidor rechazó hoy se puede "Reportar de nuevo" (vuelve
    como tarjeta con lo escrito y un `client_id` nuevo). "Corregir hablando" ya no vuelve a proponer lo confirmado
    (`descartarYaConfirmadas`: mismo médico o nombre dicho, o misma cuenta y subtipo). Las sedes de un médico traído
    del buscador, recién creado o vinculado sin distancia conocida no se bloquean con el falso "esta sede no tiene
    ubicación": decide el servidor (el consultorio recién creado con el GPS de aquí cuenta a 0 m).

### Correcciones del 2026-10-14 (revisor del proyecto)

38. **El código del REPS es del prestador de la cuenta**: una sede `gps_app` nace confirmada solo si además
    `reps_sedes.nit` coincide con `cuentas.numero_identificacion` (solo dígitos, sin ceros a la izquierda:
    `mismoPrestador`). Sin eso, una ejecutiva podía crear una sede con el GPS de su casa y el código público de
    cualquier IPS de su ciudad, vincular a sus médicos y sumar presenciales desde la casa. Medido el 2026-10-14: las 727
    sedes de OpMap con código del REPS tienen el mismo NIT que su cuenta (ningún caso legítimo queda por fuera).
39. **Mapa de calor sin las visitas de los demás**: `GET /api/visits/filtered` devuelve las visitas de la app solo a
    quien tiene `visits:view` (admin, commercial_director, data_manager). Los demás (Ejecutivos Comerciales, visor) ven
    el histórico de VMO como antes de la 0830: las visitas de la app llevan el nombre y el GPS de cada ejecutiva y entre
    ellas no se ven (spec, sección 11). Lo suyo lo ven en la app.
40. **No se borran importaciones de VMO por la ruta vieja**: `DELETE /api/visits/import` responde 410, con el mismo
    interruptor que `DELETE /api/visits/imports` (con el importador apagado, el histórico no se puede volver a cargar).
    Desde el 2026-10-29 esas rutas ya no existen: la importación de VMO volvió como puente del mapa de calor (solo
    efectivas, por persona, upsert por `visits.vmo_id`, sin borrar nada;
    `docs/decisiones/2026-10-29-visitas-vmo-mapa-de-calor.md`).

**Abierto para el dueño (no cambiado)**: la precisión del GPS (`gps_accuracy_m`) es solo referencia (decisión 6).
Con la ubicación aproximada del teléfono (1 a 3 km de error) una presencial puede pasar el radio de 500 m, y una sede
`gps_app` puede nacer con coordenadas imprecisas. Opción: rechazar la presencial, o dejar la sede por confirmar,
cuando la precisión pase de unos 100 m o del radio.
Ubicación en dos pasos de Reportar (2026-10-14, `docs/specs/2026-10-14-ubicacion-rapida-en-reportar.md`): la regla de la
final no cambió (lectura precisa o, si no llega, la última conocida de menos de 2 minutos, marcada aproximada). La
lectura rápida (~100 m) que ahora se toma solo para mostrar la lista queda en el teléfono como "última conocida"; la
app registra sus propias lecturas rápidas y la final, el consultorio de "Nuevo médico" y "Crear sede aquí"
(`pedirUbicacion`) no las aceptan de respaldo, así que el caso de la clínica sin lectura precisa termina como antes:
sin punto.

### validarVisita (TS) frente a visitas_registrar (SQL)

| Paso | Caso | SQL (23514 salvo que se diga) | TS (`validarVisita` / esquema) |
| --- | --- | --- | --- |
| 0 | forma, no efectiva sin motivo | 22023 / "Indica el motivo…" | `visitaCreateSchema` (400 con `errores`) |
| 1 | mismo `client_id` | devuelve la fila (`repetida`); de otra ejecutiva 23505 | la API la busca antes y no valida; 409 |
| 2 | ejecutiva inactiva / sin zona | mensajes de F2 | iguales |
| 2 | fecha en Bogotá ≠ hoy | "Solo se reportan visitas del mismo día" | igual |
| 2 | llegada > ahora + 5 min | "La hora de llegada está en el futuro" | igual (**corregido**: el TS lo había quitado) |
| 2 | reporte antes de la llegada | "La hora del reporte no puede ser anterior…" | igual |
| 2 | reporte > ahora + 5 min | "La hora del reporte está en el futuro" | igual |
| 2 | próxima reunión o reintento antes de la visita | "La próxima reunión no puede ser anterior…" / "La fecha para reintentar…" (también `visitas_editar` y CHECK) | igual |
| 3 | perfil sin el tipo | "Tu perfil no incluye visitas médicas/institucionales" | igual |
| 4 | sede inexistente o inactiva | "Esa sede no existe" | igual |
| 4 | cuenta de la sede inactiva | "La cuenta de esa sede está inactiva" | igual |
| 4 | contacto inactivo | "Ese contacto está inactivo" | igual |
| 4 | sede por confirmar | se acepta (suma al confirmarla: lo decide la API al contar) | igual (`valorReporte`) |
| 4 | médico inexistente o inactivo / sede no suya | mismos mensajes | iguales |
| 4 | `out_of_territory` | sin `medico_visitantes` vigente en la fecha | igual |
| 4 | institucional: sede de otra cuenta, subtipo no vigente, contacto ajeno | mismos mensajes | iguales |
| 5 | presencial sin ubicación / sede sin coordenadas / fuera del radio | mismos mensajes; Haversine 6371008.8, entero | iguales (mismos casos de distancia probados en los dos) |
| 5 | telefónica sin habilitar / medio / tope (aunque la nueva no sea efectiva) | mismos mensajes | iguales |
| 0/8 | telefónica: ubicación del teléfono | se descarta (lat, lng, gps_accuracy_m NULL); punto = sede, municipio o zona | `normalizarVisita` la descarta |
| 6 | tope por médico (solo efectivas, presencial y telefónica igual) | "Ya reportaste una visita a este médico hoy" | igual |
| 7 | sin líneas / líneas ajenas | mismos mensajes | iguales |

### Verificación (2026-10-14)

- `web`: `GOOGLE_ROUTES_DISABLED=true npm run check` → typecheck y lint sin errores (solo las advertencias viejas de
  `react-hooks/exhaustive-deps`) y las 18 suites en verde (ips-routes 130, reps 58, reps-import 90, adres 192,
  poblacion-api 95, poblacion 89, bogota 63, corredores-config 56, secop-api 154, secop 241, terceros 298,
  terceros-api 129, visits 415, visits-api 165, traspaso 282, traspaso-api 127, reporte 284, reporte-api 194).
  `GOOGLE_ROUTES_DISABLED=true npx next build` → compilado sin errores.
- `mobile`: `npm run check` → `tsc` limpio y 199/199; `npx expo export --platform web` → 886 módulos.
- En el navegador, sin tocar producción: PostgREST falso + OpenAI y Claude falsos, copia de `web/` sin `.env*`, app en
  `localhost:8081`, Chrome sin ventana a 390 px con GPS y micrófono falsos. Recorrido completo sin errores en la
  consola ni desbordes: Hoy, Reportar (sedes cercanas; por toques con la tarjeta llena y guardada; grabación real de
  4 s → transcripción → dos tarjetas propuestas), Visita (corregir y anular), Nuevo médico (documento → verificar →
  especialidad y sedes), Nueva sede, Mis días libres y Mis números. El tope por médico se vio en vivo al repetir.
  Ese recorrido es del 2026-10-13: las correcciones del 2026-10-14 (29 a 37) están probadas en `reporte-check`,
  `reporte-api-check`, `movil-check` y el bloque DO de la 0830, pero el recorrido en el navegador no se repitió.
- 0830 y 9943: prueba real deshecha (`DRYRUN_OK` y `DRYRUN_ROLLBACK_OK`, repetida el 2026-10-14 con la 0830 corregida:
  35 rechazos de `visitas_registrar` y los nuevos casos de editar, del CHECK y de la telefónica con GPS); después,
  `visits` con 14 columnas y 7.033 filas, sin `visit_lines` ni funciones de la 0830.
- Audio: la duración leída del contenedor se probó con un m4a real de macOS (5,06 s; `afinfo` 4,94 s) y un webm real
  de MediaRecorder de Chrome (6,36 s de 6,5 s grabados), sin guardar el audio en el repositorio.

### Pendiente

- Hecho el 2026-10-14: 0830 aplicada en producción (`visitas_app_0830`), las 5 funciones con el mismo md5 que el
  archivo, `NOTIFY pgrst` y las 7.033 importadas con la misma huella de antes.
- Del dueño: crear `OPENAI_API_KEY` y `ANTHROPIC_API_KEY` en Vercel;
  confirmar el identificador `co.vg.opmap.visitas` y crear las cuentas de Expo, Apple y Google para EAS; probar en un
  teléfono con Expo Go (GPS, micrófono y almacén seguro reales: aquí no hay simulador).
- Con la 0830 aplicada: la vista `visit_summary` (sin uso en la web) contará también las visitas de la app, anuladas
  incluidas; una guarda en el rollback 9941 contra la 0830 sería prudente.
- F5: tablero de dirección, KPIs 2 a 6, corrección con rastro por la directora, "pedir ser su visitante".

## F4.1 Agenda, dictado por campo y marca (2026-10-14)

Spec aprobada: `docs/specs/2026-10-14-agenda-dictado-y-marca.md` (sus decisiones 1 a 11 mandan). Decisión del dueño:
`docs/decisiones/2026-10-14-agenda-de-visitas.md` (la agenda reemplaza la línea "agenda en medias horas y ruteros" de lo
que no se hace; "visita agendada" es un indicador). Migración `database/migrations/2026-10-14_0840_visitas_agenda.sql`,
rollback `2026-10-14_9944_visitas_agenda_rollback.sql` (**ESCRITA, SIN APLICAR**; ensayada en la base real con
`DRYRUN_OK`, ver `database/migrations/README.md`).

### Decisiones de la spec (resumen)

1. **La cita** (`visitas_agenda`): una fila por cita con persona, fecha, hora, tipo (médica con médico; institucional
   con cuenta y subtipo), sede, nota ≤ 300 y estado `pendiente` | `hecha` | `cancelada`. La hecha guarda `visita_id`. No
   se borra: se cancela. La hora era opcional; desde el 2026-10-15 es **obligatoria** en toda cita nueva (ver "Cambios
   del 2026-10-15"); la columna sigue aceptando NULL por las citas viejas.
2. **Quién agenda**: la propia persona en la app (`visits:report`). Dirección y líder la verán en F5.
3. **Ventana**: de hoy a hoy + 30 en Bogotá; no en el pasado ni en un día libre aprobado; los festivos sí.
4. **Sin duplicados**: una cita no cancelada por persona, fecha y médico; en las institucionales por persona, fecha,
   cuenta y subtipo.
5. **Validaciones al agendar**: persona activa con zona; perfil vigente en la fecha con el tipo; médico activo que
   atiende en la sede, o sede de la cuenta; cuenta activa; subtipo vigente en la fecha; sede activa.
6. **Agendada**: la visita se vincula a una cita de la misma persona, fecha y médico o cuenta, creada **antes del día de
   la visita** (Bogotá). La creada el mismo día vincula pero la visita cuenta como no agendada.
7. **Vínculo**: `visitas_registrar` acepta `agenda_id` opcional y lo valida; sin él busca la pendiente de ese día con el
   mismo médico (institucionales: la misma cuenta, prefiriendo el mismo subtipo). La cita pasa a `hecha`; si la visita
   se anula, pasa a otra visita suya de ese día con el mismo médico o cuenta o vuelve a `pendiente` (decisión 54). La
   no efectiva también cumple la cita (no suma a las efectivas); si luego llega la efectiva, esta la toma (decisión 53).
8. **Indicador** (Mis números, por mes): `porcentaje_agendadas` = efectivas agendadas ÷ efectivas; `cumplimiento` =
   citas hechas ÷ citas de días pasados o de hoy sin canceladas; con las cantidades.
9. **Dictado por campo**: `POST /api/me/voz/campos` `{ transcript, tipo }` → `{ conclusion, compromisos,
   next_step_date }` con el mismo proveedor que proponer (Claude, salida forzada por herramienta); mismos límites; 503
   sin llave; nunca el texto en los registros.
10. **Marca VG Medical** en la app (nombre "VG Visitas", logo, paleta monocromática, DM Sans): parte de la app, ver la
    spec. La web de OpMap no cambia.
11. **Datos simulados** de Carmen: `web/scripts/simulacion-carmen.ts` (plan, `--aplicar`, `--borrar`), ver la spec.
    `--borrar` solo anula las visitas a los médicos de prueba o con un contacto de prueba: una visita real que se
    vinculó sola a una cita simulada (las institucionales simuladas son con cuentas reales) no se anula, y esa cita se
    deja hecha y se muestra.

### Decisiones de implementación que se sumaron (Claude; el dueño puede cambiarlas)

41. **Día libre que bloquea**: el que la cuota ya cuenta como libre (`ESTADOS_DIA_LIBRE_LIBRES`: `registrado` cuando no
    se exige aprobación, o `aprobado`) y de **día completo** (`fraccion` 1). Medio día, por aprobar, rechazado o anulado
    no bloquean.
42. **Orden del vínculo automático**: mismo subtipo primero (institucional), luego hora más temprana (sin hora al
    final), luego la creada primero y por id. La cita puede ser de otra sede del mismo médico o cuenta (el médico atiende
    en varias); el `agenda_id` explícito tampoco exige la misma sede. El subtipo de la visita puede ser otro que el de la
    cita (se planeó compras y se habló con el químico).
43. **Paso 7b**: el vínculo se revisa después de las líneas (paso 7), así todos los rechazos de la 0830 salen igual y en
    el mismo orden. Rechazos con `agenda_id` (23514 → 400): "Esa cita no existe o no es tuya", "Esa cita está
    cancelada", "Esa cita ya tiene su visita", "Esa cita es de otro día", "Esa cita es de otro tipo de visita", "Esa cita
    es con otro médico", "Esa cita es con otra cuenta".
44. **La visita anulada conserva su `agenda_id`** como rastro; el índice único `visits_agenda_id_uidx` no cuenta las
    anuladas, así otra visita vuelve a cumplir la cita.
45. **Candado**: `agenda_crear`, `agenda_cancelar` y `visitas_registrar` usan el mismo candado por persona
    (`'visitas_app:' || executive_id`): cancelar y vincular no se cruzan.
46. **Cancelar**: motivo opcional (≤ 300). Inexistente o ajena → 404 "Esa cita no existe"; ya cancelada, hecha o de ayer
    → 400.
47. **API sin la 0840**: `/api/me/agenda*` responden 503 "La agenda de visitas aún no está disponible: falta aplicar la
    migración 0840 en la base de datos"; contexto, visitas y números siguen como antes (las lecturas de `visits`
    reintentan sin `agenda_id`/`agendada`): `agenda_hoy: []`, `agenda_id: null`, `agendada: false`, `agenda: null` en Mis
    números; `POST /api/me/visitas` registra igual (la función de la 0830 ignora `agenda_id`). `POST /api/me/voz/campos`
    no usa la base: funciona con o sin la 0840 (su 503 es el de la llave).
48. **Ventana en la API**: el pasado y más de 30 días se responden 400 sin ir a la base (`mensajeFechaCita`); el día libre,
    el perfil, el médico, la cuenta, el subtipo y los repetidos los decide `agenda_crear`.
49. **`porcentaje_agendadas` y `cumplimiento`** van como razón de 0 a 1 con 2 decimales (como `cumplimiento` de la cuota);
    null si no hay efectivas o citas (no "0 %").
50. **`agenda_hoy`** trae las de hoy pendientes y hechas (sin canceladas): Hoy muestra el día; Reportar filtra las
    pendientes. Con punto, la más cercana primero; sin punto, por hora.
51. **Proponer con la agenda**: el contexto de Claude trae las citas **pendientes** de hoy (`agenda`: id, hora, tipo, con
    quién, médico o cuenta, subtipo, sede; nunca la nota) y `cita_elegida` si la app manda `cita_id` (solo si es una de
    esas). `normalizarPropuesta` acepta también los ids del médico, la cuenta y la sede de esas citas (el médico de una
    cita puede no estar entre "mis médicos"; la sede puede quedar a más de 1 km). La propuesta no devuelve `agenda_id`:
    la app lo pone en el borrador de la cita elegida y la base vincula sola las demás.
52. **Dictado por campo**: herramienta estricta `repartir_campos` (esquema cerrado de 3 campos), el mismo modelo y
    parámetros que proponer (`pedirHerramienta`), con la fecha de hoy y su día de la semana; `normalizarCampos` oculta
    números de 7 dígitos o más y descarta una próxima reunión anterior a hoy. **Comparte el contador de proponer**
    (10 por minuto y 60 por hora entre los dos, por persona). 502 "No se pudo repartir el dictado. Escribe la conclusión
    y los compromisos a mano." si Claude falla o no cumple el esquema.

53. **Relevo de la no efectiva** (hallazgo del verificador; antes "abierto para el dueño"): si una visita **no
    efectiva** cumplió la cita y después, el mismo día, la persona logra la **efectiva** con el mismo médico (o la
    misma cuenta), la efectiva toma la cita: queda vinculada y `agendada` si la cita se creó antes del día, y la no
    efectiva queda sin cita (`agenda_id` NULL, `agendada` false; no suma a las efectivas de todos modos). Vale sin
    `agenda_id` (vínculo automático: el mismo subtipo primero y, a igual subtipo, la pendiente antes que el relevo) y con
    `agenda_id` de esa cita. Otra no efectiva no la toma ("Esa cita ya tiene su visita"), ni nadie la que cumplió una
    efectiva. El cumplimiento de la agenda no cambia (la cita sigue hecha). Espejo puro: `citaRelevable`,
    `citaParaVincular` y `vinculoDeVisita` (`relevo`) en `web/lib/reporte-visitas.ts`.
54. **Anular pasa la cita a otra visita**: al anular la visita que cumplía una cita, la cita pasa a otra visita suya no
    anulada de ese día, del mismo tipo y con el mismo médico o cuenta, que no tenga cita (la efectiva primero, luego el
    mismo subtipo, la llegada más temprana y por id: p. ej. la no efectiva de antes de un relevo, otra vez `agendada`
    si la cita se creó antes); si no hay, vuelve a `pendiente`. Espejo puro: `visitaQueRetomaCita`.
55. **Sin persona para las pruebas, la 0840 no se aplica**: si ninguna persona activa cumple el filtro de su bloque de
    pruebas (zona, usuario, líneas, sin visitas de la app hoy, sin días libres en las fechas de prueba ni
    configuración que empiece después de hoy), la migración aborta en vez de avisar y confirmar sin probar la agenda.
    Sus datos de prueba se reconocen por `PRUEBA0840M…` (médicos), `PRUEBA0840C…` (cuentas) y `prueba_0840_…`
    (subtipos), así los médicos de la simulación (`PRUEBA0840` + dos dígitos) no impiden re-ejecutarla.

### Base de datos (0840)

- `visitas_agenda` (17 columnas): `id`, `executive_id`, `fecha`, `hora` (time NULL: solo las citas viejas; la API la
  exige desde el 2026-10-15), `tipo`, `medico_id`, `cuenta_id`,
  `subtipo_id`, `sede_id` NOT NULL, `nota`, `estado`, `visita_id`, `cancelada_at`, `cancelada_motivo`, `created_by`,
  `created_at`, `updated_at`. CHECK `visitas_agenda_tipo_check`, `_estado_check`, `_nota_check`, `_motivo_check`,
  `_tipo_datos_check`, `_estado_datos_check`. Índices `visitas_agenda_medico_uidx`, `visitas_agenda_cuenta_uidx`,
  `visitas_agenda_visita_uidx` (únicos parciales) y `visitas_agenda_executive_fecha_idx`. Disparadores
  `update_visitas_agenda_updated_at` y `visitas_agenda_sin_borrar`. RLS sin políticas; `service_role` SELECT, INSERT,
  UPDATE.
- `visits`: `agenda_id` (→ `visitas_agenda`, `visits_agenda_id_uidx` único sin anuladas) y `agendada` (NOT NULL DEFAULT
  false); `visits_agenda_check` (agendada ⇒ agenda_id; agenda_id solo en las de la app). 45 columnas.
- Funciones (SECURITY INVOKER, `search_path = public, pg_temp`, solo `service_role`): `agenda_crear(p jsonb, p_user
  uuid) → { cita_id }`, `agenda_cancelar(p_id uuid, p_motivo text, p_user uuid)`; `visitas_registrar` (md5
  `eeae55de7196179daa686cc9bd11da7c`) y `visitas_anular` (md5 `462a121cfde8802c4a830bd3c61c05e4`) = la 0830 + el vínculo.
  Errores: 22023 forma, 23514 regla, 23505 cita repetida, P0002 inexistente o ajena (al cancelar).

### API (todas con `requireEjecutiva` / `visits:report`; errores `{ error }`)

| Ruta | Cuerpo / consulta | Respuesta |
| --- | --- | --- |
| `GET /api/me/agenda` | `?desde=AAAA-MM-DD&hasta=AAAA-MM-DD&canceladas=true` (sin fechas: hoy a hoy + 7; solo desde: desde + 7; como mucho 31 días; sin las canceladas salvo `canceladas=true`) | 200 `AgendaResponse { desde, hasta, hoy, max_fecha, items: CitaItem[] }` · 400 rango · 503 sin la 0840 |
| `POST /api/me/agenda` | `CitaCreate { fecha, hora, tipo, medico_id, cuenta_id, subtipo_id, sede_id, nota }` (`hora` HH:MM **obligatoria** desde el 2026-10-15; médica: `medico_id`; institucional: `cuenta_id` y `subtipo_id`; lo que no aplica, null) | 201 `{ cita: CitaItem }` · 400 `{ error, errores? }` (forma; sin hora, `''` o `null`: "Elige la hora de la cita" en `hora`, sin ir a la base; ventana, día libre, perfil, médico, cuenta, subtipo) · 409 repetida · 503 |
| `POST /api/me/agenda/[id]/cancelar` | `{ motivo: string \| null }` (cuerpo vacío = sin motivo) | 200 `{ cita: CitaItem }` · 400 cancelada, hecha, de ayer o motivo largo · 404 inexistente o ajena · 503 |
| `POST /api/me/visitas` | además `agenda_id: uuid \| null` | `VisitaItem` con `agenda_id` y `agendada` (también la repetida) · 400 con los mensajes del vínculo |
| `GET /api/me/visitas` | — | cada `VisitaItem` con `agenda_id` y `agendada` |
| `POST/GET /api/me/contexto` | — | además `agenda_hoy: CitaItem[]` (con punto: `distancia_m` y `dentro_del_radio`) |
| `GET /api/me/numeros` | — | además `agenda: NumerosAgenda \| null` |
| `POST /api/me/voz/proponer` | además `cita_id: uuid \| null` | igual |
| `POST /api/me/voz/campos` | `CamposDictado { transcript (1..8000), tipo }` | 200 `CamposDictadoResponse { conclusion, compromisos, next_step_date }` · 400 vacío o tipo · 429 (límites de proponer) · 502 · 503 sin `ANTHROPIC_API_KEY` |

- `CitaItem { id, fecha, hora (HH:MM | null: null solo en las citas viejas), tipo, medico { id, nombre } | null, cuenta { id, nombre } | null, subtipo
  { id, codigo, nombre } | null, sede: SedeCita { id, nombre, cuenta_id, cuenta_nombre, lat, lng, ubicacion_confirmada },
  nota, estado, visita_id, distancia_m, dentro_del_radio, anticipada, cancelable }` (`anticipada`: creada antes de su día;
  `cancelable`: pendiente de hoy en adelante). Nunca documentos ni teléfonos.
- `NumerosAgenda { efectivas, efectivas_agendadas, porcentaje_agendadas, citas_hasta_hoy, citas_hechas, cumplimiento }`.
- Tipos de la app en `mobile/lib/tipos.ts` (copia exacta, comprobada al compilar por `web/scripts/reporte-api-check.ts`):
  `EstadoCita`, `ETIQUETA_ESTADO_CITA`, `SedeCita`, `CitaItem`, `AgendaResponse`, `CitaResponse`, `CitaCreateBase`,
  `CitaCreateTipo`, `CitaCreate`, `CitaCancelar`, `NumerosAgenda`, `CamposDictado`, `CamposDictadoResponse`, más
  `agenda_hoy` en `ContextoResponse`, `agenda_id`/`agendada` en `VisitaItem`, `agenda_id` en `VisitaCreateBase` y
  `agenda` en `NumerosResponse`. Claves en `mobile/lib/claves-api.ts`: `cita`, `sedeCita`, `agenda`, `citaResponse`,
  `citaCreate`, `numerosAgenda`, `campos` y las listas ampliadas de `contexto`, `visitaItem`, `visitaCreate` y `numeros`.

### Código (servidor)

- Puro (`web/lib/reporte-visitas.ts`, sección 9): `ESTADOS_CITA`, límites y mensajes (`MENSAJE_HORA_OBLIGATORIA` desde el
  2026-10-15); `horaCorta`, `ventanaAgenda`,
  `esDiaLibreCompleto`, `mensajeFechaCita`, `citaCancelable`, `citaAnticipada`, `citaParaVincular`,
  `revisarCitaElegida`, `vinculoDeVisita` (espejo del paso 7b), `cuentasAgenda`, `distanciaACita`, `ordenarCitas`,
  `rangoConsultaAgenda`, `PROMPT_CAMPOS`, `esquemaCampos`, `HERRAMIENTA_CAMPOS`, `normalizarCampos`, `mensajeCampos`; y
  `contextoDictado(contexto, hora, citaId)` y `normalizarPropuesta` con la agenda. Esquemas (`reporte-visitas-schemas.ts`):
  `citaCreateSchema` (con `horaObligatoria` desde el 2026-10-15), `citaCancelarSchema`, `agendaQuerySchema`, `camposDictadoSchema`, `camposSchema`; `agenda_id` en
  `visitaCreateSchema` y `cita_id` en `proponerSchema`.
- Servidor (`web/app/api/me/_lib/reporte-server.ts`): `MENSAJE_FALTA_MIGRACION_0840`, `faltaMigracion0840`,
  `respuestaErrorAgenda`, lecturas de `visits` con reintento sin las columnas de la 0840, `leerCitas`, `leerCita`,
  `citasSinMigracion`, `armarCitaItems`, `cargarCitaItem`, `jsonbCita`, `numerosDeAgenda`, `repartirCampos` y
  `pedirHerramienta` (la llamada a Claude que comparten proponer y campos).
- Rutas: `web/app/api/me/agenda/route.ts`, `web/app/api/me/agenda/[id]/cancelar/route.ts`,
  `web/app/api/me/voz/campos/route.ts`; cambios en `contexto` (por `cargarContexto`), `visitas` (por `jsonbRegistrar` y
  las lecturas), `numeros` y `voz/proponer`.
- Pruebas: `web/scripts/reporte-check.ts` (secciones 10 a 10f: ventana, días libres, cancelable, hora, vínculo y
  "agendada" con el borde de medianoche, indicador, distancia y orden, esquemas, reparto del dictado y contexto de
  proponer con la agenda) y `web/scripts/reporte-api-check.ts` (sección 14 con `agenda_crear`, `agenda_cancelar` y el
  paso 7b emulados en el Supabase falso, Claude falso para campos y la ronda sin la 0840).

### Verificación (2026-10-14)

- `web`: `GOOGLE_ROUTES_DISABLED=true npm run check` → typecheck y lint sin errores y las 18 suites en verde
  (`reporte-check` 349, `reporte-api-check` 271).
- 0840 y 9944: ensayo real deshecho (`DRYRUN_OK` en los dos; ver `database/migrations/README.md`).

### Cambios del 2026-10-15: hora obligatoria y agenda como calendario

Decisión del dueño: `docs/decisiones/2026-10-15-agenda-con-hora-y-calendario.md`. Spec:
`docs/specs/2026-10-15-usabilidad-y-agenda-con-hora.md` (decisiones 1 a 5, paquete 3). Sin migración.

- **Hora obligatoria** (cambia la decisión 1 del 2026-10-14, "hora opcional"):
  - `POST /api/me/agenda` sin `hora`, con `''` o con `null` → 400 `{ error: "Elige la hora de la cita", errores: [{ campo:
    'hora', … }] }`, sin ir a la base. Una hora que no es HH:MM sigue dando "Hora no válida: usa HH:MM (de 00:00 a
    23:59)"; HH:MM:SS queda en HH:MM.
  - `CitaCreateBase.hora: string` en `web/lib/reporte-visitas.ts` (`MENSAJE_HORA_OBLIGATORIA`); `horaObligatoria` en
    `citaCreateSchema`.
  - La base no cambia: `visitas_agenda.hora` sigue `time NULL` y las citas viejas sin hora siguen válidas.
    `GET /api/me/agenda` y `contexto.agenda_hoy` pueden traer `hora: null`.
  - La app manda siempre la hora (`cuerpoCitaConHora`), así que funciona con la API vieja. La app vieja que agenda "Sin
    hora" contra la API nueva ve el 400 en "No se agendó".
  - `mobile/lib/tipos.ts` conserva `CitaCreateBase.hora: string | null` hasta igualarlo; `web/scripts/reporte-api-check.ts`
    comprueba al compilar que lo que manda la app (`cuerpoCitaConHora`) cabe en `W.CitaCreate`.
- **Agendar como calendario** (`mobile/app/(app)/agenda/nueva.tsx`): "¿Cuándo?" (mes en cuadrícula, lunes primero, de
  hoy a hoy + 30, el día libre que impide agendar apagado, la cantidad de citas por día) → "¿A qué hora?" (medias horas de
  07:00 a 18:30 en "Por la mañana" y "Por la tarde", "Otra hora" cada 15 minutos de 05:00 a 21:45, "Ese día ya tienes"
  como lista, aviso de choque en el pie que no bloquea) → "¿Con quién?" (selector cerrado con un solo buscador, que
  ofrece "Buscar en OpMap" con lo escrito) → nota; al pie, fijo, "Agendar · jueves 16 oct · 10:00". Abre con la franja
  tocada en Mi agenda (`rutaAgendar`: solo fecha y hora en la URL) o con la primera libre desde las 08:00 de MAÑANA
  (`fechaInicialAgendar`: la cita de hoy cuenta como no agendada); el "con quién" puede venir en memoria (`fijarPedidoAgendar` / `tomarPedidoAgendar`, se toma una
  vez). Una sola carga de 31 días (`api.agenda(hoy, hoy + 30)` y `api.diasLibres(hoy, hoy + 30)`); los datos fijos, del
  contexto en memoria de menos de 10 minutos o de `GET /api/me/contexto`. Al agendar: `invalidarContexto('cita')` y vuelta
  a `/agenda?fecha=…` con la cita resaltada.
- **Mi agenda como calendario** (`mobile/app/(app)/agenda.tsx`): semana por defecto (o mes, con "Ver mes"), con la cantidad
  de citas por día y los días libres; se puede ir a cualquier mes. Pide por mes (`rangoDeMes`, como mucho 31 días, con
  `canceladas=true`) y vuelve a pedir al recibir el foco. Debajo, el día como línea de tiempo por medias horas con la línea
  "Ahora": la franja libre que aún se puede agendar abre Agendar a esa hora; la cita abre su detalle ahí mismo (nota, sede,
  "Ver la visita", "Cancelar esta cita" con motivo); las viejas sin hora al final ("Sin hora") y las canceladas en "Ver
  canceladas (n)". Toda cita de hoy a hoy + 30 se ve y se puede cancelar. Entradas a Agendar y a "/dias-libres".
- **Reglas de Claude** (el dueño puede cambiarlas): franjas de 30 minutos (`HORARIO_AGENDA`); cada cita se dibuja como un
  bloque de 30 minutos (`DURACION_VISUAL_MIN`, sin columna de duración); dos citas cuyos bloques se pisan solo se avisan.
- Código puro de la app: `mobile/lib/agenda.ts` (franjas, `ocupacionDelDia`, `siguienteFranjaLibre`, `primeraFranjaLibre`,
  `validarCitaConHora`, `cuerpoCitaConHora`, `textoBotonAgendar`, `avisoChoque`, `avisoAgendadaHoy`, `textoCitasDelDia`,
  `lineasCitasDelDia`, `medicosConCitaEseDia`, `marcasDelMes`, `bloqueaAgendar`, `fechaInicialAgendar`,
  `errorCitaRepetida`, `plegarLibres`, `vistaCalendarioAgendar`) y `mobile/lib/calendario.ts` (`cuadriculaMes`, `semanaDe`,
  `lunesDe`, `rangoDeMes`, `mesDe`, `mesSiguiente`, `mesAnterior`, `tituloMes`). Componentes en `mobile/components/agenda/`:
  `CalendarioMes`, `SelectorHora`, `LineaDelDia` y `DetalleCita`.
- Pruebas: `web/scripts/reporte-check.ts` (10e: sin hora, `''`, espacios o `null` → "Elige la hora de la cita" en `hora`),
  `web/scripts/reporte-api-check.ts` (sección 14: sin hora 400 sin ir a la base ni guardar; la institucional con 11:00 da
  201; la cita vieja sin hora se lee con `hora: null`), `web/scripts/simulacion-check.ts` (todas las citas simuladas con
  hora) y la sección 17 de `mobile/scripts/movil-check.ts` (`mobile/scripts/checks/17-agenda.ts`).

### Cambios del 2026-10-15: usabilidad de la app y medición (tanda 1)

Spec: `docs/specs/2026-10-15-usabilidad-y-agenda-con-hora.md` (paquetes 1, 2, 4 y 5). Sin migración ni cambios en lo que
responden las rutas.

- **Barra de pestañas** (`mobile/app/(app)/_layout.tsx`, `mobile/lib/navegacion.ts`): Hoy · Reportar · Agenda · Números ·
  Ajustes, con ícono (relleno si está activa) y el nombre debajo, a la altura que da la librería. "Días libres" sale de la
  barra (`OCULTAS`, con "Volver") y se abre desde Agenda y desde Ajustes ("Mis días libres"); volverla a la barra es
  moverla de `OCULTAS` a `PESTANAS`. Agendar, Visita, Nuevo médico y Nueva sede siguen ocultas.
- **Reportar** (`mobile/lib/tarjeta-resumen.ts`): la tarjeta de voz válida (confianza ≥ 0,6, sin preguntas, presencial
  dentro del radio o telefónica válida) sale en resumen con filas que se tocan para corregir; lo dudoso abre la tarjeta
  completa. "Confirmar visita i de N" va fijo en `Pantalla.pie`; cada tarjeta se sigue confirmando con su toque y con
  `validarBorrador`. La cita tocada en Hoy entra por `tomarCitaParaReportar` con las reglas de `pasoDelReporte`.
- **Contexto en memoria** (`mobile/lib/contexto-memoria.ts`): Hoy y Reportar lo usan con menos de 60 s y a menos de
  100 m del punto pedido; entre 60 s y 3 min pintan y refrescan (`planCargaReportar`); Agendar y Visita reusan los datos
  fijos hasta 10 min. Solo sirve el mismo día en Bogotá (`contexto.hoy.fecha`). Se invalida con el 201 de una visita
  (`'visita'`), al agendar o cancelar (`'cita'`), al registrar o anular un día libre (`'dia_libre'`), al crear un
  médico, una cuenta o una sede o vincular una sede a un médico (`'terceros'`, en `lib/api.ts` después del 2xx) y se
  olvida al cerrar sesión. La ubicación final y lo que decide el servidor no cambian.
- **Sesión** (`mobile/lib/sesion-reglas.ts`): con perfil guardado y token vigente la app entra ya y confirma
  `/api/auth/me` en segundo plano con el tiempo de una petición normal (`TIEMPO_ME_FONDO_MS = 20_000`); solo la espera
  sin perfil guardado usa `TIEMPO_ME_MS = 5_000`. Un 401 sigue cerrando la sesión. El token vive en memoria
  (`MemoriaToken`).
- **Medición**: toda ruta de `/api/me/*` (también `/api/me/agenda/**`) responde la cabecera aditiva `Server-Timing`
  (`fase;dur=ms, …, total;dur=ms`) y deja en `console.info` una línea `[tiempos] <MÉTODO> <ruta con :id> fase=ms …
  total=ms [datos numéricos] [estado=NNN si no es 2xx] [frio=1]`, sin contenido (`web/app/api/me/_lib/tiempos.ts`). En
  desarrollo la app escribe `[api]` y `[tiempos-app]` en la terminal de Metro.
- **Audio**: sigue en 64 kbps y 44,1 kHz; `EXPO_PUBLIC_PERFIL_AUDIO=ligero` deja 32 kbps, 22,05 kHz, mono (prueba A/B
  del dueño, D7 de la spec).
- Pruebas: secciones 15 a 19 de `mobile/scripts/movil-check.ts` (`mobile/scripts/checks/15-navegacion.ts` …
  `19-pantallas.ts`) y `web/scripts/tiempos-check.ts`.

### Correcciones de la revisión de usabilidad (2026-10-15)

Spec: `docs/specs/2026-10-15-usabilidad-y-agenda-con-hora.md` ("Revisión de la rama"). Sin migración.

- **API (aditivo)**: `GET /api/me/cuota`, `GET /api/me/numeros` (en `cuota`) y `GET /api/config-visitas/cuota` traen
  `dias_habiles_por_delante`: días hábiles después de hoy sin los días libres (`cuotaPeriodo.diasHabilesPorDelante`).
  Números dice "Te faltan 62 visitas médicas: 7 por día en los 10 días hábiles que quedan" con esa cifra (antes dividía
  también por los días libres que vienen); con un servidor anterior y días libres en el mes, no lo muestra.
- **Reportar**: el pie dice qué se confirma ("Efectiva · PerOssal y Reemplazo articular · sin conclusión") o lo que falta
  / el rechazo; con tarjetas, "¿Dónde estás?" en una línea y "Lo que dijiste" después de las tarjetas; con el contexto de
  memoria, "Hablar" espera a que respondan las visitas de hoy y, sin red, "Sin señal" y solo "Por toques"; la cita tocada
  en Hoy que quedó pendiente se ve ("Reportar esa cita", "Olvidarla") y no arranca sola al terminar un envío;
  "Descartar" pregunta antes.
- **Agendar**: hoy a una hora pasada → "Esa hora ya pasó: elige una hora más tarde" (solo la app; el servidor acepta
  cualquier hora de hoy); el mismo médico (o cuenta y subtipo) con cita en pie ese día se avisa al elegirlo, con el texto
  de la base; en pantallas bajas (< 700 pt) el calendario abre en la semana.
- **Mi agenda y Días libres**: la línea del día pliega 3 o más medias horas libres seguidas ("Libre de 07:00 a 09:00 ·
  Ver horas"); el error es por mes; "Hoy" en el calendario; el aviso de cancelar sale junto al día; un día libre con citas
  pendientes se avisa en Mi agenda y al pedirlo en Días libres (que marca las citas de hoy a hoy + 30).
- **Barra**: la caja del ícono mide 24 pt (`tabBarIconStyle`): sin margen inferior (iPhone SE u 8) el nombre ya no toca
  el borde.

## F4.2 Persona de campo y agenda con resultado (F1a de actividades de campo, 2026-10-15)

Spec: `docs/specs/2026-10-15-actividades-de-campo.md` (fase F1a; las decisiones A1 a A17 del dueño mandan, ver
`docs/decisiones/`). Migración `database/migrations/2026-10-15_0850_persona_de_campo_y_agenda.sql`, rollback
`2026-10-15_9945_persona_de_campo_y_agenda_rollback.sql` (la 0850 **APLICADA el 2026-10-30** con autorización del dueño;
sus pruebas del bloque DO `P0850` corren dentro de la misma transacción y se deshacen; el rollback queda escrito). Tablas y funciones: `docs/base-de-datos.md` (sección "0850"). La app móvil
no cambia en F1a (F1b la rediseña); la API de hoy le sigue sirviendo igual.

### Quién es quién

- **Persona de campo**: usuario activo, que no es `commercial_director` (A1), con al menos una línea para reportar = las
  `executive_lines` de su Ejecutivo Comercial ACTIVO ∪ las líneas activas que lidera (`business_lines.leader_user_id`).
  Quien agenda y visita es el USUARIO (`visits.user_id`, `visitas_agenda.user_id`); el Ejecutivo Comercial es opcional.
- **Rol**: `ejecutivo` (solo Ejecutivo Comercial), `lider` (solo líder) o `lider_y_ejecutivo` (Paola: una sola agenda).
- **Como líder** (ninguna línea de la visita es suya como Ejecutivo Comercial): sin zona (`executive_id` y `kam_id`
  NULL, `kam_name` = su nombre), nunca fuera de territorio, configuración general sin telefónica, sin cuota y el médico
  debe ser "de sus líneas" (C9: un visitante vigente en una de ellas, o su visitante es un Ejecutivo Comercial activo con
  una de ellas). Corregir las líneas de una visita no puede cambiar su papel.
- **La dirección comercial** no agenda ni reporta (pierde `visits:report`; conserva `calendar:manage`, `visits:config`
  y `daysoff:approve`): vigila (Equipo llega en F4).

### API (cambios; todo lo demás igual)

Todas las rutas de `/api/me/*` salvo `dias-libres*` y `cuota` usan `requirePersonaDeCampo`: 401 sin sesión; 403 "Acceso
denegado" sin `visits:report`; 403 "La dirección comercial no agenda ni reporta: sigue a tu equipo en Equipo"; 403 "Tu
usuario no tiene líneas para reportar"; 503 "…falta aplicar la migración 0850…" si la base no la tiene. `dias-libres*` y
`cuota` siguen siendo del Ejecutivo Comercial (`requireEjecutiva`) hasta F3.

**App solo para las líderes** (dueño, 2026-10-30, `docs/decisiones/2026-10-30-app-de-campo-solo-lideres.md`):
- Quien solo es Ejecutivo Comercial recibe 403 "Las visitas de los Ejecutivos Comerciales se registran en VMO" en todas
  las rutas de la persona de campo.
- Paola recibe la persona solo como líder: `rol: 'lider'`, solo sus líneas de líder, sin Ejecutivo Comercial, sin zona y
  sin cuota. Una línea que lidera y que también es de su Ejecutivo Comercial no cuenta como de líder (la base haría de
  Ejecutiva esa visita).
- `/api/me/cuota` y `/api/me/dias-libres*` (de un Ejecutivo Comercial) responden 403 con ese mensaje desde la app (token
  de portador). Con la cookie de la web siguen como antes (`/calendario`).
- `POST /api/me/agenda` y `…/otra-fecha` mandan `como: 'lider'` a la base; con `como: 'ejecutivo'` responden 403 con el
  mismo mensaje, en `errores: [{ campo: 'como' }]`.
- Con `APP_CAMPO_EJECUTIVOS=true` en el servidor, todo vuelve a la tabla de abajo tal cual. Las pruebas de F3 y F4 lo
  usan; la sección 16 de `reporte-api-check.ts` prueba la regla.

| Ruta | Cambio |
| --- | --- |
| `GET/POST /api/me/contexto` | + `persona: { user_id, nombre, executive_id, rol, lineas: [{ id, nombre, como }] }`. Sin Ejecutivo Comercial: `ejecutiva.id` = el usuario, `zona` null, `mis_medicos` los de sus líneas, meta 0, telefónica apagada |
| `POST /api/me/visitas` | El servidor decide el Ejecutivo Comercial de la visita; línea ajena → 400 "Alguna de las líneas no es tuya"; como líder, médico ajeno → 400 "Ese médico no es de tus líneas" |
| `PATCH /api/me/visitas/[id]` | Cambiar el papel → 400 "Para cambiar el papel de la visita …, anúlala y repórtala de nuevo". Pasar a efectiva una visita cuya cita ya tiene otra fecha → 400 "La cita de esta visita ya tiene otra fecha: elimina primero esa otra fecha" (A7) |
| `POST /api/me/visitas/[id]/anular` | Anular una visita cuya cita ya tiene otra fecha → 400 "La cita de esta visita ya tiene otra fecha: elimina primero esa otra fecha" (A7: la cita volvería a pendiente con su otra fecha colgando) |
| `GET /api/me/numeros` | Sin Ejecutivo Comercial: `cuota: null` y cumplimiento null; con él, la cuota solo cuenta sus visitas como Ejecutivo Comercial. `agenda` + `citas_no_realizadas` (las eliminadas no cuentan) |
| `GET /api/auth/me` | + `persona: { rol, lineas } \| null` (null sin `visits:report` o sin líneas) y `sin_persona: string \| null`: sin persona, el porqué cuando se sabe ("Las visitas de los Ejecutivos Comerciales se registran en VMO", "Tu usuario no tiene líneas para reportar"; null para la dirección comercial, que la app reconoce por su rol) |
| `GET /api/me/agenda` | `max_fecha: null` (sin tope, A4). `canceladas=true` trae también las que no se hicieron; las eliminadas nunca |
| `POST /api/me/agenda` | + `como?: 'ejecutivo' \| 'lider'` (sin él: como Ejecutivo Comercial si lo tiene). Hoy a una hora pasada → 400 "Esa hora ya pasó" en `hora`, sin ir a la base. Choque de media hora → 409 "A las 09:30 ya tienes cita con …: elige otra hora" con `errores: [{ campo: 'hora' }]`. Sin tope hacia adelante |
| `POST /api/me/agenda/[id]/cancelar` | `{ motivo_codigo?, motivo? }`: el motivo es OBLIGATORIO (A8); solo texto (la app de hoy) = `otro`; nada → 400 "Elige o escribe el motivo de la cancelación"; `salida` no se elige |
| `POST /api/me/agenda/[id]/cerrar` (nueva) | `{ motivo_codigo, motivo? }` ("no se hizo", desde su día): 200 `{ cita }` · 400 "Esa cita todavía no llega: cancélala" / "Esa cita ya está cerrada" · 404 ajena |
| `POST /api/me/agenda/[id]/eliminar` (nueva) | `{}` (por error; pendiente de hoy en adelante; no cuenta en nada): 200 `{ cita_id }` · 400 "Solo se elimina una cita pendiente" · 404 |
| `POST /api/me/agenda/[id]/otra-fecha` (nueva) | `{ fecha, hora, sede_id?, nota?, como? }`: 201 `{ cita }` con `viene_de` (mismo médico o cuenta y subtipo; sin `nota`, la de la anterior) · 400 "Esa cita sigue programada: ciérrala o cancélala antes" (o el mensaje de una hecha efectiva o de una cancelada por salida) · 409 "Esa cita ya tiene otra fecha" o choque · 404 |

- `CitaItem` suma (aditivo) `motivo_codigo`, `no_realizada_at`, `no_realizada_motivo`, `viene_de`, `sucesora_id`, `como`
  y `estado_visible` (`programada`, `atrasada`: hoy pasada su hora; `sin_cerrar`: de un día anterior; o su estado
  cerrado) y, desde F1b, `viene_de_fecha` y `viene_de_estado` (la fecha y el estado de la cita de la que viene, o null:
  el detalle de la app dice "Viene de la cita del 12 oct · No se hizo" aunque esa cita sea de otro mes). Nunca
  documentos ni teléfonos.
- **Compatibilidad con la app** (actualizada con F1b, 2026-10-29 y 2026-10-30): la app de F1b (rama `feat/campo-f1b`)
  tipa TODO lo de esta sección —la persona, los 5 estados, el ciclo de vida, `cuota: null`, `max_fecha: null`,
  `citas_no_realizadas`, los cuerpos de cancelar con código, cerrar, otra fecha y `como`—:
  `web/scripts/reporte-api-check.ts` compila los tipos de `mobile/lib/tipos.ts` contra los de la web en los dos sentidos
  (salvo `MeResponse` de la app a la web: el `Role` de la app acepta cualquier texto, así que ese solo se comprueba de la
  web a la app) y exige que cada respuesta traiga EXACTAMENTE las claves de `mobile/lib/claves-api.ts`. Los cuerpos tal
  cual los manda la app (`CUERPO_*_APP`: agendar, cancelar y "no se hizo" con `{ motivo_codigo: 'cliente', motivo: null }`,
  cancelar sin F1a y otra fecha con `sede_id`, `nota` y `como` null; la sección 21 de `mobile/` exige que sus funciones
  den exactamente esos) pasan los esquemas con `safeParse` y van por POST en la sección 15 (comparar el tipo con
  `z.input` no probaba nada: la entrada de esos esquemas es `unknown`). La app sigue sin leer `max_fecha` (prueba
  estática) y ya no tiene tope: Agendar trae 31 días al abrir y cada mes más adelante al llegar a él. La app de antes
  de F1b sigue funcionando con esta API: las respuestas solo ganaron claves y cancelar con solo el texto (= `otro`) se
  sigue aceptando. Lo que esa app vieja ve distinto: el choque y la hora pasada como "No se agendó" con el mensaje del servidor; cancelar sin
  escribir motivo (allí era opcional) → 400 "Elige o escribe el motivo de la cancelación", que muestra tal cual; y una
  líder ya no recibe 403 (ve "no está enlazado" pero reporta y agenda bien).
- **La app de F1b** (`mobile/`, sin migración; detalle en la sección "F1b" de la spec): la sesión guarda la persona de
  `/api/auth/me` (el login no la trae: se pide en segundo plano al entrar); la dirección comercial ve "La dirección
  comercial sigue a su equipo en la web" sin pestañas, y quien el servidor deja fuera con `sin_persona` (app solo para
  líderes, 2026-10-30) ve ese porqué, también sin pestañas; Hoy junta lo atrasado y lo sin cerrar en "¿Qué pasó con
  esto?" (`GET /api/me/agenda` de los 31 días anteriores) con Reportar, "No se hizo" y Cancelar; el detalle de una cita
  en Mi agenda tiene Reportar, "No se hizo", Cancelar, "Agendar otra fecha" y "Eliminar: lo agendé por error"; Agendar
  empieza por "¿Qué vas a hacer?", no tiene tope, ofrece "Como Ejecutivo Comercial" / "Como líder" a quien tiene los dos
  papeles (como líder, solo médicos de sus líneas, también del buscador) y trata el choque como error (`errorChoque`, el
  texto del servidor, en el pie con su propio texto); sin Ejecutivo Comercial no hay cuota en Números ni Días libres, ni
  "Cuenta para" en el detalle de la visita; Paola ve su cuota como "Como Ejecutivo Comercial · <sus líneas>". Con un
  servidor sin F1a (`/api/auth/me` sin la clave `persona`) la app no ofrece "No se hizo", Eliminar, "Agendar otra
  fecha" ni "¿Qué pasó con esto?" y cancela con solo `{ motivo }` (lo escrito o la etiqueta del motivo); si no lo sabe,
  decide el servidor. La prueba en el iPhone va contra un servidor con la 0850. Espejo del ciclo de vida:
  `mobile/lib/agenda-ciclo.ts` (la sección 21 de `npm run check` de `mobile/` lo compara con `web/lib/agenda-ciclo.ts`);
  reglas de la persona: `mobile/lib/persona.ts`.
- **Mapa de asignación**: `GET /api/visits/filtered`, `/stats` y `/unvisited-zones` dejan fuera las visitas de la app sin
  Ejecutivo Comercial (`FILTRO_MAPA_ASIGNACION` en `web/app/api/visits/_lib/visitas-mapa.ts`); las de VMO siguen.

### Código

- Puro: `web/lib/persona-campo.ts` (`lineasParaReportar`, `rolDePersona`, `personaDeCampo`, `ejecutivoDeLaVisita`,
  `ejecutivoDeLaCita`, `medicoDeLineas`, mensajes) y `web/lib/agenda-ciclo.ts` (`ESTADOS_CITA`, `MOTIVOS_CIERRE`,
  `agendaChoca`, `mensajeHoraCita`, `revisarCancelar/Cerrar/Eliminar`, `revisarMotivo`, `origenParaOtraFecha`,
  `estadoVisible`, `cuentasAgenda`, mensajes), espejo de las funciones de la 0850 (los mensajes se comparan con el SQL).
  `web/lib/reporte-visitas.ts` los re-exporta; se quitaron `DIAS_AGENDA_ADELANTE`, `MENSAJE_CITA_LEJANA` y
  `ventanaAgenda`. Esquemas nuevos: `citaCerrarSchema`, `citaOtraFechaSchema`; `citaCancelarSchema` exige motivo.
- Servidor: `personaDeCampo` y `requirePersonaDeCampo` (`web/app/api/config-visitas/_lib/visitas-server.ts`);
  `web/app/api/me/_lib/reporte-server.ts` lee por `user_id` (`leerVisitas`, `leerCitas`, `numerosDeAgenda`), arma
  `persona` y los médicos de sus líneas, y traduce 23P01 → 409.
- Pruebas: `web/scripts/persona-campo-check.ts` y `web/scripts/agenda-ciclo-check.ts` (nuevas, puras),
  `reporte-api-check.ts` (sección 15: líder, Paola, choque, hora pasada, cancelar, cerrar, eliminar, otra fecha, estado
  visible, compatibilidad y mapa), `reporte-check.ts`, `visits-check.ts`, `visits-api-check.ts`, `simulacion-check.ts`
  (las citas simuladas llevan `user_id`) y `tiempos-check.ts`.

### Decisiones de implementación (Claude; el dueño puede cambiarlas)

1. Un Ejecutivo Comercial que pasa a inactivo mientras la persona sigue como líder cancela solo sus citas como Ejecutivo
   Comercial ("Dejó de ser Ejecutivo Comercial", motivo `otro`: no salió de la empresa, así que esas citas admiten otra
   fecha como líder con un médico de sus líneas); si la persona se queda sin líneas, todas (motivo `salida`). La spec
   (C11) solo pide el segundo caso: el primero espera el visto bueno del dueño.
2. La "otra fecha" única no cuenta las eliminadas: si la sucesora se eliminó por error, se puede pedir otra vez.
3. El disparador que exige motivo al cancelar solo mira cancelaciones nuevas: las canceladas de la 0840 sin código
   quedan como están.
4. Sin la 0850 aplicada, `/api/me/*` responde 503 (no hay modo de compatibilidad con la 0840): código y migración se
   despliegan en la misma ventana.
5. La persona en `/api/auth/me` solo se arma con `visits:report`.
6. Las pruebas del mapa con visitas de líder viven en `reporte-api-check.ts` (sección 15), donde están los datos de la app.

### Verificación (2026-10-15)

- `web`: `GOOGLE_ROUTES_DISABLED=true npm run check` → typecheck y lint sin errores y las 26 suites en verde
  (`reporte-check` 373, `reporte-api-check` 410, `persona-campo-check` 40, `agenda-ciclo-check` 50, `simulacion-check`
  140, `visits-check` 418).
- Cada prueba nueva se verificó rompiendo lo que vigila (mutaciones en `agenda-ciclo.ts`, `persona-campo.ts`,
  `permissions.ts`, `reporte-server.ts`, `visitas-server.ts`, `visitas-mapa.ts`, `auth/me` y `simulacion-carmen.ts`): todas
  fallaron y se revirtieron.
- 0850 y 9945: sin ensayar aquí (no hay Postgres local); estructura revisada y huellas md5 recalculadas. El ensayo con
  `BEGIN; … ROLLBACK;` queda para el orquestador.
