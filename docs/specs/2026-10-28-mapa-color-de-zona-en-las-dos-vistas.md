# Spec: el mapa usa el color de la Zona también en la vista por Ejecutivos Comerciales  (2026-10-28)

**Estado**: aprobada por el dueño en el chat (2026-10-28) · implementada en la rama `feat/mapa-color-de-zona`

## Problema
Pedido literal del dueño: "Porque los colores cambian para mapa de ejecutivo comerciales y Zonas. Deberia ser el mismo.
Maneja el mismo color de Zonas."

Hoy el mapa tiene dos fuentes de color: en la vista de Zonas cada Zona va con su color (`kams.color`); en la vista por
Ejecutivos Comerciales (por línea) cada Zona va con el color de la persona que la cubre (`executives.color`) y, si esa
persona cubre varias Zonas, con un tono por Zona (`zoneTint`). Al cambiar de vista, la misma Zona cambia de color; y
las 4 Zonas de Bogotá, cubiertas por una sola persona en cada línea, salen en tonos de un mismo color que casi no se
distinguen (ΔE mínimo 2,2–3,7 en los municipios de alcance).

## Resultado esperado
- En la vista por Ejecutivos Comerciales, una Zona cubierta (local, alcance o manual) se pinta con el color de la Zona,
  igual que en la vista de Zonas: polígonos, puntos de IPS, insignia, tarjeta y rayado de "sin equipo".
- Los estados de la línea no cambian: "Sin cobertura" en gris con un tono por Zona (2026-10-23), conflicto en ámbar,
  IPS sin Zona en pizarra, fuera de alcance / sin acceso terrestre / pendiente como hoy.
- Leyenda de la vista por línea: cada Ejecutivo Comercial con un chip del color de su Zona (la que cubre como local; si
  no, la primera de sus Zonas en orden de ciudad base) y, si cubre varias, una mini-muestra por Zona con el color de cada
  Zona. El filtro por Ejecutivo Comercial usa el mismo chip.
- Racimos: con un solo color entre sus Zonas, ese color; con Zonas de colores distintos, neutro (como en la vista de
  Zonas); todas sin cobertura, hueco pizarra (como hoy).
- Se deja de usar `executives.color` en el mapa (sigue guardado; no se borra) y se quitan los tonos por Zona.

## Criterios de aceptación
- [x] Una Zona cubierta tiene el mismo color en las dos vistas (prueba pura del color de Zona en la línea).
- [x] Sin cobertura → gris de la Zona; conflicto → ámbar; sin datos → gris claro de siempre.
- [x] Chip del Ejecutivo Comercial: Zona local; si no tiene local, la primera por ciudad base; sin Zonas, gris de
      respaldo.
- [x] Racimo: color único → ese color; colores distintos → neutro; todas sin cobertura → hueco.
- [x] Capturas de la vista por línea (escritorio y celular): Bogotá con sus 4 colores, como en la vista de Zonas.

## Fuera de alcance
Opacidades, bordes, capas, marcadores, insignias y globos: sin cambios. Los colores de `executives.color` en otras
páginas (/executives, /kams) no cambian.

## Impacto
- Datos / migración: no. Costo Google: 0. Permisos: ninguno.
- Estética del mapa: cambia la fuente de color de la vista por línea (autorización explícita del dueño en el chat).

## Plan
- `web/components/mapStyles.ts`: funciones puras `colorDeZonaEnLinea` y `colorDeEjecutivoEnLinea`; se quitan `zoneTint`
  y sus constantes.
- `web/components/MapComponent.tsx`: `zoneLineColor`, leyenda, filtro, racimos y patrones de "sin equipo" con el color de
  la Zona; sin `executiveColors` ni `zoneTone.color` (el orden "zona 2 de 4" de la tarjeta se mantiene).
- `web/components/ZoneBadgeLayer.tsx`: racimo con un solo color → ese color; si no, neutro.
- `web/scripts/mapa-estilo-check.ts`: pruebas de las funciones nuevas.
- `docs/mapa-estetica.md` y decisión `docs/decisiones/2026-10-28-mapa-un-color-por-zona.md`.

## Verificación final
`npm run check` y capturas en escritorio y celular de las dos vistas.
