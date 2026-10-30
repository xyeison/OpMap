/**
 * La app de campo en la web (/campo, dueño 2026-10-30; spec docs/specs/2026-10-30-app-de-campo-en-la-web.md): pruebas SIN
 * RED de cómo la sirve OpMap.
 *   - middleware.ts: /campo y lo de adentro pasan sin la cookie de la web (es solo la página de la app, sin datos);
 *     /campos u otra página siguen pidiendo sesión; /api/* sigue exigiendo sesión o token.
 *   - next.config.js: las rutas de la app (/campo, /campo/hoy…) reciben su index.html (rewrites "fallback", después de
 *     los archivos de public/campo).
 *   - El build: `npm run build` arma la app con scripts/construir-campo.mjs antes de `next build`, sin EXPO_PUBLIC_API_URL
 *     (la app usa el origen de la página) y sin versionar public/campo.
 *   - Sin señal (spec docs/specs/2026-10-30-campo-sin-senal-pwa.md): el build genera public/campo/sw.js con Workbox
 *     (scripts/campo-sw.mjs): precarga la app, sirve /campo/index.html a cualquier ruta sin red, importa sw-cola.js
 *     (Background Sync) y no activa la versión nueva solo (skipWaiting apagado). Aquí se genera un sw.js de verdad sobre
 *     una exportación de mentira. Y lo que la app trae en mobile/public: manifest, registro del worker y cabeceras.
 *
 * Uso (desde web/): npx tsx scripts/campo-web-check.ts   (va dentro de npm run test)
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { NextRequest } from 'next/server'
import { generateSW } from 'workbox-build'
import { middleware } from '../middleware'
import { CLAVES_SESION_APP_CAMPO, CLAVE_SALIDA_PENDIENTE_APP_CAMPO, marcarSalidaPendienteAppCampo, olvidarSesionAppCampo } from '../lib/app-campo'
import { opcionesServiceWorker } from './campo-sw.mjs'

for (const key of ['SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL', 'SESSION_SECRET']) delete process.env[key]
process.env.SESSION_SECRET = 'secreto-de-prueba-campo-web-check-0123456789abcdefghijklmnopqrstuvwxyz'

let passed = 0
let failed = 0
function check(name: string, condition: boolean, detail?: unknown) {
  if (condition) {
    passed++
    console.log(`  ok    ${name}`)
  } else {
    failed++
    console.log(`  FALLA ${name}${detail === undefined ? '' : ` → ${JSON.stringify(detail)}`}`)
  }
}

const raiz = path.resolve(__dirname, '..')
const leer = (archivo: string) => readFileSync(path.join(raiz, archivo), 'utf8')
const sigue = (r: Response) => r.headers.get('x-middleware-next') === '1'

async function main() {
  console.log('\n1. middleware: /campo sin la cookie de la web')
  for (const ruta of ['/campo', '/campo/', '/campo/hoy', '/campo/agenda/nueva', '/campo/index.html', '/campo/manifest.json']) {
    const r = await middleware(new NextRequest(`http://localhost:3000${ruta}`))
    check(`${ruta} sin sesión → sigue (la página de la app; los datos van por /api con token)`, r.status === 200 && sigue(r), { status: r.status, location: r.headers.get('location') })
  }
  const parecida = await middleware(new NextRequest('http://localhost:3000/campos'))
  const otra = await middleware(new NextRequest('http://localhost:3000/lideres'))
  check(
    '/campos y las páginas de la web siguen pidiendo sesión (redirigen al login)',
    parecida.status === 307 && (parecida.headers.get('location') ?? '').includes('/login') && otra.status === 307 && (otra.headers.get('location') ?? '').includes('/login'),
    { campos: parecida.status, lideres: otra.status }
  )
  const api = await middleware(new NextRequest('http://localhost:3000/api/me/contexto'))
  check('/api/me/contexto sin sesión ni token → 401 (los datos siguen cerrados)', api.status === 401, api.status)

  console.log('\n2. next.config.js: las rutas de la app reciben su index.html')
  const config = require('../next.config.js') as { rewrites?: () => Promise<{ fallback?: { source: string; destination: string }[] }> }
  const reescrituras = config.rewrites ? await config.rewrites() : {}
  const fallback = reescrituras.fallback ?? []
  check(
    '/campo y /campo/:ruta* → /campo/index.html, en "fallback" (después de los archivos de public/campo)',
    fallback.some(r => r.source === '/campo' && r.destination === '/campo/index.html') && fallback.some(r => r.source === '/campo/:ruta*' && r.destination === '/campo/index.html'),
    reescrituras
  )

  console.log('\n3. El build arma la app (scripts/construir-campo.mjs)')
  const paquete = JSON.parse(leer('package.json')) as { scripts: Record<string, string> }
  check('npm run build = construir-campo.mjs y después next build (si la app falla, el build falla)', paquete.scripts.build === 'node scripts/construir-campo.mjs && next build', paquete.scripts.build)
  const script = leer('scripts/construir-campo.mjs')
  check(
    'construir-campo: expo export -p web a public/campo, sin EXPO_PUBLIC_API_URL (la app usa el origen de la página) y falla sin mobile/ o sin index.html',
    /'expo', 'export', '--platform', 'web', '--output-dir', salida/.test(script) &&
      /path\.join\(web, 'public', 'campo'\)/.test(script) &&
      /delete entorno\.EXPO_PUBLIC_API_URL/.test(script) &&
      (script.match(/process\.exit\(1\)/g) ?? []).length >= 2
  )
  check('public/campo no se versiona (web/.gitignore)', /^\/public\/campo\/$/m.test(leer('.gitignore')))
  check('construir-campo exige sw-cola.js y sw-registro.js en lo exportado y genera sw.js con Workbox (falla si no precarga nada)', /sw-cola\.js/.test(script) && /sw-registro\.js/.test(script) && /generateSW\(opcionesServiceWorker\(salida\)\)/.test(script) && /count === 0/.test(script))

  console.log('\n4. Sin señal: el service worker que genera el build (scripts/campo-sw.mjs)')
  const movil = (archivo: string) => readFileSync(path.join(raiz, '..', 'mobile', archivo), 'utf8')
  const exportado = mkdtempSync(path.join(os.tmpdir(), 'campo-sw-'))
  try {
    // Una exportación de mentira con lo que Expo deja: index.html, el JS con hash, el manifiesto, íconos y lo de mobile/public.
    mkdirSync(path.join(exportado, '_expo', 'static', 'js', 'web'), { recursive: true })
    writeFileSync(path.join(exportado, 'index.html'), movil('public/index.html'))
    writeFileSync(path.join(exportado, '_expo', 'static', 'js', 'web', 'entry-abc123.js'), 'console.log("app")')
    writeFileSync(path.join(exportado, 'manifest.json'), movil('public/manifest.json'))
    writeFileSync(path.join(exportado, 'metadata.json'), '{}')
    writeFileSync(path.join(exportado, 'icono-192.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]))
    writeFileSync(path.join(exportado, 'sw-cola.js'), movil('public/sw-cola.js'))
    writeFileSync(path.join(exportado, 'sw-registro.js'), movil('public/sw-registro.js'))
    const opciones = opcionesServiceWorker(exportado)
    const { count, warnings } = await generateSW(opciones)
    const sw = readFileSync(path.join(exportado, 'sw.js'), 'utf8')
    check('genera public/campo/sw.js con Workbox, sin avisos', sw.length > 1000 && warnings.length === 0, warnings)
    check('precarga la app entera con el prefijo /campo/ (index.html, el JS, el manifiesto, los íconos y los scripts), no metadata.json ni el propio sw.js', count === 6 && /"\/campo\/index\.html"/.test(sw) && /\/campo\/_expo\/static\/js\/web\/entry-abc123\.js/.test(sw) && /"\/campo\/manifest\.json"/.test(sw) && /"\/campo\/icono-192\.png"/.test(sw) && !/metadata\.json/.test(sw) && !/"\/campo\/sw\.js"/.test(sw), { count })
    // Minificado: la URL del fallback aparece dos veces (la precarga y la ruta de navegación) y la allowlist tal cual.
    check('cualquier ruta de la app sin red recibe /campo/index.html (navigateFallback) y solo dentro de /campo', opciones.navigateFallback === '/campo/index.html' && (sw.match(/"\/campo\/index\.html"/g) ?? []).length === 2 && /allowlist:\[\/\^\\\/campo\(\\\/\|\$\)\/\]/.test(sw))
    check('importa sw-cola.js (Background Sync de la cola) y no se activa solo: la app manda SKIP_WAITING cuando no hay subida en curso', /importScripts\("sw-cola\.js"\)/.test(sw) && opciones.skipWaiting === false && !/self\.skipWaiting\(\)/.test(sw.replace(/addEventListener\("message"[\s\S]*$/, '')) && opciones.clientsClaim === true)
    check('el JS de Expo (con hash en el nombre) no lleva revisión aparte; los demás sí (cambian sin cambiar de nombre)', /url:"\/campo\/_expo\/static\/js\/web\/entry-abc123\.js",revision:null/.test(sw) && /url:"\/campo\/index\.html",revision:"[0-9a-f]+"/.test(sw))
    check('workbox va dentro del sw.js (inlineWorkboxRuntime, sin pedir nada a un CDN) y limpia las cachés viejas al activarse', opciones.inlineWorkboxRuntime === true && opciones.cleanupOutdatedCaches === true && /self\.caches\.delete\(/.test(sw) && !/storage\.googleapis\.com\/workbox-cdn/.test(sw))
  } finally {
    rmSync(exportado, { recursive: true, force: true })
  }

  console.log('\n5. Lo que la app trae para instalarse y subir la cola (mobile/public)')
  const indexHtml = movil('public/index.html')
  const manifiesto = JSON.parse(movil('public/manifest.json')) as { name: string; start_url: string; scope: string; display: string; icons: { src: string; sizes: string }[] }
  check('index.html: manifest, apple-touch-icon, capable y el registro del service worker (sw-registro.js)', /<link rel="manifest" href="\/campo\/manifest\.json" \/>/.test(indexHtml) && /apple-mobile-web-app-capable" content="yes"/.test(indexHtml) && /<script src="\/campo\/sw-registro\.js" defer><\/script>/.test(indexHtml))
  check('manifest.json: VG Visitas, standalone, empieza y vive en /campo/, íconos 192 y 512', manifiesto.name === 'VG Visitas' && manifiesto.display === 'standalone' && manifiesto.start_url === '/campo/' && manifiesto.scope === '/campo/' && manifiesto.icons.map(i => i.sizes).join() === '192x192,512x512' && manifiesto.icons.every(i => i.src.startsWith('/campo/')), manifiesto)
  const registro = movil('public/sw-registro.js')
  check('sw-registro.js registra /campo/sw.js con alcance /campo/, avisa la versión nueva (updatefound → __campoSW) y busca actualizaciones al volver a la app', /register\('\/campo\/sw\.js', \{ scope: '\/campo\/' \}\)/.test(registro) && /updatefound/.test(registro) && /__campoSW/.test(registro) && /visibilitychange/.test(registro) && !/skipWaiting/.test(registro))
  const swCola = movil('public/sw-cola.js')
  check('sw-cola.js: atiende el sync "opmap-cola", lee la cola de IndexedDB y manda a /api/me/visitas; con 401 se detiene y nunca borra', /addEventListener\('sync'/.test(swCola) && /opmap-cola/.test(swCola) && /indexedDB/.test(swCola) && /\/api\/me\/visitas/.test(swCola) && /401/.test(swCola) && !/\.delete\(|clear\(/.test(swCola))
  const cabeceras = (config as unknown as { headers?: () => Promise<{ source: string; headers: { key: string; value: string }[] }[]> }).headers
  const todas = cabeceras ? await cabeceras() : []
  const permisos = todas.flatMap(h => h.headers).find(h => h.key === 'Permissions-Policy')
  check('Permissions-Policy deja la cámara, el micrófono y la ubicación al propio sitio (la foto y el GPS de la app en /campo)', permisos?.value === 'camera=(self), microphone=(self), geolocation=(self)', permisos)

  console.log('\n4. Un solo ingreso: la web olvida la sesión de la app al entrar y al salir (2026-10-30)')
  const quitadas: string[] = []
  const almacen = { removeItem: (clave: string) => void quitadas.push(clave) }
  olvidarSesionAppCampo(almacen)
  check(
    'olvidarSesionAppCampo quita el token, el perfil, el contexto del día (sedes, médicos y contactos) y la marca de salida pendiente de la app, no su cola sin señal',
    JSON.stringify(quitadas) === JSON.stringify(['opmap.token.v1', 'opmap.perfil.v1', 'opmap.contexto.v1', 'opmap.salida-pendiente.v1']) && !quitadas.some(clave => /cola/.test(clave)),
    quitadas
  )
  const marcadas: [string, string][] = []
  marcarSalidaPendienteAppCampo({ setItem: (clave: string, valor: string) => void marcadas.push([clave, valor]) })
  check(
    "marcarSalidaPendienteAppCampo deja la marca como la guarda la app (JSON true en 'opmap.salida-pendiente.v1')",
    JSON.stringify(marcadas) === JSON.stringify([[CLAVE_SALIDA_PENDIENTE_APP_CAMPO, 'true']]) && JSON.parse(marcadas[0]?.[1] ?? 'null') === true,
    marcadas
  )
  let lanzo = false
  try {
    olvidarSesionAppCampo({ removeItem: () => { throw new Error('modo privado') } })
    olvidarSesionAppCampo(null)
    marcarSalidaPendienteAppCampo({ setItem: () => { throw new Error('modo privado') } })
    marcarSalidaPendienteAppCampo(null)
  } catch {
    lanzo = true
  }
  check('olvidarSesionAppCampo y marcarSalidaPendienteAppCampo nunca lanzan (sin almacenamiento o en modo privado)', !lanzo)
  check(
    'las claves son las mismas que usa la app (CLAVE_TOKEN de almacen.ts, CLAVE_PERFIL de sesion.ts, CLAVE_CONTEXTO de contexto-guardado.ts y CLAVE_SALIDA_PENDIENTE de sesion-reglas.ts)',
    movil('lib/almacen.ts').includes(`const CLAVE_TOKEN = '${CLAVES_SESION_APP_CAMPO[0]}'`) &&
      movil('lib/sesion.ts').includes(`const CLAVE_PERFIL = '${CLAVES_SESION_APP_CAMPO[1]}'`) &&
      movil('lib/contexto-guardado.ts').includes(`export const CLAVE_CONTEXTO = '${CLAVES_SESION_APP_CAMPO[2]}'`) &&
      movil('lib/sesion-reglas.ts').includes(`export const CLAVE_SALIDA_PENDIENTE = '${CLAVE_SALIDA_PENDIENTE_APP_CAMPO}'`)
  )
  const contexto = leer('contexts/UserContext.tsx')
  const loginWeb = contexto.slice(contexto.indexOf('const login = async'), contexto.indexOf('const logout = async'))
  const logoutWeb = contexto.slice(contexto.indexOf('const logout = async'), contexto.indexOf('return (', contexto.indexOf('const logout = async')))
  check(
    'UserContext: el login de la web olvida la sesión de la app solo cuando entró (response.ok)',
    /if \(response\.ok\) \{[\s\S]*?olvidarSesionAppCampo\(localStorage\)[\s\S]*?return true/.test(loginWeb) && (loginWeb.match(/olvidarSesionAppCampo\(localStorage\)/g) ?? []).length === 1,
    loginWeb.slice(0, 600)
  )
  check(
    'UserContext: el logout de la web olvida la sesión de la app y, si el servidor no respondió, deja la marca de salida pendiente',
    /avisado = response\.ok/.test(logoutWeb) && /olvidarSesionAppCampo\(localStorage\)\s*if \(!avisado\) marcarSalidaPendienteAppCampo\(localStorage\)/.test(logoutWeb),
    logoutWeb
  )

  console.log(`\n${passed} pruebas bien, ${failed} con falla`)
  if (failed > 0) process.exit(1)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
