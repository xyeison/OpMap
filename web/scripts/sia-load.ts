/**
 * SIA Observa · carga diaria y backfill (Fases 1.5, 2.3 y 3.5 de docs/specs/2026-10-29-agente-sia-observa.md). Corre en el
 * Mac del dueño (SIA corta conexiones fuera de Colombia): launchd la llama a las 02:00 de Bogotá
 * (docs/fases/fase9-sia-observa.md, plantilla en scripts/launchd/co.vgmedical.opmap.sia.plist).
 *
 * Pasos (en este orden; cada uno se puede saltar):
 *   1. Contratos: por entidad validada de IPS pública, ventanas de un mes de los últimos 60 días (o desde --desde).
 *      Solo empresas con objeto de las líneas; de personas naturales nada. Cruce con SECOP y enlace con Contratos.
 *      Avance en fuentes_estado ('sia_observa'), una entidad a la vez (reanudable si se corta).
 *   2. Enlace de los hospital_contracts que ya traen la ficha de SIA (los 53): --enlazar (lo hace solo la primera vez y
 *      cuando se pide). Nada se sobrescribe: las diferencias se aprueban en la app.
 *   3. Fichas y documentos de hasta --fichas N contratos (por defecto 40) y los "Actualizar desde SIA" pendientes.
 *
 * Uso (desde web/):
 *   npx tsx scripts/sia-load.ts                         → diario (60 días, enlaces nuevos, 40 fichas)
 *   npx tsx scripts/sia-load.ts --desde 2024-01-01      → backfill mes a mes desde esa fecha
 *   npx tsx scripts/sia-load.ts --enlazar --solo-enlazar → solo el paso 2
 *   npx tsx scripts/sia-load.ts --guid fbb9612e-… --dry-run → una entidad, sin escribir
 *   --sin-fichas, --fichas N, --max-entidades N, --reiniciar (pasada nueva), --sin-cache
 * No llama a Google ni a la IA (la lectura con Claude es scripts/sia-extraer.ts).
 */
import { getSupabaseAdmin } from '../lib/supabase-admin'
import { enlazarContratosConFicha, procesarFichas, sincronizarContratos } from '../lib/sia-observa/sync'
import { siaFecha } from '../lib/sia-observa/normalizar'
import { crearCliente, leerArgs, log } from './lib/sia-script'

async function main() {
  const args = leerArgs(process.argv.slice(2), ['desde', 'guid', 'fichas', 'max-entidades'], ['enlazar', 'solo-enlazar', 'sin-fichas', 'dry-run', 'reiniciar', 'sin-cache'])
  const desde = typeof args.desde === 'string' ? siaFecha(args.desde) : undefined
  if (args.desde && !desde) throw new Error('--desde debe ser una fecha YYYY-MM-DD')
  const fichas = typeof args.fichas === 'string' ? Number(args.fichas) : 40
  const maxEntidades = typeof args['max-entidades'] === 'string' ? Number(args['max-entidades']) : undefined
  if (!Number.isInteger(fichas) || fichas < 0) throw new Error('--fichas debe ser un entero ≥ 0')
  const db = getSupabaseAdmin()
  const cliente = crearCliente({ sinCache: Boolean(args['sin-cache']) })
  const dryRun = Boolean(args['dry-run'])
  const inicio = Date.now()

  if (!args['solo-enlazar']) {
    log(`1. Contratos ${desde ? `desde ${desde} (backfill)` : 'de los últimos 60 días'}${args.guid ? ` · entidad ${args.guid}` : ''}${dryRun ? ' · SIMULACIÓN' : ''}`)
    const r = await sincronizarContratos({ db, cliente, log, desde: desde ?? undefined, soloGuid: typeof args.guid === 'string' ? args.guid : undefined, maxEntidades, dryRun, reiniciar: Boolean(args.reiniciar) })
    log(`   ${r.mensaje}`)
  }

  // Paso 2: cuando se pide, o la primera vez (todavía ningún contrato de SIA enlazado con Contratos). No cada noche: los que no
  // aparecen se volverían a buscar en ~7 ventanas cada vez.
  const { count: enlazados } = await db.from('sia_contratos').select('id', { count: 'exact', head: true }).not('hospital_contract_id', 'is', null)
  if (args.enlazar || args['solo-enlazar'] || (!dryRun && (enlazados ?? 0) === 0)) {
    log('2. Contratos de OpMap que ya enlazan la ficha de SIA')
    const r = await enlazarContratosConFicha({ db, cliente, log, dryRun })
    log(`   ${r.encontrados} de ${r.revisados} encontrados en SIA`)
    for (const f of r.faltan) log(`   falta: ${f}`)
  }

  if (!args['sin-fichas'] && !args['solo-enlazar'] && !dryRun && fichas > 0) {
    log(`3. Fichas y documentos (hasta ${fichas})`)
    const r = await procesarFichas({ db, cliente, limite: fichas, log })
    log(`   ${r.fichas} fichas · ${r.documentos} documentos (${Object.entries(r.porEstado).map(([k, v]) => `${v} ${k}`).join(', ') || 'ninguno nuevo'})${r.errores ? ` · ${r.errores} fichas con error` : ''}`)
  }

  log(`Listo en ${Math.round((Date.now() - inicio) / 1000)} s · ${cliente.peticiones} peticiones a SIA`)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
