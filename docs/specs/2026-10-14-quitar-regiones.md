# Spec: quitar las Regiones de la web  (2026-10-14)

**Estado**: aprobada por el dueño (pedido del 2026-10-14: "Eso de región deberíamos quitarlo al fin")

## Problema

Las Regiones vienen de una versión anterior, en la tabla `zones` y la columna `kams.zone_id`. Hoy hay 5 Regiones en
la base y ninguna de las 16 zonas tiene una asignada. El 2026-10-14 se borró su página `/zones`, pero quedan:
- el botón "Por Regiones" y la columna o el selector de Región en Zonas (`/kams`, `KamZoneModal`);
- el modo Regiones del mapa, con `?viewMode=zones` en `lib/map-view.ts`, `MapComponent` y la leyenda;
- las rutas `/api/zones/**` y `/api/kams/zone`, y las cifras por Región de `/api/kams/stats`;
- los permisos `zones:view` y `zones:edit`.

## Resultado esperado

En la web ya no aparecen Regiones en ninguna parte: ni en Zonas, ni en el mapa, ni en el menú, ni en la API. La vista
de zonas del mapa, con `?mode=zones` y los colores de cada zona, no cambia. Nada más del mapa cambia. Quitar el modo
Regiones lo autorizó el dueño en este pedido.

## Criterios de aceptación

- [x] `grep` sin "Región", "Regiones" ni "Por Regiones" en texto visible de `web/app` y `web/components`, salvo
      documentos históricos (`menu-check`, sección 8; solo quedan en comentarios).
- [x] No existen las rutas `/api/zones/**` ni `/api/kams/zone`. `/api/kams/stats` no lee `zones` (`menu-check`,
      sección 8: rutas de la API y "nadie lee la tabla zones").
- [x] `?viewMode=zones` en `/map` no hace nada y no carga regiones. La vista de zonas (`?mode=zones`) sigue igual
      (`mapa-zonas-api-check`, "Sin Regiones" y reglas de `resolveMapView`).
- [x] Los permisos `zones:view` y `zones:edit` salen de `lib/permissions.ts` y de los roles. Ningún otro permiso
      cambia. Las pruebas del menú y de los permisos siguen en verde (`menu-check`, sección 8; comparación de
      `rolePermissions` contra `master`: solo salen `zones:*` de admin, sales_manager, line_leader,
      commercial_director y data_manager, nadie gana nada).
- [x] `GOOGLE_ROUTES_DISABLED=true npm run check` en verde (hecho el 2026-10-14) y capturas de Zonas (`/kams`) y
      del mapa (por línea y `?mode=zones`) en escritorio y a 390 px, con sesión de admin en el servidor local (en el
      PR).

## Fuera de alcance

Borrar la tabla `zones` o la columna `kams.zone_id` de la base. Si el dueño lo pide, va en una migración aparte con su
rollback. Tampoco se cambian la vista por línea ni la vista de zonas.

## Impacto

Sin migración. Costo de Google: 0. Estética del mapa: se quita el modo Regiones, con autorización del dueño. Permisos:
salen `zones:view` y `zones:edit`.
