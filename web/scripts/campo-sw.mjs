// Opciones de Workbox para el service worker de la app de campo (/campo/sw.js), aparte de construir-campo.mjs para que
// la prueba web/scripts/campo-web-check.ts las use sin correr `expo export`. Las lee construir-campo.mjs en el build.
import path from 'node:path'

/** Opciones de Workbox para el directorio exportado (web/public/campo). */
export function opcionesServiceWorker(directorio) {
  return {
    globDirectory: directorio,
    // Todo lo exportado: la app (JS), el HTML, el manifiesto, los íconos, las letras y las imágenes. metadata.json no hace falta.
    globPatterns: ['**/*.{html,js,css,json,png,ico,svg,ttf,otf,woff,woff2,jpg,jpeg,webp}'],
    globIgnores: ['sw.js', 'workbox-*.js', 'metadata.json'],
    swDest: path.join(directorio, 'sw.js'),
    // La app vive en /campo/: las rutas del manifiesto de precarga llevan ese prefijo.
    modifyURLPrefix: { '': '/campo/' },
    // Cualquier ruta de la app (/campo/hoy, /campo/agenda/nueva…) recibe el index.html precargado, también sin red.
    navigateFallback: '/campo/index.html',
    navigateFallbackAllowlist: [/^\/campo(\/|$)/],
    // Los archivos de Expo llevan el hash en el nombre: no hace falta volver a pedirlos para saber si cambiaron.
    dontCacheBustURLsMatching: /_expo\/static\//,
    cleanupOutdatedCaches: true,
    clientsClaim: true,
    // La versión nueva espera a que la app lo pida (mensaje SKIP_WAITING desde mobile/lib/pwa.ts): nunca a mitad de una subida.
    skipWaiting: false,
    importScripts: ['sw-cola.js'],
    maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
    sourcemap: false,
    inlineWorkboxRuntime: true,
    mode: 'production',
  }
}

