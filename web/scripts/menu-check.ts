/**
 * Menú de la web: pruebas puras de getNavigationMenu, agruparMenu, opcionActiva, getHomeRoute, getAllowedRoutes y
 * seccionesConfiguracion (lib/permissions.ts). SIN red ni Supabase; solo lee el disco para comprobar que cada
 * opción del menú tiene su página.
 *
 * Reglas (dueño, 2026-10-29, docs/specs/2026-10-29-menu-por-grupos.md; antes 2026-10-14): sin Dashboard; el Mapa va
 * primero; luego los grupos Terceros (IPS, Cuentas clave, Médicos, Aseguradoras, Proveedores) y Empleados (Ejecutivos
 * Comerciales, Líderes de negocio); Calendario, Zonas (/kams) y Líneas sueltas; el grupo Inteligencia de Mercado
 * (ADRES, Compras públicas, Contratos, Cumplimiento) y el grupo Configuración (Mi Empresa, Usuarios, Visita VMO y
 * Parámetros, al final). Médicos, Aseguradoras y Líderes de negocio abren "Próximamente". Municipios sigue dentro de
 * Parámetros (territories:view); Regiones (/zones) se quitó. "/" lleva al Mapa; sin mapa, a Calendario.
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
  agruparMenu,
  getAllowedRoutes,
  getHomeRoute,
  getNavigationMenu,
  hasPermission,
  opcionActiva,
  rolePermissions,
  seccionesConfiguracion,
  type Role,
} from '../lib/permissions'
import { alternarGrupo, gruposAbiertosAlEntrar } from '../lib/menu-acordeon'

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

// Orden canónico del menú completo (el de admin, más Agendamiento: primero y solo de la líder, 2026-10-30)
const ORDEN = [
  '/campo/agenda',
  '/map',
  '/hospitals',
  '/terceros',
  '/medicos',
  '/aseguradoras',
  '/providers',
  '/executives',
  '/lideres',
  '/calendario',
  '/kams',
  '/lines',
  '/inteligencia',
  '/inteligencia?tab=secop',
  '/contracts',
  '/compliance',
  '/mi-empresa',
  '/users',
  '/visits',
  '/configuracion',
]
const TERCEROS = ['/terceros', '/medicos', '/aseguradoras']
const INTELIGENCIA = ['/inteligencia', '/inteligencia?tab=secop']

// ---------------------------------------------------------------------------------------------
console.log('1. Menú exacto por rol (orden del dueño, 2026-10-29)')
const ESPERADO: Record<Role, string[]> = {
  admin: ORDEN.filter(href => href !== '/campo/agenda'),
  sales_manager: ['/map', '/hospitals', ...TERCEROS, '/executives', '/lideres', '/calendario', '/kams', '/lines', '/contracts', '/configuracion'],
  // Agendamiento (dueño, 2026-10-30): primero, la agenda de la líder en la app de campo
  line_leader: ['/campo/agenda', '/map', '/hospitals', ...TERCEROS, '/executives', '/lideres', '/calendario', '/kams', '/lines', ...INTELIGENCIA, '/contracts', '/configuracion'],
  commercial_director: ['/map', '/hospitals', ...TERCEROS, '/providers', '/executives', '/lideres', '/calendario', '/kams', '/lines', ...INTELIGENCIA, '/contracts', '/visits', '/configuracion'],
  hr: ['/executives', '/lideres', '/calendario', '/lines'],
  contract_manager: ['/map', '/hospitals', '/providers', '/executives', '/lideres', '/lines', '/contracts', '/compliance', '/mi-empresa'],
  data_manager: ['/map', '/hospitals', ...TERCEROS, '/executives', '/lideres', '/kams', '/lines', ...INTELIGENCIA, '/visits', '/configuracion'],
  viewer: ['/map', '/hospitals', ...TERCEROS, '/executives', '/lideres', '/lines', ...INTELIGENCIA],
  user: ['/map', '/hospitals', '/executives', '/lideres', '/lines'],
}
for (const rol of ROLES) {
  eq(`${rol}: menú`, hrefs(rol), ESPERADO[rol])
}
eq('sin rol: menú vacío', getNavigationMenu(undefined), [])
check('ESPERADO cubre todos los roles', ROLES.every(rol => rol in ESPERADO) && Object.keys(ESPERADO).length === ROLES.length)
// La app de campo es solo para las líderes (2026-10-30): solo ellas tienen campo:app y su "Agendamiento"
eq(
  'Agendamiento: "Agendamiento" → /campo/agenda, sin grupo y primero, solo para quien tiene campo:app (line_leader)',
  ROLES.filter(rol => getNavigationMenu(rol).some(item => item.href.startsWith('/campo'))),
  ['line_leader']
)
eq('Agendamiento de la líder', getNavigationMenu('line_leader')[0], { name: 'Agendamiento', href: '/campo/agenda', icon: 'calendar' })
// (hasPermission da todo al admin; el menú sale de la lista de cada rol: el admin no lidera líneas y no lo ve)
eq('campo:app está solo en la lista de line_leader', ROLES.filter(rol => (rolePermissions[rol] ?? []).includes('campo:app')), ['line_leader'])
const navegacion = readFileSync(path.join(__dirname, '..', 'components', 'NavigationWithPermissions.tsx'), 'utf8')
check(
  'el menú abre /campo como página completa (<a>, no Link de Next: la app de campo no es una página de Next)',
  /esAppDeCampo\(item\.href\)/.test(navegacion) && /<a\b[\s\S]{0,200}href=\{item\.href\}/.test(navegacion)
)

// ---------------------------------------------------------------------------------------------
console.log('2. Reglas del orden para todo rol')
for (const rol of ROLES) {
  const menu = hrefs(rol)
  const posiciones = menu.map(href => ORDEN.indexOf(href))
  check(`${rol}: toda opción está en el orden canónico`, posiciones.every(p => p >= 0), menu)
  check(`${rol}: respeta el orden canónico`, posiciones.every((p, i) => i === 0 || p > posiciones[i - 1]), menu)
  check(`${rol}: sin opciones repetidas`, new Set(menu).size === menu.length, menu)
  if (hasPermission(rol, 'map:view')) check(`${rol}: el Mapa va primero (después de Agendamiento, si lo tiene)`, menu.filter(href => href !== '/campo/agenda')[0] === '/map', menu)
  if (menu.includes('/configuracion')) check(`${rol}: Parámetros (/configuracion) va al final`, menu[menu.length - 1] === '/configuracion', menu)
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
  '/hospitals': 'IPS',
  '/terceros': 'Cuentas clave',
  '/medicos': 'Médicos',
  '/aseguradoras': 'Aseguradoras',
  '/providers': 'Proveedores',
  '/executives': 'Ejecutivos Comerciales',
  '/lideres': 'Líderes de negocio',
  '/calendario': 'Calendario',
  '/kams': 'Zonas',
  '/lines': 'Líneas',
  '/inteligencia': 'ADRES',
  '/inteligencia?tab=secop': 'Compras públicas',
  '/contracts': 'Contratos',
  '/compliance': 'Cumplimiento',
  '/mi-empresa': 'Mi Empresa',
  '/users': 'Usuarios',
  '/visits': 'Visita VMO',
  '/configuracion': 'Parámetros',
})
check(
  'ningún rol tiene en el menú "Hospitales" ni "Terceros" como opción',
  ROLES.every(rol => getNavigationMenu(rol).every(item => !/hospital/i.test(item.name) && item.name !== 'Terceros'))
)

// Grupos: títulos (no son enlaces) en el orden del dueño; cada opción suelta es una sección sin título
const grupos = (rol: Role) => agruparMenu(getNavigationMenu(rol)).map(seccion => seccion.grupo ?? seccion.items[0].name)
eq('admin: secciones del menú', grupos('admin'), ['Mapa', 'Terceros', 'Empleados', 'Calendario', 'Zonas', 'Líneas', 'Inteligencia de Mercado', 'Configuración'])
eq(
  'admin: opciones de cada grupo',
  Object.fromEntries(agruparMenu(getNavigationMenu('admin')).filter(seccion => seccion.grupo).map(seccion => [seccion.grupo, seccion.items.map(item => item.name)])),
  {
    Terceros: ['IPS', 'Cuentas clave', 'Médicos', 'Aseguradoras', 'Proveedores'],
    Empleados: ['Ejecutivos Comerciales', 'Líderes de negocio'],
    'Inteligencia de Mercado': ['ADRES', 'Compras públicas', 'Contratos', 'Cumplimiento'],
    'Configuración': ['Mi Empresa', 'Usuarios', 'Visita VMO', 'Parámetros'],
  }
)
eq('user: un grupo solo sale si tiene alguna opción', grupos('user'), ['Mapa', 'Terceros', 'Empleados', 'Líneas'])
for (const rol of ROLES) {
  const titulos = agruparMenu(getNavigationMenu(rol)).map(seccion => seccion.grupo).filter(Boolean)
  check(`${rol}: cada grupo sale una sola vez y con opciones`, new Set(titulos).size === titulos.length && agruparMenu(getNavigationMenu(rol)).every(seccion => seccion.items.length > 0))
}

// Opción activa: ADRES y Compras públicas comparten /inteligencia y se distinguen por ?tab=
const menuAdmin = getNavigationMenu('admin')
eq('activa en /inteligencia: ADRES', opcionActiva(menuAdmin, '/inteligencia', ''), '/inteligencia')
eq('activa en /inteligencia?tab=secop: Compras públicas', opcionActiva(menuAdmin, '/inteligencia', '?tab=secop'), '/inteligencia?tab=secop')
eq('activa en /inteligencia?tab=fuentes (sin opción propia): ADRES', opcionActiva(menuAdmin, '/inteligencia', '?tab=fuentes'), '/inteligencia')
eq('activa en /map?line=trauma: Mapa', opcionActiva(menuAdmin, '/map', '?line=trauma'), '/map')
eq('activa en /territories/x (Municipios): Parámetros', opcionActiva(menuAdmin, '/territories/11001', ''), '/configuracion')
eq('activa en una ruta fuera del menú: ninguna', opcionActiva(menuAdmin, '/hospitals/abc', ''), null)
eq('viewer en /inteligencia?tab=secop: Compras públicas', opcionActiva(getNavigationMenu('viewer'), '/inteligencia', '?tab=secop'), '/inteligencia?tab=secop')

// ---------------------------------------------------------------------------------------------
console.log('4. Página de inicio ("/" y el logo)')
for (const rol of ROLES) {
  const inicio = getHomeRoute(rol)
  if (hasPermission(rol, 'map:view')) eq(`${rol}: inicio en /map`, inicio, '/map')
  const esperado = hrefs(rol).find(href => href === '/map') ?? hrefs(rol).find(href => href === '/calendario') ?? hrefs(rol)[0] ?? null
  check(`${rol}: el inicio es el Mapa; sin mapa, Calendario; si no, la primera opción`, inicio === esperado, { inicio, menu: hrefs(rol) })
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
  const ruta = (href: string) => href.split('?')[0]
  check(`${rol}: cada opción del menú es una ruta permitida o propia del rol`, hrefs(rol).every(href => rutas.includes(ruta(href)) || ['/mi-empresa', '/compliance'].includes(href)), {
    faltan: hrefs(rol).filter(href => !rutas.includes(ruta(href))),
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
for (const ruta of Array.from(new Set(ORDEN.map(href => href.split('?')[0])))) {
  // Agendamiento abre la app de campo, que no es una página de Next: la arma scripts/construir-campo.mjs (campo-web-check)
  if (ruta.startsWith('/campo/')) continue
  check(`${ruta} tiene su página`, existsSync(path.join(APP, ruta.slice(1), 'page.tsx')))
}
check('Agendamiento abre la app de campo: la arma el build (construir-campo.mjs), no es una página de Next', existsSync(path.join(__dirname, 'construir-campo.mjs')) && !existsSync(path.join(APP, 'campo')))
check('/campo/agenda existe en la app de campo (mobile/app/(app)/agenda.tsx)', existsSync(path.join(__dirname, '..', '..', 'mobile', 'app', '(app)', 'agenda.tsx')))
check('/territories sigue existiendo', existsSync(path.join(APP, 'territories', 'page.tsx')))
// Médicos vuelve el 2026-10-30 (dueño: "En la web también, recuerda que son 1 sola tabla para web+app"): la lista, el
// detalle y "Nuevo médico", que solo se crea con CC o CE
const paginaMedicos = readFileSync(path.join(APP, 'medicos', 'page.tsx'), 'utf8')
check(
  '/medicos muestra los médicos (MedicosTab, MedicoDetalleModal y MedicoForm) con terceros:view, ya no "Próximamente"',
  !paginaMedicos.includes('@/components/Proximamente') && /<MedicosTab /.test(paginaMedicos) && /<MedicoDetalleModal/.test(paginaMedicos) && /<MedicoForm/.test(paginaMedicos) && /permission="terceros:view"/.test(paginaMedicos)
)
check(
  '/medicos: "Nuevo médico" arriba solo si la lista cabe en una página; si no, "Crear médico" desde la búsqueda que no encontró a nadie, con ese nombre (dueño, 2026-10-30)',
  /\{puedeCrear && hayVariasPaginas === false && \(/.test(paginaMedicos) &&
    /<MedicosTab [^>]*onCrear=\{puedeCrear \? crearConNombre : undefined\} onPaginacion=\{setHayVariasPaginas\}/.test(paginaMedicos) &&
    /nombreInicial=\{abierto\.nombre\}/.test(paginaMedicos)
)
const COMPONENTES_TERCEROS = path.join(__dirname, '..', 'components', 'terceros')
const listaMedicos = readFileSync(path.join(COMPONENTES_TERCEROS, 'MedicosTab.tsx'), 'utf8')
check(
  'la lista de médicos: sin filtros avisa si pasa de una página; con una búsqueda sin resultados ofrece "Crear médico" con lo buscado',
  /if \(!busqueda && !municipio && !soloMios\) onPaginacion\?\.\(cuantos > TERCEROS_POR_PAGINA\)/.test(listaMedicos) &&
    /\{busqueda && onCrear && \([\s\S]{0,200}onClick=\{\(\) => onCrear\(busqueda\)\}[\s\S]{0,200}Crear médico/.test(listaMedicos)
)
const formularioMedico = readFileSync(path.join(COMPONENTES_TERCEROS, 'MedicoForm.tsx'), 'utf8')
const detalleMedico = readFileSync(path.join(COMPONENTES_TERCEROS, 'MedicoDetalleModal.tsx'), 'utf8')
check(
  'en la web el médico se crea y se corrige solo con CC o CE (TIPOS_DOC_MEDICO_NUEVO); uno guardado con otro tipo pide elegir',
  /TIPOS_DOC_MEDICO_NUEVO\.map/.test(formularioMedico) && !/TIPOS_DOC_MEDICO\.map/.test(formularioMedico) && /TIPOS_DOC_MEDICO_NUEVO\.map/.test(detalleMedico) && !/TIPOS_DOC_MEDICO\.map/.test(detalleMedico) && /elige CC o CE/.test(detalleMedico)
)
// Aseguradoras: "Próximamente", sin datos (dueño, 2026-10-29)
for (const ruta of ['aseguradoras']) {
  // Sin los comentarios (la de Médicos nombra su API para decir que no cambia)
  const pagina = readFileSync(path.join(APP, ruta, 'page.tsx'), 'utf8').split('\n').filter(linea => !linea.trim().startsWith('//')).join('\n')
  check(`/${ruta} es "Próximamente" y no pide datos`, pagina.includes("@/components/Proximamente") && !/\/api\/|fetch\(|Medicos?Tab|MedicoForm/.test(pagina))
}
// Líderes de negocio: el seguimiento de las líderes con lideres:seguimiento (dueño, 2026-10-29); para los demás, "Próximamente"
const paginaLideres = readFileSync(path.join(APP, 'lideres', 'page.tsx'), 'utf8')
check(
  '/lideres: seguimiento con lideres:seguimiento y "Próximamente" para los demás',
  paginaLideres.includes('permission="lideres:seguimiento"') && paginaLideres.includes('@/components/Proximamente') && paginaLideres.includes('SeguimientoLideres')
)
check(
  'lideres:seguimiento solo lo tienen admin y commercial_director',
  JSON.stringify((['admin', 'commercial_director', 'line_leader', 'sales_manager', 'data_manager', 'viewer', 'hr', 'contract_manager', 'user'] as Role[]).filter(rol => hasPermission(rol, 'lideres:seguimiento'))) ===
    JSON.stringify(['admin', 'commercial_director'])
)
const cuentasClave = readFileSync(path.join(APP, 'terceros', 'page.tsx'), 'utf8')
check('Cuentas clave (/terceros) ya no muestra Médicos', !/import [^\n]*Medico/.test(cuentasClave) && cuentasClave.includes('Cuentas clave'))
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
console.log('9. El armazón con el diseño de la app: menú en acordeón y tema (dueño, 2026-10-30)')
{
  const seccionesAdmin = agruparMenu(getNavigationMenu('admin'))
  eq('gruposAbiertosAlEntrar: en Médicos se abre Terceros', gruposAbiertosAlEntrar(seccionesAdmin, '/medicos'), ['Terceros'])
  eq('gruposAbiertosAlEntrar: en Mapa (opción suelta) no se abre ninguno', gruposAbiertosAlEntrar(seccionesAdmin, '/map'), [])
  eq('gruposAbiertosAlEntrar: sin opción abierta, ninguno', gruposAbiertosAlEntrar(seccionesAdmin, null), [])
  eq('alternarGrupo abre el que estaba cerrado', alternarGrupo(['Empleados'], 'Terceros'), ['Empleados', 'Terceros'])
  eq('alternarGrupo cierra el que estaba abierto y deja los demás', alternarGrupo(['Terceros', 'Empleados'], 'Terceros'), ['Empleados'])
  const layoutWeb = readFileSync(path.join(__dirname, '..', 'app', 'layout.tsx'), 'utf8')
  check(
    'cada título de grupo es un botón con aria-expanded y aria-controls que lo abre o lo cierra (alternarGrupo)',
    /<button[\s\S]{0,400}aria-expanded=\{abierto\}[\s\S]{0,120}aria-controls=\{listaId\}/.test(navegacion) && /alternarGrupo\(/.test(navegacion) && /hidden=\{!abierto\}/.test(navegacion)
  )
  check('al entrar, abierto el grupo de la página abierta (gruposAbiertosAlEntrar)', /gruposAbiertosAlEntrar\(secciones, activa\)/.test(navegacion))
  check('las opciones sueltas (Agendamiento, Mapa, Calendario, Zonas, Líneas) van fuera de los grupos, siempre a la vista', /if \(!seccion\.grupo\)/.test(navegacion))
  check(
    'el menú es un div role="navigation" (nunca <nav>: globals.css fija todo <nav> y la lista no se desplazaría)',
    /role="navigation"/.test(navegacion) && (sinComentarios(navegacion).match(/<nav\b/g) ?? []).length === 1
  )
  check(
    'en el Mapa la barra conserva su alto (h-12 md:h-16) y el menú sigue de cajón; fuera, en escritorio, va fijo',
    /isMap \? 'h-12 md:h-16/.test(navegacion) && /const fijo = !isMap/.test(navegacion) && /lg:translate-x-0/.test(navegacion)
  )
  check(
    'con el menú fijo, el contenido se corre en escritorio ([data-contenido-principal] en el layout)',
    /\[data-contenido-principal\]/.test(navegacion) && /<main data-contenido-principal/.test(layoutWeb)
  )
  check(
    'el selector de tema: Claro, Oscuro y Automático, con elegir de useTema',
    /const \{ preferencia, elegir \} = useTema\(\)/.test(navegacion) &&
      /\[\['claro', 'Claro'\], \['oscuro', 'Oscuro'\], \['auto', 'Automático'\]\]/.test(navegacion) &&
      /onClick=\{\(\) => elegir\(valor\)\}/.test(navegacion)
  )
  check('lo que se toca mide al menos 44 px (min-h-[44px])', (navegacion.match(/min-h-\[44px\]/g) ?? []).length >= 3)
  check(
    'el menú muestra todas las opciones del rol: las de getNavigationMenu (usePermissions), agrupadas y sin quitar ninguna',
    /agruparMenu\(menuItems\)/.test(navegacion) && /seccion\.items\.map\(/.test(navegacion) && !/menuItems\.(filter|slice)\(/.test(navegacion)
  )
  check(
    'la opción marcada sigue la pestaña (?tab=, ADRES y Compras públicas) con useSearchParams, en su propio Suspense',
    /<Suspense fallback=\{null\}>\s*<PestanaActual/.test(navegacion) && /useSearchParams\(\)/.test(navegacion)
  )
  check('en escritorio el menú fijo queda debajo de las ventanas de las páginas (lg:z-40; ellas van en z-50 o más)', /lg:z-40/.test(navegacion))
  check(
    'el armazón usa los papeles de la app (bg-fondo, bg-superficie, bg-acento text-sobre-acento, text-texto-suave) y no los grises fijos de antes',
    /bg-fondo/.test(navegacion) && /bg-superficie/.test(navegacion) && /bg-acento text-sobre-acento/.test(navegacion) && /text-texto-suave/.test(navegacion) && !/bg-gray-900|text-gray-700|bg-white/.test(navegacion)
  )
}

// ---------------------------------------------------------------------------------------------
console.log(`\n${passed} pruebas bien, ${failed} con falla`)
if (failed > 0) process.exit(1)
