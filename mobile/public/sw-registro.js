// Registro del service worker de VG Visitas en /campo (app sin señal, dueño 2026-10-30). Lo carga public/index.html.
// El worker (sw.js) lo genera Workbox en el build de OpMap (web/scripts/construir-campo.mjs): precarga toda la app
// exportada y sirve /campo/index.html sin señal; sw-cola.js (importScripts) sube la cola con Background Sync.
//
// Versión nueva: cuando hay un worker nuevo instalado y esperando, se avisa a la app (window.__campoSW.versionNueva y
// sus oyentes: mobile/lib/pwa.ts). La app decide cuándo activarlo (SKIP_WAITING) y recargar: nunca con una subida en
// curso. Los datos no se tocan (IndexedDB): una versión nueva nunca pierde reportes pendientes.
;(function () {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  var estado = (window.__campoSW = window.__campoSW || { versionNueva: false, oyentes: [] })
  function avisar(hay) {
    estado.versionNueva = hay
    estado.oyentes.slice().forEach(function (oyente) {
      try {
        oyente(hay)
      } catch (e) {
        /* un oyente que falla no detiene a los demás */
      }
    })
  }
  function vigilar(registro) {
    if (registro.waiting && navigator.serviceWorker.controller) avisar(true)
    registro.addEventListener('updatefound', function () {
      var nuevo = registro.installing
      if (!nuevo) return
      nuevo.addEventListener('statechange', function () {
        // Instalado y hay un worker controlando la página: es una versión nueva esperando.
        if (nuevo.state === 'installed' && navigator.serviceWorker.controller) avisar(true)
      })
    })
  }
  window.addEventListener('load', function () {
    navigator.serviceWorker
      .register('/campo/sw.js', { scope: '/campo/' })
      .then(function (registro) {
        vigilar(registro)
        // Buscar una versión nueva al volver a la app (sin recargar).
        document.addEventListener('visibilitychange', function () {
          if (document.visibilityState === 'visible') registro.update().catch(function () {})
        })
      })
      .catch(function (error) {
        console.warn('[campo] service worker no registrado:', error && error.message)
      })
  })
})()
