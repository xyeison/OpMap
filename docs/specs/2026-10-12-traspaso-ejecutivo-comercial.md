# Spec: traspaso de lo de un Ejecutivo Comercial a otra persona  (2026-10-12)

**Estado**: implementada (PR pendiente). Aprobada por el dueño en su pedido ("una solución para que todo eso pase
fácilmente a uno nuevo"; decisión en `docs/decisiones/2026-10-12-traspaso-de-ejecutivas.md`). Las decisiones menores
las tomó Claude y están en "Decisiones de implementación" y, las que surgieron al implementar, en "Estado" al final.
La migración 0820 está escrita y probada con prueba real deshecha, **sin aplicar**.

## Problema

Cuando una Ejecutiva Comercial se va o le quitan una línea, lo suyo queda colgado: la cobertura sigue
dándole zonas hasta que alguien pulse "Recalcular", el anexo de territorio se arma con esa cobertura vieja, sus
ajustes manuales quedan "sin efecto", sus médicos siguen con ella como visitante (solo con el aviso "Revisar") y
pasarlo a otra persona exige ir zona por zona y médico por médico en tres pantallas. El dueño: "si alguien se va
o se le quita, pues ya no está; lo que toca más bien es una solución para que todo eso pase fácilmente a uno
nuevo".

## Resultado esperado

- En **Ejecutivos Comerciales**, quien administra el equipo pulsa **"Traspasar"** (o **"Dar de baja"**, que
  abre lo mismo) en una persona, elige qué pasa (se va, o se le quitan unas líneas), elige quién recibe (otra
  persona, una persona nueva o una vacante; al quitar una línea también "nadie"), ve una **vista previa** con todo
  lo que se va a mover y confirma **una vez**. Todo queda pasado: líneas, zona (si recibe una persona nueva o una
  vacante), ajustes manuales de cobertura, nombre del territorio, médicos (visitantes) y la cobertura
  recalculada. Opcionalmente se guarda la versión final del anexo de quien entrega.
- En una **vacante**, el botón **"Contratar"** la convierte en la persona contratada (nombre, email, fecha de
  ingreso) conservando todo lo que la vacante tenía.
- Si alguien da de baja a una persona o le quita una línea por otro camino, sus visitantes de esa línea **se
  terminan solos** y la cobertura se recalcula: "ya no está".
- Queda un **historial de traspasos** (quién entregó, quién recibió, qué líneas, cuándo, quién lo hizo y el
  resumen de lo que se movió).

## Decisiones de implementación (Claude; el dueño puede cambiarlas)

1. **Fecha del traspaso**: por defecto hoy; se puede poner hasta 90 días atrás (para registrar una salida que
   ya pasó); no se programan traspasos futuros. Quien entrega deja de tener lo traspasado el día anterior a esa
   fecha y quien recibe lo tiene desde esa fecha. Al darse de baja, `left_at` = día anterior a la fecha.
2. **Al darse de baja se traspasan todas sus líneas** y hay que elegir quién recibe: otra persona, una persona
   nueva o una vacante (por defecto, una vacante en su zona). "Nadie" solo existe al quitar una línea a alguien
   que se queda; con baja no, para que no se pierda nada.
3. **Persona nueva o vacante** heredan la zona base de quien entrega y las líneas traspasadas. **Persona que ya
   existe** conserva su zona y suma las líneas; la cobertura recalculada decide sus zonas (si vive en otra ciudad,
   puede quedar con alcance o con conflicto; la vista previa lo avisa).
4. **Médicos**: cada asignación abierta de quien entrega en esas líneas se termina y se crea la misma (médico,
   línea, ciudad) para quien recibe, desde la fecha del traspaso. Si quien recibe ya visita a ese médico por esa
   línea y ciudad, no se duplica. Si el médico está inactivo, solo se termina. Con "nadie", solo se terminan.
5. **Ajustes manuales de cobertura** activos de quien entrega en esas líneas pasan a quien recibe (el de quien
   entrega se desactiva y se crea el mismo para quien recibe); con "nadie", solo se desactivan. Luego se
   recalcula la cobertura (global, sin Google Maps).
6. **Nombre del territorio** de esa línea se copia a quien recibe si no tiene uno.
7. **Versión final del anexo** de quien entrega, por línea: casilla marcada por defecto cuando tiene territorio en
   esa línea (etiqueta "Final AAAA-MM-DD (traspaso)"). El anexo de quien recibe se firma después, como siempre.
8. **Excepciones personales** (metas propias, perfil, telefónica, radio) **no se copian** por defecto: casilla
   "Copiar sus excepciones" desmarcada. Si se marca, se registran para quien recibe desde la fecha del traspaso.
9. **Usuario de OpMap** de quien se va: casilla "Desactivar su usuario" marcada por defecto (deja de entrar). Solo
   desactiva un usuario activo de Ejecutivo Comercial (rol `sales_manager` o `user`) y nunca el de quien hace el
   traspaso; cualquier otro rol se maneja en Usuarios (ver decisión extra 12).
10. **Días libres y visitas** no se traspasan (son de la persona).
11. **Quién puede**: permiso nuevo `executives:transfer` para admin y commercial_director (son los únicos que
    tienen a la vez equipo, cobertura y visitantes).
12. **Dar de baja** y quitar líneas desde el formulario de edición siguen funcionando, pero la interfaz los manda
    al traspaso; si llegan por la API vieja, los disparadores terminan los visitantes y la ruta recalcula la
    cobertura.

## Criterios de aceptación (se convierten en pruebas)

- [x] Dado A con 2 líneas, 3 zonas, 1 ajuste manual, nombre de territorio y 5 médicos, cuando se traspasa por
      baja a una persona nueva, entonces la nueva queda con la zona base de A, sus 2 líneas, el ajuste manual, el
      nombre del territorio y los 5 médicos desde la fecha; A queda inactiva con `left_at` = fecha − 1, sin
      líneas, con sus asignaciones terminadas en fecha − 1 y su usuario desactivado; la cobertura recalculada da a
      la nueva las zonas que tenía A.
- [x] Dado A que se queda y pierde la línea Columna hacia B (que ya existe en otra ciudad), entonces B suma
      Columna, recibe los médicos de A en Columna y sus ajustes; A conserva sus otras líneas y sus médicos de
      esas líneas.
- [x] Dado B que ya visita a un médico de A por la misma línea y ciudad, entonces no se duplica y sale en
      "omitidos" con la razón.
- [x] Dado "nadie" al quitar una línea, entonces los médicos de esa línea quedan sin visitante (terminados) y
      los ajustes se desactivan; con baja, "nadie" se rechaza (400).
- [x] Dado una vacante con todo lo de A, cuando se pulsa "Contratar" con nombre y email, entonces la misma
      fila queda activa con esos datos y `started_at`, y conserva líneas, zona, médicos y ajustes; se enlaza al
      usuario con ese email si existe.
- [x] Dado que alguien da de baja a A por la API vieja (o le quita una línea), entonces sus visitantes de esas
      líneas quedan terminados y la cobertura se recalcula.
- [x] Dado un traspaso, entonces queda en el historial con su resumen; el historial no se edita ni se borra.
- [x] Dado un error a mitad del traspaso (por ejemplo, email repetido para la persona nueva), entonces no queda
      nada a medias (409 y la base igual que antes).
- [x] Dado un usuario sin `executives:transfer` (data_manager, line_leader, viewer), entonces 403.
- [x] La vista previa no escribe nada y cuenta exactamente lo que el traspaso mueve.

## Fuera de alcance

Traspasos programados a futuro; historial de fechas de `executive_lines`; mover visitas o días libres; cambiar
el líder de una línea; firmar automáticamente el anexo de quien recibe; estética del mapa; Google Maps.

## Impacto

- Datos / migración: `database/migrations/2026-10-12_0820_traspaso_ejecutivas.sql` + rollback
  `2026-10-12_9942_traspaso_ejecutivas_rollback.sql`: tabla `ejecutivas_traspasos` (inmutable); columnas
  `medico_visitantes.fin_motivo` ('manual' | 'traspaso' | 'baja' | 'linea_quitada') y
  `medico_visitantes.traspaso_id`; función `ejecutivas_traspasar(p jsonb, p_user uuid) RETURNS jsonb` atómica;
  disparadores `executive_lines` AFTER DELETE y `executives` AFTER UPDATE OF status que terminan visitantes
  abiertos. Se aplica con autorización del dueño en la misma ventana que el despliegue.
- Costo Google Maps: 0 (la cobertura usa distancias guardadas).
- Estética del mapa: no cambia.
- Permisos: nuevo `executives:transfer` (admin, commercial_director).

## Plan (archivos e interfaces)

- **SQL** (0820): `ejecutivas_traspasos` (`id`, `origen_id` → executives, `destino_id` → executives NULL,
  `destino_tipo` 'existente' | 'nueva' | 'vacante' | 'nadie', `lineas uuid[]` no vacío, `fecha date`,
  `dar_de_baja bool`, `desactivar_usuario bool`, `copiar_excepciones bool`, `motivo text NULL`, `resumen jsonb`,
  `created_by` → users, `created_at`), RLS sin políticas, solo service_role, sin UPDATE ni DELETE (disparador).
  `ejecutivas_traspasar(p jsonb, p_user uuid)` con `p` = `{ origen_id, destino: { tipo, id? , full_name?, email? },
  lineas: uuid[] | null (null = todas), fecha, dar_de_baja, desactivar_usuario, copiar_excepciones, motivo }`:
  valida (origen no inactivo; destino distinto, no inactivo; líneas ⊆ las de A; baja ⇒ todas y destino ≠ nadie;
  fecha en [hoy − 90, hoy]; nueva ⇒ nombre 2..120 y email válido y libre o NULL), crea destino si es nueva o
  vacante ("Vacante · <zona>" en estado placeholder, con la zona base de A), suma líneas al destino, traspasa
  ajustes manuales, copia nombres de territorio, traspasa visitantes (`fin_motivo 'traspaso'`, `traspaso_id`),
  copia excepciones si se pide (con `config_registrar`), quita las líneas a A (si baja, todas), baja de A
  (`status 'inactive'`, `left_at`), desactiva su usuario si se pide, guarda el historial y devuelve el resumen
  (`{ traspaso_id, destino_id, lineas, ajustes_movidos, ajustes_desactivados, nombres_copiados,
  visitantes_movidos, visitantes_terminados, omitidos: [{ medico_id, razon }], excepciones_copiadas }`). Bloque DO
  con pruebas que se deshacen; prueba real deshecha antes de aplicar.
- **Código puro** `web/lib/traspaso.ts`: tipos, `planearTraspaso(datos)` (la vista previa: por línea zonas,
  ajustes, médicos a mover, omitidos y avisos de cobertura) y esquemas zod en `web/lib/traspaso-schemas.ts`;
  pruebas `web/scripts/traspaso-check.ts` en `npm run test`.
- **API**: `POST /api/executives/[id]/traspaso/vista-previa` (executives:transfer; no escribe),
  `POST /api/executives/[id]/traspaso` (executives:transfer: guarda las versiones finales de anexo si se pidió,
  llama a la función, recalcula la cobertura y devuelve el resumen; 400/404/409), `POST
  /api/executives/[id]/contratar` (executives:edit; solo placeholder: nombre, email, `started_at`; enlaza usuario
  por email), `GET /api/executives/traspasos` (executives:view: historial). Las rutas PATCH y DELETE de
  executives recalculan la cobertura cuando cambian estado o líneas. `ejecutivosDelUsuario` y los lectores de
  "mi ejecutiva" ignoran a las inactivas. Pruebas de rutas en `web/scripts/traspaso-api-check.ts`.
- **Interfaz** en `/executives`: botón "Traspasar" por persona; "Dar de baja" abre el traspaso con baja; botón
  "Contratar" en las vacantes; asistente de 4 pasos (qué pasa · líneas · quién recibe · fecha y opciones) y vista
  previa con confirmación; resumen al terminar con enlaces a cobertura y anexo; sección "Historial de traspasos".
  Usable en celular. Terminología: "Ejecutivo Comercial", "Zona", "Vacante", nunca "KAM" ni "panel".

## Verificación final

`npm run check` y `next build` en verde; prueba real deshecha de 0820 y de su rollback; capturas del asistente y
de la vista previa en escritorio y celular con la base real (sin confirmar un traspaso real).

## Estado (2026-10-12)

Implementada en la rama `feat/traspaso-ejecutivas`; PR pendiente. Los 10 criterios de aceptación tienen prueba:
puras en `web/scripts/traspaso-check.ts`, de rutas con Supabase falso en `web/scripts/traspaso-api-check.ts` (su
`ejecutivas_traspasar` falsa replica la 0820 paso a paso) y en el bloque DO de la 0820 contra la base real, en una
transacción que se deshace (disparadores, atomicidad con email repetido, historial inmutable como `service_role`).

**Falta (del dueño)**: autorizar y aplicar la 0820 en la misma ventana que el despliegue y luego
`NOTIFY pgrst, 'reload schema';` (hasta entonces el traspaso y el historial responden 503; la vista previa funciona);
revisión del subagente `revisor`; capturas finales con la base migrada; PR.

**Archivos**
- Base de datos: `database/migrations/2026-10-12_0820_traspaso_ejecutivas.sql`,
  `2026-10-12_9942_traspaso_ejecutivas_rollback.sql`, `database/migrations/README.md`, `docs/base-de-datos.md`.
- Lógica pura y permisos: `web/lib/traspaso.ts` (tipos, `planearTraspaso`, `parametroTraspaso`,
  `leerResumenTraspaso`), `web/lib/traspaso-schemas.ts`, `web/lib/permissions.ts`, `web/docs/ROLES_AND_PERMISSIONS.md`.
- API: `web/app/api/executives/[id]/traspaso/route.ts`, `.../traspaso/vista-previa/route.ts`,
  `web/app/api/executives/[id]/contratar/route.ts`, `web/app/api/executives/traspasos/route.ts`,
  `web/app/api/executives/_lib/traspaso-server.ts`, `web/app/api/executives/_lib/executive-shared.ts`
  (`recalcularCobertura`), `web/app/api/executives/[id]/route.ts` (PATCH y DELETE recalculan),
  `web/app/api/terceros/_lib/terceros-server.ts` y `web/app/api/config-visitas/_lib/visitas-server.ts` (ignoran al
  Ejecutivo Comercial inactivo).
- Interfaz: `web/app/executives/page.tsx`, `TraspasoWizard.tsx`, `ContratarDialog.tsx`, `HistorialTraspasos.tsx`,
  `traspaso-ui.ts`, `ExecutiveModal.tsx`, `shared.ts`; `web/components/TerritoryPanel.tsx` (solo `id="anexo"`, destino
  del enlace "Ver anexo" del resumen).
- Pruebas: `web/scripts/traspaso-check.ts`, `web/scripts/traspaso-api-check.ts` (en `npm run test`) y
  `web/scripts/terceros-api-check.ts` (ajustada: `visitante=me` ya no trae a un Ejecutivo Comercial inactivo).
- Docs: `docs/decisiones/2026-10-12-traspaso-de-ejecutivas.md`, `docs/fases/fase6-visitas-f1-terceros.md` (decisión
  pendiente de visitantes, resuelta), `CLAUDE.md`.

**Decisiones extra (al implementar; el dueño puede cambiarlas)**
1. **Conteo del resumen** (igual en la vista previa y en la función, orden incluido): `visitantes_movidos` = cerradas
   a quien entrega y creadas para quien recibe; `visitantes_terminados` = quedan sin visitante ("nadie", médico
   inactivo y, con baja, asignaciones en líneas que ya no llevaba); `omitidos` = médicos que no se crearon para quien
   recibe, con razón `ya_lo_visita` (no cuenta en terminados: el médico sigue con visitante) o `medico_inactivo`
   (también cuenta en terminados). `lineas` y `omitidos` van en el orden de la función (por id); el plan por línea de
   la vista previa, en el orden del catálogo.
2. **Fecha de cierre** de cada asignación de quien entrega: `max(desde, fecha − 1)` (el CHECK `hasta >= desde`); una
   asignada el mismo día del traspaso cierra ese día. Duplicado = asignación abierta de quien recibe con el mismo
   (médico, línea, ciudad o sin ciudad), como el índice único de 0800.
3. **Persona nueva**: activa con `started_at` = fecha; **vacante**: "Vacante · <zona>" (sin el prefijo "KAM ") o
   "Vacante" sin zona. Ambas heredan zona base y empresa de quien entrega. El email de la persona nueva se compara
   con TODOS los Ejecutivos Comerciales (también inactivos y quien entrega) → 409; tope de 254 caracteres, el mismo de
   la función. Si hay un usuario de OpMap con ese email y no está enlazado con otro, la ruta lo enlaza después del
   traspaso (`usuario_enlazado` en la respuesta), como al crear un Ejecutivo Comercial o al contratar.
4. **"Desactivar su usuario" sin baja**: la API responde 400 y la función lo ignora (a quien se queda no se le quita
   el acceso). "Copiar excepciones" con "nadie" no copia nada.
5. **Quien entrega sin líneas** no se puede traspasar (400): para darla de baja queda la baja simple de siempre. Quien
   solo tiene `executives:edit` (data_manager) también sigue con la baja simple, que avisa que sus médicos quedan sin
   visitante.
6. **Versión final del anexo**: una sola casilla para todas las líneas (marcada por defecto); la ruta la guarda solo
   en las líneas donde quien entrega tiene territorio y ANTES de la función; si ya existe una versión con esa
   etiqueta (un intento anterior del mismo día), se conserva y se sigue. Si la función falla después, el error dice
   qué versiones quedaron guardadas (son inmutables).
7. **La vista previa** responde 200 con `ok = false` y la lista de errores (la interfaz los muestra); el traspaso
   revisa lo mismo antes de escribir nada y responde 400/404/409 según el primer error.
8. **Disparadores**: terminar una asignación sin motivo deja `fin_motivo = 'manual'` (la ruta de /terceros no cambia);
   con baja por la API vieja el cierre es `greatest(desde, left_at)`; al quitar una línea, `greatest(desde, hoy − 1)`.
9. **"Mi Ejecutivo Comercial"** (`ejecutivosDelUsuario`, `personaDelUsuario`) ignora al inactivo; el acceso al
   territorio ya lo filtraba `resolveUserLines` (solo activos y vacantes).
10. **Recálculo de la cobertura** en PATCH solo si cambian de verdad el estado o las líneas (el formulario manda
    todo); en DELETE solo si no estaba ya inactiva. Cambiar la zona base por PATCH no recalcula (fuera de esta spec).
    Contratar no recalcula: una vacante y una persona activa cuentan igual en la cobertura.
11. **Motivo** del traspaso: hasta 300 caracteres en la API (la función acepta 500). Es texto libre de la salida de una
    persona: el historial solo lo devuelve a quien tiene `executives:edit` o `executives:transfer` (los demás roles con
    `executives:view` lo reciben en `null`) y el formulario lo dice.

**Correcciones tras la revisión (2026-10-12; el dueño puede cambiarlas)**
12. **Usuario: el traspaso no reemplaza a `users:manage`.** `executives:transfer` lo tiene la dirección comercial, que no
    administra usuarios: el traspaso solo desactiva el usuario de un Ejecutivo Comercial (rol `sales_manager` o `user`),
    activo y distinto de quien hace el traspaso. Un admin, un líder de línea (quedaría `business_lines.leader_user_id`
    apuntando a un usuario inactivo) o cualquier otro rol sigue activo: la vista previa lo avisa con su rol y se
    desactiva, si hace falta, desde Usuarios (con sus guardas: nadie se desactiva a sí mismo; nunca el último admin). El
    historial guarda `desactivar_usuario = true` solo si de verdad se desactivó (no si no tenía usuario, si ya estaba
    inactivo o si su rol no lo permitía); el asistente no lo pide si no tiene usuario.
13. **Color en el mapa**: con baja, la persona nueva o la vacante heredan `executives.color` de quien entrega (sus zonas
    no cambian de color en el mapa por línea; quien entrega queda inactiva, así que no hay dos activos con el mismo
    color). Sin baja quedan sin color (quien entrega lo sigue usando). Quien ya existe conserva el suyo.
14. **Fecha pasada y médicos**: quien recibe tiene cada médico desde `max(fecha, desde de la asignación de quien
    entrega)`: con una fecha pasada nunca lo "visita" desde antes de que existiera la asignación (a lo sumo comparten
    un día, como en la decisión extra 2). Si la fecha queda antes del ingreso de quien se va (su último día antes de su
    `started_at`) o de quien recibe, la vista previa lo avisa (no se rechaza).
15. **Contratar** pone en la ficha el usuario de OpMap del email de la persona contratada (si existe y no está enlazado
    con otro) o ninguno: nunca conserva el de quien ocupaba antes la ficha (p. ej. una persona pasada a Vacante desde
    Editar), que si no seguiría viendo los médicos, la configuración y el territorio de la contratada.
16. **Sin la migración 0820** el traspaso responde 503 ANTES de guardar versiones del anexo (son inmutables). Si la
    llamada a la función falla sin un error de la base que la API sepa explicar (corte de red, respuesta perdida), no
    se afirma que "no se hizo": 500 con `resultado_incierto` y se remite al historial. Una versión final que ya existía
    (409, intento anterior del mismo día) vuelve con `ya_existia` y la interfaz la muestra como guardada, no como error.
17. **Baja simple y Editar** (camino de `data_manager`): si el recálculo de la cobertura falla, la página muestra el
    aviso que devuelve la API (antes solo decía "quedó inactiva" o "se guardaron los cambios").
18. **Rollbacks**: 9940 (de 0800) y 9941 (de 0810) abortan al inicio si 0820 sigue aplicada (usa sus tablas y
    `config_registrar` dentro de funciones, que el DROP no detecta). Orden: 9942 primero.
19. **Bloque DO de la 0820**: A usa un usuario y un color de prueba, y la copia de excepciones se compara con lo que A
    tenga vigente en la fecha (no con valores fijos), así una excepción real registrada antes de aplicar no la aborta.
