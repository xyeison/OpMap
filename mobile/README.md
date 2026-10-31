# VG Visitas (app móvil)

App del Ejecutivo Comercial para reportar visitas desde el teléfono (iPhone y Android): Hoy, Reportar (por voz o
por toques), Mis días libres, Mis números y Ajustes. Expo SDK 57, React Native, TypeScript estricto y
`expo-router`. Contrato: `docs/fases/fase8-visitas-f3-f4-reporte-y-app-movil.md`.

Habla solo con la API de OpMap (`web/`). No usa ningún SDK de Google ni mapa: las sedes cercanas salen en lista con
su distancia. El audio de los dictados no se guarda: se sube, el servidor lo transcribe y la app lo borra.

Marca VG Medical (F4.1): nombre visible "VG Visitas", logo en el ingreso y en el encabezado (`components/Logo.tsx`),
paleta monocromática y letra DM Sans (`lib/ui.tsx`). El ícono, el ícono adaptable de Android y la pantalla de inicio
(plugin `expo-splash-screen` en `app.json`: el símbolo "vg" blanco sobre negro, `assets/splash-icon.png`) salen de los
SVG de `assets/marca/`. En Expo Go la pantalla de inicio nativa es la de Expo Go; la propia se ve en un build de EAS.

## Requisitos

- Node 20 o más (CI usa 22) y npm.
- Para probar en el teléfono: la app **Expo Go** (App Store o Google Play), en la misma red Wi-Fi que el
  computador, o con `--tunnel`.
- No hace falta Xcode, Android Studio, CocoaPods ni watchman para Expo Go ni para la versión web.

## Cómo correr

```bash
cd mobile
npm install            # o npm ci
npx expo start         # muestra un QR: escanéalo con Expo Go (Android) o con la cámara (iPhone)
npx expo start --tunnel   # si el teléfono no está en la misma red (pide instalar @expo/ngrok la primera vez)
```

Por defecto la app habla con producción (`https://op-map-umber.vercel.app`). Para usar el servidor local:

```bash
# en web/: npm run dev   (http://localhost:3000)
EXPO_PUBLIC_API_URL=http://localhost:3000 npx expo start --web --port 8081
# en el teléfono, localhost no sirve: usa la IP del computador
EXPO_PUBLIC_API_URL=http://192.168.1.20:3000 npx expo start
```

| Variable | Para qué | Por defecto |
| --- | --- | --- |
| `EXPO_PUBLIC_API_URL` | URL del servidor de OpMap (sin barra final) | `https://op-map-umber.vercel.app` |

No hay más variables: la app no lleva llaves. Las de OpenAI y Anthropic viven solo en el servidor (Vercel); sin
ellas la voz responde 503 y la app sigue por toques.

## Sesión

El ingreso usa el mismo correo y contraseña de la web. `POST /api/auth/login` con `cliente: 'movil'` devuelve un
token firmado (7 días) que se guarda en el almacén seguro del teléfono (`expo-secure-store`; en el navegador, en
IndexedDB, base `opmap-campo`) y viaja como `Authorization: Bearer`. La contraseña nunca se guarda. Cerrar sesión =
olvidar el token, el perfil y el contexto (las visitas y fotos sin subir NO se borran: la app avisa cuántas hay);
cambiar la contraseña en la web lo revoca. Un 401 en cualquier pantalla devuelve al ingreso conservando el perfil, el
contexto y la cola: al volver a entrar, sube lo pendiente. Si el token vence sin señal, la app sigue abierta con lo
guardado para seguir reportando ("sesión vencida: entra al volver la señal").

## Sin señal

Spec `docs/specs/2026-10-30-campo-sin-senal-pwa.md`. Cada visita lleva un `client_id` (uuid). "Confirmar" la guarda
primero en el teléfono (IndexedDB en la web, AsyncStorage en Expo; una cola por usuario, `lib/cola.ts`) y luego la
envía. Sin señal queda **pendiente** y se reintenta sola al volver a la app, al volver la señal, cada minuto, al tocar
"Subir ahora" y, donde existe Background Sync (Chrome en Android), aunque la app esté cerrada (`public/sw-cola.js`).
En iPhone no hay Background Sync: sube al abrir la app. Un error de red espera cada vez más (1, 2, 4… hasta 15 min);
un rechazo del servidor (400) deja la visita **con error** y su mensaje, sin borrarla. Reintentar es seguro: el
servidor reconoce el `client_id` y no duplica. Una visita se marca enviada solo cuando el servidor la confirma. La foto
sube aparte, después de su visita, con sus propios reintentos. Las visitas de otro día se envían igual (el servidor las
marca). Nada se borra al cerrar sesión ni al actualizar la app.

La app en la web (`/campo`) se instala como PWA: `public/manifest.json`, `public/index.html` y `public/sw-registro.js`
registran el service worker que Workbox genera en el build de OpMap (`web/scripts/campo-sw.mjs`): precarga toda la app
y abre sin señal. La versión nueva espera a que no haya subida en curso ("Actualizar" en la franja); IndexedDB nunca se
borra (una versión nueva no pierde pendientes). La pantalla "Agregar a inicio" (Ajustes) explica cómo instalarla y
avisa que en modo incógnito los datos no se conservan.

### Pruebas en teléfonos reales antes de entregar (Android con Chrome e iPhone con Safari)

Con la rama publicada (preview de Vercel o producción) y la app instalada desde la pantalla de inicio:

1. **Instalar**: Android → Chrome → menú ⋮ → "Agregar a la pantalla de inicio" (o "Instalar app"); iPhone → Safari →
   Compartir → "Agregar a pantalla de inicio". Abrir desde el ícono: debe verse sin la barra del navegador. En Ajustes →
   "Agregar a la pantalla de inicio" debe decir que ya está instalada.
2. **Datos para sin señal**: con señal, abrir Hoy y Reportar una vez (baja médicos, IPS, motivos). En Hoy, al final,
   "Datos para trabajar sin señal… actualizados <fecha>".
3. **Modo avión, 3 visitas con foto**: activar modo avión; la franja dice "Sin conexión". Reportar 3 visitas (una con
   médico no listado, una no efectiva con motivo de la lista, una con foto). Cada una queda "Pendiente" en Hoy y la
   franja cuenta "3 visitas pendientes por subir · 1 foto pendiente". Cerrar la app del todo y volver a abrirla sin
   señal: las 3 siguen ahí.
4. **Vuelve la señal**: quitar el modo avión. En menos de un minuto (o con "Subir ahora") pasan a "Enviada", después la
   foto. En la web, el mapa con el filtro "Marca de la visita" muestra sus marcas (sin ubicación / en sitio, médico por
   validar). Ninguna duplicada (mismo `client_id`).
5. **Cortar internet a mitad de subida**: encolar 3 visitas sin señal, quitar el modo avión y volver a ponerlo apenas
   empiece a subir. Las que alcanzaron a subir quedan "Enviada"; las demás "Pendiente" con "reintenta en…". Al volver
   la señal se completan sin duplicados.
6. **Sesión vencida**: en la web, cambiar la contraseña del usuario (revoca el token). En el teléfono, sin señal, reportar
   una visita (queda en la cola). Con señal, la app pide entrar ("Tu sesión venció") sin borrar la cola; al entrar, sube.
7. **Versión nueva con pendientes**: con una visita pendiente y sin señal, publicar una versión nueva. Al volver la señal,
   la franja ofrece "Actualizar"; la visita pendiente sube y, después, "Actualizar" recarga la app. La visita sigue
   enviada y nada se perdió.
8. **GPS**: en una IPS con coordenadas, la tarjeta dice "en sitio" con la precisión (±N m); a más de 300 m, "lejos de la
   IPS: queda marcada" y se puede guardar igual. Con el GPS apagado, "sin ubicación" y se guarda igual. En una pestaña
   de Safari o Chrome (no instalada), si el sitio quedó con la ubicación bloqueada la app lo dice en el acto con los
   pasos para permitirla (Safari: «aA» › Ajustes del sitio web › Ubicación; Chrome: Ajustes del iPhone › Chrome);
   "sal a un lugar abierto" es solo para GPS apagado o sin señal de satélite.
10. **Qué versión corre**: Ajustes › Versión muestra el commit con que se armó la app en la web (`1.0.0 (navegador) ·
    94d8e86`). Si no es el último de master, la franja debe ofrecer "Actualizar" (o cerrar todas las pestañas del sitio y
    volver a abrir).
9. **Incógnito**: abrir `/campo` en una pestaña de incógnito: la app avisa que lo guardado puede perderse.

## Verificación

```bash
cd mobile
npm run check                      # tsc --noEmit + pruebas puras (scripts/movil-check.ts), sin red
npx expo export --platform web     # la app compila (sale en dist/, que no se versiona)
# en web/: node scripts/construir-campo.mjs   → public/campo con sw.js (Workbox) para probar la PWA con `next dev`
```

En el navegador (React Native Web), contra el servidor local: `npm run dev` en `web/` y luego
`EXPO_PUBLIC_API_URL=http://localhost:3000 npx expo start --web --port 8081`. En desarrollo el servidor responde
CORS solo a `http://localhost:8081` y `http://127.0.0.1:8081` (en producción no hay CORS). Para ver las pantallas
con sesión sin escribir contraseñas, se pone en `localStorage` (`opmap.token.v1`) un token emitido por el servidor
local para un usuario de prueba (en IndexedDB `opmap-campo` → `kv`, o en `localStorage`: la app lo migra); sin
servidor, la app abre con el perfil guardado (`opmap.perfil.v1`) en modo "sin conexión". Probar en el navegador a 390 px de ancho; el GPS y el micrófono los pide el
navegador.

Verificación completa sin tocar producción (como se hizo el 2026-10-14): un PostgREST falso en memoria (el de
`web/scripts/reporte-api-check.ts`, con `visitas_registrar/editar/anular` como la 0830) sirviendo también
`/v1/audio/transcriptions` y `/v1/messages` falsos; una copia de `web/` sin `.env*` con `next dev` y
`NEXT_PUBLIC_SUPABASE_URL`, `OPENAI_BASE_URL` y `ANTHROPIC_BASE_URL` apuntando al falso (llaves falsas); la app con
`EXPO_PUBLIC_API_URL` hacia esa copia; Chrome sin ventana por CDP con GPS y micrófono falsos
(`--use-fake-device-for-media-stream`). Así se recorrió Hoy, Reportar (sedes cercanas, por toques, grabación de
verdad, tarjetas por voz), Visita, Nuevo médico, Nueva sede, Mis días libres y Mis números. Ojo al automatizar:
React Navigation deja montada la pantalla anterior debajo (hay que tocar lo que está encima) y el `ScrollView` se
queda con el primer toque mientras se desplaza.

El CI (`.github/workflows/ci.yml`, trabajo "app movil · typecheck · pruebas") corre `npm ci` y `npm run check`
en `mobile/`.

## Estructura

```
app/                      pantallas (expo-router)
  _layout.tsx             sesión y cola para toda la app
  index.tsx               con sesión → Hoy; sin sesión → ingreso
  (auth)/login.tsx        ingreso
  (app)/_layout.tsx       pestañas: Hoy, Reportar, Días libres, Números, Ajustes
  (app)/hoy.tsx           meta del día, cola pendiente, compromisos vencidos, visitas de hoy
  (app)/reportar.tsx      dictar o reportar por toques
  (app)/visita/[id].tsx   ver, corregir o anular (mismo día)
  (app)/medico/nuevo.tsx  crear médico completo
  (app)/sede/nueva.tsx    crear sede con el GPS del sitio (desde Agendar, ubicación opcional: "por confirmar")
  (app)/dias-libres.tsx   registrar, ver y anular días libres
  (app)/numeros.tsx       cuota y cumplimiento del mes
  (app)/ajustes.tsx       quién soy, servidor, versión, cerrar sesión
components/reporte/       piezas de Reportar
  TarjetaBorrador.tsx     una visita por confirmar (voz o toques), con distancia, radio y salidas
  Grabador.tsx            grabación del dictado (hasta 3 min, nivel, cancelar; borra el audio)
  Selector.tsx, Buscador.tsx, ListaSedes.tsx, SelectorMunicipio.tsx, CamposVisita.tsx
lib/
  tipos.ts                formas JSON de la API (copiadas del contrato)
  claves-api.ts           claves de cada forma JSON (verificadas al compilar, contra el contrato y contra el servidor)
  propuesta.ts            de la propuesta o los toques a la visita: catálogo, tarjetas, validación, cuerpo, corregir
  terceros.ts             listas y reglas de F1 (documento del médico, código del REPS)
  grabacion.ts, audio.ts  reglas de la grabación y borrado del audio
  retorno.ts              ida y vuelta con Nuevo médico / Nueva sede (en memoria, nunca en la URL; la vuelta a Agendar lleva médico y sede)
  api.ts, http.ts         cliente HTTP (portador, tiempos máximos, 401 → cerrar sesión)
  errores.ts              errores { error } legibles
  sesion.ts, token.ts     sesión del teléfono
  almacen.ts              almacén seguro (token) y AsyncStorage (perfil, cola)
  cola.ts, cola-contexto.tsx   cola sin señal (pura) y su conexión con la app
  geo.ts, ubicacion.ts    Haversine (igual que el servidor) y GPS
  fechas.ts, reglas.ts    fechas en Bogotá y textos de pantalla
  ui.tsx                  botones, tarjetas, campos, chips, colores
  id.ts                   client_id (uuid)
scripts/movil-check.ts    pruebas puras
```

## Compilar para las tiendas (cuando existan las cuentas)

Hoy se distribuye con Expo Go. Cuando el dueño tenga las cuentas de Apple Developer y Google Play (y una cuenta de
Expo a nombre de VG):

```bash
npm install -g eas-cli
eas login
eas init                      # crea el proyecto en Expo y escribe extra.eas.projectId en app.json
eas build:configure           # crea eas.json (perfiles development, preview, production)
eas build --platform ios      # TestFlight: luego eas submit --platform ios
eas build --platform android  # Play (prueba interna): luego eas submit --platform android
```

Antes de la primera compilación: confirmar el identificador `co.vg.opmap.visitas` (`ios.bundleIdentifier` y
`android.package` en `app.json`; no se puede cambiar después de publicar), y fijar `EXPO_PUBLIC_API_URL` de
producción en el perfil de `eas.json`. Los textos de permisos (ubicación y micrófono) ya están en español en
`app.json`.
