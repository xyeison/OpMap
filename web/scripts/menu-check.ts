/**
 * Menú de la web (dueño, 2026-10-14): pruebas puras de getNavigationMenu, getHomeRoute, getAllowedRoutes y
 * seccionesConfiguracion (lib/permissions.ts). SIN red ni Supabase; solo lee el disco para comprobar que cada
 * opción del menú tiene su página.
 *
 * Reglas: sin Dashboard (los indicadores se generarán después); el Mapa es el menú principal y va primero; luego
 * Hospitales, Terceros, Calendario, Zonas (/kams), Líneas, Ejecutivos Comerciales, Inteligencia, Contratos, Mi
 * Empresa, Cumplimiento, Proveedores, Usuarios y Visitas; Configuración al final. Municipios sale del menú y queda
 * dentro de Configuración (territories:view); Regiones (/zones) se quitó. "/" lleva a la primera opción del menú.
 * Los permisos de cada rol NO cambian, salvo zones:view y zones:edit, que salieron el 2026-10-14 con las Regiones
 * (spec docs/specs/2026-10-14-quitar-regiones.md): sección 8.
 *
 * Uso (desde web/): npx tsx scripts/menu-check.ts   (va dentro de npm run test)
 * Código de salida 1 si alguna prueba falla.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'fs'
import path from 'path'
import {
  PERMISOS_CONFIGURACION,
  getAllowedRoutes,
  getHomeRoute,
  getNavigationMenu,
  hasPermission,
  rolePermissions,
  seccionesConfiguracion,
  type Role,
} from '../lib/permissions'

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

function eq<T>(name: string, actual: T, expected: T) {
  check(name, JSON.stringify(actual) === JSON.stringify(expected), { actual, expected })
}

const ROLES = Object.keys(rolePermissions) as Role[]
const hrefs = (rol: Role | undefined) => getNavigationMenu(rol).map(item => item.href)

// Orden canónico del menú completo (el de admin)
const ORDEN = [
  '/map',
  '/hospitals',
  '/terceros',
  '/calendario',
  '/kams',
  '/lines',
  '/executives',
  '/inteligencia',
  '/contracts',
  '/mi-empresa',
  '/compliance',
  '/providers',
  '/users',
  '/visits',
  '/configuracion',
]

// ---------------------------------------------------------------------------------------------
console.log('1. Menú exacto por rol (orden del dueño, 2026-10-14)')
const ESPERADO: Record<Role, string[]> = {
  admin: ORDEN,
  sales_manager: ['/map', '/hospitals', '/terceros', '/calendario', '/kams', '/lines', '/executives', '/contracts', '/configuracion'],
  line_leader: ['/map', '/hospitals', '/terceros', '/calendario', '/kams', '/lines', '/executives', '/inteligencia', '/contracts', '/configuracion'],
  commercial_director: ['/map', '/hospitals', '/terceros', '/calendario', '/kams', '/lines', '/executives', '/inteligencia', '/contracts', '/providers', '/visits', '/configuracion'],
  hr: ['/calendario', '/lines', '/executives'],
  contract_manager: ['/map', '/hospitals', '/lines', '/executives', '/contracts', '/mi-empresa', '/compliance', '/providers'],
  data_manager: ['/map', '/hospitals', '/terceros', '/kams', '/lines', '/executives', '/inteligencia', '/visits', '/configuracion'],
  viewer: ['/map', '/hospitals', '/terceros', '/lines', '/executives', '/inteligencia'],
  user: ['/map', '/hospitals', '/lines', '/executives'],
}
for (const rol of ROLES) {
  eq(`${rol}: menú`, hrefs(rol), ESPERADO[rol])
}
eq('sin rol: menú vacío', getNavigationMenu(undefined), [])
check('ESPERADO cubre todos los roles', ROLES.every(rol => rol in ESPERADO) && Object.keys(ESPERADO).length === ROLES.length)

// ---------------------------------------------------------------------------------------------
console.log('2. Reglas del orden para todo rol')
for (const rol of ROLES) {
  const menu = hrefs(rol)
  const posiciones = menu.map(href => ORDEN.indexOf(href))
  check(`${rol}: toda opción está en el orden canónico`, posiciones.every(p => p >= 0), menu)
  check(`${rol}: respeta el orden canónico`, posiciones.every((p, i) => i === 0 || p > posiciones[i - 1]), menu)
  check(`${rol}: sin opciones repetidas`, new Set(menu).size === menu.length, menu)
  if (hasPermission(rol, 'map:view')) check(`${rol}: el Mapa va primero`, menu[0] === '/map', menu)
  if (menu.includes('/configuracion')) check(`${rol}: Configuración va al final`, menu[menu.length - 1] === '/configuracion', menu)
  check(
    `${rol}: sin Dashboard, Municipios ni Regiones en el menú`,
    !menu.some(href => ['/', '/dashboard', '/territories', '/zones'].includes(href)) &&
      !getNavigationMenu(rol).some(item => /dashboard|municipios|regiones/i.test(item.name)),
    getNavigationMenu(rol)
  )
  check(
    `${rol}: ningún texto visible dice "KAM", "representante" ni "panel"`,
    getNavigationMenu(rol).every(item => !/kam|representante|panel/i.test(item.name))
  )
}

// ---------------------------------------------------------------------------------------------
console.log('3. Textos visibles del menú')
const nombres = new Map(getNavigationMenu('admin').map(item => [item.href, item.name]))
eq('nombres del menú completo', Object.fromEntries(nombres), {
  '/map': 'Mapa',
  '/hospitals': 'Hospitales',
  '/terceros': 'Terceros',
  '/calendario': 'Calendario',
  '/kams': 'Zonas',
  '/lines': 'Líneas',
  '/executives': 'Ejecutivos Comerciales',
  '/inteligencia': 'Inteligencia',
  '/contracts': 'Contratos',
  '/mi-empresa': 'Mi Empresa',
  '/compliance': 'Cumplimiento',
  '/providers': 'Proveedores',
  '/users': 'Usuarios',
  '/visits': 'Visitas',
  '/configuracion': 'Configuración',
})

// ---------------------------------------------------------------------------------------------
console.log('4. Página de inicio ("/" y el logo)')
for (const rol of ROLES) {
  const inicio = getHomeRoute(rol)
  if (hasPermission(rol, 'map:view')) eq(`${rol}: inicio en /map`, inicio, '/map')
  check(`${rol}: el inicio es la primera opción del menú`, inicio === (hrefs(rol)[0] ?? null), { inicio, menu: hrefs(rol) })
  check(`${rol}: el inicio es una ruta permitida`, inicio !== null && getAllowedRoutes(rol).includes(inicio), inicio)
}
eq('recursos humanos (sin mapa): inicio en /calendario', getHomeRoute('hr'), '/calendario')
eq('sin rol: sin inicio', getHomeRoute(undefined), null)

// ---------------------------------------------------------------------------------------------
console.log('5. Rutas permitidas')
for (const rol of ROLES) {
  const rutas = getAllowedRoutes(rol)
  check(`${rol}: sin "/", /dashboard ni /zones`, !rutas.some(ruta => ['/', '/dashboard', '/zones'].includes(ruta)), rutas)
  check(
    `${rol}: /territories ${hasPermission(rol, 'territories:view') ? 'sí' : 'no'} (su permiso de siempre)`,
    rutas.includes('/territories') === hasPermission(rol, 'territories:view')
  )
  const config = PERMISOS_CONFIGURACION.some(permiso => hasPermission(rol, permiso))
  check(`${rol}: /configuracion ${config ? 'sí' : 'no'}`, rutas.includes('/configuracion') === config)
  check(`${rol}: cada opción del menú es una ruta permitida o propia del rol`, hrefs(rol).every(href => rutas.includes(href) || ['/mi-empresa', '/compliance'].includes(href)), {
    faltan: hrefs(rol).filter(href => !rutas.includes(href)),
  })
}

// ---------------------------------------------------------------------------------------------
console.log('6. Secciones de Configuración (Visitas, Municipios, Asignación)')
const SECCIONES: Record<Role, string[]> = {
  admin: ['visitas', 'municipios', 'asignacion'],
  commercial_director: ['visitas', 'municipios'],
  data_manager: ['municipios'],
  sales_manager: ['municipios'],
  line_leader: ['municipios'],
  hr: [],
  contract_manager: [],
  viewer: [],
  user: [],
}
for (const rol of ROLES) {
  const secciones = seccionesConfiguracion(rol)
  eq(`${rol}: secciones`, secciones, SECCIONES[rol])
  check(`${rol}: Visitas solo con visits:config`, secciones.includes('visitas') === hasPermission(rol, 'visits:config'))
  check(`${rol}: Municipios solo con territories:view`, secciones.includes('municipios') === hasPermission(rol, 'territories:view'))
  check(
    `${rol}: Asignación solo con dashboard:view y recalculate:simple o recalculate:complete (como en el antiguo dashboard)`,
    secciones.includes('asignacion') === (hasPermission(rol, 'dashboard:view') && (hasPermission(rol, 'recalculate:simple') || hasPermission(rol, 'recalculate:complete')))
  )
  check(`${rol}: menú "Configuración" sí y solo si tiene alguna sección`, hrefs(rol).includes('/configuracion') === secciones.length > 0)
}
eq('sin rol: sin secciones', seccionesConfiguracion(undefined), [])
eq('PERMISOS_CONFIGURACION', PERMISOS_CONFIGURACION, ['visits:config', 'territories:view', 'recalculate:simple', 'recalculate:complete'])

// ---------------------------------------------------------------------------------------------
console.log('7. Páginas en disco')
const APP = path.join(__dirname, '..', 'app')
for (const href of ORDEN) {
  check(`${href} tiene su página`, existsSync(path.join(APP, href.slice(1), 'page.tsx')))
}
check('/territories sigue existiendo', existsSync(path.join(APP, 'territories', 'page.tsx')))
check('"/" sigue existiendo (lleva al inicio)', existsSync(path.join(APP, 'page.tsx')))
check('la página /zones (Regiones) ya no existe', !existsSync(path.join(APP, 'zones', 'page.tsx')))
check('/api/dashboard/stats ya no existe', !existsSync(path.join(APP, 'api', 'dashboard', 'stats', 'route.ts')))

// ---------------------------------------------------------------------------------------------
console.log('8. Regiones quitadas de la web (dueño, 2026-10-14)')
const WEB = path.join(__dirname, '..')
// Archivos de código de una carpeta (recursivo, sin copias "archivo 2.ts" que deja el Finder)
function archivosDe(carpeta: string): string[] {
  const out: string[] = []
  for (const nombre of readdirSync(carpeta)) {
    const ruta = path.join(carpeta, nombre)
    if (statSync(ruta).isDirectory()) out.push(...archivosDe(ruta))
    else if (/\.(ts|tsx)$/.test(nombre) && !/ \d+\.(ts|tsx)$/.test(nombre)) out.push(ruta)
  }
  return out
}
const CODIGO = ['app', 'components', 'lib'].flatMap(carpeta => archivosDe(path.join(WEB, carpeta)))
const relativo = (ruta: string) => path.relative(WEB, ruta)
// Rutas de la API: app/api/<...>/route.ts → /api/<...>
const rutasApi = CODIGO.filter(ruta => /[\\/]route\.ts$/.test(ruta) && relativo(ruta).startsWith(`app${path.sep}api${path.sep}`))
  .map(ruta => '/' + path.dirname(relativo(ruta)).split(path.sep).slice(1).join('/'))
check('hay rutas de la API para revisar', rutasApi.length > 20, rutasApi.length)
check('ninguna ruta /api/zones ni /api/zones/** existe', !rutasApi.some(ruta => ruta === '/api/zones' || ruta.startsWith('/api/zones/')), rutasApi.filter(ruta => ruta.startsWith('/api/zones')))
check('la carpeta app/api/zones ya no existe', !existsSync(path.join(APP, 'api', 'zones')))
check('/api/kams/zone ya no existe', !rutasApi.includes('/api/kams/zone'))
check('/api/business-lines/[id]/zones (zonas de una línea) sigue: no es de Regiones', rutasApi.includes('/api/business-lines/[id]/zones'))
for (const rol of ROLES) {
  const deRegiones = (rolePermissions[rol] as string[]).filter(permiso => permiso.startsWith('zones:'))
  check(`${rol}: ningún permiso zones:*`, deRegiones.length === 0, deRegiones)
}
const conCodigo = (patron: RegExp) => CODIGO.filter(ruta => patron.test(readFileSync(ruta, 'utf8'))).map(relativo)
eq('ningún archivo pide zones:view ni zones:edit', conCodigo(/['"`]zones:(view|edit)['"`]/), [])
eq('nadie llama a /api/zones ni a /api/kams/zone', conCodigo(/\/api\/zones\b|\/api\/kams\/zone\b/), [])
eq('nadie lee la tabla zones', conCodigo(/\.from\(\s*['"`]zones['"`]\s*\)/), [])
// Texto visible: sin comentarios, ninguna "Región" ni "Regiones". Primero los de línea (// al inicio o tras un
// espacio: un "// /geo/*.json" abriría si no un falso /* */) y luego los de bloque (/* */ y {/* */}).
const sinComentarios = (texto: string) =>
  texto.split('\n').map(linea => linea.replace(/(^|\s)\/\/.*$/, '')).join('\n').replace(/\/\*[\s\S]*?\*\//g, '')
const pantallas = CODIGO.filter(ruta => ruta.endsWith('.tsx') && !relativo(ruta).startsWith(`lib${path.sep}`))
eq(
  'ninguna pantalla de app/ ni components/ dice "Región" ni "Regiones"',
  pantallas.filter(ruta => /regi[oó]n(es)?\b/i.test(sinComentarios(readFileSync(ruta, 'utf8')))).map(relativo),
  []
)
eq('Zonas (/kams) sin "Por Regiones"', /Por Regiones/.test(readFileSync(path.join(APP, 'kams', 'page.tsx'), 'utf8')), false)

// ---------------------------------------------------------------------------------------------
console.log(`\n${passed} pruebas bien, ${failed} con falla`)
if (failed > 0) process.exit(1)
