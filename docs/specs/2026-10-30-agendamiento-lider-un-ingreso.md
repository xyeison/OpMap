# Spec: Agendamiento de la líder en OpMap, con un solo ingreso  (2026-10-30)

**Estado**: pedido del dueño del 2026-10-30, en brainstorming. El dueño dijo "Sí, hazlo todo" a esta forma.

## Problema
La líder tiene dos cosas separadas:
- **OpMap web** (`op-map-umber.vercel.app`), con su menú de solo consulta;
- **la app de campo** (`/campo`), donde agenda y reporta.

En el menú de OpMap nada lleva a su agenda. Además, cada una pide iniciar sesión aparte: la web guarda una cookie y la
app un token.

El dueño, el 2026-10-30:
- "En OpMap debe tener el líder el menú para su Agendamiento";
- "no debe sentir que está usando dos cosas distintas";
- "todo debe estar pensado para el celular" (el diseño común va aparte: `docs/specs/2026-10-30-diseno-uber-web.md`).

## Resultado esperado
- **El menú de OpMap de la líder empieza con "Agendamiento"**, que abre su agenda en la app (`/campo/agenda`).
  - Solo lo ve quien usa la app: las líderes, permiso nuevo `campo:app`.
  - Los Ejecutivos Comerciales no lo ven: van por VMO.
- **Un solo ingreso:**
  - quien inició sesión en OpMap y abre la app entra sin volver a escribir su contraseña;
  - quien inicia sesión en la app (en el navegador) queda también dentro de OpMap.
- **Cerrar sesión en cualquiera de las dos cierra las dos** en ese navegador. Lo que la app tenga en cola sin señal no
  se borra: se envía cuando vuelva a entrar, como hoy.
- **En la app web, Ajustes ofrece "Ir a OpMap"**, para volver a la web sin escribir la dirección.

## Criterios de aceptación (pruebas)
- [ ] El menú de `line_leader` empieza con "Agendamiento" → `/campo/agenda`, y ningún otro rol lo tiene
      (`web/scripts/menu-check.ts`).
- [ ] El menú abre `/campo/...` como página completa (enlace normal, no navegación interna de Next).
- [ ] `POST /api/auth/login` con `cliente: 'campo-web'` responde lo mismo que el móvil y además pone la cookie de la web
      (`web/scripts/reporte-check.ts`).
- [ ] `POST /api/auth/sesion-app`:
  - con la cookie de la web, responde `{ token, expira_at, usuario, ejecutiva }`, el mismo formato del login móvil;
  - solo con el portador, o sin nada → 401 (no sirve para alargar un token);
  - desde otro origen → 403.
- [ ] La app, en el navegador:
  - sin token, pide `sesion-app` antes de mandar al ingreso;
  - inicia sesión con `cliente: 'campo-web'`;
  - al salir llama `/api/auth/logout` (ya lo hace).

  En el teléfono no cambia nada (`mobile/scripts`).
- [ ] La web, al cerrar sesión y al iniciarla, olvida la sesión guardada de la app (`opmap.token.v1` y
      `opmap.perfil.v1`), pero no su cola.

## Fuera de alcance
- El diseño tipo Uber de la web: va en su propia spec.
- La app en el teléfono (Expo Go) sigue con su token propio.

## Impacto
- Datos o migración: no.
- Costo Google Maps: 0.
- Estética del mapa: no cambia.
- **Seguridad:**
  - `sesion-app` exige la cookie (SameSite=Lax) y el mismo origen, y devuelve el mismo token de la cookie: no da más
    permisos ni más tiempo.
  - El token de la app en el navegador ya vivía en localStorage.
- **Permisos:** nuevo `campo:app` (solo `line_leader`), en `web/lib/permissions.ts` y en
  `web/docs/ROLES_AND_PERMISSIONS.md`.

## Plan
`docs/planes/2026-10-30-agendamiento-lider-un-ingreso.md`.

## Verificación final
- `npm run check` en `web/` y en `mobile/`.
- Captura del menú de una líder (servidor local con datos falsos) y de la app abriendo la agenda sin volver a pedir el
  ingreso.
