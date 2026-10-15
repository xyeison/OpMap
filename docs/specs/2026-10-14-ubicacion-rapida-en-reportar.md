# Spec: Reportar sin esperar el GPS de alta precisión  (2026-10-14)

**Estado**: implementada (rama `fix/movil-ubicacion-rapida`)

## Problema
Al probar la app en el iPhone, el dueño vio que Reportar se quedaba un buen rato en "Tomando tu ubicación y las sedes
cercanas…" ("En esto se demora"). La pantalla esperaba una lectura del GPS de alta precisión (10 m en iOS), que dentro
de una clínica casi nunca llega. Agotaba su tiempo máximo (10 s en Reportar, 8 s en Hoy) y solo después pedía las
sedes. Los logs de Vercel lo confirman: en Hoy, el `GET /api/me/visitas` y el `POST /api/me/contexto` salen siempre a
8 s exactos el uno del otro, y cuando el GPS respondió al instante Reportar estuvo listo en 2 s.

## Resultado esperado
- Reportar muestra las citas y sedes cercanas en lo que tarda el servidor (1–2 s). Para eso usa una **primera
  ubicación**: la última conocida de menos de 2 minutos o, si no la hay, una lectura rápida de precisión media
  (~100 m). Las visitas de hoy se piden al mismo tiempo que la ubicación.
- La **ubicación final** se sigue tomando con la regla de siempre: alta precisión con 10 s de tiempo máximo y, si no
  llega, la última conocida de menos de 2 minutos, marcada aproximada. Es la única que va con la visita. Arriba dice
  "afinando la ubicación…" mientras llega.
- Si la final queda a más de 100 m de la primera, el contexto se vuelve a pedir sin tapar la pantalla. No se pierden
  la sede elegida, las sedes ni los contactos que ya están en uso en las tarjetas.
- Si se toca Confirmar o "Nuevo médico" antes de que llegue la final, se espera la final (con ruedita). La tarjeta no
  se puede editar durante la espera y ninguna visita ni consultorio sale con la primera ubicación.
- Mientras una tarjeta se está enviando, Reportar no empieza otra llegada. Si en ese rato la persona va a Hoy y toca
  "Reportar de nuevo", esa visita se arma cuando termina el envío, siempre que no quede ninguna tarjeta abierta. Si el
  servidor rechazó la tarjeta enviada, o hay otra sin confirmar o una grabación en curso, sigue esperando: la arma el
  siguiente envío que no deje nada abierto o la próxima vez que se vuelva a Reportar. La visita confirmada no se
  pierde, tampoco si la rechazan.

## Criterios de aceptación (se convierten en pruebas)
Todas las pruebas están en `mobile/scripts/movil-check.ts`, sección 14. Entre comillas va el comienzo del nombre de
cada prueba. La lógica está en funciones puras de `mobile/lib/ubicacion-pasos.ts`, y `reportar.tsx` las usa tal cual.
Las pruebas "Reportar: …" solo revisan que la pantalla las llame.
- [x] La primera ubicación es la última conocida de menos de 2 min, o la lectura rápida, o la precisa si llega antes.
      Pruebas "dos pasos: …".
- [x] La final sigue la regla de siempre: precisa o, si no, la última reciente marcada aproximada. `pedirUbicacion` no
      cambia para Nueva sede ni para Actualizar. Pruebas "final: …", "aUbicacion: …" y "lib/ubicacion.ts: …".
- [x] La final pendiente queda puesta al recibir la primera, antes de que la lista se pueda tocar (`arrancarLlegada`).
      Pruebas "(a) llegada: …" y "Reportar: arranca con arrancarLlegada…".
- [x] Confirmar y Nuevo médico usan `lugarDeLaVisita`: esperan la final si no ha llegado y la usan si ya llegó, aunque
      la pantalla no se haya vuelto a pintar. Pruebas "lugar de la visita: …", "Reportar: Nuevo médico recibe la
      final…" y "Nuevo médico: …".
- [x] Confirmar (`datosParaConfirmar`) manda la final y su hora, el catálogo de ese momento medido desde la final y la
      tarjeta como quedó, no lo que había al tocar. Si cambió la generación o la tarjeta ya no está, no manda nada.
      Pruebas "(b) confirmar: …", "Reportar: Confirmar sale con datosParaConfirmar…" y "Reportar: mientras espera la
      final…".
- [x] Al pedir de nuevo el contexto con la final (`contextoAlRecargar`), se conservan las sedes en uso: la elegida, la
      de la cita y las de las tarjetas. También los contactos de las cuentas en uso: las de las tarjetas, la de la sede
      elegida y la de la cita elegida (`enUsoAlRecargar`). Las distancias que el servidor midió desde otro punto no se
      usan (`distanciasDeOtroPunto`). Pruebas "recargar: …", "(b) confirmar: con el contexto…" y "Reportar: al recargar
      usa contextoAlRecargar…".
- [x] Mientras una tarjeta se envía, no empieza otra llegada. Un "Reportar de nuevo" se aplaza y se arma al terminar
      el envío solo si no queda ninguna tarjeta abierta ni una grabación (`pasoDelReporte`, `abiertasAlTerminarEnvio`:
      la tarjeta recién guardada no cuenta, la rechazada sí). Pruebas "paso: …", "abiertas al terminar: …",
      "Reportar: al recibir el foco cuenta…", "Reportar: cuenta los envíos…", "Reportar: la tarjeta solo cuenta como
      guardada…", "Reportar: aplicarPaso…" y "Reportar: lo último (ultimo.current…".
- [x] "Afinando la ubicación…" no se queda pegado cuando empieza otra llegada o se toca "Actualizar" (`estaAfinando`).
      Pruebas "afinando: …" y "Reportar: "afinando" se muestra con estaAfinando…".
- [x] Permiso denegado, GPS apagado y sin señal terminan con su mensaje. No quedan cargas eternas: todas las esperas
      tienen tiempo máximo. Pruebas "final: sin permiso…", "final: nunca lanza…", "dos pasos: sin nada a tiempo…" y
      "dos pasos: sin permiso…".
- [x] La lectura rápida de la propia app no sirve de respaldo a la final ni a `pedirUbicacion` (Nuevo médico, Crear sede
      aquí): sin precisa, el resultado es el de antes (sin punto). Sí se usa para mostrar al volver a Reportar
      (`movil-check`, sección 14, "rápida propia"; comprobado rompiéndolo: fallan 2).
- [ ] En el iPhone (Expo Go), Reportar aparece en ~2 s dentro de una clínica. Esto lo prueba el dueño.

Para cada prueba nueva se comprobó que falla si se rompe lo que cuida. Se dañó a mano la función o la llamada de la
pantalla, se corrió `movil-check` y se restauró el código. Las pruebas "Reportar: …" revisan cada llamada dentro de su
bloque (el foco, el cuerpo y el `finally` de Confirmar, `aplicarPaso`, la línea de `ultimo.current`), para que una
regex no se extienda hasta otra llamada parecida.

## Fuera de alcance
- La regla de precisión de la visita (decisión 6 del contrato de fase 8) y el punto abierto de rechazar presenciales
  con precisión peor que ~100 m: no cambian.
- El servidor (`cargarContexto`, `misMedicos`), que hace entre 9 y 11 consultas seguidas. Queda propuesto aparte:
  medir la duración y juntar consultas.

## Impacto
- Datos / migración: no.
- Costo Google Maps: ninguno.
- Estética del mapa: no cambia (solo la app móvil).
- Permisos / roles: no cambian.

## Plan (archivos e interfaces)
- `mobile/lib/ubicacion-pasos.ts` (nuevo, puro): primera y final, `lugarDeLaVisita`, lo que se conserva al recargar
  (`contextoAlRecargar`) y lo que Reportar hace con los dos pasos: el orden de la llegada (`arrancarLlegada`), con qué
  sale una tarjeta (`datosParaConfirmar`), qué hace al recibir el foco o terminar un envío (`pasoDelReporte`) y
  `estaAfinando`.
- `mobile/lib/ubicacion.ts`: `pedirUbicacionEnDosPasos` con expo-location. `pedirUbicacion` funciona igual.
- `mobile/app/(app)/reportar.tsx` y `hoy.tsx`: usan la primera para mostrar y la final para enviar.
- `mobile/app/(app)/medico/nuevo.tsx`, `mobile/lib/retorno.ts`, `mobile/components/reporte/TarjetaBorrador.tsx` y
  `mobile/lib/propuesta.ts`: el consultorio nuevo espera la final, la tarjeta se bloquea mientras se envía y el
  catálogo no usa distancias medidas desde otro punto.

## Verificación final
- `npm run check` en `mobile/` (tsc + `movil-check`) y `npx expo export --platform ios`.
- Prueba del dueño en el iPhone.

## Para el dueño
- Mostrar la lista con la primera ubicación (de hasta 2 min, o de ~100 m) es solo para la pantalla. La visita siempre
  lleva la final.
- El umbral de 100 m para volver a pedir el contexto se puede ajustar.
- **La lectura rápida no se usa de respaldo de la final ni de las sedes.** La lectura rápida que se toma para mostrar
  la lista queda en el teléfono como "última conocida" (en iOS, `CLLocationManager().location`). Sin cuidado, cuando
  no hay una última reciente y la precisa no llega (dentro de una clínica), la final, el consultorio de "Nuevo médico"
  y "¿No está? Crear sede aquí" la tomarían como respaldo: un punto de ~100 m, y en una sede ese punto queda para
  siempre. Por eso la app lleva un registro de sus propias lecturas rápidas (`registroDeRapidas`) y la final y
  `pedirUbicacion` no las aceptan de respaldo. Ese caso termina como antes de los dos pasos: sin punto (solo
  telefónica, o "Hace falta la ubicación" al crear la sede). Una última conocida que no sea la rápida de la app sigue
  valiendo (aproximada), la regla de siempre. Pruebas: `movil-check`, sección 14 ("rápida propia"). El punto abierto de
  la precisión de la fase 8 no cambia.
- "Reportar de nuevo" sigue borrando las tarjetas que no se han confirmado cuando se toca en Hoy y Reportar no está
  enviando nada, como antes. Si se toca mientras una tarjeta se envía, espera a que termine. Al terminar, solo se arma
  si no queda nada abierto. Así no borra la tarjeta que el servidor acaba de rechazar (que ya salió de la cola) ni otra
  que la persona dictó mientras tanto.
