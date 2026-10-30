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

console.log(`\n${passed} pruebas bien, ${failed} con falla`)
if (failed > 0) process.exit(1)
