# Spec: empresas, papeles por empresa y asignaciones por Zona y línea  (2026-10-31)

**Estado**: aprobada por el dueño el 2026-10-31 ("Ok dale"), con las tres preguntas abiertas respondidas por él ese
día. **Capa 1 implementada en la rama `feat/empresas-papeles-asignaciones` (PR pendiente); la 0960 está escrita, NO
aplicada.** Capas 2 a 4 sin empezar. Decisión: `docs/decisiones/2026-10-31-empresas-papeles-y-asignaciones.md`. Plan de la capa 1:
`docs/planes/2026-10-31-empresas-capa-1-modelo-y-sesion.md`. Enfoque elegido por el dueño: por capas,
con compatibilidad (ver "Enfoques considerados"). Es el PRIMERO de tres proyectos: después vienen la marca por empresa
(ícono y colores en la web y la app) y la página de Ejecutivos Comerciales rehecha al estilo de la app.

## Problema
Hoy quien entra (`users`) tiene UN rol, y la persona del equipo comercial (`executives`) tiene UNA zona base, sus líneas
"de la persona" (`executive_lines`) y una empresa que es texto libre (`company`, por defecto "VG Medical"). Eso no
representa lo que el dueño describió el 2026-10-31:

- Una persona puede pertenecer a **varias empresas** (Lizeth y Katherine son de Medix) y al entrar está "como" una:
  "logeado en el momento como VG o como Medix".
- **El perfil cambia según la empresa y la línea**: "Lizeth puede ser líder en una empresa y ejecutiva en otra"; "Paola
  puede ser Ejecutiva Comercial en Sustitutos Óseos pero líder en Trauma".
- **Una línea puede estar en varias empresas**: "La línea A puede estar para la empresa X y Z, pero la línea B solo en la
  empresa X y la C solo en la Z".
- **Las líneas se llevan por Zona**: "un comercial puede estar asignado a la zona A y zona B. En la zona A tiene la línea
  X y en la B tiene la línea X y J". Es el caso de Linda Ossa (Bucaramanga y Cúcuta), resuelto hoy a mano.
- Las Zonas y los médicos, cuentas y sedes son **compartidos** entre empresas ("para beneficiarnos de una sola base");
  las visitas son **de cada empresa**.
- Todo "a futuro debe vincularse con Odoo", de a poco: "queremos empezar ya para ir mejorando la app y vamos conectando".

## Lo que vimos en Odoo (VG, 2026-10-31, solo lectura)
- Un Odoo por empresa: el de VG tiene UNA compañía (`res.company` 1, VG Medical SAS). Medix es otra base de Odoo (no se
  pudo mirar: el conector no estaba autorizado). Luego el enlace a Odoo es **por empresa** y una persona tiene un id en
  cada Odoo.
- Personas: `hr.employee` con `user_id` (`res.users`), cargo (`job_id`: "Ejecutiva Comercial" ×8; "Líder Nacional de
  Trauma / Columna / Sustitutos Óseos / Reemplazos Articulares / Deportiva", una cada uno), jefe (Laura) y lugar de
  trabajo (`hr.work.location`: Barranquilla, Cali, Valledupar, Montería, Cúcuta, Eje Cafetero, Pasto, Medellín,
  Bucaramanga, Bogotá…, los nombres de nuestras Zonas). Cada empleado tiene UN cargo: Paola solo figura como líder.
- Médicos: `res.partner` con `health_professional`, cédula en `vat`, tipo de documento, especialidad y "vendedor"
  (`user_id`, la ejecutiva que lo atiende); 3.180 filas. IPS: `res.partner` con `health_provider_institution`.
- Líneas de negocio: no existen en Odoo; lo más cercano son categorías de producto (Trauma, Reemplazos, Sustitutos Óseos,
  PerOssal, 4DryField, SpineWay). Las líneas siguen siendo de OpMap.

## Resultado esperado
1. **Empresas** existen como dato: hoy VG Medical y Medix; mañana más, sin tocar código.
2. **Papeles por empresa**: una persona es una fila, con un solo correo y clave. Lo que puede hacer sale de sus papeles:
   cada papel es "persona · empresa · papel · (línea)". Ejemplos reales:
   - Paola · VG · Líder de negocio · Trauma, y Paola · VG · Ejecutivo Comercial.
   - Lizeth · Medix · Líder de negocio · (una línea de Medix), y Lizeth · VG · Ejecutivo Comercial.
   - El dueño y Laura: Administrador y Director comercial, respectivamente, una fila por empresa.
3. **Empresa activa en la sesión**: al entrar, la persona queda "como" una empresa (si solo tiene una, esa; si tiene
   varias, la última usada o, sin ella, VG si la tiene). Puede cambiarla desde el menú de OpMap y desde Ajustes de la app sin volver a
   escribir la clave. Lo que ve y puede hacer es la **suma de sus papeles en esa empresa**. La marca (ícono, colores)
   NO cambia todavía: va en el proyecto 2; por ahora la barra muestra el nombre corto de la empresa activa al lado del
   nombre de la persona.
4. **Líneas por empresa**: cada línea dice en qué empresas existe. La sesión "como Medix" solo ofrece líneas de Medix en
   Zonas, Líneas, el mapa por línea, Reportar y Agendar.
5. **Asignaciones por persona, Zona y línea** (lo de Linda Ossa): en Zonas se le da una línea a una persona o vacante EN
   esa Zona, viva allí o no. La misma persona puede tener líneas distintas en Zonas distintas. La cobertura se calcula
   desde esas asignaciones: "local" donde tiene la asignación, "alcance" por carretera desde cada Zona asignada, igual
   que hoy desde la zona base. Las "líneas permitidas" (`executive_allowed_lines`) desaparecen: la lista de asignaciones
   ya dice qué lleva cada quien.
6. **Visitas por empresa**: la visita y la cita nacen con la empresa activa de la sesión. Cada empresa ve solo sus
   visitas; el mapa de calor y los reportes filtran por la empresa activa.
7. **Compartido**: Zonas (`kams`), tiempos de carretera, médicos, cuentas, sedes, contactos e IPS siguen siendo una sola
   base para todas las empresas.
8. **Enlaces a Odoo**: toda fila que algún día vivirá en Odoo (empresa, persona, usuario, médico, cuenta, sede, línea,
   Zona) puede guardar su id en el Odoo de cada empresa. En este proyecto se guardan los que ya tenemos
   (`executives.odoo_employee_id` → id de `hr.employee` en el Odoo de VG). No se sincroniza nada todavía.
9. **Nada visible cambia de golpe**: la app y la web siguen funcionando igual para quien tiene una sola empresa y un solo
   papel (hoy, todos menos Paola, Lizeth y Katherine).

## Modelo (lo decidido)
Nombres en español como el resto de las tablas de visitas; en inglés solo lo que ya existe.

- `empresas`: `id`, `codigo` (único, corto: `vg`, `medix`), `nombre` ("VG Medical SAS"), `nombre_corto` ("VG",
  "Medix"), `nit`, `activa`, `odoo_url` (NULL hoy), `created_at`. Semilla: VG Medical y Medix.
- `linea_empresas`: `line_id` → `business_lines`, `empresa_id` → `empresas`; PK las dos. Semilla: las 6 líneas de hoy en
  VG. Las de Medix las carga el dueño en Líneas (no se inventan).
- `papeles`: `id`, `user_id` → `users`, `empresa_id` → `empresas`, `papel` (los mismos valores que `users.role` hoy:
  `admin`, `commercial_director`, `line_leader`, `sales_manager`, `contract_manager`, `data_manager`, `viewer`, `hr`,
  `user`), `line_id` → `business_lines` (NOT NULL solo si `papel = 'line_leader'`, y esa línea debe estar en esa empresa),
  `activo`, `created_by`, `created_at`. Único: (`user_id`, `empresa_id`, `papel`, `line_id` con NULL tratado como
  vacío). Semilla: una fila por usuario activo con su `users.role` en VG; una fila `line_leader` por
  `business_lines.leader_user_id` en VG (si el usuario era `line_leader`, esas filas lo reemplazan).
- `executive_empresas`: `executive_id` → `executives`, `empresa_id` → `empresas`, `activo`; PK las dos. "A qué empresas
  pertenece la persona del equipo comercial" (también las vacantes). Semilla: todas en VG. Reemplaza
  `executives.company` (texto), que deja de leerse desde el servidor en la capa 1 y de escribirse en la capa 2 (la
  función de traspaso aún la copia hasta la 0970).
- `asignaciones`: `id`, `executive_id` → `executives`, `kam_id` → `kams`, `line_id` → `business_lines`, `empresa_id` →
  `empresas`, `created_by`, `created_at`. Único: (`executive_id`, `kam_id`, `line_id`, `empresa_id`). Una restricción
  (disparador) exige que (`line_id`, `empresa_id`) esté en `linea_empresas` y (`executive_id`, `empresa_id`) en
  `executive_empresas`. Semilla: por cada fila de `executive_lines`, una asignación en la zona base de la persona y en
  VG. Reemplaza `executive_lines` y `executive_allowed_lines`.
- `executives.base_kam_id` se queda como **Zona de residencia** (donde vive; es lo que Odoo llama lugar de trabajo y lo
  que ordena la lista). Ya no decide qué lleva: eso lo dicen las asignaciones. Qué Zona lleva la visita de quien tiene
  varias es la pregunta abierta 3.
- `coverage` y `coverage_overrides`: ganan `empresa_id` (NOT NULL; relleno VG) y `coverage` gana el único
  (`empresa_id`, `line_id`, `kam_id`). **La 0960 CONSERVA el único viejo (`line_id`, `kam_id`) junto al nuevo**, porque
  `recomputeAndSaveCoverage` hace upsert por `line_id,kam_id` hasta la capa 2; la 0970 lo quita. `territory_snapshots`: gana `empresa_id`.
- `visits`, `visitas_agenda`, `medico_visitantes`: ganan `empresa_id` (NOT NULL; relleno VG). `visit_lines` no cambia.
- Todas las columnas `empresa_id` nuevas llevan `DEFAULT` = el id fijo de VG (uuid constante en la semilla), porque las
  funciones de la base y el importador de VMO no mandan empresa hasta las capas 2 y 3. El `DEFAULT` se quita en la capa 4.
- `odoo_enlaces`: `empresa_id`, `tabla` (nombre de la tabla de OpMap), `fila_id` (uuid), `modelo` (de Odoo, p. ej.
  `hr.employee`, `res.users`, `res.partner`, `product.category`, `hr.work.location`), `odoo_id` (entero), `created_at`.
  Únicos: (`empresa_id`, `tabla`, `fila_id`) y (`empresa_id`, `modelo`, `odoo_id`). Semilla: `executives.odoo_employee_id`
  → (`vg`, `executives`, id, `hr.employee`, odoo_employee_id). `executives.odoo_employee_id` queda sin uso.
- `business_lines.leader_user_id` y `users.role` quedan en la tabla **como caché derivada** durante la transición: el
  servidor los escribe cada vez que cambian los papeles (`users.role` = el papel más alto de la persona en VG, o `user`
  si no tiene ninguno en VG; `leader_user_id` = el líder de esa línea en VG). Ningún código nuevo los lee; el que
  todavía los lee se migra PR a PR. Se borran en la capa 4, cuando nada los use.
- **Líder por línea y empresa**: uno nacional (sin Zonas) o varios con Zonas disjuntas (`papel_zonas`); ver la decisión
  2 de abajo. La caché `leader_user_id` toma el líder nacional de VG, o NULL si solo hay líderes por Zona.
- La 0960 se detiene (RAISE) si algún usuario activo con `role = 'line_leader'` no lidera ninguna línea: el dueño le
  pone línea o lo cambia de rol antes. Igual si una fila de `executive_lines` pertenece a una persona sin
  `base_kam_id`. Está ESCRITA, no aplicada (rollback 9961).
- Quitar el papel `sales_manager` de VG también recalcula la cobertura (`cobertura_recalculada` en la respuesta de
  `PUT /api/users/[id]/papeles`); de Medix, no (la cobertura de Medix llega con la capa 2).
- Dar el papel `sales_manager` en `/users` a una persona enlazada con una fila de `executives` crea su
  `executive_empresas` en esa empresa; quitárselo borra sus asignaciones en esa empresa (la pantalla avisa cuántas y
  cuántos visitantes terminan). Las vacantes no tienen usuario: su `executive_empresas` se maneja desde Ejecutivos
  Comerciales ("Agregar vacante" pide la empresa; por defecto, la activa).

Orden de "papel más alto" para la caché y para los textos: `admin` > `commercial_director` > `line_leader` >
`sales_manager` > `contract_manager` > `data_manager` > `hr` > `viewer` > `user`.

## Sesión y permisos (lo decidido)
- La empresa activa es **por persona**, no por dispositivo: `users.empresa_activa_id` → `empresas` (NULL = la única o, si hay varias,
  VG si la persona la tiene; si no, la de menor `codigo`: «la primera por código» a secas habría puesto a Medix antes
  que a VG, porque `'medix' < 'vg'`, y «nadie nota nada» exige lo contrario). Así la web y `/campo` en el mismo navegador, y el teléfono, están siempre "como" la misma
  empresa, y "la última usada" es simplemente esa columna. El token de sesión gana el claim `emp` solo como caché: el
  servidor lo compara con la columna y, si difieren, manda la columna. Sin `emp` (tokens de hoy) vale la columna; así
  nadie tiene que volver a entrar.
- `SessionUser` gana `empresa` (`{ id, codigo, nombre_corto }`), `papeles` (los activos en esa empresa) y `permisos`
  (unión de `rolePermissions[papel]` de cada papel). `role` se conserva como el papel más alto en esa empresa, para el
  código que aún lo lee. `requirePermission`, `requireAnyPermission` y `hasPermission` deciden con `permisos`.
- `POST /api/auth/sesion-app` (el puente de la web a la app, un solo ingreso) **niega (403) a quien tiene un papel
  `admin` o `commercial_director` activo en CUALQUIER empresa**: la cookie del administrador nunca se vuelve un token
  legible desde la app; esa persona entra a la app con su clave. Los demás reciben el token con la empresa activa.
- `POST /api/auth/empresa` cambia la empresa activa (solo a una donde la persona tenga papel activo): escribe
  `users.empresa_activa_id` y vuelve a firmar la cookie o devuelve el token nuevo a la app. `GET /api/auth/me` devuelve
  `empresa`, `empresas` (las que puede elegir) y `papeles`. La app, sin señal, no puede cambiar de empresa (el selector
  avisa).
- Cada visita y cita que sube la app lleva su `empresa_id` en la carga (la que estaba activa al capturarla); el servidor
  valida que la persona tenga papel activo allí y la guarda con ESA empresa, no con la del token al subir. Así la cola
  sin señal no cambia de empresa por cambiarla después en Ajustes.
- `users:manage` y editar papeles de cualquier empresa son del Administrador en cualquiera de sus empresas (es la única
  forma de crear el primer papel de una empresa nueva). La semilla pone a cada `admin` y `commercial_director` de hoy una
  fila por CADA empresa activa (VG y Medix), como se acordó en la conversación.
- La app de campo: "solo líderes" pasa a ser "quien tiene un papel `line_leader` activo en la empresa activa";
  `lineasParaReportar` sale de los papeles (líder) y de las asignaciones (Ejecutivo Comercial) de esa empresa.
- Las líneas de una líder (`medico_lineas` al crear un médico) son las de sus papeles `line_leader` en la empresa activa.

## Enfoques considerados
1. **Por capas, con compatibilidad** (elegido por el dueño): tablas nuevas; las columnas viejas se mantienen como caché
   derivada mientras cada página pasa al modelo nuevo, un PR por capa; nada se rompe de golpe y cada capa se prueba.
2. **De una vez**: una migración reemplaza rol, zona base y líneas y un solo PR reescribe permisos, Zonas, Ejecutivos,
   app de campo y pruebas. Más corto en calendario, PR enorme, sin vuelta atrás fácil. Descartado.
3. **Una base por empresa**: descartada, no permite compartir médicos ni Zonas.

## Capas (un PR cada una, en este orden)
**Capa 1 – Modelo y sesión.** Migración 0960 (rollback 9961) con todas las tablas y semillas de arriba; `empresa` y
`papeles` en la sesión; `permisos` como unión; `POST /api/auth/empresa`; nombre corto de la empresa en la barra de OpMap
y en la franja de estado de la app; `/users` muestra y edita papeles por empresa (en lugar del rol único) y escribe la
caché; Líneas edita en qué empresas está cada línea (`linea_empresas`), para que una persona pueda ser líder en Medix
desde esta capa. Las semillas dejan a todos exactamente como hoy. Implementada y probada sin red (`scripts/empresas-check.ts`,
`scripts/empresas-api-check.ts`, `mobile/scripts/checks/26-empresa-activa.ts`); PR pendiente. **Después de aplicar la
0960** el dueño registra en
`/users` el segundo papel de Paola (Ejecutivo Comercial en VG) y, cuando haya cargado las líneas de Medix en Líneas, los
papeles de Lizeth y Katherine en Medix; mientras tanto siguen como hoy.

**Capa 2 – Asignaciones y cobertura.** Migración 0970 (rollback 9962): reescribe `ejecutivas_traspasar` (lee y mueve
`asignaciones` y `executive_empresas` en vez de `executive_lines` y `executives.company`) y crea sobre `asignaciones` el
disparador que termina `medico_visitantes` (hoy `executive_lines_termina_visitantes` de la 0820; ver la regla de abajo).
El motor (`lib/coverage.ts`) y Zonas (`/kams`, `PUT/DELETE /api/executives/[id]/lineas/[lineId]`) pasan a `asignaciones`
con `kam_id` explícito y `empresa_id` de la sesión; el recálculo guarda `coverage.empresa_id`. Traspaso ("Traspasar",
"Contratar") mueve asignaciones y `executive_empresas`. `executive_lines` y `executive_allowed_lines` dejan de leerse
desde el servidor. El anexo de territorio lleva la empresa.
*Estado entre la 0960 y la 0970*: Zonas sigue escribiendo `executive_lines` y nadie escribe `asignaciones` (la semilla
la dejó espejo de `executive_lines` en la zona base); `POST /api/executives` y el importador de VMO sí escriben
`executive_empresas` (la persona nueva nace en VG o en la empresa pedida); `ejecutivas_traspasar` (función de la base)
todavía no, hasta la 0970.

**Capa 3 – Campo y visitas por empresa.** Migración 0980 (rollback 9963): reescribe las funciones de la base que hoy
leen `executive_lines`, `business_lines.leader_user_id` y `users.role` (`persona_lineas`, `persona_de_campo`,
`ejecutivo_de_la_visita`, `medico_de_lineas`, `visitas_registrar`, `agenda_crear`, `terceros_crear_medico`) para que lean
`papeles` y `asignaciones` de la empresa que reciben. El mapa por línea, Reportar, Agendar y `/api/me/*` filtran por la
empresa activa; visitas y citas nuevas guardan `empresa_id`; el mapa de calor y los reportes filtran por empresa;
`medico_visitantes` por empresa. Hasta esta capa, las funciones viejas siguen funcionando porque la caché de `users.role`
y `leader_user_id` y las filas de `executive_lines` siguen ahí (la capa 2 deja de LEERLAS desde el servidor, pero Zonas
sigue ESCRIBIÉNDOLAS, una fila por persona y línea, hasta la capa 4).

**Capa 4 – Limpieza.** Migración que borra `users.role`, `business_lines.leader_user_id`, `executive_lines`,
`executive_allowed_lines`, `executives.company` y `executives.odoo_employee_id` (con respaldo), cuando ninguna ruta los lea.

## Criterios de aceptación (pruebas puras, `web/scripts/*-check.ts`)
Capa 1
- [x] `permisosDePapeles([{admin}])` = los de admin; `[{line_leader, Trauma}, {sales_manager}]` = la unión; la lista
      vacía = sin permisos. `papelMasAlto` sigue el orden de arriba.
- [x] `empresaActivaDe(token sin emp, empresas [vg])` = vg; con `[vg, medix]` = vg (VG si la tiene; si no, la menor por código); con `emp = medix`
      y papel activo allí = medix; con `emp` donde no tiene papel = 403 al cambiar y la de por defecto (VG si la tiene) al leer.
- [x] `requirePermission` con papeles `[line_leader]` niega `executives:lines` y concede `campo:app`; con
      `[line_leader, sales_manager]` concede `visits:report`.
- [x] `/api/auth/me` de una persona con dos empresas trae `empresas` con las dos y `empresa` con la activa.
- [x] Las semillas (función pura `papelesDeSemilla` sobre filas de ejemplo): un usuario `line_leader` que lidera dos
      líneas produce dos filas `line_leader`, no una `line_leader` sin línea.
- [ ] `users.role` derivado de los papeles (`cacheRolDe`) devuelve el de hoy para cada usuario de la semilla: hay pruebas
      de `cacheRolDe` y de la semilla por separado, no la ida y vuelta de los dos; queda para la revisión.
Capa 2
- [ ] `computeCoverage` con asignaciones: persona con (A, X) y (B, X y J): local en A para X, local en B para X y J, nada
      de J en A; el alcance de J sale desde B; sin asignación en ninguna Zona, no cubre nada aunque tenga zona base.
- [ ] Dar una línea en Zonas a una persona que no vive en la Zona crea la asignación en ESA Zona; quitarla no toca sus
      otras Zonas; dar una línea que no está en la empresa activa = 400.
- [ ] Traspasar pasa las asignaciones de la Zona y la empresa; la vacante nueva las recibe.
Capa 3
- [ ] Linda con (Bucaramanga, Sustitutos) y (Cúcuta, Reemplazo): en una sede de Cúcuta Reportar ofrece solo Reemplazo y
      el servidor rechaza Sustitutos con "línea ajena"; en una sede de Bucaramanga, al revés; sus visitantes de
      Sustitutos no se cierran al quitarle Sustitutos en Cúcuta si lo conserva en Bucaramanga, y sí al quitárselo en
      las dos.
- [ ] La Zona de una visita de VMO en un municipio de Cúcuta, de una persona con Cúcuta asignada, es Cúcuta; en un
      municipio que no cae en ninguna de sus Zonas, su Zona de residencia.
- [ ] Dos papeles `line_leader` de la misma línea y empresa sin Zonas = rechazado; con Zonas disjuntas = aceptado; con
      una Zona en común = rechazado.
- [ ] Reportar "como Medix" solo ofrece líneas de Medix; una visita registrada "como VG" no aparece en el mapa de calor
      "como Medix"; `lineasParaReportar` de Paola en VG = Trauma (líder) ∪ sus asignaciones (ejecutiva).
- [ ] `/api/auth/me` de quien solo es Ejecutivo Comercial en la empresa activa sigue dando `sin_persona` (regla del
      2026-10-30), aunque sea líder en otra empresa.

## Decisiones del dueño del 2026-10-31 (eran las preguntas abiertas)
1. **Perder una línea en UNA Zona no cierra visitantes**: "ella en Cúcuta no podría ni programar ni visitar marcando esa
   línea y listo, no tendría la opción". Es decir: la regla vive en el momento de agendar y reportar, no en la ficha del
   médico. Reportar y Agendar solo ofrecen una línea si la persona tiene la asignación (Zona, línea) en la Zona donde
   cae el municipio de la sede o del médico (capa 3); el servidor lo rechaza con el mensaje de "línea ajena". Los
   visitantes de esa línea se cierran solo cuando la persona pierde la línea en TODAS sus Zonas de esa empresa (es lo
   que hace hoy el disparador de la 0820, movido a `asignaciones` en la 0970) o con la baja.
2. **Un líder por línea y empresa hoy, preparados para dos mañana dividiendo por Zonas**: `papeles` admite varios
   `line_leader` de la misma línea y empresa SOLO si cada uno tiene Zonas (`papel_zonas`: `papel_id`, `kam_id`) y no se
   solapan; sin Zonas, el líder es nacional y único (restricción por disparador en la 0960). `papel_zonas` nace en la
   0960 y se edita en `/users` desde la capa 1, sin pantalla especial. Lo que una líder "ve de su línea" (Zonas, mapa,
   visitas, histórico de líderes) se limita a sus Zonas cuando las tiene: va en la capa 3; hasta entonces solo existe
   el líder nacional.
3. **La visita se pinta en la Zona donde se hizo**: "las visitas de Linda en Cúcuta se deben pintar en Cúcuta". La Zona
   de una visita (`visits.kam_id`, de VMO o de la app) es la Zona asignada de la persona, en esa empresa, cuyo territorio
   actual contiene el municipio de la visita; si ninguna la contiene, su Zona de residencia. Reemplaza en eso la regla
   del 2026-10-29 ("la Zona de la visita sigue a la de la persona"); se anota en la decisión de esta spec. Capa 3
   (importador de VMO, `visitas_registrar` y `agenda_crear`).

## Fuera de alcance
- Marca por empresa (logo, colores, ícono de la app que cambia): proyecto 2, con su spec y su migración (columnas de
  `empresas`).
- Rehacer la página de Ejecutivos Comerciales (encabezado y tarjetas tipo Uber): proyecto 3.
- Sincronizar algo con Odoo (leer o escribir): solo quedan los enlaces.
- Visitas de VMO (`source = 'vmo_import'`): se marcan VG en la semilla; si VMO distingue empresa, se verá en el importador
  después.
- Que una empresa vea las visitas de otra al mismo médico: no, por decisión de esta spec (cada empresa ve las suyas).
  El dueño puede cambiarlo en una decisión aparte.

## Impacto
- Datos / migración: sí. Capa 1: 0960 (`2026-10-31_0960_empresas_papeles_asignaciones.sql`, rollback 9961). Capa 2:
  0970 (traspaso y disparador de asignaciones, rollback 9962). Capa 3: 0980 (funciones de la base por empresa, rollback
  9963). Capa 4: la de limpieza. Cada una se aplica solo con autorización del dueño y en la ventana del despliegue de su
  capa.
- Costo Google Maps: 0. La cobertura se recalcula con la caché de tiempos.
- Estética del mapa: no cambia. El mapa por línea filtra por la empresa activa (capa 3).
- Permisos / roles: los nombres de los papeles son los mismos roles de hoy. La única diferencia observable: una persona
  puede tener varios a la vez y distintos por empresa. `users:manage` (admin) edita papeles.
- Regla de negocio nueva: `docs/decisiones/2026-10-31-empresas-papeles-y-asignaciones.md`.

## Plan (archivos e interfaces)
Capa 1: `database/migrations/2026-10-31_0960_*.sql` y `9961_*_rollback.sql`; `web/lib/session.ts` (claim `emp`),
`web/lib/auth-server.ts` (`SessionUser.empresa/papeles/permisos`), `web/lib/permissions.ts` (`permisosDePapeles`,
`papelMasAlto`, `hasPermission` sobre permisos), `web/lib/require-role.ts`, `web/lib/empresas.ts` (nuevo: leer empresas y
papeles de una persona, elegir la activa, escribir la caché de `users.role` y `leader_user_id`), `web/app/api/auth/me`,
`web/app/api/auth/empresa` (nuevo), `web/app/api/users/*` y `web/app/users/page.tsx` (papeles por empresa),
`web/components/NavigationWithPermissions.tsx` (empresa activa y cambio), `mobile/` (Ajustes: empresa activa; franja de
estado: nombre corto), `docs/base-de-datos.md`. Pruebas: `scripts/empresas-check.ts` y `empresas-api-check.ts`.
Capa 2: `web/lib/coverage.ts`, `web/app/kams/*`, `web/app/api/executives/**`, `web/lib/traspaso*.ts`, `lib/territory.ts`;
pruebas `cobertura-simulacion-check`, `zonas-api-check`, `lineas-api-check`, `traspaso*-check` ajustadas.
Capa 3: `web/lib/persona-campo.ts`, `web/app/api/me/**`, `web/app/api/visits/**`, `web/app/lines/*`, `lib/map-*`;
pruebas `persona-campo-check`, `visits*-check`, `mapa-*-check`.

## Lo que queda al constructor
Nombres exactos de columnas y disparadores dentro de lo de arriba; cómo se presenta el cambio de empresa en el menú y en
Ajustes (un selector solo cuando hay más de una); textos de error; orden de los papeles en `/users`; si la caché de
`users.role` se escribe desde `lib/empresas.ts` o desde un disparador en la base (recomendado: servidor, como el resto
del repo, que no usa disparadores para reglas de negocio salvo los de visitas).

## Verificación final
`npm run check` en `web/` y `mobile/` en cada capa. Capa 1: capturas de `/users` con los papeles de Paola, del menú con
la empresa activa y del cambio de empresa en la app; una persona con un solo papel ve exactamente lo de hoy. Capa 2:
`npm run fase2:check` (solo lectura) y el caso de Linda Ossa en Zonas. Capa 3: Reportar "como Medix" con una línea de
prueba de Medix y el mapa de calor filtrado.
