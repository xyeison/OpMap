# Spec: usabilidad de la app de visita y agenda con hora  (2026-10-15)

**Estado**: borrador. La hora obligatoria en la cita y la agenda como calendario son pedido del dueño del 2026-10-15.
Lo demás lo propone Claude y el dueño puede cambiarlo. Lo que necesita decisión del dueño está en "Para decidir" y
no entra en este cambio.

Fuentes: estudio de usabilidad, de tiempos y de agenda del 2026-10-15 (solo lectura). Las 26 capturas del estado
actual están en `scratchpad/usabilidad/antes/`, en
`/private/tmp/claude-501/-Users-yjxm-Documents-GitHub-OpMap/b96592bc-25ae-4af0-afb9-263556da1e56/scratchpad/usabilidad/`.
Contrato: `docs/fases/fase8-visitas-f3-f4-reporte-y-app-movil.md` (F4.1). Specs anteriores:
`2026-10-14-agenda-dictado-y-marca.md` y `2026-10-14-ubicacion-rapida-en-reportar.md`.

## Problema

Después de reportar bien una visita por voz en su iPhone, con Expo Go, el dueño pidió:

1. "Quiero que mejores mucho más la usabilidad, que no se demore demasiado el proceso… tampoco es que le vayas a
   quitar calidad, pero mejóralo."
2. "Mira que en la parte de abajo no se ven bien las opciones."
3. "Esto [Agendar] tiene que ser como un calendario también. La parte de la hora de la visita tiene que ser con hora.
   Y nada más estás colocando una fecha."

Lo que se midió:

- **Barra de pestañas.** `mobile/app/(app)/_layout.tsx` fija `height: 60`. La librería deja de sumar el margen
  inferior del iPhone (34 pt) a la altura, pero lo sigue restando como relleno. Quedan 26 pt de alto y 16 pt para
  una etiqueta con `lineHeight` 24, así que las letras salen cortadas por abajo. No hay íconos. A 13 pt, "Días libres"
  mide 65,9 pt y "Números" 57,7 pt, pero cada pestaña tiene unos 52 pt de texto, así que se truncan. La pestaña activa
  casi no se distingue: su fondo contra el blanco da 1,15:1.
- **Agendar.** La hora es un campo de texto opcional ("En formato de 24 horas: 07:30"), con el chip "Sin hora"
  marcado de entrada. Está al final de un formulario de 2.207 px, debajo de una lista de médicos que se abre sola. La
  fecha se mueve un día por toque.
- **Mi agenda.** Solo pide de hoy a hoy + 7, pero se puede agendar hasta hoy + 30. Una cita a 8–30 días no aparece en
  ninguna parte de la app: no se ve ni se cancela.
- **Tarjeta de la visita.** De la propuesta al guardado pasaron 77 s (05:16:37 → 05:17:54). Casi todo es la persona
  revisando un formulario abierto de unos 1.200 pt, con "Confirmar" al final (974 px de desplazamiento por toques).
  En todo el dictado, lo que tarda la máquina son 5–8 s; Claude, unos 3 s.
- **Cargas repetidas.** Hoy y Reportar piden ubicación, `POST /api/me/contexto` y `GET /api/me/visitas` cada vez
  que reciben el foco: son los pares de 05:18:02, 05:18:12 y 05:19:07. Agendar y Visita piden el contexto completo
  solo para leer médicos, perfil y líneas. Con poca señal, al abrir la app se espera `/api/auth/me` hasta 20 s.
- **Teclado.** El teclado tapa los campos en todas las pantallas menos el ingreso.

## Resultado esperado

- **Barra de abajo.** La barra tiene la altura que da la librería: 49 pt más el margen inferior del iPhone.
  - Cada pestaña lleva ícono y nombre debajo, entero y sin cortar: **Hoy · Reportar · Agenda · Números · Ajustes**.
    La pestaña activa se marca con el ícono relleno y el texto negro.
  - "Días libres" deja la barra y se abre desde Agenda y desde Ajustes. Es un cambio visible: se le muestra al dueño
    con capturas de antes y después, y se revierte en una línea.
- **Agendar es un calendario con hora.** Primero va "¿Cuándo?", con un mes en cuadrícula: lunes primero, celdas de
  44 pt, hoy marcado, los días fuera de hoy..hoy + 30 apagados, un punto en los días con citas y los días libres
  aprobados marcados.
  - Justo debajo, "¿A qué hora?": chips cada 30 minutos de 07:00 a 18:30, en dos grupos (Mañana y Tarde), y "Otra
    hora" con hora de 05 a 21 y minutos 00/15/30/45. Debajo, "Ese día ya tienes: 08:00 Dra. X · 10:30 Clínica Y".
  - Después van "¿Con quién?", con el selector cerrado y la búsqueda a la vista, y "Nota (opcional)".
  - Al pie, fijo, el botón con el resumen: "Agendar · jueves 16 oct · 10:00".
  - **La cita lleva hora siempre**: no hay "Sin hora". Agendar abre con una hora ya elegida a la vista: la franja que
    se tocó en el calendario o la siguiente libre desde las 08:00.
  - Una hora ya ocupada se avisa ("A las 09:30 ya tienes cita con …. Puedes agendar igual."), pero no se bloquea.
  - Si la fecha es hoy, se avisa que la visita contará como no agendada.
- **Mi agenda es un calendario.** Arriba va el mes o la semana, con la cantidad de citas por día y los días libres;
  se puede ir a cualquier mes.
  - Debajo, el día elegido como línea de tiempo por medias horas. Al tocar una franja libre de un día futuro se abre
    Agendar a esa hora. Al tocar una cita se abre su detalle, ahí mismo: nota, sede, "Ver la visita", "Cancelar esta
    cita".
  - Las citas viejas sin hora van al final del día, en "Sin hora". Las canceladas, en "Ver canceladas (n)".
  - Toda cita de hoy a hoy + 30 se ve y se puede cancelar.
- **Reportar es más corto, con la misma calidad.**
  - La tarjeta de voz que ya está bien sale en **resumen**: con quién, sede y si está dentro del radio, resultado,
    líneas, conclusión en 3 líneas, compromisos y próxima reunión. Cada fila se toca para corregir solo ese campo.
  - Lo dudoso se abre arriba: preguntas de la IA, confianza < 0,6, errores, fuera del radio o médico no encontrado.
  - "Confirmar visita 1 de N" queda fijo al pie, visible sin desplazar, también en la tarjeta por toques.
  - Cada tarjeta se sigue confirmando con su propio toque y con las mismas validaciones.
  - Mientras Claude arma las visitas ya se ve "Lo que dijiste".
- **Desde Hoy, tocar una cita pendiente abre Reportar con esa cita elegida.** La ubicación y el radio se deciden
  como siempre. El flujo por voz con cita queda en 4 toques: cita, Hablar, Listo y Confirmar.
- **Menos esperas.**
  - Hoy y Reportar se pintan al instante con el último contexto si es reciente y del mismo sitio. No piden de nuevo
    antes de 60 s; entre 60 s y 3 min, pintan y refrescan sin tapar la pantalla.
  - Agendar y Visita no piden el contexto completo si hay uno de menos de 10 minutos.
  - La app abre con el perfil guardado y confirma la sesión en segundo plano.
  - El teclado nunca tapa el campo que se escribe, y deslizar lo cierra.
- **Medición.** Cada ruta de `/api/me/*` responde la cabecera `Server-Timing` y deja una línea `[tiempos]`, sin
  contenido, que se lee con `vercel logs`. En desarrollo, la app escribe sus marcas en la terminal de Metro. Así la
  tanda 2 se decide con cifras.

## Decisiones

**Del dueño (2026-10-15)**, a anotar en `docs/decisiones/2026-10-15-agenda-con-hora-y-calendario.md`:

1. **La cita lleva hora.** Cambia la decisión 1 del 2026-10-14 ("por día con hora opcional"). Es obligatoria en las
   citas nuevas, en la API (zod) y en la app. La base sigue aceptando NULL y las citas viejas sin hora siguen válidas.
   Hoy hay 2 de 20, las dos de la simulación.
2. **La agenda es un calendario**, en Agendar y en Mi agenda. Reemplaza lo que la spec del 2026-10-14 dejaba fuera
   ("medias horas, arrastrar en un calendario"). Arrastrar sigue fuera.

**De Claude (el dueño puede cambiarlas):**

3. **Franjas.** 30 minutos de 07:00 a 18:30, más "Otra hora" cada 15 minutos de 05:00 a 21:45. Coincide con las
   medias horas de VMO y con los datos reales: todas las horas caen en :00 o :30, entre 08:00 y 16:00.
4. **Sin duración.** Cada cita se dibuja como un bloque de 30 minutos (`DURACION_VISUAL_MIN`). No hay columna nueva.
5. **Choques solo con aviso.** Dos citas a la misma hora se permiten, porque en una clínica se ve a dos médicos "a
   las 9". Bloquearlas está en "Para decidir".
6. **Pestañas.** Hoy · Reportar · Agenda · Números · Ajustes. Días libres se abre desde Agenda y desde Ajustes.
7. **Frescura del contexto en el teléfono.**
   - Hoy y Reportar no piden de nuevo antes de 60 s. Entre 60 s y 3 min pintan y refrescan sin tapar la pantalla.
   - El contexto solo se reusa a menos de 100 m del punto con que se pidió (`DISTANCIA_RECARGA_M`).
   - Agendar y Visita reusan los datos que no dependen del punto hasta 10 min.
   - Se invalida al recibir el 201 de una visita, al agendar o cancelar una cita, al registrar o anular un día libre y
     al cerrar sesión.
   - La ubicación final de la visita y lo que decide el servidor no cambian.
8. **Resumen de la tarjeta.** Solo para las tarjetas de voz que pasan `validarBorrador`, con confianza ≥ 0,6, sin
   preguntas y presenciales dentro del radio o telefónicas válidas. Las demás abren completas. La de toques abre
   completa y también lleva el pie fijo.
9. **Audio.** No cambia por defecto, sigue a 64 kbps y 44,1 kHz. Queda listo el perfil ligero (32 kbps, 22,05 kHz,
   mono AAC) con `EXPO_PUBLIC_PERFIL_AUDIO=ligero` para la prueba A/B del dueño (ver "Para decidir").
10. **Dependencias nuevas.** Solo `@expo/vector-icons` (íconos) y `expo-haptics` (vibración corta), las dos incluidas
    en Expo Go SDK 57 (`bundledNativeModules.json`). No se instala `@react-native-community/datetimepicker`: no tiene
    versión web y las capturas se toman con React Native Web.

## Criterios de aceptación (se convierten en pruebas)

Las pruebas nuevas de la app van en `mobile/scripts/checks/<NN>-<paquete>.ts`: un archivo por paquete, que
`movil-check.ts` corre al final como secciones 15 a 19. Las del servidor van en `web/scripts/*-check.ts`. Las
pruebas que leen el texto de una pantalla revisan cada llamada dentro de su bloque. Cada prueba nueva se comprueba
rompiendo a mano lo que cuida, como en la spec de ubicación rápida.

### 15. Navegación y kit visual (`15-navegacion.ts`)
- [ ] Dado `_layout.tsx`, entonces `tabBarStyle` no tiene `height`, y no quedan `tabBarIcon: () => null`,
      `display: 'none'`, `'beside-icon'` ni `tabBarActiveBackgroundColor`. La etiqueta va debajo del ícono.
- [ ] `PESTANAS` (`mobile/lib/navegacion.ts`) es exactamente hoy, reportar, agenda, numeros, ajustes. Cada título
      tiene 8 letras o menos, y cada ícono, relleno y contorno, existe en el glyphmap de Ionicons del paquete instalado.
- [ ] `dias-libres`, `agenda/nueva`, `visita/[id]`, `medico/nuevo` y `sede/nueva` llevan `href: null`.
- [ ] `contraste()` (`mobile/lib/paleta.ts`, fórmula WCAG):
  - `bordeControl` da ≥ 3:1 sobre `superficie` y sobre `fondo`, en claro y en oscuro.
  - `textoSuave` sigue ≥ 4,5:1 sobre `fondo`.
- [ ] `Pantalla` lleva `automaticallyAdjustKeyboardInsets` y `keyboardDismissMode`, y su `pie` queda fuera del
      ScrollView. `Boton`, `Chip` y `BotonVolver` tienen `minHeight` ≥ `ALTO_TOQUE_MIN` (44).
- [ ] `haptica.ts` no llama a expo-haptics en web y nunca lanza.

### 16. Reportar y tarjeta (`16-reportar.ts`)
- [ ] `modoTarjeta`:
  - Una tarjeta de voz válida, con confianza 0,8 y sin preguntas → `resumen`.
  - Con confianza 0,5, con una pregunta, fuera del radio o sin médico cruzado → `completa`, y `atencion` nombra el
    campo.
  - Una tarjeta de toques → siempre `completa`.
- [ ] `filasResumen` devuelve, en orden: con quién, "Sede · Presencial a 35 m (dentro del radio)", resultado, líneas,
      conclusión, compromisos y próxima reunión en palabras ("jueves 22 de octubre"). Una fila vacía no aparece,
      salvo la conclusión.
- [ ] `textoPieConfirmar(1, 2) === 'Confirmar visita 1 de 2'` y `textoPieConfirmar(1, 1) === 'Confirmar esta
      visita'`. TarjetaBorrador y Reportar usan `Pantalla.pie` para Confirmar.
- [ ] Con una tarjeta que viene de una cita (`agenda_id`), "Tipo de visita" no se muestra.
- [ ] `ordenarMedicos(medicos, sedeId, punto)`:
  - Primero "Atienden en <sede>", luego "Cerca de aquí" por distancia y luego el resto por nombre.
  - Las cantidades no cambian y no hay repetidos.
- [ ] Un solo buscador de médicos:
  - Si no hay coincidencias propias, ofrece "Buscar en OpMap" con el mismo texto.
  - `debeBuscarAlEscribir`: 3 letras sin contar espacios, con `ESPERA_BUSQUEDA_MS = 400`.
  - Buscador cancela la búsqueda anterior con `AbortController`, y la fila entera es tocable.
- [ ] `planCargaReportar({ enMemoria, primera, ahora })`:
  - Con menos de 60 s y menos de 100 m → `usar`, sin pedir.
  - Entre 60 s y 3 min → `pintar_y_refrescar`.
  - Sin memoria, más viejo o más lejos → `pedir`.
  - Reportar no muestra "Cargando tus citas…" en los dos primeros casos.
- [ ] Cita desde Hoy (`tomarCitaParaReportar` al recibir el foco):
  - Sin nada abierto, elige esa cita.
  - Con una tarjeta abierta, una grabación o un envío en curso, no borra nada y queda pendiente, con las mismas
    reglas de "Reportar de nuevo" (`pasoDelReporte`).
- [ ] Antes de elegir no aparecen Hablar y Por toques deshabilitados al final. Hay una línea guía arriba.
- [ ] En la fase `proponiendo` se muestra "Lo que dijiste". "Lo que dijiste" se pliega y se despliega completo.
- [ ] Próxima reunión:
  - `CamposVisita` usa `CalendarioMes` en lugar del campo "Fecha (AAAA-MM-DD)". Los atajos se quedan.
  - `puedeAgendarProxima(next_step_date, hoy)` es verdadero solo dentro de hoy..hoy + 30.
  - Con eso, el resultado de la visita confirmada ofrece "Agendar esa reunión" (`fijarPedidoAgendar` + `rutaAgendar`).
- [ ] "Dictar" mide ≥ 44 pt, tiene ícono de micrófono y no va con `position: 'absolute'`. Grabador vibra al empezar y
      al terminar, y Reportar vibra con el 201.
- [ ] Reportar llama a `marcar()` en: toque_hablar, grabando, fin_grabacion, transcripcion, propuesta,
      primer_toque_tarjeta, toque_confirmar, visita_guardada y lista_pintada.
- [ ] Las pruebas existentes de las secciones 8, 11 y 14 siguen en verde. Solo el paquete 2 las ajusta, y solo las
      que leen archivos suyos.

### 17. Agenda con hora (`17-agenda.ts`, `web/scripts/reporte-check.ts`, `reporte-api-check.ts`, `simulacion-check.ts`)
- [ ] Calendario (`mobile/lib/calendario.ts`):
  - `cuadriculaMes('2026-10', …)`: 5 semanas de 7 días, lunes primero, del 28 de septiembre al 1 de noviembre. Hoy va
    marcado, y `elegible` respeta `desde` y `hasta`.
  - `rangoDeMes` nunca pasa de 31 días.
  - Para todo día de hoy..hoy + 30, el mes que lo contiene se pide con un rango que lo incluye.
- [ ] Franjas (`mobile/lib/agenda.ts`):
  - `franjasHorario()` da 24 franjas, de '07:00' a '18:30'.
  - `franjaDe('09:45') === '09:30'`.
  - `ocupacionDelDia` deja las citas sin hora al final y amplía el día si hay una cita a las 06:30 o a las 19:00.
- [ ] `siguienteFranjaLibre`:
  - Hoy a las 10:42, con 11:00 ocupada → '11:30'.
  - Un día futuro vacío → '08:00'.
  - Un día lleno, o hoy después de las 18:30 → null, y la validación dice "Elige la hora de la cita".
- [ ] `validarCitaConHora`:
  - Hora '' → error en `hora`, con `MENSAJE_HORA_OBLIGATORIA = 'Elige la hora de la cita'`.
  - '10:00' → sin errores.
  - '25:00' → el mensaje de formato del servidor.
  - El texto es idéntico al de `web/lib/reporte-visitas-schemas.ts` (lo comprueba leyendo el archivo).
- [ ] `cuerpoCitaConHora` lanza sin hora y deja la hora en HH:MM.
- [ ] Textos:
  - `textoBotonAgendar` → 'Agendar · jueves 16 oct · 10:00'.
  - `avisoChoque` nombra la hora y con quién; da null si la franja está libre.
  - `avisoAgendadaHoy` solo cuando la fecha es hoy.
- [ ] Pedido para Agendar:
  - `rutaAgendar` solo lleva `fecha` y `hora` en la URL y descarta valores no válidos.
  - Con quién (tipo, médico o cuenta y subtipo, sede) va en memoria con `fijarPedidoAgendar` /
    `tomarPedidoAgendar`, que se toma una sola vez.
- [ ] `agenda/nueva.tsx`:
  - No quedan el chip "Sin hora" ni el campo "Hora (opcional)".
  - "¿Cuándo?" y "¿A qué hora?" van antes de "¿Con quién?", y el Selector de médicos empieza cerrado.
  - Usa `validarCitaConHora` y `cuerpoCitaConHora`, y el botón principal va en `Pantalla.pie`.
- [ ] `agenda.tsx`:
  - Usa `CalendarioMes` y `LineaDelDia`.
  - Pide `api.agenda(desde, hasta, true)` con `rangoDeMes` y sigue diciendo "Queda en tu agenda como cancelada".
  - Tiene entrada a "/dias-libres".
- [ ] Servidor (`reporte-check`, sección 10e):
  - `citaCreateSchema` rechaza una cita sin hora, con hora '' o con null, y el error va en `hora` con "Elige la
    hora de la cita".
  - La hora con segundos queda en HH:MM.
- [ ] Servidor (`reporte-api-check`):
  - `POST /api/me/agenda` sin hora da 400, con error en `hora`, y no guarda nada.
  - La institucional válida, ahora con hora '11:00', da 201.
  - `GET /api/me/agenda` sigue devolviendo las citas viejas con `hora: null`.
- [ ] Simulación: `simulacion-carmen.ts` da hora a todas las citas (día 1, médico 5: 10:30; día 4, médico 3: 14:00).
      En `simulacion-check`, "hay alguna sin hora" pasa a "todas con hora". La simulación no se corre en este cambio.

### 18. Tiempos y caché (`18-tiempos.ts` y `web/scripts/tiempos-check.ts`)
- [ ] `cronometro(ruta)` (`web/app/api/me/_lib/tiempos.ts`), con un reloj falso:
  - Mide cada `fase` también cuando la promesa falla, y la falla se propaga.
  - La cabecera es `auth;dur=12, ctx;dur=340, total;dur=380`.
  - La línea es `[tiempos] POST /api/me/contexto auth=12 ctx=340 total=380 frio=1`: solo el patrón de la ruta y
    números, sin ids, texto ni coordenadas. `frio=1` solo en la primera petición de la instancia.
- [ ] `leerPorIds` devuelve lo mismo y en el mismo orden con trozos en paralelo, con 4 a la vez como mucho, probado
      con un lector falso.
- [ ] `reporte-api-check.ts` y `terceros-api-check.ts` siguen en verde SIN cambios del paquete 4. Las rutas no
      cambian lo que responden y los registros siguen sin contenido.
- [ ] `contextoReciente`:
  - Devuelve la entrada solo si tiene menos de `maxEdadMs` y, si se pide `cercaDe`, está a menos de `maxDistanciaM`.
  - Sin punto guardado y con `cercaDe` → null.
  - `invalidarContexto` la borra y avisa a los oyentes, y `olvidarContextoEnMemoria` la borra al cerrar sesión.
- [ ] `api.contexto(punto)` llama a `recordarContexto` con el punto pedido (texto). `cola-contexto.tsx` llama a
      `invalidarContexto('visita')` al recibir el 201.
- [ ] `rutaPatron('/api/me/visitas/<uuid>/anular') === '/api/me/visitas/:id/anular'`. El registro de desarrollo
      (`__DEV__`) de `api.ts` lleva método, patrón, estado, ms y `server-timing`, nunca el cuerpo.
- [ ] `MemoriaToken` (`token.ts`): lee el llavero una sola vez; guardar y borrar actualizan la memoria, y un 401 la
      borra.
- [ ] `arranqueDeSesion({ perfilGuardado, tokenVigente })`:
  - Con perfil y token vigente → `entrar_y_confirmar`.
  - Sin perfil → `confirmar_antes`.
  - Sin token → `sin_sesion`.
  - `TIEMPO_ME_MS = 5_000`.
- [ ] Audio:
  - `OPCIONES_GRABACION` sigue en 64000/44100 por defecto.
  - Con `EXPO_PUBLIC_PERFIL_AUDIO=ligero` queda en 32000/22050, mono, también en web (`bitsPerSecond`).
  - `lib/api.ts` sigue subiendo con `parteAudio(uri, () => archivo.bytes())` (prueba existente).

### 19. Resto de pantallas (`19-pantallas.ts`)
- [ ] `debeRecargarHoy(ultima, ahora, invalidado)`: no antes de 60 s; sí si hubo invalidación o se tiró para
      actualizar.
- [ ] `citaDeAhora(citas, ahora)` es la pendiente con hora entre 30 min antes y 60 min después.
      `textoSiguienteCita` → 'Siguiente: 10:30 · Dra. Gómez (en 25 min)'. Las pendientes con hora pasada llevan
      'Atrasada'.
- [ ] Hoy:
  - Una cita pendiente es tocable: llama a `fijarCitaParaReportar(cita.id)` y lleva a Reportar.
  - Sigue llamando a `pedirUbicacionEnDosPasos({ timeoutMs: 8_000 }).primera` (prueba existente de la sección 14).
  - Pinta el contexto guardado con "Actualizando…".
- [ ] Ajustes tiene "Mis días libres". Días libres elige la fecha con `CalendarioMes`, con sus días marcados por
      estado, y llama a `invalidarContexto('dia_libre')`.
- [ ] Números:
  - Al cambiar de mes, las cifras se atenúan con "Cargando <mes>…".
  - `faltanVisitas(cuota, hechas, diasHabiles, transcurridos)` → "Te faltan N visitas médicas: X por día hábil".
    Si no se puede calcular, da null.
- [ ] Visita:
  - Conclusión y Compromisos van con la etiqueta arriba y el texto a todo el ancho.
  - "Agendar la próxima reunión" aparece solo con `next_step_date` dentro de hoy..hoy + 30.
  - "data manager" pasa a "el equipo de datos".
- [ ] Nueva sede dice "Ubicación tomada · ±12 m" (`textoUbicacionTomada`). Nuevo médico muestra el error junto a cada
      campo y "Crear médico" en `Pantalla.pie`. Sigue `const punto = pedido?.puntoFinal ? await pedido.puntoFinal`
      (prueba existente).
- [ ] Ingreso: "Siguiente" en el correo pasa a la contraseña (`onSubmitEditing`). "Entrar" explica lo que falta.

### Verificación visual (antes y después, 390×844)
Se usa el método del estudio: `scratchpad/usabilidad/capturar.sh <carpeta-salida> [ref-git] [carpeta-mobile]`.

- Puertos 8791 (API falsa), 8084 (estático) y 9333 (Chrome sin ventana). Nunca el 8081.
- Se exporta una copia limpia de `mobile/` con `git archive` o desde un worktree, para que las copias " 2" no se
  vuelvan rutas.
- Salida en `scratchpad/usabilidad/despues/`, con los mismos 26 pasos, `medidas.json` y `api-peticiones.log`.
- Si un paso del guion ya no aplica (por ejemplo, "Días libres" dejó de ser pestaña), se ajusta el guion en el
  scratchpad, nunca en el repo.
- La API falsa debe traer al menos una cita a 8–30 días.

Se tiene que ver:

- [ ] **Barra:** con el área segura emulada, las etiquetas quedan enteras por encima de la franja inferior, y ninguna
      termina en "…" (capturas 24 y 26 y `medidas.json`).
- [ ] **Agendar sin elegir médico:** "¿A qué hora?" y sus chips caen dentro de la primera pantalla, encima de la
      barra (antes: hora a 2.207 px).
- [ ] **Tarjeta por toques:** "Confirmar" se ve sin desplazar (antes: 974 px).
- [ ] **Mi agenda:** muestra el calendario, el día como línea de tiempo y una cita a más de 7 días.
- [ ] **Peticiones:** volver a Hoy antes de 60 s no hace `POST /api/me/contexto`. Entrar a Reportar justo después de
      Hoy no muestra "Cargando tus citas…".
- [ ] **En el iPhone del dueño (Expo Go), con la rama en su Expo:**
  - La barra se ve entera.
  - Agendar se ve como calendario con hora.
  - Un dictado completo deja las marcas `[tiempos-app]` en Metro y las `[tiempos]` en Vercel.

## Fuera de alcance

- La confirmación optimista (la tarjeta pasa a "Enviando…" antes del 201). Es de prioridad baja y tiene riesgo
  medio: una tarjeta rechazada reaparece.
- El caché de prompt de Claude. Si los dictados quedan a más de 5 min entre sí, cada uno paga la escritura del caché
  (1,25×) y el costo sube. Se reconsidera con las cifras de `usage`.
- Cambiar de modelo (gpt-4o-transcribe y claude-sonnet-5-5 se quedan).
- NativeTabs (`expo-router/unstable-native-tabs`).
- Arrastrar citas, duración de la cita, recordatorios y avisos push.
- Agenda del líder o de la dirección (F5).
- Sincronizar con Google Calendar u Odoo.
- La web de OpMap: solo cambia la validación de `POST /api/me/agenda`.

Lo que se hace en la **tanda 2**, después de integrar la tanda 1 y con las cifras de la medición, va en el Plan,
paquetes 6 y 7.

## Para decidir (no entra en este cambio)

| # | Pregunta | Recomendación de Claude |
|---|---|---|
| D1 | ¿Se preelige la única cita pendiente, o la única sede, dentro del radio? Hoy la persona la toca (decisión 2 del 2026-10-14). | Sí, con "Cambiar" a la vista y solo si la ubicación final lo confirma. Ahorra un toque por visita. Mientras tanto, entrar desde la cita en Hoy. |
| D2 | ¿La "Próxima reunión" lleva hora (columna nueva, migración con rollback)? ¿Crea sola la cita? Esto último afecta el indicador de agendadas. | No por ahora. El botón manual "Agendar esa reunión" (en el alcance) deja la cita con hora sin cambiar el contrato. |
| D3 | ¿Se puede reprogramar una cita (cambiar día u hora)? ¿Sigue contando como agendada? | Sí, en una fase siguiente: `agenda_reprogramar` (migración 0850) conserva `created_at`, así que sigue contando como agendada. Mientras tanto, "Cancelar y agendar de nuevo" con los datos puestos, con el aviso de que hoy cuenta como no agendada. |
| D4 | ¿Se bloquean dos citas a la misma hora? | No: solo el aviso (en el alcance). Bloquear exige una regla nueva en `agenda_crear` (migración). |
| D5 | ¿Días libres por rango ("del 20 al 22")? | Sí, como un ciclo en la app con un resumen de lo que entró y lo que no. Cada día respeta su plazo y su aprobación, sin cambiar la API. |
| D6 | ¿"Confirmar las N visitas" de un solo toque cuando todas están en resumen? El contrato pide "Confirmar" por tarjeta. | No por ahora. El pie "Confirmar visita 1 de N" ya quita el desplazamiento. Se revisa con las marcas de tiempo. |
| D7 | ¿Se graba más liviano, a 32 kbps y 22,05 kHz? | Solo después de que el dueño compare el mismo dictado, con nombres de médicos, productos y líneas, en los dos perfiles (`EXPO_PUBLIC_PERFIL_AUDIO`). Sube la mitad de bytes con mala señal; el riesgo está en los nombres propios. |

## Impacto

- **Datos y migración:** ninguna.
  - La hora obligatoria va en zod (`citaCreateSchema`) y en la app. `visitas_agenda.hora` sigue siendo `time NULL`.
  - Un `NOT NULL` rompería las 2 citas sin hora y las pruebas del bloque DO de la 0840.
  - El comentario de la columna ("opcional…") queda desactualizado: se anota en `docs/base-de-datos.md` y se corrige
    en la próxima migración que haya.
- **Costo Google Maps:** 0. Nada llama a Google.
- **Costos de OpenAI y Claude:** no suben. La tanda 1 no cambia ninguna llamada, ni modelos, ni tokens, ni
  transcripción. El audio ligero solo se activa tras D7, y OpenAI cobra por minuto, no por bytes. Sin caché de prompt.
- **Estética del mapa:** no aplica, porque solo cambia la app móvil.
- **Permisos y roles:** no cambian (`visits:report`).
- **Contrato fase 8 (F4.1):**
  - `POST /api/me/agenda` exige `hora` ("Elige la hora de la cita").
  - Cabecera `Server-Timing`, que es aditiva.
  - La barra de pestañas y Días libres dentro de Agenda.
- **Orden del despliegue.** La app nueva siempre manda la hora, así que funciona con la API vieja. Se actualiza el
  Expo del dueño junto con el merge, o antes. Si la API sale primero, la app vieja que manda "Sin hora" recibe un 400
  con "Elige la hora de la cita", que ya se muestra en "No se agendó".

## Plan: paquetes de trabajo

### Reglas de la tanda 1 (paralela)

- **Dónde se trabaja.** Todo en un worktree nuevo desde `origin/master`:
  `git worktree add ../OpMap-usabilidad -b feat/movil-usabilidad-y-agenda origin/master`. Ahí no están las copias
  " 2" (que expo-router volvería rutas y tsc compilaría). No se usa el puerto 8081 ni el Expo del dueño (corre desde
  `OpMap-audio`). Nada escribe en Supabase.
- **Archivos.** Cada paquete edita **solo** los archivos de su lista. Si necesita algo de un archivo ajeno, usa la
  interfaz de la sección "Interfaces compartidas", que deja el Paso 0. Si no alcanza, para y lo reporta: no edita el
  archivo ajeno.
- **Pruebas.** Cada paquete escribe sus pruebas en su archivo `mobile/scripts/checks/NN-*.ts`. Las secciones 1–14 de
  `movil-check.ts` solo las toca el paquete 2, y solo las pruebas que leen archivos suyos. Los demás las mantienen en
  verde sin tocarlas, conservando las líneas que esas pruebas buscan.
- **Comprobación.** Mientras trabaja, cada agente corre `npx tsc --noEmit` y mira solo los errores de sus archivos,
  porque los de otro paquete pueden estar a medias. También corre su archivo, con
  `npx tsx scripts/checks/correr.ts NN-nombre`. `npm run check` completo se corre en la integración.
- **Commits.** Nadie hace commit en la tanda 1: el árbol es compartido y el índice de git se bloquea. Al terminar,
  cada agente entrega la lista exacta de archivos tocados, las pruebas añadidas, lo que rompió de otro paquete (si
  algo) y, si cambió una forma, la línea para el contrato.
- **Textos.** En español; "Ejecutivo Comercial", "Zona"; nunca "KAM", "representante" ni "panel" (la sección 12 lo
  revisa).

### Paso 0 (secuencial, antes de la tanda; un solo agente)

1. Crear el worktree y la rama. Instalar con `cd mobile && npx expo install @expo/vector-icons expo-haptics`, que
   cambia `package.json` y `package-lock.json`.
2. Escribir las interfaces compartidas de la sección siguiente, con su versión provisional, que funciona igual que hoy.
3. Pruebas:
   - Crear `mobile/scripts/checks/probador.ts` (`interface Probador { check; seccion; lanza }`).
   - Crear `correr.ts`, que corre un solo archivo, y los cinco archivos `15-navegacion.ts`, `16-reportar.ts`,
     `17-agenda.ts`, `18-tiempos.ts` y `19-pantallas.ts`. Cada uno exporta
     `export async function pruebas(t: Probador): Promise<void>` y por ahora solo llama a `t.seccion('NN. …')`.
   - En `movil-check.ts`, llamarlos en orden al final de `main()`, antes del resumen.
   - Aflojar la prueba de Mi agenda de la sección 11 a `/api\.agenda\([^)]*,\s*true\)/` + "Queda en tu agenda como
     cancelada": vale para el código de hoy y para el de mañana.
4. Crear `web/scripts/tiempos-check.ts` vacío (solo la sección) y registrarlo en el `test` de `web/package.json`.
5. `npm run check` en verde en `mobile/` y en `web/`, y commit
   `chore(movil): base compartida para la tanda de usabilidad`.

### Interfaces compartidas (las deja el Paso 0; cambiarlas exige avisar al orquestador)

```ts
// mobile/lib/ui.tsx (dueño: P1)
interface Colores { /* … */ bordeControl: string }   // claro '#8A8A8A', oscuro '#6B6B6B'
export const ALTO_TOQUE_MIN = 44
// Pantalla: prop nueva `pie?: ReactNode`: fijo abajo, fuera del desplazamiento, encima de la barra de pestañas.

// mobile/lib/iconos.tsx + mobile/lib/iconos-nombres.ts (puro) (dueño: P1)
export type NombreIcono = 'hoy' | 'reportar' | 'agenda' | 'numeros' | 'ajustes' | 'microfono' | 'calendario'
  | 'reloj' | 'atras' | 'adelante' | 'mas' | 'check' | 'cerrar' | 'alerta'
export function Icono(props: { nombre: NombreIcono; activo?: boolean; tamano?: number; color?: string }): JSX.Element
// Ionicons: relleno si activo, contorno si no. El mapa nombre → glifo está en iconos-nombres.ts.

// mobile/lib/haptica.ts (dueño: P1). No hace nada en web y nunca lanza.
export function vibrarSuave(): void
export function vibrarExito(): void
export function vibrarAviso(): void

// mobile/lib/contexto-memoria.ts (dueño: P4). Provisional: contextoReciente → null (todos piden como hoy).
export interface ContextoEnMemoria { contexto: ContextoResponse; punto: Punto | null; recibidoEn: number }
export type MotivoInvalidacion = 'visita' | 'cita' | 'dia_libre' | 'sesion'
export const FRESCURA_SIN_PEDIR_MS = 60_000      // Hoy y Reportar no piden de nuevo
export const FRESCURA_PINTAR_MS = 180_000        // Reportar pinta y refresca sin tapar
export const FRESCURA_DATOS_FIJOS_MS = 600_000   // Agendar y Visita: médicos, perfil, líneas, voz
export function recordarContexto(contexto: ContextoResponse, punto: Punto | null, ahora?: number): void  // la llama api.contexto
export function contextoReciente(o: { maxEdadMs: number; cercaDe?: Punto | null; maxDistanciaM?: number; ahora?: number }): ContextoEnMemoria | null
export function invalidarContexto(motivo: MotivoInvalidacion): void
export function escucharInvalidacion(oyente: (motivo: MotivoInvalidacion) => void): () => void
export function olvidarContextoEnMemoria(): void

// mobile/lib/tiempos.ts (dueño: P4). Provisional: no hace nada.
export type MarcaReporte = 'lista_pintada' | 'toque_hablar' | 'grabando' | 'fin_grabacion' | 'transcripcion'
  | 'propuesta' | 'primer_toque_tarjeta' | 'toque_confirmar' | 'visita_guardada'
export function marcar(marca: MarcaReporte, datos?: Record<string, number>): void

// mobile/lib/agenda.ts (dueño: P3). El Paso 0 deja esto completo; P3 añade el resto.
export interface PedidoAgendar { tipo: TipoVisita; medico_id?: string | null; cuenta_id?: string | null; subtipo_id?: string | null; sede_id?: string | null }
export function rutaAgendar(p: { fecha?: string; hora?: string }): string   // '/agenda/nueva?fecha=…&hora=…', sin ids en la URL
export function fijarPedidoAgendar(p: PedidoAgendar): void                   // en memoria, como lib/retorno.ts
export function tomarPedidoAgendar(): PedidoAgendar | null                   // se toma una sola vez
export function puedeAgendarProxima(fecha: string | null, hoy: string): boolean   // hoy..hoy + 30

// mobile/lib/retorno.ts (dueño: P2). El Paso 0 añade:
export function fijarCitaParaReportar(citaId: string): void
export function tomarCitaParaReportar(): string | null

// mobile/components/agenda/CalendarioMes.tsx (dueño: P3). Provisional: el ‹ fecha › de hoy con estas props.
export interface MarcaDia { citas?: number; estadoLibre?: EstadoDiaLibre | null; apagado?: boolean }
export interface PropsCalendarioMes {
  valor: string | null; alCambiar: (fecha: string) => void; hoy: string
  desde?: string; hasta?: string; marcas?: Readonly<Record<string, MarcaDia>>
  vista?: 'mes' | 'semana'; alCambiarMes?: (mes: string /* AAAA-MM */) => void
}
export function CalendarioMes(props: PropsCalendarioMes): JSX.Element
```

Las funciones puras viven en archivos sin `react-native`, porque las pruebas corren en Node. Los componentes las
importan.

### Paquete 1: navegación y kit visual

- **Edita:**
  - `mobile/app/(app)/_layout.tsx`
  - `mobile/lib/ui.tsx`
  - `mobile/lib/paleta.ts` (nuevo: las paletas y `contraste()` pasan aquí; `ui.tsx` las sigue exportando)
  - `mobile/lib/navegacion.ts` (nuevo: `PESTANAS`)
  - `mobile/lib/iconos.tsx`, `iconos-nombres.ts` y `haptica.ts`
  - `mobile/app.json` (solo `android.softwareKeyboardLayoutMode: 'resize'` si falta)
  - `mobile/scripts/checks/15-navegacion.ts`
- **No edita:** pantallas, `components/`, `lib/` fuera de su lista ni `movil-check.ts`.
- **Hace:**
  - Barra: sin `height`, íconos Ionicons con la etiqueta debajo a 11 pt DM Sans media, sin `lineHeight` forzado.
  - Pestañas: `agenda` visible con el título "Agenda" y el encabezado "Mi agenda"; `dias-libres` oculta con
    "Volver" y el encabezado "Mis días libres".
  - `BotonVolver` de 44 pt.
  - `Pantalla`: con teclado (`automaticallyAdjustKeyboardInsets`, `keyboardDismissMode` 'interactive' en iOS y
    'on-drag' en Android) y con `pie`.
  - `bordeControl` en Campo, Chip inactivo y botón secundario. La tarjeta sigue con el borde suave.
  - Alturas mínimas de 44 pt.
- **Funciones puras:** `PESTANAS`, `contraste(a, b)`, `ALTO_TOQUE_MIN`.

### Paquete 2: Reportar y tarjeta

- **Edita:**
  - `mobile/app/(app)/reportar.tsx`
  - todo `mobile/components/reporte/*`: TarjetaBorrador, CamposVisita, Selector, Buscador, DictarCampo, Grabador,
    ListaCitas, ListaSedes, FilaCita y SelectorMunicipio
  - `mobile/lib/propuesta.ts`, sin cambiar el bloque de la agenda (`formularioCitaVacio`…`cuerpoCita`), que usa P3
  - `mobile/lib/ubicacion-pasos.ts`, `mobile/lib/retorno.ts` y `mobile/lib/grabacion.ts`
  - archivos nuevos: `mobile/lib/tarjeta-resumen.ts`, `mobile/lib/orden-medicos.ts` y `mobile/lib/busqueda.ts`
  - `mobile/scripts/checks/16-reportar.ts`
  - `mobile/scripts/movil-check.ts`: solo las pruebas existentes de las secciones 8, 11 (la parte de Reportar), 13 y
    14 que lean archivos suyos
- **No edita:** `_layout.tsx`, `ui.tsx`, `hoy.tsx`, `agenda*`, `api.ts`, `audio.ts`, `tipos.ts`, `contexto-*` ni
  `tiempos.ts`.
- **Hace:** modo resumen con filas tocables, lo dudoso arriba, "Editar todo".
  - Pie fijo "Confirmar visita i de N".
  - Oculta "Tipo de visita" en la tarjeta que viene de una cita.
  - "Lo que dijiste" plegable y visible mientras se propone.
  - Línea guía antes de elegir.
  - Usa `contextoReciente` + `planCargaReportar`, y `tomarCitaParaReportar` con las reglas de `pasoDelReporte`.
  - Selector ordenado por sede y cercanía, con un solo buscador.
  - Buscador que busca al escribir.
  - Próxima reunión con `CalendarioMes` y "Agendar esa reunión".
  - "Dictar" de 44 pt con ícono.
  - Vibración en Grabador y con el 201.
  - `marcar()` en las 9 marcas.
  - Grabador: pide el permiso al elegir la cita o la sede, y entrega la uri sin esperar a que se restaure el modo de
    audio.
- **Funciones puras:** `modoTarjeta`, `filasResumen`, `textoPieConfirmar` (`tarjeta-resumen.ts`); `ordenarMedicos`
  (`orden-medicos.ts`); `debeBuscarAlEscribir`, `ESPERA_BUSQUEDA_MS` (`busqueda.ts`); `planCargaReportar`
  (`ubicacion-pasos.ts`).

### Paquete 3: agenda como calendario con hora (app + API)

- **Edita:**
  - `mobile/app/(app)/agenda.tsx` y `mobile/app/(app)/agenda/nueva.tsx`
  - `mobile/components/agenda/*`: `CalendarioMes.tsx`, y los nuevos `SelectorHora.tsx`, `LineaDelDia.tsx` y
    `DetalleCita.tsx`
  - `mobile/lib/agenda.ts`, `mobile/lib/calendario.ts` (nuevo) y `mobile/lib/reglas.ts`
  - `mobile/scripts/checks/17-agenda.ts`
  - `web/lib/reporte-visitas-schemas.ts`
  - `web/lib/reporte-visitas.ts`: solo los tipos y mensajes de la agenda (`CitaCreateBase.hora: string`,
    `MENSAJE_HORA_OBLIGATORIA`)
  - `web/app/api/me/agenda/**`, solo si el tipo lo exige
  - `web/scripts/reporte-check.ts`, `web/scripts/reporte-api-check.ts`, `web/scripts/simulacion-carmen.ts` y
    `web/scripts/simulacion-check.ts`
  - documentos: `docs/decisiones/2026-10-15-agenda-con-hora-y-calendario.md` (nuevo), la sección F4.1 de
    `docs/fases/fase8-visitas-f3-f4-reporte-y-app-movil.md` y la nota de la columna en `docs/base-de-datos.md`
- **No edita:** `propuesta.ts` (usa `validarCita`, `formularioCitaVacio`, `cambiarFormularioCita`, `cuerpoCita` y
  `horaDeCita` tal cual), `FilaCita` y `ListaCitas` (las puede usar), `ui.tsx`, `api.ts` (`agenda`, `agendar`,
  `cancelarCita` y `diasLibres` ya sirven), `tipos.ts` ni `reporte-server.ts`.
- **Hace, en Agendar:**
  - El orden ¿Cuándo? → ¿A qué hora? → ¿Con quién? → Nota, con el pie "Agendar · …".
  - Una sola carga de 31 días: `api.agenda(hoy, hoy + 30)` y `api.diasLibres(hoy, hoy + 30)`.
  - El médico usa `lateral` = "Cita a las 09:30" cuando ya tiene cita ese día.
  - Lee `rutaAgendar` y `tomarPedidoAgendar` y vuelve a montar con `SoloEnFoco clave={fecha|hora|pedido}`.
  - Los datos fijos salen de `contextoReciente(FRESCURA_DATOS_FIJOS_MS)` o, si no hay, de `api.contexto(null)`.
  - Al agendar: `invalidarContexto('cita')` y vuelta a `/agenda?fecha=…` con la cita resaltada.
- **Hace, en Mi agenda:**
  - El calendario va en semana por defecto, con "Ver mes".
  - Pide por mes (`rangoDeMes`, `canceladas=true`) y guarda en un Map por mes. Vuelve a pedir con
    `useFocusEffect`.
  - Abajo, `LineaDelDia` con la línea "Ahora", el detalle de la cita en el mismo sitio, "Cancelar esta cita" con
    motivo (44 pt), y "Agendar" y "Días libres".
- **Hace, en el servidor:** `horaObligatoria` en `citaCreateSchema`.
- **Funciones puras:**
  - `calendario.ts`: `cuadriculaMes`, `semanaDe`, `lunesDe`, `rangoDeMes`, `mesDe`, `mesSiguiente`, `mesAnterior` y
    `tituloMes`.
  - `agenda.ts`: `HORARIO_AGENDA`, `DURACION_VISUAL_MIN`, `franjasHorario`, `franjaDe`, `ocupacionDelDia`,
    `siguienteFranjaLibre`, `franjaPasada`, `OTRA_HORA` (horas y minutos), `validarCitaConHora`,
    `cuerpoCitaConHora`, `MENSAJE_HORA_OBLIGATORIA`, `textoBotonAgendar`, `avisoChoque`, `avisoAgendadaHoy`,
    `medicosConCitaEseDia` y `marcasDelMes`.
  - Base: el borrador probado de `scratchpad/usabilidad/agenda-franjas-borrador.ts`.

### Paquete 4: tiempos del servidor y del teléfono

- **Edita (servidor):**
  - `web/app/api/me/_lib/reporte-server.ts`
  - `web/app/api/me/_lib/tiempos.ts` (nuevo)
  - las rutas `web/app/api/me/{contexto,visitas,visitas/[id]/**,voz/**,numeros,cuota,lines,dias-libres/**}`, solo
    para el cronómetro y para lanzar en paralelo lo que hoy va en serie sin depender
  - `web/app/api/terceros/_lib/terceros-server.ts` (`leerPorIds` con 4 a la vez)
  - `web/scripts/tiempos-check.ts` y `web/package.json`
- **Edita (app):**
  - `mobile/lib/api.ts`, `almacen.ts`, `token.ts`, `sesion.ts` y `sesion-reglas.ts` (nuevo, puro)
  - `mobile/lib/http.ts` y `audio.ts`
  - `mobile/lib/contexto-memoria.ts`, `contexto-guardado.ts` y `tiempos.ts`
  - `mobile/lib/cola-contexto.tsx`, `cola.ts`, `tipos.ts` y `claves-api.ts`
  - `mobile/scripts/checks/18-tiempos.ts`
- **No edita:** `web/lib/reporte-visitas*.ts` ni `web/app/api/me/agenda/**` (son de P3), `reporte-check.ts` ni
  `reporte-api-check.ts` (deben pasar sin cambios), `web/lib/auth-server.ts`, `config-visitas/_lib/visitas-server.ts`
  y `web/vercel.json` (son de la tanda 2), ni ninguna pantalla.
- **Hace, en el servidor:**
  - `cronometro` + `Server-Timing` + `[tiempos]`, con `usage` de Claude (input, output y cache_read) solo como
    números.
  - En `POST /api/me/visitas`, la consulta del médico o del subtipo en paralelo con la de la sede
    (`contextoValidacion`).
- **Hace, en la app:**
  - `recordarContexto` dentro de `api.contexto` y `invalidarContexto('visita')` en el 201.
  - `olvidarContextoEnMemoria` al cerrar sesión.
  - Sesión que entra con el perfil guardado y confirma en segundo plano (`TIEMPO_ME_MS = 5_000`); un 401 sigue
    cerrando por `alVencerSesion`.
  - Token en memoria.
  - Registro de desarrollo en `api.ts` y en `marcar()`.
  - Perfil de audio ligero detrás de `EXPO_PUBLIC_PERFIL_AUDIO`.
- **Funciones puras:** `cronometro`, `rutaPatron`, `MemoriaToken`, `arranqueDeSesion`, `contextoReciente` y
  `opcionesGrabacion(perfil)`.

### Paquete 5: resto de pantallas

- **Edita:**
  - `mobile/app/(app)/hoy.tsx`, `dias-libres.tsx`, `numeros.tsx`, `ajustes.tsx`, `visita/[id].tsx`,
    `medico/nuevo.tsx` y `sede/nueva.tsx`
  - `mobile/app/(auth)/login.tsx`
  - `mobile/lib/pantallas.ts` (nuevo, puro)
  - `mobile/scripts/checks/19-pantallas.ts`
- **No edita:** `ui.tsx` (usa `Pantalla.pie`), `reglas.ts`, `propuesta.ts`, `retorno.ts` (usa
  `fijarCitaParaReportar`), `components/` ni `lib/` fuera de su archivo.
- **Hace, en Hoy:**
  - Pinta primero lo guardado o lo que hay en memoria, con "Actualizando…".
  - `debeRecargarHoy` + `escucharInvalidacion`.
  - La cita pendiente es tocable, con "Siguiente: …" y "Atrasada".
- **Hace, en el resto:**
  - Ajustes: "Mis días libres".
  - Días libres: `CalendarioMes` con los días por estado, e `invalidarContexto('dia_libre')`.
  - Números: atenuar al cambiar de mes y "Te faltan…".
  - Visita: textos largos apilados, "el equipo de datos", "Agendar la próxima reunión" y datos fijos desde
    `contextoReciente`.
  - Nueva sede: "Ubicación tomada · ±N m".
  - Nuevo médico: errores por campo y pie fijo.
  - Ingreso: foco a la contraseña y "Entrar" que explica lo que falta.
- **Debe conservar** las líneas que buscan las pruebas existentes de la sección 14 en `hoy.tsx` y en
  `medico/nuevo.tsx`.
- **Funciones puras:** `debeRecargarHoy`, `citaDeAhora`, `textoSiguienteCita`, `faltanVisitas` y
  `textoUbicacionTomada`.

### Integración (secuencial, un solo agente, al terminar los cinco)

1. Revisar que ningún paquete tocó archivos ajenos: `git status` contra las listas.
2. `npm run check` en `mobile/` y en `web/`, más `npx expo export --platform web`. Los choques entre paquetes los
   arregla solo este paso.
3. Ajustes finales:
   - Actualizar el comentario de cabecera de `movil-check.ts`.
   - Añadir a la sección 12 la búsqueda global de "data manager" en textos visibles.
   - Actualizar la línea de fase 8 en `CLAUDE.md`.
4. Un commit por paquete, con solo sus archivos y en español (`feat(movil): …`, `feat(agenda): …`,
   `perf(api): …`).
5. Capturas del después con `capturar.sh` desde el worktree, comparadas con `antes/`, y la lista de "Verificación
   visual".
6. Subagente `revisor` sobre el diff y esta spec. Se corrige solo lo que afecte corrección o reglas. Después,
   `/entregar` (PR a `master`).

### Tanda 2 (secuencial, después de integrar la tanda 1 y con cifras de `[tiempos]`)

- **Paquete 6: navegación en pila.**
  - `(app)` pasa a ser `Stack`, con un grupo `(pestanas)` para Hoy, Reportar, Agenda, Números y Ajustes. Encima se
    apilan visita, médico, sede, Agendar y Días libres.
  - Agendar, Nuevo médico y Nueva sede se abren como hoja, con "Cancelar".
  - Así vuelve el gesto de deslizar para volver, la barra no queda sin pestaña marcada y sobra `SoloEnFoco`.
  - Va sola porque mueve archivos de todos los paquetes. Las URLs no cambian.
  - Hay que probar `retorno.ts`, "Reportar de nuevo" y la cita desde Hoy.
- **Paquete 7: la voz en una petición y menos consultas.** Se decide con las cifras.
  - `POST /api/me/voz/dictado`: autentica una vez y corre la transcripción en paralelo con un contexto liviano, sin
    cuota ni compromisos (`contextoDictado` acepta un `Pick`). Responde con la transcripción y las visitas.
  - Alias cortos en lugar de UUID para Claude, si `output_tokens` lo justifica.
  - Consultas anidadas de PostgREST para la autenticación, `misMedicos` y la agenda, con el Supabase falso ampliado
    en `reporte-api-check`.
  - `visitas_hoy` en el contexto, para que Reportar deje de pedir `GET /api/me/visitas`.
  - `POST /api/me/visitas` sin releer.
  - Funciones en `cle1` (`web/vercel.json`), en un PR propio, midiendo antes y después y revisando los crons y el
    plan.

## Verificación final

- `npm run check` en `web/` y en `mobile/`, con la salida completa.
- `npx expo export --platform web` sin errores y `next build`.
- Capturas a 390×844 en `scratchpad/usabilidad/despues/`, al lado de `antes/`, con `medidas.json` y
  `api-peticiones.log`. Se cumple cada punto de "Verificación visual".
- Prueba del dueño en el iPhone (Expo Go), con la rama en su Expo:
  - La barra se ve entera.
  - Agendar una cita con hora desde el calendario.
  - La cita aparece en Mi agenda.
  - Reportarla desde Hoy en 4 toques.
  - Leer en Vercel las líneas `[tiempos]` de ese dictado.
