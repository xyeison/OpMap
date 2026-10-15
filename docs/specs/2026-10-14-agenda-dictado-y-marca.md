# Spec: agenda de visitas, dictado de la conclusión, marca VG Medical y datos simulados  (2026-10-14)

**Estado**: aprobada por el dueño (pedido del 2026-10-14; las decisiones marcadas "Claude" las puede cambiar el dueño)

## Problema

El dueño probó la app con el usuario de Carmen Barrios y pidió, con sus palabras:

1. "Él debería preguntarme en qué clínica… me está dejando grabar sin elegir… La lógica es que yo estoy dentro de la
   Clínica Porto Azul, ya tengo un agendamiento y tengo que elegir el médico con el cual hablé, que en teoría debería
   estar en la agenda. Si no está en la agenda, puede ser una visita extra… Visitas agendadas, visitas no agendadas,
   y eso es un indicador." (Hasta hoy la spec de la app dejaba la agenda fuera: ver la decisión
   `docs/decisiones/2026-10-14-agenda-de-visitas.md`.)
2. En el reporte por toques: "si lo dejo seleccionado me habilita el micrófono. Yo hablo y él escribe ahí la
   conclusión, y si menciono compromisos, enseguida me los coloca en el recuadro de compromisos."
3. "Esto debería ser brandeado con VG Medical."
4. "Simúlate cierta información para poder hacer las pruebas": una agenda de Carmen en la Clínica Portoazul y en la
   Clínica Reina Catalina, con distintos médicos.

## Resultado esperado

- Cada Ejecutivo Comercial tiene una **agenda** sencilla: citas por día (hora opcional) con un médico en una sede, o
  con una cuenta y un subtipo institucional en una sede. Las crea en la app ("Agendar"), hasta 30 días adelante, y las
  puede cancelar. No hay medias horas, ruteros, arrastrar ni aprobaciones.
- **Reportar empieza por el sitio**: primero "¿Dónde estás?". Arriba, las citas pendientes de hoy, la más cercana
  primero, con su distancia y si está dentro del radio. Debajo, "Visita no agendada", que lleva a elegir la sede
  cercana como hoy. Grabar o llenar por toques solo se habilita después de elegir una cita o una sede.
- Al elegir una cita, la visita ya trae el tipo, el médico o la cuenta y el subtipo, y la sede. La persona solo dicta
  o toca lo que pasó.
- Una visita queda **agendada** si se vincula a una cita creada antes del día de la visita. Si la persona no eligió
  la cita pero había una pendiente ese día con el mismo médico, o con la misma cuenta, se vincula sola.
- **Indicador** en Mis números, por mes: porcentaje de visitas efectivas agendadas y cumplimiento de la agenda
  (citas con visita frente a citas del periodo que ya pasaron).
- **Dictar en un campo**: en el reporte por toques, y en la tarjeta de la visita, un botón de micrófono junto a
  "Conclusión". Se habla, se transcribe y el servidor reparte lo dicho entre conclusión, compromisos y próxima
  reunión si se menciona una fecha. Todo queda editable antes de confirmar.
- **Marca VG Medical** en la app: nombre visible "VG Visitas", logo de VG Medical en el ingreso y en el encabezado,
  paleta monocromática de la marca y letra DM Sans. Ícono, ícono adaptable de Android y pantalla de inicio con el
  símbolo "vg".
- **Datos simulados** para Carmen, marcados como prueba y con un script que los crea y los quita.

## Decisiones (Claude, el dueño puede cambiarlas)

1. **Qué es una cita**: `visitas_agenda`, una fila por cita. Lleva Ejecutivo Comercial, fecha, hora opcional y tipo:
   médica con médico, o institucional con cuenta y subtipo. Lleva también sede, nota de hasta 300 caracteres y estado
   `pendiente`, `hecha` o `cancelada`. La cita hecha guarda `visita_id`. No se borra: se cancela.
2. **Quién agenda**: la propia persona, en la app (permiso `visits:report`). La dirección y el líder la verán en F5.
3. **Ventana**: de hoy a 30 días adelante, en hora de Bogotá, igual que VMO. No se agenda en el pasado ni en un día
   libre aprobado. Los festivos sí se permiten, porque la persona sabe si trabaja.
4. **Sin duplicados**: una cita no cancelada por persona, fecha y médico. En las institucionales, una por persona,
   fecha, cuenta y subtipo.
5. **Validaciones al agendar**: persona activa con zona; perfil vigente en la fecha que incluya el tipo; médico activo
   que atiende en esa sede, o sede de esa cuenta; cuenta activa; subtipo vigente en la fecha; sede activa.
6. **Agendada**: la visita se vincula a una cita de la misma persona, de la misma fecha y del mismo médico o cuenta, y
   la cita se creó antes del día de la visita en hora de Bogotá. Una cita creada el mismo día sirve para organizarse y
   para vincular, pero la visita cuenta como no agendada. Así el indicador mide lo planeado con anticipación.
7. **Vínculo**: `visitas_registrar` acepta `agenda_id` opcional y lo valida. Si no viene, busca una cita pendiente de
   ese día con el mismo médico; en las institucionales, con la misma cuenta, prefiriendo el mismo subtipo. Si la
   encuentra, la vincula. La cita pasa a `hecha`. Si la visita se anula, la cita vuelve a `pendiente`. La visita no
   efectiva también cumple la cita, porque la persona fue, pero no suma al indicador de efectivas.
   *Ajuste tras la verificación (Claude, 2026-10-14)*: si después de la no efectiva llega, ese mismo día, la efectiva
   con el mismo médico o cuenta, la efectiva toma la cita (relevo) y cuenta como agendada si la cita se creó antes; la
   no efectiva queda sin cita. Al anular la visita que cumplía una cita, la cita pasa a otra visita suya de ese día con
   el mismo médico o cuenta y sin cita (la efectiva primero) y, si no hay, vuelve a `pendiente`. Detalle en el
   contrato, decisiones 53 y 54.
8. **Indicador de Mis números**, por mes:
   - `porcentaje_agendadas` = efectivas agendadas ÷ efectivas del mes.
   - `cumplimiento` = citas hechas ÷ citas de días ya pasados o de hoy, sin las canceladas.
   - Se muestran también las cantidades.
9. **Dictado por campo**: `POST /api/me/voz/campos` con `{ transcript, tipo }`. Usa el mismo proveedor que proponer
   (Claude, salida forzada por herramienta) y devuelve `{ conclusion, compromisos, next_step_date }`. Comparte los
   límites de proponer; sin llave responde 503. Nunca escribe el texto en los registros.
10. **Marca**: tomada del sitio vgmedical.com.co y del diseño "Carpeta Portafolio VG Medical" del dueño.

    | Uso | Color |
    |---|---|
    | Botón principal y encabezado | negro `#000000` |
    | Texto | carbón `#2E2D2D` |
    | Texto secundario | gris `#5C5B5B` |
    | Fondo | `#F8F9FA` |
    | Tarjetas | blanco |

    Los colores de estado, como éxito, alerta y peligro, se quedan con contraste suficiente: el negro no los
    reemplaza. Letra DM Sans con `@expo-google-fonts/dm-sans` y `expo-font`, que funcionan en Expo Go. Los vectores del
    logo están en `scratchpad/marca-vg/`: `vgmedical-logotipo-{blanco,negro}.svg` y `vg-simbolo-{blanco,negro}.svg`.
    Se copian a `mobile/assets/marca/` y los PNG se generan de esos SVG. La web de OpMap no cambia en este PR.
11. **Datos simulados**: script `web/scripts/simulacion-carmen.ts`. Sin opciones solo muestra el plan; con
    `--aplicar` lo crea y con `--borrar` lo quita. Todo lo que crea queda marcado:
    - **Médicos:** documento `PRUEBA-0840-NN`, tipo `otro`, nombre que termina en " (prueba)".
    - **Notas de las citas:** "Simulación".
    - **Contactos:** cargo "(prueba)".

    Lo que crea:
    - **Médicos y visitas:** de 4 a 5 médicos en la Clínica Portoazul (Puerto Colombia) y de 4 a 5 en la Clínica
      Reina Catalina de Barranquilla, uno de ellos también en la sede de Baranoa. Usan las especialidades válidas de
      `medicos`. Carmen queda como visitante de cada uno en sus líneas, PerOssal y Reemplazo articular.
    - **Contactos:** un jefe de compras en cada clínica, para las visitas institucionales.
    - **Agenda:** citas de hoy y de los próximos 5 días hábiles. Hoy quedan 3 en Portoazul, 2 en Reina Catalina y
      una institucional de compras. Las de hoy se crean con fecha de creación de ayer, para que cuenten como
      agendadas.
    - **Configuración de prueba de Carmen:** hasta el 2026-10-21. Perfil médica e institucional, radio de 5.000 m, el
      máximo permitido, y telefónica habilitada con tope 3, para probar lejos de la clínica. Se registra con
      `config_registrar` y `--borrar` la cierra.
    - **Al borrar:** cancela las citas, termina los visitantes, desactiva los médicos y anula las visitas de la app
      que Carmen haya hecho a esos médicos, con el motivo "Prueba de la app". No se borran filas que el modelo no deja
      borrar. Nunca anula una visita que no sea de prueba: si una visita real se vinculó sola a una cita simulada (las
      institucionales simuladas son con cuentas reales), esa visita y su cita se dejan como están y se muestran.

## Criterios de aceptación (se convierten en pruebas)

- [ ] Agendar: una cita médica válida da 201. Una del pasado, a más de 30 días, en un día libre aprobado, con un
      médico que no atiende en la sede, con una cuenta ajena a la sede o con un subtipo vencido da 400 o 409 con
      mensaje claro y no guarda nada. Una repetida da 409.
- [ ] Cancelar: la propia cita pendiente, de hoy o futura, sí se cancela. La ajena, la hecha o la de ayer no.
- [ ] Reportar con `agenda_id`: la visita queda vinculada, la cita pasa a `hecha` y `agendada` es verdadero si la cita
      se creó antes del día de la visita. Una cita ajena, de otro día, de otro médico o cancelada se rechaza con
      23514.
- [ ] Reportar sin `agenda_id` con una cita pendiente de ese médico ese día: se vincula sola. Si no hay cita, la
      visita queda no agendada.
- [ ] Anular una visita vinculada devuelve la cita a `pendiente`.
- [ ] `GET /api/me/contexto` trae `agenda_hoy` con distancia a la sede cuando hay punto. `GET /api/me/numeros` trae
      `agenda` con las cuentas de la decisión 8.
- [ ] `POST /api/me/voz/campos` reparte un dictado con compromisos en los dos campos. Sin llave da 503, con texto
      vacío da 400, y no deja el texto en los registros.
- [ ] App: Reportar no deja grabar ni llenar por toques sin elegir una cita o una sede. Al elegir una cita, el
      borrador sale con el médico o la cuenta, la sede y el `agenda_id`. Las citas se ordenan por distancia.
- [ ] App: el micrófono de Conclusión llena conclusión y compromisos sin borrar lo ya escrito: añade.
- [ ] App: Hoy muestra la agenda del día y "Agendar". Mis números muestra el bloque Agenda.
- [ ] Marca: los textos visibles dicen "VG Visitas" o muestran el logo. No quedan "OpMap Visitas", "KAM",
      "representante" ni "panel" en la app.
- [ ] Las 7.033 visitas de VMO siguen intactas tras la migración 0840, comprobado con conteo y huella.

## Fuera de alcance

Agenda de la dirección o del líder (F5), ruteros, medias horas, arrastrar en un calendario, recordatorios y
notificaciones push, sincronizar con Google Calendar u Odoo, la marca de la web de OpMap, publicar en tiendas.

## Impacto

- **Datos y migración:** `database/migrations/2026-10-14_0840_visitas_agenda.sql`, con su rollback
  `2026-10-14_9944_visitas_agenda_rollback.sql`.
  - Crea `visitas_agenda` con RLS sin políticas y solo `service_role`.
  - Añade a `visits` las columnas `agenda_id` (UNIQUE parcial) y `agendada boolean NOT NULL DEFAULT false`.
  - Crea las funciones `agenda_crear` y `agenda_cancelar`.
  - Reemplaza `visitas_registrar` y `visitas_anular`. Copia exacta de la 0830 más el vínculo con la agenda.
  - El rollback devuelve las funciones de la 0830 tal cual.
  - Termina con un bloque DO de pruebas que se deshacen solas, como la 0830.
- **Costo Google Maps:** 0.
- **Estética del mapa:** no cambia.
- **Permisos:** `visits:report` para la agenda propia. No hay permiso nuevo.

## Plan (archivos e interfaces)

- **Servidor:**
  - `web/lib/reporte-visitas.ts` y `-schemas.ts`: tipos y reglas puras, como agendada, el vínculo automático y las
    cuentas del indicador.
  - `web/app/api/me/agenda/route.ts`: GET y POST.
  - `web/app/api/me/agenda/[id]/cancelar/route.ts`.
  - `web/app/api/me/voz/campos/route.ts`.
  - Cambios en `contexto`, `visitas` y `numeros`, y en `_lib/reporte-server.ts`.
  - Pruebas en `web/scripts/reporte-check.ts` y `reporte-api-check.ts`.
- **App:**
  - `mobile/lib/tipos.ts`, `claves-api.ts`, `api.ts` y `propuesta.ts`.
  - Pantallas: `mobile/app/(app)/hoy.tsx`, `reportar.tsx`, `agenda.tsx` y `agenda/nueva.tsx`, más `numeros.tsx`.
  - Componentes: `components/reporte/CamposVisita.tsx`, `ListaCitas.tsx` y `DictarCampo.tsx`.
  - Marca: `lib/ui.tsx` con la paleta y la letra, `components/Logo.tsx`, `app.json` y `assets/`.
  - Pruebas en `mobile/scripts/movil-check.ts`.
- **Simulación:** `web/scripts/simulacion-carmen.ts`.
- **Documentación:** el contrato `docs/fases/fase8-visitas-f3-f4-reporte-y-app-movil.md`, en una sección nueva
  "F4.1 Agenda, dictado por campo y marca"; `docs/base-de-datos.md`; `database/migrations/README.md`; `CLAUDE.md`, en
  la línea de fase 8.

## Verificación final

`npm run check` en `web/` y en `mobile/`. Ensayo de la 0840 en la base real terminando en `DRYRUN_OK`. `next build` y
`expo export --platform web`. Capturas de Hoy, Reportar y la marca a 390 px con React Native Web. Tras aplicar la
migración: `simulacion-carmen.ts --aplicar`, comprobando con consultas de solo lectura lo creado.
