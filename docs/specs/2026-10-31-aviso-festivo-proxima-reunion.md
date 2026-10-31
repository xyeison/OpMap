# Spec: la próxima reunión avisa si cae en festivo o en domingo  (2026-10-31)

**Estado**: pedido del dueño (2026-10-31, con el "arranca" del menú). Lo que el dueño no dijo va en "Decisiones" como
propuesta: lo confirma al revisar el PR.

## Problema

El dueño, probando el reporte con IA: "¿qué pasa si yo le digo a él, la próxima reunión es el próximo lunes a las dos de
la tarde? Mira que si el lunes es festivo, él debería advertir eso". Hoy es sábado 31 de octubre de 2026: el próximo
lunes es el 2 de noviembre, Todos los Santos, que la Ley Emiliani pasa al lunes.

- La app pone la fecha sin decir nada. No conoce los festivos: solo el servidor los tiene (tabla `calendario`, para la
  cuota).
- En el dictado completo, la IA recibe la fecha de hoy sin el día de la semana; el dictado por campo sí lo lleva. Para
  entender "el próximo lunes", el modelo tiene que deducir solo qué día es el 31 de octubre.
- La agenda deja agendar en festivo a propósito ("la persona sabe si trabaja", 0840). Eso no cambia: se avisa, no se
  bloquea.

## Resultado esperado

1. Si la próxima reunión cae en un festivo de Colombia o en domingo, la app lo dice junto a la fecha, en color de
   alerta:
   - "Es festivo (Todos los Santos): revisa la fecha."
   - "Es domingo: revisa la fecha."

   El aviso va en la tarjeta en resumen, debajo de "Próxima reunión". Con la fila abierta, o con la tarjeta completa
   (Reportar y Corregir visita), va debajo de la fecha elegida. Avisa igual si la fecha la puso la IA (dictado completo
   o por campo), un atajo ("Mañana", "En 15 días"…) o el calendario. Nada se bloquea: la visita se confirma igual.
2. La IA del dictado completo recibe el día de la semana de hoy, como el dictado por campo, para resolver "el próximo
   lunes".

## Decisiones (propuesta)

- **El sábado no avisa.** En la configuración el sábado no es hábil (`dias_habiles_semana` = 0), pero hay reuniones con
  médicos el sábado y el aviso sería ruido. El domingo sí avisa.
- **Los festivos se calculan en la app**, por la Ley 51 de 1983: los mismos 18 por año y con los mismos nombres que
  `festivosColombia` (web/lib/visits-rules.ts) y que la tabla `calendario`. Así avisa también sin señal y con cualquier
  fecha. Hoy la tabla de producción solo tiene festivos nacionales: 18 de 2026 y 18 de 2027, iguales a los calculados.
  Si algún día se cargan días de empresa o de ciudad, la app no los verá; eso iría con el calendario único.
- **Un solo aviso por vista.** En resumen va en la fila; con la fila abierta o la tarjeta completa, bajo el campo. No se
  repite en "Agendar esa reunión" ni en el pie.
- **La tarjeta de voz no se abre completa por esto.** No es un error ni una duda de la IA, y el aviso queda a la vista en
  la fila.

## Criterios de aceptación (se convierten en pruebas)

- [ ] `festivosColombia(2026)` y `festivosColombia(2027)` de la app dan las 36 filas nacionales de producción (fecha y
      nombre).
- [ ] `avisoDiaNoLaborable(fecha)`:
      - 2026-11-02 → "Es festivo (Todos los Santos): revisa la fecha."
      - 2026-11-01, domingo → "Es domingo: revisa la fecha."
      - Festivo en domingo (2022-05-01) → el del festivo.
      - Martes 2026-11-03 → null.
      - Sábado 2026-11-07 → null.
      - Fecha vacía o no válida → null.
- [ ] `filasResumen`: la fila "Próxima reunión" con 2026-11-02 lleva ese aviso; con un día hábil no lleva ninguno.
- [ ] La tarjeta pinta el aviso de la fila debajo del valor, en color de alerta, y lo incluye en la etiqueta accesible.
- [ ] `CamposVisita` pinta el aviso bajo la fecha elegida. Si el campo tiene un error, se ve el error y no el aviso.
- [ ] Web: `contextoDictado(...)` trae `dia` (el nombre del día de hoy) y la regla 7 de `PROMPT_PROPUESTA` lo nombra.
- [ ] Revisor (2026-10-31):
      - La regla de `next_step_date` de `PROMPT_PROPUESTA` y de `PROMPT_CAMPOS` dice lo mismo: "el lunes" o "el próximo
        lunes" es el primer lunes después de hoy. Así, por micrófono de campo o dictado completo, la misma frase da la
        misma fecha.
      - Un festivo en sábado (2027-05-01) avisa como festivo.
      - Una fecha que `esFechaIso` acepta, con año de 3 cifras, no rompe la tarjeta.
      - La app calcula los mismos festivos que la web de 1900 a 2200 (`web/scripts/visits-check.ts`).

## Fuera de alcance

- Marcar los festivos en el calendario (`CalendarioMes`) de Agendar y Mi agenda, y avisar al agendar una cita a mano: eso
  va con el calendario único.
- Guardar la hora dicha de la próxima reunión ("a las dos de la tarde"). La visita guarda solo la fecha
  (`next_step_date`) y "Agendar esa reunión" pide la hora. Es una mejora aparte, si el dueño la quiere.
- Los días de empresa o de ciudad y los días libres de la persona.

## Impacto

- Datos / migración: no.
- Costo Google Maps: 0.
- Claude: cambia una línea del prompt del dictado completo y el contexto suma el día (unos 3 tokens). El costo no cambia
  (0,005 USD por dictado).
- Estética del mapa: no cambia (es la app de campo).
- Permisos / roles: no.

## Plan (archivos e interfaces)

- `mobile/lib/festivos.ts` (nuevo, puro): `pascua(anio)`, `alLunesSiguiente(fecha)`, `festivosColombia(anio)`,
  `festivoDe(fecha): string | null` y `avisoDiaNoLaborable(fecha): string | null`.
- `mobile/lib/tarjeta-resumen.ts`: `FilaResumen.aviso?`; la fila `proxima` lo lleva.
- `mobile/components/reporte/TarjetaBorrador.tsx` (`FilaDelResumen`) y `CamposVisita.tsx`: pintan el aviso.
- `web/lib/reporte-visitas.ts`: `ContextoDictado.dia`, la regla 7 de `PROMPT_PROPUESTA` y la regla 3 de `PROMPT_CAMPOS`.
- Pruebas:
  - `mobile/scripts/checks/17-agenda.ts`: festivos.
  - `mobile/scripts/checks/16-reportar.ts`: la fila y las pruebas estáticas de los dos componentes.
  - `web/scripts/reporte-check.ts`: el día en el contexto y la regla de los dos prompts.
  - `web/scripts/visits-check.ts`: app = web de 1900 a 2200.

## Verificación final

- `npm run check` en `web/` y en `mobile/`.
- Capturas de la app de campo en el navegador, con el servidor falso y datos de prueba: la próxima reunión el lunes 2
  de noviembre con su aviso, en la tarjeta (campo) y en el resumen si se puede armar; y un domingo.
