# 2026-10-30 – La app de campo es solo para las líderes: los Ejecutivos Comerciales siguen en VMO y el Excel de las líderes ya no se sube

**Contexto**:
- El 2026-10-29 el dueño pidió "una herramienta que sea utilizada por las líderes para que les reporten esto a la
  directora comercial" y añadió que "las visitas médicas van a seguir siendo reportadas por VMO hasta que tengamos la
  solución".
- La app de F1b tenía dos cosas que no seguían esa regla:
  - le ofrecía a Paola "Como Ejecutivo Comercial";
  - `/lideres` tenía "Subir el Excel", para que la directora siguiera cargando el Excel "Tracker Líderes".
- El 2026-10-30 el dueño las corrigió: "por qué dejaste una opción para importar excel de visitas de líderes… esto solo
  será para líderes porque los comerciales van por VMO".

**Decisión**:
1. **La app de campo (VG Visitas) es solo para las líderes de negocio.**
   - Quien solo es Ejecutivo Comercial no entra a las pestañas: ve "Las visitas de los Ejecutivos Comerciales se
     registran en VMO" y "Cerrar sesión".
   - Sus visitas siguen llegando al mapa de calor por el importador de VMO, en `/visits`
     (`2026-10-29-visitas-vmo-mapa-de-calor.md`).
2. **Paola (líder y Ejecutiva Comercial) usa la app solo como líder**: solo con sus líneas de líder, sin "Como Ejecutivo
   Comercial", sin cuota y sin días libres. Lo de Ejecutiva lo registra en VMO.
3. **El Excel "Tracker Líderes" ya no se sube en `/lideres`.** Esto reemplaza el punto 3 de
   `2026-10-29-historico-tracker-lideres.md`.
   - Su histórico se carga una sola vez, con `web/scripts/lideres-historico-cargar.ts` (lo corre Claude).
   - Lo nuevo, las líderes lo planean y reportan en la app.
   - `/lideres` queda con las vistas del histórico.

**Consecuencias**:
- **La regla la pone el servidor, no solo la app.**
  - `/api/auth/me` no da persona a quien solo es Ejecutivo Comercial, y dice por qué en `sin_persona`.
  - `/api/me/*` le responde 403 con ese mensaje.
  - A Paola le da solo su papel de líder.
  - Agendar u "otra fecha" "como Ejecutivo Comercial" da 403, y sin `como` la cita va como líder.
- **Para devolver a los Ejecutivos Comerciales a la app**, el servidor tiene `APP_CAMPO_EJECUTIVOS=true`. Con él entran
  como antes. Lo usan las pruebas de F3 y F4, y servirá el día en que la app reemplace a VMO. En producción no está.
- **La base no cambia**: la 0850 sigue conociendo los dos papeles. Lo de Ejecutivo Comercial en la app (cuota, días
  libres, "Como Ejecutivo Comercial") queda dormido.
- **Lo que falta para dejar el Excel del todo**:
  - **F2**: correría, congreso, cena y capacitación. Hasta entonces, en la app las líderes agendan y reportan visitas a
    médicos e institucionales.
  - **F4** (`/equipo`): la directora verá ahí lo que las líderes hacen en la app; hoy `/lideres` muestra el histórico.
- **Descartado**: una carga del Excel que se repita, y que la app reciba las visitas de los Ejecutivos Comerciales
  mientras exista VMO.

**Dónde vive en el código**:
- **Reglas** (`web/lib/persona-campo.ts`): `appSoloLideres`, `lineasDeLaApp`, `comoDeLaApp` y `MENSAJE_EJECUTIVO_EN_VMO`.
- **Servidor**:
  - `web/app/api/config-visitas/_lib/visitas-server.ts` (`personaDeCampo`);
  - `web/app/api/auth/me/route.ts` (`sin_persona`);
  - `web/app/api/me/agenda/route.ts` y `web/app/api/me/agenda/[id]/otra-fecha/route.ts`.
- **App**: `mobile/lib/persona.ts` (`estadoPersona` 'fuera' y `avisoFuera`) y `mobile/app/(app)/_layout.tsx`.
- **`/lideres`**: `web/components/lideres/SeguimientoLideres.tsx` (sin la carga), `web/app/api/lideres/historico/route.ts`
  (solo GET) y `web/scripts/lideres-historico-cargar.ts` (la carga única).
- **Pruebas**:
  - `web/scripts/persona-campo-check.ts` (sección 7);
  - `web/scripts/reporte-api-check.ts` (sección 16);
  - `web/scripts/lideres-historico-check.ts`;
  - `mobile/scripts/checks/21-persona.ts`.
