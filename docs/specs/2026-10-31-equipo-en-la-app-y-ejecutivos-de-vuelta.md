# Spec: "Equipo" en la app y los Ejecutivos Comerciales de vuelta  (2026-10-31)

**Estado**: aprobada por el dueño el 2026-10-31 ("Si"). Dos entregas, dos PR.

## Problema

Laura (directora comercial) abrió la app de campo en su celular y vio "La dirección comercial sigue a su equipo en la
web" con "Cerrar sesión". El administrador sin líneas ve "Tu usuario no tiene líneas para reportar". Y "la web" donde
seguiría a su equipo (`/equipo`, F4 de `docs/specs/2026-10-15-actividades-de-campo.md`) no existe: hoy solo está
`/lideres` con el histórico del Excel.

El dueño, el 2026-10-31:
- "la directora como Adm deben tener sus funciones en versión móvil también";
- qué hace Laura en el celular: "Vigilar sus líderes y los ejecutivos comerciales. Y los líderes vigilan sus
  ejecutivos comerciales";
- "Debemos hacer que las ejecutivas comerciales también reporten, vamos a hacer la solución completa. Lo del excel eso
  es algo transitorio para ver el mapa de calor de donde los ahora visitan con VMO mientras logramos que esta app
  funcione. Los supervisores quieren saber dónde están sus supervisados y su rendimiento."
- Entre "Equipo dentro de la app" y "Equipo como página web", eligió la app: "VAMOS CON A".
- Sobre un Ejecutivo que lleva líneas de dos líderes: cada líder "puede ver toda la info del Ejecutivo X", y además
  cuántas visitas fueron de cada línea: "Ejecutivo X visita 99 para A y 1 visita para línea B. Aquí el líder va a
  levantar la mano y pedir ajustes. Eso debe ser visto."
- Sobre OpMap y la app de campo: "es lo mismo… hablemos ya de una app y punto". Son una sola app: quien entra en
  OpMap entra en Equipo o en su agenda sin volver a escribir la contraseña, sea líder, Ejecutivo, dirección o
  administrador.

Esto cambia dos reglas anteriores:
- **A1 (2026-10-15)** se conserva en lo que dice de reportar: la dirección no agenda ni reporta. Lo de "vigila desde la
  web" pasa a "vigila desde la app (y desde el computador con la misma pantalla)".
- **La app solo para las líderes (2026-10-30)** se revierte: los Ejecutivos Comerciales vuelven a reportar en la app.
  El importador de VMO sigue, transitorio, solo para el mapa de calor.

## Resultado esperado

### Entrega 1 — Los Ejecutivos Comerciales vuelven a la app (PR 1, pequeño)

- Un Ejecutivo Comercial activo con usuario entra a la app y agenda, reporta, ve su cuota, sus números y sus días
  libres, como antes del 2026-10-30. Quien tiene los dos papeles (Paola) vuelve a tener "Como líder" y "Como Ejecutivo
  Comercial" al agendar y al reportar.
- En OpMap web, el menú de un Ejecutivo Comercial empieza con "Agendamiento" (abre `/campo/agenda`), con el mismo
  ingreso único que ya tiene la líder.
- Cuota y días libres vuelven a responder desde la app (token de portador), no solo desde la web.
- La llave `APP_CAMPO_EJECUTIVOS` desaparece: la regla ya no existe, no se apaga ni se prende.
- El mapa de calor del mapa de asignación no cambia: las visitas de la app con Ejecutivo Comercial ya salen; las de
  VMO siguen entrando por `/visits` mientras el equipo termine de pasarse a la app. Cuando el dueño lo decida, se
  apaga `/visits`; eso no va aquí.
- Decisión escrita en `docs/decisiones/2026-10-31-ejecutivos-comerciales-vuelven-a-la-app.md`; la del 2026-10-30 queda
  marcada como reemplazada.

### Entrega 2 — "Equipo" en la app: dónde están y cómo rinden (PR 2, grande)

**Quién ve a quién** (`personasVisibles`, función pura en `web/lib/equipo.ts`, con permiso nuevo `team:view`):
- La dirección comercial y el administrador ven a todas las personas de campo: las líderes y los Ejecutivos
  Comerciales activos con usuario.
- Una líder se ve a sí misma y a los Ejecutivos Comerciales activos de sus líneas. No ve a las otras líderes (A2).
  A Paola la líder de Sustitutos óseos la ve solo como Ejecutiva: lo que Paola hace como líder no se le muestra.
- De un Ejecutivo que lleva líneas de dos líderes, cada una ve **todo** lo que hace (todas sus visitas y citas, de
  cualquier línea) y, aparte, **cuántas fueron de cada línea** (dueño, 2026-10-31): así la líder B ve "100 visitas:
  99 impulsando A, 1 impulsando B" y pide ajustes. Una visita que impulsó A y B cuenta para las dos líneas.
- Los Ejecutivos Comerciales no tienen Equipo.
- Las vacantes no salen. La dirección y el administrador tampoco salen como "personas" (no reportan).

**Cómo se entra:**
- La dirección y el administrador entran a la app (celular o `/campo` en el computador) y ven dos pestañas: **Equipo**
  y **Ajustes**. No tienen Hoy, Reportar, Agenda ni Números (siguen sin agendar ni reportar: A1).
- Una líder conserva sus cinco pestañas; **Equipo** se abre desde una tarjeta "Mi equipo" arriba en Hoy y desde
  Ajustes. (Decisión de Claude: en la barra caben cinco pestañas con el nombre entero; el dueño puede pedir otra cosa.)
- El servidor dice quién supervisa: `GET /api/auth/me` y el contexto traen `supervisa: true` cuando el rol tiene
  `team:view`. La app no decide por el nombre del rol: si no hay persona de campo pero `supervisa`, entra a Equipo; si
  no hay ni lo uno ni lo otro, ve el aviso de hoy ("Tu usuario no tiene líneas para reportar").
- En OpMap web, el menú de la dirección, el administrador y la líder lleva **"Equipo"** (abre `/campo/equipo` como
  página completa). En `/inicio` aparece como cuadro, porque sale del mismo menú.
- **Una sola app, un solo ingreso** (dueño, 2026-10-31): quien ya entró en OpMap abre "Equipo" o "Agendamiento" sin
  escribir la contraseña, cualquiera que sea su rol. `POST /api/auth/sesion-app` acepta a todo rol con `campo:app` o
  `team:view`. Esto deja sin efecto la revisión del 2026-10-30 que negaba el ingreso único a la dirección y al
  administrador; queda anotado en la decisión.

**Pantalla Equipo › Hoy, "¿Dónde está mi gente?"** (todo sale de lo reportado y agendado; nunca de la ubicación del
teléfono en vivo, C5):
- Arriba, fijo: "Lo que cada persona reporta o agenda. La app no sigue la ubicación."
- Selector de día (hoy por defecto; cualquier día pasado).
- Resumen por ciudad: "Cartagena 2 · Bogotá 6 · Sin reporte ni plan 3".
- Filtros: todas, líderes o Ejecutivos Comerciales; y línea.
- Una tarjeta por persona, con su nombre, su papel (líder, Ejecutivo Comercial o los dos) y `dondeEsta`, el primer caso
  que se cumple:
  1. Día libre aprobado de día completo, o festivo sin nada reportado: "Día libre" / "Festivo".
  2. Última visita presencial reportada ese día: "10:40 · <sede>, <municipio> (hace 35 min)". Pasadas 3 horas:
     "Último reporte hace 4 h · <municipio>".
  3. Una cita entre 30 min antes y 60 min después de ahora: "Planeado 11:00 · <sede>, <municipio>".
  4. "Sin reportes ni plan hoy".
  Las telefónicas no ubican a la persona. Cada dato dice su fuente: Reportado o Planeado.
- **Marcas del servidor** (0940): si la visita que ubica a la persona tiene marcas, la tarjeta y el rastro las muestran
  con palabras ("Lejos de la sede", "Sin GPS", "GPS impreciso", "Hora del teléfono rara", "Médico por validar").
  Son el veredicto del servidor, no el punto: nunca salen la distancia, la precisión ni las coordenadas del teléfono.
  (Decisión de Claude: una ubicación que el servidor marcó como dudosa no se muestra como segura.)
- Tocar la tarjeta abre el día de la persona: el rastro por hora (tipo, con quién —médico o cuenta—, sede y municipio,
  estado: Hecha, No efectiva con su motivo, No se hizo con su motivo, Cancelada, Programada, Atrasada o Sin cerrar;
  "planeada hace N días" o "no planeada"; "viene de la cita del <fecha>" si es otra fecha; las líneas que impulsó;
  el médico no listado con el nombre que escribió la persona), y "Siguiente": lo de hoy que falta y los dos días que
  vienen. Nunca la transcripción, ni la foto, ni el documento del médico, ni el GPS.
- La pantalla se relee cada 5 minutos mientras está a la vista.

**Pantalla Equipo › Rendimiento:**
- Periodo: esta semana, 15 días, este mes, o un rango libre (como mucho 93 días por consulta).
- Filtros: líderes o Ejecutivos Comerciales; línea.
- Tarjetas del equipo y una fila por persona (ordenadas por cumplimiento del plan, de menor a mayor, para ver primero
  a quien va atrás):
  - Hechas (efectivas y no efectivas, con los motivos de las no efectivas), No se hizo (por motivo), Canceladas (por
    motivo), Sin cerrar, Programadas y Telefónicas.
  - Cumplimiento del plan = citas cumplidas ÷ citas programadas hasta hoy, contando cada cadena de "otra fecha" UNA
    vez por su última cita (decisión de Claude, precisada el 2026-10-31):
    - una cadena entra en el denominador si su última cita tiene fecha ≤ hoy (si la última es futura y pendiente, la
      cadena aún no cuenta);
    - entra en el numerador si esa última cita está `hecha`;
    - `no_realizada`, `cancelada` y pendiente vencida ("sin cerrar") cuentan en el denominador y no en el numerador;
    - las visitas reportadas sin cita no entran en esta cifra (van en "no planeadas" de Anticipación).
  - Anticipación: mediana de días, % planeadas con 7 días o más (A5) y % del mismo día. Lo reportado sin cita es "no
    planeado": entra en los porcentajes y no en la mediana.
  - **Por línea** (dueño, 2026-10-31): cuántas hechas impulsaron cada línea de la persona, en la fila y en el detalle
    ("99 Trauma · 1 Sustitutos óseos"). Una visita con dos líneas cuenta en las dos; la suma por línea puede superar
    las hechas, y se dice.
  - Médicos distintos y Ciudades distintas (municipios de las presenciales hechas). Para el equipo, los distintos de
    todos, sin sumar personas.
  - Días hábiles sin visitas: con el calendario de la ciudad de la Zona para un Ejecutivo Comercial; para una líder sin
    Ejecutivo, solo con los festivos nacionales y los días de empresa (no tiene ciudad ni días libres). (Decisión de
    Claude.)
  - Solo para los Ejecutivos Comerciales y **solo cuando el periodo es un mes calendario completo**: cuota del mes y
    cumplimiento (la misma cuenta de `/api/me/numeros`). En semana, 15 días o rango libre la columna no se muestra.
    (Decisión de Claude: la cuota se calcula por mes.)
- **Quien ya no está**: Rendimiento parte de las visitas y citas del periodo, no de los activos de hoy. Una persona que
  reportó en el periodo y hoy está inactiva o fue traspasada sale en su fila marcada "ya no está" y suma a las
  tarjetas del equipo. Hoy solo muestra a los activos. (Decisión de Claude: los totales de un mes tienen que ser
  verdad.)
- Tocar la fila abre el detalle de la persona en ese periodo, con las mismas cifras y la lista de sus visitas y citas.
- Las eliminadas por error no aparecen en ninguna parte (A7).

**Reglas de las cifras** (todas en `web/lib/equipo.ts`, puras y probadas):
- Anticipación = fecha de la cita − fecha en Bogotá de su `created_at`; una "otra fecha" mide desde su propio
  `created_at`.
- Hechas = visitas no anuladas de la app en el periodo, de la persona (`visits.user_id`), con `visit_date` en el rango.
- El papel de cada visita o cita viene de `executive_id` (con él: como Ejecutivo Comercial; sin él: como líder), lo
  que permite mostrar a Paola solo como Ejecutiva a quien no es su supervisora de líder.
- Las visitas de VMO (`source = 'vmo_import'`) **no** entran en Equipo: son del mapa de calor y no tienen hora de
  reporte, médico ni plan. (Decisión de Claude, por lo que dijo el dueño: VMO es transitorio para el mapa de calor. Si
  el dueño prefiere verlas como "último lugar conocido" mientras los Ejecutivos se pasan a la app, se añade después.)

**Sin señal:** Equipo lee en vivo. Sin red, muestra lo último que cargó con "Visto hace N min" y no deja elegir otro
día; nada va a la cola. No se guarda en IndexedDB más que la última respuesta de cada pantalla (`almacen`).

**API** (solo lectura, `requirePermission('team:view')` + `personasVisibles`, cookie o token de portador como
`/api/me/*`, `supabase-admin` con `no-store`, sin Google):
- `GET /api/equipo/personas` → las personas visibles (id de usuario, nombre, papel, líneas, Ejecutivo Comercial y Zona si
  lo tiene).
- `GET /api/equipo/hoy?fecha=` → por persona: `dondeEsta`, y el resumen por ciudad.
- `GET /api/equipo/persona/[userId]?fecha=` → rastro del día y "Siguiente".
- `GET /api/equipo/rendimiento?desde&hasta&linea&papel` → tarjetas del equipo y filas por persona.
- `GET /api/equipo/persona/[userId]/rendimiento?desde&hasta` → detalle.
- Una persona fuera de `personasVisibles` → 404 (no 403, para no confirmar que existe).

## Criterios de aceptación (se convierten en pruebas)

Entrega 1:
- [ ] `appSoloLideres` ya no existe; `lineasDeLaApp` y `comoDeLaApp` dejan pasar las líneas y el `como` de Ejecutivo
      (`scripts/persona-campo-check.ts`, sección 7 reescrita).
- [ ] `GET /api/auth/me` de un Ejecutivo Comercial activo trae `persona` con rol `ejecutivo`; de Paola, `lider_y_ejecutivo`
      (`scripts/reporte-api-check.ts`, sección 16 reescrita).
- [ ] `GET /api/me/cuota` y `/api/me/dias-libres` responden 200 con token de portador (`reporte-api-check.ts`).
- [ ] El menú del rol del Ejecutivo Comercial (`sales_manager`) empieza con "Agendamiento" y `sesion-app` le da token
      (`scripts/menu-check.ts`, `scripts/campo-web-check.ts`).
- [ ] En la app, `estadoPersona` de un Ejecutivo con persona → `campo` y Agendar ofrece "Como Ejecutivo Comercial" a
      Paola (`mobile/scripts/checks/21-persona.ts`).

Entrega 2:
- [ ] `personasVisibles`: dirección y administrador ven a todos; una líder, a sí misma y a los Ejecutivos activos de
      sus líneas; a Paola solo como Ejecutiva para la líder de Sustitutos; vacantes e inactivos no salen; un Ejecutivo
      Comercial no ve a nadie (`scripts/equipo-check.ts`).
- [ ] `dondeEsta` toma el primer caso en el orden de arriba; una telefónica no ubica; pasadas 3 h cambia el texto
      (`equipo-check.ts`).
- [ ] Rendimiento: cumplimiento del plan con la cadena "otra fecha" contada una vez por su última cita, y una última
      cita futura fuera del denominador; anticipación con mediana y porcentajes; médicos y ciudades distintos sin sumar
      personas; hechas por línea con la visita de dos líneas contada en las dos; quien ya no está sale marcado;
      cuota solo en mes completo; eliminadas fuera (`equipo-check.ts`).
- [ ] Las marcas de la visita salen como palabras y nunca `distance_m`, `gps_accuracy_m` ni `lat/lng` del teléfono
      (`equipo-api-check.ts`).
- [ ] Las visitas de VMO no entran en ninguna cifra (`equipo-check.ts`).
- [ ] `/api/equipo/*`: 403 sin `team:view`; una persona no visible → 404; nunca salen `transcript`, `gps_accuracy_m`,
      el documento del médico ni las coordenadas del teléfono (`scripts/equipo-api-check.ts`, con Supabase falso).
- [ ] `/api/auth/me` trae `supervisa` según `team:view`; `sesion-app` da token a todo rol con `campo:app` o
      `team:view`, y sigue dando 401 sin cookie y 403 desde otro origen (`reporte-api-check.ts`, `campo-web-check.ts`).
- [ ] El menú de admin, dirección y líder lleva "Equipo" → `/campo/equipo`; el del Ejecutivo Comercial no
      (`menu-check.ts`).
- [ ] En la app: la dirección y el administrador entran a Equipo y Ajustes; la líder tiene "Mi equipo" en Hoy y en
      Ajustes; sin persona ni `supervisa` sigue el aviso (`mobile/scripts/checks/21-persona.ts` y `15-navegacion.ts`).
- [ ] Captura en el celular de Equipo › Hoy y Rendimiento con datos falsos, en claro y en oscuro.

## Fuera de alcance

- Correrías, congresos, cenas y capacitaciones (F2 de la spec de actividades de campo): no existen aún; Rendimiento no
  las cuenta.
- El mapa de calor del equipo (A3), el Excel descargable y la cuadrícula "Próximas semanas": tercera entrega.
- Apagar el importador de VMO y `/visits`: lo decide el dueño cuando el equipo esté en la app.
- Cambiar el mapa de asignación o su estética.
- Notificaciones o seguimiento de ubicación en vivo (C5: nunca).

## Impacto

- Datos / migración: **no**. Todo sale de `visits`, `visit_lines`, `visitas_agenda`, `executives`, `executive_lines`,
  `business_lines`, `users`, `sedes`, `medicos`, `cuentas`, `municipalities`, `dias_libres` y `calendario`.
- Costo Google Maps: 0.
- Estética del mapa: no cambia.
- Permisos / roles:
  - nuevo `team:view` para `admin`, `commercial_director` y `line_leader`;
  - `campo:app` también para `sales_manager` (el rol del Ejecutivo Comercial);
  - `sesion-app` acepta `campo:app` o `team:view` (una sola app, un solo ingreso: dueño, 2026-10-31);
  - `web/docs/ROLES_AND_PERMISSIONS.md` se actualiza.
- Privacidad: Equipo nunca devuelve transcripciones, fotos, documentos de médicos ni la precisión o el punto del
  teléfono; solo sede y municipio.
- Rendimiento del servidor: `hoy` lee un día y `rendimiento` hasta 93 días de las personas visibles, con
  `fetchAllRows` por trozos de 100 ids; a la escala actual (unas 15 personas) son pocas filas.

## Plan (archivos e interfaces)

Entrega 1 (`feat/ejecutivos-de-vuelta-a-la-app`):
- `web/lib/persona-campo.ts`: quitar `appSoloLideres`; `lineasDeLaApp` y `comoDeLaApp` sin la regla (o quitarlas y
  usar las líneas tal cual).
- `web/app/api/auth/me/route.ts`, `web/app/api/me/agenda/route.ts`, `.../otra-fecha/route.ts`,
  `web/app/api/me/cuota/route.ts`, `web/app/api/me/dias-libres*`: sin el bloqueo por portador.
- `web/lib/permissions.ts`: `campo:app` a `sales_manager`.
- `mobile/lib/persona.ts`, `mobile/app/(app)/_layout.tsx`: el texto de "fuera" ya no habla de VMO.
- Pruebas: `persona-campo-check.ts`, `reporte-api-check.ts`, `menu-check.ts`, `campo-web-check.ts`, `21-persona.ts`.
- Docs: decisión nueva, nota en la del 2026-10-30, `CLAUDE.md` (la regla "La app de campo es SOLO para las líderes").

Entrega 2 (`feat/equipo-en-la-app`):
- `web/lib/equipo.ts` (puro): `personasVisibles`, `dondeEsta`, `rastroDelDia`, `anticipacion`, `rendimiento`,
  `cadenaOtraFecha`.
- `web/app/api/equipo/_lib/equipo-server.ts`: lecturas; reutiliza `leerVisitas`, `leerCitas`, `armarVisitaItems`,
  `armarCitaItems`, `calcularCuota`, `ejecutivasDeMisLineas` y `leerCalendario`.
- `web/app/api/equipo/{personas,hoy,rendimiento}/route.ts`, `web/app/api/equipo/persona/[id]/{route,rendimiento}.ts`.
- `web/lib/permissions.ts` (`team:view`, menú "Equipo"), `web/app/api/auth/me/route.ts` (`supervisa`),
  `web/app/api/auth/sesion-app/route.ts`.
- `web/lib/reporte-visitas.ts` y `mobile/lib/tipos.ts`: tipos de Equipo (copia, como siempre).
- `mobile/lib/navegacion.ts` (pestañas según `supervisa` y persona), `mobile/lib/persona.ts` (`estadoPersona` con
  'supervisa'), `mobile/app/(app)/equipo.tsx`, `equipo/persona/[id].tsx`, `equipo/rendimiento.tsx`, tarjeta "Mi equipo"
  en `hoy.tsx` y enlace en `ajustes.tsx`; `mobile/lib/equipo.ts` (puro: textos de `dondeEsta`, "hace N min", orden).
- Pruebas: `web/scripts/equipo-check.ts`, `equipo-api-check.ts`, `menu-check.ts`, `reporte-api-check.ts`,
  `campo-web-check.ts`; `mobile/scripts/checks/26-equipo.ts`, `15-navegacion.ts`, `21-persona.ts`.
- Docs: `docs/decisiones/2026-10-31-equipo-en-la-app.md` (incluye "una sola app, un solo ingreso" y "cada líder ve
  todo el Ejecutivo y cuánto por línea"), `docs/fases/fase8-...` (sección F4), `CLAUDE.md`,
  `web/docs/ROLES_AND_PERMISSIONS.md`.

## Verificación final

- `npm run check` en `web/` y en `mobile/`, salida adjunta en cada PR.
- Entrega 1: captura de la app con un Ejecutivo Comercial (datos falsos) agendando, y del menú con "Agendamiento".
- Entrega 2: capturas en el celular de Equipo › Hoy, el día de una persona y Rendimiento, como dirección y como líder.
