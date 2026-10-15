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

## Criterios de aceptación
- [x] Tokens en `lib/paleta.ts` (colores claro/oscuro, croquis, `TAMANO`, `LETRA`, `SOMBRA`) con contrastes ≥ 4,5:1
      para todo texto sobre su fondo y ≥ 3:1 para lo que no es texto, en los dos modos (`scripts/checks/20-estilo.ts`).
- [x] Todo lo que se toca ≥ 44 pt; botón de 52; tope de texto grande 1,3 donde ya estaba.
- [x] Hoy y Reportar sin encabezado, con croquis y hoja; las demás pestañas con el encabezado blanco y el título grande.
- [x] Las 805 pruebas que había siguen en verde (4 ajustadas al rediseño sin bajar lo que cuidan) + las nuevas.

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
