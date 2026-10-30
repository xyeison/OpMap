# 2026-10-30 – La app de campo también en la web, dentro de OpMap (/campo)

**Contexto**: la app de las líderes (VG Visitas, hecha con Expo en `mobile/`) solo se abría con Expo Go desde el
computador del dueño. Publicarla en las tiendas tarda:
- Apple pide cuenta de desarrollador (y número D-U-N-S, si es a nombre de la empresa) y revisa cada versión;
- una cuenta personal nueva de Google Play exige una prueba cerrada de 14 días.

El dueño, el 2026-10-30: "yo quiero que tengamos una versión web. Porque la app móvil se demora en que me la aprueben".

**Decisión**:
1. **La misma app se publica como página web dentro de OpMap**: `https://op-map-umber.vercel.app/campo`.
   - Las líderes la abren en el celular, entran con su usuario y la agregan a la pantalla de inicio como "VG Visitas".
   - No pasa por tiendas ni aprobaciones.
2. **Un solo código**:
   - el build de OpMap arma la app web desde `mobile/` en cada publicación;
   - no hay una segunda app que mantener;
   - si algún día se quiere en las tiendas, es la misma.
3. **En el mismo sitio de OpMap**, no en un dominio aparte: la app llama a la API de su mismo origen, sin CORS y con el
   mismo ingreso. `/campo` es pública como página (como `/login`): no trae datos. Los datos siguen detrás de la API, con
   el token de la app.

**Consecuencias**:
- Cada publicación de OpMap (push a master) publica también la app web. El build tarda un poco más: instala
  `mobile/` y exporta la app.
- **En el navegador**:
  - el dictado usa el micrófono del navegador;
  - la ubicación pide permiso y necesita https, que Vercel ya tiene;
  - la cola sin señal guarda en el navegador;
  - el token de la app queda en el almacenamiento del navegador.
- **Límite**: abrir la página necesita señal (no hay service worker). Ya abierta, lo que no se pudo enviar queda en
  cola.
- Expo Go sigue sirviendo para probar en el iPhone. Las tiendas quedan para después, si el dueño las pide.

**Dónde vive en el código**:
- `mobile/app.json`: `experiments.baseUrl` "/campo" y `web` "single".
- `mobile/public/index.html` y `mobile/public/manifest.json`, con sus íconos.
- `mobile/lib/http.ts` y `mobile/lib/api.ts`: en la web, el origen de la página.
- `web/scripts/construir-campo.mjs`, que corre en `npm run build`.
- `web/next.config.js`: `rewrites` fallback de `/campo/*` a su `index.html`.
- `web/middleware.ts`: `esAppDeCampo`.
- Pruebas: `web/scripts/campo-web-check.ts` y `mobile/scripts/movil-check.ts`.
