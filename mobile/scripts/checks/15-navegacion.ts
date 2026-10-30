/**
 * Sección 15 de scripts/movil-check.ts (spec 2026-10-15-usabilidad-y-agenda-con-hora, paquete 1):
 * barra de pestañas con íconos (PESTANAS), contraste de bordeControl, Pantalla con teclado y
 * pie, alturas de toque y haptica.ts.
 *
 * Corren en Node, sin React Native ni red (las que revisan una pantalla leen su archivo y miran cada cosa dentro de
 * su bloque: la función, el objeto o el .map() que la contiene). Este solo, desde mobile/:
 *   npx tsx scripts/checks/correr.ts 15-navegacion
 */
import { usarMotorHaptico, vibrarAviso, vibrarExito, vibrarSuave, type ToqueHaptico } from '../../lib/haptica'
import { GLIFOS_ICONOS, type NombreIcono } from '../../lib/iconos-nombres'
import { MAX_LETRAS_PESTANA, OCULTAS, PESTANAS, letras } from '../../lib/navegacion'
import { ALTO_TOQUE_MIN, COLORES_CLAROS, COLORES_OSCUROS, TAMANO, contraste, type Colores } from '../../lib/paleta'
import type { Probador } from './probador'

// Corre en Node (tsx) con el programa de tipos de la app (sin @types/node): fs y path con lo mínimo que se usa.
interface FsMinimo {
  existsSync(ruta: string): boolean
  readFileSync(ruta: string, codificacion: 'utf8'): string
  readdirSync(ruta: string): string[]
  statSync(ruta: string): { isDirectory(): boolean }
}
interface PathMinimo {
  resolve(...partes: string[]): string
  join(...partes: string[]): string
  relative(desde: string, hasta: string): string
}
interface ProcesoMinimo {
  env: Record<string, string | undefined>
  on(evento: 'unhandledRejection', oyente: (motivo: unknown) => void): unknown
  off(evento: 'unhandledRejection', oyente: (motivo: unknown) => void): unknown
}
declare const __dirname: string
const { existsSync, readFileSync, readdirSync, statSync } = require('fs') as FsMinimo
const path = require('path') as PathMinimo
const proceso = process as unknown as ProcesoMinimo

const RAIZ = path.resolve(__dirname, '../..')
const leer = (relativa: string) => readFileSync(path.join(RAIZ, relativa), 'utf8')

// ---------------------------------------------------------------------------
// Leer bloques de código (paréntesis o llaves balanceados, sin contar los de textos ni comentarios)
// ---------------------------------------------------------------------------

/** Desde el primer `abre` en o después de `desde`, el texto hasta su `cierra` (inclusive). '' si no hay. */
export function bloque(texto: string, desde: number, abre = '(', cierra = ')'): string {
  const inicio = texto.indexOf(abre, Math.max(0, desde))
  if (inicio < 0) return ''
  let nivel = 0
  for (let i = inicio; i < texto.length; i++) {
    const ch = texto[i]
    if (ch === '/' && texto[i + 1] === '/') {
      const fin = texto.indexOf('\n', i)
      i = fin < 0 ? texto.length : fin
      continue
    }
    if (ch === '/' && texto[i + 1] === '*') {
      const fin = texto.indexOf('*/', i + 2)
      i = fin < 0 ? texto.length : fin + 1
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      let j = i + 1
      while (j < texto.length && texto[j] !== ch) j += texto[j] === '\\' ? 2 : 1
      i = j
      continue
    }
    if (ch === abre) nivel++
    else if (ch === cierra && --nivel === 0) return texto.slice(inicio, i + 1)
  }
  return ''
}

/** Cuerpo `{ … }` de `function <nombre>(…)` (con o sin export). '' si no está. */
export function cuerpoDeFuncion(texto: string, nombre: string): string {
  const firma = new RegExp(`function ${nombre}\\s*\\(`).exec(texto)
  if (!firma) return ''
  const parametros = bloque(texto, firma.index + firma[0].length - 1)
  const finParametros = texto.indexOf(parametros, firma.index) + parametros.length
  return bloque(texto, finParametros, '{', '}')
}

/** El objeto `{ … }` que sigue a `<clave>:` o a la prop JSX `<clave>={…}` (la primera vez que aparece). '' si no está. */
export function objetoDe(texto: string, clave: string): string {
  const m = new RegExp(`\\b${clave}\\s*[:=]`).exec(texto)
  return m ? bloque(texto, m.index, '{', '}') : ''
}

/** El `( … )` de `<lista>.map(`. '' si no está. */
function mapaDe(texto: string, lista: string): string {
  const i = texto.indexOf(`${lista}.map(`)
  return i < 0 ? '' : bloque(texto, i + lista.length + 4)
}

/** Lo que vale cada término de una expresión `minHeight: …` (TAMANO.x, ALTO_TOQUE_MIN o un número). */
function alturasDe(expresion: string): number[] {
  const valores: number[] = []
  for (const m of expresion.matchAll(/TAMANO\.(\w+)|ALTO_TOQUE_MIN|\b(\d+(?:\.\d+)?)\b/g)) {
    if (m[1]) valores.push(Number((TAMANO as Record<string, number>)[m[1]] ?? Number.NaN))
    else if (m[2]) valores.push(Number(m[2]))
    else valores.push(ALTO_TOQUE_MIN)
  }
  return valores
}

/** ¿El `minHeight:` del bloque vale ≥ ALTO_TOQUE_MIN en todas sus ramas? */
function minHeightTocable(bloqueCodigo: string): { ok: boolean; expresion: string | null; valores: number[] } {
  const m = /minHeight:\s*([^,\n}]+)/.exec(bloqueCodigo)
  const valores = m ? alturasDe(m[1]) : []
  return { ok: valores.length > 0 && valores.every(v => v >= ALTO_TOQUE_MIN), expresion: m ? m[1].trim() : null, valores }
}

/** Rutas de app/(app)/ como las nombra expo-router ('hoy', 'agenda/nueva', 'visita/[id]'), sin _layout. */
function rutasDelGrupo(): string[] {
  const base = path.join(RAIZ, 'app/(app)')
  const rutas: string[] = []
  const recorrer = (dir: string) => {
    for (const nombre of readdirSync(dir)) {
      const ruta = path.join(dir, nombre)
      if (statSync(ruta).isDirectory()) recorrer(ruta)
      else if (/\.tsx?$/.test(nombre) && !/^_layout\.tsx?$/.test(nombre)) rutas.push(path.relative(base, ruta).replace(/\\/g, '/').replace(/\.tsx?$/, ''))
    }
  }
  recorrer(base)
  return rutas.sort()
}

const igualesEnOrden = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x, i) => x === b[i])

export async function pruebas(t: Probador): Promise<void> {
  t.seccion('15. Navegación y kit visual')

  // -------------------------------------------------------------------------
  // Barra de pestañas (app/(app)/_layout.tsx)
  // -------------------------------------------------------------------------
  const layout = leer('app/(app)/_layout.tsx')
  const opcionesBarra = objetoDe(layout, 'screenOptions')
  const estiloBarra = objetoDe(opcionesBarra, 'tabBarStyle')
  t.check('barra: tabBarStyle existe y no fija `height` (la da la librería: 49 pt + el margen del iPhone)', estiloBarra !== '' && !/\b(height|minHeight|maxHeight)\s*:/.test(estiloBarra), estiloBarra)
  t.check('barra: tabBarStyle no toca el relleno de abajo (lo pone la librería con el área segura)', estiloBarra !== '' && !/padding(Bottom|Vertical)?\s*:/.test(estiloBarra), estiloBarra)
  const restos = [/tabBarIcon:\s*\(\)\s*=>\s*null/, /display:\s*'none'/, /'beside-icon'/, /tabBarActiveBackgroundColor/].filter(r => r.test(layout)).map(String)
  t.check("barra: no quedan tabBarIcon: () => null, display: 'none', 'beside-icon' ni tabBarActiveBackgroundColor", restos.length === 0, restos)
  t.check("barra: la etiqueta va debajo del ícono (tabBarLabelPosition: 'below-icon')", /tabBarLabelPosition:\s*'below-icon'/.test(opcionesBarra))
  const estiloEtiqueta = objetoDe(opcionesBarra, 'tabBarLabelStyle')
  t.check('barra: etiqueta a 11 pt con DM Sans media y sin lineHeight forzado', /fontSize:\s*11\b/.test(estiloEtiqueta) && /fuente\('media'\)/.test(estiloEtiqueta) && !/lineHeight/.test(estiloEtiqueta), estiloEtiqueta)
  t.check('barra: la etiqueta no se encoge (flexShrink: 0; si no, el navegador le corta "y", "p", "g" y "j")', /flexShrink:\s*0\b/.test(estiloEtiqueta), estiloEtiqueta)
  t.check(
    'barra: el ícono va en una caja de 24 pt (tabBarIconStyle) y no pasa de 24: ícono + nombre caben en los 39 pt útiles, también sin margen inferior',
    /const ALTO_ICONO_PESTANA = 24\b/.test(layout) && /tabBarIconStyle:\s*\{\s*height:\s*ALTO_ICONO_PESTANA\s*\}/.test(opcionesBarra) && /tamano=\{Math\.min\(size, ALTO_ICONO_PESTANA\)\}/.test(layout)
  )
  t.check('barra: el nombre no crece con el texto grande del sistema (como la barra nativa de iOS)', /tabBarAllowFontScaling:\s*false/.test(opcionesBarra))
  t.check('barra: elegida en acento (negro) y las demás en textoSuave', /tabBarActiveTintColor:\s*c\.acento\b/.test(opcionesBarra) && /tabBarInactiveTintColor:\s*c\.textoSuave\b/.test(opcionesBarra))

  const mapaPestanas = mapaDe(layout, 'PESTANAS')
  t.check('barra: cada pestaña sale de PESTANAS (name={p.ruta}, título y encabezado)', /name=\{p\.ruta\}/.test(mapaPestanas) && /title:\s*p\.titulo/.test(mapaPestanas) && /headerTitle:\s*p\.encabezado \?\? p\.titulo/.test(mapaPestanas), mapaPestanas)
  t.check('barra: cada pestaña lleva su ícono, relleno si está elegida (activo={focused})', /tabBarIcon:\s*\(\{[^}]*\bfocused\b[^}]*\}\)\s*=>/.test(mapaPestanas) && /<Icono nombre=\{p\.icono\} activo=\{focused\}/.test(mapaPestanas), mapaPestanas)
  t.check('barra: las pestañas no llevan href (se ven) ni "Volver"', mapaPestanas !== '' && !/\bhref\b/.test(mapaPestanas) && !/headerLeft/.test(mapaPestanas))
  const mapaOcultas = mapaDe(layout, 'OCULTAS')
  t.check('barra: las pantallas de OCULTAS llevan href: null y "Volver"', /name=\{o\.ruta\}/.test(mapaOcultas) && /href:\s*null/.test(mapaOcultas) && /headerLeft:\s*\(\)\s*=>\s*<BotonVolver \/>/.test(mapaOcultas), mapaOcultas)
  const pantallasSueltas = (layout.match(/<Tabs\.Screen\b/g) ?? []).length
  t.check('barra: no hay <Tabs.Screen> sueltos (todos salen de PESTANAS u OCULTAS)', pantallasSueltas === 2, pantallasSueltas)

  // -------------------------------------------------------------------------
  // PESTANAS y OCULTAS (lib/navegacion.ts)
  // -------------------------------------------------------------------------
  const rutasPestanas = PESTANAS.map(p => p.ruta)
  t.check('PESTANAS es exactamente hoy, reportar, agenda, numeros, ajustes', igualesEnOrden(rutasPestanas, ['hoy', 'reportar', 'agenda', 'numeros', 'ajustes']), rutasPestanas)
  t.check('PESTANAS: Hoy · Reportar · Agenda · Números · Ajustes', igualesEnOrden(PESTANAS.map(p => p.titulo), ['Hoy', 'Reportar', 'Agenda', 'Números', 'Ajustes']), PESTANAS.map(p => p.titulo))
  const largos = PESTANAS.filter(p => letras(p.titulo) > MAX_LETRAS_PESTANA || letras(p.titulo) === 0).map(p => p.titulo)
  t.check(`PESTANAS: cada título tiene ${MAX_LETRAS_PESTANA} letras o menos (cabe entero a 11 pt)`, MAX_LETRAS_PESTANA === 8 && largos.length === 0 && letras('Números') === 7, largos)
  t.check('PESTANAS: Agenda abre "Mi agenda" y Números "Mis números"', PESTANAS.find(p => p.ruta === 'agenda')?.encabezado === 'Mi agenda' && PESTANAS.find(p => p.ruta === 'numeros')?.encabezado === 'Mis números')
  const rutasOcultas = OCULTAS.map(o => o.ruta)
  t.check('OCULTAS (href: null): dias-libres, agenda/nueva, visita/[id], medico/nuevo, sede/nueva y contacto/nuevo', igualesEnOrden([...rutasOcultas].sort(), ['agenda/nueva', 'contacto/nuevo', 'dias-libres', 'medico/nuevo', 'sede/nueva', 'visita/[id]']), rutasOcultas)
  t.check('Días libres dejó la barra: oculta, con el encabezado "Mis días libres"', !rutasPestanas.includes('dias-libres' as never) && OCULTAS.find(o => o.ruta === 'dias-libres')?.encabezado === 'Mis días libres')
  const rutas = rutasDelGrupo()
  const nombradas = [...rutasPestanas, ...rutasOcultas]
  const sinNombrar = rutas.filter(r => !nombradas.includes(r))
  const sinArchivo = nombradas.filter(r => !rutas.includes(r))
  t.check('toda pantalla de app/(app)/ está en PESTANAS u OCULTAS (si no, expo-router la pondría de pestaña)', sinNombrar.length === 0 && rutas.length > 0, sinNombrar)
  t.check('PESTANAS y OCULTAS: cada ruta existe una sola vez y tiene su archivo', sinArchivo.length === 0 && new Set(nombradas).size === nombradas.length, { sinArchivo, nombradas })

  // Íconos: el glyphmap que usa el componente Ionicons del paquete instalado.
  const ionicons = path.join(RAIZ, 'node_modules/@expo/vector-icons/build/Ionicons.js')
  const rutaMapa = path.join(RAIZ, 'node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json')
  const usaEseMapa = existsSync(ionicons) && readFileSync(ionicons, 'utf8').includes('./vendor/react-native-vector-icons/glyphmaps/Ionicons.json')
  const glifos = existsSync(rutaMapa) ? (JSON.parse(readFileSync(rutaMapa, 'utf8')) as Record<string, number>) : {}
  const faltanPestanas = PESTANAS.flatMap(p => [GLIFOS_ICONOS[p.icono].relleno, GLIFOS_ICONOS[p.icono].contorno]).filter(g => !(g in glifos))
  t.check('PESTANAS: cada ícono, relleno y contorno, existe en el glyphmap de Ionicons instalado', usaEseMapa && faltanPestanas.length === 0, faltanPestanas)
  const nombres = Object.keys(GLIFOS_ICONOS) as NombreIcono[]
  const faltanTodos = nombres.flatMap(n => [GLIFOS_ICONOS[n].relleno, GLIFOS_ICONOS[n].contorno]).filter(g => !(g in glifos))
  // Estilo Uber (2026-10-15): 14 + compromiso y agregar (la revisión quitó ubicación y buscar, que no se usaban).
  t.check('íconos: los 16 nombres tienen relleno y contorno en ese glyphmap', nombres.length === 16 && faltanTodos.length === 0, { nombres: nombres.length, faltanTodos })
  t.check('íconos: cada pestaña tiene un ícono distinto', new Set(PESTANAS.map(p => GLIFOS_ICONOS[p.icono].relleno)).size === PESTANAS.length)

  // -------------------------------------------------------------------------
  // Contraste (lib/paleta.ts, WCAG 2.x)
  // -------------------------------------------------------------------------
  const cerca = (a: number, b: number) => Math.abs(a - b) < 0.01
  t.check('contraste(): negro sobre blanco 21:1, mismo color 1:1, el orden no importa, acepta #RGB', cerca(contraste('#000000', '#FFFFFF'), 21) && cerca(contraste('#8A8A8A', '#8A8A8A'), 1) && contraste('#FFFFFF', '#5C5B5B') === contraste('#5C5B5B', '#FFFFFF') && cerca(contraste('#000', '#fff'), 21))
  t.check('contraste(): #777777 sobre blanco da 4,48:1 (el ejemplo de WCAG)', cerca(contraste('#777777', '#FFFFFF'), 4.48), contraste('#777777', '#FFFFFF'))
  t.check('contraste(): un color no válido lanza', (await t.lanza(() => contraste('gris', '#FFFFFF'))) !== null)
  const modos: [string, Colores][] = [['claro', COLORES_CLAROS], ['oscuro', COLORES_OSCUROS]]
  t.check("bordeControl: claro '#8A8A8A', oscuro '#6B6B6B'", COLORES_CLAROS.bordeControl === '#8A8A8A' && COLORES_OSCUROS.bordeControl === '#6B6B6B')
  for (const [modo, c] of modos) {
    for (const fondo of ['superficie', 'fondo'] as const) {
      const r = contraste(c.bordeControl, c[fondo])
      t.check(`bordeControl ≥ 3:1 sobre ${fondo} (${modo}): ${r.toFixed(2)}`, r >= 3, r)
    }
    const suave = contraste(c.textoSuave, c.fondo)
    t.check(`textoSuave sigue ≥ 4,5:1 sobre fondo (${modo}): ${suave.toFixed(2)}`, suave >= 4.5, suave)
    const enBarra = Math.min(contraste(c.textoSuave, c.superficie), contraste(c.acento, c.superficie))
    t.check(`barra: las etiquetas (textoSuave y acento) ≥ 4,5:1 sobre la superficie (${modo})`, enBarra >= 4.5, enBarra)
  }

  // -------------------------------------------------------------------------
  // Kit visual (lib/ui.tsx): teclado, pie, bordes y alturas de toque
  // -------------------------------------------------------------------------
  const ui = leer('lib/ui.tsx')
  t.check('ui.tsx: la paleta y los tamaños vienen de lib/paleta.ts (una sola definición)', /from '\.\/paleta'/.test(ui) && !/'#[0-9a-f]{3,8}'/i.test(ui) && !/export const (COLORES_CLAROS|COLORES_OSCUROS|TAMANO|ALTO_TOQUE_MIN)\b/.test(ui))
  t.check('ALTO_TOQUE_MIN es 44 y ui.tsx lo sigue exportando', ALTO_TOQUE_MIN === 44 && /export \{[^}]*\bALTO_TOQUE_MIN\b[^}]*\}/.test(ui))
  const pantalla = cuerpoDeFuncion(ui, 'Pantalla')
  const inicioScroll = pantalla.indexOf('<ScrollView')
  const finScroll = pantalla.indexOf('</ScrollView>')
  const scroll = inicioScroll >= 0 && finScroll > inicioScroll ? pantalla.slice(inicioScroll, finScroll + '</ScrollView>'.length) : ''
  const aperturaScroll = scroll.slice(0, scroll.indexOf('>\n') + 1)
  t.check('Pantalla: el ScrollView lleva automaticallyAdjustKeyboardInsets (el teclado no tapa el campo)', /\bautomaticallyAdjustKeyboardInsets\b(?!\s*=\s*\{false\})/.test(aperturaScroll), aperturaScroll)
  t.check("Pantalla: keyboardDismissMode 'interactive' en iOS y 'on-drag' en Android (deslizar cierra el teclado)", /keyboardDismissMode=\{Platform\.OS === 'ios' \? 'interactive' : 'on-drag'\}/.test(aperturaScroll), aperturaScroll)
  t.check("Pantalla: sigue con keyboardShouldPersistTaps='handled' (un toque con el teclado abierto no se pierde)", /keyboardShouldPersistTaps="handled"/.test(aperturaScroll))
  t.check('Pantalla: el pie queda fuera del ScrollView, después de él', scroll !== '' && !/\bpie\b/.test(scroll) && pantalla.indexOf('{pie}') > finScroll)
  t.check('Pantalla: sin pie devuelve el cuerpo tal cual (la pantalla de siempre)', /pie === undefined \|\| pie === null \|\| pie === false \? \(\s*cuerpo\s*\)/.test(pantalla))
  t.check('Pantalla: en Android, KeyboardAvoidingView medido desde debajo del encabezado', /Platform\.OS !== 'android'\) return conPie/.test(pantalla) && /<KeyboardAvoidingView behavior="padding" keyboardVerticalOffset=\{alturaEncabezado\}/.test(pantalla) && /useContext\(HeaderHeightContext\) \?\? 0/.test(pantalla))

  const boton = cuerpoDeFuncion(ui, 'Boton')
  const chip = cuerpoDeFuncion(ui, 'Chip')
  const campo = cuerpoDeFuncion(ui, 'Campo')
  const tarjeta = cuerpoDeFuncion(ui, 'Tarjeta')
  const volver = cuerpoDeFuncion(layout, 'BotonVolver')
  for (const [nombre, codigo] of [['Boton', boton], ['Chip', chip], ['BotonVolver', volver]] as const) {
    const altura = minHeightTocable(codigo)
    t.check(`${nombre}: minHeight ≥ ALTO_TOQUE_MIN (44) en todas sus variantes`, altura.ok, altura)
  }
  // Estilo Uber (2026-10-15): el botón secundario y el chip van rellenos de #EEEEEE sin borde (se reconocen por su
  // texto, WCAG 1.4.11); lo que cuidaban estas pruebas sigue en 20-estilo.ts: texto ≥ 4,5:1 sobre ese relleno y lo
  // elegido (negro) contra lo no elegido (#EEEEEE) ≥ 3:1, en los dos modos. El campo de texto sí sigue con bordeControl.
  t.check(
    'botón secundario: relleno c.relleno (sin borde) y texto c.texto',
    /const fondo = [^\n]*variante === 'texto' \? 'transparent' : c\.relleno\b/.test(boton) && /const colorTexto = [^\n]*: c\.texto\b/.test(boton) && !/bordeControl/.test(boton),
    /const fondo = [^\n]*/.exec(boton)?.[0]
  )
  t.check('chip: el inactivo relleno de c.relleno con texto c.texto; el elegido, c.acento con c.sobreAcento', /backgroundColor:\s*activo \? c\.acento : c\.relleno\b/.test(chip) && /color:\s*activo \? c\.sobreAcento : c\.texto\b/.test(chip))
  t.check('bordeControl en el campo (rojo si tiene error, negro con el foco)', /borderColor:\s*error \? c\.peligro : enfocado \? c\.acento : c\.bordeControl\b/.test(campo))
  t.check('la tarjeta sigue con el borde suave (no bordeControl)', /borderColor:\s*c\.borde\b/.test(tarjeta) && !/bordeControl/.test(tarjeta))
  t.check('BotonVolver: ícono "atras" y la palabra "Volver"', /<Icono nombre="atras"/.test(volver) && />Volver</.test(volver) && /accessibilityLabel="Volver"/.test(volver))

  const app = JSON.parse(leer('app.json')) as { expo: { android?: { softwareKeyboardLayoutMode?: string } } }
  t.check("app.json: android.softwareKeyboardLayoutMode 'resize'", app.expo.android?.softwareKeyboardLayoutMode === 'resize')

  // -------------------------------------------------------------------------
  // Vibración (lib/haptica.ts)
  // -------------------------------------------------------------------------
  const plataformaAntes = proceso.env.EXPO_OS
  const sinAtender: unknown[] = []
  const oyente = (motivo: unknown) => {
    sinAtender.push(motivo)
  }
  proceso.on('unhandledRejection', oyente)
  try {
    const llamadas: ToqueHaptico[] = []
    usarMotorHaptico(toque => {
      llamadas.push(toque)
      return Promise.resolve()
    })
    proceso.env.EXPO_OS = 'web'
    vibrarSuave()
    vibrarExito()
    vibrarAviso()
    t.check('háptica: en web no llama a expo-haptics', llamadas.length === 0, llamadas)

    proceso.env.EXPO_OS = 'ios'
    vibrarSuave()
    vibrarExito()
    vibrarAviso()
    t.check('háptica: en el teléfono, suave, éxito y aviso (una vez cada una)', igualesEnOrden(llamadas, ['suave', 'exito', 'aviso']), llamadas)

    usarMotorHaptico(() => {
      throw new Error('sin módulo nativo')
    })
    t.check('háptica: si expo-haptics lanza al llamarlo, no lanza', (await t.lanza(() => (vibrarSuave(), vibrarExito(), vibrarAviso()))) === null)
    usarMotorHaptico(() => Promise.reject(new Error('el teléfono no vibra')))
    t.check('háptica: si la vibración falla (promesa rechazada), no lanza', (await t.lanza(() => (vibrarSuave(), vibrarExito(), vibrarAviso()))) === null)
    await new Promise(resolver => setTimeout(resolver, 20))
    t.check('háptica: …y no deja promesas rechazadas sin atender', sinAtender.length === 0, sinAtender.map(String))

    usarMotorHaptico(null)
    proceso.env.EXPO_OS = 'android'
    t.check('háptica: sin expo-haptics cargable (aquí, Node) tampoco lanza', (await t.lanza(() => vibrarExito())) === null)
  } finally {
    usarMotorHaptico(null)
    if (plataformaAntes === undefined) delete proceso.env.EXPO_OS
    else proceso.env.EXPO_OS = plataformaAntes
    proceso.off('unhandledRejection', oyente)
  }
  const haptica = leer('lib/haptica.ts')
  t.check("haptica.ts: no importa react-native ni expo-haptics arriba (lo carga al vibrar, dentro del try)", !/^import\b[^\n]*from '(react-native|expo-haptics)'/m.test(haptica) && /try \{[\s\S]*require\('expo-haptics'\)|motorExpo\(\)/.test(haptica))
}
