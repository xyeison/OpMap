# Spec: el consultorio del médico pide la dirección y se ubica con ella  (2026-10-31)

**Estado**: aprobada por el dueño (2026-10-31: "Cuando se crea el consultorio del doctor debería pedir la dirección y
determinar esa georeferenciación") | implementada (PR pendiente)

## Problema
Al crear el consultorio de un médico (cuenta de clase `consultorio` con su sede principal) la app no pide la
dirección: el consultorio queda con el GPS del teléfono si la líder está en el sitio y, si no, **sin ubicación**. En
la web el formulario tiene el campo "Dirección" pero es opcional y nadie lo usa para ubicar la sede. Resultado: la
mayoría de los consultorios quedan sin coordenadas, sin marca `en_sitio` en las visitas y sin ubicación que el equipo
de datos pueda confirmar.

## Resultado esperado
- Crear un consultorio (app y web) **exige la dirección** (calle, número, barrio…) del consultorio.
- El servidor la **geocodifica con Google** (una petición, 0,005 USD) junto con el municipio y el departamento, y
  **solo si hay certeza** guarda las coordenadas: resultado de Google con `location_type` `ROOFTOP` o
  `RANGE_INTERPOLATED`, sin `partial_match`, y a menos de 40 km del centro del municipio elegido. Sin certeza (o sin
  Google: `GOOGLE_ROUTES_DISABLED=true`, sin clave, error de red), el consultorio se crea igual, con su dirección y
  **"sin ubicar"**, nunca con una coordenada aproximada (ni el centro del municipio).
- Si la líder está en el sitio (la app manda el GPS), el GPS manda y no se llama a Google.
- La sede nace con `ubicacion_confirmada = false` en todos los casos (como hoy): el equipo de datos la confirma desde
  la web y hasta entonces la visita en ese consultorio "no suma" (decisión 9 del 2026-10-12, sin cambio).
- La respuesta dice qué pasó (`geocodificacion: { ubicada, motivo }`) y la app lo muestra: "Consultorio ubicado por su
  dirección" o "quedó sin ubicar: el equipo de datos lo ubicará".

## Criterios de aceptación (se convierten en pruebas)
- [ ] `POST /api/terceros/cuentas` con `clase: 'consultorio'` sin `sede.direccion` → 400 "Escribe la dirección del
      consultorio", también con GPS (la dirección es el dato del consultorio), pero DESPUÉS del 409 de cuenta repetida:
      un consultorio que ya existe se reutiliza sin escribirla (la app y la web muestran "usar esa cuenta"). Por eso la
      exige la ruta y no `cuentaCreateSchema` (los formularios validan con el esquema antes de enviar). Con otra clase la
      dirección sigue opcional.
- [ ] Consultorio con dirección y sin GPS, con Google deshabilitado → 201, sede sin coordenadas,
      `geocodificacion.ubicada = false`, `motivo = 'deshabilitado'`; no sale ninguna petición a Google.
- [ ] Consultorio con dirección, Google responde UN resultado `ROOFTOP` a 2 km del centro del municipio → 201 con lat/lng
      de Google (6 decimales), `origen 'manual'`, `ubicacion_confirmada = false`, `geocodificacion.ubicada = true`.
- [ ] Varios resultados (dirección ambigua) o municipio sin centro conocido → sin certeza: sin coordenadas.
- [ ] Google responde `APPROXIMATE`, o `partial_match`, o un punto a 80 km del centro, o `ZERO_RESULTS` → 201 sin
      coordenadas y `ubicada = false` con su motivo (`sin_certeza`, `lejos`, `sin_resultado`).
- [ ] Consultorio con GPS (`sede.lat/lng`) y dirección → se guarda el GPS y NO se llama a Google.
- [ ] La URL a Google lleva `address`, `components=country:CO`, `region=co`, `language=es`; la clave nunca va a logs.
- [ ] Nuevo médico (app): "Dirección del consultorio" obligatoria antes de "Crear consultorio"; el aviso dice si
      quedó ubicado.
- [ ] Nuevo médico (web, `CuentaForm` con `clasePreset="consultorio"`): la validación del formulario exige la
      dirección (mismo `cuentaCreateSchema`).

## Fuera de alcance
- Geocodificar otras sedes (clínicas, EPS) por dirección: siguen la regla del 2026-10-11 (por nombre y con certeza,
  pendiente D4). Esta spec solo cubre el consultorio, cuya dirección la escribe la líder.
- Confirmar la ubicación automáticamente: sigue siendo del equipo de datos (`terceros:manage`).
- Corregir consultorios ya creados sin ubicación (se pueden editar en la web; un script masivo sería otro dry-run).

## Impacto
- Datos / migración: no (la sede guarda `direccion`, `lat`, `lng` en columnas que ya existen; `origen` sigue `manual`).
- Costo Google Maps: **1 petición de Geocoding por consultorio creado con dirección y sin GPS ≈ 0,005 USD**. Volumen
  esperado: unos pocos por semana (menos de 1 USD al año). `GOOGLE_ROUTES_DISABLED=true` lo apaga. Autorizado por el
  dueño con el pedido del 2026-10-31.
- Estética del mapa: no cambia (las sedes no van al mapa).
- Permisos / roles: ninguno nuevo (`terceros:create`).
- Regla de negocio: cambia la decisión b del 2026-10-11 ("queda descartado geocodificar una dirección") solo para la
  dirección del consultorio escrita por la líder: `docs/decisiones/2026-10-31-consultorio-por-direccion.md`.

## Plan (archivos e interfaces)
- `web/lib/google-geocode.ts` (nuevo): `evaluarGeocodificacion` (pura: certeza y distancia al centro) y
  `geocodificarDireccion` (una petición; `fetchImpl` inyectable; respeta `GOOGLE_ROUTES_DISABLED`; sin clave → sin
  ubicar). Segundo archivo que llama a Google (CLAUDE.md lo lista).
- `web/lib/terceros-schemas.ts`: `faltaDireccionDeConsultorio` (puro); la ruta lo aplica después del 409. Revisor
  2026-10-31: no va en el esquema para no tapar el 409 en los formularios ni en una app en caché.
- `web/app/api/terceros/cuentas/route.ts`: geocodifica el consultorio; responde `geocodificacion`.
- `web/app/api/terceros/_lib/terceros-server.ts`: `municipioParaUbicar` (nombre, centro, departamento).
- `web/scripts/geocode-check.ts` (nuevo, en `npm test`) y casos nuevos en `terceros-api-check.ts`.
- `mobile/lib/tipos.ts`, `mobile/app/(app)/medico/nuevo.tsx`: campo "Dirección del consultorio", aviso del resultado.
- `mobile/scripts/checks/23-sede-del-medico.ts`: sección 23e.
- Docs: CLAUDE.md (Google y coordenadas), `docs/fases/fase6-visitas-f1-terceros.md`, decisión nueva.

## Verificación final
`npm run check` en `web/` y en `mobile/`; `geocode-check` con respuestas de Google simuladas (ROOFTOP, APPROXIMATE,
partial_match, lejos, ZERO_RESULTS, deshabilitado). Prueba real del dueño: crear un consultorio con dirección en la
app y ver en `/terceros` que la sede tiene coordenadas.
