# Spec: actividades de campo — una sola app para Ejecutivos Comerciales y líderes, y "¿Dónde está mi gente?"  (2026-10-15)

**Estado**: aprobada en su concepción por el dueño el 2026-10-15, con sus respuestas A1–A17
(`docs/decisiones/2026-10-15-actividades-de-campo.md`). F1a escrita (rama `feat/campo-f1a`, PR #48; la 0850 APLICADA el 2026-10-30).
F1b escrita en la rama `feat/campo-f1b` (sin migración), con las correcciones de la revisión del 2026-10-30. Falta la
prueba en el iPhone del dueño, contra un servidor con la 0850 (ver "F1b"). Queda abierto lo de "Lo que sigue abierto".

**Cambio del dueño del 2026-10-30** (`docs/decisiones/2026-10-30-app-de-campo-solo-lideres.md`): la app era SOLO para
las líderes. **Reemplazado el 2026-10-31** (`docs/decisiones/2026-10-31-ejecutivos-comerciales-vuelven-a-la-app.md`): los
Ejecutivos Comerciales vuelven a la app y todo lo de esta spec sobre ellos (C4, C12 y A13) vale otra vez; VMO queda
transitorio para el mapa de calor. "Equipo" (F4) se hace dentro de la app
(`docs/specs/2026-10-31-equipo-en-la-app-y-ejecutivos-de-vuelta.md`).

**Fuentes**:
- Estudio del 2026-10-15, de solo lectura: modelo de datos, Excel de la directora, vista de la directora y tipos de
  actividad.
- Consultas SELECT en producción (proyecto `norvxqgohddgsdkggqzq`), la última del 2026-10-15.
- Notas y scripts en `scratchpad/actividades/`. Los archivos con nombres de médicos no salen de ahí.

**Se apoya en**:
- `docs/fases/fase8-visitas-f3-f4-reporte-y-app-movil.md` (F3, F4 y F4.1).
- `docs/specs/2026-10-15-usabilidad-y-agenda-con-hora.md`. Su tanda 1 ya está en master (PR #27).
- La dirección visual A, "estilo Uber", elegida por el dueño el 2026-10-15. Se aplica a la app en su propio cambio
  (rama `feat/movil-estilo-uber`), antes de F1b.

**Realiza** la parte "Equipo" de la F5 ("Web de dirección") de `docs/specs/2026-10-12-app-de-visita-opmap.md`.

## Problema

Lo que pidió el dueño el 2026-10-15:

> "No me parece que sea una aplicación aparte… es muy parecido a lo que está ahorita. Los ejecutivos comerciales
> tienen la capacidad de agendar visitas médicas, que estaría mal decir que son visitas médicas, porque ellos no
> solamente visitan a médicos… también van a compras, visitan clientes. […] Los líderes podrían también tener la
> capacidad de agendar, de tener su agenda ahí."

> "¿Qué quiere saber la directora comercial? ¿Dónde están sus líderes? ¿Qué tienen planificado? […] Paola tiene
> casualmente dos roles […] Hacer dos aplicaciones vuelve más tedioso el tema. Debería ser una."

> "Es importante que estas cosas se programen con tiempo, no una restricción, pero sí por lo menos saber hace cuántos
> días programó esa correría."

> "En una cena sería bueno saber qué médicos asistieron. A veces a estas cenas asisten todas, entonces todas
> reportarían lo mismo [y está bien]. Cuando van a un congreso no vamos a colocar todos los médicos."

Lo que pasa hoy:

**Quién puede usar la app.** Solo reporta y agenda un Ejecutivo Comercial con zona.
- `visits.executive_id` y `visitas_agenda.executive_id` apuntan a `executives`, y las 5 funciones de la 0830 y la 0840
  sacan a la persona de `executives.user_id`.
- `requireEjecutiva` responde 403 a 4 de las 5 líderes, aunque `line_leader` ya tiene `visits:report`.
- Paola (líder de Trauma y Ejecutivo Comercial de Sustitutos óseos) solo puede reportar Sustitutos óseos.

**Qué se puede registrar.** Solo hay dos tipos, y los dos son visitas: médica e institucional.
- No caben una cena con varios médicos, una correría de varios días, un congreso, una capacitación ni una junta en
  clínica.
- La agenda deja planear solo de hoy a hoy + 30 días.
- Una cita solo se cancela (motivo opcional). No hay forma de decir "no se hizo" después del día, ni de pedir otra
  fecha sin perder el rastro.

**Quién lo ve.** La directora no tiene dónde ver dónde está su gente ni qué planeó. Lleva un Excel ("Tracker
Líderes"):
- 212 filas de las 5 líderes, de mayo a noviembre de 2026.
- 24 de esas filas están planeadas a futuro, 6 de ellas a 34–41 días.
- En su hoja DASHBOARD, "Contactos impactados" y "Ciudades visitadas" salen siempre en 0 porque son texto libre.
- No muestra lo planeado ni la anticipación, ni dónde ha estado cada persona en los últimos meses.

**Cifras de producción (2026-10-15)**:
- 14 personas de campo posibles: 10 Ejecutivos Comerciales activos con usuario (Paola entre ellos) y 4 líderes sin
  Ejecutivo Comercial. Hay 5 líneas activas y cada una tiene una líder.
- `visitas_agenda`: 20 citas (19 pendientes y 1 hecha), todas de una persona. `visits`: 7.034 filas, 7.033 de VMO y
  1 de la app.
- `medicos`: 10, con 20 visitantes vigentes, todos de las líneas `reemplazo` y `perossal`. Columna, Deportiva y Trauma
  no tienen médicos todavía, y Trauma no tiene Ejecutivos Comerciales (ver "Lo que sigue abierto", B3).

## Resultado esperado

1. **Una sola app, la de hoy**, para toda persona de campo: Ejecutivos Comerciales y líderes, con o sin zona.
   - Paola entra una vez y tiene una sola agenda. Reporta como líder (Trauma) o como Ejecutivo Comercial (Sustitutos
     óseos) según las líneas de lo que hizo.
   - La directora comercial no agenda ni reporta: vigila desde la web (A1).
   - Un usuario sin líneas, como hoy un `sales_manager` sin Ejecutivo Comercial, sigue sin entrar.
   - El nombre de la app no cambia todavía (A14).
2. **La app habla de actividades, no de visitas médicas.**
   - "Reportar actividad", "Actividades de hoy" y "¿Qué hiciste?".
   - "Visita" queda solo para "Visita a médico" y "Visita institucional".
   - Los nombres del código no cambian (`visits`, `visitas_agenda`, `visits:report`), como pasó con las Zonas.
3. **Nueve tipos de actividad, cada uno con su formulario.**
   - Las dos visitas de hoy siguen iguales.
   - Se añaden: reunión o junta en clínica, cena o almuerzo comercial, capacitación, congreso o evento,
     acompañamiento a cirugía, correría y otro.
   - La cena se planea con sus médicos invitados y se reporta con los que asistieron, solo médicos de las líneas de
     quien la hace (A9).
   - La correría puede ser de todo el día y de varios días, y puede ir con la Ejecutiva Comercial de la zona (A6).
   - El congreso no pide lista de médicos.
   - Los compromisos admiten "Ninguno".
4. **Agenda para todos, sin tope hacia adelante (A4), con un ciclo de vida que no borra la historia (A7).**
   - Se planea cualquier tipo, con hora o, en correría y congreso, "todo el día" con un rango de fechas.
   - Lo programado no se mueve de fecha: se cierra con su resultado (hecha, no se hizo con motivo, cancelada con
     motivo) o se elimina si se programó por error. Si hace falta otra fecha, se crea una actividad nueva enlazada a la
     anterior ("viene de").
   - Dos actividades con hora no se cruzan en su media hora: el servidor lo bloquea (409).
5. **Líderes con días libres y metas de correrías (A12).** Paola tiene dos metas separadas: la de Ejecutivo Comercial
   y la de líder (A13).
6. **Web `/equipo`, "¿Dónde está mi gente?"**, con Hoy, Próximas semanas y Tablero para la directora y las líderes, y
   un Mapa de calor de dónde ha estado cada persona, solo para la directora (A3).
   - Cada actividad dice "planeada hace N días"; 7 días o más es "planeada con tiempo" (A5).
   - El Tablero reemplaza la hoja DASHBOARD y cuenta los contactos y las ciudades que hoy salen en 0.
7. **Al salir alguien de la empresa, se cancela lo que tenía planeado** (A16). La persona nueva agenda de cero.
8. **Lo que no cambia**:
   - Nada sigue la ubicación en segundo plano.
   - El mapa de asignación se ve igual: el mapa de calor de personas vive en `/equipo`.
   - Nadie llama a Google.
   - La cuota y las metas de los Ejecutivos Comerciales no cambian.
   - El histórico del Excel no se importa (A15): queda en el Excel.

## Decisiones

### Del dueño (2026-10-15)

Anotadas en `docs/decisiones/2026-10-15-actividades-de-campo.md`. La numeración A1–A17 es la de esa decisión y la que
usa esta spec.

- **Concepción**: una sola aplicación para Ejecutivos Comerciales y líderes. No es un "módulo de visitas médicas": es
  lo que hace la gente de campo ("actividades de campo").
- **A1**. La directora comercial no agenda ni reporta: solo vigila.
- **A2**. Una líder no ve a las otras líderes. Sí ve a los Ejecutivos Comerciales de su línea.
- **A3**. Mapa de calor de dónde ha estado cada persona (líderes y Ejecutivos Comerciales), solo para la directora:
  "ver que en 6 meses solo ha estado en Barranquilla y Cartagena y no ha visitado otras ciudades importantes". Va en
  `/equipo`, no en el mapa de asignación ni en su estética.
- **A4**. Sin límite de tiempo para agendar hacia adelante. Cambia la decisión 3 de
  `docs/specs/2026-10-14-agenda-dictado-y-marca.md` (de hoy a hoy + 30).
- **A5**. "Planeado con tiempo" = 7 días o más de anticipación (los tiquetes de un día para otro son más caros). Es
  un indicador, no una restricción.
- **A6**. La correría puede ser de todo el día. La líder suele visitar junto con la Ejecutiva Comercial de la zona,
  que debería tener esas visitas agendadas: se puede indicar con qué Ejecutiva va y ver sus visitas agendadas de esos
  días, sin complicarlo.
- **A7**. No se reprograma moviendo la fecha. Lo programado se cierra con su resultado: hecha (efectiva), o no
  efectiva / no se hizo, con motivo. Otra fecha = una actividad nueva enlazada a la anterior. Lo programado por error
  se elimina y no cuenta en los indicadores. Igual para correrías: "programé una correría y no pude ir" = no se hizo,
  con motivo. **Reemplaza** la decisión 5 de la versión anterior de esta spec ("reprogramar con historial", estado
  `reprogramada`) y la D3 de la spec de usabilidad (`agenda_reprogramar`).
- **A8**. Cancelar exige motivo. Cambia la decisión 46 de la fase 8 (F4.1: motivo opcional).
- **A9**. Cena: al planear se indican los médicos invitados; al reportar, cuáles asistieron y cuáles no. Solo médicos
  de la unidad de negocio: una líder solo agrega médicos de su línea o de sus Ejecutivos Comerciales (una líder de
  medicina deportiva no invita a un médico que no es de esa línea).
- **A10**. No se registra el costo de la cena por ahora.
- **A11**. Las actividades que no son visita se pueden reportar hasta 7 días tarde, con la marca "tarde".
- **A12**. Las líderes tienen días libres (motivos como congreso o viaje al exterior) y metas de correrías.
- **A13**. Paola tiene dos metas separadas: como Ejecutivo Comercial (vende 2 productos de Sustitutos óseos, mientras
  se importa Trauma) y como líder de su unidad.
- **A14**. Nombre de la app: duda entre "VG Campo" y "VG Tracker". No se cambia todavía.
- **A15**. No se importa el histórico del Excel. Se quita esa fase.
- **A16**. Al salir alguien de la empresa, se cancela lo que tenía planeado; la persona nueva agenda todo de nuevo.
- **A17**. Sí a subtipos institucionales nuevos como "Cobro / cartera" y "Seguimiento comercial".
- **Del mismo día, siguen en pie**:
  - Dos citas no pueden cruzarse en su media hora: bloqueo en el servidor, 409. Cambia la D4 de la spec de
    usabilidad.
  - La cita lleva hora, salvo la correría y el congreso de todo el día (decisión del 2026-10-15, "agenda con hora").
  - Dirección visual A, estilo Uber, para la app.

### De Claude (el dueño puede cambiarlas)

- **C1. Quien hace la actividad es la persona (`users.id`). El Ejecutivo Comercial es opcional en cada actividad.**
  Se descartaron dos alternativas:
  - Una tabla de "personas de campo": crea una tercera identidad que habría que mantener al día con `users.active`,
    con "Contratar" y con el traspaso.
  - Hacer a las líderes Ejecutivos Comerciales sin zona: choca con `executives_user_id_key UNIQUE`, porque Paola no
    puede tener dos filas. Además mete a las líderes al motor de cobertura (Trauma tiene 0 ejecutivos, así que Paola
    quedaría como alcance de Trauma en todo el país) y aparecerían en `/executives`, en el traspaso, en el anexo y en
    las metas generales.

  Ya hay un precedente de unir por usuario: `resolveUserLines` en `web/lib/coverage.ts`.
- **C2. `visits` sigue siendo solo para la visita a médico y la institucional.** Esa tabla alimenta el mapa de
  asignación y "IPS sin visitar" (5 km), y exige sede, un solo médico y coordenadas. Los otros 7 tipos van en una
  tabla nueva, `actividades`, donde el plan y el reporte son la misma fila.
- **C3. La lista de tipos es fija en el código.** Las reglas de cada tipo (sede, radio, asistentes, rango de fechas)
  son código y llevan pruebas. "Otro", con tema obligatorio, recoge lo demás.
- **C4. La cuota y las metas de visitas siguen siendo solo del Ejecutivo Comercial.**
  - Los 7 tipos nuevos no suman a las metas médica ni institucional: si sumaran, una junta con 10 médicos inflaría la
    meta diaria. Se muestran aparte, en "Otras actividades".
  - Un día de congreso, capacitación o correría cuenta como "día con otras actividades", no como "día sin visitas".
  - Lo que Paola hace como líder no suma a su cuota de Ejecutivo Comercial ni pasa por sus visitantes. Su meta de
    líder (correrías) va aparte (A13).
- **C5. "Dónde está" sale solo de lo que la persona reporta o planea.** Nunca del GPS del teléfono en segundo plano:
  `mobile/app.json` ya lo bloquea. En pantalla y en el mapa de calor se muestran la sede o el municipio, nunca las
  coordenadas del teléfono.
- **C6. Lo programado que no se cerró queda "Atrasado" o "Sin cerrar".** No se cierra solo: "Atrasado" el mismo día,
  pasada su hora, y "Sin cerrar" desde el día siguiente. Lo calcula la lectura; no es un estado guardado.
- **C7. Cancelar y "no se hizo" se distinguen por el momento.** Se cancela de hoy en adelante (como hoy, para no
  romper la app actual). "No se hizo" se marca desde el día de la cita, sin tope hacia atrás. El mismo día valen las
  dos.
- **C8. Eliminar por error** solo se puede con una cita propia, pendiente y de hoy en adelante. La fila no se borra
  (queda con estado `eliminada`, para auditoría) y no aparece en ninguna lectura ni indicador (B1).
- **C9. "Médico de las líneas L"** = médico con un visitante vigente (`medico_visitantes`) en alguna línea de L, o
  cuyo visitante vigente es un Ejecutivo Comercial activo con alguna línea de L. Se usa:
  - en las invitaciones y asistentes de la cena y demás actividades (A9);
  - en las citas y visitas médicas que la persona hace como líder. Como Ejecutivo Comercial todo sigue como hoy (sin
    bloqueo, con la marca `out_of_territory`).
- **C10. Motivos de cierre**, una lista corta igual para cancelar y para "no se hizo", con texto opcional (obligatorio
  en "Otro"): `cliente` ("El médico o el cliente no pudo"), `prioridad` ("Otra prioridad de la empresa"),
  `falta_tiempo` ("No alcanzó el tiempo"), `fuerza_mayor` ("Salud, clima o vía"), `otro` y `salida` (solo lo pone el
  sistema, A16).
- **C11. La salida (A16) la hacen disparadores**, en la misma transacción del cambio que la causa:
  - `users.active` pasa a false (baja en el traspaso con "desactivar usuario", o en `/users`);
  - o un Ejecutivo Comercial pasa a `inactive` y su usuario se queda sin líneas (deja de ser persona de campo).

  Cancelan lo pendiente de hoy en adelante con motivo `salida`. Lo de días pasados queda "Sin cerrar", como fue. No se
  toca el cuerpo de `ejecutivas_traspasar` (0820).
- **C12. La cita de quien tiene los dos papeles dice "como qué" la hace.** Una cita no lleva líneas (0840). Para
  Paola, la cita lleva `executive_id` si es como Ejecutivo Comercial y NULL si es como líder (`p.como`; por defecto
  `ejecutivo`, así la app actual sigue igual). Para los demás sale sola. Así la cuota, las metas y lo que ve cada líder
  (A2) no se mezclan.
- **C13. El servidor rechaza una cita de hoy a una hora que ya pasó** ("Esa hora ya pasó"). Cierra la D8 de la spec de
  usabilidad: ya hay un cambio de la API de agenda.
- **C14. "Ciudades importantes" del mapa de calor** = municipios con 200.000 habitantes o más (`population_2025`, hoy
  33). Se muestran las que la persona no pisó en el periodo (B2).
- **C15. Cada fase de base de datos va en dos entregas**: base de datos + API primero (la app de hoy sigue igual) y la
  app después.

## Modelo de datos

### Quién es quién

- **Persona de campo**: usuaria activa (`users.active`), que no es `commercial_director` (A1), con
  `persona_lineas(user)` no vacío.
- **`persona_lineas(user)`** es la unión de:
  - las `executive_lines` de su Ejecutivo Comercial activo;
  - las líneas activas con `business_lines.leader_user_id = user`.

  Se escribe dos veces, en SQL y en TS (`lineasParaReportar`), y las dos llevan las mismas pruebas.
- **El Ejecutivo Comercial de una visita o actividad** es el de la persona solo si alguna de sus líneas está en las
  `executive_lines` de ese Ejecutivo Comercial. Si no, queda NULL y la persona actúa como líder. En las citas, ver C12.
- **Con Ejecutivo Comercial**, todo sigue como hoy: zona obligatoria, zona de la visita, fuera de territorio según
  `medico_visitantes`, `config_personas`, cuota y días libres.
- **Sin Ejecutivo Comercial** (como líder):
  - La zona de la visita (`kam_id`) queda NULL y `kam_name` toma `users.full_name`.
  - `out_of_territory` queda en false.
  - Usa la configuración general: médica e institucional, radio general y sin telefónica. Así nunca cae al "punto de
    la zona" del mapa.
  - El médico debe ser de sus líneas (C9).
  - Sin cuota de visitas. Días libres y meta de correrías desde F3 (A12).
- **Candado, topes, idempotencia y duplicados van por persona**: `pg_advisory_xact_lock(hashtext('visitas_app:' ||
  user_id))`. Así Paola tiene una sola agenda, un solo tope por médico y un solo `client_id`.
- **El historial no se traspasa.** Las visitas, citas y actividades son de la persona y conservan el Ejecutivo
  Comercial y la zona de ese momento. Lo planeado de quien sale se cancela (A16, C11).

### Ciclo de vida de lo programado (A7)

Igual para las citas (`visitas_agenda`) y las actividades (`actividades`):

| Estado (valor) | Se muestra | Cómo se llega | Cuándo | En los indicadores |
|---|---|---|---|---|
| `pendiente` (citas) / `planificada` (actividades) | Programada; "Atrasada" o "Sin cerrar" si pasó (C6) | agendar, u "otra fecha" | — | planeadas |
| `hecha` (citas) / `realizada` (actividades) | Hecha: efectiva o no efectiva | reportar la visita o la actividad | desde su día | hechas |
| `no_realizada` | No se hizo | cerrar con motivo (C10) | desde su día (C7) | no se hizo, por motivo |
| `cancelada` | Cancelada | cancelar con motivo (A8), o la salida (A16) | de hoy en adelante (C7) | canceladas, por motivo |
| `eliminada` | no se muestra | eliminar por error | pendiente, de hoy en adelante (C8) | no cuenta |

- **Otra fecha** = una actividad nueva, `pendiente`, con `viene_de` = la anterior.
  - La anterior debe ser propia y estar cerrada: `no_realizada`, `cancelada` (no por `salida`) o `hecha` con una
    visita no efectiva.
  - Una actividad tiene a lo sumo una sucesora (`viene_de` UNIQUE). Puede haber cadena.
  - La nueva copia tipo, médico o cuenta, subtipo y sede; la fecha y la hora son nuevas; la sede y la nota pueden
    cambiar.
  - La anticipación de la nueva se mide desde su propio `created_at`. Su detalle dice "viene de la cita del 12 oct (no
    se hizo)".
- **Una pendiente no se mueve**: para cambiarle la fecha se cierra (o se cancela) y se pide otra fecha.
- **"Hecha" solo se llega reportando.** En una cita, con `visitas_registrar` (como hoy, la no efectiva también la
  cumple). En una actividad, con `actividad_reportar`.

### Tres migraciones: 0850, 0860 y 0870

| Migración | Fase | Qué | Rollback |
|---|---|---|---|
| `0850_persona_de_campo_y_agenda` | F1a | la persona como actor en `visits` y `visitas_agenda`, el ciclo de vida de las citas, el bloqueo de choques y la salida | `9945` |
| `0860_actividades_de_campo` | F2a | `actividades`, `actividad_lineas`, `actividad_asistentes` y sus funciones | `9946` |
| `0870_lideres_dias_libres_y_metas` | F3 | días libres por persona y metas de las líderes | `9947` |

- La 0850 cambia tablas que ya tienen datos (1 visita de la app y 20 citas) y su rollback tiene guardas. Reescribe de
  una vez los cuerpos de `agenda_crear` y `agenda_cancelar`: pasar a `user_id`, el bloqueo y el ciclo de vida tocan las
  mismas funciones, y así se vigila una sola huella md5.
- La 0860 es aditiva y no toca `visits`.
- Los rollbacks se corren en orden inverso: `9947`, `9946`, `9945`.
- Todas se aplican solo con autorización del dueño, en la misma ventana que el despliegue de su código, seguidas de
  `NOTIFY pgrst, 'reload schema'`. Todas son transaccionales y se pueden volver a correr. El ensayo en una base de
  prueba lo hace el orquestador, nunca contra producción sin autorización.

**Errores para la API** (los mismos códigos en las tres):

| SQLSTATE | Significa | HTTP |
|---|---|---|
| 22023 | forma | 400 |
| 23514 | regla, con mensaje para la persona | 400 |
| 23505 | repetida (cita con el mismo médico ese día, segunda "otra fecha") | 409 |
| 23P01 | choque de media hora o de correrías | 409, con el error en `hora` (o `fecha_desde`) |
| P0002 | inexistente o ajena | 404 |

### 0850 — `AAAA-MM-DD_0850_persona_de_campo_y_agenda.sql` (F1a)

0. **Precondiciones**
   - La 0830 y la 0840 están aplicadas. En producción la última es `visitas_agenda_0840`.
   - El md5 de `visitas_registrar`, `visitas_editar`, `visitas_anular`, `agenda_crear` y `agenda_cancelar` es el de
     la 0840; el de `visitas_config_vigente`, `visitas_distancia_m` y `ejecutivas_traspasar`, el de sus migraciones (no
     se tocan).
   - Se toma la huella de las 7.033 visitas de VMO.
1. **`visits`**
   - Columna nueva `user_id` (uuid, NULL, → `users`). Relleno: las visitas de la app toman `executives.user_id`. Hoy
     es 1 fila. Si queda alguna de la app sin `user_id`, la migración se detiene.
   - `visits_app_check` se reescribe igual, salvo la parte de las de la app:
     - pasa a exigir `user_id IS NOT NULL`;
     - deja de exigir `executive_id` y `kam_id`, y exige `(executive_id IS NULL) = (kam_id IS NULL)`;
     - sin Ejecutivo Comercial, `out_of_territory` es false.
   - Índices nuevos: `visits_user_date_idx (user_id, visit_date) WHERE source = 'app'` y
     `visits_user_next_step_idx (user_id, next_step_date) WHERE source = 'app' AND next_step_date IS NOT NULL`. Se
     conservan los de `executive_id`.
2. **`visitas_agenda`**
   - `user_id` (uuid, → `users`): se añade NULL, se rellena desde `executives.user_id` (hoy 20 filas, todas de una
     persona) y pasa a NOT NULL. No se rellena desde `created_by`, porque las 20 las creó un admin en la simulación.
   - `executive_id` pasa a NULL (C12).
   - Columnas nuevas:
     - `motivo_codigo` (text, NULL): `cliente`, `prioridad`, `falta_tiempo`, `fuerza_mayor`, `otro` o `salida`
       (`visitas_agenda_motivo_codigo_check`).
     - `no_realizada_at` (timestamptz) y `no_realizada_motivo` (text, ≤ 300).
     - `eliminada_at` (timestamptz) y `eliminada_por` (uuid, → `users`).
     - `viene_de` (uuid, → `visitas_agenda`, UNIQUE): `visitas_agenda_viene_de_uidx`, y `viene_de <> id`.
   - `visitas_agenda_estado_check`: `pendiente`, `hecha`, `no_realizada`, `cancelada` o `eliminada`.
   - `visitas_agenda_estado_datos_check`, por estado:
     - `pendiente`: sin visita, sin cancelación, sin cierre y sin eliminación;
     - `hecha`: con `visita_id`;
     - `no_realizada`: con `no_realizada_at` y `motivo_codigo`, sin visita;
     - `cancelada`: con `cancelada_at`; `motivo_codigo` obligatorio en las nuevas (las canceladas de antes, hoy 0,
       pueden no tenerlo); sin visita;
     - `eliminada`: con `eliminada_at`, sin visita;
     - con `motivo_codigo = 'otro'`, el texto del motivo es obligatorio.
   - Los índices únicos `visitas_agenda_medico_uidx (user_id, fecha, medico_id)` y `visitas_agenda_cuenta_uidx
     (user_id, fecha, cuenta_id, subtipo_id)` se rehacen por `user_id` y solo para `estado IN ('pendiente', 'hecha')`.
   - Índice nuevo `visitas_agenda_user_fecha_idx (user_id, fecha)`. Se conserva `visitas_agenda_executive_fecha_idx`.
   - Se corrige el comentario de la columna `hora` ("opcional…"): la cita nueva lleva hora; NULL solo en las viejas.
   - No hay `EXCLUDE` para el choque (pediría `btree_gist`): el candado por persona serializa y la función decide.
3. **Funciones nuevas**, de solo `service_role` y `SECURITY INVOKER`:
   - `persona_lineas(p_user uuid) → uuid[]`: la unión de "Quién es quién"; `'{}'` si el usuario está inactivo o es
     `commercial_director`.
   - `persona_de_campo(p_user uuid) → jsonb`
     `{ user_id, nombre, rol: 'ejecutivo'|'lider'|'lider_y_ejecutivo', executive_id, kam_id, lineas_ec[], lineas_lider[] }`.
     Errores 23514:
     - `commercial_director`: "La dirección comercial no agenda ni reporta: sigue a tu equipo en Equipo" (A1);
     - sin líneas: "Tu usuario no tiene líneas para reportar";
     - Ejecutivo Comercial activo sin zona base: "Tu Ejecutivo Comercial no tiene zona base" (como hoy).
   - `ejecutivo_de_la_visita(p_user uuid, p_lineas uuid[]) → uuid`: su Ejecutivo Comercial si alguna línea está en
     sus `executive_lines`; si no, NULL.
   - `medico_de_lineas(p_medico uuid, p_lineas uuid[], p_fecha date) → boolean`: la regla C9.
   - `visitas_config_persona(p_executive uuid, p_fecha date) → jsonb`: con Ejecutivo Comercial llama a
     `visitas_config_vigente` (no se toca); con NULL devuelve la configuración general con perfil
     `{medica, institucional}` y telefónica deshabilitada.
   - `agenda_choque(p_user uuid, p_fecha date, p_hora time, p_excluir uuid) → jsonb`: la primera cita suya de ese día
     en `pendiente` o `hecha`, con hora, y `|hora − p_hora| < 30 min`, como `{ cita_id, hora, con_quien }`; o NULL. Es
     la misma regla que `sePisan` en `mobile/lib/agenda.ts`. Las citas sin hora, `no_realizada`, `cancelada` y
     `eliminada` no chocan. Hoy hay 0 pares que se crucen en producción.
   - `agenda_cerrar(p_id uuid, p jsonb, p_user uuid) → jsonb { cita_id, estado }`, con
     `p = { motivo_codigo, motivo? }`: "No se hizo".
     - Solo la cita propia ("Esa cita no existe", P0002) y `pendiente` ("Esa cita ya está cerrada", 23514).
     - De su día o anterior ("Esa cita todavía no llega: cancélala", 23514).
     - Motivo de la lista sin `salida`; con `otro`, texto de 3 a 300 caracteres.
   - `agenda_eliminar(p_id uuid, p_user uuid) → jsonb { cita_id }`: propia, `pendiente` y de hoy en adelante (C8). Deja
     `eliminada`, `eliminada_at` y `eliminada_por`.
   - `agenda_otra_fecha(p_id uuid, p jsonb, p_user uuid) → jsonb { cita_id, viene_de }`, con
     `p = { fecha, hora, sede_id?, nota?, como? }`.
     - La anterior: propia y cerrada según "Ciclo de vida" ("Esa cita sigue programada: ciérrala o cancélala antes",
       23514).
     - Sin sucesora ("Esa cita ya tiene otra fecha", 23505).
     - Copia tipo, médico o cuenta, subtipo y sede, y llama a `agenda_crear` con `viene_de`: pasa por todas sus reglas.
   - `agenda_cancelar_por_salida()` (función de disparador; C11, A16): pasa a `cancelada`, con `motivo_codigo =
     'salida'` y el texto "Salió de la empresa", las citas `pendiente` de hoy en adelante de la persona. Disparadores:
     - `users_salida_cancela_agenda`: `AFTER UPDATE OF active ON users`, cuando pasa de true a false;
     - `executives_baja_cancela_agenda`: `AFTER UPDATE OF status ON executives`, cuando pasa a `inactive` y
       `persona_lineas(user_id)` queda vacío.
4. **Funciones reemplazadas**. Mismas firmas, salvo `agenda_cancelar`. La API de hoy sigue funcionando, así que la
   migración puede ir antes que el código.
   - `visitas_registrar(p jsonb, p_user uuid)`:
     - La persona sale de `persona_de_campo(p_user)`. `p.executive_id`, si viene, debe ser el suyo.
     - Las líneas deben estar en `persona_lineas` ("Alguna de las líneas no es tuya", 23514).
     - `executive_id = ejecutivo_de_la_visita(...)`. Sin él: `kam_id` NULL, `kam_name` = `users.full_name`,
       `out_of_territory` false, `visitas_config_persona(NULL, fecha)`, y en la médica `medico_de_lineas` ("Ese médico
       no es de tus líneas", 23514).
     - Escribe `user_id`. Candado, tope por médico y vínculo con la cita van por `user_id`.
   - `visitas_editar(p_id uuid, p jsonb, p_user uuid)` y `visitas_anular(p_id uuid, p_motivo text, p_user uuid)`: la
     visita es de la persona por `user_id`. Anular devuelve la cita a `pendiente`, como hoy.
   - `agenda_crear(p jsonb, p_user uuid)`, con `p` + `como?` + `viene_de?`:
     - Persona por `user_id`; `executive_id` según C12 (`como = 'lider'` exige líneas de líder; `como = 'ejecutivo'`
       exige Ejecutivo Comercial).
     - Hora obligatoria ("Elige la hora de la cita"); de hoy a una hora que ya pasó, rechazada ("Esa hora ya pasó",
       C13).
     - Sin tope hacia adelante (A4): se quita `c_dias_adelante`. Sigue "No se agenda en el pasado".
     - Día libre: se revisa solo con Ejecutivo Comercial (en F3, también por persona).
     - Perfil con `visitas_config_persona`. Sin Ejecutivo Comercial, la médica exige `medico_de_lineas` con sus líneas
       de líder.
     - Duplicado (23505) por `user_id`, solo contra `pendiente` y `hecha`.
     - Choque con `agenda_choque` → 23P01 "A las 09:30 ya tienes cita con …: elige otra hora".
     - Con `viene_de`, las reglas de `agenda_otra_fecha`.
   - `agenda_cancelar`: se reemplaza `(p_id uuid, p_motivo text, p_user uuid)` por
     `(p_id uuid, p_motivo text, p_user uuid, p_motivo_codigo text DEFAULT 'otro')` (DROP + CREATE en la misma
     transacción; la llamada de hoy, con 3 argumentos por nombre, sigue valiendo).
     - Motivo obligatorio (A8): con `otro`, el texto de 3 a 300 caracteres ("Escribe el motivo de la cancelación").
     - `salida` no se acepta desde aquí.
     - Lo demás como hoy: propia, `pendiente`, de hoy en adelante.
5. **Privilegios**: `REVOKE` a PUBLIC, anon y authenticated; `EXECUTE` a `service_role`. No hay políticas RLS nuevas.
6. **Bloque DO de pruebas** (`RAISE SQLSTATE 'P0850'`), que se deshacen al terminar:
   - Una líder real sin Ejecutivo Comercial agenda y reporta una visita médica presencial de su línea, con un médico de
     su línea. Una línea ajena y un médico ajeno se rechazan.
   - Un usuario sin líneas y la directora se rechazan, cada uno con su mensaje.
   - Paola: una visita de Trauma queda con `executive_id` NULL y una de Sustitutos óseos con su Ejecutivo Comercial.
     Las dos van a la misma agenda y al mismo tope por médico. Una cita `como = 'lider'` queda sin Ejecutivo Comercial.
   - Choque: 09:00 contra 09:15 se rechaza; 09:00 contra 09:30 se acepta; una cita sin hora, una `no_realizada` y
     una `cancelada` nunca chocan.
   - Sin tope: una cita a hoy + 400 se acepta. Hoy a una hora pasada se rechaza.
   - Ciclo de vida: cerrar la propia de ayer (sí), la de mañana (no), la ajena (404), una hecha (no); cancelar sin
     motivo (no), con `otro` y texto (sí), con `salida` (no); eliminar la propia pendiente (sí; deja de contar en el
     índice único y en el choque), una hecha (no), una de ayer (no); otra fecha de una `no_realizada` (sí), de una
     pendiente (no), dos veces (23505), en cadena (sí).
   - Salida: desactivar un usuario de prueba cancela sus citas de hoy en adelante con `salida` y deja las de ayer;
     dar de baja al Ejecutivo Comercial de Paola no cancela sus citas de líder.
   - Las 20 citas y la visita existentes conservan su vínculo y quedan con su `user_id`; las 7.033 de VMO quedan
     idénticas.

**Rollback `9945`**:
- Se detiene, mostrando el conteo, si hay citas `no_realizada` o `eliminada`, citas con `viene_de`, citas con
  `executive_id` NULL, o visitas de la app con `executive_id` NULL. Esas filas no cumplen las reglas de la 0840, y el
  dueño decide antes qué hacer con ellas.
- Si no, restaura los cuerpos de la 0840 (copia exacta, incluida la firma de 3 argumentos de `agenda_cancelar`), los
  índices por `executive_id`, el NOT NULL y los CHECK, y quita los disparadores, las columnas, los índices y las
  funciones nuevas.

### 0860 — `AAAA-MM-DD_0860_actividades_de_campo.sql` (F2a)

**Tabla `actividades`.** Una fila es el plan y también el reporte.

**Quién y de qué tipo**

| Columna | Tipo y regla |
|---|---|
| `id` | uuid PK |
| `user_id` | NOT NULL → `users` |
| `executive_id` | NULL → `executives`, con la regla de "Quién es quién" |
| `tipo` | `reunion_clinica`, `comida`, `capacitacion`, `congreso`, `cirugia`, `correria` u `otro` |
| `estado` | `planificada`, `realizada`, `no_realizada`, `cancelada` o `eliminada` (ciclo de vida) |

**Cuándo**

| Columna | Tipo y regla |
|---|---|
| `fecha_desde`, `fecha_hasta` | NOT NULL; `fecha_hasta` ≥ `fecha_desde` y ≤ `fecha_desde` + 13; varios días solo en `correria` y `congreso` |
| `hora`, `todo_el_dia` | `todo_el_dia` es verdadero exactamente cuando `hora` es NULL; solo `correria`, `congreso` y `capacitacion` pueden ser de todo el día |

**Dónde y con quién**

| Columna | Tipo y regla |
|---|---|
| `municipio_id` | varchar(5) → `municipalities(code)`; se deriva de la sede si hay sede |
| `cuenta_id`, `sede_id` | NULL → `cuentas` y `sedes` |
| `medico_id` | NULL; el cirujano, solo en `cirugia` |
| `acompana_executive_id` | NULL → `executives`; "Voy con", solo en `correria` (A6); un Ejecutivo Comercial activo con alguna línea de la actividad |
| `tema` | ≤ 200; nombre del evento, tema u objetivo |
| `momento` | `cena`, `almuerzo` o `desayuno`; solo en `comida` |
| `dirigida_a` | `equipo_vg`, `cuenta` o `medicos`; solo en `capacitacion` |
| `modalidad` | `presencial` o `virtual` |
| `asistentes_aprox` | int, NULL; solo en `capacitacion` |

**Resultado**

| Columna | Tipo y regla |
|---|---|
| `efectiva`, `motivo_no_efectiva` | solo en `reunion_clinica` y `cirugia` realizadas |
| `comentario` | ≤ 2000 |
| `compromisos` | ≤ 1000; 'Ninguno' vale |
| `proxima_reunion` | date; solo en `reunion_clinica` |
| `transcripcion` | interna, como en `visits` |

**Rastro, sin coordenadas**

| Columna | Tipo y regla |
|---|---|
| `municipio_telefono` | varchar(5); la cabecera más cercana al punto del teléfono al reportar |
| `distancia_sede_m`, `dentro_radio` | solo en las presenciales con sede |

**Ciclo de vida**

| Columna | Tipo y regla |
|---|---|
| `programada_at` | timestamptz NULL; cuándo se planeó; NULL si se reportó sin plan |
| `reportada_at`, `reportada_tarde` | `reportada_tarde`: reportada 2 a 7 días después de `fecha_hasta` (A11) |
| `motivo_codigo` | la lista de C10; en `no_realizada` y `cancelada` |
| `no_realizada_at`, `no_realizada_motivo` | como en las citas |
| `cancelada_at`, `cancelada_motivo` | como en las citas |
| `eliminada_at`, `eliminada_por` | como en las citas |
| `viene_de` | UNIQUE → `actividades`; "otra fecha" |
| `anulada_at`, `anulada_por`, `anulada_motivo` | un reporte equivocado, como en `visits` |
| `client_id` | UNIQUE; idempotencia |
| `created_by`, `created_at`, `updated_at` | |

- CHECK por tipo: los de la tabla de tipos. Exigen `municipio_id` o `sede_id`.
- CHECK por estado: como en `visitas_agenda`.
- Disparadores: `updated_at` y `visitas_sin_borrar()` (una actividad no se borra: se cancela, se elimina por error o
  se anula).

**Tabla `actividad_asistentes`**: `id`, `actividad_id`, `medico_id` (NOT NULL), `invitado` (boolean, NOT NULL) y
`asistio` (boolean, NULL).
- `UNIQUE (actividad_id, medico_id)`.
- El médico debe ser `medico_de_lineas(medico, líneas de la actividad, fecha_desde)` ("Ese médico no es de tus
  líneas", A9, C9).
- En la cena: al planear, los invitados (`invitado = true`, `asistio` NULL; al menos uno). Al reportar, cada invitado
  queda `asistio` true o false ("¿Quiénes asistieron?"), y se pueden añadir no invitados que asistieron (`invitado =
  false`, `asistio = true`).
- En los demás tipos, los asistentes son opcionales y se registran al reportar (`asistio = true`). El congreso admite
  hasta 5 destacados.
- Solo médicos de OpMap. Nunca crea fichas en `medicos`: un médico se crea completo, en su flujo.

**Tabla `actividad_lineas`**: `(actividad_id, business_line_id)` PK. Al menos una, y todas en `persona_lineas`.

**Índices**: `(user_id, fecha_desde)`, `(user_id, estado, fecha_desde)`, `(municipio_id, fecha_desde)` y
`(acompana_executive_id, fecha_desde)`.

**Funciones**: todas con el candado de la persona y de solo `service_role`.
- `actividad_crear(p jsonb, p_user uuid)` (planear):
  - Sin tope hacia adelante (A4); no en el pasado.
  - Choque de su media hora con citas y actividades con hora (23P01).
  - Una correría no se cruza con otra de la misma persona: "Ya tienes una correría del 18 al 21" (23P01).
  - Día libre: como en `agenda_crear`.
  - `acompana_executive_id`: un Ejecutivo Comercial activo de sus líneas.
- `actividad_reportar(p jsonb, p_user uuid)`, de dos formas: reporte directo (con `client_id`) o cierre de una
  planificada como `realizada` (con `actividad_id`). Valida según el tipo. Calcula `reportada_tarde`,
  `municipio_telefono` y `dentro_radio`. Ventana: de `fecha_desde` a `fecha_hasta` + 7 (A11).
- `actividad_cerrar(p_id, p, p_user)` (no se hizo), `actividad_cancelar(p_id, p, p_user)` (motivo obligatorio),
  `actividad_eliminar(p_id, p_user)` y `actividad_otra_fecha(p_id, p, p_user)`: las reglas de las citas.
- `actividad_editar(p_id, p, p_user)`: dentro de `plazo_gracia_horas`. `actividad_anular(p_id, p_motivo, p_user)`.
- `agenda_choque`: `CREATE OR REPLACE` para que mire también las actividades `planificada` y `realizada` con hora.
- `agenda_cancelar_por_salida()`: `CREATE OR REPLACE` para que cancele también las actividades planificadas.

**Bloque DO** (`P0860`):
- Cada tipo, válido y con su rechazo típico.
- Choque entre una cita a las 10:00 y una cena a las 10:15.
- Una correría que se cruza con otra.
- Una cena sin invitados; un invitado que no es de las líneas; reportar la cena con asistió sí y no, y un no invitado.
- Reporte de ayer sin marca, de hace 5 días con marca `tarde` y de hace 8 días rechazado.
- Ciclo de vida: cerrar, cancelar, eliminar y otra fecha, como en la 0850.
- Idempotencia por `client_id`.
- La salida cancela también las actividades planificadas.
- Las tablas de la 0850 y las 7.033 de VMO quedan idénticas.

**Rollback `9946`**: se detiene si hay actividades. Si no, restaura `agenda_choque` y `agenda_cancelar_por_salida` de
la 0850 y quita las tablas y funciones.

### 0870 — `AAAA-MM-DD_0870_lideres_dias_libres_y_metas.sql` (F3)

- **Días libres por persona (A12)**:
  - `dias_libres.user_id` (uuid, NULL, → `users`), rellenado desde `executives.user_id`. `executive_id` pasa a NULL.
    CHECK: al menos uno de los dos. Las vacantes (sin usuario) siguen con `executive_id`.
  - Una líder registra sus días con los motivos de la lista; se añaden "Congreso o evento" y "Viaje al exterior" como
    datos en `/configuracion`, no en código. Si en el congreso hay algo que reportar, es una actividad "Congreso".
  - La aprobación es la de hoy (en bloque, en `/calendario`), por quien esté en `aprobacion_dias_libres`.
  - `agenda_crear` y `actividad_crear` revisan el día libre por persona.
- **Metas de las líderes (A12, A13)**: tabla `config_lideres` (`user_id`, `meta_correrias_mes`, vigencias, motivo y
  rastro, la misma forma de `config_personas`). Solo la escriben `config_registrar` y `config_cerrar` (se reemplazan
  para aceptar la tabla nueva).
  - Cuenta una correría `realizada` cuyo `fecha_desde` cae en el mes. También se muestran los días de correría.
  - Paola tiene sus dos metas: la de Ejecutivo Comercial (`config_personas` y la cuota de hoy, solo con lo de
    Sustitutos óseos) y la de líder (`config_lideres`, con sus correrías).
- **Rollback `9947`**: se detiene si hay días libres sin `executive_id` o filas en `config_lideres`.

## Tipos de actividad: formulario y reglas

| Tipo (etiqueta visible) | Valor | Tabla | Con quién y dónde | Fecha y hora | GPS y radio | Resultado | Médicos | Comentario, compromisos y próxima | Metas |
|---|---|---|---|---|---|---|---|---|---|
| Visita a médico | `medica` | `visits` | médico + sede | hoy, hora real | radio, como hoy | efectiva o no efectiva + motivo | — | conclusión, compromisos y próxima reunión | como hoy |
| Visita institucional | `institucional` | `visits` | cuenta + sede + subtipo (+ contacto) | hoy | radio | efectiva o no efectiva + motivo | — | igual | según el subtipo, como hoy |
| Reunión o junta en clínica | `reunion_clinica` | `actividades` | cuenta + sede, obligatorias | con hora | radio si es presencial; sin GPS si es virtual | efectiva o no efectiva + motivo | opcionales, de sus líneas | comentario, compromisos y próxima reunión | no suma |
| Cena o almuerzo comercial | `comida` + momento | `actividades` | municipio; cuenta opcional | con hora | sin radio; rastro = municipio del teléfono | realizada | invitados al planear; asistió sí o no al reportar (A9) | comentario y compromisos | no suma |
| Capacitación | `capacitacion` | `actividades` | dirigida a (equipo VG, cuenta o médicos) + tema; municipio si es presencial | hora o todo el día | sin radio | realizada | opcionales + cantidad aproximada | comentario y compromisos opcionales | no suma |
| Congreso o evento | `congreso` | `actividades` | nombre del evento + municipio | rango de 1 a 14 días, todo el día | sin radio | realizada | no se piden; hasta 5 destacados | comentario | no suma |
| Acompañamiento a cirugía | `cirugia` | `actividades` | sede; cirujano opcional | con hora | radio | efectiva o no efectiva | el cirujano | comentario (nunca datos del paciente: no hay campo) | no suma |
| Correría | `correria` | `actividades` | un municipio; "Voy con" (Ejecutivo Comercial de la zona) opcional; objetivo | rango de 1 a 14 días, todo el día; se planea | sin GPS: el rastro sale de lo que reporta esos días | realizada o no se hizo, con motivo (A7) | — | balance opcional al cerrar | meta de correrías de la líder (F3) |
| Otro | `otro` | `actividades` | tema obligatorio; municipio opcional | hora o todo el día | sin radio | realizada | opcionales | comentario y compromisos opcionales | no suma |

Reglas comunes:

- **Ventana para reportar.** Las actividades que no son visita se reportan entre `fecha_desde` y `fecha_hasta` + 1 día
  ("la cena de anoche") sin marca. Hasta 7 días después, con la marca "tarde", que la directora ve (A11). Después, solo
  se cierran como "no se hizo" o se cancelan.
- **Las visitas no cambian**: mismo día y plazo de gracia, como hoy.
- **Correría con la Ejecutiva Comercial de la zona (A6)**:
  - Al planear, "Voy con" ofrece los Ejecutivos Comerciales activos de sus líneas. Elegida una, se ven sus citas y
    actividades de esos días (`GET /api/me/acompanamiento`), para alinearse sin copiar nada.
  - La Ejecutiva ve en su agenda la banda "<líder> viene contigo del 18 al 21", de solo lectura.
  - Si no van juntas, la correría se planea sin "Voy con".
- **Correría de dos ciudades**: son dos correrías seguidas. Las actividades de esos días quedan unidas a la correría
  por persona, fechas y municipio. No hay una columna para eso.
- **Líneas**: al menos una. Por defecto vienen marcadas todas las de la persona; quien tiene dos papeles elige.
- **Ciudad**: se elige con `SelectorMunicipio` (código DANE), nunca se escribe. Lo dictado se resuelve con
  `municipio-alias`.
- **Médicos (A9, C9)**: se buscan entre los médicos de las líneas de la actividad, por nombre, prefiriendo la ciudad
  de la actividad. Un médico que no es de esas líneas no aparece y el servidor lo rechaza.
- **"Mis médicos" de una líder** son los médicos de sus líneas (C9), más el buscador con la misma regla.
- **Subtipos institucionales nuevos** ("Cobro / cartera" y "Seguimiento comercial", A17): son datos que se cargan
  desde `/configuracion` en modo seguimiento, sin código (F0).

## La app (una sola)

Se construye sobre la dirección visual A (estilo Uber), que se aplica antes, en su propio cambio. F1b y F2b usan sus
componentes y no los rediseñan.

- **Sesión**
  - `GET /api/auth/me` (MeResponse) añade
    `persona: { rol: 'ejecutivo'|'lider'|'lider_y_ejecutivo', lineas: [{ id, nombre, como: 'ejecutivo'|'lider' }] } | null`.
  - `ejecutiva` sigue igual: es null si no hay Ejecutivo Comercial.
  - La directora (sin `visits:report` desde F1a) ve al entrar "La dirección comercial sigue a su equipo en la web
    (Equipo)" y no entra a las pestañas.
- **Hoy**
  - Desaparece el aviso "no está enlazado" para quien es persona de campo.
  - Muestra:
    - "Actividades de hoy": las visitas, las citas y las actividades planeadas.
    - La banda "De correría en Cartagena · día 2 de 4" (y "Con <Ejecutiva>" si va acompañada).
    - "¿Qué pasó con esto?" para lo atrasado y lo sin cerrar, con Reportar, "No se hizo" y Cancelar (si aún es hoy).
  - Tocar algo planeado abre Reportar con eso ya elegido, como las citas en la tanda 1.
- **Reportar** empieza por "¿Qué hiciste?", con los 9 tipos (el tipo se oculta si viene de un plan). Luego:
  - La tarjeta por toques se adapta al tipo.
  - La voz de las visitas sigue igual en F1 y F2. En F5 la voz propone los tipos nuevos.
- **Agenda**
  - Agendar empieza por "¿Qué vas a hacer?". Después vienen el calendario sin tope hacia adelante (A4) y la hora, o
    "Todo el día" + "Hasta" en correría y congreso.
  - Paola elige "Como Ejecutivo Comercial" o "Como líder" (C12). Los demás no ven esa opción. ("Ejecutivo Comercial"
    siempre así en la app: la regla del dueño del 2026-10-29 manda sobre el texto del 15.)
  - Mi agenda dibuja la correría y el congreso como una banda sobre sus días.
  - En el detalle de algo programado: Reportar, "No se hizo" (con motivo), Cancelar (con motivo, A8), "Agendar otra
    fecha" (después de cerrar) y "Eliminar: lo agendé por error" (C8). No hay "Mover".
  - El detalle de una actividad que viene de otra dice "Viene de la cita del 12 oct · No se hizo".
  - El choque es un error del servidor: "A las 09:30 ya tienes cita con …: elige otra hora". `avisoChoque` de la
    tanda 1 deja de decir "Puedes agendar igual".
- **Números**
  - Sin Ejecutivo Comercial no hay cuota: `/api/me/numeros` devuelve `cuota: null`.
  - Paola ve dos bloques: "Como Ejecutivo Comercial · Sustitutos óseos" (cuota) y "Como líder · Trauma" (correrías del
    mes contra su meta, desde F3).
  - Todos ven "Otras actividades del mes" por tipo y la agenda: planeadas, hechas, no se hizo, canceladas y
    anticipación (mediana y % con 7 días o más).
- **Días libres**: se oculta sin Ejecutivo Comercial hasta F3; desde F3, todas las personas de campo.
- **Ajustes** muestra "Líder · Trauma" y "Ejecutivo Comercial · Sustitutos óseos · <zona>", según el caso.
- **Barra de abajo**: no cambia. `PESTANAS` sigue en hoy, reportar, agenda, numeros y ajustes, como pide la prueba 15
  de usabilidad.

**Textos visibles.** Cambian:

| Hoy | Pasa a |
|---|---|
| "Reportar visita" | "Reportar actividad" |
| "Visitas de hoy" | "Actividades de hoy" |
| "Tipo de visita" | "¿Qué hiciste?" |
| "Visita no agendada" | "No agendada" |
| "Reporta la visita por toques" | "Repórtalo por toques" |
| "Cancelar esta cita" (motivo opcional) | "Cancelar" (motivo obligatorio) |
| Prompt: "asistente de reporte de visitas" | "asistente de reporte de actividades de campo" |

Las metas siguen diciendo "Visitas a médicos" y "Visitas institucionales", porque son tipos. El nombre de la app no
cambia (A14). El título del mapa web ("Visualización de Visitas Médicas") no se toca sin su visto bueno: está en el
mapa.

## Voz (fase F5)

- **Tipos en la herramienta.** `proponer_visitas` admite `TipoActividad` sin `correria`: una correría se planea en
  Agendar, y el aviso lo dice.
- **Campos nuevos, todos sin null.** La herramienta estricta ya usa 12 de los 16 parámetros con unión que permite la
  API y 0 opcionales.

  | Campo | Forma |
  |---|---|
  | `fecha` | AAAA-MM-DD; en las visitas se fuerza a hoy y en las demás se admite de hoy a hace 7 días |
  | `tema` | texto; "" si no lo dijo |
  | `ciudad_dicha` | texto; "" si no la dijo |
  | `asistentes_ids` | lista de ids del contexto (solo médicos de sus líneas) |
  | `asistentes_dichos` | lista de nombres que no cruzaron: se muestran para elegir, nunca se guardan como texto |
  | `momento` | enum con `no_aplica` |
  | `dirigida_a` | enum con `no_aplica` |

  Siguen 12 uniones de 16. `normalizarPropuesta` convierte "" en null.
- **Prompt.**
  - La regla 1 pasa a "una actividad por persona, gestión o evento".
  - Hay una regla corta por tipo.
  - La regla 6 (efectiva) se aplica solo a visitas, reunión y cirugía.
  - Las reglas de las visitas van primero y no cambian.
- **Contexto**: se añaden "ayer" con el nombre del día y el municipio del punto.
- **Lo que no cambia**: modelo, effort y número de llamadas.
- **Evaluación antes de integrar**: unos 20 dictados, que son filas del Excel parafraseadas sin nombres reales, más
  los de la simulación.
  - Las visitas médicas deben acertar lo mismo que hoy, y los tipos nuevos al menos 90 %.
  - Cuesta menos de 1 USD en llamadas a OpenAI y Claude. Se avisa al dueño antes de correrla.

## Vista de la directora: `/equipo`

> **Hecho de otra forma el 2026-10-31**: "Equipo" vive en la app de campo (pestaña `/campo/equipo`), no en una página
> web; sin "Próximas semanas", mapa de calor ni Excel por ahora. Ver `docs/decisiones/2026-10-31-equipo-en-la-app.md` y
> `docs/specs/2026-10-31-equipo-en-la-app-y-ejecutivos-de-vuelta.md`. Lo de abajo queda como la idea original.

**Permisos.**
- `team:view` (nuevo) para `admin`, `commercial_director` y `line_leader`: Hoy, Próximas semanas y Tablero.
- `team:map` (nuevo) solo para `commercial_director` y `admin` (el dueño): Mapa de calor (A3).
- El alcance lo pone la API con `personasVisibles(usuario)`, una función pura:
  - Dirección y administración ven a todas las personas de campo.
  - Una líder se ve a sí misma y ve a los Ejecutivos Comerciales activos de sus líneas (`ejecutivasDeMisLineas`
    filtrado por `status = 'active'`). No ve a las otras líderes (A2).
  - Si un Ejecutivo Comercial de su línea es también líder (Paola, para la líder de Sustitutos óseos), lo ve solo como
    Ejecutivo Comercial: sus visitas, citas y actividades con `executive_id`. Lo que hace como líder no se le muestra.
  - Los Ejecutivos Comerciales no se ven entre sí.

**Personas.** Son las usuarias activas que son persona de campo; las vacantes no salen y la directora tampoco (A1).
Hoy son 14: 10 Ejecutivos Comerciales activos con usuario y 4 líderes sin Ejecutivo Comercial. Paola sale una sola
vez, con dos etiquetas.

**Menú**: "Equipo", después de Calendario. Se ajusta `menu-check`. La página se ve a 390 px: la directora y las líderes
la abren desde el celular.

**Pestaña Hoy** ("¿Dónde está mi gente?"):
- Arriba, un texto fijo: "Lo que cada persona reporta o agenda. La app no sigue la ubicación."
- Un resumen por ciudad, por ejemplo "Cartagena 2 · Bogotá 6 · Sin reporte ni plan 3".
- Una tarjeta por persona. `dondeEsta` toma el primer caso que se cumple:
  1. Día libre aprobado de día completo, o festivo sin nada reportado.
  2. Correría o congreso en curso: "De correría en Cartagena · día 2 de 4 · con <Ejecutiva> · planeada hace 12 días".
  3. Última actividad presencial reportada hoy: "10:40 · <sede>, Montería (hace 35 min)". Pasadas 3 horas dice "Último
     reporte hace 4 h".
  4. Algo planeado entre 30 min antes y 60 min después (como `citaDeAhora`): "Planeado 11:00 · <sede>".
  5. "Sin reportes ni plan hoy".
- Las telefónicas y las virtuales no ubican a la persona.
- Cada dato lleva su fuente: Reportado, Planeado o Correría declarada.
- El rastro del día va por hora, con:
  - el tipo;
  - con quién: médico, cuenta o "Cena · 6 de 8 invitados";
  - la sede o el municipio;
  - el estado: Hecha, No efectiva, No se hizo, Cancelada, Programada, Atrasada o Sin cerrar;
  - "planeada hace N días" o "no planeada", y "viene de …" si es otra fecha.
- Al final va "Siguiente" con lo de hoy y los 2 días que vienen.
- Hay un selector de día, para ver cualquier día pasado.
- Filtros: todas, líderes o Ejecutivos Comerciales, y línea.
- La página se relee cada 5 minutos mientras está a la vista: lee reportes, no pide ubicación.

**Pestaña Próximas semanas**:
- Una cuadrícula con las personas en filas y los días en columnas: 14 días, o 4 semanas como opción. Sin tope: se
  puede avanzar de a 14 días (A4).
- Cada celda muestra la ciudad del día. La correría y el congreso van como banda; el día libre en gris; el festivo
  marcado.
- Tocar una celda muestra sus actividades con su anticipación; las de menos de 7 días van marcadas (A5).
- En el celular es una lista por persona, una fila por semana.

**Pestaña Tablero**, que reemplaza las hojas DASHBOARD, POR LÍDER y CIUDADES:
- Periodos: semana, 15 días, mes o un rango libre.
- Tarjetas:
  - Hechas (efectivas y no efectivas), No se hizo (por motivo), Canceladas (por motivo), Sin cerrar, Programadas y
    Reportadas tarde.
  - Médicos distintos, Cuentas distintas, Ciudades distintas y Días de correría.
  - Anticipación: mediana, % con 7 días o más (A5) y % del mismo día.
  - Cumplimiento del plan: hechas ÷ programadas hasta hoy. "Otra fecha" no duplica: cuenta la cadena una vez, con el
    resultado de la última.
  - Correrías del mes contra la meta de cada líder (desde F3).
- Una tabla por persona con las mismas columnas.
- Una tabla de tipo × estado.
- "Ciudades más visitadas": días-persona por municipio.
- "Cenas y almuerzos":
  - Eventos, invitados distintos y asistencia (asistieron ÷ invitados).
  - Por médico: invitaciones, asistencias, quién lo reportó, última invitación, y visitas y compromisos en los 30 y
    90 días siguientes, con la marca "Sin actividad posterior".
- "Descargar en Excel", con la librería xlsx que la web ya tiene.
- Lo eliminado por error no aparece en ninguna parte (A7).

**Pestaña Mapa de calor** (solo `team:map`, A3):
- Un mapa de Colombia propio de `/equipo`, con Leaflet y su propio estilo. No usa `web/components/mapStyles.ts` ni
  cambia el mapa de asignación.
- Periodo: por defecto los últimos 6 meses; también 3 o 12 meses o un rango libre.
- Una persona o todo el equipo, con filtro de línea.
- Cada municipio con presencia es un círculo en su cabecera (`municipalities.lat/lng`), con tamaño y color según los
  días-persona. Nunca coordenadas del teléfono (C5).
- Presencia = día con al menos una actividad presencial hecha en ese municipio (visita con sede, actividad con sede o
  municipio) o un día de correría `realizada`.
- Al lado: "Estuvo en" (municipios con días y última fecha) y "Ciudades importantes sin visitar en el periodo" (C14).
- Los datos empiezan con F1a: las 7.033 visitas de VMO no son de una persona y no entran.

**Reglas de las cifras**, todas en `web/lib/equipo.ts`:

- **Anticipación** = fecha (o `fecha_desde`) − fecha en Bogotá de `created_at`, en las citas, o de `programada_at`, en
  las actividades.
  - Lo reportado sin plan cuenta como "no planeado": entra en los porcentajes y no en la mediana.
  - Una "otra fecha" mide desde su propio `created_at`.
  - "Planeada con tiempo" = 7 días o más (A5).
- **Médicos distintos** = los `medico_id` distintos de:
  - visitas médicas efectivas;
  - asistentes con `asistio = true` de reunión, cena, capacitación y congreso;
  - el cirujano.

  Por persona son los distintos de esa persona. Para el equipo, los distintos de todo el equipo, sin sumar personas.
- **Evento compartido**: misma fecha, mismo tipo y misma sede o municipio. Un médico invitado a una cena que
  reportaron tres líderes cuenta una invitación.
- **Ciudades** = municipios distintos de las actividades presenciales hechas.

**API**, de solo lectura, con `requirePermission` y `personasVisibles`:
- `GET /api/equipo/hoy?fecha=` (`team:view`).
- `GET /api/equipo/plan?desde&hasta` (`team:view`), con 62 días como máximo por consulta.
- `GET /api/equipo/tablero?desde&hasta&linea&persona` (`team:view`).
- `GET /api/equipo/persona/[id]?desde&hasta` (`team:view`): la transcripción sale solo en el detalle de una actividad.
- `GET /api/equipo/mapa?desde&hasta&persona&linea` (`team:map`): por municipio, código, nombre, cabecera, días y
  actividades; y las ciudades importantes sin visitar.

Todas usan `supabase-admin` con `no-store` y `fetchAllRows`. Nunca devuelven las coordenadas del teléfono, documentos
ni teléfonos. No llaman a Google.

**El mapa de asignación no cambia.** Las visitas de la app sin Ejecutivo Comercial se excluyen de
`/api/visits/filtered`, `stats` y `unvisited-zones` con `source <> 'app' OR executive_id IS NOT NULL` (las de VMO no
tienen `executive_id` y siguen saliendo). Dónde ha estado cada persona se ve en el Mapa de calor de `/equipo` (A3).

## Plan por fases

Cada fase es un PR desde `master` con su spec, `npm run check` en verde en `web/` (y en `mobile/` si la toca), y
revisión del subagente `revisor`. Cada fase se puede desplegar sola sin romper la anterior.

Tamaños: **S** = 1 a 5 archivos y sin migración. **M** = de 6 a 15 archivos. **L** = más de 15 archivos, o una
migración con funciones.

Orden y dependencias:

```
F0 (datos) ─┐
F1a ────────┼─► [estilo Uber de la app] ─► F1b
            ├─► F2a ─► F2b
            │    └───► F3 (metas de correrías necesitan correrías)
            └─► F4 (se puede hacer después de F1a; completa con F2a y F3)
F5 después de F2b
```

### F0 — Datos, sin código

- Cargar en `/configuracion` los subtipos institucionales "Cobro / cartera" y "Seguimiento comercial", en modo
  seguimiento (A17). Lo hace el admin; no requiere despliegue.
- Cargar médicos y sus visitantes de Columna y Deportiva: sin ellos, sus líderes no pueden agendar visitas médicas ni
  invitar a cenas (C9). Trauma, ver B3.

### F1a — Persona de campo y ciclo de vida de la agenda: base de datos + API (0850) · L

Sirve sola: la API ya deja agendar y reportar visitas a las líderes y a Paola (con una sola agenda), bloquea los
choques, quita el tope de 30 días, exige motivo al cancelar, cancela lo planeado de quien sale y expone el ciclo de
vida. La app de hoy sigue funcionando; nada de `mobile/` cambia.

**Archivos**
- Base:
  - `database/migrations/AAAA-MM-DD_0850_persona_de_campo_y_agenda.sql`.
  - `database/migrations/AAAA-MM-DD_9945_persona_de_campo_y_agenda_rollback.sql`.
- Reglas puras (espejo del SQL, para las pruebas y la API):
  - `web/lib/persona-campo.ts` (nuevo): `lineasParaReportar`, `rolDePersona`, `ejecutivoDeLaVisita`,
    `ejecutivoDeLaCita` (C12), `medicoDeLineas` (C9), `MENSAJE_SIN_LINEAS`, `MENSAJE_DIRECCION_NO_REPORTA`,
    `MENSAJE_LINEA_AJENA` y `MENSAJE_MEDICO_AJENO`.
  - `web/lib/agenda-ciclo.ts` (nuevo): `ESTADOS_CITA` (los 5), `MOTIVOS_CIERRE` (C10), `agendaChoca`,
    `MENSAJE_CHOQUE`, `citaCancelable`, `citaCerrable`, `citaEliminable`, `origenParaOtraFecha`, `cuentasAgenda` (sin
    eliminadas) y `estadoVisible` (Atrasada / Sin cerrar, C6). `web/lib/reporte-visitas.ts` los reexporta y quita
    `DIAS_AGENDA_ADELANTE` y `MENSAJE_CITA_LEJANA` (A4).
  - `web/lib/reporte-visitas-schemas.ts`: `citaCreateSchema` (+ `como?`; sin tope adelante), `citaCancelarSchema`
    (`motivo_codigo?` + `motivo?`: sin código y con texto = `otro`; sin nada → 400 "Elige o escribe el motivo de la
    cancelación"), `citaCerrarSchema` y `citaOtraFechaSchema`.
- Servidor:
  - `web/app/api/config-visitas/_lib/visitas-server.ts`: `personaDeCampo(userId)` y `requirePersonaDeCampo(request,
    contexto)`. `requireEjecutiva` queda solo en `/api/me/dias-libres*` y `/api/me/cuota`.
  - `web/app/api/me/_lib/reporte-server.ts`: lecturas por `user_id` (`leerVisitas`, `leerCitas`, `cargarCitaItem`),
    `lineasDePersona`, `misMedicos` de la líder (C9), y `respuestaErrorAgenda` con 23P01 → 409 (`campo: 'hora'`) y los
    mensajes nuevos.
  - `web/app/api/auth/me/route.ts` y `MeResponse.persona`.
  - Pasan a `requirePersonaDeCampo`: `/api/me/contexto`, `/api/me/visitas`, `/api/me/visitas/[id]`,
    `/api/me/visitas/[id]/anular`, `/api/me/agenda`, `/api/me/agenda/[id]/cancelar`, `/api/me/numeros` (`cuota:
    null` sin Ejecutivo Comercial) y `/api/me/voz/{proponer,campos,transcribir}`.
  - Rutas nuevas:
    - `POST /api/me/agenda/[id]/cerrar` `{ motivo_codigo, motivo? }` → 200 `{ cita }`.
    - `POST /api/me/agenda/[id]/eliminar` → 200 `{ cita_id }`.
    - `POST /api/me/agenda/[id]/otra-fecha` `{ fecha, hora, sede_id?, nota?, como? }` → 201 `{ cita }` con `viene_de`.
  - `GET /api/me/agenda`: nunca trae las eliminadas; `canceladas=true` trae también las `no_realizada`. Campos
    aditivos en cada cita: `motivo_codigo`, `no_realizada_at`, `no_realizada_motivo`, `viene_de`, `sucesora_id`,
    `como` y `estado_visible`.
  - `web/app/api/visits/_lib/visitas-mapa.ts` (y `filtered`, `stats`, `unvisited-zones`): el filtro del mapa de
    asignación.
  - `web/lib/permissions.ts`: quita `visits:report` a `commercial_director` (A1). Ella sigue en `/calendario` por
    `calendar:manage` y `daysoff:approve`. `web/docs/ROLES_AND_PERMISSIONS.md`.
  - `web/scripts/simulacion-carmen.ts`: sus citas llevan `user_id`.
- Docs: `docs/fases/fase8-visitas-f3-f4-reporte-y-app-movil.md` (sección F4.2, el contrato nuevo),
  `docs/base-de-datos.md` y la línea de fase 8 en `CLAUDE.md`.

**Compatibilidad con la app de hoy** (hasta F1b):
- Las firmas de las RPC no cambian, salvo `agenda_cancelar`, que acepta la llamada de hoy.
- Las respuestas solo ganan campos. Los estados nuevos (`no_realizada`, `eliminada`) solo los producen las rutas nuevas,
  que la app de hoy no llama; las eliminadas nunca se devuelven.
- Lo que la app de hoy ve distinto, y ya muestra bien porque enseña el mensaje del servidor:
  - agendar en una media hora ocupada → "No se agendó" con "A las 09:30 ya tienes cita con …: elige otra hora";
  - cancelar sin motivo → "Elige o escribe el motivo de la cancelación";
  - el calendario de la app sigue llegando a hoy + 30; el servidor ya acepta más.
- Una líder que abra la app de hoy ya no recibe 403: ve el aviso "no está enlazado" y puede reportar visitas, que
  quedan bien guardadas. No se invita a las líderes hasta F1b.

**Criterios de aceptación**
- [ ] `web/scripts/persona-campo-check.ts` (nuevo, puro, en `npm run test`):
  - `lineasParaReportar` da la unión de las líneas de Ejecutivo Comercial y las de líder.
  - Un `sales_manager` sin Ejecutivo Comercial da [] y "Tu usuario no tiene líneas para reportar"; la directora da
    `MENSAJE_DIRECCION_NO_REPORTA` aunque fuera líder de una línea.
  - `ejecutivoDeLaVisita`: el suyo si alguna línea es suya como Ejecutivo Comercial; NULL con solo Trauma.
  - `ejecutivoDeLaCita`: Paola por defecto como Ejecutiva; `como = 'lider'` → NULL; una líder sin Ejecutivo Comercial
    con `como = 'ejecutivo'` → error.
  - `medicoDeLineas`: visitante en la línea, sí; visitante de un Ejecutivo Comercial de la línea en otra línea, sí;
    visitante vencido, no; de otra línea y de otro Ejecutivo Comercial, no.
  - `commercial_director` no tiene `visits:report` y sí `calendar:manage`.
- [ ] `web/scripts/agenda-ciclo-check.ts` (nuevo, puro, en `npm run test`):
  - `agendaChoca`: 09:00 contra 09:15 choca; 09:00 contra 09:30 no; sin hora, `no_realizada`, `cancelada` y
    `eliminada` nunca chocan.
  - Transiciones: cada par (estado, acción, fecha relativa) de la tabla "Ciclo de vida" da permitido o su mensaje.
  - `MOTIVOS_CIERRE`: `otro` exige texto; `salida` no se elige.
  - `origenParaOtraFecha`: `no_realizada`, `cancelada` y hecha no efectiva, sí; pendiente, `eliminada`, cancelada por
    salida y una con sucesora, no.
  - `cuentasAgenda` no cuenta las eliminadas y cuenta "no se hizo" aparte.
  - `estadoVisible`: Atrasada hoy pasada la hora; Sin cerrar desde mañana.
  - Una cita a hoy + 400 es válida; hoy a una hora pasada no.
  - Ningún archivo de `web/lib` exporta `DIAS_AGENDA_ADELANTE`.
- [ ] `reporte-api-check.ts`, con Supabase falso:
  - Una líder sin Ejecutivo Comercial:
    - `GET /api/me/contexto` → 200, con `persona.rol = 'lider'` y sus médicos (C9).
    - `POST /api/me/visitas` con su línea → 201, sin Ejecutivo Comercial ni zona.
    - `POST /api/me/visitas` con una línea ajena → 400 "Alguna de las líneas no es tuya"; con un médico ajeno → 400.
    - `GET /api/me/numeros` → `cuota: null`.
    - `GET /api/me/dias-libres` → 403.
  - La directora: `GET /api/me/contexto` → 403.
  - Paola: una visita de Trauma → sin Ejecutivo Comercial; una de Sustitutos óseos → con el suyo; una cita
    `como = 'lider'` → sin Ejecutivo Comercial.
  - `POST /api/me/agenda` con choque → 409 con el error en `hora`; a hoy + 400 → 201; sin hora o a una hora pasada →
    400; nada se guarda en los rechazos.
  - `POST /api/me/agenda/[id]/cancelar` sin motivo → 400; con solo texto → 200 con `motivo_codigo = 'otro'`.
  - `cerrar`: la propia de ayer → 200 `no_realizada`; la de mañana → 400; la ajena → 404.
  - `eliminar`: la propia pendiente → 200 y deja de salir en `GET /api/me/agenda`; una hecha → 400.
  - `otra-fecha`: de una `no_realizada` → 201 con `viene_de`; de una pendiente → 400; dos veces → 409.
  - Las respuestas de la agenda siguen teniendo todos los campos de hoy (la app de hoy no se rompe).
- [ ] `visits-api-check.ts`: `filtered`, `stats` y `unvisited-zones` no traen visitas de la app sin Ejecutivo
      Comercial y siguen trayendo las de VMO.
- [ ] `simulacion-check.ts`: las citas simuladas llevan `user_id`.
- [ ] La 0850 corre en una base de prueba con su DO `P0850` en verde, y el 9945 la deshace. Lo ensaya el orquestador
      (rama de Supabase o local), nunca producción sin autorización.
- [ ] `npm run check` en `web/` en verde, con la salida en el PR.

### Estilo Uber de la app (fuera de esta spec)

La dirección visual A se aplica a `mobile/` en su propio cambio (rama `feat/movil-estilo-uber`), sin tocar la lógica.
F1b empieza cuando esté en master.

### F1b — La app: persona de campo y ciclo de vida (sin migración) · L

Sirve sola: las líderes y Paola usan la app; todos cierran, cancelan con motivo, eliminan por error y piden otra fecha.

**Archivos**
- Pantallas: `hoy`, `ajustes`, `numeros`, `agenda` (detalle con el ciclo de vida), `agenda/nueva` (sin tope; "Como"
  para Paola) y el layout (Días libres solo con Ejecutivo Comercial; la directora no entra).
- `mobile/lib/agenda.ts`: `avisoChoque` pasa a `errorChoque`; el espejo de `agenda-ciclo` (estados, motivos y
  transiciones). `mobile/lib/tipos.ts`: `EstadoCita` con los 5 estados; sin `DIAS_AGENDA_ADELANTE`.
- `mobile/lib/api.ts`: `cerrarCita`, `eliminarCita`, `otraFechaCita` y `cancelarCita` con código.
- Los textos visibles de la tabla.

**Criterios de aceptación**
- [x] `mobile/scripts/checks/21-persona.ts` (la 20 ya era `20-estilo.ts`), en `npm run check` de `mobile/` (sección 21,
      79 pruebas con las correcciones del 2026-10-30):
  - Hoy no muestra el aviso a una líder; la directora ve el mensaje de la web.
  - Números oculta la cuota sin Ejecutivo Comercial, y Días libres también se oculta.
  - `errorChoque` da el texto del servidor (lo compara con el `RAISE` de `agenda_crear` en la 0850).
  - El espejo de estados y motivos es igual al de `web/lib/agenda-ciclo.ts` (la prueba lee los dos archivos y compara
    también los mensajes, los límites y el código de las reglas del ciclo de vida).
  - Ningún archivo de `mobile/app` contiene "Reportar visita", "Visitas de hoy", "Tipo de visita" ni "Reprogramar".
- [ ] Capturas a 390×844, con el estilo Uber: Hoy y Ajustes de una líder; Ajustes y Agendar de Paola ("Como"); el
      detalle de una cita con "No se hizo", Cancelar, Eliminar y "Agendar otra fecha"; el error de choque. (Contra un
      servidor falso: producción no tiene la 0850.)
- [ ] Prueba en el iPhone del dueño con Expo Go, contra un servidor CON la 0850 (F1a desplegado y la migración
      aplicada): contra producción de hoy (sin F1a) la app esconde el ciclo de vida (decisión 12).

**Hecho (2026-10-29, rama `feat/campo-f1b`)**
- Tipos y claves de la app iguales a los de la API de F1a (`mobile/lib/tipos.ts`, `mobile/lib/claves-api.ts`): la
  persona en `/api/auth/me` y en el contexto, `EstadoCita` con los 5 estados, `CitaItem` con lo de la 0850, `cuota: null`,
  `max_fecha: null`, `citas_no_realizadas`, los cuerpos de cancelar (con código), cerrar y otra fecha. Sin
  `DIAS_AGENDA_ADELANTE` ni `ventanaCita`. `web/scripts/reporte-api-check.ts` compila los tipos de la app contra los de la
  web en los dos sentidos y exige que cada respuesta traiga exactamente las claves de la app.
- Espejo del ciclo de vida: `mobile/lib/agenda-ciclo.ts` (estados, motivos, transiciones, mensajes) más lo de la app:
  `accionesDeCita`, `cuerpoMotivo`, `cuerpoCancelar` (sin F1a) y los textos del detalle.
- `mobile/lib/persona.ts`: quién entra, papel, cuota y días libres, "como qué" y el papel en Ajustes.
- `mobile/lib/api.ts`: `cerrarCita`, `eliminarCita`, `otraFechaCita` y `cancelarCita` con código (invalidan el contexto).
- Sesión: la persona de `/api/auth/me`; el login no la trae, así que se pide en segundo plano al entrar.
- Pantallas: el layout (la dirección comercial ve el mensaje y "Cerrar sesión", sin pestañas), Hoy ("¿Qué pasó con
  esto?", sin el aviso de "no enlazado" ni la meta para una líder), Mi agenda y su detalle (el ciclo de vida), Agendar
  ("¿Qué vas a hacer?", sin tope, "Como" para Paola, el choque como error, otra fecha), Números (sin cuota), Ajustes (el
  papel), Días libres solo con Ejecutivo Comercial y los textos de la tabla.
- Una adición mínima a la API (aditiva y probada): `CitaItem.viene_de_fecha` y `viene_de_estado` (ver la decisión C-F1b-3).

**Correcciones de la revisión (2026-10-30, mismo PR)**, cada una con su prueba (sección 21 de `mobile/`; los cuerpos
también en `web/scripts/reporte-api-check.ts`):
1. Servidor sin F1a: ver la decisión 12.
2. Otra fecha con el papel de hoy: sin elegir papel y con la persona conocida, `como: comoPorDefecto(persona)`; sin la
   persona, null. Así la cita cancelada con "Dejó de ser Ejecutivo Comercial" (quien sigue como líder) pide otra fecha
   como líder; sin `como`, el servidor tomaba el papel de la anterior y la rechazaba.
3. El detalle de la visita no dice "Cuenta para: Suma a la meta…" sin cuota (una líder sin Ejecutivo Comercial).
4. Como líder (Paola al elegirlo o una líder sin Ejecutivo Comercial), Agendar quita todo médico que no sea de sus líneas
   de líder, también los traídos del buscador, y el buscador filtra sus resultados por las líneas de los visitantes
   vigentes que trae cada uno (`lineasDeBusqueda`; uno que ya está en "mis médicos" se ofrece igual). Un resultado sin
   sus visitantes (un servidor que no los mande) se ofrece y, si no es de sus líneas, lo rechaza el servidor ("Ese
   médico no es de tus líneas"). Queda un caso sin filtrar: C9 se mira en la fecha de la cita y el buscador trae los
   visitantes vigentes hoy (un visitante que termina antes de esa fecha): lo rechaza el servidor.
5. "Como Ejecutivo Comercial", no "Como Ejecutiva Comercial": la regla del dueño del 2026-10-29 manda sobre la spec del 15.
6. Los cuerpos tal cual los manda la app (`CUERPO_*_APP` en `web/scripts/reporte-api-check.ts`: agendar, cancelar y "no
   se hizo" con `{ motivo_codigo: 'cliente', motivo: null }`, cancelar sin F1a y otra fecha con `sede_id`, `nota` y
   `como` null) pasan el esquema (`safeParse`; comparar el tipo con `z.input` no probaba nada: la entrada de esos
   esquemas es `unknown`) y van por POST en la sección 15; la sección 21 de la app exige que sus funciones den
   exactamente esos cuerpos.
7. La compatibilidad de F4.2 en `docs/fases/fase8-visitas-f3-f4-reporte-y-app-movil.md` (el 400 de la app vieja al
   cancelar sin motivo y el sentido de la comprobación de `MeResponse`).
8. Números de Paola: la cuota va con el rótulo "Como Ejecutivo Comercial · <sus líneas>" (`rotuloCuota`).
9. "¿Qué pasó con esto?": la fila ya no se toca (tenía botones dentro y VoiceOver no los lee): Reportar es su botón.
10. El pie de Agendar dice el choque y la cita repetida con su propio texto ("A las 08:30 ya tienes cita con …: elige
    otra hora"), no dentro de "Falta algo: …", que no los repite (`textosPieAgendar`).

**Decisiones de implementación de F1b (Claude; el dueño puede cambiarlas)**
1. **"¿Qué pasó con esto?" ya en F1b, para las citas** (la lista de F2b lo nombra para las actividades): lo atrasado de
   hoy y lo sin cerrar de los 31 días anteriores (una consulta a `GET /api/me/agenda` hacia atrás). La cita "de ahora"
   (de 30 min antes a 60 min después de su hora) sigue en "Siguiente" y no entra; lo que entra no se repite en "Tu agenda
   de hoy" (cada cita una sola vez en Hoy), pero cuenta en "x de y hechas". Se ven 4 y "Ver todas (n)". "Reportar" solo
   en lo de hoy (una visita se reporta el mismo día), con su botón (la fila no se toca: un botón dentro de otro no lo
   lee VoiceOver): lo de días anteriores se cierra con "No se hizo". Al cerrar o cancelar queda "Anotado…" con "Agendar
   otra fecha".
2. **La dirección comercial se reconoce por su rol** (`commercial_director`, que el login ya trae), no por `persona`: así
   no depende de una consulta.
   - Ve "La dirección comercial sigue a su equipo en la web" ("(Equipo)" se quitó: esa página llega en F4) y "Cerrar
     sesión".
   - Desde el 2026-10-30 (app solo para líderes), quien el servidor deja fuera diciendo por qué (`sin_persona`) ve ese
     aviso igual y no entra a las pestañas. Por ejemplo, "Las visitas de los Ejecutivos Comerciales se registran en VMO",
     o un administrador sin líneas.
   - Si el servidor confirma "sin líneas" sin decir por qué (un servidor anterior), la persona entra y Hoy se lo dice.
   - Sin el dato (recién entró, sin señal, un servidor sin la 0850), la app sigue como antes y decide el servidor: nunca
     deja fuera a nadie por no saber.
   - La persona del contexto, si llegó, manda sobre la del perfil.
3. **(C-F1b-3) `viene_de_fecha` y `viene_de_estado` en `CitaItem`** (aditivo en `armarCitaItems`: una consulta más, solo
   con citas que vienen de otra): sin eso el detalle no puede decir "Viene de la cita del 12 oct · No se hizo" cuando la
   anterior es de otro mes (Mi agenda carga por mes). Si la anterior está hecha, el detalle dice "No efectiva" (solo una
   visita no efectiva admite otra fecha). Un servidor sin el dato: "Viene de otra cita".
4. **"Agendar otra fecha" de una cita hecha** se ofrece solo si su visita no fue efectiva: Mi agenda pregunta
   `GET /api/me/visitas?fecha=` al abrir esa cita (la API de la cita no dice si su visita fue efectiva).
5. **Agendar otra fecha** usa la misma pantalla de Agendar con el pedido en memoria (nunca ids en la URL): el tipo y el
   "con quién" quedan fijos (los copia el servidor), se eligen la fecha, la hora, la sede y la nota (trae la de la
   anterior); Paola puede cambiar "como qué" (por defecto, el de la anterior). Quien no elige papel manda el suyo de hoy
   (`comoPorDefecto`, si se sabe quién es): la cita de quien dejó de ser Ejecutivo Comercial pide otra fecha como líder.
6. **"Como líder" en Agendar** (C9, C12): ofrece solo los médicos de sus líneas de líder (los demás los rechazaría el
   servidor), también entre los del buscador (corrección 4), los dos tipos (configuración general) y no apaga los días
   libres (son del Ejecutivo Comercial hasta F3). Vale para Paola al elegirlo y para una líder sin Ejecutivo Comercial.
   Cambiar de papel quita el médico o el tipo que dejan de cuadrar. Las etiquetas: "Como Ejecutivo Comercial" y "Como
   líder" (la regla del dueño del 2026-10-29 manda sobre la spec del 15); en Ajustes, "Ejecutivo Comercial · …".
7. **Sin tope en Agendar**: al abrir trae de hoy a hoy + 30 (una consulta de 31 días, como antes) y cada mes más adelante
   al llegar a él (`rangoPorCargar`, sin repetir lo ya traído). Días libres sigue marcando los próximos 31 días.
8. **El choque es un error** (`errorChoque`, espejo de `agenda_choque` con el texto del servidor): bloquea en la app,
   como la cita repetida, y va en rojo en el pie con su propio texto (no dentro de "Falta algo"). La franja ocupada
   sigue con su punto en "¿A qué hora?".
9. **Mi agenda**: la cancelada y la que no se hizo van juntas en "Ver las que no se hicieron (n)", que se abre sola si la
   cita abierta está ahí (al cerrarla, su detalle sigue a la vista con "Agendar otra fecha"). La pendiente de un día
   anterior lleva "Sin cerrar"; la de hoy pasada su hora, "Atrasada". La pendiente se llama "Programada" (la etiqueta de
   la web).
10. **Una líder** (sin cuota, C4) no ve "Meta de hoy" en Hoy ni "Cuenta para" en el detalle de su visita; **Números**
    sin cuota muestra "Lo que hiciste" (visitas a médicos, institucionales y no efectivas) y la agenda, con "No se
    hicieron". Paola ve su cuota con el rótulo "Como Ejecutivo Comercial · Sustitutos óseos" (lo de líder no suma; su
    bloque de líder llega en F3).
11. **Textos de la tabla**: "Reportar actividad", "Actividades de hoy", "¿Qué hiciste?" (en la tarjeta de Reportar, con
    "Visita a médico" y "Visita institucional"), "No agendada", "Repórtalo por toques" (el detalle del botón de Hoy) y
    "Cancelar" con motivo obligatorio. El prompt de la voz ("asistente de reporte de visitas") y los mensajes del servidor
    que dicen "Reporta la visita por toques" no se tocaron: son de la API y de la voz (F5).
12. **Con un servidor sin F1a** (corrección 1): si `GET /api/auth/me` responde bien pero SIN la clave `persona`, la app lo
    guarda en el perfil (`servidor: 'sin_f1a'`, `servidorDeMe`) y no ofrece "No se hizo", Eliminar ni "Agendar otra
    fecha", ni muestra "¿Qué pasó con esto?" (tampoco pide los días anteriores); cancelar manda solo `{ motivo }`, con
    lo escrito o, si no escribió, la etiqueta del motivo elegido, sin `motivo_codigo` (`cuerpoCancelar`: ese servidor
    solo lee `motivo`). Si no se sabe (recién entró, sin señal, un perfil de antes), queda como estaba: decide el
    servidor, y un 404 sin `{ error }` dice "Esto todavía no está disponible en el servidor.". Por eso la prueba en el
    iPhone va contra un servidor con la 0850 (F1a desplegado y la migración aplicada).

### F2a — Actividades de campo: base de datos + API (0860) · L

Sirve sola: la API planea, reporta y cierra los 7 tipos nuevos, con la cena por invitados y la correría con "Voy con".
La app de F1b sigue igual.

**Archivos**
- Base: la 0860 y su rollback 9946.
- `web/lib/actividades.ts`: `REGLAS_TIPO`, `validarActividad`, `ventanaReporte` (A11) y `asistentesValidos` (A9).
- `web/lib/actividades-schemas.ts` (zod).
- `POST /api/me/actividades` (planear o reportar directo) y
  `/api/me/actividades/[id]/{reportar,cerrar,cancelar,eliminar,otra-fecha,anular}`.
- `GET /api/me/acompanamiento?executive_id&desde&hasta`: las citas y actividades de un Ejecutivo Comercial activo de
  sus líneas en esas fechas (A6), sin notas ni transcripciones.
- `GET /api/me/agenda` añade las claves `actividades` y `acompanamientos` (aditivas). `contexto.actividades_hoy`.
  `/api/me/numeros` → `otras_actividades`.

**Criterios de aceptación**
- [ ] `web/scripts/actividades-check.ts` (nuevo, puro), un caso por cada regla de la tabla de tipos:
  - Una cena sin invitados da "¿A qué médicos invitaste?"; con un médico de otra línea, "Ese médico no es de tus
    líneas".
  - Un congreso de 15 días se rechaza; uno de 3 días, todo el día, se acepta.
  - Una correría con hora se rechaza; con "Voy con" de otra línea, también.
  - Una reunión en clínica sin sede se rechaza.
  - Los compromisos "Ninguno" se aceptan.
  - Ventana para reportar: hoy y ayer sin marca; de 2 a 7 días con `tarde`; 8 días se rechaza.
  - `efectiva` solo se acepta en reunión y cirugía.
  - El reporte no tiene ningún campo de paciente.
- [ ] `reporte-api-check.ts`:
  - Planear una cena a las 10:15 con una cita a las 10:00 → 409.
  - Una correría que se cruza con otra → 409.
  - Reportar la planificada la cierra; reportar dos veces con el mismo `client_id` devuelve la misma.
  - La cena reportada guarda asistió sí y no por invitado.
  - `acompanamiento` de un Ejecutivo Comercial fuera de sus líneas → 404.
  - `GET /api/me/agenda` trae citas, actividades y acompañamientos.
- [ ] El DO `P0860` está en verde y el 9946 la deshace (ensayo del orquestador).

### F2b — Actividades en la app (sin migración) · L

**Archivos**: `mobile/lib/actividades.ts` (espejo de `REGLAS_TIPO`), la tarjeta por tipo en `components/reporte/`,
"¿Qué hiciste?" y "¿Qué vas a hacer?", invitados y asistentes de la cena, "Voy con" con la agenda de la Ejecutiva, las
bandas en Mi agenda y "¿Qué pasó con esto?" en Hoy.

**Criterios de aceptación**
- [ ] `mobile/scripts/checks/22-actividades.ts` (la 21 es la de F1b, `21-persona.ts`):
  - Cada tipo abre su formulario con los campos de la tabla.
  - Correría y congreso muestran "Todo el día" + "Hasta".
  - El espejo de la app da los mismos resultados que el servidor: la prueba compara `REGLAS_TIPO` de los dos.
  - `PESTANAS` no cambia.
- [ ] Capturas a 390×844: "¿Qué hiciste?", la cena con invitados y asistió sí o no, Agendar una correría de 4 días con
      "Voy con" y la agenda de la Ejecutiva, Mi agenda con la banda y "¿Qué pasó con esto?".
- [ ] Desde que F2b llegue a todas las líderes, la directora deja de usar el Excel; su histórico queda ahí (A15).

### F3 — Líderes: días libres y metas de correrías (0870) · L

Sirve sola: las líderes registran días libres que se aprueban como los demás, tienen meta de correrías, y Paola ve sus
dos metas.

**Archivos**: la 0870 y su rollback 9947; `registrarDiaLibre` y `/api/me/dias-libres*` por persona; `/calendario`
con las líderes; `/configuracion` con "Metas de líderes"; `/api/me/numeros` con `meta_lider`; en la app, Días libres
para todas las personas de campo y el bloque "Como líder" en Números.

**Criterios de aceptación**
- [ ] `visits-check.ts`: un día libre de una líder bloquea agendar ese día; medio día no.
- [ ] Una prueba pura de la meta: correrías `realizada` del mes contra `meta_correrias_mes`; una `no_realizada` no
      cuenta; las de Paola no tocan su cuota.
- [ ] `reporte-api-check.ts`: una líder registra y anula un día libre; la directora lo aprueba en bloque.
- [ ] El DO `P0870` en verde y el 9947 la deshace.

### F4 — "¿Dónde está mi gente?" (web `/equipo`) · L

Sirve sola: la directora ve hoy, lo planeado, el tablero y el mapa de calor; las líderes, lo suyo y lo de sus
Ejecutivos Comerciales. Solo lee: se puede desarrollar después de F1a y completar con F2a y F3.

**Archivos**
- `web/lib/equipo.ts`: `personasVisibles`, `dondeEsta`, `rastroDelDia`, `anticipacion`, `tablero`, `cenasPorMedico`,
  `ciudadesDistintas`, `presenciaPorMunicipio` y `ciudadesImportantesSinVisitar`.
- Las 5 rutas `/api/equipo/*`.
- `web/app/equipo/page.tsx` y sus componentes, con un mapa propio para el Mapa de calor.
- `web/lib/permissions.ts` (`team:view`, `team:map` y el menú) y `web/docs/ROLES_AND_PERMISSIONS.md`.

**Criterios de aceptación**
- [ ] `web/scripts/equipo-check.ts` (nuevo, puro):
  - `personasVisibles`: la directora ve a todas; una líder se ve a sí misma y a los Ejecutivos Comerciales activos de
    sus líneas, sin vacantes ni otras líderes; Paola aparece para la líder de Sustitutos óseos solo con lo que hace
    como Ejecutiva; un `sales_manager` no ve a nadie.
  - `dondeEsta` respeta el orden de los 5 casos: más de 3 h da "Último reporte hace 4 h"; una telefónica no ubica; un
    día libre gana a una cita.
  - Anticipación: mediana, % ≥ 7 y % del mismo día; una "otra fecha" mide desde su `created_at`.
  - Cumplimiento: una cadena de "otra fecha" cuenta una vez; lo eliminado no cuenta.
  - Una cena con el mismo médico reportada por 3 personas da 1 invitación.
  - Ciudades distintas cuenta solo presenciales hechas.
  - `ciudadesImportantesSinVisitar`: ≥ 200.000 habitantes y sin presencia en el periodo.
- [ ] `web/scripts/equipo-api-check.ts`, con Supabase falso:
  - Sin `team:view` → 403. Una líder en `/api/equipo/mapa` → 403.
  - Una líder no ve a una persona fuera de su alcance → 404.
  - Ninguna respuesta lleva las claves `lat`, `lng` del teléfono, `documento` ni `telefono` (la prueba recorre el
    JSON; en el mapa, solo la cabecera del municipio).
  - `plan` con más de 62 días → 400.
- [ ] `menu-check.ts`: "Equipo" va después de "Calendario" y solo aparece con `team:view`.
- [ ] Capturas en escritorio y a 390 px de Hoy, Próximas semanas, Tablero y Mapa de calor, con datos de prueba.

### F5 — Voz para todas las actividades · M

Sirve sola: lo que dicta la persona se convierte también en cenas, juntas, congresos y capacitaciones.

**Archivos**: `web/lib/reporte-visitas.ts` (esquema, prompt y `normalizarPropuesta`), `reporte-server.ts` (contexto) y
`mobile/lib/propuesta.ts`.

**Criterios de aceptación**
- [ ] `reporte-check.ts`:
  - Cuenta las uniones de `esquemaParaHerramienta(esquemaPropuesta)`: deben ser 16 o menos, con 0 opcionales.
  - `normalizarPropuesta`: fuerza hoy en las visitas; admite hasta 7 días atrás en cena, congreso, capacitación y otro;
    convierte "" en null; rechaza `correria`.
- [ ] Evaluación de unos 20 dictados (requiere el aviso al dueño). Las visitas médicas aciertan lo mismo que antes y
      los tipos nuevos al menos 90 %. El informe queda en el scratchpad.

### F6 — Después (cada una S, cada una con su visto bueno)

- "Mi equipo hoy" en la app: una tarjeta en Hoy para quien tenga `team:view` que abre una pantalla de solo lectura con
  `/api/equipo/hoy`. No es una pestaña nueva.
- Las órdenes o prescripciones por médico de las cenas, cuando exista la fuente (¿Odoo?).
- Añadir 2026 al selector de año del mapa de asignación (B4).
- El nombre de la app (A14).

## Impacto

- **Datos y migración**:
  - `0850_persona_de_campo_y_agenda` + `9945` (F1a).
  - `0860_actividades_de_campo` + `9946` (F2a).
  - `0870_lideres_dias_libres_y_metas` + `9947` (F3).
  - Se aplican solo con autorización del dueño, en la ventana del despliegue de cada fase. Después:
    `NOTIFY pgrst, 'reload schema'`.
- **Costo Google Maps**: 0. Ningún flujo llama a Google: la ciudad sale de la sede o de la lista DANE, y el mapa de
  calor usa la cabecera del municipio.
- **Costo OpenAI y Claude**: igual que hoy por dictado. La evaluación de F5 cuesta menos de 1 USD y se avisa antes.
- **Estética del mapa de asignación**: no cambia. El mapa de calor de `/equipo` es otro mapa, autorizado por el dueño
  (A3).
- **Permisos**:
  - `team:view` y `team:map` son nuevos.
  - `commercial_director` pierde `visits:report` (A1).
  - `visits:report` pasa a significar "persona de campo", sin cambiar qué otros roles lo tienen.
  - Las líderes sin Ejecutivo Comercial entran a `/api/me/*`.
- **Contrato de la fase 8, a documentar** en la sección F4.2 de `docs/fases/fase8-…`:
  - `MeResponse.persona`.
  - El ciclo de vida de la cita: `cerrar`, `eliminar`, `otra-fecha`, cancelar con motivo y `como`.
  - 409 por choque; sin tope hacia adelante; la hora pasada rechazada.
  - `GET /api/me/agenda` con `actividades` y `acompanamientos`; `/api/me/actividades*`; `/api/me/acompanamiento`.
  - `cuota: null` sin Ejecutivo Comercial.
- **Documentación**: `docs/base-de-datos.md`, `docs/decisiones/2026-10-15-actividades-de-campo.md` y una línea en
  `CLAUDE.md` ("Dónde está el detalle").
- **Orden del despliegue**:
  - La 0850 conserva las llamadas de hoy, así que puede ir antes que el código de F1a.
  - F1b sale después del estilo Uber. Si su app llega antes que la API de F1a, no ofrece "No se hizo", Eliminar,
    "Otra fecha" ni "¿Qué pasó con esto?" (`/api/auth/me` sin `persona`: decisión 12 de F1b) y cancela con solo
    `{ motivo }`; si aún no lo sabe, un 404 dice "No disponible todavía".
  - La 0860 va con el código de F2a; la 0870, con el de F3.

## Fuera de alcance

- Rastreo continuo o en segundo plano, y "ubicación en tiempo real": nunca.
- Capas, marcadores o colores nuevos en el mapa de asignación.
- Importar el histórico del Excel (A15).
- Costo de las cenas (A10). Ventas, órdenes o prescripciones por médico, e integración con Odoo.
- Mover una cita o actividad de fecha (A7).
- Ciudad base de las líderes y "fuera de su ciudad": la v1 dice "De correría en X" a partir de la propia correría.
- Unir las cenas compartidas a mano (`evento_id`). La v1 las agrupa por fecha, tipo y lugar.
- Catálogo de tipos editable por la directora.
- Asistentes que no son médicos de OpMap (contactos de cuentas o nombres sueltos).
- Arrastrar citas, recordatorios, avisos push y sincronizar con Google Calendar.
- Las cuentas de clase "distribuidor".

## Lo que sigue abierto

| # | Pregunta | Mientras tanto (recomendación de Claude) |
|---|---|---|
| A14 | ¿"VG Campo" o "VG Tracker"? | No se cambia el nombre. |
| B1 | ¿Eliminar por error tiene una ventana más corta (por ejemplo, 24 horas desde que se creó), para que no reemplace a cancelar? | C8: propia, pendiente y de hoy en adelante. Si el uso muestra abuso, se acorta. |
| B2 | ¿Qué son "ciudades importantes" en el mapa de calor? | C14: 200.000 habitantes o más (33 municipios). |
| B3 | Trauma no tiene Ejecutivos Comerciales ni médicos: con A9, Paola no puede invitar ni visitar médicos como líder de Trauma. ¿Se espera a que haya producto, o se crea una lista de médicos por línea sin Ejecutivo Comercial? | Esperar: hoy Trauma no vende. Si hace falta antes, una tabla `medico_lineas` que cargan admin y data_manager. |
| B4 | ¿Se añade 2026 al selector de año del mapa de asignación? Toca el mapa. | No por ahora (F6). |

## Verificación final

- En `web/`: `npm run check`, que corre typecheck, lint y las pruebas sin red. Suman las nuevas `persona-campo-check`,
  `agenda-ciclo-check`, `actividades-check`, `equipo-check` y `equipo-api-check`, y las ajustadas `reporte-check`,
  `reporte-api-check`, `visits-check`, `visits-api-check`, `simulacion-check` y `menu-check`.
- En `mobile/`: `npm run check`, con las secciones 21 (F1b, `21-persona.ts`) y 22 (F2b).
- Migraciones: la 0850, la 0860 y la 0870 con su DO en verde, y sus rollbacks 9947, 9946 y 9945, en ese orden,
  ensayados en una base de prueba. En producción, solo con autorización del dueño.
- Capturas:
  - App a 390×844, con el estilo Uber: Hoy de una líder, "¿Qué hiciste?", la cena con invitados y asistentes,
    Agendar una correría con "Voy con", Mi agenda con la banda, y el detalle de una cita con su ciclo de vida.
  - Web `/equipo` en escritorio y a 390 px, con el Mapa de calor.
- Prueba del dueño en su iPhone con una líder real: agenda una correría a 2 semanas con la Ejecutiva de la zona y una
  cena con médicos de su línea; cierra una cita como "No se hizo" y le pide otra fecha; la directora lo ve en Hoy, en
  Próximas semanas con "planeada hace N días" y en el Mapa de calor.
