# Spec: visitas de VMO al mapa de calor, solo efectivas y por Ejecutivo Comercial  (2026-10-29)

**Estado**: aprobada por el dueño ("Hazlo… Simplifica. Ejecuta.", 2026-10-29). Decisión:
`docs/decisiones/2026-10-29-visitas-vmo-mapa-de-calor.md`.

## Problema
El mapa de calor se quedó en octubre de 2025. Además, esas visitas tienen el día al azar, van a nombre de la Zona y no
de la persona, y el importador está apagado. El dueño: "solo requiero que se guarde las visitas georeferenciadas por
comercial y si ya no existe igual crear la persona… una llave… importar solo las visitas efectivas y ya".

## Resultado esperado
En `/visits` se sube el Excel de VMO › Visitas (Excel → Todo, cualquier rango) y, tras un resumen, el mapa de calor
muestra esas visitas efectivas con su fecha real, por persona y por Zona. Subir otra vez el mismo período no duplica.

## Criterios de aceptación (scripts/vmo-visitas-check.ts, reporte-api-check.ts §13, ips-routes-check.ts §7)
- [x] Se lee el formato real de VMO: "22 Oct 2026 07:31:46", "Visita presencial-Presencial", coma decimal.
- [x] Solo entran las "Visita realizada" con un punto en Colombia y con ID; una por ID.
- [x] Lo que va al servidor tiene solo el ID, el Ejecutivo Comercial, la fecha, el punto y si fue presencial. Ni
      médico, ni cédula, ni teléfono.
- [x] La persona se reconoce por su llave, por su nombre sin tildes o por un nombre parecido único (nunca una vacante).
      Si no existe, se crea: activa si visitó en los últimos 60 días.
- [x] Las visitas se guardan con upsert por `vmo_id`: reimportar actualiza y no duplica. No se borra nada y las
      visitas de la app quedan intactas.
- [x] Sin `visits:manage`, 403. Con el formato viejo (mes y año), 400 sin escribir.
- [x] Sin `visits:view`, `/api/visits/filtered` da la zona en vez del nombre de la persona.
- [x] El selector de año del mapa va de 2024 al año en curso y arranca en el mes en curso.

## Fuera de alcance
La IPS de cada visita: `/visits/coverage` deja de contar las de VMO. Los médicos y clientes de VMO. Una conexión
automática con VMO: su API no es pública y depende de la sesión de un usuario.

## Impacto
- Datos / migración: sí. `2026-10-29_0910_visitas_vmo.sql` crea `visits.vmo_id` y `executives.vmo_nombre`, y borra
  las 7.033 visitas viejas con respaldo. Rollback: `2026-10-29_9956_visitas_vmo_rollback.sql`.
- Costo Google Maps: 0.
- Estética del mapa: no cambia (solo el año y el mes por defecto del filtro de visitas).
- Permisos: igual (`visits:manage` importa; `visits:view` ve los nombres).

## Plan (archivos e interfaces)
- `web/lib/vmo-visitas.ts`: lectura del Excel, llaves, emparejar y validar (puro).
- `web/app/api/visits/_lib/importar-vmo.ts` + `web/app/api/visits/import/route.ts`: `POST` por lotes de 1.000.
- `web/app/visits/page.tsx`: subir, resumen, importar y resultado. Se quitan plantilla, mes y año, e historial.
  Se borra `web/app/api/visits/imports/route.ts`.
- `web/app/api/visits/filtered/route.ts` + `_lib/visitas-mapa.ts`: zona en vez de persona sin `visits:view`.
- `web/components/MapControls.tsx`: años y mes por defecto.

## Verificación final
`npm run check`. Migración aplicada y carga inicial (agosto de 2024 a hoy: 23.914 visitas, 16 personas) desde
`/visits`, con conteos en la base y captura del mapa de calor del mes en curso.
