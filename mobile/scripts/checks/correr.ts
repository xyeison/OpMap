/**
 * Corre UN archivo de pruebas de scripts/checks/ sin el resto de movil-check.ts (para trabajar en un paquete de la
 * spec 2026-10-15). Desde mobile/:
 *   npx tsx scripts/checks/correr.ts 17-agenda      (también vale "17" o "17-agenda.ts")
 * Carga solo ese archivo: lo que otro paquete tenga a medias no lo detiene. `npm run check` corre todos.
 * Código de salida 1 si alguna prueba falla o si el nombre no es de un archivo de aquí.
 */
import { crearProbador, type ArchivoDePruebas } from './probador'

const ARCHIVOS: Record<string, () => Promise<{ pruebas: ArchivoDePruebas }>> = {
  '15-navegacion': () => import('./15-navegacion'),
  '16-reportar': () => import('./16-reportar'),
  '17-agenda': () => import('./17-agenda'),
  '18-tiempos': () => import('./18-tiempos'),
  '19-pantallas': () => import('./19-pantallas'),
  '20-estilo': () => import('./20-estilo'),
  '21-persona': () => import('./21-persona'),
  '22-tema': () => import('./22-tema'),
}

async function main() {
  const pedido = (process.argv[2] ?? '').trim().replace(/\.ts$/, '')
  const nombre = Object.keys(ARCHIVOS).find(n => n === pedido || n.split('-')[0] === pedido)
  const cargar = nombre ? ARCHIVOS[nombre] : undefined
  if (!nombre || !cargar) {
    console.error(`Uso: npx tsx scripts/checks/correr.ts <archivo>. Archivos: ${Object.keys(ARCHIVOS).join(', ')}`)
    process.exit(1)
    return
  }
  const { pruebas } = await cargar()
  const { t, total, fallas } = crearProbador()
  await pruebas(t)
  console.log(`\n${total() - fallas()}/${total()} pruebas pasaron (${nombre})`)
  if (fallas() > 0) {
    console.log(`${fallas()} fallaron`)
    process.exit(1)
  }
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
