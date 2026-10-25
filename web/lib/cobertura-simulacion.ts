// Simulación de cobertura y estados de plaza para la pantalla "Zonas" por línea. PURO: sin E/S, sin Supabase, sin
// Google. Lo usan POST /api/coverage/simular (vista previa antes de guardar), GET /api/kams/zonas (estado de cada Zona
// y detección de cobertura desactualizada) y scripts/cobertura-simulacion-check.ts.
//
// Reglas (spec docs/specs/2026-10-23-zonas-por-linea-para-lideres.md; decisión del dueño del 2026-10-23):
//   - El motor NO cambia: computeCoverage (lib/coverage.ts) decide manual → local/conflicto → alcance → sin cobertura.
//     Aquí solo se preparan entradas alternativas y se comparan resultados.
//   - La vacante (executives.status = 'placeholder') es ELEGIBLE COMO UNA PERSONA: es una plaza autorizada por la
//     gerencia ("es como si ya tuviéramos contratado a una persona"). Si lleva la línea y vive en la Zona, la Zona queda
//     local (estado 'reservada'); y compite por alcance hacia las vecinas igual que una persona ("si no hay en Cartagena,
//     yo puedo llegar hasta Cartagena"). Un ajuste manual desde otra ciudad queda bloqueado por una vacante residente que
//     lleve la línea, como lo bloquearía una persona (regla del dueño del 2026-10-11).
//   - estadoDePlaza: local/manual + active → 'ocupada'; local/manual + placeholder → 'reservada'; reach → 'alcance';
//     vacant → 'sin_cobertura' (la celda sin nadie dentro del tope; ya no se llama "Vacante"); conflict → 'conflicto'.
//     has_equipment NO cambia el estado: va aparte como la insignia "Sin equipo" (ZonaEnLinea.sinEquipo).
//   - simularCobertura calcula SIEMPRE el "antes" con computeCoverage sobre las entradas recibidas, nunca con la tabla
//     coverage (que puede estar desactualizada), y el diff trae solo las celdas cuyo kind o executive_id cambia, en orden
//     de línea (como vienen en inputs.lines) y Zona (por nombre).
//   - aplicarCambios devuelve copias: nunca muta las entradas (la misma carga sirve para varias vistas previas).
//     linea_agregar y linea_quitar son idempotentes; 'ajuste' añade un override activo { id: 'sim:<line>:<kam>',
//     reason: 'simulación' } y desactiva el activo previo de esa (línea, Zona); 'quitar_ajuste' desactiva por id.
//   - coberturaDesactualizada compara la tabla guardada con la calculada celda a celda (kind y executive_id; también
//     celdas que faltan o sobran): si difiere, GET /api/kams/zonas recalcula y guarda (sin Google).
//
// Imports relativos (no '@/') para que tsx pueda correr el script de verificación.
import { computeCoverage, type CoverageComputeInputs } from './coverage'
import type { ComputedCoverage, CoverageKind, CoverageOverrideInput, ZoneMatrix } from './types/coverage'
import { ESTADOS_PLAZA, type Cambio, type DiffCelda, type EstadoPlaza } from './types/zonas'

export type { Cambio, DiffCelda } from './types/zonas'

const SIM_OVERRIDE_REASON = 'simulación'

/** Id del ajuste manual simulado de (línea, Zona): 'sim:<line_id>:<kam_id>'. */
const simOverrideId = (lineId: string, kamId: string) => `sim:${lineId}:${kamId}`

const celdaKey = (lineId: string, kamId: string) => `${lineId}|${kamId}`

function compareNombres(a: string, b: string): number {
  return a.localeCompare(b, 'es', { sensitivity: 'base' })
}

// ---------------------------------------------------------------------------
// Cambios sobre las entradas del motor
// ---------------------------------------------------------------------------

/**
 * Aplica los cambios a una COPIA de las entradas (las recibidas no se tocan) y la devuelve lista para computeCoverage.
 *  - linea_agregar: añade la fila de executive_lines si no existe (idempotente).
 *  - linea_quitar: quita la fila si existe (idempotente).
 *  - ajuste: desactiva el override activo previo de esa (línea, Zona) y añade uno activo con id 'sim:<line>:<kam>' y
 *    motivo 'simulación'. Si el ajuste no procede (la persona no lleva la línea, hay residente con la línea...),
 *    computeCoverage lo deja sin efecto con su nota, igual que con un ajuste real.
 *  - quitar_ajuste: desactiva el override con ese id (si no existe, no pasa nada).
 */
export function aplicarCambios(inputs: CoverageComputeInputs, cambios: Cambio[]): CoverageComputeInputs {
  let executiveLines = inputs.executiveLines.map(link => ({ ...link }))
  const overrides: CoverageOverrideInput[] = inputs.overrides.map(override => ({ ...override }))

  for (const cambio of cambios) {
    switch (cambio.tipo) {
      case 'linea_agregar': {
        const existe = executiveLines.some(
          link => link.executive_id === cambio.executive_id && link.line_id === cambio.line_id
        )
        if (!existe) executiveLines.push({ executive_id: cambio.executive_id, line_id: cambio.line_id })
        break
      }
      case 'linea_quitar': {
        executiveLines = executiveLines.filter(
          link => !(link.executive_id === cambio.executive_id && link.line_id === cambio.line_id)
        )
        break
      }
      case 'ajuste': {
        for (const override of overrides) {
          if (override.active && override.line_id === cambio.line_id && override.kam_id === cambio.kam_id) {
            override.active = false
          }
        }
        overrides.push({
          id: simOverrideId(cambio.line_id, cambio.kam_id),
          line_id: cambio.line_id,
          kam_id: cambio.kam_id,
          executive_id: cambio.executive_id,
          reason: SIM_OVERRIDE_REASON,
          active: true,
        })
        break
      }
      case 'quitar_ajuste': {
        for (const override of overrides) {
          if (override.id === cambio.override_id) override.active = false
        }
        break
      }
    }
  }

  return {
    ...inputs,
    zones: [...inputs.zones],
    lines: [...inputs.lines],
    executives: [...inputs.executives],
    lineZones: [...inputs.lineZones],
    executiveLines,
    overrides,
  }
}

// ---------------------------------------------------------------------------
// Simulación y diff
// ---------------------------------------------------------------------------

/**
 * Celdas cuyo kind o executive_id cambia entre dos cálculos, en orden de línea (posición en inputs.lines) y Zona (por
 * nombre). Una celda que solo cambia de nota o de más cercana NO entra. Las dos listas cubren las mismas (línea, Zona)
 * porque aplicarCambios no toca líneas ni Zonas; si una celda faltara en un lado, se omite.
 */
export function diffCobertura(
  antes: ComputedCoverage[],
  despues: ComputedCoverage[],
  inputs: Pick<CoverageComputeInputs, 'lines' | 'zones'>
): DiffCelda[] {
  const antesPorCelda = new Map(antes.map(row => [celdaKey(row.line_id, row.kam_id), row]))
  const ordenLinea = new Map(inputs.lines.map((line, index) => [line.id, index]))
  const nombreZona = new Map(inputs.zones.map(zone => [zone.id, zone.name]))

  const diff: DiffCelda[] = []
  for (const row of despues) {
    const previa = antesPorCelda.get(celdaKey(row.line_id, row.kam_id))
    if (!previa) continue
    if (previa.kind === row.kind && previa.executive_id === row.executive_id) continue
    diff.push({
      line_id: row.line_id,
      kam_id: row.kam_id,
      antes: { kind: previa.kind, executive_id: previa.executive_id },
      despues: { kind: row.kind, executive_id: row.executive_id },
    })
  }

  diff.sort(
    (a, b) =>
      (ordenLinea.get(a.line_id) ?? 0) - (ordenLinea.get(b.line_id) ?? 0) ||
      compareNombres(nombreZona.get(a.kam_id) ?? '', nombreZona.get(b.kam_id) ?? '') ||
      a.kam_id.localeCompare(b.kam_id)
  )
  return diff
}

/**
 * Vista previa: cobertura antes (computeCoverage sobre las entradas; NUNCA la tabla coverage), después (con los
 * cambios aplicados a una copia) y el diff de celdas que cambian de kind o de executive_id.
 */
export function simularCobertura(
  inputs: CoverageComputeInputs,
  matrix: ZoneMatrix,
  cambios: Cambio[]
): { antes: ComputedCoverage[]; despues: ComputedCoverage[]; diff: DiffCelda[] } {
  const antes = computeCoverage(inputs, matrix)
  const despues = computeCoverage(aplicarCambios(inputs, cambios), matrix)
  return { antes, despues, diff: diffCobertura(antes, despues, inputs) }
}

// ---------------------------------------------------------------------------
// Estados de plaza
// ---------------------------------------------------------------------------

/**
 * Estado visible de una celda: local/manual con persona activa → 'ocupada'; local/manual con vacante (placeholder) →
 * 'reservada'; reach → 'alcance'; vacant → 'sin_cobertura'; conflict → 'conflicto'. `hasEquipment` se recibe para que la
 * firma sea estable, pero NO cambia el estado (la insignia "Sin equipo" va aparte). Una celda local/manual siempre
 * trae a quien responde; si llegara sin nadie se trata como 'ocupada'.
 */
export function estadoDePlaza(
  kind: CoverageKind,
  ejecutivo: { status: 'active' | 'placeholder' | 'inactive' } | null | undefined,
  _hasEquipment: boolean
): EstadoPlaza {
  switch (kind) {
    case 'local':
    case 'manual':
      return ejecutivo?.status === 'placeholder' ? 'reservada' : 'ocupada'
    case 'reach':
      return 'alcance'
    case 'conflict':
      return 'conflicto'
    case 'vacant':
    default:
      return 'sin_cobertura'
  }
}

/** Celda comparable entre la tabla coverage y el cálculo en memoria. */
export interface CeldaComparable {
  line_id: string
  kam_id: string
  kind: CoverageKind | string
  executive_id: string | null
}

/**
 * true si la cobertura guardada difiere de la calculada en alguna celda: distinto kind o executive_id, o celdas que
 * faltan o sobran en cualquiera de los dos lados. El orden no importa. No compara minutos ni notas.
 */
export function coberturaDesactualizada(guardada: CeldaComparable[], calculada: CeldaComparable[]): boolean {
  const guardadaPorCelda = new Map(guardada.map(celda => [celdaKey(celda.line_id, celda.kam_id), celda]))
  const calculadaPorCelda = new Map(calculada.map(celda => [celdaKey(celda.line_id, celda.kam_id), celda]))
  if (guardadaPorCelda.size !== calculadaPorCelda.size) return true

  let distinta = false
  calculadaPorCelda.forEach((celda, clave) => {
    if (distinta) return
    const previa = guardadaPorCelda.get(clave)
    if (!previa || previa.kind !== celda.kind || (previa.executive_id ?? null) !== (celda.executive_id ?? null)) {
      distinta = true
    }
  })
  return distinta
}

/** Cuántas celdas hay en cada estado (siempre con las cinco claves, aunque valgan 0). */
export function resumenPorEstado(
  filas: Array<{ kind: CoverageKind; executive?: { status: string } | null }>
): Record<EstadoPlaza, number> {
  const resumen = Object.fromEntries(ESTADOS_PLAZA.map(estado => [estado, 0])) as Record<EstadoPlaza, number>
  for (const fila of filas) {
    const ejecutivo = fila.executive
      ? { status: fila.executive.status as 'active' | 'placeholder' | 'inactive' }
      : null
    resumen[estadoDePlaza(fila.kind, ejecutivo, true)]++
  }
  return resumen
}
