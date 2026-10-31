# Plan: los Ejecutivos Comerciales vuelven a la app  (2026-10-31, Entrega 1)

> **Para quien ejecute el plan:** usar la skill `executing-plans` (o `subagent-driven-development`) tarea por tarea.
> Los pasos llevan casillas (`- [ ]`). Primero la prueba que falla, después el código, después `npm run check`.

**Objetivo:** que un Ejecutivo Comercial activo con usuario vuelva a agendar, reportar y ver su cuota y sus días libres en
la app de campo, y que Paola recupere sus dos papeles; la regla "app solo para líderes" del 2026-10-30 desaparece del
código y de los documentos.

**Arquitectura:** la regla vive hoy en tres funciones puras de `web/lib/persona-campo.ts` (`appSoloLideres`,
`lineasDeLaApp`, `comoDeLaApp`) que el servidor consulta en cuatro sitios; se quitan y el servidor vuelve a lo que ya
hacía antes del 2026-10-30 (la base decide con `persona_de_campo` y `agenda_crear`). La app no tiene la regla: solo
muestra el porqué que manda el servidor; cambian textos. Permiso `campo:app` también para el rol del Ejecutivo
Comercial (`sales_manager`), para "Agendamiento" en el menú y el ingreso único.

**Tecnología:** Next.js 14 (`web/`), Expo (`mobile/`), pruebas puras con `tsx` (`web/scripts/*-check.ts`,
`mobile/scripts/checks/*.ts`).

**Spec:** `docs/specs/2026-10-31-equipo-en-la-app-y-ejecutivos-de-vuelta.md` (sección "Entrega 1").

## Restricciones globales

- Rama `feat/ejecutivos-de-vuelta-a-la-app` desde `master`; PR con `/entregar`; nunca commits a `master`.
- Sin migración, sin Google, sin tocar el mapa ni su estética.
- Terminología visible: "Ejecutivo Comercial", "Zona", "IPS"; nunca "KAM".
- Los mensajes del servidor que la app repite tienen que ser el MISMO texto en `web/lib/persona-campo.ts` y en
  `mobile/lib/persona.ts` (las pruebas de la app leen el archivo de la web).
- `npm run check` en verde en `web/` y en `mobile/` antes de dar por terminado; mostrar la salida.
- Commits en español con prefijo convencional y el porqué en el cuerpo.

## Puntos de revisión (lo que la spec implica y ninguna prueba cubría)

1. **Un Ejecutivo Comercial sin Zona base** entra a la app (persona con rol `ejecutivo`) pero al reportar recibe
   "Tu Ejecutivo Comercial no tiene zona base": era así antes del 2026-10-30 y sigue (prueba en la Tarea 2).
2. **Paola con una línea que lidera y que también es de su Ejecutivo Comercial** (el "cruce"): ya no se la deja
   fuera; la persona trae la línea en `ec` y en `lider`, y `ejecutivo_de_la_visita` la hace de Ejecutiva (prueba en la
   Tarea 2, reemplaza la del cruce).
3. **Un administrador sin líneas** sigue fuera con "Tu usuario no tiene líneas para reportar" hasta la Entrega 2
   (prueba en la Tarea 2 y en la Tarea 4).
4. **La dirección comercial** sigue con `persona: null` y `sin_persona: null`, y la app la reconoce por su rol
   (prueba existente en la Tarea 2; la Entrega 2 lo cambia).
5. **La cookie de la web de un Ejecutivo Comercial** ahora da token en `sesion-app`; la del administrador sigue sin
   darlo en esta entrega (prueba en la Tarea 3).

---

### Tarea 1: quitar la regla del servidor

**Archivos:**
- Modificar: `web/lib/persona-campo.ts` (quitar `MENSAJE_EJECUTIVO_EN_VMO`, `appSoloLideres`, `lineasDeLaApp`,
  `comoDeLaApp` y sus comentarios).
- Modificar: `web/app/api/config-visitas/_lib/visitas-server.ts` (`requireEjecutiva` líneas 394-409; `personaDeCampo`
  líneas 437-487; los imports de las líneas 11 y 20-23).
- Modificar: `web/app/api/me/agenda/route.ts:23,70-71` y `web/app/api/me/agenda/[id]/otra-fecha/route.ts:16,39-40`.
- Modificar: `web/lib/auth-server.ts:66-72` (solo el comentario de `sesionDeLaApp`; la función se queda: la usa
  `mobile/lib/api.ts` como contrato de "la app sigue siendo la app").
- Modificar: `web/app/api/auth/me/route.ts:1-7` (comentario) y `web/lib/reporte-visitas.ts:1905-1912` (comentario de
  `sin_persona`).
- Prueba: `web/scripts/persona-campo-check.ts` (sección 7, líneas 212-235).

**Interfaces:**
- Consume: `lineasParaReportar`, `rolDePersona`, `personaDeCampo` (puras, sin cambio).
- Produce: `personaDeCampo(user)` del servidor vuelve a dar `executiveId`, `ejecutiva` y `lineasEc` a quien tiene
  Ejecutivo Comercial activo, y `rol: 'lider_y_ejecutivo'` a Paola. `POST /api/me/agenda` y `…/otra-fecha` pasan a la
  base `como: datos.como ?? null`.

- [ ] **Paso 1: reescribir la sección 7 de `persona-campo-check.ts`** como "7. Los Ejecutivos Comerciales usan la app
  (dueño, 2026-10-31: reemplaza la regla del 2026-10-30)". Quitar las pruebas de `appSoloLideres`, `lineasDeLaApp` y
  `comoDeLaApp` y sus imports, y dejar estas dos:

```ts
const fuente = readFileSync(path.join(__dirname, '..', 'lib', 'persona-campo.ts'), 'utf8')
check('la regla "app solo para líderes" ya no existe en el código (ni APP_CAMPO_EJECUTIVOS ni MENSAJE_EJECUTIVO_EN_VMO)',
  !fuente.includes('APP_CAMPO_EJECUTIVOS') && !fuente.includes('MENSAJE_EJECUTIVO_EN_VMO') && !fuente.includes('appSoloLideres'))
check('Paola (los dos papeles) conserva sus dos listas: ec y lider, también con una línea en las dos (el "cruce")',
  igual(lineasParaReportar({ usuario: PAOLA_USUARIO, ejecutiva: PAOLA_EJECUTIVA, lineasEjecutiva: [ORTOPEDIA, TRAUMA], lineas: LINEAS }), { ec: [ORTOPEDIA, TRAUMA].sort(), lider: [TRAUMA], todas: [ORTOPEDIA, TRAUMA].sort() }))
```
  (usar los datos de la sección "Datos" del mismo archivo, líneas 68-98, con sus nombres reales; `readFileSync` y `path`
  ya se usan en otros checks de `web/scripts`).

- [ ] **Paso 2: correr la prueba y ver que falla** por los imports que todavía existen y la fuente que aún trae la
  regla: `cd web && npx tsx scripts/persona-campo-check.ts` → falla la primera `check` nueva.

- [ ] **Paso 3: quitar la regla en `persona-campo.ts`**: borrar `MENSAJE_EJECUTIVO_EN_VMO`, `appSoloLideres`,
  `lineasDeLaApp`, `comoDeLaApp` y el párrafo del encabezado que habla de la app solo para líderes.

- [ ] **Paso 4: `visitas-server.ts`**:
  - `requireEjecutiva`: quitar la línea `if (appSoloLideres(process.env) && sesionDeLaApp(request)) …` y el import de
    `sesionDeLaApp`; el comentario queda: "exige visits:report y que el usuario esté enlazado con un Ejecutivo Comercial".
  - `personaDeCampo`: sin `soloLideres` ni `lineasDeLaApp`; `const { ec, lider, todas } = lineasParaReportar({ … })`;
    `const ejecutiva = fila ? (await armarPersonas([fila]))[0] : null`. Comentario sin la frase del 2026-10-30.
- [ ] **Paso 5: las dos rutas de agenda**: `const como = datos.como ?? null` (la base decide, C12) y quitar los imports.
  Revisar que el `jsonError` con `errores: [{ campo: 'como' }]` que seguía al 403 desaparece con él.
- [ ] **Paso 6: comentarios** de `auth-server.ts`, `auth/me/route.ts` y `reporte-visitas.ts`: `sin_persona` explica
  "MENSAJE_SIN_LINEAS (sin líneas); null con persona o para la dirección comercial".
- [ ] **Paso 7: `cd web && npm run typecheck && npx tsx scripts/persona-campo-check.ts`** → sin errores de tipos y
  "N pruebas bien, 0 con falla". (`reporte-api-check` todavía falla: lo arregla la Tarea 2.)
- [ ] **Paso 8: commit** `feat(campo): el servidor deja entrar otra vez a los Ejecutivos Comerciales` con el porqué
  (dueño, 2026-10-31: "vamos a hacer la solución completa"; VMO transitorio).

### Tarea 2: las pruebas de la API dicen lo nuevo

**Archivos:**
- Modificar: `web/scripts/reporte-api-check.ts` (línea 129 import; línea 324 `process.env.APP_CAMPO_EJECUTIVOS`;
  sección 16, líneas 3451-3592).
- Modificar: `web/scripts/visits-api-check.ts:86-89` (quitar el comentario y la variable).

**Interfaces:** consume la Tarea 1. No produce nada nuevo.

- [ ] **Paso 1: reescribir la sección 16** como "16. Los Ejecutivos Comerciales usan la app (dueño, 2026-10-31)", con
  los mismos usuarios y helpers que ya usa (Ana = solo Ejecutiva, Paola = líder de trauma y Ejecutiva de ortopedia,
  Lucía = solo líder, el admin sin líneas y la directora). Afirmaciones:
  - Ana: `GET /api/auth/me` → `persona.rol === 'ejecutivo'`, `persona.lineas` = sus `executive_lines` con
    `como: 'ejecutivo'`, `sin_persona === null`, `ejecutiva.id === EJEC_A`.
  - Ana: contexto 200; reportar 201; agendar 201 con `cita.como === 'ejecutivo'`.
  - Paola: `persona.rol === 'lider_y_ejecutivo'`, trauma `como: 'lider'` y ortopedia `como: 'ejecutivo'`.
  - Paola: agendar con `como: 'ejecutivo'` → 201 y `rpc.args.p.como === 'ejecutivo'`; sin `como` → la base recibe
    `como: null`; otra fecha con `como: 'ejecutivo'` → 201.
  - Cuota y días libres con token de portador (Ana) → 200; con cookie → 200.
  - El "cruce" (trauma también en el Ejecutivo de Paola): `persona.rol === 'lider_y_ejecutivo'` y trauma aparece con
    `como: 'ejecutivo'` (`comoDeLinea` la da como Ejecutiva porque está en `lineasEc`).
  - Sin cambio: Lucía `rol 'lider'`; admin sin líneas → `persona null` y `sin_persona === MENSAJE_SIN_LINEAS`;
    directora → `persona null`, `sin_persona null`; un Ejecutivo sin Zona base → `me` da persona y reportar → 400/403
    con `MENSAJE_SIN_ZONA` (el que ya devuelva hoy el camino de `validarVisita`).
- [ ] **Paso 2: quitar** `process.env.APP_CAMPO_EJECUTIVOS` de las líneas 324 y 3592, el `delete` de la 3452 y el
  import de `MENSAJE_EJECUTIVO_EN_VMO` (129). En `visits-api-check.ts` quitar las líneas 86-89.
- [ ] **Paso 3: correr** `cd web && npx tsx scripts/reporte-api-check.ts && npx tsx scripts/visits-api-check.ts` →
  "0 con falla" en los dos.
- [ ] **Paso 4: commit** `test(campo): la API prueba que los Ejecutivos Comerciales vuelven a la app`.

### Tarea 3: permiso `campo:app` para el Ejecutivo Comercial, menú e ingreso único

**Archivos:**
- Modificar: `web/lib/permissions.ts` (lista de `sales_manager`, líneas 126-140: añadir `'campo:app'` con el comentario
  "2026-10-31: Agendamiento en el menú; los Ejecutivos Comerciales vuelven a la app"; el comentario del permiso en la
  línea 73).
- Modificar: `web/docs/ROLES_AND_PERMISSIONS.md:190-191`.
- Prueba: `web/scripts/menu-check.ts:86,101-109`; `web/scripts/reporte-check.ts:1454,1630-1631`.

**Interfaces:** produce `rolePermissions.sales_manager` con `campo:app`; `getNavigationMenu('sales_manager')[0]` =
`{ name: 'Agendamiento', href: '/campo/agenda', icon: 'calendar' }`.

- [ ] **Paso 1: pruebas**:
  - `menu-check.ts`: `ESPERADO.sales_manager` empieza con `'/campo/agenda'`; la lista de roles con `/campo` es
    `['sales_manager', 'line_leader']` (en el orden de `ROLES`); `campo:app` está en `sales_manager` y `line_leader`;
    comentario "Los Ejecutivos Comerciales vuelven a la app (2026-10-31)".
  - `reporte-check.ts:1630`: `deEjecutivo.status === 200` con `token` igual al de su cookie y `usuario.role ===
    'sales_manager'`; `deAdmin.status === 403` sigue (hasta la Entrega 2).
- [ ] **Paso 2: correr** `cd web && npx tsx scripts/menu-check.ts; npx tsx scripts/reporte-check.ts` → fallan las nuevas.
- [ ] **Paso 3: `permissions.ts`** y el documento de roles (`campo:app`: "Usar la app de campo: líderes y Ejecutivos
  Comerciales (2026-10-31); 'Agendamiento' abre su agenda…").
- [ ] **Paso 4: correr** las dos pruebas → "0 con falla".
- [ ] **Paso 5: commit** `feat(menu): "Agendamiento" y el ingreso único también para los Ejecutivos Comerciales`.

### Tarea 4: la app deja de decir que es solo para las líderes

**Archivos:**
- Modificar: `mobile/lib/persona.ts:1-36,79-83` (encabezado, `AYUDA_SIN_LINEAS`, `TEXTO_APP_DE_LIDERES`).
- Modificar comentarios: `mobile/lib/sesion.ts:44-49`, `mobile/lib/tipos.ts:110-113`, `mobile/lib/api.ts:95-99`,
  `mobile/app/(app)/_layout.tsx:16-20`, `mobile/app/(app)/hoy.tsx:251`.
- Prueba: `mobile/scripts/checks/21-persona.ts:214-233,320-324`.

**Interfaces:** produce `TEXTO_PARA_QUIEN_ES_LA_APP` (reemplaza `TEXTO_APP_DE_LIDERES`) =
`'La app es para las líderes de negocio y los Ejecutivos Comerciales: agendan y reportan en campo.'` y
`AYUDA_SIN_LINEAS` = `'Pide a quien administra OpMap que te asigne tu línea o tu Zona.'`. `estadoPersona`,
`entraALasPestanas` y `avisoFuera` no cambian de firma; `MENSAJE_DIRECCION_EN_LA_WEB` se queda (lo cambia la Entrega 2).

- [ ] **Paso 1: pruebas en `21-persona.ts`**: la constante `EN_VMO` desaparece; los casos de 'fuera' usan
  `MENSAJE_SIN_LINEAS` (admin sin líneas) y el de `sales_manager` pasa a: `estadoPersona({ role: 'sales_manager',
  persona: ANA })` === `'campo'` (definir `ANA` como `PersonaMovil` con `rol: 'ejecutivo'` si no existe en el archivo);
  `avisoFuera` con `TEXTO_PARA_QUIEN_ES_LA_APP`; quitar la `check` de la línea 320-324 (el texto de VMO) y añadir
  `check('la app no menciona VMO ni "solo para las líderes"', !persona.includes('VMO') && !persona.includes('solo para'))`
  leyendo `mobile/lib/persona.ts`.
- [ ] **Paso 2: correr** `cd mobile && npx tsx scripts/movil-check.ts` → fallan las nuevas de la sección 21.
- [ ] **Paso 3: textos y comentarios** en los archivos de arriba.
- [ ] **Paso 4: `cd mobile && npm run check`** → tsc limpio y "0 con falla".
- [ ] **Paso 5: commit** `fix(app): la app vuelve a ser de las líderes y los Ejecutivos Comerciales (textos)`.

### Tarea 5: documentos y decisión

**Archivos:**
- Crear: `docs/decisiones/2026-10-31-ejecutivos-comerciales-vuelven-a-la-app.md` (plantilla `docs/decisiones/TEMPLATE.md`).
- Modificar: `docs/decisiones/2026-10-30-app-de-campo-solo-lideres.md` (una línea al principio: "**Reemplazada el
  2026-10-31** por `2026-10-31-ejecutivos-comerciales-vuelven-a-la-app.md`"; el resto queda como histórico).
- Modificar: `CLAUDE.md:118-123` (la regla pasa a: "**Los Ejecutivos Comerciales también usan la app** (dueño,
  2026-10-31, …): agendan, reportan, cuota y días libres; Paola con sus dos papeles; VMO sigue en `/visits` solo para
  el mapa de calor, transitorio, hasta que el dueño lo apague. La regla del 2026-10-30 queda reemplazada.").
- Modificar: `web/VERCEL_ENV_VARS.md:48-52` (quitar el punto 7).
- Modificar: `docs/fases/fase8-visitas-f3-f4-reporte-y-app-movil.md:851-862` (el bloque "App solo para las líderes"
  pasa a dos líneas: regla reemplazada el 2026-10-31; la tabla de abajo vuelve a valer tal cual).
- Modificar: `docs/specs/2026-10-31-equipo-en-la-app-y-ejecutivos-de-vuelta.md` (Estado: "Entrega 1 implementada
  (PR #…)" al abrir el PR).

- [ ] **Paso 1: la decisión**, con el contexto literal del dueño (la spec lo trae), la decisión (los Ejecutivos vuelven;
  VMO transitorio; sin la llave `APP_CAMPO_EJECUTIVOS`), consecuencias (todo lo de arriba; lo que sigue cerrado: la
  dirección no reporta; el admin sin líneas no entra hasta Equipo) y dónde vive (archivos y pruebas de las Tareas 1-4).
- [ ] **Paso 2: los demás documentos.**
- [ ] **Paso 3: commit** `docs: los Ejecutivos Comerciales vuelven a la app (decisión del 2026-10-31)`.

### Tarea 6: verificación de punta a punta y entrega

- [ ] **Paso 1:** `cd web && npm run check` y `cd mobile && npm run check` → las dos salidas en verde, pegadas en el PR.
- [ ] **Paso 2:** `grep -rn "APP_CAMPO_EJECUTIVOS\|MENSAJE_EJECUTIVO_EN_VMO\|appSoloLideres" web mobile docs CLAUDE.md
  --include=*.ts --include=*.tsx --include=*.md | grep -v node_modules` → solo la decisión del 2026-10-30 (histórico) y
  la spec/decisión nuevas que la nombran como reemplazada.
- [ ] **Paso 3: captura.** Con `npm run dev` en `web/` y la app web en `/campo` (o `npx expo start --web`), entrar con
  un usuario `sales_manager` de prueba del Supabase local si lo hay; si no hay base local, captura de las pruebas en
  verde y nota en el PR de que la captura con datos reales la toma el dueño en el preview de Vercel.
- [ ] **Paso 4:** subagente `revisor` sobre el diff y la spec; corregir solo lo que afecte corrección o reglas.
- [ ] **Paso 5:** `/entregar` (commit + push + PR a `master` con la plantilla). No se mezcla localmente.
