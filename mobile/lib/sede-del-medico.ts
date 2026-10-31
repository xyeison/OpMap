/**
 * Agendar con una sede que el médico aún no tiene (spec docs/specs/2026-10-30-agendar-sede-del-medico.md; dueño,
 * 2026-10-30: "si al agendar no veo una clínica donde el doctor atiende… asociarlo a una sede existente o crear una
 * nueva"). Reglas puras, sin React ni red: las usan Agendar (app/(app)/agenda/nueva.tsx) y Nueva sede
 * (app/(app)/sede/nueva.tsx) y las prueban scripts/checks/23-sede-del-medico.ts.
 */
import type { SedeCreateApp } from './tipos'

/** Sede de un médico tal como la lleva Agendar (sin coordenadas: al agendar no se está en el sitio). */
export interface SedeDeCita {
  id: string
  nombre: string
  cuenta_nombre: string | null
}

/** Lo que Nueva sede manda a POST /api/terceros/sedes, según tenga o no la ubicación del teléfono. */
export interface DatosSedeNueva {
  cuenta_id: string
  nombre: string
  municipality_id: string
  reps_code: string | null
  ubicacion: { lat: number; lng: number; precision: number | null } | null
}

export const MENSAJE_SEDE_SIN_UBICACION =
  'Sin ubicación: la sede queda "por confirmar" y el equipo de datos la ubica desde la web. Si estás en la sede, toma la ubicación.'

/** Nueva sede: pasaron más de 30 minutos y Agendar ya no espera la vuelta; la sede quedó creada pero sin el médico. */
export const MENSAJE_SEDE_CREADA_SIN_VUELTA =
  'La sede quedó creada en OpMap, pero Agendar ya no la estaba esperando: en la cita, búscala en Sede › Buscar en OpMap para vincularla al médico.'

/** Agendar, al volver de Nueva sede: la sede existe pero el vínculo con el médico falló (sin señal, sin permiso…). */
export function mensajeSedeCreadaSinVincular(medicoNombre: string | null, error: string): string {
  return `La sede quedó creada, pero no pude vincularla a ${medicoNombre ?? 'este médico'} (${error}). Búscala en Sede › Buscar en OpMap para intentarlo de nuevo.`
}

/** Texto de "Crear la sede" en la búsqueda de sedes de Agendar que no encontró nada. */
export function detalleCrearSede(buscado: string, medicoNombre: string): string {
  return `"${buscado}" no está en OpMap: créala y queda como sede de ${medicoNombre}`
}

/**
 * Las sedes que ofrece Agendar para un médico: las que trae (del contexto o del buscador) más las vinculadas en esta
 * pantalla (una sede que se vinculó va primero en su lista: es la que se quiere agendar). Sin repetir por id.
 */
export function sedesConVinculadas(sedes: readonly SedeDeCita[], vinculadas: readonly SedeDeCita[] | undefined): SedeDeCita[] {
  if (!vinculadas || vinculadas.length === 0) return [...sedes]
  const vistas = new Set<string>()
  const juntas: SedeDeCita[] = []
  for (const sede of [...vinculadas, ...sedes]) {
    if (vistas.has(sede.id)) continue
    vistas.add(sede.id)
    juntas.push(sede)
  }
  return juntas
}

/**
 * El cuerpo de la sede nueva. Con la ubicación del teléfono es una sede de la app (origen 'gps_app', con coordenadas y
 * precisión: nace confirmada si su código del REPS cruza con el municipio). Sin ubicación (pedida desde Agendar, lejos
 * del sitio) va sin origen ni coordenadas: el servidor la guarda como manual, "por confirmar", y nunca inventa un
 * punto (jamás la dirección del REPS ni el centro del municipio como si fueran la sede).
 */
export function cuerpoSedeNueva(datos: DatosSedeNueva): SedeCreateApp {
  const base = { cuenta_id: datos.cuenta_id, nombre: datos.nombre, municipality_id: datos.municipality_id, reps_code: datos.reps_code }
  if (!datos.ubicacion) return base
  return { ...base, origen: 'gps_app', lat: datos.ubicacion.lat, lng: datos.ubicacion.lng, gps_accuracy_m: datos.ubicacion.precision }
}
