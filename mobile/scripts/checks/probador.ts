/**
 * Lo que recibe cada archivo de pruebas de scripts/checks/ (secciones 15 a 19 de scripts/movil-check.ts, spec
 * 2026-10-15): las mismas check, seccion y lanza del mini marco de movil-check.ts. Cada archivo exporta
 * `export async function pruebas(t: Probador): Promise<void>`; movil-check.ts los corre al final y
 * scripts/checks/correr.ts corre uno solo.
 */

export interface Probador {
  /** Una prueba: ✓ si ok, ✗ con el detalle si no (cuenta la falla). */
  check(nombre: string, ok: boolean, detalle?: unknown): void
  /** Título de una sección o de un bloque. */
  seccion(titulo: string): void
  /** Corre fn y devuelve el mensaje de lo que lanzó, o null si no lanzó. */
  lanza(fn: () => unknown | Promise<unknown>): Promise<string | null>
}

export type ArchivoDePruebas = (t: Probador) => Promise<void>

/** Un probador con sus propios contadores (lo usa correr.ts). */
export function crearProbador(): { t: Probador; total: () => number; fallas: () => number } {
  let total = 0
  let fallas = 0
  const t: Probador = {
    check(nombre, ok, detalle) {
      total++
      if (ok) {
        console.log(`  ✓ ${nombre}`)
      } else {
        fallas++
        console.log(`  ✗ ${nombre}${detalle !== undefined ? ` → ${JSON.stringify(detalle)}` : ''}`)
      }
    },
    seccion(titulo) {
      console.log(`\n${titulo}`)
    },
    async lanza(fn) {
      try {
        await fn()
        return null
      } catch (error) {
        return error instanceof Error ? error.message : String(error)
      }
    },
  }
  return { t, total: () => total, fallas: () => fallas }
}
