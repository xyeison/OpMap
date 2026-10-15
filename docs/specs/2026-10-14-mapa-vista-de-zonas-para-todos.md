# Spec: "Ver por zonas" en el mapa para todos, con selector en la leyenda  (2026-10-14)

**Estado**: aprobada por el dueño (pedido del 2026-10-14)

## Problema

El dueño, con sus palabras: "Las líderes solamente ven las zonas que tienen asignada una persona… yo quiero
mostrarles todas las zonas que se determinaron, cómo se distribuyen. Que en la leyenda, donde está el mapa, podamos
tener como un booleano: vista por zonas o por ejecutivos comerciales, y que cambie el mapa y se vean todos los colores
de las distintas zonas". Hoy la vista de zonas existe, con el color de cada zona según `kams.color`, pero solo la ve
quien tiene `map:all-lines`. Las líderes de línea y los Ejecutivos Comerciales solo ven la vista por línea.

## Resultado esperado

- **Selector:** la leyenda del mapa tiene un selector visible "Ver por: Ejecutivos Comerciales | Zonas".
  - Con "Ejecutivos Comerciales" el mapa queda como hoy, por línea y con el selector de línea.
  - Con "Zonas", cada zona activa aparece con su color, en sus municipios, IPS e insignia, sin importar quién la cubre
    ni la línea.
- **Quién ve "Zonas":** todo el que tiene `map:view`, no solo `map:all-lines`.
- **Qué no muestra la vista de zonas:** a quien no tiene `map:all-lines` no le muestra datos de la cobertura de líneas
  que no ve, es decir, quién cubre qué en otras líneas. Solo muestra la división en zonas que hizo el algoritmo y los
  datos de las IPS que ya ve hoy.
- **Lo que no cambia:**
  - La vista por línea, los colores, las opacidades, los marcadores y los racimos, salvo el selector nuevo.
  - El filtro de la vista de zonas, que es por zona.
  - La URL `?mode=zones`.

## Criterios de aceptación

- [ ] Una líder de línea y un Ejecutivo Comercial ven el selector y pueden pasar a "Zonas". Los colores son los de
      `kams.color` y salen todas las zonas activas.
- [ ] En "Zonas", la respuesta de la API para quien no tiene `map:all-lines` no trae la cobertura ni los nombres de
      Ejecutivos Comerciales de líneas que esa persona no ve. Esto se prueba en `web/scripts/*-check.ts`.
- [ ] Volver a "Ejecutivos Comerciales" deja la línea elegida o la primera de sus líneas.
- [ ] Capturas de escritorio y de celular de las dos vistas, para admin y para una líder de línea. En celular el
      selector cabe y el mapa conserva sus reglas propias.

## Fuera de alcance

Cambiar colores de zona, el modo Regiones, recalcular la cobertura y la vista por línea.

## Impacto

Sin migración. Costo de Google: 0. **Estética del mapa: cambia la leyenda**, con un selector nuevo. Lo autorizó el
dueño el 2026-10-14 y queda anotado en `docs/mapa-estetica.md`. Permisos: la vista de zonas pasa de `map:all-lines` a
`map:view`.

## Verificación final

`GOOGLE_ROUTES_DISABLED=true npm run check` y capturas de escritorio y de 390 px.

## Pendientes del dueño (salieron al verificar)

- **Textos de tarjetas y tooltips** en la vista de zonas para quien no tiene `map:all-lines`: "Ejecutivo Comercial
  (tus líneas)", "ninguno" y "sin Ejecutivo Comercial de tus líneas". No los pidió el dueño: son consecuencia de no
  mandar personas de otras líneas, porque "sin ejecutivo local" sería falso donde vive alguien de otra línea. Falta
  que el dueño los confirme o pida otra redacción (`docs/mapa-estetica.md`).
- **Contratos en `/api/map/data`**: la vista de zonas no los da a quien antes no abría el mapa (sin líneas) y no tiene
  `contracts:view`. Queda un hueco anterior que no se tocó: `viewer`, `data_manager` y un `user` con línea reciben el
  valor y el proveedor de los contratos sin `contracts:view`. El dueño decide si se cierra.
