# Spec: la app de campo sin señal (PWA, cola en IndexedDB y marcas en vez de rechazos)  (2026-10-30)

**Estado**: aprobada por el dueño el 2026-10-30 ("Sí, adelante" al plan y a las 4 decisiones de reglas). Decisión:
`docs/decisiones/2026-10-30-campo-sin-senal-marcas-en-vez-de-rechazos.md`. Rama `feat/campo-sin-senal`.

## Problema
La app de las líderes (VG Visitas, `mobile/`, publicada en `/campo`) ya guarda las visitas en una cola y las reintenta,
pero:
- sin señal la página no abre (no hay service worker) y la cola vive en localStorage (AsyncStorage en la web);
- el servidor **rechaza** la visita si llega otro día, si está a más del radio de la sede, si no trae GPS o si la sede no
  tiene coordenadas: la visita queda "no enviada" y hay que reportarla de nuevo;
- no hay foto, el motivo de la no efectiva es texto libre y el médico tiene que existir ya en OpMap;
- con el token vencido y sin internet la app cierra la sesión y no deja reportar.

Pedido del dueño (2026-10-30): "La comercial reporta la visita con su ubicación aunque no tenga señal, el reporte queda
guardado en el teléfono y se sube solo cuando vuelve la conexión, sin perderse y sin duplicarse. (...) No bloquees a
nadie por sospechas, solo deja las marcas."

## Resultado esperado
- La app se agrega a la pantalla de inicio y **abre en modo avión** después de la primera vez con internet (inicio de
  sesión y Reportar incluidos). Hay una pantalla "Agregar a inicio" con los pasos de Android e iPhone.
- Con internet (al entrar y cada vez que abre), la app guarda en IndexedDB lo de esa persona: sus médicos con sus sedes y
  coordenadas, su zona, subtipos, motivos de no efectiva y configuración. Hoy muestra "Datos actualizados: …".
- Reportar: médico (o "médico no listado" con nombre y especialidad), IPS, resultado (efectiva / no efectiva con motivo de
  lista), notas, compromiso con fecha opcional y foto opcional (comprimida a 1600 px, JPEG 70 %).
- Al confirmar toma la ubicación hasta 20 s y se queda con la lectura más precisa; guarda lat, lng, precisión y hora de la
  lectura y muestra la precisión. Sin GPS, la visita se guarda igual ("sin ubicación"). La ubicación solo se toma al
  confirmar, nunca en segundo plano, y la app lo avisa (habeas data).
- Cada visita lleva `client_id` (uuid del teléfono), la hora del teléfono y su zona horaria.
- **Cola**: todo se guarda primero en IndexedDB con estado pendiente / enviando / enviada / con error. Se intenta al
  guardar, al abrir, al volver la conexión, cada minuto con la app abierta y con Background Sync donde exista (se detecta
  `SyncManager`; en iPhone no existe y sube al abrir). El servidor hace upsert por `client_id`; el teléfono marca
  "enviada" solo con el 201. Reintentos con espera creciente (1, 2, 4… minutos, tope 15) y error visible. Las fotos suben
  aparte, después de la visita, con sus reintentos. Un 401 conserva la cola, pide entrar de nuevo y continúa. Cerrar
  sesión nunca borra pendientes (avisa antes). `navigator.storage.persist()` al entrar.
- Pantalla: indicador "En línea" / "Sin conexión", contador siempre visible "X visitas pendientes por subir" con "Subir
  ahora", y la lista del día con el estado de cada visita.
- **Servidor**: guarda la hora del teléfono (`reported_at`, `checked_in_at`, `tz`) y la de llegada (`created_at`);
  calcula la distancia a la sede y deja marcas: `en_sitio` (distancia menos precisión dentro del radio, 300 m por defecto,
  configurable), `lejos_de_ips`, `sin_ubicacion`, `precision_baja` (más de 100 m), `ips_sin_coordenadas`,
  `hora_inconsistente` (hora del teléfono posterior a la llegada al servidor o con más de 7 días) y `medico_por_validar`.
  Las marcas salen en `/api/visits/filtered` (mapa de calor) con filtro por marca.
- Publicar una versión nueva no pierde pendientes: la base local se versiona y migra, nunca se borra; la app avisa
  "Hay una versión nueva · Actualizar" y no recarga con una subida en curso.
- Aviso de no usar modo incógnito (y si el almacenamiento no es persistente).

## Criterios de aceptación (se convierten en pruebas)
- [ ] Puras (web, `scripts/reporte-check.ts`): `marcasDeVisita` da `en_sitio` a 120 m con ±10 m y radio 300; `lejos_de_ips`
      a 800 m; `sin_ubicacion` sin GPS; `ips_sin_coordenadas` con sede sin lat/lng; `precision_baja` con ±150 m;
      `hora_inconsistente` con 8 días o con la hora del teléfono 10 min después del servidor; `validarVisita` ya NO
      rechaza por día, radio, GPS ni sede sin coordenadas, y sigue rechazando perfil, topes, líneas ajenas y textos.
- [ ] API (`scripts/reporte-api-check.ts`, PostgREST falso espejo de la 0940): una presencial a 800 m responde 201 con
      `marcas: ['lejos_de_ips']`; una de ayer 201 sin `hora_inconsistente`; una de hace 8 días 201 con
      `hora_inconsistente`; sin GPS 201 con `sin_ubicacion`; médico no listado 201 con `medico_por_validar` y sin crear
      el médico; `motivo_codigo` desconocido 400; el mismo `client_id` dos veces → una fila (`repetida`).
- [ ] Foto: `POST /api/me/visitas/foto` acepta JPEG ≤ 2 MB de una visita propia por `client_id`, guarda `foto_path` y la
      segunda vez reemplaza (idempotente); otra persona → 404; PNG o 5 MB → 400. (Validación pura probada; la subida a
      Storage se verifica en el preview.)
- [ ] `/campo` (`scripts/campo-web-check.ts`): el build genera `public/campo/sw.js` con Workbox (precarga de todo lo
      exportado, `navigateFallback` a `/campo/index.html`, `importScripts` de `sw-cola.js`); `index.html` registra el
      service worker con alcance `/campo/`; `Permissions-Policy` abre la cámara al propio sitio.
- [ ] App (`mobile/scripts/checks/22-sin-senal.ts`): la cola versión 2 migra la versión 1 sin perder visitas; una visita de
      ayer sí se encola y sigue pendiente pasada la medianoche; la espera crece 1, 2, 4… min y "Subir ahora" la ignora;
      un 401 detiene sin tocar nada; `validarBorrador` no bloquea por radio ni sin GPS y da las marcas previstas; el
      borrador con médico no listado es válido; la cola de fotos sube solo las de visitas enviadas y reintenta; la
      ubicación en 20 s se queda con la lectura más precisa; el token vencido sin red entra con el perfil guardado.
- [ ] En el teléfono (lo hace el dueño; lista en `mobile/README.md`): modo avión → abrir desde el ícono → 3 visitas con
      foto → cerrar → internet: en Android suben solas o al abrir; en iPhone al abrir. Sin duplicados ni pérdidas.
      Cortar internet a mitad de subida y cerrar a la fuerza: una sola fila por visita. Sesión vencida sin internet:
      reportar, entrar y que suba todo. Publicar versión nueva con pendientes: no se pierden.

## Fuera de alcance
- Sincronizar médicos desde Odoo (hoy los médicos viven en `medicos`, F1). Detección nativa de GPS falso (Capacitor):
  el código queda en `mobile/lib/*` puro, sin tocarlo. Tiendas. Cambiar los topes de negocio (perfil, telefónicas, tope por
  médico), que siguen rechazando.

## Impacto
- Datos / migración: sí. `database/migrations/2026-10-30_0940_campo_sin_senal.sql` (rollback `2026-10-30_9959_campo_sin_senal_rollback.sql`):
  columnas en `visits` (`tz`, `gps_at`, `marcas`, `en_sitio`, `foto_path`, `medico_no_listado`, `motivo_codigo`), tabla
  `motivos_no_efectiva`, `visitas_registrar` sin los rechazos de día, radio, GPS y sede sin coordenadas (deja marcas),
  bucket privado `visitas-fotos`, radio `radio_presencial_m` a 300 m con `config_registrar`. Se aplica solo con
  autorización del dueño y en la misma ventana que el despliegue.
- Costo Google Maps: 0.
- Estética del mapa: no cambia (solo un filtro más de visitas en Filtros).
- Permisos / roles: ninguno nuevo. `/api/me/visitas/foto` usa `requirePersonaDeCampo` como las demás.

## Plan (archivos e interfaces)
- Servidor: `lib/reporte-visitas.ts` (tipos, `marcasDeVisita`, `validarVisita`), `lib/reporte-visitas-schemas.ts`,
  `app/api/me/_lib/reporte-server.ts` (columnas, `jsonbRegistrar`, coordenadas en `mis_medicos[].sedes`, motivos),
  `app/api/me/visitas/route.ts`, `app/api/me/visitas/foto/route.ts` (nuevo), `app/api/visits/filtered/route.ts`,
  `components/MapControls.tsx` (filtro por marca), `next.config.js` (cámara), `scripts/construir-campo.mjs` + `scripts/campo-sw.mjs` (Workbox; la prueba `campo-web-check` genera un `sw.js` real).
- App: `lib/almacen.ts` + `lib/almacen-idb.ts` (IndexedDB con `idb`), `lib/cola.ts` (v2: estados, espera creciente,
  sin descarte a medianoche), `lib/cola-fotos.ts`, `lib/cola-contexto.tsx`, `lib/conexion(-reglas).ts`, `lib/pwa(-reglas).ts`,
  `lib/foto(-reglas).ts`, `lib/estado-cola.ts`, `lib/instalacion.ts`, `lib/tarjeta-resumen.ts`, `lib/sesion.ts`, `lib/ubicacion-pasos.ts`, `lib/propuesta.ts`, `lib/tipos.ts`, `lib/claves-api.ts`,
  `components/reporte/{CamposVisita,TarjetaBorrador,FotoVisita}.tsx`, `components/EstadoCola.tsx`,
  `app/(app)/{_layout,hoy,reportar,ajustes,instalar}.tsx`, `app/(auth)/login.tsx`, `public/{index.html,sw-registro.js,sw-cola.js}`.
- Librerías: `workbox-build` (web, dev), `idb`, `expo-image-picker`, `expo-image-manipulator` (mobile).

## Verificación final
- `npm run check` en `web/` y en `mobile/`; `node scripts/construir-campo.mjs` local y revisar `public/campo/sw.js`.
- Preview de la rama en Vercel; en un Android y un iPhone reales la lista de pruebas de `mobile/README.md` ("Sin señal").
