/**
 * La app de campo en la web (/campo, dueño 2026-10-30; spec docs/specs/2026-10-30-app-de-campo-en-la-web.md): pruebas SIN
 * RED de cómo la sirve OpMap.
 *   - middleware.ts: /campo y lo de adentro pasan sin la cookie de la web (es solo la página de la app, sin datos);
 *     /campos u otra página siguen pidiendo sesión; /api/* sigue exigiendo sesión o token.
 *   - next.config.js: las rutas de la app (/campo, /campo/hoy…) reciben su index.html (rewrites "fallback", después de
 *     los archivos de public/campo).
 *   - El build: `npm run build` arma la app con scripts/construir-campo.mjs antes de `next build`, sin EXPO_PUBLIC_API_URL
 *     (la app usa el origen de la página) y sin versionar public/campo.
 *
 * Uso (desde web/): npx tsx scripts/campo-web-check.ts   (va dentro de npm run test)
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { NextRequest } from 'next/server'
import { middleware } from '../middleware'
import { CLAVES_SESION_APP_CAMPO, olvidarSesionAppCampo } from '../lib/app-campo'

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

  console.log('\n4. Un solo ingreso: la web olvida la sesión de la app al entrar y al salir (2026-10-30)')
  const quitadas: string[] = []
  const almacen = { removeItem: (clave: string) => void quitadas.push(clave) }
  olvidarSesionAppCampo(almacen)
  check(
    'olvidarSesionAppCampo quita el token y el perfil de la app (las claves de mobile/lib/almacen.ts y sesion.ts), no su cola sin señal',
    JSON.stringify(quitadas) === JSON.stringify(['opmap.token.v1', 'opmap.perfil.v1']) && !quitadas.some(clave => /cola/.test(clave)),
    quitadas
  )
  let lanzo = false
  try {
    olvidarSesionAppCampo({ removeItem: () => { throw new Error('modo privado') } })
    olvidarSesionAppCampo(null)
  } catch {
    lanzo = true
  }
  check('olvidarSesionAppCampo nunca lanza (sin almacenamiento o en modo privado)', !lanzo)
  const movil = (archivo: string) => readFileSync(path.join(raiz, '..', 'mobile', archivo), 'utf8')
  check(
    'las claves son las mismas que usa la app (CLAVE_TOKEN de almacen.ts y CLAVE_PERFIL de sesion.ts)',
    movil('lib/almacen.ts').includes(`const CLAVE_TOKEN = '${CLAVES_SESION_APP_CAMPO[0]}'`) && movil('lib/sesion.ts').includes(`const CLAVE_PERFIL = '${CLAVES_SESION_APP_CAMPO[1]}'`)
  )
  const contexto = leer('contexts/UserContext.tsx')
  check(
    'UserContext: el login y el logout de la web olvidan la sesión de la app (olvidarSesionAppCampo)',
    (contexto.match(/olvidarSesionAppCampo\(localStorage\)/g) ?? []).length === 2
  )

  console.log(`\n${passed} pruebas bien, ${failed} con falla`)
  if (failed > 0) process.exit(1)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
