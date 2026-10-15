# 2026-10-15 – La cita de la agenda lleva hora siempre, y la agenda es un calendario

**Contexto**: al probar Agendar en su iPhone, el dueño escribió: "Esto tiene que ser como un calendario también. La
parte de la hora de la visita tiene que ser con hora. Y nada más estás colocando una fecha". Ese día, la hora era un
campo de texto opcional al final del formulario, con el chip "Sin hora" marcado de entrada. La fecha se movía un día
por toque, y Mi agenda solo mostraba de hoy a hoy + 7, aunque se agenda hasta hoy + 30.

**Decisión del dueño (2026-10-15)**:
1. **La cita lleva hora.** Cambia la decisión 1 del 2026-10-14 ("por día con hora opcional"):
   - La hora es obligatoria en toda cita nueva, en la API (zod) y en la app.
   - La base sigue aceptando NULL y las citas viejas sin hora siguen válidas. Al decidirlo había 2 de 20, las dos de la
     simulación.
2. **La agenda es un calendario**, en Agendar y en Mi agenda.
   - Reemplaza lo que la spec del 2026-10-14 dejaba fuera: "medias horas, arrastrar en un calendario".
   - Arrastrar citas sigue fuera.

**Consecuencias**:
- `POST /api/me/agenda` exige `hora` en HH:MM.
  - Sin hora, con `''` o con `null` responde 400 "Elige la hora de la cita", con el error en `hora`, sin ir a la base.
  - `CitaCreateBase.hora` pasa a `string` en el servidor.
  - `GET /api/me/agenda` y `contexto.agenda_hoy` siguen pudiendo traer `hora: null`, por las citas viejas.
- No hay migración.
  - `visitas_agenda.hora` sigue siendo `time NULL`.
  - Un `NOT NULL` rompería las citas viejas sin hora y las pruebas del bloque DO de la 0840.
  - El comentario de la columna ("opcional…") quedó desactualizado: se corrige en la próxima migración que haya (nota en
    `docs/base-de-datos.md`).
- Agendar va en este orden:
  1. "¿Cuándo?", con el mes en cuadrícula. Empieza en lunes, hoy va marcado, los días fuera de hoy..hoy + 30 y el día
     libre que impide agendar van apagados, y cada día muestra su cantidad de citas.
  2. "¿A qué hora?", con las medias horas de 07:00 a 18:30 en Mañana y Tarde y "Otra hora", cada 15 minutos de 05:00 a
     21:45. Debajo, "Ese día ya tienes: …".
  3. "¿Con quién?".
  4. La nota.
  5. Al pie, fijo, el botón "Agendar · jueves 16 oct · 10:00".

  Abre con una hora ya elegida: la franja que se tocó en Mi agenda o la primera libre desde las 08:00. Si es para hoy,
  avisa que la visita contará como no agendada.
- Mi agenda va en este orden:
  1. Arriba, la semana (o el mes, con "Ver mes"), con la cantidad de citas por día y los días libres. Se puede ir a
     cualquier mes, y se pide un mes por consulta.
  2. Debajo, el día como línea de tiempo por medias horas, con la línea "Ahora".
     - Tocar una franja libre abre Agendar a esa hora.
     - Tocar una cita abre su detalle ahí mismo: nota, sede, "Ver la visita" y "Cancelar esta cita".
     - Las citas viejas sin hora van al final, en "Sin hora", y las canceladas en "Ver canceladas (n)".

  Toda cita de hoy a hoy + 30 se ve y se puede cancelar.
- Decisiones de Claude que el dueño puede cambiar (spec 2026-10-15, decisiones 3 a 5):
  - Franjas de 30 minutos.
  - Cada cita se dibuja como un bloque de 30 minutos, sin columna de duración.
  - Dos citas a la misma hora solo se avisan, sin bloquear ("A las 09:30 ya tienes cita con …. Puedes agendar igual.").
    Bloquear exigiría una regla nueva en `agenda_crear` (pendiente D4 de la spec).
- Orden del despliegue: la app nueva siempre manda la hora, así que funciona con la API vieja. Si la API sale primero,
  la app vieja que agenda "Sin hora" recibe el 400 "Elige la hora de la cita", que ya se muestra en "No se agendó".
- Detalle y criterios en `docs/specs/2026-10-15-usabilidad-y-agenda-con-hora.md` (paquete 3).

**Dónde vive en el código**:
- Servidor:
  - `MENSAJE_HORA_OBLIGATORIA` y `CitaCreateBase.hora: string` en `web/lib/reporte-visitas.ts`.
  - `horaObligatoria` en `citaCreateSchema` (`web/lib/reporte-visitas-schemas.ts`).
- App, funciones puras:
  - `mobile/lib/agenda.ts`: franjas, `siguienteFranjaLibre`, `validarCitaConHora`, `cuerpoCitaConHora`, `avisoChoque`,
    `textoBotonAgendar` y `marcasDelMes`.
  - `mobile/lib/calendario.ts`: `cuadriculaMes`, `rangoDeMes` y la semana.
- App, pantallas: `mobile/app/(app)/agenda/nueva.tsx` y `mobile/app/(app)/agenda.tsx`.
- App, componentes en `mobile/components/agenda/`: `CalendarioMes`, `SelectorHora`, `LineaDelDia` y `DetalleCita`.
- Pruebas:
  - Sección 10e de `web/scripts/reporte-check.ts`.
  - Sección 14 de `web/scripts/reporte-api-check.ts`: sin hora da 400 y no guarda nada, y las viejas se leen con
    `hora: null`.
  - `web/scripts/simulacion-check.ts`: todas las citas simuladas llevan hora.
  - Sección 17 de `mobile/scripts/movil-check.ts` (`mobile/scripts/checks/17-agenda.ts`).
