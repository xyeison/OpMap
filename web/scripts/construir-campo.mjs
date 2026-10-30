// Arma la app de campo para la web en web/public/campo (dueño, 2026-10-30: "yo quiero que tengamos una versión web";
// spec docs/specs/2026-10-30-app-de-campo-en-la-web.md). Corre antes de `next build` (npm run build), también en Vercel:
//   1. instala las dependencias de mobile/ si faltan (npm ci);
//   2. `expo export -p web` con la base /campo (mobile/app.json experiments.baseUrl) en web/public/campo;
//   3. (app sin señal, 2026-10-30, spec docs/specs/2026-10-30-campo-sin-senal-pwa.md) genera el service worker
//      public/campo/sw.js con Workbox: precarga TODO lo exportado (la app entera abre en modo avión después de la
//      primera vez con internet), sirve /campo/index.html a cualquier ruta de la app sin red (navigateFallback) e
//      importa sw-cola.js (Background Sync de la cola, mobile/public/sw-cola.js). Las versiones nuevas quedan en espera
//      hasta que la app lo pide (sin skipWaiting automático): nunca se recarga con una subida en curso.
// Sin EXPO_PUBLIC_API_URL: en la web la app llama a la API de su mismo sitio (mobile/lib/api.ts ORIGEN_WEB).
// Si algo falla, el build falla: nunca se publica OpMap sin la app (la página /campo daría 404).
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateSW } from 'workbox-build'
import { opcionesServiceWorker } from './campo-sw.mjs'

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const movil = path.resolve(web, '..', 'mobile')
const salida = path.join(web, 'public', 'campo')

if (!existsSync(path.join(movil, 'package.json'))) {
  console.error(`[campo] No está ${movil}: el build necesita la carpeta mobile/ del repositorio (la app de campo).`)
  process.exit(1)
}

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
// Sin la variable: la app usa el origen de la página. CI=1: expo sin preguntas ni colores.
const entorno = { ...process.env, CI: '1' }
delete entorno.EXPO_PUBLIC_API_URL

// Vercel restaura mobile/node_modules de la caché del despliegue anterior: si el package.json trae una dependencia nueva
// (idb, expo-image-picker…), expo no la encuentra. Se instala cuando falta expo O cuando falta cualquier dependencia.
const paquete = JSON.parse(readFileSync(path.join(movil, 'package.json'), 'utf8'))
const dependencias = Object.keys({ ...(paquete.dependencies ?? {}), ...(paquete.devDependencies ?? {}) })
const faltan = dependencias.filter(nombre => !existsSync(path.join(movil, 'node_modules', nombre, 'package.json')))
if (!existsSync(path.join(movil, 'node_modules', '.bin', 'expo')) || faltan.length > 0) {
  console.log(`[campo] Instalando las dependencias de mobile/ (npm ci)…${faltan.length > 0 ? ` faltaban: ${faltan.join(', ')}` : ''}`)
  execFileSync(npm, ['ci', '--no-audit', '--no-fund'], { cwd: movil, stdio: 'inherit', env: entorno })
}

rmSync(salida, { recursive: true, force: true })
console.log(`[campo] expo export -p web → ${path.relative(web, salida)}`)
execFileSync(npx, ['expo', 'export', '--platform', 'web', '--output-dir', salida], { cwd: movil, stdio: 'inherit', env: entorno })

if (!existsSync(path.join(salida, 'index.html'))) {
  console.error('[campo] expo export terminó sin index.html')
  process.exit(1)
}
if (!existsSync(path.join(salida, 'sw-cola.js')) || !existsSync(path.join(salida, 'sw-registro.js'))) {
  console.error('[campo] faltan sw-cola.js o sw-registro.js (mobile/public): expo export debía copiarlos')
  process.exit(1)
}

const { count, size, warnings } = await generateSW(opcionesServiceWorker(salida))
for (const aviso of warnings) console.warn(`[campo] workbox: ${aviso}`)
if (!existsSync(path.join(salida, 'sw.js')) || count === 0) {
  console.error('[campo] Workbox no generó sw.js con archivos precargados')
  process.exit(1)
}
console.log(`[campo] sw.js: ${count} archivos precargados (${Math.round(size / 1024)} KB), ${statSync(path.join(salida, 'sw.js')).size} bytes`)
console.log('[campo] Lista: /campo')
