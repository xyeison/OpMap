# 2026-10-31 – El consultorio del médico se crea con su dirección y se ubica con Google solo con certeza

**Contexto**: el dueño, tras ver que los consultorios creados desde la app quedaban sin ubicación (2026-10-31):
"Cuando se crea el consultorio del doctor debería pedir la dirección y determinar esa georeferenciación". La decisión
b del 2026-10-11 (`2026-10-11-sedes-reps-y-coordenadas.md`) descartaba geocodificar una dirección para ubicar una
sede, pensando en la dirección del REPS, que el dueño no considera confiable.

**Decisión**:
- Crear un consultorio (app y web) exige la **dirección** escrita por quien lo crea (no la del REPS).
- El servidor la **geocodifica con Google** (Geocoding API, una petición por consultorio, 0,005 USD) y guarda las
  coordenadas **solo con certeza**: UN solo resultado, `ROOFTOP` o `RANGE_INTERPOLATED`, sin `partial_match`, a menos
  de 40 km del centro del municipio elegido (sin centro conocido, no hay certeza). Sin certeza, el consultorio queda
  **"sin ubicar"** con su dirección guardada; nunca una coordenada aproximada ni el centro del municipio.
- La dirección la exige la API después de revisar si la cuenta ya existe (409): un consultorio que ya está se
  reutiliza sin escribirla.
- Si la app manda el GPS del sitio, el GPS manda y no se llama a Google.
- La confirmación de la ubicación sigue siendo del equipo de datos (`ubicacion_confirmada`), y la visita en una sede
  por confirmar sigue sin sumar hasta entonces (decisión 9 del 2026-10-12).
- Solo el consultorio: las demás sedes siguen la regla del 2026-10-11 (por nombre y con certeza, pendiente D4).

**Consecuencias**:
- Costo: 0,005 USD por consultorio creado con dirección y sin GPS; unos pocos por semana. `GOOGLE_ROUTES_DISABLED=true`
  lo apaga (el consultorio se crea igual, sin ubicar).
- `web/lib/google-geocode.ts` pasa a ser el segundo archivo que llama a Google (con `google-distance.ts`).
- Queda descartado: ubicar con el centro del municipio; aceptar resultados `APPROXIMATE` o `GEOMETRIC_CENTER`;
  geocodificar la dirección del REPS.

**Dónde vive en el código**: `web/lib/google-geocode.ts` (`evaluarGeocodificacion`, `geocodificarDireccion`),
`cuentaCreateSchema` (dirección obligatoria en el consultorio), `POST /api/terceros/cuentas`,
`mobile/app/(app)/medico/nuevo.tsx`. Pruebas: `web/scripts/geocode-check.ts`, `web/scripts/terceros-api-check.ts`
(sección 2), `mobile/scripts/checks/23-sede-del-medico.ts` (23e). Spec:
`docs/specs/2026-10-31-consultorio-direccion-geocodificada.md`.
