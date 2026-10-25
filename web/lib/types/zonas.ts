// Tipos de la pantalla "Zonas" por línea (spec docs/specs/2026-10-23-zonas-por-linea-para-lideres.md; decisión del
// dueño en docs/decisiones/2026-10-23-zonas-por-linea-las-lideres-asignan.md).
//
// Contrato compartido entre la API (GET /api/kams/zonas?line=<code>, POST /api/coverage/simular) y la página /kams:
// quien construye la UI y quien construye la API se atienen a estas formas. Modelo: ZONA = fila de kams (kam_id),
// PERSONA o VACANTE = executives (status 'active' o 'placeholder'), LÍNEA = business_lines. La cobertura se calcula en
// memoria con lib/coverage.ts y se traduce a un EstadoPlaza en lib/cobertura-simulacion.ts (estadoDePlaza).
//
// Vocabulario visible: "Ocupada" (una persona la cubre, local o por ajuste manual), "Reservada" (la cubre una vacante
// autorizada por la gerencia: una plaza que cuenta como persona), "Por alcance", "Sin cobertura" (la celda sin nadie
// dentro del tope; antes se llamaba "Vacante", lo que la confundía con la vacante por contratar) y "Conflicto".

import type { CoverageKind } from './coverage'

// ---------------------------------------------------------------------------
// Contratos compartidos (GET /api/kams/zonas)
// ---------------------------------------------------------------------------

/** Estado de una Zona en una línea, derivado del kind de la cobertura y del status de quien responde. */
export type EstadoPlaza = 'ocupada' | 'reservada' | 'alcance' | 'sin_cobertura' | 'conflicto'

/** Los cinco estados, en el orden en que salen los chips de la línea. */
export const ESTADOS_PLAZA: readonly EstadoPlaza[] = ['ocupada', 'reservada', 'alcance', 'sin_cobertura', 'conflicto'] as const

/** Texto visible de cada estado (sin "KAM"; la celda sin nadie es "Sin cobertura", no "Vacante"). */
export const ESTADO_PLAZA_LABELS: Record<EstadoPlaza, string> = {
  ocupada: 'Ocupada',
  reservada: 'Reservada',
  alcance: 'Por alcance',
  sin_cobertura: 'Sin cobertura',
  conflicto: 'Conflicto',
}

/** Persona o vacante (executives) con lo mínimo para mostrarla. Las inactivas nunca aparecen. */
export interface EjecutivoRef {
  id: string
  nombre: string
  status: 'active' | 'placeholder'
}

/** Qué pasa con la Zona en la línea elegida (derivado de la cobertura calculada en memoria). */
export interface ZonaEnLinea {
  estado: EstadoPlaza
  /** Quién responde (local, por alcance o por ajuste); null si está sin cobertura o en conflicto. */
  ejecutivo: EjecutivoRef | null
  /** Zona base desde la que llega quien responde por alcance o por ajuste; null si es local. */
  desde: { kam_id: string; nombre: string } | null
  /** Minutos de carro desde `desde` (0 si es local); null si no aplica. */
  minutos: number | null
  /** Sin cobertura: quién lleva la línea más cerca y a cuántos minutos (fuera del tope). */
  masCercano: (EjecutivoRef & { minutos: number | null }) | null
  /** Ajuste manual activo de (línea, Zona), aunque haya quedado sin efecto. */
  ajuste: { id: string; motivo: string } | null
  /** line_zones.has_equipment = false → insignia "Sin equipo" (no cambia el estado). */
  sinEquipo: boolean
  /** Avisos del cálculo (conflicto: nombres; ajuste sin efecto; empates). */
  nota: string | null
}

/** Quien vive en la Zona (base_kam_id), con sus líneas y, si la dirección la limitó, las permitidas. */
export interface ZonaResidente extends EjecutivoRef {
  /** Códigos de línea (business_lines.code) que lleva hoy. */
  lineas: string[]
  /** Códigos de línea permitidos por la dirección; null = sin restricción. */
  lineasPermitidas: string[] | null
}

/** Qué hay en la Zona; igual para todas las líneas (reglas de "Datos de la zona", lib/zona-estadisticas.ts). */
export interface ZonaCifras {
  ips: number
  camas: number
  municipios: number
  municipiosConIps: number
  municipiosAlcance: number
  municipiosCompartidos: number
  departamentos: string[]
  poblacion: number | null
  poblacionAnio: number | null
  afiliados: number | null
  afiliadosCorte: string | null
  giros12m: number | null
  girosFuente: string | null
  girosDesde: string | null
  girosHasta: string | null
}

/** Una fila por Zona activa. */
export interface ZonaFila {
  kam_id: string
  nombre: string
  ciudad_base: string | null
  departamento: string | null
  area_id: string
  color: string | null
  /** true si es una de las celdas de Bogotá (la pantalla las agrupa con su total). */
  bogota: boolean
  cifras: ZonaCifras
  residentes: ZonaResidente[]
  /** null si no se pidió línea (o el usuario no ve ninguna). */
  enLinea: ZonaEnLinea | null
}

/** GET /api/kams/zonas?line=<code> */
export interface ZonasResponse {
  linea: { id: string; code: string; name: string; max_reach_minutes: number } | null
  lineas: Array<{ id: string; code: string; name: string }>
  zonas: ZonaFila[]
  bogota: { kam_ids: string[]; cifras: ZonaCifras } | null
  cobertura: { calculadaEn: string | null; desactualizada: boolean; recalculada: boolean }
  acceso: { asignar: boolean; ajustar: boolean; comprasPublicas: boolean; administrar: boolean }
  notas: string[]
}

// ---------------------------------------------------------------------------
// Simulación (POST /api/coverage/simular; motor puro en lib/cobertura-simulacion.ts)
// ---------------------------------------------------------------------------

/** Un cambio que se quiere probar antes de guardarlo. */
export type Cambio =
  | { tipo: 'linea_agregar'; executive_id: string; line_id: string }
  | { tipo: 'linea_quitar'; executive_id: string; line_id: string }
  | { tipo: 'ajuste'; line_id: string; kam_id: string; executive_id: string }
  | { tipo: 'quitar_ajuste'; override_id: string }

/** Una celda (línea, Zona) cuyo kind o executive_id cambia con los cambios simulados. */
export interface DiffCelda {
  line_id: string
  kam_id: string
  antes: { kind: CoverageKind; executive_id: string | null }
  despues: { kind: CoverageKind; executive_id: string | null }
}

/** DiffCelda con los nombres resueltos para mostrarla. */
export type SimularDiffCelda = DiffCelda & {
  line_code: string
  line_name: string
  zona: string
  antesEstado: EstadoPlaza
  despuesEstado: EstadoPlaza
  antesNombre: string | null
  despuesNombre: string | null
}

/**
 * Por cada cambio linea_quitar: cuántos médicos de esa persona en esa línea (medico_visitantes vigentes, hasta IS NULL)
 * perderían visitante al guardar, porque el disparador executive_lines_termina_visitantes (migración 0820) los termina
 * al borrar la fila y nada los reabre. Solo la cuenta, sin nombres ni cédulas; 0 si no lleva la línea (el disparador no
 * correría) o si la tabla medico_visitantes no existe.
 */
export interface MedicosQuePierdenVisitante {
  executive_id: string
  line_id: string
  medicos: number
}

/**
 * POST /api/coverage/simular → { diff recortado a las líneas del usuario, resumen por código de línea, y la cuenta de
 * médicos que perderían visitante por cada linea_quitar (E2: "Confirmación con la cuenta de médicos de esa línea") }.
 */
export interface SimularResponse {
  diff: SimularDiffCelda[]
  resumen: Record<string, Record<EstadoPlaza, number>>
  medicosQuePierdenVisitante: MedicosQuePierdenVisitante[]
}
