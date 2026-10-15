/**
 * Orden de los médicos en la tarjeta de Reportar (spec 2026-10-15, paquete 2). Puro: sin react-native (lo prueba
 * scripts/checks/16-reportar.ts).
 *
 * Primero los que atienden en la sede elegida ("Atienden en Clínica Norte"), luego los que tienen una sede cerca de
 * aquí (a CERCA_DE_AQUI_M o menos, el más cercano primero) y luego el resto por nombre. Cada médico sale una sola vez:
 * las cantidades no cambian. Sin punto (sin ubicación) no hay "Cerca de aquí": las distancias no se saben.
 */
import { esPunto, type Punto } from './geo'
import type { MedicoOpcion } from './propuesta'

/** Hasta aquí un médico está "cerca de aquí" (la misma distancia de las sedes cercanas del contexto). */
export const CERCA_DE_AQUI_M = 1000

export type ClaveGrupoMedicos = 'sede' | 'cerca' | 'resto'

export interface GrupoMedicos<M extends MedicoOpcion = MedicoOpcion> {
  clave: ClaveGrupoMedicos
  /** "Atienden en Clínica Norte", "Cerca de aquí", "Otros médicos". */
  titulo: string
  medicos: M[]
}

/** La sede conocida más cercana del médico (null si no se sabe ninguna). */
export function distanciaMinima(medico: Pick<MedicoOpcion, 'sedes'>): number | null {
  const distancias = medico.sedes.map(s => s.distancia_m).filter((d): d is number => typeof d === 'number' && Number.isFinite(d))
  return distancias.length > 0 ? Math.min(...distancias) : null
}

/** El nombre sin el título ("Dra. Ana Gómez" → "Ana Gómez"): así "Dr." y "Dra." no parten la lista en dos. */
export function nombreParaOrdenar(nombre: string): string {
  return nombre.replace(/^\s*(dr|dra|doctor|doctora)\.?\s+/i, '').trim()
}

const porNombre = (a: { nombre: string }, b: { nombre: string }) =>
  nombreParaOrdenar(a.nombre).localeCompare(nombreParaOrdenar(b.nombre), 'es', { sensitivity: 'base' }) || a.nombre.localeCompare(b.nombre, 'es')

/**
 * Los médicos en tres grupos (los vacíos no salen): "Atienden en <sede>" (por nombre), "Cerca de aquí" (por distancia
 * y luego por nombre) y el resto por nombre ("Otros médicos"). Por nombre es sin el título (nombreParaOrdenar). El
 * Selector solo pinta los títulos si hay más de uno.
 */
export function ordenarMedicos<M extends MedicoOpcion>(medicos: readonly M[], sedeId: string | null | undefined, punto: Punto | null | undefined): GrupoMedicos<M>[] {
  const enSede: M[] = []
  const cerca: { medico: M; distancia: number }[] = []
  const resto: M[] = []
  let nombreSede: string | null = null
  const conPunto = !!punto && esPunto(punto.lat, punto.lng)
  for (const medico of medicos) {
    const deLaSede = sedeId ? medico.sedes.find(s => s.id === sedeId) : undefined
    if (deLaSede) {
      nombreSede = nombreSede ?? deLaSede.nombre
      enSede.push(medico)
      continue
    }
    const distancia = conPunto ? distanciaMinima(medico) : null
    if (distancia !== null && distancia <= CERCA_DE_AQUI_M) cerca.push({ medico, distancia })
    else resto.push(medico)
  }
  const grupos: GrupoMedicos<M>[] = []
  if (enSede.length > 0) grupos.push({ clave: 'sede', titulo: `Atienden en ${nombreSede ?? 'esta sede'}`, medicos: [...enSede].sort(porNombre) })
  if (cerca.length > 0) {
    grupos.push({
      clave: 'cerca',
      titulo: 'Cerca de aquí',
      medicos: cerca.sort((a, b) => a.distancia - b.distancia || porNombre(a.medico, b.medico)).map(x => x.medico),
    })
  }
  if (resto.length > 0) grupos.push({ clave: 'resto', titulo: 'Otros médicos', medicos: [...resto].sort(porNombre) })
  return grupos
}
