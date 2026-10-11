// Regla de mayoría para colorear territorios (municipio o localidad de Bogotá). Funciones PURAS,
// sin E/S ni dependencias de servidor: las puede importar el mapa (componente cliente), las rutas
// API y los scripts.
//
// Regla (la misma que aplica hoy components/MapComponent.tsx al pintar territorios):
//   - Cada IPS asignada vota por la zona (kam_id) que la tiene asignada, con un peso igual a sus
//     CAMAS (beds; null o negativo cuenta como 0).
//   - Gana la zona con más camas en ese territorio.
//   - Desempate DETERMINISTA (antes dependía del orden en que llegaban las asignaciones):
//       1. más camas  2. más IPS  3. nombre de la zona (orden alfabético, es)  4. kam_id.
//
// Unidad de territorio (territoryIdOf): la localidad si la IPS la tiene (Bogotá, 11001XX) y si no
// el municipio. Para agrupar por MUNICIPIO (municipality_zone, Fase 2b) se pasa el municipality_id
// directamente: en Bogotá eso da el ganador global de las 20 localidades.

export interface TerritoryVote {
  kam_id: string
  beds: number | null | undefined
}

export interface TerritoryTally {
  kam_id: string
  beds: number
  hospitals: number
}

export interface TerritoryWinner extends TerritoryTally {
  /** Camas de todas las zonas en el territorio. */
  total_beds: number
  /** IPS asignadas de todas las zonas en el territorio. */
  total_hospitals: number
  /** Zonas con al menos una IPS en el territorio. */
  competitors: number
}

/** Nombre de la zona para el desempate alfabético (opcional: sin él se desempata por kam_id). */
export type ZoneNameLookup = (kamId: string) => string | null | undefined

const safeBeds = (beds: number | null | undefined): number => {
  const value = Number(beds)
  return Number.isFinite(value) && value > 0 ? value : 0
}

/** Territorio de una IPS para colorear el mapa: localidad (Bogotá) o, si no tiene, municipio. */
export function territoryIdOf(hospital: { locality_id?: string | null; municipality_id?: string | null }): string | null {
  const locality = (hospital.locality_id || '').trim()
  if (locality) return locality
  const municipality = (hospital.municipality_id || '').trim()
  return municipality || null
}

/** Suma camas e IPS por zona. */
export function tallyVotes(votes: Iterable<TerritoryVote>): TerritoryTally[] {
  const byKam = new Map<string, TerritoryTally>()
  for (const vote of Array.from(votes)) {
    if (!vote.kam_id) continue
    const tally = byKam.get(vote.kam_id) || { kam_id: vote.kam_id, beds: 0, hospitals: 0 }
    tally.beds += safeBeds(vote.beds)
    tally.hospitals += 1
    byKam.set(vote.kam_id, tally)
  }
  return Array.from(byKam.values())
}

/** Orden de la regla de mayoría: el primero es el ganador. */
export function compareTallies(a: TerritoryTally, b: TerritoryTally, nameOf?: ZoneNameLookup): number {
  if (b.beds !== a.beds) return b.beds - a.beds
  if (b.hospitals !== a.hospitals) return b.hospitals - a.hospitals
  if (nameOf) {
    const byName = (nameOf(a.kam_id) || '').localeCompare(nameOf(b.kam_id) || '', 'es', { sensitivity: 'base' })
    if (byName !== 0) return byName
  }
  return a.kam_id < b.kam_id ? -1 : a.kam_id > b.kam_id ? 1 : 0
}

/** Ganador de un territorio a partir de sus votos (IPS asignadas). null si no hay votos. */
export function pickMajorityKam(votes: Iterable<TerritoryVote>, nameOf?: ZoneNameLookup): TerritoryWinner | null {
  const tallies = tallyVotes(votes)
  if (tallies.length === 0) return null
  tallies.sort((a, b) => compareTallies(a, b, nameOf))
  const winner = tallies[0]
  return {
    ...winner,
    total_beds: tallies.reduce((sum, tally) => sum + tally.beds, 0),
    total_hospitals: tallies.reduce((sum, tally) => sum + tally.hospitals, 0),
    competitors: tallies.length,
  }
}

/**
 * Ganador por territorio para un conjunto de IPS asignadas.
 * `territoryOf` decide la unidad (por defecto territoryIdOf: localidad o municipio, como el mapa).
 */
export function computeTerritoryWinners<T extends TerritoryVote>(
  items: Iterable<T>,
  territoryOf: (item: T) => string | null,
  nameOf?: ZoneNameLookup
): Map<string, TerritoryWinner> {
  const votesByTerritory = new Map<string, T[]>()
  for (const item of Array.from(items)) {
    const territory = territoryOf(item)
    if (!territory) continue
    const list = votesByTerritory.get(territory) || []
    list.push(item)
    votesByTerritory.set(territory, list)
  }
  const winners = new Map<string, TerritoryWinner>()
  votesByTerritory.forEach((votes, territory) => {
    const winner = pickMajorityKam(votes, nameOf)
    if (winner) winners.set(territory, winner)
  })
  return winners
}
