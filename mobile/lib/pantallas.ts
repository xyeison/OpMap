/**
 * Reglas y textos puros de Hoy, Días libres, Números, Visita, Nueva sede, Nuevo médico e Ingreso (spec
 * 2026-10-15-usabilidad-y-agenda-con-hora, paquete 5). Sin React Native: los prueba scripts/checks/19-pantallas.ts
 * en Node.
 */
import { FRESCURA_SIN_PEDIR_MS } from './contexto-memoria'
import { hoyBogota, horaBogota, puedeRegistrarDiaLibre, sumarDias } from './fechas'
import { textoPrecision } from './geo'
import { conQuienCita, numeroTexto, pareceCorreo } from './reglas'
import type { CitaItem, DiaLibreItem, EstadoDiaLibre } from './tipos'

// ---------------------------------------------------------------------------------------------
// Hoy
// ---------------------------------------------------------------------------------------------

/**
 * ¿Hoy vuelve a pedir al recibir el foco? Sí si nunca cargó, si hubo una invalidación (visita guardada, cita agendada o
 * cancelada, día libre, cierre de sesión) o se tiró para actualizar (`invalidado`), si pasaron FRESCURA_SIN_PEDIR_MS
 * (60 s) desde la última carga, si cambió el día en Bogotá o si el reloj del teléfono volvió atrás. Antes de 60 s, no.
 */
export function debeRecargarHoy(ultima: number | null, ahora: number, invalidado: boolean): boolean {
  if (invalidado || ultima === null || !Number.isFinite(ultima)) return true
  if (ahora < ultima) return true
  if (hoyBogota(new Date(ultima)) !== hoyBogota(new Date(ahora))) return true
  return ahora - ultima >= FRESCURA_SIN_PEDIR_MS
}

/** Ventana de la cita "de ahora": de 30 min antes a 60 min después de su hora. */
export const CITA_DE_AHORA_ANTES_MIN = 30
export const CITA_DE_AHORA_DESPUES_MIN = 60

type CitaHoy = Pick<CitaItem, 'id' | 'fecha' | 'hora' | 'estado' | 'tipo' | 'medico' | 'cuenta' | 'subtipo'>

/** Minutos desde la medianoche de "HH:MM" (o "HH:MM:SS"); null si no es una hora. */
function minutosDe(hora: string | null | undefined): number | null {
  if (!hora) return null
  const partes = /^(\d{1,2}):(\d{2})/.exec(hora.trim())
  if (!partes) return null
  const h = Number(partes[1])
  const m = Number(partes[2])
  if (h > 23 || m > 59) return null
  return h * 60 + m
}

/** Minutos que faltan para la cita (negativo: ya pasó su hora), en Bogotá; null si no es de hoy o no tiene hora. */
function minutosHasta(cita: Pick<CitaItem, 'fecha' | 'hora'>, ahora: Date): number | null {
  const deCita = minutosDe(cita.hora)
  if (deCita === null || cita.fecha !== hoyBogota(ahora)) return null
  const deAhora = minutosDe(horaBogota(ahora))
  return deAhora === null ? null : deCita - deAhora
}

/**
 * La cita "de ahora": la pendiente de hoy con hora entre 30 min antes y 60 min después de este momento. Si hay varias,
 * la de hora más temprana (la que ya debería estar pasando); sin hora, hechas y canceladas no cuentan.
 */
export function citaDeAhora<T extends CitaHoy>(citas: readonly T[], ahora: Date): T | null {
  let elegida: { cita: T; minutos: number } | null = null
  for (const cita of citas) {
    if (cita.estado !== 'pendiente') continue
    const minutos = minutosHasta(cita, ahora)
    if (minutos === null || minutos < -CITA_DE_AHORA_ANTES_MIN || minutos > CITA_DE_AHORA_DESPUES_MIN) continue
    if (!elegida || minutos < elegida.minutos || (minutos === elegida.minutos && conQuienCita(cita).localeCompare(conQuienCita(elegida.cita), 'es') < 0)) {
      elegida = { cita, minutos }
    }
  }
  return elegida?.cita ?? null
}

/** "Siguiente: 10:30 · Dra. Gómez (en 25 min)", "(ahora)" o "(hace 10 min)". */
export function textoSiguienteCita(cita: CitaHoy, ahora: Date): string {
  const minutos = minutosHasta(cita, ahora)
  const hora = cita.hora ? cita.hora.slice(0, 5) : 'Sin hora'
  const cuando = minutos === null ? '' : minutos > 0 ? ` (en ${minutos} min)` : minutos === 0 ? ' (ahora)' : ` (hace ${-minutos} min)`
  return `Siguiente: ${hora} · ${conQuienCita(cita)}${cuando}`
}

/** ¿Pendiente de hoy y ya pasó su hora? (lleva "Atrasada"). Sin hora, hechas y canceladas, no. */
export function citaAtrasada(cita: Pick<CitaItem, 'fecha' | 'hora' | 'estado'>, ahora: Date): boolean {
  if (cita.estado !== 'pendiente') return false
  const minutos = minutosHasta(cita, ahora)
  return minutos !== null && minutos < 0
}

/** "Ubicación tomada · ±12 m" (y "(aproximada)" si es la aproximada); sin precisión, "Ubicación tomada". */
export function textoUbicacionTomada(precision: number | null | undefined, aproximada = false): string {
  const texto = textoPrecision(precision)
  return `Ubicación tomada${texto ? ` · ${texto}` : ''}${aproximada ? ' (aproximada)' : ''}`
}

// ---------------------------------------------------------------------------------------------
// Números
// ---------------------------------------------------------------------------------------------

const NOMBRES_TIPO = {
  medica: { singular: 'visita médica', plural: 'visitas médicas' },
  institucional: { singular: 'visita institucional', plural: 'visitas institucionales' },
} as const

/**
 * "Te faltan 120 visitas médicas: 11 por día hábil". Lo que falta es la cuota menos lo hecho (hacia arriba) y se
 * reparte en los días hábiles que quedan después de hoy (`transcurridos` ya cuenta hoy, como dias_habiles_transcurridos
 * del servidor), también hacia arriba. null si no se puede calcular (números no válidos, sin cuota, sin días por
 * delante) o si ya no falta nada.
 */
export function faltanVisitas(
  cuota: number | null | undefined,
  hechas: number | null | undefined,
  diasHabiles: number | null | undefined,
  transcurridos: number | null | undefined,
  tipo: keyof typeof NOMBRES_TIPO = 'medica'
): string | null {
  const numeros = [cuota, hechas, diasHabiles, transcurridos]
  if (!numeros.every(n => typeof n === 'number' && Number.isFinite(n))) return null
  const [c, h, d, t] = numeros as number[]
  if (c <= 0 || h < 0 || d <= 0 || t < 0) return null
  const faltan = Math.ceil(Math.round((c - h) * 100) / 100)
  const quedan = Math.round((d - t) * 100) / 100
  if (faltan <= 0 || quedan <= 0) return null
  const porDia = Math.ceil(faltan / quedan)
  const nombre = NOMBRES_TIPO[tipo]
  return `${faltan === 1 ? 'Te falta' : 'Te faltan'} ${numeroTexto(faltan)} ${faltan === 1 ? nombre.singular : nombre.plural}: ${numeroTexto(porDia)} por día hábil`
}

// ---------------------------------------------------------------------------------------------
// Días libres
// ---------------------------------------------------------------------------------------------

/** Lo que el calendario pinta en un día (cabe en MarcaDia de components/agenda/CalendarioMes). */
export interface MarcaDiaLibre {
  estadoLibre: EstadoDiaLibre
}

/**
 * Estados que el calendario marca, con su prioridad si un día tiene varios registros. Anulado y rechazado no son días
 * libres: no se marcan (siguen en la lista de abajo con su insignia).
 */
const PRIORIDAD_ESTADO: Partial<Record<EstadoDiaLibre, number>> = { aprobado: 3, registrado: 2, por_aprobar: 1 }

/** Los días libres vigentes por fecha para el calendario (aprobado, registrado o por aprobar), cada día con el que manda. */
export function marcasDiasLibres(items: readonly Pick<DiaLibreItem, 'fecha' | 'estado'>[]): Record<string, MarcaDiaLibre> {
  const marcas: Record<string, MarcaDiaLibre> = {}
  for (const item of items) {
    const prioridad = PRIORIDAD_ESTADO[item.estado]
    if (prioridad === undefined) continue
    const actual = marcas[item.fecha]
    if (!actual || prioridad > (PRIORIDAD_ESTADO[actual.estadoLibre] ?? 0)) marcas[item.fecha] = { estadoLibre: item.estado }
  }
  return marcas
}

/** El primer día que todavía se puede registrar con ese plazo (hoy si ya no se puede ninguno anterior). */
export function primerDiaRegistrable(hoy: string, plazoHoras: number, ahora: Date = new Date()): string {
  let fecha = hoy
  for (let i = 1; i <= 31; i++) {
    const anterior = sumarDias(hoy, -i)
    if (!puedeRegistrarDiaLibre(anterior, plazoHoras, ahora)) break
    fecha = anterior
  }
  return fecha
}

// ---------------------------------------------------------------------------------------------
// Nuevo médico e Ingreso
// ---------------------------------------------------------------------------------------------

export type CampoMedico = 'documento' | 'nombre' | 'ciudad' | 'especialidad' | 'sedes'

/**
 * Los errores de Nuevo médico, cada uno junto a su campo (todos a la vez). Al verificar: documento, nombre y ciudad;
 * al crear, además, especialidad y sedes. Mismos textos que antes.
 */
export function erroresNuevoMedico(
  datos: { errorDocumento: string | null; nombre: string; municipio: string | null; especialidades: number; sedes: number },
  paso: 'verificar' | 'crear'
): Partial<Record<CampoMedico, string>> {
  const errores: Partial<Record<CampoMedico, string>> = {}
  if (datos.errorDocumento) errores.documento = datos.errorDocumento
  if (datos.nombre.trim().length < 3) errores.nombre = 'Escribe el nombre completo del médico'
  if (!datos.municipio) errores.ciudad = 'Elige la ciudad del médico'
  if (paso === 'crear') {
    if (datos.especialidades === 0) errores.especialidad = 'Elige al menos una especialidad'
    if (datos.sedes === 0) errores.sedes = 'Elige al menos una sede donde atiende'
  }
  return errores
}

/** Lo que le falta a "Entrar", campo por campo (null: está bien). */
export function faltaParaEntrar(correo: string, contrasena: string): { correo: string | null; contrasena: string | null } {
  const limpio = correo.trim()
  return {
    correo: !limpio ? 'Escribe tu correo' : pareceCorreo(limpio) ? null : 'Revisa el correo: va como nombre@empresa.com',
    contrasena: contrasena.length === 0 ? 'Escribe tu contraseña' : null,
  }
}
