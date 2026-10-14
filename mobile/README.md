# OpMap Visitas (app móvil)

App del Ejecutivo Comercial para reportar visitas desde el teléfono (iPhone y Android): Hoy, Reportar (por voz o
por toques), Mis días libres, Mis números y Ajustes. Expo SDK 57, React Native, TypeScript estricto y
`expo-router`. Contrato: `docs/fases/fase8-visitas-f3-f4-reporte-y-app-movil.md`.

Habla solo con la API de OpMap (`web/`). No usa ningún SDK de Google ni mapa: las sedes cercanas salen en lista con
su distancia. El audio de los dictados no se guarda: se sube, el servidor lo transcribe y la app lo borra.

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
token firmado (7 días) que se guarda en el almacén seguro del teléfono (`expo-secure-store`; en el navegador,
`localStorage`) y viaja como `Authorization: Bearer`. La contraseña nunca se guarda. Cerrar sesión = olvidar el
token; cambiar la contraseña en la web lo revoca. Un 401 en cualquier pantalla devuelve al ingreso.

## Sin señal

Cada visita lleva un `client_id` (uuid). "Confirmar" la guarda primero en el teléfono (AsyncStorage, una cola por
usuario) y luego la envía. Sin señal queda pendiente y se reintenta sola al volver a la app, al volver la señal y
cada minuto, **hasta las 23:59 del día de la visita** (hora de Colombia). Pasada la medianoche queda "no enviada"
con aviso: no se reportan días anteriores. Reintentar es seguro: el servidor reconoce el `client_id` y no duplica.

## Verificación

```bash
cd mobile
npm run check                      # tsc --noEmit + pruebas puras (scripts/movil-check.ts), sin red
npx expo export --platform web     # la app compila (sale en dist/, que no se versiona)
```

En el navegador (React Native Web), contra el servidor local: `npm run dev` en `web/` y luego
`EXPO_PUBLIC_API_URL=http://localhost:3000 npx expo start --web --port 8081`. En desarrollo el servidor responde
CORS solo a `http://localhost:8081` y `http://127.0.0.1:8081` (en producción no hay CORS). Para ver las pantallas
con sesión sin escribir contraseñas, se pone en `localStorage` (`opmap.token.v1`) un token emitido por el servidor
local para un usuario de prueba; sin servidor, la app abre con el perfil guardado (`opmap.perfil.v1`) en modo
"sin conexión". Probar en el navegador a 390 px de ancho; el GPS y el micrófono los pide el
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
  (app)/sede/nueva.tsx    crear sede con el GPS del sitio
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
  retorno.ts              ida y vuelta con Nuevo médico / Nueva sede (en memoria, nunca en la URL)
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
