/**
 * "Ver solo" del mapa · pruebas puras (SIN RED, sin Supabase). Pedido del dueño (2026-10-29): "Si yo solamente voy a
 * ver a Johanna, solamente debería verse la zona que tiene ella asignada". Spec:
 * docs/specs/2026-10-29-mapa-filtros-y-leyenda.md
 *
 * Cubre lib/mapa-ver-solo.ts: sin filtro, tocar a alguien deja solo a esa persona; tocar otra la suma; tocar una
 * marcada la quita; sin nadie o con todas marcadas, sin filtro; los ids de otra línea (un enlace viejo) se descartan.
 *
 * Uso (desde web/): npx tsx scripts/mapa-filtros-check.ts   (incluida en npm run test)
 */
import { alternarVerSolo } from '../lib/mapa-ver-solo'

let passed = 0
let failed = 0
function check(name: string, condition: boolean, detail?: unknown) {
  if (condition) {
    passed++
    console.log(`  OK    ${name}`)
  } else {
    failed++
    console.log(`  FALLA ${name}${detail !== undefined ? ` -> ${JSON.stringify(detail)}` : ''}`)
  }
}
const igual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

// Ids de personas (o de Zonas) en el orden de la lista
const TODOS = ['p1', 'p2', 'p3', 'p4']

console.log('"Ver solo" del mapa · pruebas puras (sin red)\n')

console.log('1. Tocar en la lista')
check('sin filtro, tocar a p1: solo p1', igual(alternarVerSolo(null, 'p1', TODOS), ['p1']))
check('tocar otra la suma, en el orden de la lista', igual(alternarVerSolo(['p3'], 'p1', TODOS), ['p1', 'p3']))
check('tocar una marcada la quita', igual(alternarVerSolo(['p1', 'p3'], 'p3', TODOS), ['p1']))
check('quitar la única marcada: sin filtro (se ve todo)', alternarVerSolo(['p1'], 'p1', TODOS) === null)
check('marcar la última que faltaba: sin filtro (todas = todo)', alternarVerSolo(['p1', 'p2', 'p3'], 'p4', TODOS) === null)
check('filtro vacío ([]): tocar a alguien la deja sola', igual(alternarVerSolo([], 'p2', TODOS), ['p2']))

console.log('\n2. Enlaces de otra línea o ids que ya no están')
check('ids de otra línea se descartan al tocar', igual(alternarVerSolo(['p1', 'otra'], 'p2', TODOS), ['p1', 'p2']))
check('si solo había ids de otra línea, tocar a alguien la deja sola', igual(alternarVerSolo(['otra'], 'p3', TODOS), ['p3']))
check('tocar un id que no está en la lista no cambia nada (salvo limpiar los de otra línea)', igual(alternarVerSolo(['p1', 'otra'], 'nadie', TODOS), ['p1']))
check('sin filtro, tocar un id que no está: sigue sin filtro', alternarVerSolo(null, 'nadie', TODOS) === null)

console.log('\n3. Lista de una sola persona')
check('tocarla: solo ella', igual(alternarVerSolo(null, 'p1', ['p1']), ['p1']))
check('tocarla otra vez: sin filtro', alternarVerSolo(['p1'], 'p1', ['p1']) === null)

console.log(`\nResultado: ${passed} OK, ${failed} con fallo`)
if (failed > 0) process.exit(1)
