# Spec: Bogotá en 4 sectores por localidad  (2026-10-28)

**Estado**: aprobada por el dueño (2026-10-28: "Si, hazlo. Norte, Occidente, Sur y Oriente.")

## Problema
Dentro de Bogotá cada IPS va a la Zona cuyo punto base llega más rápido por carretera (Google, una medición del
2025-08-07); fuera de Bogotá decide el corredor de salida. Con dos reglas distintas el mapa queda partido: Chapinero
azul, Usaquén verde (sus 32 IPS van a Engativá por 2 minutos: 24 contra 26 en promedio) y Chía azul otra vez (corredor
norte → Chapinero). Las camas también quedan desparejas: Kennedy 2.001, San Cristóbal 4.509, Chapinero 5.411,
Engativá 5.716. El dueño pidió un reparto "equitativo y visualmente razonable", Bogotá en cuatro.

## Resultado esperado
- Cada localidad pertenece a un sector fijo, y el sector es el mismo corredor que ya usan los municipios de afuera:
  - **Norte**: Usaquén.
  - **Occidente**: Suba, Engativá, Fontibón, Barrios Unidos, Teusaquillo.
  - **Sur**: Kennedy, Bosa, Ciudad Bolívar, Tunjuelito, Puente Aranda, Los Mártires, Antonio Nariño.
  - **Oriente**: Chapinero, Santa Fe, La Candelaria, San Cristóbal, Rafael Uribe Uribe, Usme, Sumapaz.
- Una IPS de Bogotá va a la Zona que recibe el corredor de su localidad (`bogota_config.grupos`), sin minutos ni tope.
  Va después de las forzadas y antes del territorio base y de la competencia por tiempo.
- Fuera de Bogotá no cambia nada: Bogotá compite como una ciudad y la celda la decide el corredor del municipio.
- Las cuatro Zonas se llaman **Bogotá Norte** (hoy Chapinero), **Bogotá Occidente** (Engativá), **Bogotá Sur**
  (Kennedy) y **Bogotá Oriente** (San Cristóbal). Conservan su color, su punto base y su gente.
- Camas con los datos de hoy: Norte 4.348, Occidente 4.459, Sur 4.255, Oriente 4.575.
- En el mapa, cada sector queda de un solo color. Las localidades sin IPS van con su sector (corredor), por encima de
  la zona residente.

## Criterios de aceptación (se convierten en pruebas)
- [ ] La tabla de sectores tiene las 20 localidades exactamente como arriba.
- [ ] Con k = 4: una IPS de Usaquén va a la celda del Norte aunque la de Occidente llegue antes. Una de la localidad
      de Chapinero va a la de Oriente aunque sea el territorio base de la celda del Norte. Tipo `bogota_corredor`,
      con `detail.corredor` y `detail.localidad`.
- [ ] Con k = 2 (Norte + Oriente juntos), las IPS de Usaquén y de Chapinero van a la misma celda.
- [ ] Una asignación forzada de la localidad sigue mandando.
- [ ] Sin regla de Bogotá, IPS sin localidad o con la celda del sector inactiva: se aplica la regla de siempre
      (territorio base y minutos).
- [ ] Fuera de Bogotá, las IPS y los municipios no cambian (pruebas de corredor existentes).
- [ ] La asignación de una IPS nueva (`assign-to-kam`) aplica el sector igual que el recálculo completo.
- [ ] Mapa: una localidad sin IPS va con su sector aunque tenga zona residente. La insignia de cada Zona de Bogotá
      muestra su sector (N, Oc, S, Or), no la localidad del punto base.

## Punto base del Norte en Usaquén (autorizado: "Recalculalo asumo el costo")
- El punto base de Bogotá Norte estaba en Chapinero, que queda en el Oriente. Pasa a Usaquén: area_id 1100101,
  base_city "Usaquén" y el centro de sus 32 IPS activas (4.706782, -74.039973). Lo hace la migración 0903, que
  respalda el punto y los tiempos anteriores; el rollback es la 9954.
- Sus tiempos se rehacen desde el punto nuevo con `scripts/zona-punto-base-tiempos.ts --run` (dry-run: 676 IPS +
  795 municipios = 1.471 elementos, 60 peticiones, 7,36 USD). Después se recalcula, sin Google.
- `CELDA_AREA_POR_CORREDOR.norte` pasa a 1100101 (grupos por defecto).
- Los otros tres puntos base ya quedan dentro de su sector (Engativá, Kennedy y San Cristóbal) y no se mueven.

## Fuera de alcance
- Los polígonos del DANE (bordes reales), que el dueño dejó para después.
- Editar los sectores desde la interfaz: la tabla vive en el código (`bogota_corredores` solo acepta municipios).

## Impacto
- Datos: la migración 0902 renombra las 4 Zonas (con respaldo y rollback 9953) y la 0903 mueve el punto base del
  Norte a Usaquén (con respaldo y rollback 9954). Después se recalculan IPS y municipios, sin Google, con respaldo de
  `assignments`.
- Costo Google Maps: 1.471 elementos ≈ 7,36 USD, solo para los tiempos del Norte desde Usaquén (autorizado).
- Estética del mapa: sin cambios de colores, opacidades ni capas. Cambia qué localidades pinta cada Zona y el texto de
  las cuatro insignias de Bogotá, ambas cosas por el reparto y los nombres aprobados.
- Permisos y roles: ninguno.

## Plan (archivos e interfaces)
- `web/lib/bogota-corredores.ts`: `CORREDOR_DE_LOCALIDAD` con las 20 localidades (sectores).
- `web/lib/opmap-algorithm-simplified.ts`: `bogotaSectorCell` (pura) y una fase "Bogotá por sectores" entre las
  forzadas y el territorio base.
- `web/app/api/hospitals/assign-to-kam/route.ts`: el mismo paso antes del territorio base.
- `web/lib/territory-rules.ts`: `zonaDeLocalidadSinIps` con el orden corredor > residente > Zona que gana Bogotá.
- `web/components/MapComponent.tsx` y `ZoneBadgeIcon.ts`: insignias de sector; nombres en los racimos.
- `web/lib/bogota-admin.ts` y la ficha de la IPS: texto "Bogotá, sector Norte → Bogotá Norte".
- `web/components/BogotaConfigCard.tsx`: el texto ya no dice "dentro de Bogotá nada cambia".
- Pruebas: `web/scripts/bogota-check.ts` (sección 6 nueva y ajustes de la 5) y `web/scripts/municipios-check.ts`.
- Documentos: `docs/algoritmo-asignacion.md`, `docs/mapa-estetica.md`, `CLAUDE.md` y la decisión
  `docs/decisiones/2026-10-28-bogota-4-sectores.md`.

## Verificación final
- `npm run check` en verde.
- Simulación del recálculo antes de guardar (`scripts/fase1-recalculate.ts` sin `--yes`), con camas por Zona.
- Captura del mapa de Bogotá y Sabana Norte (escritorio y celular) con Usaquén y Chía del mismo color.
