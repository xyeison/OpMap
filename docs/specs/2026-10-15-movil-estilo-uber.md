# Spec: app móvil con el estilo visual tipo Uber (dirección A)  (2026-10-15)

**Estado**: implementada (rama `feat/movil-estilo-uber`, sin PR todavía)

## Problema
El dueño vio dos direcciones visuales para la app de visita (artboards de diseño: A "estilo Uber" y B "estilo
Airbnb") y eligió: «Me gusta más la versión tipo Uber.» La app seguía con el encabezado negro, botones de 56 pt,
tarjetas con borde y chips con contorno.

## Resultado esperado
Toda la app móvil (`mobile/`) con la dirección A: negro y blanco, DM Sans, títulos 30/36 en negrita (−0,02 em),
encabezado BLANCO con el título grande (en vez de la barra negra), botón principal negro a ancho completo de 52 pt,
chips y botones secundarios rellenos de #EEEEEE, filas con separadores finos, bloques #F6F6F6, radios 10/12/20,
"dentro del radio" en verde #047857 sobre #E7F4EE, barra de pestañas con una raya negra arriba de la elegida y, en Hoy
y Reportar, un croquis arriba con la hoja blanca que sube sobre él. Modo oscuro coherente (se invierte). Solo
presentación: la lógica, los flujos y los textos siguen iguales (salvo "Revisa la visita" sobre las tarjetas, que trae
el diseño).

## Decisiones
- **Mapa**: no se usa un mapa real. `react-native-maps` no está instalado (habría que instalarlo con red), en Android
  su proveedor por defecto es Google Maps (pide llave en una compilación propia) y en el navegador no existe. En su
  lugar, un **croquis** dibujado con vistas (`components/Croquis.tsx` + `lib/croquis.ts`, puro y probado): tu punto
  con su precisión, las sedes cercanas que ya manda el servidor y el radio presencial de la sede que importa, A ESCALA
  y con el norte arriba. Las manzanas del fondo son decorativas. Sin Google, sin llaves, igual en Expo Go, compilada
  y en el navegador.
- **Bordes**: el botón secundario y el chip quedan rellenos de #EEEEEE sin borde (se reconocen por su texto, WCAG
  1.4.11); se prueba que su texto llegue a 4,5:1 sobre el relleno y que lo elegido (negro) se distinga de lo no
  elegido a ≥ 3:1. Los campos de texto y el selector conservan `bordeControl` (≥ 3:1).
- **"Volver"** sigue diciendo "Volver" (la palabra, en un botón relleno de #EEEEEE), no solo la flecha del artboard.
- La etiqueta de las pestañas sigue en 11 pt (el artboard dice 12): la revisión del 2026-10-15 midió que con más alto
  el nombre queda pegado al borde en un iPhone sin margen inferior.
- El calendario muestra la cantidad de citas como una cifra pequeña debajo del día (antes, una insignia azul encima).
- **Croquis de Hoy con la cita lejos**: el croquis dibuja el radio de la sede de la cita "de ahora" solo si queda a
  3 km o menos de ti; más lejos (otra zona u otra ciudad), a esa escala no se verían ni tu punto ni el radio, así que
  muestra el radio de la sede más cercana a ti. El bloque "Siguiente: …" de debajo dice la sede de la cita y a cuántos
  km está (decidido en la revisión del 2026-10-15; se prueba en `20-estilo`).
- **"Agendar" en Hoy** va junto al saludo, pero sale solo con el contexto del día, como antes (cuando estaba dentro de
  "Tu agenda de hoy"); sin contexto o sin Ejecutivo Comercial enlazado no se ofrece. "x de y hechas" va en gris y en
  verde (insignia de éxito) cuando están todas, como antes.

## Revisión (2026-10-15)
- "Estás aquí · ±12 m" ya no se sale del croquis ni tapa el logotipo o la sede (`posicionEtiquetaYo`: a un lado, al
  otro, encima, debajo o en diagonal, siempre dentro; barrido de 3.168 posiciones en las pruebas).
- La raya de la pestaña elegida va por dentro de la barra, pegada al borde (sube el relleno de 5 pt de la pestaña desde
  una caja de alto fijo; antes quedaba a caballo sobre el borde).
- Los días del calendario van a 2 pt entre sí (no a 4): miden 44 pt de ancho también en un Android de 360 dp; Agendar
  deja el calendario al margen de 20, como lo demás.
- El croquis mide 120 pt en pantallas de menos de 700 de alto (170 en las demás) y Reportar ya no lo agranda al elegir:
  en un iPhone SE u 8, "Hablar" y "Por toques" quedan a la vista después de elegir la cita.
- Se quitó lo que no se usaba (íconos de ubicación y buscar, `radioRelleno`, `LETRA.pestana`, `arribaDerecha`) y la
  leyenda del calendario dice "Bajo cada día, en pequeño: cuántas citas tienes". No se añadieron calles, parque, río
  ni botón de centrar del artboard: el croquis no se desplaza (siempre encuadra tu punto y la sede) y una geografía
  inventada junto a posiciones reales confundiría; si el dueño lo quiere, es otro cambio.

## Criterios de aceptación
- [x] Tokens en `lib/paleta.ts` (colores claro/oscuro, croquis, `TAMANO`, `LETRA`, `SOMBRA`) con contrastes ≥ 4,5:1
      para todo texto sobre su fondo y ≥ 3:1 para lo que no es texto, en los dos modos (`scripts/checks/20-estilo.ts`).
- [x] Todo lo que se toca ≥ 44 pt; botón de 52; tope de texto grande 1,3 donde ya estaba.
- [x] Hoy y Reportar sin encabezado, con croquis y hoja; las demás pestañas con el encabezado blanco y el título grande.
- [x] Las 805 pruebas que había siguen en verde (4 ajustadas al rediseño sin bajar lo que cuidan) + las nuevas
      (879 tras la revisión).

## Fuera de alcance
Lógica, flujos, servidor, base de datos. Nada llama a Google.

## Impacto
- Datos / migración: no. Costo Google Maps: 0. Estética del mapa web (OpMap): no cambia.

## Plan (archivos)
`lib/paleta.ts`, `lib/ui.tsx` (Texto, Titulo, Subtitulo, Seccion, Pantalla, Tarjeta, Bloque, FilaLista, BordeHoja,
Boton, BotonIcono, Chip, Insignia, Aviso, Barra, Campo), `app/(app)/_layout.tsx` (encabezado y barra),
`lib/navegacion.ts` (SIN_ENCABEZADO), `lib/iconos-nombres.ts`, `lib/croquis.ts`, `components/Croquis.tsx` y cada
pantalla (Hoy, Reportar y sus tarjetas, Mi agenda, Agendar, Días libres, Números) con sus componentes.

## Verificación final
`npm run check` en `mobile/`, `npx expo export --platform ios` y capturas 390×844 antes/después con la API falsa.
