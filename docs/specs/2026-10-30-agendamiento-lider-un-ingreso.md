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
  - con la cookie de una líder (`campo:app`), responde `{ token, expira_at, usuario, ejecutiva }`, el mismo formato del
    login móvil;
  - con la cookie de otro rol (Ejecutivo Comercial, dirección, administrador…) → 403: entran a la app con su contraseña
    (revisión 2026-10-30; con `hasPermission` el administrador pasaría, por eso se mira el permiso del rol);
  - solo con el portador, o sin nada → 401 (no sirve para alargar un token); usuario inactivo o contraseña cambiada → 401;
  - desde otro origen (también `Sec-Fetch-Site: same-site`) → 403.
- [ ] La app, en el navegador:
  - sin token, pide `sesion-app` antes de mandar al ingreso (espera como mucho `TIEMPO_ME_MS`; si no puede guardar el
    token, sigue como sin sesión);
  - inicia sesión con `cliente: 'campo-web'`;
  - al salir llama `/api/auth/logout`; si no llegó (sin señal), deja la marca `opmap.salida-pendiente.v1`: mientras
    exista no entra sola con la cookie y, al abrir, vuelve a avisar. Se quita al lograrlo o con un ingreso nuevo (en la
    app o en OpMap);
  - sus peticiones de datos van **sin la cookie** de la web (`credentials: 'omit'`); solo el login, `sesion-app` y el
    logout la llevan. Así el servidor responde siempre como la persona del token, aunque otra haya entrado en OpMap en
    otra pestaña, y lo de Ejecutivo Comercial (cuota, días libres) sigue cerrado como en el teléfono (`sesionDeLaApp`);
  - si otra pestaña borra el token (OpMap al entrar o salir, u otra pestaña de la app), esta se cierra con aviso; si lo
    cambia por otro, se abre con ese (evento `storage`).

  En el teléfono no cambia nada (`mobile/scripts`).
- [ ] La web, al cerrar sesión y al iniciarla, olvida la sesión guardada de la app (`opmap.token.v1`, `opmap.perfil.v1`,
      el contexto del día `opmap.contexto.v1` y la marca `opmap.salida-pendiente.v1`), pero no su cola. Si su propio
      logout no llegó al servidor, deja la marca.

## Fuera de alcance
- El diseño tipo Uber de la web: va en su propia spec.
- La app en el teléfono (Expo Go) sigue con su token propio.

## Impacto
- Datos o migración: no.
- Costo Google Maps: 0.
- Estética del mapa: no cambia.
- **Seguridad:**
  - `sesion-app` exige la cookie (SameSite=Lax), el mismo origen y el permiso `campo:app` del rol, y devuelve el mismo
    token de la cookie: no da más permisos ni más tiempo. La cookie httpOnly de los demás roles nunca se vuelve un token
    legible desde la página.
  - El token de la app en el navegador ya vivía en localStorage.
- **Permisos:** nuevo `campo:app` (solo `line_leader`), en `web/lib/permissions.ts` y en
  `web/docs/ROLES_AND_PERMISSIONS.md`.

## Plan
`docs/planes/2026-10-30-agendamiento-lider-un-ingreso.md`.

## Verificación final
- `npm run check` en `web/` y en `mobile/`.
- Captura del menú de una líder (servidor local con datos falsos) y de la app abriendo la agenda sin volver a pedir el
  ingreso.
