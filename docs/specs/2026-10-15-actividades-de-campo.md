# Spec: actividades de campo — una sola app para Ejecutivos Comerciales y líderes, y "¿Dónde está mi gente?"  (2026-10-15)

**Estado**: borrador. Falta la aprobación del dueño y sus respuestas a "Para decidir". No hay código ni migración
escritos.

**Fuentes**:
- Estudio del 2026-10-15, de solo lectura: modelo de datos, Excel de la directora, vista de la directora y tipos de
  actividad.
- Consultas SELECT en producción (proyecto `norvxqgohddgsdkggqzq`).
- Notas y scripts en `scratchpad/actividades/`. Los archivos con nombres de médicos no salen de ahí.

**Se apoya en**:
- `docs/fases/fase8-visitas-f3-f4-reporte-y-app-movil.md` (F3, F4 y F4.1).
- `docs/specs/2026-10-15-usabilidad-y-agenda-con-hora.md`, que está en la rama `feat/app-usabilidad-agenda-hora`.
  Su tanda 1 está implementada y todavía no está en master.

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
- `requireEjecutiva` responde 403 a 4 de las 5 líderes y a la directora, aunque `line_leader` y
  `commercial_director` ya tienen `visits:report`.
- Paola (líder de Trauma y Ejecutivo Comercial de Sustitutos óseos) solo puede reportar Sustitutos óseos.

**Qué se puede registrar.** Solo hay dos tipos, y los dos son visitas: médica e institucional.
- No caben una cena con varios médicos, una correría de varios días, un congreso, una capacitación ni una junta en
  clínica.
- La agenda deja planear solo de hoy a hoy + 30 días.

**Quién lo ve.** La directora no tiene dónde ver dónde está su gente ni qué planeó. Lleva un Excel ("Tracker
Líderes"):
- 212 filas de las 5 líderes, de mayo a noviembre de 2026.
- 24 de esas filas están planeadas a futuro, 6 de ellas a 34–41 días.
- En su hoja DASHBOARD, "Contactos impactados" y "Ciudades visitadas" salen siempre en 0 porque son texto libre.
- No muestra lo planeado ni la anticipación.

## Resultado esperado

1. **Una sola app, la de hoy**, para toda persona de campo: Ejecutivos Comerciales, líderes con o sin zona y, si el
   dueño lo decide, la directora (A1).
   - Paola entra una vez y tiene una sola agenda. Reporta como líder (Trauma) o como Ejecutivo Comercial (Sustitutos
     óseos) según las líneas de lo que hizo.
   - Un usuario sin líneas, como hoy un `sales_manager` sin Ejecutivo Comercial, sigue sin entrar.
2. **La app habla de actividades, no de visitas médicas.**
   - "Reportar actividad", "Actividades de hoy" y "¿Qué hiciste?".
   - "Visita" queda solo para "Visita a médico" y "Visita institucional".
   - Los nombres del código no cambian (`visits`, `visitas_agenda`, `visits:report`), como pasó con las Zonas.
3. **Nueve tipos de actividad, cada uno con su formulario.**
   - Las dos visitas de hoy siguen iguales.
   - Se añaden: reunión o junta en clínica, cena o almuerzo comercial, capacitación, congreso o evento,
     acompañamiento a cirugía, correría y otro.
   - La cena pide qué médicos asistieron.
   - El congreso no pide lista de médicos.
   - Los compromisos admiten "Ninguno".
4. **Agenda para todos.**
   - Se planea cualquier tipo, con hora o, en correría y congreso, "todo el día" con un rango de fechas.
   - La ventana llega hasta N días adelante (A3).
   - Una cita o actividad se reprograma y la original queda en el historial como "reprogramada".
   - Dos actividades con hora no se cruzan en su media hora.
5. **Web `/equipo`, "¿Dónde está mi gente?"**, con tres pestañas: Hoy, Próximas semanas y Tablero.
   - Por persona: dónde está según lo que reportó o planeó, qué hizo hoy y qué tiene planeado.
   - Cada actividad dice "planeada hace N días".
   - El Tablero reemplaza la hoja DASHBOARD y cuenta los contactos y las ciudades que hoy salen en 0.
6. **El histórico del Excel queda en OpMap** con un script idempotente con modo de ensayo. Desde el corte, la
   directora deja de usar el Excel.
7. **Lo que no cambia**:
   - Nada sigue la ubicación en segundo plano.
   - El mapa se ve igual.
   - Nadie llama a Google.
   - La cuota y las metas de los Ejecutivos Comerciales no cambian.

## Decisiones

**Del dueño (2026-10-15).** Se anotan en `docs/decisiones/2026-10-15-actividades-de-campo.md` al aprobar esta spec.

1. Una sola aplicación para Ejecutivos Comerciales y líderes. No es un "módulo de visitas médicas": es lo que hace la
   gente de campo.
2. Las líderes agendan sus propias actividades, y la directora ve qué hace y qué planeó cada persona, líderes y
   Ejecutivos Comerciales.
3. La anticipación ("hace cuántos días lo programó") se muestra. No se restringe.
4. En una cena se registran los médicos que asistieron. Si varias líderes fueron, cada una la reporta con sus
   asistentes. En un congreso no se listan los médicos.
5. **Reprogramar sí, con historial.**
   - La cita original pasa a "reprogramada" y se crea una cita nueva enlazada a ella.
   - La nueva cuenta como agendada solo si se reprogramó antes del día de la visita.
   - Cambia la recomendación D3 de la spec de usabilidad, que conservaba `created_at`.
6. **Dos citas no se cruzan en su media hora**: es un bloqueo, ya no solo un aviso. Cambia la decisión 5 de Claude y
   la D4 de la spec de usabilidad.

Las decisiones 5 y 6 llegaron en la sesión del 2026-10-15 y todavía no están en `docs/decisiones/`. Se anotan junto
con las demás.

**De Claude (el dueño puede cambiarlas).**

7. **Quien hace la actividad es la persona (`users.id`). El Ejecutivo Comercial es opcional en cada actividad.**
   Esto se llama opción (a). Se descartaron dos alternativas:
   - (b) Una tabla de "personas de campo": crea una tercera identidad que habría que mantener al día con
     `users.active`, con "Contratar" y con el traspaso.
   - (c) Hacer a las líderes Ejecutivos Comerciales sin zona: choca con `executives_user_id_key UNIQUE`, porque Paola
     no puede tener dos filas. Además mete a las líderes al motor de cobertura: Trauma tiene 0 ejecutivos, así que
     Paola quedaría como alcance de Trauma en todo el país. Y aparecerían en `/executives`, en el traspaso, en el anexo y
     en las metas generales.

   Ya hay un precedente de unir por usuario: `resolveUserLines` en `web/lib/coverage.ts`.
8. **`visits` sigue siendo solo para la visita a médico y la institucional.**
   - Esa tabla alimenta el mapa de calor y "IPS sin visitar" (5 km), y exige sede, un solo médico y coordenadas.
   - Los otros 7 tipos van en una tabla nueva, `actividades`. Ahí el plan y el reporte son la misma fila.
9. **La lista de tipos es fija en el código.**
   - Las reglas de cada tipo (sede, radio, asistentes, rango de fechas) son código y llevan pruebas.
   - "Otro", con tema obligatorio, recoge lo demás.
   - Se revisa con el uso real. Hoy "Otro" es el 6 % de las filas del Excel.
10. **La cuota y las metas siguen siendo solo del Ejecutivo Comercial.**
    - Los 7 tipos nuevos no suman a las metas médica ni institucional: si sumaran, una junta con 10 médicos inflaría la
      meta diaria. Se muestran aparte, en "Otras actividades".
    - Un día de congreso, capacitación o correría cuenta como "día con otras actividades", no como "día sin visitas".
11. **"Dónde está" sale solo de lo que la persona reporta o planea.** Nunca del GPS del teléfono en segundo plano:
    `mobile/app.json` ya lo bloquea. En pantalla se muestran la sede o el municipio, nunca coordenadas.
12. **Una actividad que no se reportó queda "Atrasada" o "Sin cerrar".** No se cierra sola: "Atrasada" el mismo día y
    "Sin cerrar" desde el día siguiente. Lo calcula la lectura; no es un estado guardado.

## Modelo de datos

### Quién es quién

- **Persona de campo**: usuaria activa (`users.active`) con `persona_lineas(user)` no vacío.
- **`persona_lineas(user)`** es la unión de:
  - las `executive_lines` de su Ejecutivo Comercial activo;
  - las líneas con `business_lines.leader_user_id = user`;
  - todas las líneas activas, si es `commercial_director` y el dueño dice que sí en A1.

  Se escribe dos veces, en SQL y en TS (`lineasParaReportar`), y las dos llevan las mismas pruebas.
- **El Ejecutivo Comercial de una visita o actividad** es el de la persona solo si alguna de sus líneas está en las
  `executive_lines` de ese Ejecutivo Comercial. Si no, queda NULL y la persona actúa como líder.
- **Con Ejecutivo Comercial**, todo sigue como hoy: zona obligatoria, zona de la visita, fuera de territorio según
  `medico_visitantes`, `config_personas`, cuota y días libres.
- **Sin Ejecutivo Comercial**:
  - La zona de la visita (`kam_id`) queda NULL y `kam_name` toma `users.full_name`.
  - `out_of_territory` queda en false.
  - Usa la configuración general: médica e institucional, radio general y sin telefónica. Así nunca cae al "punto de
    la zona" del mapa.
  - Sin cuota y sin días libres en la v1 (A5).
- **Candado, topes, idempotencia y duplicados van por persona**: `pg_advisory_xact_lock('visitas_app:' || user_id)`.
  Así Paola tiene una sola agenda, un solo tope por médico y un solo `client_id`.
- **El historial no se traspasa.** Las visitas, citas y actividades son de la persona y conservan el Ejecutivo
  Comercial y la zona de ese momento. El traspaso de la 0820 no tiene que moverlas.

### Dos migraciones: 0850 y 0860 (por qué no una)

La 0850 ya estaba reservada en la spec de usabilidad (D3) para `agenda_reprogramar`. Se organiza así:

- **0850 "persona de campo y agenda"**: la persona como actor, reprogramar y el bloqueo de choques.
  - Reprogramar y el bloqueo reescriben `agenda_crear` y `agenda_cancelar`. Pasar esas funciones a `user_id` exige
    reescribirlas igual. Juntar las tres cosas evita reescribir los mismos cuerpos dos veces y vigilar dos huellas md5
    seguidas.
  - Cambia tablas que ya tienen datos (1 visita de la app y 20 citas) y su rollback tiene guardas.
- **0860 "actividades de campo"**: 3 tablas nuevas y sus funciones.
  - Es aditiva y no toca `visits`.
  - Su rollback solo quita lo suyo y restaura `agenda_choque` de la 0850.
  - Va en otra fase: la 0850 sola ya sirve, porque las 4 líderes y Paola pueden agendar y reportar visitas, y el
    riesgo queda separado.

Rollbacks: `9945` es el de la 0850 y `9946` el de la 0860. El `9946` se corre antes que el `9945`. Las dos se aplican
solo con autorización del dueño, en la misma ventana que el despliegue de su código. Las dos son transaccionales y se
pueden volver a correr.

### 0850 — `2026-10-xx_0850_persona_de_campo_y_agenda.sql`

0. **Precondiciones**
   - La 0830 y la 0840 están aplicadas. En producción la última es `visitas_agenda_0840`.
   - El md5 de `visitas_registrar`, `visitas_editar`, `visitas_anular`, `agenda_crear` y `agenda_cancelar` es el de
     la 0840.
   - Se toma la huella de las 7.033 visitas de VMO.
1. **`visits.user_id`** (uuid, NULL, referencia a `users`).
   - Relleno: las visitas de la app toman `executives.user_id`. Hoy es 1 fila. Si queda alguna de la app sin
     `user_id`, la migración se detiene.
   - `visits_app_check` pasa a exigir tres cosas:
     - `user_id NOT NULL`;
     - `executive_id IS NULL OR kam_id IS NOT NULL`;
     - `out_of_territory`, solo con Ejecutivo Comercial.
   - Índices nuevos: `visits_user_date_idx (user_id, visit_date) WHERE source='app'` y
     `visits_user_next_step_idx (user_id, next_step_date)`. Se conservan los de `executive_id`.
2. **`visitas_agenda`**
   - `user_id` (NOT NULL, referencia a `users`), rellenado desde `executives.user_id`: hoy son 20 filas, todas de una
     persona. No se rellena desde `created_by`, porque las 20 las creó un admin en la simulación.
   - `executive_id` pasa a NULL.
   - Los índices únicos `visitas_agenda_medico_uidx` y `visitas_agenda_cuenta_uidx` pasan a `user_id`. Esos índices
     excluyen las citas canceladas y las reprogramadas.
   - Índice nuevo: `visitas_agenda_user_fecha_idx`.
   - Reprogramar:
     - El estado admite `'reprogramada'`.
     - Columnas nuevas: `reprogramada_de` (uuid, NULL, referencia a `visitas_agenda`, UNIQUE: una cita se reprograma
       una sola vez y puede haber cadena), `reprogramada_at` y `reprogramada_motivo` (≤ 300).
     - CHECK: una cita reprogramada no tiene visita y tiene `reprogramada_at`.
   - Se corrige el comentario de la columna `hora` ("opcional…"), como pide la decisión del 2026-10-15.
3. **Funciones nuevas**, de solo `service_role` y `SECURITY INVOKER`:
   - `persona_lineas(p_user)` → uuid[].
   - `persona_de_campo(p_user)` → jsonb `{ user_id, nombre, rol, executive_id, kam_id, lineas_ec[], lineas_lider[] }`.
     Error 23514 "Tu usuario no tiene líneas para reportar".
   - `visitas_config_persona(p_user, p_fecha)`: con Ejecutivo Comercial llama a `visitas_config_vigente`, que no se
     toca porque su md5 lo vigila la 0840. Sin él, devuelve la configuración general.
   - `agenda_choque(p_user, p_fecha, p_hora, p_excluir_cita)` → la primera cita en pie de ese día con
     `|hora − p_hora| < 30 min`, o null. Es la misma regla que `sePisan` en `mobile/lib/agenda.ts`.
     - Las citas sin hora, las canceladas y las reprogramadas no chocan.
     - Hoy hay 0 pares que se crucen en producción.
   - `agenda_reprogramar(p_id, p jsonb, p_user)` → `{ cita_id, reprogramada_de }`, con
     `p = { fecha, hora, sede_id?, nota?, motivo? }`.
     - Solo la cita pendiente de la propia persona, de hoy o futura, o atrasada de hasta 7 días (A15).
     - La nueva conserva tipo, médico o cuenta y subtipo; la sede y la nota pueden cambiar.
     - Pasa las mismas validaciones que `agenda_crear`: ventana, día libre, perfil, sede, duplicado y choque. El
       duplicado y el choque excluyen la cita original.
     - La original pasa a `reprogramada`. La nueva lleva `created_at = now()`, así que cuenta como agendada solo si se
       reprogramó antes del día (decisión 5).
4. **Funciones reemplazadas**, con la misma firma: `visitas_registrar`, `visitas_editar`, `visitas_anular`,
   `agenda_crear` y `agenda_cancelar`.
   - Como la API de hoy sigue funcionando, la migración puede ir antes que el código.
   - La persona sale de `p_user`. `p.executive_id` se acepta y se comprueba que sea el suyo.
   - El candado y los topes van por `user_id`.
   - Las líneas deben estar en `persona_lineas` ("Alguna de las líneas no es tuya").
   - El Ejecutivo Comercial de la visita sigue la regla de "Quién es quién".
   - `agenda_crear`:
     - Error 23P01 "A las 09:30 ya tienes cita con …: elige otra hora".
     - Ventana `c_dias_adelante` = 30 o el valor que se decida en A3. El espejo `DIAS_AGENDA_ADELANTE` de la web y de
       la app se comprueba igual.
     - El día libre se revisa solo si la persona tiene Ejecutivo Comercial.
   - `agenda_cancelar`: el motivo pasa a obligatorio si el dueño lo decide (A9). Mientras tanto queda opcional, como
     hoy.
5. **Privilegios**: `REVOKE` a PUBLIC, anon y authenticated; `EXECUTE` a `service_role`. No hay políticas RLS nuevas.
6. **Bloque DO de pruebas** (`RAISE SQLSTATE 'P0850'`), que se deshacen al terminar:
   - Una líder real sin Ejecutivo Comercial agenda y reporta una visita médica presencial de su línea. Una línea ajena
     se rechaza.
   - Un usuario sin líneas se rechaza.
   - Paola reporta una visita de Trauma y queda con `executive_id` NULL. Una de Sustitutos óseos queda con su
     Ejecutivo Comercial. Las dos van a la misma agenda y al mismo tope por médico.
   - Choque: 09:00 contra 09:15 se rechaza; 09:00 contra 09:30 se acepta; una cita sin hora nunca choca.
   - Reprogramar: la propia, la ajena, una hecha, una cancelada, dos veces la misma y la cadena.
   - "Agendada" con la reprogramación el día anterior y el mismo día.
   - Las 20 citas y la visita existentes conservan su vínculo, y las 7.033 de VMO quedan idénticas.

**Rollback `9945`**:
- Se detiene, mostrando el conteo, si hay citas `reprogramada`, citas con `executive_id` NULL o visitas de la app con
  `executive_id` NULL. Esas filas ya no cumplen las reglas de la 0840, y el dueño decide antes qué hacer con ellas.
- Si no, restaura los cuerpos de la 0840 (copia exacta), los índices por `executive_id`, el NOT NULL y los CHECK, y
  quita las columnas, los índices y las funciones nuevas.

### 0860 — `2026-10-xx_0860_actividades_de_campo.sql`

**Tabla `actividades`.** Una fila es el plan y también el reporte.

**Quién y de qué tipo**

| Columna | Tipo y regla |
|---|---|
| `id` | uuid PK |
| `user_id` | NOT NULL → `users` |
| `executive_id` | NULL → `executives`, con la regla de "Quién es quién" |
| `tipo` | `reunion_clinica`, `comida`, `capacitacion`, `congreso`, `cirugia`, `correria` u `otro` |
| `estado` | `planificada`, `realizada`, `cancelada` o `reprogramada` |

**Cuándo**

| Columna | Tipo y regla |
|---|---|
| `fecha_desde`, `fecha_hasta` | NOT NULL; `fecha_hasta` ≥ `fecha_desde` y ≤ `fecha_desde` + 13; varios días solo en `correria` y `congreso` |
| `hora`, `todo_el_dia` | `todo_el_dia` es verdadero exactamente cuando `hora` es NULL |

**Dónde y con quién**

| Columna | Tipo y regla |
|---|---|
| `municipio_id` | varchar(5) → `municipalities(code)`; se deriva de la sede si hay sede |
| `cuenta_id`, `sede_id` | NULL → `cuentas` y `sedes` |
| `medico_id` | NULL; el cirujano, solo en `cirugia` |
| `acompana_executive_id` | NULL; "acompaña a", solo en `correria` |
| `tema` | ≤ 200; nombre del evento, tema u objetivo |
| `momento` | `cena`, `almuerzo` o `desayuno`; solo en `comida` |
| `dirigida_a` | `equipo_vg`, `cuenta` o `medicos`; solo en `capacitacion` |
| `modalidad` | `presencial` o `virtual` |
| `asistentes_sin_lista` | boolean; "No sé los nombres" |
| `asistentes_aprox` | int, NULL |

**Resultado**

| Columna | Tipo y regla |
|---|---|
| `efectiva`, `motivo_no_efectiva` | solo en `reunion_clinica` y `cirugia` |
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
| `programada_at` | timestamptz NULL; momento en que se planeó; NULL si se reportó sin plan o se importó |
| `reportada_at`, `reportada_tarde` | `reportada_tarde` es boolean |
| `cancelada_at`, `cancelada_motivo_codigo`, `cancelada_motivo` | códigos: `cliente`, `falta_tiempo`, `fuerza_mayor`, `prioridad`, `baja`, `no_registrado` (este, solo en importadas) y `otro` |
| `reprogramada_de` | UNIQUE → `actividades`; con `reprogramada_at` |
| `anulada_at`, `anulada_por`, `anulada_motivo` | como en `visits` |
| `client_id` | UNIQUE por persona; idempotencia |

**Origen y auditoría**

| Columna | Tipo y regla |
|---|---|
| `origen` | `app` o `tracker_lideres` |
| `origen_ref` | UNIQUE con `origen` cuando no es NULL |
| `origen_datos` | jsonb: las 7 columnas originales y las marcas |
| `created_by`, `created_at`, `updated_at` | |

- CHECK por tipo: los de la tabla de tipos. Los de la app exigen `municipio_id` o `sede_id`. Los importados admiten el
  municipio NULL con una marca.
- CHECK por estado: igual que en `visitas_agenda`.
- Disparadores:
  - `updated_at`.
  - `visitas_sin_borrar()`: una actividad no se borra; se cancela o se anula.

**Tabla `actividad_asistentes`**: `id`, `actividad_id`, `medico_id`, `contacto_id`, `nombre_texto` (≤ 120) y
`vinculo` (`enlazado` o `por_vincular`).
- Cada fila lleva exactamente uno de `medico_id`, `contacto_id` o `nombre_texto`.
- `UNIQUE (actividad_id, medico_id)`.
- Nunca crea fichas en `medicos`: un médico se crea completo o no se crea.

**Tabla `actividad_lineas`**: `(actividad_id, business_line_id)` PK.
- En la app, sus líneas deben estar en `persona_lineas`.
- En las importadas puede estar vacía, con marca.

**Índices**: `(user_id, fecha_desde)`, `(user_id, estado, fecha_desde)` y `(municipio_id, fecha_desde)`.

**Funciones**: todas con el candado de la persona, de solo `service_role`, con errores 22023, 23514, 23505 y 23P01
como en la 0840.
- `actividad_planear(p, p_user)`:
  - Ventana: la de A3.
  - Choque de su media hora con citas y actividades con hora.
  - Una correría no se cruza con otra correría de la misma persona ("Ya tienes una correría del 18 al 21").
  - El día libre se revisa solo si tiene Ejecutivo Comercial.
- `actividad_reportar(p, p_user)`, de dos formas:
  - Reporte directo, con `client_id`.
  - Cierre de una planificada, con `actividad_id`.
  - Valida según el tipo. Calcula `reportada_tarde`, `municipio_telefono` y `dentro_radio`.
- `actividad_editar`: dentro de `plazo_gracia_horas`.
- `actividad_cancelar`: el motivo es obligatorio.
- `actividad_reprogramar`: la misma regla que en las citas.
- `actividad_anular`.
- `agenda_choque`: `CREATE OR REPLACE` para que mire también las actividades `planificada` con hora.

**Bloque DO** (`P0860`):
- Cada tipo, válido y con su rechazo típico.
- Choque entre una cita a las 10:00 y una cena a las 10:15.
- Una correría que se cruza con otra.
- Una cena sin asistentes y sin "No sé los nombres".
- Reporte de ayer, aceptado, y de hace 8 días, rechazado.
- Idempotencia por `client_id`.
- Asistente "por vincular".
- Las tablas de la 0850 y las 7.033 de VMO quedan idénticas.

**Rollback `9946`**:
- Se detiene si hay actividades con `origen = 'app'`. Las importadas se pueden volver a importar.
- Si no, restaura `agenda_choque` de la 0850 y quita las tablas y funciones.

## Tipos de actividad: formulario y reglas

| Tipo (etiqueta visible) | Valor | Tabla | Con quién y dónde | Fecha y hora | GPS y radio | Resultado | Asistentes | Comentario, compromisos y próxima | Metas |
|---|---|---|---|---|---|---|---|---|---|
| Visita a médico | `medica` | `visits` | médico + sede | hoy, hora real | radio, como hoy | efectiva o no efectiva + motivo | — | conclusión, compromisos y próxima reunión | como hoy |
| Visita institucional | `institucional` | `visits` | cuenta + sede + subtipo (+ contacto) | hoy | radio | efectiva o no efectiva + motivo | — | igual | según el subtipo, como hoy |
| Reunión o junta en clínica | `reunion_clinica` | `actividades` | cuenta + sede, obligatorias | hoy | radio si es presencial; sin GPS si es virtual | efectiva o no efectiva + motivo | médicos, opcionales | comentario, compromisos y próxima reunión | no suma |
| Cena o almuerzo comercial | `comida` + momento | `actividades` | municipio; cuenta o grupo opcional | hoy o ayer, con hora | sin radio; rastro = municipio del teléfono | realizada | se piden; salida "No sé los nombres" + grupo (A7) | comentario y compromisos | no suma |
| Capacitación | `capacitacion` | `actividades` | dirigida a (equipo VG, cuenta o médicos) + tema; municipio si es presencial | hoy o ayer; hora o todo el día | sin radio | realizada | opcionales + cantidad aproximada | comentario y compromisos opcionales | no suma |
| Congreso o evento | `congreso` | `actividades` | nombre del evento + municipio | rango de 1 a 14 días, todo el día | sin radio | realizada | no se piden; hasta 5 destacados, opcionales | comentario | no suma |
| Acompañamiento a cirugía | `cirugia` | `actividades` | sede; cirujano opcional | hoy | radio | efectiva o no efectiva | el cirujano | comentario (nunca datos del paciente: no hay campo) | no suma |
| Correría | `correria` | `actividades` | un municipio por correría; "acompaña a" opcional; objetivo | rango de 1 a 14 días, todo el día; se planea | sin GPS: el rastro sale de lo que reporta esos días | se cierra o se cancela | — | balance opcional al cerrar | no suma |
| Otro | `otro` | `actividades` | tema obligatorio; municipio opcional | hoy o ayer; hora o todo el día | sin radio | realizada | opcionales | comentario y compromisos opcionales | no suma |

Reglas comunes:

- **Ventana para reportar.** Las actividades que no son visita se reportan entre `fecha_desde` y `fecha_hasta` + 1 día
  ("la cena de anoche"). Hasta 7 días después se aceptan con la marca "tarde", que la directora ve (A13). Después,
  solo se cancelan.
- **Las visitas no cambian**: mismo día y plazo de gracia, como hoy.
- **Correría de dos ciudades**: son dos correrías seguidas. Las actividades de esos días quedan unidas a la correría
  por persona, fechas y municipio. No hay una columna para eso.
- **Líneas**: al menos una. Por defecto vienen marcadas todas las de la persona; quien tiene dos papeles elige.
- **Ciudad**: se elige con `SelectorMunicipio` (código DANE), nunca se escribe. Lo dictado se resuelve con
  `municipio-alias`.
- **Asistentes**: se buscan por nombre en el servidor, como "Buscar en OpMap", prefiriendo la ciudad de la actividad.
  - La tarjeta muestra "enlazado", "2 coincidencias: elige" o "no está en OpMap".
  - Lo que no cruza se guarda como `por_vincular` y lo enlaza después el equipo de datos.
  - Solo los enlazados cuentan como "médicos impactados".
- **"Mis médicos" de una líder sin Ejecutivo Comercial** son los visitantes vigentes de las líneas que lidera, más el
  buscador.
- **Subtipos institucionales nuevos** ("Seguimiento comercial" y "Cartera y facturación"): son datos que se cargan
  desde `/configuracion` en modo seguimiento, sin código (A14).

## La app (una sola)

- **Sesión**
  - `GET /api/auth/me` (MeResponse) añade
    `persona: { rol: 'ejecutivo'|'lider'|'lider_y_ejecutivo'|'direccion', lineas: [{ id, nombre, como: 'ejecutivo'|'lider' }] }`.
  - `ejecutiva` sigue igual: es null si no hay Ejecutivo Comercial.
- **Hoy**
  - Desaparece el aviso "no está enlazado" para quien es persona de campo.
  - Muestra:
    - "Actividades de hoy": las visitas, las citas y las actividades planeadas.
    - La banda "De correría en Cartagena · día 2 de 4".
    - "¿Se hizo o se canceló?" para lo atrasado y lo sin cerrar, con Reportar, Reprogramar o Cancelar.
  - Tocar algo planeado abre Reportar con eso ya elegido, como las citas en la tanda 1.
- **Reportar** empieza por "¿Qué hiciste?", con los 9 tipos (el tipo se oculta si viene de un plan). Luego:
  - La tarjeta por toques se adapta al tipo.
  - La voz de las visitas sigue igual en F1 y F2. En F5 la voz propone los tipos nuevos.
- **Agenda**
  - Agendar empieza por "¿Qué vas a hacer?". Después vienen el calendario y la hora, o "Todo el día" + "Hasta" en
    correría y congreso (A10).
  - Mi agenda dibuja la correría y el congreso como una banda sobre sus días.
  - En el detalle hay "Reprogramar". El choque es un error: "A las 09:30 ya tienes cita con …: elige otra hora".
    `avisoChoque` de la tanda 1 deja de decir "Puedes agendar igual".
- **Números**
  - Sin Ejecutivo Comercial no hay cuota: `/api/me/numeros` devuelve `cuota: null`.
  - Todos ven "Otras actividades del mes" por tipo y la agenda: planeadas, hechas, reprogramadas, canceladas y
    anticipación mediana.
- **Días libres** se oculta sin Ejecutivo Comercial (A5).
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
| Prompt: "asistente de reporte de visitas" | "asistente de reporte de actividades de campo" |

Las metas siguen diciendo "Visitas a médicos" y "Visitas institucionales", porque son tipos. El nombre de la app
("VG Visitas") lo decide el dueño (A12). El título del mapa web ("Visualización de Visitas Médicas") no se toca sin su
visto bueno: está en el mapa.

## Voz (fase F5)

- **Tipos en la herramienta.** `proponer_visitas` admite `TipoActividad` sin `correria`: una correría se planea en
  Agendar, y el aviso lo dice.
- **Campos nuevos, todos sin null.** La herramienta estricta ya usa 12 de los 16 parámetros con unión que permite la
  API y 0 opcionales.

  | Campo | Forma |
  |---|---|
  | `fecha` | AAAA-MM-DD; en las visitas se fuerza a hoy y en las demás se admite hoy o ayer |
  | `tema` | texto; "" si no lo dijo |
  | `ciudad_dicha` | texto; "" si no la dijo |
  | `asistentes_ids` | lista de ids del contexto |
  | `asistentes_dichos` | lista de nombres que no cruzaron |
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

**Permiso.** `team:view` es un permiso nuevo para `admin`, `commercial_director` y `line_leader`. El alcance lo pone la
API con `personasVisibles(usuario)`, una función pura:
- Dirección y administración ven a todas las personas.
- Una líder se ve a sí misma y ve a los Ejecutivos Comerciales activos de sus líneas: `ejecutivasDeMisLineas`
  filtrado por `status = 'active'`. Si ve también a las otras líderes lo decide el dueño (A2).
- Las ejecutivas no se ven entre sí.

**Personas.** Son las usuarias activas que son persona de campo; las vacantes no salen. Hoy son 14: 10 Ejecutivos
Comerciales activos con usuario y 4 líderes sin Ejecutivo Comercial, más la directora si el dueño lo decide (A1).
Paola sale una sola vez, con dos etiquetas.

**Menú**: "Equipo", después de Calendario. Se ajusta `menu-check`. La página se ve a 390 px: la directora y las líderes
la abren desde el celular.

**Pestaña Hoy** ("¿Dónde está mi gente?"):
- Arriba, un texto fijo: "Lo que cada persona reporta o agenda. La app no sigue la ubicación."
- Un resumen por ciudad, por ejemplo "Cartagena 2 · Bogotá 6 · Sin reporte ni plan 3".
- Una tarjeta por persona. `dondeEsta` toma el primer caso que se cumple:
  1. Día libre aprobado de día completo, o festivo sin nada reportado.
  2. Correría o congreso en curso: "De correría en Cartagena · día 2 de 4 · planeada hace 12 días".
  3. Última actividad presencial reportada hoy: "10:40 · <sede>, Montería (hace 35 min)". Pasadas 3 horas dice "Último
     reporte hace 4 h".
  4. Algo planeado entre 30 min antes y 60 min después (como `citaDeAhora`): "Planeado 11:00 · <sede>".
  5. "Sin reportes ni plan hoy".
- Las telefónicas y las virtuales no ubican a la persona.
- Cada dato lleva su fuente: Reportado, Planeado o Correría declarada.
- El rastro del día va por hora, con:
  - el tipo;
  - con quién: médico, cuenta o "Cena · 6 médicos";
  - la sede o el municipio;
  - el estado: Hecha, No efectiva, Cancelada, Reprogramada, Pendiente, Atrasada o Sin cerrar;
  - "planeada hace N días" o "no planeada".
- Al final va "Siguiente" con lo de hoy y los 2 días que vienen.
- Hay un selector de día, para ver cualquier día pasado.
- Filtros: todas, líderes o Ejecutivos Comerciales, y línea.
- La página se relee cada 5 minutos mientras está a la vista: lee reportes, no pide ubicación.

**Pestaña Próximas semanas**:
- Una cuadrícula con las personas en filas y los días en columnas: 14 días, o 4 semanas como opción.
- Cada celda muestra la ciudad del día. La correría y el congreso van como banda; el día libre en gris; el festivo
  marcado.
- Tocar una celda muestra sus actividades con su anticipación.
- En el celular es una lista por persona, una fila por semana.

**Pestaña Tablero**, que reemplaza las hojas DASHBOARD, POR LÍDER y CIUDADES:
- Periodos: semana, 15 días, mes o un rango libre.
- Tarjetas:
  - Realizadas, No efectivas, Canceladas (por motivo), Reprogramadas, Sin cerrar y Planeadas.
  - Médicos distintos, Cuentas distintas, Ciudades distintas y Días de correría.
  - Anticipación: mediana, % con 7 días o más (A11) y % del mismo día.
  - Cumplimiento del plan: hechas ÷ planeadas hasta hoy, sin contar las reprogramadas.
- Una tabla por persona con las mismas columnas.
- Una tabla de tipo × estado.
- "Ciudades más visitadas": días-persona por municipio.
- "Cenas y almuerzos":
  - Eventos y médicos invitados distintos.
  - Por médico: invitaciones, quién lo reportó, última invitación, y visitas y compromisos en los 30 y 90 días
    siguientes, con la marca "Sin actividad posterior".
  - La columna "Órdenes" queda vacía hasta que exista una fuente (A8).
- "Descargar en Excel", con la librería xlsx que la web ya tiene.

**Reglas de las cifras**, todas en `web/lib/equipo.ts`:

- **Anticipación** = fecha (o `fecha_desde`) − fecha en Bogotá de `created_at`, en las citas, o de `programada_at`, en
  las actividades.
  - Lo reportado sin plan cuenta como "no planeada": entra en los porcentajes y no en la mediana.
  - Las importadas son "sin dato".
  - Una cita reprogramada mide desde su propio `created_at`, y su detalle dice además "programada originalmente hace N
    días", siguiendo `reprogramada_de`.
- **Médicos distintos** = los `medico_id` distintos de:
  - visitas médicas efectivas;
  - asistentes enlazados de reunión, cena, capacitación y congreso;
  - el cirujano.

  Por persona son los distintos de esa persona. Para el equipo, los distintos de todo el equipo, sin sumar personas.
- **Evento compartido**: misma fecha, mismo tipo y misma sede o municipio. Un médico invitado a una cena que
  reportaron tres líderes cuenta una invitación.
- **Ciudades** = municipios distintos de las actividades presenciales realizadas.

**API**, de solo lectura, con `requirePermission('team:view')` y `personasVisibles`:
- `GET /api/equipo/hoy?fecha=`.
- `GET /api/equipo/plan?desde&hasta`, con 62 días como máximo.
- `GET /api/equipo/tablero?desde&hasta&linea&persona`.
- `GET /api/equipo/persona/[id]?desde&hasta`: la transcripción sale solo en el detalle de una actividad.

Todas usan `supabase-admin` con `no-store` y `fetchAllRows`. Nunca devuelven las coordenadas del teléfono, documentos
ni teléfonos. No llaman a Google.

**El mapa no cambia.** Las visitas sin Ejecutivo Comercial se excluyen de `/api/visits/filtered`, `stats` y
`unvisited-zones` (`executive_id IS NOT NULL`) hasta que el dueño decida (A4).

## Importación del histórico del Excel (fase F3)

`web/scripts/importar-tracker-lideres.ts <ruta.xlsx> [--plan | --aplicar]`. El modo por defecto es `--plan`.

- **Entrada**: lee el xlsx con la librería `xlsx`. El archivo nunca entra al repositorio. No llama a Google ni a
  ninguna IA.
- **Tablas fijas**:
  - 5 alias de persona → `users.id`, sin cruce aproximado.
  - 21 alias de ciudad → código DANE; se registran en `municipio_alias` con fuente `tracker_lideres`.
  - El tipo del Excel → los 9 tipos, uno a uno. El tipo original se guarda en `origen_datos`.
- **Fechas**: corrige con reglas explícitas las 5 raras (2 escritas como texto y 3 con año 2016) y las marca.
- **Estados**:

  | En el Excel | Al importar |
  |---|---|
  | Exitosa | realizada |
  | Cancelada | cancelada, con motivo `no_registrado` |
  | Sin estado, de hoy en adelante | planificada |
  | Sin estado y pasada | planificada; la lectura la muestra "Sin cerrar" |

- **"Visita médico"** se importa a `actividades` como tipo `otro`, con `tipo_original = 'Visita médico'` y la marca
  "visita importada". No va a `visits`, que exige médico, sede y coordenadas.
- **Asistentes**: el texto de la columna F completo va a `comentario`. Los nombres extraídos van a
  `actividad_asistentes` como `nombre_texto`, `por_vincular`. No se crean fichas de médicos.
- **Sede** solo si es única en esa ciudad. Las instituciones ambiguas o que no existen quedan como texto en
  `origen_datos`.
- **Líneas**: la de la líder, más las que salgan con claridad de un producto nombrado. Las 21 filas de Paola sin pista
  quedan sin línea y con marca.
- **Lo que no se importa**:
  - Las 2 filas "VACACIONES": quedan en el informe (A5).
  - El duplicado exacto.
- **Idempotencia**:
  - `origen_ref` = sha1(persona | fecha corregida | tipo normalizado | ciudad normalizada | texto F normalizado), más
    `#n` si la fila se repite exacta.
  - Volver a correrlo no duplica: solo actualiza estado, comentario y motivo.
  - Nunca borra. Si una fila desaparece del Excel, se marca "retirada del origen".
- **`programada_at` queda NULL**: las importadas no suman a "agendadas", ni a la cuota, ni a la anticipación.
- **Resultado esperado de `--plan`** con el archivo real, solo con cifras:
  - 209 actividades, 2 ausencias y 1 duplicado.
  - 166 filas sin marca y 46 con alguna marca: 21 sin línea, 15 canceladas sin motivo, 7 pasadas sin estado, 5 fechas
    corregidas, 3 ciudades sin municipio y 1 duplicado. Una fila puede llevar varias marcas.
  - El informe va al scratchpad. Nunca imprime nombres de médicos.
- **Aplicar**: `--aplicar` se corre solo con autorización del dueño, después de la 0860 y en la fecha de corte.
  Antes, la directora resuelve con cada líder las 3 ciudades sin municipio.

## Plan por fases

Cada fase es un PR desde `master` con su spec, `npm run check` en verde en `web/` y `mobile/`, y revisión del subagente
`revisor`. F1 empieza cuando la tanda 1 de usabilidad esté en master. Si la tanda 2 sigue abierta, F1 no toca
`reportar.tsx` ni `_layout.tsx` más allá de lo que se lista aquí.

Tamaños: **S** = 1 a 5 archivos y sin migración. **M** = de 6 a 15 archivos. **L** = más de 15 archivos, o una
migración con funciones.

### F1 — Persona de campo y agenda (0850) · L

Sirve sola: las 4 líderes, Paola (con una sola agenda) y la directora (si A1) agendan y reportan visitas a médico e
institucionales. Además se reprograma con historial y no se cruzan dos citas.

**Archivos**
- Base: la 0850 y su rollback 9945.
- Servidor:
  - `web/app/api/config-visitas/_lib/visitas-server.ts`: `personaDeCampo` y `requirePersonaDeCampo`, que reemplaza a
    `requireEjecutiva` salvo en cuota y días libres.
  - `web/app/api/me/_lib/reporte-server.ts`: lecturas por `user_id`, `lineasDePersona` y `misMedicos` de la líder.
  - `web/lib/auth-server.ts` (`persona`).
  - `web/lib/reporte-visitas.ts`: `agendaChoca`, `MENSAJE_CHOQUE`, `DIAS_AGENDA_ADELANTE`,
    `reprogramacionValida` y `cuentasAgenda`, que excluye las reprogramadas.
  - `/api/me/agenda/[id]/reprogramar` (nueva).
  - Los mapeos de 23P01 a 409, con el error en `hora`.
  - El filtro `executive_id IS NOT NULL` en los 3 endpoints del mapa.
- App:
  - Pantallas: `hoy`, `ajustes`, `numeros`, `agenda` (detalle con Reprogramar), `agenda/nueva` y el layout (Días
    libres solo con Ejecutivo Comercial).
  - `mobile/lib/agenda.ts`: `avisoChoque` pasa a `errorChoque`.
  - Textos visibles de la tabla de "Textos visibles".

**Criterios de aceptación**
- [ ] `web/scripts/persona-campo-check.ts` (nuevo, puro):
  - `lineasParaReportar` da la unión de las líneas de Ejecutivo Comercial y las de líder.
  - Un `sales_manager` sin Ejecutivo Comercial da [] → "Tu usuario no tiene líneas para reportar".
  - `ejecutivoDeLaVisita` da el suyo si alguna línea es suya como Ejecutivo Comercial, y NULL con solo Trauma.
- [ ] `reporte-check.ts`:
  - `agendaChoca`: 09:00 contra 09:15 choca; 09:00 contra 09:30 no; una cita sin hora, cancelada o reprogramada nunca
    choca.
  - `citaAnticipada` con una reprogramada: el día antes es agendada; el mismo día, no.
  - `cuentasAgenda` no cuenta las reprogramadas en "citas hasta hoy".
  - `DIAS_AGENDA_ADELANTE` es igual en `web/lib/reporte-visitas.ts` y en `mobile/lib/agenda.ts` (lo comprueba leyendo
    los dos archivos).
- [ ] `reporte-api-check.ts`, con Supabase falso:
  - Una líder sin Ejecutivo Comercial:
    - `GET /api/me/contexto` → 200, con `persona.rol = 'lider'`.
    - `POST /api/me/visitas` con su línea → 201, sin Ejecutivo Comercial ni zona.
    - `POST /api/me/visitas` con una línea ajena → 400 "Alguna de las líneas no es tuya".
    - `GET /api/me/numeros` → `cuota: null`.
    - `GET /api/me/dias-libres` → 403.
  - Paola: una visita de Trauma → sin Ejecutivo Comercial; una de Sustitutos óseos → con el suyo.
  - `POST /api/me/agenda` con choque → 409, con el error en `hora` y sin guardar nada.
  - `POST /api/me/agenda/[id]/reprogramar`:
    - La propia → 201: la original pasa a `reprogramada` y la nueva queda enlazada.
    - La ajena → 404.
    - Una hecha o cancelada → 400.
- [ ] La 0850 corre en una base de prueba con su DO `P0850` en verde, y el 9945 la deshace. Las dos se ensayan en una
      rama de Supabase o en local, nunca en producción sin autorización.
- [ ] `mobile/scripts/checks/20-persona.ts`:
  - Hoy no muestra el aviso a una líder.
  - Números oculta la cuota sin Ejecutivo Comercial, y Días libres también se oculta.
  - `errorChoque` da el texto del servidor.
  - Ningún archivo de `mobile/app` contiene "Reportar visita", "Visitas de hoy" ni "Tipo de visita".
- [ ] Capturas a 390×844 de:
  - Hoy y Ajustes de una líder.
  - Ajustes de Paola.
  - Agenda con el detalle y Reprogramar.
  - El error de choque.

  Prueba en el iPhone del dueño con Expo Go.

### F2 — Actividades de campo por toques (0860) · L

Sirve sola: todos planean y reportan correrías, cenas con asistentes, congresos, juntas, capacitaciones, cirugías y
"otro". La captura deja de depender del Excel.

**Archivos**
- Base: la 0860 y su rollback 9946.
- Servidor:
  - `web/lib/actividades.ts`: `REGLAS_TIPO`, `validarActividad`, `ventanaReporte` y `asistentesResueltos`.
  - `web/lib/actividades-schemas.ts` (zod).
  - `/api/me/actividades` (POST: planear o reportar directo) y `/api/me/actividades/[id]/{reportar,cancelar,reprogramar,anular}`.
  - `GET /api/me/agenda` añade la clave `actividades`, que es aditiva.
  - `contexto.actividades_hoy`.
  - `/api/me/numeros` → `otras_actividades`.
- App:
  - `mobile/lib/actividades.ts`, un espejo de las reglas.
  - La tarjeta por tipo en `components/reporte/`.
  - "¿Qué hiciste?" y "¿Qué vas a hacer?".
  - Bandas en Mi agenda.
  - "¿Se hizo o se canceló?" en Hoy.

**Criterios de aceptación**
- [ ] `web/scripts/actividades-check.ts` (nuevo, puro), con un caso por cada regla de la tabla de tipos:
  - Una cena sin asistentes y sin "No sé los nombres" da "¿Qué médicos asistieron?".
  - Un congreso de 15 días se rechaza; uno de 3 días, todo el día, se acepta.
  - Una correría con hora se rechaza.
  - Una reunión en clínica sin sede se rechaza.
  - Los compromisos "Ninguno" se aceptan.
  - Ventana para reportar: hoy y ayer sin marca; de 2 a 7 días con la marca `tarde`; 8 días se rechaza.
  - `efectiva` solo se acepta en reunión y cirugía.
  - El reporte no tiene ningún campo de paciente.
- [ ] El espejo de la app da los mismos resultados que el servidor: la prueba compara `REGLAS_TIPO` de los dos.
- [ ] `reporte-api-check.ts`:
  - Planear una cena a las 10:15 con una cita a las 10:00 → 409.
  - Una correría que se cruza con otra → 400.
  - Reportar la planificada la cierra; reportar dos veces con el mismo `client_id` devuelve la misma.
  - Un asistente sin cruce queda `por_vincular`.
  - `GET /api/me/agenda` trae citas y actividades.
  - Una líder no puede usar una línea ajena.
- [ ] El DO `P0860` está en verde y el 9946 la deshace.
- [ ] `mobile/scripts/checks/21-actividades.ts`:
  - Cada tipo abre su formulario con los campos de la tabla.
  - Correría y congreso muestran "Todo el día" + "Hasta".
  - `PESTANAS` no cambia.
- [ ] Capturas a 390×844 de:
  - "¿Qué hiciste?".
  - La tarjeta de cena con asistentes enlazados y por vincular.
  - Agendar una correría de 4 días.
  - Mi agenda con la banda.
  - "¿Se hizo o se canceló?".

### F3 — Importación del tracker · S

Sirve sola: el histórico queda en OpMap con sus marcas, y la directora puede soltar el Excel.

**Archivos**: `web/scripts/importar-tracker-lideres.ts` y `web/scripts/tracker-lideres-check.ts`.

**Criterios de aceptación**
- [ ] `tracker-lideres-check.ts`, puro, con filas sintéticas sin nombres reales:
  - Las 5 fechas raras quedan corregidas y marcadas.
  - Los alias de ciudad se resuelven; "San Juan" y un departamento quedan sin municipio y con marca.
  - El mapeo de estados es el de la tabla.
  - "VACACIONES" no se importa.
  - El duplicado exacto se descarta.
  - Una segunda corrida inserta 0.
  - Si una fila desaparece del origen, se marca y no se borra.
- [ ] `--plan` con el archivo real da las cifras de la sección "Importación", sin nombres en la salida.
- [ ] `--aplicar` se corre solo con autorización del dueño. Se deja el conteo antes y después.

### F4 — "¿Dónde está mi gente?" (web `/equipo`) · L

Sirve sola: la directora ve hoy, lo planeado y el tablero, con el histórico importado y lo que llega desde la app. Su
desarrollo puede ir en paralelo con F2 y F3, porque solo lee.

**Archivos**
- `web/lib/equipo.ts`: `personasVisibles`, `dondeEsta`, `rastroDelDia`, `anticipacion`, `tablero`, `cenasPorMedico` y
  `ciudadesDistintas`.
- Las 4 rutas `/api/equipo/*`.
- `web/app/equipo/page.tsx` y sus componentes.
- `web/lib/permissions.ts` (`team:view` y el menú).
- `web/docs/ROLES_AND_PERMISSIONS.md`.

**Criterios de aceptación**
- [ ] `web/scripts/equipo-check.ts` (nuevo, puro):
  - `personasVisibles`:
    - La directora ve a todas.
    - Una líder se ve a sí misma y ve a los Ejecutivos Comerciales activos de sus líneas, sin vacantes.
    - Un `sales_manager` no ve a nadie.
  - `dondeEsta` respeta el orden de los 5 casos:
    - Más de 3 h da "Último reporte hace 4 h".
    - Una telefónica no ubica.
    - Un día libre gana a una cita.
  - Anticipación: mediana, % ≥ 7 y % del mismo día. Una reprogramada mide desde su `created_at`. Una importada es "sin
    dato".
  - Una cena con el mismo médico reportada por 3 personas da 1 invitación.
  - Ciudades distintas cuenta solo presenciales realizadas.
- [ ] `web/scripts/equipo-api-check.ts`, con Supabase falso:
  - Sin `team:view` → 403.
  - Una líder no ve a una persona fuera de su alcance → 404.
  - Ninguna respuesta lleva las claves `lat`, `lng`, `documento` ni `telefono` (la prueba recorre el JSON).
  - `plan` con más de 62 días → 400.
- [ ] `menu-check.ts`: "Equipo" va después de "Calendario" y solo aparece con `team:view`.
- [ ] Capturas en escritorio y a 390 px de Hoy, Próximas semanas y Tablero, con datos de prueba.

### F5 — Voz para todas las actividades · M

Sirve sola: lo que dicta la persona se convierte también en cenas, juntas, congresos y capacitaciones.

**Archivos**: `web/lib/reporte-visitas.ts` (esquema, prompt y `normalizarPropuesta`), `reporte-server.ts` (contexto) y
`mobile/lib/propuesta.ts`.

**Criterios de aceptación**
- [ ] `reporte-check.ts`:
  - Cuenta las uniones de `esquemaParaHerramienta(esquemaPropuesta)`: deben ser 16 o menos, con 0 opcionales.
  - `normalizarPropuesta`:
    - Fuerza hoy en las visitas.
    - Admite ayer en cena, congreso, capacitación y otro.
    - Convierte "" en null.
    - Rechaza `correria`.
- [ ] Evaluación de unos 20 dictados (requiere el aviso al dueño). Las visitas médicas aciertan lo mismo que antes y
      los tipos nuevos al menos 90 %. El informe queda en el scratchpad.

### F6 — Después (cada una S, cada una con su visto bueno)

- "Mi equipo hoy" en la app: una tarjeta en Hoy para quien tenga `team:view` que abre una pantalla de solo lectura con
  `/api/equipo/hoy`. No es una pestaña nueva.
- Cancelar las citas y actividades planificadas al dar de baja a alguien, con motivo `baja`, dentro del traspaso
  (A16).
- Días libres y configuración propios de las líderes (A5).
- La columna "Órdenes" de las cenas, cuando exista la fuente (A8).
- La opción de mapa que elija el dueño (A4).

## Impacto

- **Datos y migración**:
  - `0850_persona_de_campo_y_agenda` + `9945` (F1).
  - `0860_actividades_de_campo` + `9946` (F2).
  - Se aplican solo con autorización del dueño, en la ventana del despliegue de cada fase.
  - Después: `NOTIFY pgrst, 'reload schema'`.
- **Costo Google Maps**: 0. Ningún flujo llama a Google: la ciudad sale de la sede o de la lista DANE.
- **Costo OpenAI y Claude**: igual que hoy por dictado. La evaluación de F5 cuesta menos de 1 USD y se avisa antes.
- **Estética del mapa**: no cambia. Las visitas sin Ejecutivo Comercial quedan fuera de los endpoints del mapa hasta A4.
- **Permisos**:
  - `team:view` es nuevo.
  - `visits:report` pasa a significar "persona de campo", sin cambiar qué roles lo tienen.
  - Las líderes sin Ejecutivo Comercial y la directora (si A1) entran a `/api/me/*`.
- **Contrato de la fase 8, a documentar** en la sección F4.2 de `docs/fases/fase8-…`:
  - `MeResponse.persona`.
  - `reprogramar`.
  - 409 por choque.
  - `GET /api/me/agenda` con `actividades`.
  - `/api/me/actividades*`.
  - `cuota: null` sin Ejecutivo Comercial.
- **Documentación**: `docs/base-de-datos.md`, `docs/decisiones/2026-10-15-actividades-de-campo.md` y una línea en
  `CLAUDE.md` ("Dónde está el detalle").
- **Orden del despliegue**:
  - La 0850 conserva las firmas, así que puede ir antes que el código de F1.
  - La app de F1 funciona con la API vieja, salvo Reprogramar, que muestra "No disponible" ante un 404.
  - La 0860 va con el código de F2.

## Fuera de alcance

- Rastreo continuo o en segundo plano, y "ubicación en tiempo real": nunca.
- Capas, marcadores o colores nuevos en el mapa. Añadir 2026 al selector de año del mapa: lo pide aparte A4.
- Ventas, órdenes o prescripciones por médico, e integración con Odoo.
- Gasto por cena (A8).
- Ciudad base de las líderes y "fuera de su ciudad": la v1 dice "De correría en X" a partir de la propia correría.
- Unir las cenas compartidas a mano (`evento_id`). La v1 las agrupa por fecha, tipo y lugar.
- Catálogo de tipos editable por la directora.
- Cambiar el traspaso de la 0820: va en F6, con A16.
- Arrastrar citas, recordatorios, avisos push y sincronizar con Google Calendar.
- Las cuentas de clase "distribuidor" (A14).

## Para decidir

| # | Pregunta | Recomendación de Claude |
|---|---|---|
| A1 | ¿La directora también agenda y reporta sus actividades, con todas las líneas, y aparece en `/equipo`? | Sí. Solo la ven ella y el admin. |
| A2 | ¿Una líder ve a las otras líderes en `/equipo`? ¿Ve el día completo de Paola, incluido Trauma? | No ve a las otras líderes. Sí ve todo el día de Paola ("dónde está" no depende de la línea), pero su tablero cuenta solo lo marcado con su línea. |
| A3 | ¿Hasta cuántos días adelante se planea? Hoy son 30. | 90 días para todo. En el Excel, 6 de 24 filas futuras van a 34–41 días, y el dueño habló de "en cinco semanas". |
| A4 | ¿Las visitas de las líderes (sin Ejecutivo Comercial) entran al mapa de calor y a "IPS sin visitar"? ¿Se añade 2026 al selector de año? | No por ahora. Añadir 2026 sí, porque hoy las visitas de la app no se ven en el mapa. Toca el mapa: pide su visto bueno. |
| A5 | ¿Días libres, vacaciones y configuración propia (radio, telefónica) para las líderes? | No en la v1: usan la configuración general y sin telefónica. Si se quiere, una migración posterior añade `user_id` a `dias_libres` y `config_personas`. Las 2 "VACACIONES" del Excel quedan en el informe. |
| A6 | Paola: ¿a su cuota suma solo lo de su línea de Ejecutivo Comercial (Sustitutos óseos)? | Sí. Lo que hace como líder (Trauma) no suma ni pasa por los visitantes. |
| A7 | ¿La cena exige al menos un asistente? | Se pide sin bloquear. Hay una salida "No sé los nombres" + cuenta o grupo: en el Excel, 5 de 10 cenas nombran un grupo. |
| A8 | ¿Se registra el valor de cada cena? ¿De dónde saldrán las órdenes o prescripciones por médico? | Sin valor en la v1. Las órdenes, en una fase aparte cuando haya fuente (¿Odoo?). |
| A9 | ¿El motivo de cancelación es obligatorio también en las citas? Hoy es opcional (decisión 46 de la F4). | Sí, con una lista corta + texto opcional, para citas y actividades. A la directora le importa el porqué. |
| A10 | Correría y congreso van con "todo el día" y sin hora: ¿excepción a "la cita lleva hora"? | Sí, solo en correría y congreso, y en la capacitación de día completo. |
| A11 | ¿Desde cuántos días una actividad cuenta como "planeada con tiempo"? | 7 días ("la semana próxima"). |
| A12 | ¿Cambia el nombre de la app "VG Visitas"? | Sí, a "VG Campo": corto y cubre todo lo que hacen. |
| A13 | ¿Se aceptan reportes tardíos de actividades que no son visita? | Sí, hasta 7 días con la marca "tarde", visible para la directora. Las visitas siguen siendo del mismo día. |
| A14 | ¿Distribuidores y aliados son cuentas nuevas? ¿Se cargan los subtipos "Seguimiento comercial" y "Cartera y facturación"? | Distribuidores: no en la v1; quedan como texto o "Otro" (7 de ellos están solo en `proveedores`). Subtipos: sí, en modo seguimiento desde `/configuracion`. |
| A15 | ¿Se reprograma una cita atrasada (pendiente de días pasados)? | Sí, hasta 7 días atrás. Así se cierra lo "sin cerrar" sin borrar el historial. |
| A16 | Al dar de baja a alguien, ¿qué pasa con sus citas y actividades planificadas? | Se cancelan con motivo `baja` dentro del traspaso (F6, con migración). Mientras tanto las cancela el admin. |
| A17 | ¿Se importa el histórico del Excel, y desde qué fecha la directora deja de usarlo? | Sí, con F3. El corte, el día en que F2 llegue a todas las líderes. |

## Verificación final

- En `web/`: `npm run check`, que corre typecheck, lint y las pruebas sin red. Suman las nuevas `persona-campo-check`,
  `actividades-check`, `tracker-lideres-check`, `equipo-check` y `equipo-api-check`, y las ajustadas `reporte-check`,
  `reporte-api-check`, `simulacion-check` y `menu-check`.
- En `mobile/`: `npm run check`, con las secciones 20 y 21.
- Migraciones: la 0850 y la 0860 con su DO en verde y sus rollbacks 9946 y 9945, en ese orden, ensayados en una base
  de prueba. En producción, solo con autorización del dueño.
- Importación: `importar-tracker-lideres.ts --plan` con las cifras esperadas.
- Capturas:
  - App a 390×844: Hoy de una líder, "¿Qué hiciste?", la cena con asistentes, Agendar una correría, Mi agenda con la
    banda y Reprogramar.
  - Web `/equipo` en escritorio y a 390 px.
- Prueba del dueño en su iPhone con una líder real: agenda una correría a 2 semanas y una cena con médicos, y la
  directora la ve en Hoy y en Próximas semanas con "planeada hace N días".
