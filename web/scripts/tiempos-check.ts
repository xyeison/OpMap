/**
 * Tiempos de /api/me/* (spec docs/specs/2026-10-15-usabilidad-y-agenda-con-hora.md, sección 18 y paquete 4): pruebas
 * puras de cronometro (app/api/me/_lib/tiempos.ts) con un reloj falso, la cabecera Server-Timing, la línea [tiempos]
 * sin contenido (solo el patrón de la ruta y números) y leerPorIds con trozos en paralelo y un lector falso. SIN red
 * ni Supabase.
 *
 * Uso (desde web/): npx tsx scripts/tiempos-check.ts   (va dentro de npm run test)
 * Código de salida 1 si alguna prueba falla.
 */

// Módulo propio (sus variables no se mezclan con las de otros scripts). El paquete 4 añade aquí sus imports y pruebas.
export {}

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

console.log('\n18. Tiempos de /api/me/*: cronometro, Server-Timing, [tiempos] y leerPorIds')

// ---------------------------------------------------------------------------------------------
console.log(`\n${passed} pruebas bien, ${failed} con falla`)
if (failed > 0) process.exit(1)
