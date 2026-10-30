# Plan: Agendamiento de la líder y un solo ingreso  (2026-10-30)

Spec: `docs/specs/2026-10-30-agendamiento-lider-un-ingreso.md`. Primero va la prueba que falla (TDD) y después el código.

1. **Permiso y menú (web)**
   - Prueba en `web/scripts/menu-check.ts`: el menú de `line_leader` empieza con "Agendamiento" → `/campo/agenda`; los
     demás roles no lo tienen.
   - `web/lib/permissions.ts`: el permiso `campo:app`, que solo tiene `line_leader`, y el ítem al principio del menú.
   - `web/components/NavigationWithPermissions.tsx`: lo que va a `/campo` usa `<a>`, no `Link` (página completa).
   - `web/docs/ROLES_AND_PERMISSIONS.md`: el permiso.
2. **Login de la app web (servidor)**
   - Prueba en `reporte-check.ts`: con `cliente: 'campo-web'`, el cuerpo del móvil y además Set-Cookie.
   - `web/app/api/auth/login/route.ts` y el esquema del login: el cliente `campo-web`.
3. **`POST /api/auth/sesion-app` (servidor)**
   - Pruebas en `reporte-check.ts`:
     - con cookie → 200 con el token de la cookie;
     - solo con portador o sin nada → 401;
     - con Origin de otro sitio o `Sec-Fetch-Site: cross-site` → 403.
   - La ruta nueva, con la forma `LoginMovilResponse`.
4. **App (`mobile/`)**
   - Pruebas en `mobile/scripts/checks/21-persona.ts` (o una sección nueva):
     - `clienteDeLogin(esWeb)`: 'campo-web' en la web y 'movil' en el teléfono;
     - `probarSesionDeLaWeb({ esWeb, token })`;
     - Ajustes en la web con "Ir a OpMap".
   - `lib/api.ts`: el cliente del login y `sesionDeLaWeb()`.
   - `lib/sesion.ts`: en el arranque, si es web y no hay token, intenta `sesion-app` antes de "sin_sesion".
   - `app/(app)/ajustes.tsx`: "Ir a OpMap" solo en la web.
5. **Web: olvidar la sesión de la app**
   - Prueba estática en `menu-check.ts` o `reporte-check.ts`: el logout y el login de `UserContext` quitan
     `opmap.token.v1` y `opmap.perfil.v1`, no la cola.
   - `web/contexts/UserContext.tsx`.
6. **Verificación**
   - `npm run check` en `web/` y en `mobile/`.
   - Capturas con el servidor local y datos falsos.
   - `revisor` sobre el diff y la spec, y PR con `/entregar`.
