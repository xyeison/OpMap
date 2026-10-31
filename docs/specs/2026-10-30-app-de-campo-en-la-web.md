# Spec: la app de campo en la web (`/campo`)  (2026-10-30)

**Estado**: pedido del dueño del 2026-10-30, implementado en la rama `feat/campo-web`. Decisión: `docs/decisiones/2026-10-30-app-de-campo-en-la-web.md`.

## Problema
La app de las líderes (VG Visitas, Expo) solo se abre con Expo Go desde el computador del dueño. Las tiendas tardan:
- Apple pide cuenta de desarrollador y revisa cada versión;
- una cuenta nueva de Google Play exige una prueba cerrada de 14 días.

El dueño, el 2026-10-30: "yo quiero que tengamos una versión web. Porque la app móvil se demora en que me la aprueben".

## Resultado esperado
- La misma app en `https://op-map-umber.vercel.app/campo` (y en cada preview de rama, en su propio dominio). Se abre en
  el navegador del celular, se entra con el usuario de OpMap y se agrega a la pantalla de inicio con el nombre
  "VG Visitas".
- Es el mismo código de `mobile/`: lo que cambie en la app llega a la web al publicar OpMap. No se mantiene una
  segunda app.
- Funciona como en el teléfono. Las reglas son las de la API (la app solo para líderes del 2026-10-30 se reemplazó el 2026-10-31).
  - El dictado: el navegador pide el micrófono.
  - La ubicación: el navegador pide el permiso; necesita https.
  - La cola sin señal: guarda en el navegador.
- La web de OpMap no cambia. `/campo` no pide la sesión de la web (la app tiene su propio ingreso con token).

## Criterios de aceptación (se convierten en pruebas)
- [ ] En la web, la app llama a la API de su mismo origen. Sin `EXPO_PUBLIC_API_URL`, usa `window.location.origin`;
      en el teléfono sigue la de producción. Prueba pura en `mobile/scripts`.
- [ ] El middleware deja pasar `/campo` y `/campo/...` sin la cookie de la web: es solo la página de la app, sin
      datos. Las rutas `/api/*` siguen exigiendo sesión o token. Prueba en `web/scripts`.
- [ ] Una ruta de la app (`/campo/hoy`, `/campo/agenda/nueva`) recibe el `index.html` de la app, y sus archivos
      (`/campo/_expo/...`) se sirven tal cual.
- [ ] El build de Vercel arma la app web antes de `next build` (`expo export -p web` con base `/campo`). Si falla, el
      despliegue falla: nunca se publica una web sin la app.
- [ ] Captura a 390×844 de `/campo` servida por Next (local) contra un servidor falso, y la página de producción
      responde 200 después de publicar.

## Fuera de alcance
- Funcionar sin señal al ABRIR la página (service worker). Ya abierta, la cola sin señal funciona.
- Publicar en App Store o Google Play.
- Cambiar pantallas de la app.

## Impacto
- Datos o migración: no.
- Costo Google Maps: 0.
- Estética del mapa: no cambia.
- Permisos: `/campo` es pública como página (como `/login`). Los datos siguen detrás de la API (token de la app,
  limitado por intentos en el login).
- El token de la app en la web queda en el almacenamiento del navegador, como ya lo hace hoy Expo web.

## Plan (archivos e interfaces)
- `mobile/app.json`: `experiments.baseUrl: "/campo"` y `web` con nombre, color e íconos para la pantalla de inicio.
- `mobile/lib/http.ts` (`normalizarBase`): en la web, sin variable, el origen de la página.
- `web/scripts/construir-campo.mjs` y `web/package.json` (`build`): `npm ci` en `mobile/` y
  `expo export -p web --output-dir web/public/campo`. `.gitignore`: `web/public/campo`.
- `web/next.config.js`: `rewrites` (fallback) de `/campo/:ruta*` a `/campo/index.html`.
- `web/middleware.ts`: `/campo` pública.
- Si el build de Vercel no ve `mobile/` (carpeta fuera de `web/`), el plan B es versionar la exportación en
  `web/public/campo`, con una prueba que avise si quedó vieja.

## Verificación final
- `npm run check` en `web/` y en `mobile/`.
- `next build` y `next start` locales: `/campo` abre la app.
- Preview de la rama en Vercel con el build en verde.
- Después de publicar: `/campo` en producción responde 200 y el dueño entra desde su celular con una líder.
