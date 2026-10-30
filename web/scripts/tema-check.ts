/**
 * El tema de OpMap web (etapa 1 del diseño, dueño 2026-10-30; spec docs/specs/2026-10-30-diseno-web-etapa-1.md): pruebas
 * SIN RED de lib/tema.ts. Los papeles de color son los de la app (mobile/lib/paleta.ts), letra por letra; la preferencia
 * (Claro, Oscuro o Automático, por persona, en el navegador); el contraste WCAG en los dos temas; y el script que pone el
 * tema en <html> antes de pintar, que nunca lanza.
 *
 * Uso (desde web/): npx tsx scripts/tema-check.ts   (va dentro de npm run test)
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  CLAVE_TEMA,
  PAPELES_CLAROS,
  PAPELES_OSCUROS,
  SCRIPT_TEMA_INICIAL,
  contraste,
  cssDeTemas,
  leerPreferencia,
  temaEfectivo,
  variableCss,
  type Papeles,
} from '../lib/tema'

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
const paleta = readFileSync(path.join(raiz, '..', 'mobile', 'lib', 'paleta.ts'), 'utf8')

/** Los colores de la app, leídos del archivo (la app no corre en Node: react-native). */
function coloresDeLaApp(nombre: 'COLORES_CLAROS' | 'COLORES_OSCUROS'): Record<string, string> {
  const inicio = paleta.indexOf(`export const ${nombre}: Colores = {`)
  const bloque = paleta.slice(inicio, paleta.indexOf('\n}', inicio))
  return Object.fromEntries(Array.from(bloque.matchAll(/^\s*(\w+): '(#[0-9A-Fa-f]{6})',?\s*$/gm)).map(m => [m[1], m[2]]))
}
const igual = (a: object, b: object) => JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort())

console.log('\n1. Los papeles de color son los de la app, letra por letra')
const claros = coloresDeLaApp('COLORES_CLAROS')
const oscuros = coloresDeLaApp('COLORES_OSCUROS')
check('se leyeron los 23 papeles de cada paleta de la app', Object.keys(claros).length === 23 && Object.keys(oscuros).length === 23, { claros: Object.keys(claros).length, oscuros: Object.keys(oscuros).length })
check('PAPELES_CLAROS = COLORES_CLAROS de mobile/lib/paleta.ts', igual(PAPELES_CLAROS, claros), { web: PAPELES_CLAROS, app: claros })
check('PAPELES_OSCUROS = COLORES_OSCUROS de mobile/lib/paleta.ts', igual(PAPELES_OSCUROS, oscuros), { web: PAPELES_OSCUROS, app: oscuros })

console.log('\n2. La preferencia de cada persona')
check("CLAVE_TEMA = 'opmap.tema.v1' (la misma en OpMap y en la app de este navegador)", CLAVE_TEMA === 'opmap.tema.v1')
check("leerPreferencia: 'claro', 'oscuro' y 'auto' se respetan", leerPreferencia('claro') === 'claro' && leerPreferencia('oscuro') === 'oscuro' && leerPreferencia('auto') === 'auto')
check("leerPreferencia: lo que no se reconoce (otro texto, null, undefined, un número) vale 'auto'", ['xyz', '', null, undefined, 42, '"oscuro"'].every(valor => leerPreferencia(valor) === 'auto'))
check(
  'temaEfectivo: automático sigue al sistema; claro y oscuro mandan sobre él',
  temaEfectivo('auto', true) === 'oscuro' && temaEfectivo('auto', false) === 'claro' && temaEfectivo('claro', true) === 'claro' && temaEfectivo('oscuro', false) === 'oscuro'
)

console.log('\n3. Contraste WCAG en los dos temas (como la app, 20-estilo)')
check('contraste(negro, blanco) = 21', Math.abs(contraste('#000000', '#FFFFFF') - 21) < 0.01)
for (const [nombre, p] of [['claro', PAPELES_CLAROS], ['oscuro', PAPELES_OSCUROS]] as Array<[string, Papeles]>) {
  const pares: Array<[string, number, number]> = [
    ['texto sobre fondo', contraste(p.texto, p.fondo), 4.5],
    ['texto sobre superficie', contraste(p.texto, p.superficie), 4.5],
    ['texto suave sobre fondo', contraste(p.textoSuave, p.fondo), 4.5],
    ['sobre el acento', contraste(p.sobreAcento, p.acento), 4.5],
    ['borde de los campos sobre la superficie', contraste(p.bordeControl, p.superficie), 3],
    ['lo elegido (acento) frente a lo no elegido (relleno)', contraste(p.acento, p.relleno), 3],
  ]
  const bajos = pares.filter(([, valor, minimo]) => valor < minimo).map(([texto, valor]) => `${texto}: ${valor.toFixed(2)}`)
  check(`${nombre}: texto ≥ 4,5:1 y bordes y lo elegido ≥ 3:1`, bajos.length === 0, bajos)
}

console.log('\n4. Las variables CSS de los dos temas')
const css = cssDeTemas()
const bloque = (selector: string) => css.slice(css.indexOf(selector), css.indexOf('}', css.indexOf(selector)))
check("variableCss: kebab-case con el prefijo --color- ('superficieSuave' → --color-superficie-suave)", variableCss('superficieSuave') === '--color-superficie-suave' && variableCss('sobreAcento') === '--color-sobre-acento' && variableCss('fondo') === '--color-fondo')
check('el bloque claro (también :root) tiene los 23 papeles claros', bloque(':root, [data-tema="claro"] {').includes('--color-fondo: #FFFFFF;') && (bloque(':root, [data-tema="claro"] {').match(/--color-/g) ?? []).length === 23)
check('el bloque oscuro tiene los 23 papeles oscuros', bloque('[data-tema="oscuro"] {').includes('--color-fondo: #000000;') && bloque('[data-tema="oscuro"] {').includes('--color-superficie: #161616;') && (bloque('[data-tema="oscuro"] {').match(/--color-/g) ?? []).length === 23)

console.log('\n5. El script que pone el tema antes de pintar')
/** Corre el script como en el navegador, con un window y un document falsos. Devuelve el data-tema que dejó. */
function correrScript(guardado: () => string | null, prefiereOscuro: boolean | null): string | undefined {
  const documento = { documentElement: { dataset: {} as Record<string, string> } }
  const ventana = {
    localStorage: { getItem: () => guardado() },
    matchMedia: prefiereOscuro === null ? undefined : (consulta: string) => ({ matches: consulta.includes('dark') && prefiereOscuro }),
  }
  new Function('window', 'document', SCRIPT_TEMA_INICIAL)(ventana, documento)
  return documento.documentElement.dataset.tema
}
check("guardado 'oscuro' con el sistema claro → oscuro", correrScript(() => 'oscuro', false) === 'oscuro')
check("guardado 'claro' con el sistema oscuro → claro", correrScript(() => 'claro', true) === 'claro')
check('automático (o nada guardado) sigue al sistema', correrScript(() => 'auto', true) === 'oscuro' && correrScript(() => null, false) === 'claro' && correrScript(() => null, true) === 'oscuro')
let lanzo = false
let conBloqueo: string | undefined
try {
  conBloqueo = correrScript(() => {
    throw new Error('almacenamiento bloqueado (modo privado)')
  }, true)
} catch {
  lanzo = true
}
check('con el almacenamiento bloqueado (modo privado) no lanza y queda en automático', !lanzo && conBloqueo === 'oscuro', { lanzo, conBloqueo })
check('sin matchMedia (navegador viejo) → claro', correrScript(() => 'auto', null) === 'claro')

console.log('\n6. El tema y la letra en toda la web (layout, Tailwind y useTema)')
const leer = (archivo: string) => readFileSync(path.join(raiz, archivo), 'utf8')
const layout = leer('app/layout.tsx')
check(
  'app/layout.tsx usa DM Sans de next/font/google con 400, 500 y 700 (como la app), y ya no Inter',
  /import \{ DM_Sans \} from 'next\/font\/google'/.test(layout) && /weight: \['400', '500', '700'\]/.test(layout) && !/Inter\(/.test(layout)
)
check(
  'el tema va antes de pintar: SCRIPT_TEMA_INICIAL en <head> y cssDeTemas() en un <style>; <html> con suppressHydrationWarning',
  /<head>[\s\S]*dangerouslySetInnerHTML=\{\{ __html: SCRIPT_TEMA_INICIAL \}\}[\s\S]*dangerouslySetInnerHTML=\{\{ __html: cssDeTemas\(\) \}\}[\s\S]*<\/head>/.test(layout) &&
    /<html lang="es" suppressHydrationWarning>/.test(layout)
)
check('el cuerpo usa los papeles (bg-fondo text-texto); las páginas siguen en claro (main conserva su fondo de hoy)', /<body className=\{`\$\{dmSans\.className\} bg-fondo text-texto`\}>/.test(layout) && /from-white via-gray-50 to-white/.test(layout))
check(
  'las páginas que esta etapa no rehace siguen en claro aunque el tema sea oscuro: <main> con data-tema="claro" y text-texto (spec, punto 5)',
  /<main data-contenido-principal data-tema="claro" className="[^"]*\btext-texto\b[^"]*">/.test(layout)
)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const tailwind = require('../tailwind.config.js') as { theme: { extend: { colors: Record<string, unknown> } } }
const nombres = (Object.keys(PAPELES_CLAROS) as Array<keyof Papeles>).map(papel => [variableCss(papel).replace('--color-', ''), `var(${variableCss(papel)})`])
const faltan = nombres.filter(([nombre, valor]) => tailwind.theme.extend.colors[nombre] !== valor).map(([nombre]) => nombre)
check('tailwind.config.js: cada papel es un color por nombre que lee su variable (bg-fondo, text-texto-suave, bg-acento…)', faltan.length === 0, faltan)
const useTema = leer('hooks/useTema.ts')
check(
  "useTema: guarda en opmap.tema.v1 sin lanzar, pone data-tema y sigue al sistema (prefers-color-scheme) y a otras pestañas (storage)",
  /window\.localStorage\.setItem\(CLAVE_TEMA, preferencia\)/.test(useTema) && /try \{/.test(useTema) &&
    /dataset\.tema = /.test(useTema) && /\(prefers-color-scheme: dark\)/.test(useTema) && /addEventListener\('storage'/.test(useTema)
)

console.log('\n7. Las páginas rehechas siguen el tema; el ingreso, con el diseño de la app (Tarea 4)')
const propioOscuro = bloque('[data-tema="oscuro"] [data-sigue-tema] {')
check(
  'una página rehecha (data-sigue-tema) sigue el tema aunque <main> vaya en claro: en oscuro recibe los 23 papeles oscuros y los controles del navegador en oscuro (color-scheme)',
  css.includes('[data-tema="oscuro"] [data-sigue-tema] {') &&
    (propioOscuro.match(/--color-/g) ?? []).length === 23 &&
    propioOscuro.includes('--color-fondo: #000000;') &&
    propioOscuro.includes('color-scheme: dark;'),
  propioOscuro
)
check('el bloque oscuro de <html> no lleva color-scheme: las páginas no rehechas conservan sus controles claros', !bloque('[data-tema="oscuro"] {').includes('color-scheme'))
const sinComentarios = (texto: string) => texto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '')
const ingreso = sinComentarios(leer('app/login/page.tsx'))
check('el ingreso sigue el tema de la persona: su raíz lleva data-sigue-tema con bg-fondo y text-texto', /<div data-sigue-tema className="[^"]*\bbg-fondo\b[^"]*\btext-texto\b[^"]*"/.test(ingreso))
/** Las clases de un elemento: className="…", o className={nombre} con `const nombre = '…'` en el mismo archivo. */
function clasesDe(elemento: string, archivo: string): string[] {
  const literal = elemento.match(/className="([^"]*)"/)?.[1]
  const nombre = elemento.match(/className=\{(\w+)\}/)?.[1]
  const texto = literal ?? (nombre ? archivo.match(new RegExp(`const ${nombre} =\\s*'([^']*)'`))?.[1] : undefined) ?? ''
  return texto.split(/\s+/).filter(Boolean)
}
const boton = clasesDe(ingreso.slice(ingreso.indexOf('<button'), ingreso.indexOf('</button>')), ingreso)
check('el botón es el de la app: bg-acento text-sobre-acento, 52 px de alto y radio 10', ['bg-acento', 'text-sobre-acento', 'min-h-[52px]', 'rounded-[10px]'].every(clase => boton.includes(clase)), boton)
const campos = Array.from(ingreso.matchAll(/<input\b[\s\S]*?\/>/g)).map(m => clasesDe(m[0], ingreso))
check(
  'los dos campos son los de la app: borde border-borde-control (negro de 2 con el foco), fondo bg-superficie, 52 px y radio 10',
  campos.length === 2 && campos.every(clases => ['border-borde-control', 'focus:border-acento', 'focus:border-2', 'bg-superficie', 'text-texto', 'min-h-[52px]', 'rounded-[10px]'].every(clase => clases.includes(clase))),
  campos
)
check('las etiquetas se ven sobre cada campo (como en la app) y no se repiten como texto de ejemplo', !/sr-only/.test(ingreso) && !/placeholder="(Correo electrónico|Contraseña)"/.test(ingreso))
check('el error va como el aviso de la app (bg-fondo-peligro text-peligro) y se anuncia (role="alert")', /role="alert"[^>]*className="[^"]*\bbg-fondo-peligro\b[^"]*\btext-peligro\b/.test(ingreso))
check(
  'sin colores de Tailwind en el ingreso (ni azul ni grises): solo los papeles',
  !/\b(?:bg|text|border|ring|placeholder|from|via|to|outline)-(?:white|black|(?:gray|blue|red|slate|zinc|neutral|indigo)-\d{2,3})\b/.test(ingreso),
  ingreso.match(/\b(?:bg|text|border|ring|placeholder|from|via|to|outline)-(?:white|black|(?:gray|blue|red|slate|zinc|neutral|indigo)-\d{2,3})\b/g)
)
check(
  'la lógica del ingreso no cambia: login(email, password) de useUser, el destino seguro (?next=) y el mismo mensaje de error',
  /const success = await login\(email, password\)/.test(ingreso) && /function safeNextPath\(/.test(ingreso) && /router\.push\(nextPath\)/.test(ingreso) && ingreso.includes("setError('Email o contraseña incorrectos')")
)

console.log(`\n${passed} pruebas bien, ${failed} con falla`)
if (failed > 0) process.exit(1)
