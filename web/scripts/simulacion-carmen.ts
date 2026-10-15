/**
 * Datos simulados de Carmen Barrios para probar la app de visita (F4.1: agenda, dictado por campo y marca).
 * Spec: docs/specs/2026-10-14-agenda-dictado-y-marca.md, decisión 11. Esquema: migración 0840 (visitas_agenda) y
 * las tablas de la 0800 (medicos, medico_sedes, medico_visitantes, contactos) y la 0810 (config_personas).
 *
 * Uso (desde web/):
 *   npx tsx scripts/simulacion-carmen.ts            → SOLO LECTURA: muestra el plan y comprueba que la 0840 está aplicada
 *   npx tsx scripts/simulacion-carmen.ts --aplicar  → crea lo que falte (idempotente: dos veces no duplica)
 *   npx tsx scripts/simulacion-carmen.ts --borrar   → cancela las citas, anula las visitas de prueba, termina los
 *                                                     visitantes, desactiva médicos y contactos y cierra la configuración
 *   (o npm run simulacion:carmen -- --aplicar)
 *
 * Todo lo que crea queda marcado como prueba:
 *   - Médicos: documento PRUEBA-0840-NN (tipo "otro"; se guarda normalizado, PRUEBA0840NN, como lo hace la API) y
 *     nombre que termina en " (prueba)". Se crean con terceros_crear_medico (completos y con sede).
 *   - Citas: nota "Simulación". Las de hoy se crean con fecha de creación de ayer, para que cuenten como agendadas.
 *   - Contactos: cargo "Jefe de compras (prueba)".
 *   - Configuración de Carmen: config_registrar con el motivo MOTIVO_CONFIG; --borrar la cierra con config_cerrar.
 * Nada se borra: el modelo no deja borrar estas filas (se cancelan, se terminan, se desactivan o se anulan).
 *
 * Escribe con el cliente service_role del repo (lib/supabase-admin.ts, variables de web/.env.local). No llama a
 * Google Maps, ni a OpenAI ni a Anthropic, y no recalcula asignaciones. Las pruebas puras del plan están en
 * scripts/simulacion-check.ts (sin red).
 */
import path from 'path'
import {
  generalVigente,
  hoyBogota,
  municipioDeZona,
  perfilVigente,
  resolverDiaHabil,
  rigeEn,
  sumarDias,
  type DiaCalendarioEntrada,
  type GeneralVigencia,
  type PersonaVigencia,
  type TipoVisita,
} from '../lib/visits-rules'
import { esDiaLibreCompleto, mensajeFechaCita, type DiaLibreAgenda } from '../lib/reporte-visitas'
import { normalizarIdentificacion, type EspecialidadMedico } from '../lib/terceros'
import type { SupabaseAdminClient } from '../lib/supabase-admin'

// ---------------------------------------------------------------------------------------------
// 1. Datos fijos (comprobados en la base el 2026-10-14) y marcas de prueba
// ---------------------------------------------------------------------------------------------

/**
 * Hasta cuántos días adelante se buscan los días hábiles de la plantilla (y se leen el calendario y los días libres).
 * No es un tope de la agenda: desde la 0850 se agenda sin tope hacia adelante (A4).
 */
export const DIAS_BUSQUEDA_PLANTILLA = 30

export const CARMEN = {
  executive_id: 'f97112f5-1642-4403-990d-791089c15e57',
  user_id: '32c0db82-1975-4b31-a281-e91e8ef4a7ac',
  nombre: 'Carmen Edith Barrios Barrios',
} as const

/** El usuario que queda como created_by / set_by de lo simulado es el administrador activo más antiguo (sin datos
 *  personales en el código). */

/** Las dos líneas de Carmen (PerOssal / sustitutos óseos y Reemplazo articular). */
export const LINEAS_CARMEN = ['26cd1993-4340-4a7c-8d4a-f256a26f43be', '87463909-7466-403b-b2e9-9ef68c576826'] as const

export const SEDES = {
  portoazul: {
    id: 'f9289141-37da-4d2a-a787-294bf1b0c3be',
    cuenta_id: '2e1ebfef-3034-4eb5-bab4-01b668804384',
    municipio: '08573',
    nombre: 'Clínica Portoazul (Puerto Colombia)',
  },
  reinaCatalina: {
    id: 'de9df913-c4b0-469d-9355-c264407228fc',
    cuenta_id: 'da3ee587-9321-4b3c-a806-0dc5a71002c8',
    municipio: '08001',
    nombre: 'Clínica Reina Catalina (Barranquilla)',
  },
  baranoa: {
    id: '43cbe257-5822-455c-b9ea-5b1b2bb1f4aa',
    cuenta_id: 'da3ee587-9321-4b3c-a806-0dc5a71002c8',
    municipio: '08078',
    nombre: 'Clínica Reina Catalina (Baranoa)',
  },
} as const
export type ClaveSede = keyof typeof SEDES

/** Código del subtipo institucional de las citas de compras. */
export const CODIGO_SUBTIPO_COMPRAS = 'compras'

/** Prefijo del documento como lo escribe la spec; en la base queda normalizado (sin guiones). */
export const PREFIJO_DOCUMENTO = 'PRUEBA-0840-'
export const TIPO_DOCUMENTO_PRUEBA = 'otro'
/** Documento guardado de un médico de prueba (normalizarIdentificacion quita los guiones). */
export const PATRON_DOCUMENTO_GUARDADO = /^PRUEBA0840\d{2}$/
export const SUFIJO_PRUEBA = ' (prueba)'
export const NOTA_CITA = 'Simulación'
export const CARGO_CONTACTO = 'Jefe de compras (prueba)'
export const MOTIVO_CONFIG = 'Simulación de prueba de la app (0840)'
/** Motivo de las anulaciones y cancelaciones de --borrar (spec, decisión 11). */
export const MOTIVO_BORRAR = 'Prueba de la app'
export const MOTIVO_CIERRE_CONFIG = 'Fin de la simulación de prueba de la app'
/** La configuración de prueba rige al menos hasta esta fecha (spec) o hasta el último día de la agenda simulada. */
export const FIN_CONFIG_MINIMO = '2026-10-21'
/** Radio presencial de prueba: el máximo que deja config_personas_radio_check (50 a 5.000 m). */
export const RADIO_PRUEBA_M = 5000
export const TOPE_TELEFONICAS_PRUEBA = 3
/** Días hábiles de agenda después de hoy. */
export const DIAS_HABILES_AGENDA = 5

interface MedicoBase {
  n: number
  nombre: string
  especialidades: readonly EspecialidadMedico[]
  /** La primera es su consultorio (sede principal); las demás, donde también atiende. */
  sedes: readonly ClaveSede[]
}

/** 5 médicos en Portoazul y 5 en Reina Catalina de Barranquilla; el 6 también atiende en Baranoa. */
export const MEDICOS_BASE: readonly MedicoBase[] = [
  { n: 1, nombre: 'Andrés Felipe Rocha Daza', especialidades: ['ortopedia', 'deportiva'], sedes: ['portoazul'] },
  { n: 2, nombre: 'Mariana Ospina Vergara', especialidades: ['ortopedia'], sedes: ['portoazul'] },
  { n: 3, nombre: 'Julián Esteban Caro Pinedo', especialidades: ['columna', 'neurocirugia'], sedes: ['portoazul'] },
  { n: 4, nombre: 'Luisa Fernanda Mercado Polo', especialidades: ['ortopedia'], sedes: ['portoazul'] },
  { n: 5, nombre: 'Ricardo Insignares Fontalvo', especialidades: ['maxilofacial'], sedes: ['portoazul'] },
  { n: 6, nombre: 'Camilo Andrés Barraza Meza', especialidades: ['ortopedia', 'deportiva'], sedes: ['reinaCatalina', 'baranoa'] },
  { n: 7, nombre: 'Daniela Peñaranda Celedón', especialidades: ['deportiva'], sedes: ['reinaCatalina'] },
  { n: 8, nombre: 'Hernán Darío Castro Orozco', especialidades: ['columna'], sedes: ['reinaCatalina'] },
  { n: 9, nombre: 'Sofía Lucía Escorcia Ruiz', especialidades: ['ortopedia'], sedes: ['reinaCatalina'] },
  { n: 10, nombre: 'Mauricio De la Hoz Gutiérrez', especialidades: ['ortopedia', 'cirugia_general'], sedes: ['reinaCatalina'] },
]

/** Un jefe de compras en cada clínica, para las visitas institucionales. */
export const CONTACTOS_BASE: readonly { nombre: string; sede: ClaveSede }[] = [
  { nombre: 'Patricia Vides Charris', sede: 'portoazul' },
  { nombre: 'Jorge Luis Ariza Mendoza', sede: 'reinaCatalina' },
]

/**
 * Una cita de la plantilla: día 0 = hoy; 1 a 5 = los próximos días hábiles. Todas con hora (decisión del dueño
 * 2026-10-15: la cita nueva lleva hora siempre).
 */
export type CitaBase =
  | { dia: number; hora: string; medico: number; sede?: ClaveSede }
  | { dia: number; hora: string; institucional: ClaveSede }

export const AGENDA_BASE: readonly CitaBase[] = [
  // Hoy: 3 en Portoazul, 2 en Reina Catalina y una institucional de compras.
  { dia: 0, hora: '08:00', medico: 1 },
  { dia: 0, hora: '09:30', medico: 2 },
  { dia: 0, hora: '10:30', institucional: 'portoazul' },
  { dia: 0, hora: '11:00', medico: 3 },
  { dia: 0, hora: '14:30', medico: 6 },
  { dia: 0, hora: '16:00', medico: 7 },
  // Próximos 5 días hábiles.
  { dia: 1, hora: '09:00', medico: 4 },
  { dia: 1, hora: '10:30', medico: 5 },
  { dia: 1, hora: '15:00', medico: 8 },
  { dia: 2, hora: '08:30', medico: 6, sede: 'baranoa' },
  { dia: 2, hora: '11:00', medico: 9 },
  { dia: 2, hora: '14:00', institucional: 'reinaCatalina' },
  { dia: 3, hora: '10:00', medico: 1 },
  { dia: 3, hora: '15:30', medico: 10 },
  { dia: 4, hora: '08:00', medico: 2 },
  { dia: 4, hora: '10:00', medico: 7 },
  { dia: 4, hora: '14:00', medico: 3 },
  { dia: 5, hora: '09:00', medico: 8 },
  { dia: 5, hora: '11:30', medico: 4 },
  { dia: 5, hora: '15:00', institucional: 'portoazul' },
]

// ---------------------------------------------------------------------------------------------
// 2. Piezas puras del plan (probadas en scripts/simulacion-check.ts)
// ---------------------------------------------------------------------------------------------

/** Documento del médico de prueba n: como lo escribe la spec y como queda guardado (normalizado por la API). */
export function documentoPrueba(n: number): { escrito: string; guardado: string } {
  if (!Number.isInteger(n) || n < 1 || n > 99) throw new Error(`Número de médico de prueba fuera de rango: ${n}`)
  const escrito = `${PREFIJO_DOCUMENTO}${String(n).padStart(2, '0')}`
  const guardado = normalizarIdentificacion(TIPO_DOCUMENTO_PRUEBA, escrito)
  if (!guardado) throw new Error(`Documento de prueba no válido: ${escrito}`)
  return { escrito, guardado }
}

/** ¿Es un médico creado por esta simulación? (tipo "otro" y documento PRUEBA0840NN). */
export function esDocumentoPrueba(tipo: string | null | undefined, numero: string | null | undefined): boolean {
  return tipo === TIPO_DOCUMENTO_PRUEBA && typeof numero === 'string' && PATRON_DOCUMENTO_GUARDADO.test(numero)
}

/** Nombre marcado como prueba (termina en " (prueba)"; no lo repite). */
export function nombrePrueba(nombre: string): string {
  const limpio = nombre.trim()
  return limpio.endsWith(SUFIJO_PRUEBA.trim()) ? limpio : `${limpio}${SUFIJO_PRUEBA}`
}

/** Hasta de un visitante que se termina: ayer, o su desde si empezó hoy (CHECK hasta >= desde). */
export function hastaVisitante(desde: string, hoy: string): string {
  const ayer = sumarDias(hoy, -1)
  return desde > ayer ? desde : ayer
}

/**
 * created_at de una cita: las de hoy, ayer a las 18:00 de Bogotá (23:00 UTC), para que la visita cuente como agendada
 * (decisión 6); las de otros días, null (se crea ahora: ya es antes de su día).
 */
export function creadaAtCita(fecha: string, hoy: string): string | null {
  return fecha === hoy ? `${sumarDias(hoy, -1)}T23:00:00.000Z` : null
}

export interface DiasAgenda {
  /** dias[0] = hoy y dias[1..n] = los próximos días hábiles; null si ese día no se agenda. */
  dias: (string | null)[]
  /** Fechas saltadas y por qué. */
  omitidas: { fecha: string; razon: string }[]
}

/**
 * Hoy y los próximos n días hábiles de la persona (calendario de su ciudad, días de empresa, festivos y semana de
 * config_general), sin sus días libres completos y dentro de la ventana de la agenda (hoy + 30). Hoy se agenda aunque
 * no sea hábil (la persona sabe si trabaja), salvo que sea un día libre completo.
 */
export function diasDeAgenda(entrada: {
  hoy: string
  cuantos?: number
  calendario: readonly DiaCalendarioEntrada[]
  filasGeneral: readonly GeneralVigencia[]
  municipio: string | null
  diasLibres: readonly DiaLibreAgenda[]
}): DiasAgenda {
  const cuantos = entrada.cuantos ?? DIAS_HABILES_AGENDA
  const omitidas: { fecha: string; razon: string }[] = []
  const dias: (string | null)[] = []
  if (esDiaLibreCompleto(entrada.diasLibres, entrada.hoy)) {
    dias.push(null)
    omitidas.push({ fecha: entrada.hoy, razon: 'día libre completo de Carmen' })
  } else {
    dias.push(entrada.hoy)
  }
  const tope = sumarDias(entrada.hoy, DIAS_BUSQUEDA_PLANTILLA)
  for (let fecha = sumarDias(entrada.hoy, 1); fecha <= tope && dias.length <= cuantos; fecha = sumarDias(fecha, 1)) {
    const habil = resolverDiaHabil({
      fecha,
      diasHabilesSemana: generalVigente(entrada.filasGeneral, 'dias_habiles_semana', fecha),
      calendario: entrada.calendario,
      municipio: entrada.municipio,
    })
    if (habil.fraccion <= 0) continue
    if (esDiaLibreCompleto(entrada.diasLibres, fecha)) {
      omitidas.push({ fecha, razon: 'día libre completo de Carmen' })
      continue
    }
    dias.push(fecha)
  }
  while (dias.length <= cuantos) dias.push(null)
  return { dias, omitidas }
}

export interface MedicoPlan {
  /** Clave del médico en el plan: su documento guardado. */
  clave: string
  documento_escrito: string
  tipo_documento: typeof TIPO_DOCUMENTO_PRUEBA
  numero_documento: string
  nombre: string
  especialidades: string[]
  municipality_id: string
  sedes: { sede_id: string; rol: 'consultorio' | 'atiende'; principal: boolean }[]
}

export interface VisitantePlan {
  medico: string
  executive_id: string
  line_id: string
}

export interface ContactoPlan {
  cuenta_id: string
  sede_id: string
  nombre: string
  cargo_texto: string
  rol: 'compras'
}

export interface CitaPlan {
  fecha: string
  hora: string | null
  tipo: TipoVisita
  /** Médica: la clave del médico del plan (su documento guardado). */
  medico: string | null
  cuenta_id: string | null
  subtipo_id: string | null
  sede_id: string
  nota: string
  /** Solo las de hoy: ayer en Bogotá (ver creadaAtCita). null = ahora. */
  created_at: string | null
}

/**
 * Las filas de visitas_agenda de las citas del plan (lo que inserta --aplicar): de la persona (0850: user_id) y como
 * Ejecutiva Comercial (executive_id); el médico por su clave. Lanza si falta un médico. PURA: la prueba
 * (scripts/simulacion-check.ts) la usa sin red.
 */
export function filasDeCitas(citas: readonly CitaPlan[], ids: ReadonlyMap<string, string>, adminId: string, ahora: string) {
  return citas.map(c => {
    const medicoId = c.medico ? ids.get(c.medico) : null
    if (c.medico && !medicoId) throw new Error(`No se encontró el médico ${c.medico} de la cita del ${c.fecha}`)
    return {
      user_id: CARMEN.user_id,
      executive_id: CARMEN.executive_id,
      fecha: c.fecha,
      hora: c.hora,
      tipo: c.tipo,
      medico_id: medicoId ?? null,
      cuenta_id: c.cuenta_id,
      subtipo_id: c.subtipo_id,
      sede_id: c.sede_id,
      nota: c.nota,
      created_by: adminId,
      created_at: c.created_at ?? ahora,
    }
  })
}

export interface ConfigPlan {
  valores: {
    executive_id: string
    perfil: TipoVisita[]
    telefonica_habilitada: boolean
    tope_telefonicas_dia: number
    radio_m: number
  }
  desde: string
  hasta: string
  motivo: string
}

export interface Plan {
  hoy: string
  dias: (string | null)[]
  omitidas: { fecha: string; razon: string }[]
  medicos: MedicoPlan[]
  visitantes: VisitantePlan[]
  contactos: ContactoPlan[]
  citas: CitaPlan[]
  config: ConfigPlan
}

/** Arma el plan completo (determinista: con la misma entrada sale el mismo plan). */
export function armarPlan(entrada: { hoy: string; dias: DiasAgenda; subtipoComprasId: string }): Plan {
  const medicos: MedicoPlan[] = MEDICOS_BASE.map(base => {
    const documento = documentoPrueba(base.n)
    return {
      clave: documento.guardado,
      documento_escrito: documento.escrito,
      tipo_documento: TIPO_DOCUMENTO_PRUEBA,
      numero_documento: documento.guardado,
      nombre: nombrePrueba(base.nombre),
      especialidades: [...base.especialidades],
      municipality_id: SEDES[base.sedes[0]].municipio,
      sedes: base.sedes.map((clave, i) => ({
        sede_id: SEDES[clave].id,
        rol: i === 0 ? ('consultorio' as const) : ('atiende' as const),
        principal: i === 0,
      })),
    }
  })
  const visitantes: VisitantePlan[] = medicos.flatMap(medico =>
    LINEAS_CARMEN.map(line_id => ({ medico: medico.clave, executive_id: CARMEN.executive_id, line_id }))
  )
  const contactos: ContactoPlan[] = CONTACTOS_BASE.map(base => ({
    cuenta_id: SEDES[base.sede].cuenta_id,
    sede_id: SEDES[base.sede].id,
    nombre: nombrePrueba(base.nombre),
    cargo_texto: CARGO_CONTACTO,
    rol: 'compras',
  }))

  const citas: CitaPlan[] = []
  for (const base of AGENDA_BASE) {
    const fecha = entrada.dias.dias[base.dia] ?? null
    if (!fecha) continue
    if ('institucional' in base) {
      const sede = SEDES[base.institucional]
      citas.push({
        fecha,
        hora: base.hora,
        tipo: 'institucional',
        medico: null,
        cuenta_id: sede.cuenta_id,
        subtipo_id: entrada.subtipoComprasId,
        sede_id: sede.id,
        nota: NOTA_CITA,
        created_at: creadaAtCita(fecha, entrada.hoy),
      })
    } else {
      const medicoBase = MEDICOS_BASE.find(m => m.n === base.medico)
      if (!medicoBase) throw new Error(`La plantilla de la agenda usa el médico ${base.medico}, que no está en MEDICOS_BASE`)
      const claveSede = base.sede ?? medicoBase.sedes[0]
      if (!medicoBase.sedes.includes(claveSede)) {
        throw new Error(`El médico ${base.medico} no atiende en la sede ${claveSede} de la plantilla`)
      }
      citas.push({
        fecha,
        hora: base.hora,
        tipo: 'medica',
        medico: documentoPrueba(base.medico).guardado,
        cuenta_id: null,
        subtipo_id: null,
        sede_id: SEDES[claveSede].id,
        nota: NOTA_CITA,
        created_at: creadaAtCita(fecha, entrada.hoy),
      })
    }
  }
  citas.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : (a.hora ?? '99:99').localeCompare(b.hora ?? '99:99')))

  const ultimoDia = entrada.dias.dias.filter((d): d is string => d !== null).reduce((max, d) => (d > max ? d : max), entrada.hoy)
  const hasta = ultimoDia > FIN_CONFIG_MINIMO ? ultimoDia : FIN_CONFIG_MINIMO
  return {
    hoy: entrada.hoy,
    dias: [...entrada.dias.dias],
    omitidas: [...entrada.dias.omitidas],
    medicos,
    visitantes,
    contactos,
    citas,
    config: {
      valores: {
        executive_id: CARMEN.executive_id,
        perfil: ['medica', 'institucional'],
        telefonica_habilitada: true,
        tope_telefonicas_dia: TOPE_TELEFONICAS_PRUEBA,
        radio_m: RADIO_PRUEBA_M,
      },
      desde: entrada.hoy,
      hasta: hasta < entrada.hoy ? entrada.hoy : hasta,
      motivo: MOTIVO_CONFIG,
    },
  }
}

// --- Lo que ya hay en la base y lo que falta -------------------------------------------------------------------

export interface MedicoExistente {
  id: string
  tipo_documento: string
  numero_documento: string
  nombre: string
  activo: boolean
  sedes: string[]
}
export interface VisitanteExistente {
  id: string
  medico_id: string
  executive_id: string
  line_id: string
  municipality_id: string | null
  desde: string
  hasta: string | null
}
export interface ContactoExistente {
  id: string
  cuenta_id: string
  nombre: string
  cargo_texto: string | null
  activo: boolean
}
export interface CitaExistente {
  id: string
  executive_id: string
  fecha: string
  tipo: TipoVisita
  medico_id: string | null
  cuenta_id: string | null
  subtipo_id: string | null
  /** 0850: también no_realizada ("no se hizo") y eliminada (por error). */
  estado: 'pendiente' | 'hecha' | 'cancelada' | 'no_realizada' | 'eliminada'
  nota: string | null
  visita_id: string | null
}
export interface ConfigExistente {
  id: string
  executive_id: string
  perfil: string[]
  telefonica_habilitada: boolean
  tope_telefonicas_dia: number | null
  radio_m: number | null
  vigente_desde: string
  vigente_hasta: string | null
  motivo: string | null
  anulado_at: string | null
}
export interface VisitaExistente {
  id: string
  executive_id: string | null
  source: string | null
  medico_id: string | null
  contacto_id: string | null
  agenda_id: string | null
  deleted_at: string | null
  visit_date: string
}

export interface Existentes {
  medicos: MedicoExistente[]
  visitantes: VisitanteExistente[]
  contactos: ContactoExistente[]
  /** null: la tabla visitas_agenda no existe (falta la 0840). */
  citas: CitaExistente[] | null
  config: ConfigExistente[]
  visitas: VisitaExistente[]
}

export const EXISTENTES_VACIO: Existentes = { medicos: [], visitantes: [], contactos: [], citas: [], config: [], visitas: [] }

export interface Acciones {
  medicosCrear: MedicoPlan[]
  medicosReactivar: { id: string; clave: string; nombre: string }[]
  sedesAgregar: { medico_id: string; clave: string; sede_id: string; rol: 'consultorio' | 'atiende' }[]
  visitantesCrear: VisitantePlan[]
  contactosCrear: ContactoPlan[]
  contactosReactivar: { id: string; nombre: string }[]
  /** null: ya hay una configuración de prueba que rige hoy. */
  configRegistrar: ConfigPlan | null
  citasCrear: CitaPlan[]
  citasYaEstan: number
  /** La agenda no se puede crear todavía: falta la 0840. */
  sinAgenda: boolean
}

function medicoDeClave(existentes: Existentes, clave: string): MedicoExistente | undefined {
  return existentes.medicos.find(m => m.tipo_documento === TIPO_DOCUMENTO_PRUEBA && m.numero_documento === clave)
}

/** La configuración de prueba de Carmen que rige hoy (activa y con el motivo de la simulación), o null. */
export function configDePruebaVigente(config: readonly ConfigExistente[], hoy: string): ConfigExistente | null {
  return (
    config.find(
      fila =>
        fila.executive_id === CARMEN.executive_id &&
        !fila.anulado_at &&
        fila.motivo === MOTIVO_CONFIG &&
        rigeEn(fila, hoy)
    ) ?? null
  )
}

/** Qué falta crear (o reactivar) para que la base tenga el plan. Con lo ya creado, todo queda vacío. */
export function pendientes(plan: Plan, existentes: Existentes): Acciones {
  const acciones: Acciones = {
    medicosCrear: [],
    medicosReactivar: [],
    sedesAgregar: [],
    visitantesCrear: [],
    contactosCrear: [],
    contactosReactivar: [],
    configRegistrar: null,
    citasCrear: [],
    citasYaEstan: 0,
    sinAgenda: existentes.citas === null,
  }

  for (const medico of plan.medicos) {
    const existente = medicoDeClave(existentes, medico.clave)
    if (!existente) {
      acciones.medicosCrear.push(medico)
      continue
    }
    if (!existente.activo) acciones.medicosReactivar.push({ id: existente.id, clave: medico.clave, nombre: existente.nombre })
    for (const sede of medico.sedes) {
      if (!existente.sedes.includes(sede.sede_id)) {
        acciones.sedesAgregar.push({ medico_id: existente.id, clave: medico.clave, sede_id: sede.sede_id, rol: sede.rol })
      }
    }
  }

  for (const visitante of plan.visitantes) {
    const medico = medicoDeClave(existentes, visitante.medico)
    const abierto =
      medico &&
      existentes.visitantes.some(
        fila =>
          fila.medico_id === medico.id &&
          fila.executive_id === visitante.executive_id &&
          fila.line_id === visitante.line_id &&
          (fila.municipality_id ?? null) === null &&
          fila.hasta === null
      )
    if (!abierto) acciones.visitantesCrear.push(visitante)
  }

  for (const contacto of plan.contactos) {
    const existente = existentes.contactos.find(
      fila => fila.cuenta_id === contacto.cuenta_id && fila.cargo_texto === contacto.cargo_texto
    )
    if (!existente) acciones.contactosCrear.push(contacto)
    else if (!existente.activo) acciones.contactosReactivar.push({ id: existente.id, nombre: existente.nombre })
  }

  if (!configDePruebaVigente(existentes.config, plan.hoy)) acciones.configRegistrar = plan.config

  if (existentes.citas !== null) {
    const vivas = existentes.citas.filter(cita => cita.executive_id === CARMEN.executive_id && cita.estado !== 'cancelada')
    for (const cita of plan.citas) {
      const medicoId = cita.medico ? medicoDeClave(existentes, cita.medico)?.id ?? null : null
      const yaEsta =
        cita.tipo === 'medica'
          ? medicoId !== null && vivas.some(v => v.tipo === 'medica' && v.fecha === cita.fecha && v.medico_id === medicoId)
          : vivas.some(
              v =>
                v.tipo === 'institucional' &&
                v.fecha === cita.fecha &&
                v.cuenta_id === cita.cuenta_id &&
                v.subtipo_id === cita.subtipo_id
            )
      if (yaEsta) acciones.citasYaEstan++
      else acciones.citasCrear.push(cita)
    }
  }
  return acciones
}

/** ¿No queda nada por crear? (la segunda corrida de --aplicar). */
export function nadaPendiente(acciones: Acciones): boolean {
  return (
    acciones.medicosCrear.length === 0 &&
    acciones.medicosReactivar.length === 0 &&
    acciones.sedesAgregar.length === 0 &&
    acciones.visitantesCrear.length === 0 &&
    acciones.contactosCrear.length === 0 &&
    acciones.contactosReactivar.length === 0 &&
    acciones.configRegistrar === null &&
    acciones.citasCrear.length === 0
  )
}

/**
 * Problemas del plan contra las reglas de agenda_crear (decisión 5) que el insert directo no revisa: ventana de fechas,
 * perfil vigente en la fecha (con la configuración de prueba incluida) y subtipo vigente. [] si todo cuadra.
 */
export function problemasDelPlan(
  plan: Plan,
  entrada: {
    config: readonly ConfigExistente[]
    subtipo: { vigente_desde: string; vigente_hasta: string | null }
    diasLibres: readonly DiaLibreAgenda[]
  }
): string[] {
  const personas: PersonaVigencia[] = entrada.config
    .filter(fila => !fila.anulado_at)
    .map(fila => ({
      id: fila.id,
      executive_id: fila.executive_id,
      perfil: fila.perfil,
      telefonica_habilitada: fila.telefonica_habilitada,
      tope_telefonicas_dia: fila.tope_telefonicas_dia,
      radio_m: fila.radio_m,
      vigente_desde: fila.vigente_desde,
      vigente_hasta: fila.vigente_hasta,
    }))
  if (!configDePruebaVigente(entrada.config, plan.hoy)) {
    personas.push({
      id: 'plan',
      ...plan.config.valores,
      vigente_desde: plan.config.desde,
      vigente_hasta: plan.config.hasta,
    })
  }
  const problemas: string[] = []
  for (const cita of plan.citas) {
    const fecha = mensajeFechaCita(cita.fecha, plan.hoy, entrada.diasLibres)
    if (fecha) problemas.push(`${cita.fecha}: ${fecha}`)
    if (!perfilVigente(personas, CARMEN.executive_id, cita.fecha).includes(cita.tipo)) {
      problemas.push(`${cita.fecha}: el perfil de Carmen ese día no incluye la visita ${cita.tipo === 'medica' ? 'médica' : 'institucional'}`)
    }
    if (cita.tipo === 'institucional' && !rigeEn(entrada.subtipo, cita.fecha)) {
      problemas.push(`${cita.fecha}: el subtipo de compras no está vigente`)
    }
  }
  return problemas
}

// --- Borrado (decisión 11, "Al borrar") -------------------------------------------------------------------------

export interface AccionesBorrar {
  visitasAnular: string[]
  citasCancelar: string[]
  visitantesTerminar: { id: string; hasta: string }[]
  medicosDesactivar: string[]
  contactosDesactivar: string[]
  configCerrar: { id: string; hasta: string }[]
  /**
   * SOLO PARA MOSTRAR (no es una acción): citas simuladas que cumplió una visita que no es de prueba (p. ej. una
   * institucional real a la cuenta de Portoazul con su contacto real, vinculada sola a la cita de compras simulada).
   * Ni la visita ni la cita se tocan: la visita es real y la cita queda hecha para que su vínculo siga coherente.
   */
  citasConVisitaReal: string[]
  /**
   * Citas que NO son simuladas (p. ej. una que Carmen agendó en la app con una cuenta real) y que cumplió una visita
   * que se anula aquí (con un contacto de prueba): vuelven a pendiente, como hace visitas_anular, para que ninguna
   * cita quede hecha por una visita anulada.
   */
  citasLiberar: string[]
}

/** Las listas de AccionesBorrar que --borrar ejecuta (citasConVisitaReal solo se muestra). */
const LISTAS_BORRAR = ['visitasAnular', 'citasCancelar', 'citasLiberar', 'visitantesTerminar', 'medicosDesactivar', 'contactosDesactivar', 'configCerrar'] as const

/**
 * Lo que --borrar hace con lo que hay en la base (decisión 11): anula las visitas de la app de Carmen a los médicos de
 * prueba y las que hizo con un contacto de prueba (NUNCA las demás, aunque se hayan vinculado solas a una cita
 * simulada: las citas institucionales simuladas son con cuentas reales), cancela las citas simuladas pendientes o hechas
 * (las de nota "Simulación" y cualquiera de Carmen con un médico de prueba; como agenda_cancelar: las que no se hicieron,
 * las eliminadas y las ya canceladas ya están cerradas y no se tocan) salvo las que cumplió una visita
 * que no es de prueba (esas se dejan y se muestran), termina los visitantes abiertos de los médicos de prueba,
 * desactiva médicos y contactos de prueba y cierra la configuración de prueba que rige hoy o empieza después. Correrlo
 * otra vez sobre lo ya borrado no hace nada.
 */
export function planBorrar(existentes: Existentes, hoy: string): AccionesBorrar {
  const medicosPrueba = existentes.medicos.filter(m => esDocumentoPrueba(m.tipo_documento, m.numero_documento))
  const idsMedicos = new Set(medicosPrueba.map(m => m.id))
  const contactosPrueba = existentes.contactos.filter(c => c.cargo_texto === CARGO_CONTACTO)
  const idsContactos = new Set(contactosPrueba.map(c => c.id))
  const citasSimuladas = (existentes.citas ?? []).filter(
    cita =>
      cita.executive_id === CARMEN.executive_id &&
      (cita.nota === NOTA_CITA || (cita.medico_id !== null && idsMedicos.has(cita.medico_id)))
  )

  const vivas = existentes.visitas.filter(v => v.executive_id === CARMEN.executive_id && v.source === 'app' && !v.deleted_at)
  const deCarmenVivas = new Set(vivas.map(v => v.id))
  const visitasAnular = vivas
    .filter(v => (v.medico_id !== null && idsMedicos.has(v.medico_id)) || (v.contacto_id !== null && idsContactos.has(v.contacto_id)))
    .map(v => v.id)
    .sort()
  const seAnulan = new Set(visitasAnular)
  // Una cita simulada hecha cuya visita sigue viva y NO se anula: la cumplió una visita real.
  const conVisitaReal = (cita: CitaExistente) =>
    cita.estado === 'hecha' && cita.visita_id !== null && deCarmenVivas.has(cita.visita_id) && !seAnulan.has(cita.visita_id)

  const idsSimuladas = new Set(citasSimuladas.map(c => c.id))

  return {
    visitasAnular,
    citasCancelar: citasSimuladas.filter(c => (c.estado === 'pendiente' || c.estado === 'hecha') && !conVisitaReal(c)).map(c => c.id).sort(),
    citasConVisitaReal: citasSimuladas.filter(conVisitaReal).map(c => c.id).sort(),
    citasLiberar: (existentes.citas ?? [])
      .filter(
        c =>
          c.executive_id === CARMEN.executive_id &&
          !idsSimuladas.has(c.id) &&
          c.estado === 'hecha' &&
          c.visita_id !== null &&
          seAnulan.has(c.visita_id)
      )
      .map(c => c.id)
      .sort(),
    visitantesTerminar: existentes.visitantes
      .filter(fila => idsMedicos.has(fila.medico_id) && fila.hasta === null)
      .map(fila => ({ id: fila.id, hasta: hastaVisitante(fila.desde, hoy) }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    medicosDesactivar: medicosPrueba.filter(m => m.activo).map(m => m.id).sort(),
    contactosDesactivar: contactosPrueba.filter(c => c.activo).map(c => c.id).sort(),
    configCerrar: existentes.config
      .filter(
        fila =>
          fila.executive_id === CARMEN.executive_id &&
          !fila.anulado_at &&
          fila.motivo === MOTIVO_CONFIG &&
          (fila.vigente_hasta === null || fila.vigente_hasta >= hoy)
      )
      .map(fila => ({ id: fila.id, hasta: sumarDias(hoy, -1) }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  }
}

export function nadaQueBorrar(acciones: AccionesBorrar): boolean {
  return LISTAS_BORRAR.every(lista => acciones[lista].length === 0)
}

/** Textos que el script muestra (las pruebas revisan que no digan "KAM", "representante" ni "panel"). */
export const TEXTOS = {
  falta0840:
    'La migración 0840 (agenda de visitas) no está aplicada en la base: la agenda simulada no se puede crear todavía. ' +
    'Cuando el dueño la aplique, corre otra vez este script.',
  soloLectura: 'Modo solo lectura: no se escribió nada. Para crearlo: npx tsx scripts/simulacion-carmen.ts --aplicar',
  nadaPendiente: 'Todo lo simulado ya está en la base: no hay nada que crear.',
  nadaQueBorrar: 'No hay nada simulado que quitar.',
  aplicarSin0840: 'No se aplicó nada: sin la 0840 quedarían médicos sin agenda.',
  persona: 'Ejecutivo Comercial',
} as const

/** Lo que --borrar muestra de las citas simuladas que cumplió una visita que no es de prueba (no las toca). */
export function textoCitasConVisitaReal(n: number): string {
  return n === 1
    ? '1 cita simulada la cumplió una visita que no es de prueba: se deja como está y esa visita no se anula.'
    : `${n} citas simuladas las cumplieron visitas que no son de prueba: se dejan como están y esas visitas no se anulan.`
}

// ---------------------------------------------------------------------------------------------
// 3. Lectura y escritura en la base (solo al correr el script)
// ---------------------------------------------------------------------------------------------

type Modo = 'plan' | 'aplicar' | 'borrar'

function leerModo(argv: string[]): Modo | 'ayuda' {
  const conocidos = new Set(['--aplicar', '--borrar', '--ayuda', '-h', '--help'])
  const desconocidos = argv.filter(arg => !conocidos.has(arg))
  if (desconocidos.length > 0) throw new Error(`Opción desconocida: ${desconocidos.join(' ')} (usa --aplicar, --borrar o nada)`)
  if (argv.some(arg => arg === '--ayuda' || arg === '-h' || arg === '--help')) return 'ayuda'
  const aplicar = argv.includes('--aplicar')
  const borrar = argv.includes('--borrar')
  if (aplicar && borrar) throw new Error('--aplicar y --borrar no van juntos')
  return aplicar ? 'aplicar' : borrar ? 'borrar' : 'plan'
}

/** ¿El error dice que falta algo de la 0840 (tabla o columnas)? Mismos códigos que faltaMigracion0840 de la API. */
function falta0840(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code
  return Boolean(code && ['42P01', '42703', '42883', 'PGRST202', 'PGRST204', 'PGRST205'].includes(code))
}

function fallar(contexto: string, error: unknown): never {
  const e = error as { message?: string; code?: string; details?: string; hint?: string } | null
  const partes = [e?.message, e?.details, e?.hint].filter(Boolean).join(' · ')
  throw new Error(`${contexto}: ${partes || String(error)}${e?.code ? ` (código ${e.code})` : ''}`)
}

async function una<T>(contexto: string, consulta: PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> {
  const { data, error } = await consulta
  if (error) fallar(contexto, error)
  return (data ?? []) as T[]
}

interface Contexto {
  db: SupabaseAdminClient
  hoy: string
  adminId: string
  municipio: string | null
  lineas: { id: string; name: string }[]
  subtipo: { id: string; vigente_desde: string; vigente_hasta: string | null }
  sedes: Record<ClaveSede, { nombre: string; cuenta: string }>
  calendario: DiaCalendarioEntrada[]
  filasGeneral: GeneralVigencia[]
  diasLibres: DiaLibreAgenda[]
  hay0840: boolean
}

/** Lecturas y comprobaciones previas (todas de solo lectura). Lanza si algo de lo fijo no cuadra. */
async function leerContexto(db: SupabaseAdminClient): Promise<Contexto> {
  const hoy = hoyBogota()
  const problemas: string[] = []

  const admins = await una<{ id: string; role: string }>(
    'usuario administrador',
    db.from('users').select('id, role').eq('role', 'admin').eq('active', true).order('created_at').order('id').limit(1)
  )
  if (admins.length !== 1) throw new Error('No hay ningún usuario administrador activo')

  const ejecutivos = await una<{ id: string; user_id: string | null; full_name: string; status: string; base_kam_id: string | null }>(
    'Ejecutivo Comercial',
    db.from('executives').select('id, user_id, full_name, status, base_kam_id').eq('id', CARMEN.executive_id).limit(1)
  )
  const carmen = ejecutivos[0]
  if (!carmen) throw new Error(`No existe el ${TEXTOS.persona} ${CARMEN.nombre}`)
  if (carmen.status !== 'active') problemas.push(`${carmen.full_name} no está activa (${carmen.status})`)
  if (carmen.user_id !== CARMEN.user_id) problemas.push(`${carmen.full_name} no está enlazada con el usuario esperado`)
  if (!carmen.base_kam_id) problemas.push(`${carmen.full_name} no tiene zona base`)

  let municipio: string | null = null
  if (carmen.base_kam_id) {
    const zonas = await una<{ area_id: string | null; name: string }>(
      'zona',
      db.from('kams').select('area_id, name').eq('id', carmen.base_kam_id).limit(1)
    )
    municipio = municipioDeZona(zonas[0]?.area_id)
  }

  const lineasFilas = await una<{ line_id: string }>(
    'líneas de Carmen',
    db.from('executive_lines').select('line_id').eq('executive_id', CARMEN.executive_id).range(0, 99)
  )
  const nombresLinea = await una<{ id: string; name: string; active: boolean }>(
    'líneas',
    db.from('business_lines').select('id, name, active').in('id', [...LINEAS_CARMEN])
  )
  for (const lineaId of LINEAS_CARMEN) {
    const linea = nombresLinea.find(l => l.id === lineaId)
    if (!linea) problemas.push(`No existe la línea ${lineaId}`)
    else if (!linea.active) problemas.push(`La línea ${linea.name} está inactiva`)
    if (!lineasFilas.some(f => f.line_id === lineaId)) problemas.push(`Carmen no lleva la línea ${linea?.name ?? lineaId}`)
  }

  const idsSedes = Object.values(SEDES).map(s => s.id)
  const sedesFilas = await una<{ id: string; nombre: string; cuenta_id: string; activo: boolean }>(
    'sedes',
    db.from('sedes').select('id, nombre, cuenta_id, activo').in('id', idsSedes)
  )
  const cuentasFilas = await una<{ id: string; nombre: string; activo: boolean }>(
    'cuentas',
    db.from('cuentas').select('id, nombre, activo').in('id', Array.from(new Set(Object.values(SEDES).map(s => s.cuenta_id))))
  )
  const sedes = {} as Record<ClaveSede, { nombre: string; cuenta: string }>
  for (const clave of Object.keys(SEDES) as ClaveSede[]) {
    const esperada = SEDES[clave]
    const sede = sedesFilas.find(s => s.id === esperada.id)
    const cuenta = cuentasFilas.find(c => c.id === esperada.cuenta_id)
    if (!sede) problemas.push(`No existe la sede ${esperada.nombre}`)
    else {
      if (!sede.activo) problemas.push(`La sede ${sede.nombre} está inactiva`)
      if (sede.cuenta_id !== esperada.cuenta_id) problemas.push(`La sede ${sede.nombre} no es de la cuenta esperada`)
    }
    if (!cuenta) problemas.push(`No existe la cuenta de ${esperada.nombre}`)
    else if (!cuenta.activo) problemas.push(`La cuenta ${cuenta.nombre} está inactiva`)
    sedes[clave] = { nombre: sede?.nombre ?? esperada.nombre, cuenta: cuenta?.nombre ?? '?' }
  }

  const subtipos = await una<{ id: string; vigente_desde: string; vigente_hasta: string | null }>(
    'subtipo de compras',
    db.from('subtipos_institucionales').select('id, vigente_desde, vigente_hasta').eq('codigo', CODIGO_SUBTIPO_COMPRAS).limit(1)
  )
  if (!subtipos[0]) throw new Error('No existe el subtipo institucional de compras')

  const tope = sumarDias(hoy, DIAS_BUSQUEDA_PLANTILLA)
  const calendario = await una<DiaCalendarioEntrada>(
    'calendario',
    db
      .from('calendario')
      .select('fecha, alcance, municipality_id, tipo, nombre, anulado_at')
      .gte('fecha', hoy)
      .lte('fecha', tope)
      .is('anulado_at', null)
      .range(0, 999)
  )
  const filasGeneral = await una<GeneralVigencia>(
    'configuración general',
    db
      .from('config_general')
      .select('id, parametro, valor, vigente_desde, vigente_hasta, anulado_at')
      .eq('parametro', 'dias_habiles_semana')
      .is('anulado_at', null)
      .range(0, 999)
  )
  const diasLibres = await una<DiaLibreAgenda>(
    'días libres de Carmen',
    db
      .from('dias_libres')
      .select('fecha, fraccion, estado')
      .eq('executive_id', CARMEN.executive_id)
      .gte('fecha', hoy)
      .lte('fecha', tope)
      .range(0, 999)
  )

  const sonda = await db.from('visitas_agenda').select('id').limit(1)
  let hay0840 = true
  if (sonda.error) {
    if (falta0840(sonda.error)) hay0840 = false
    else fallar('agenda', sonda.error)
  }
  if (hay0840) {
    const columnas = await db.from('visits').select('agenda_id, agendada').limit(1)
    if (columnas.error) {
      if (falta0840(columnas.error)) hay0840 = false
      else fallar('visitas', columnas.error)
    }
  }

  if (problemas.length > 0) {
    throw new Error(`Los datos fijos del script no cuadran con la base:\n  - ${problemas.join('\n  - ')}`)
  }

  return {
    db,
    hoy,
    adminId: admins[0].id,
    municipio,
    lineas: LINEAS_CARMEN.map(id => ({ id, name: nombresLinea.find(l => l.id === id)?.name ?? id })),
    subtipo: subtipos[0],
    sedes,
    calendario,
    filasGeneral,
    diasLibres,
    hay0840,
  }
}

/** Lo que ya hay en la base de la simulación (solo lectura). */
async function leerExistentes(ctx: Contexto): Promise<Existentes> {
  const { db } = ctx
  const medicosFilas = await una<Omit<MedicoExistente, 'sedes'>>(
    'médicos de prueba',
    db
      .from('medicos')
      .select('id, tipo_documento, numero_documento, nombre, activo')
      .eq('tipo_documento', TIPO_DOCUMENTO_PRUEBA)
      .like('numero_documento', 'PRUEBA0840%')
      .range(0, 999)
  )
  const idsMedicos = medicosFilas.map(m => m.id)
  const vinculos =
    idsMedicos.length === 0
      ? []
      : await una<{ medico_id: string; sede_id: string }>(
          'sedes de los médicos de prueba',
          db.from('medico_sedes').select('medico_id, sede_id').in('medico_id', idsMedicos).range(0, 999)
        )
  const medicos: MedicoExistente[] = medicosFilas
    .filter(m => esDocumentoPrueba(m.tipo_documento, m.numero_documento))
    .map(m => ({ ...m, sedes: vinculos.filter(v => v.medico_id === m.id).map(v => v.sede_id) }))

  const visitantes =
    idsMedicos.length === 0
      ? []
      : await una<VisitanteExistente>(
          'visitantes de los médicos de prueba',
          db
            .from('medico_visitantes')
            .select('id, medico_id, executive_id, line_id, municipality_id, desde, hasta')
            .in('medico_id', idsMedicos)
            .range(0, 999)
        )

  const contactos = await una<ContactoExistente>(
    'contactos de prueba',
    db
      .from('contactos')
      .select('id, cuenta_id, nombre, cargo_texto, activo')
      .in('cuenta_id', Array.from(new Set(Object.values(SEDES).map(s => s.cuenta_id))))
      .eq('cargo_texto', CARGO_CONTACTO)
      .range(0, 999)
  )

  const citas = ctx.hay0840
    ? await una<CitaExistente>(
        'citas de Carmen',
        db
          .from('visitas_agenda')
          .select('id, executive_id, fecha, tipo, medico_id, cuenta_id, subtipo_id, estado, nota, visita_id')
          .eq('executive_id', CARMEN.executive_id)
          .range(0, 4999)
      )
    : null

  const config = await una<ConfigExistente>(
    'configuración de Carmen',
    db
      .from('config_personas')
      .select('id, executive_id, perfil, telefonica_habilitada, tope_telefonicas_dia, radio_m, vigente_desde, vigente_hasta, motivo, anulado_at')
      .eq('executive_id', CARMEN.executive_id)
      .range(0, 999)
  )

  const columnasVisita = 'id, executive_id, source, medico_id, contacto_id, deleted_at, visit_date'
  const visitasFilas = await una<Omit<VisitaExistente, 'agenda_id'> & { agenda_id?: string | null }>(
    'visitas de la app de Carmen',
    db
      .from('visits')
      .select(ctx.hay0840 ? `${columnasVisita}, agenda_id` : columnasVisita)
      .eq('executive_id', CARMEN.executive_id)
      .eq('source', 'app')
      .is('deleted_at', null)
      .range(0, 4999)
  )
  const visitas: VisitaExistente[] = visitasFilas.map(v => ({ ...v, agenda_id: v.agenda_id ?? null }))

  return { medicos, visitantes, contactos, citas, config, visitas }
}

function claveDeSede(sedeId: string): ClaveSede | undefined {
  return (Object.keys(SEDES) as ClaveSede[]).find(c => SEDES[c].id === sedeId)
}

function nombreSede(ctx: Contexto, sedeId: string): string {
  const clave = claveDeSede(sedeId)
  return clave ? ctx.sedes[clave].nombre : sedeId
}

function nombreCuenta(ctx: Contexto, sedeId: string): string {
  const clave = claveDeSede(sedeId)
  return clave ? ctx.sedes[clave].cuenta : sedeId
}

function nombreMedico(plan: Plan, clave: string | null): string {
  return plan.medicos.find(m => m.clave === clave)?.nombre ?? String(clave)
}

function nombreDia(fecha: string): string {
  const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
  return dias[new Date(`${fecha}T12:00:00Z`).getUTCDay()]
}

function mostrarPlan(ctx: Contexto, plan: Plan, acciones: Acciones, existentes: Existentes) {
  console.log(`Simulación de la app de visita para ${CARMEN.nombre} (${TEXTOS.persona}) · hoy ${plan.hoy} (Bogotá)`)
  console.log(`Líneas: ${ctx.lineas.map(l => l.name).join(' y ')} · municipio de la zona: ${ctx.municipio ?? 'sin municipio'}`)
  console.log(`Migración 0840 (agenda): ${ctx.hay0840 ? 'aplicada' : 'NO aplicada'}`)

  console.log(`\n1. Médicos de prueba (${plan.medicos.length}; documento ${PREFIJO_DOCUMENTO}NN, guardado sin guiones)`)
  for (const medico of plan.medicos) {
    const existente = existentes.medicos.find(m => m.numero_documento === medico.clave)
    const estado = !existente
      ? 'crear'
      : !existente.activo
        ? 'reactivar'
        : acciones.sedesAgregar.some(s => s.clave === medico.clave)
          ? 'ya existe (falta una sede)'
          : 'ya existe'
    const sedes = medico.sedes.map(s => `${nombreSede(ctx, s.sede_id)}${s.principal ? '' : ' (también atiende)'}`).join(' + ')
    console.log(`   ${medico.numero_documento}  ${medico.nombre.padEnd(42)} ${medico.especialidades.join(', ').padEnd(24)} ${sedes} → ${estado}`)
  }

  console.log(`\n2. Carmen como visitante de cada médico en ${ctx.lineas.map(l => l.name).join(' y ')}: ${plan.visitantes.length} asignaciones, ${acciones.visitantesCrear.length} por crear`)

  console.log(`\n3. Contactos de compras (${plan.contactos.length})`)
  for (const contacto of plan.contactos) {
    const existente = existentes.contactos.find(c => c.cuenta_id === contacto.cuenta_id && c.cargo_texto === contacto.cargo_texto)
    const estado = !existente ? 'crear' : existente.activo ? 'ya existe' : 'reactivar'
    console.log(`   ${contacto.nombre.padEnd(36)} ${contacto.cargo_texto} · ${nombreSede(ctx, contacto.sede_id)} → ${estado}`)
  }

  const cfg = plan.config
  const cfgExistente = configDePruebaVigente(existentes.config, plan.hoy)
  console.log('\n4. Configuración de prueba de Carmen (config_registrar)')
  console.log(
    `   ${cfg.desde} a ${cfg.hasta} · perfil médica e institucional · radio ${cfg.valores.radio_m} m · telefónica habilitada, tope ${cfg.valores.tope_telefonicas_dia} al día → ` +
      (cfgExistente ? `ya existe (${cfgExistente.vigente_desde} a ${cfgExistente.vigente_hasta ?? 'abierta'})` : 'registrar')
  )

  console.log(`\n5. Agenda (${plan.citas.length} citas; nota "${NOTA_CITA}"; las de hoy creadas ayer para que cuenten como agendadas)`)
  if (plan.omitidas.length > 0) {
    for (const o of plan.omitidas) console.log(`   (se salta ${o.fecha}: ${o.razon})`)
  }
  let fechaActual = ''
  for (const cita of plan.citas) {
    if (cita.fecha !== fechaActual) {
      fechaActual = cita.fecha
      console.log(`   ${cita.fecha} (${nombreDia(cita.fecha)}${cita.fecha === plan.hoy ? ', hoy' : ''})`)
    }
    const con =
      cita.tipo === 'medica'
        ? nombreMedico(plan, cita.medico)
        : `Compras · ${nombreCuenta(ctx, cita.sede_id)}`
    const estado = acciones.sinAgenda ? 'pendiente de la 0840' : acciones.citasCrear.includes(cita) ? 'crear' : 'ya existe'
    console.log(`     ${(cita.hora ?? 'sin hora').padEnd(8)} ${cita.tipo === 'medica' ? 'médica       ' : 'institucional'} ${con.padEnd(42)} ${nombreSede(ctx, cita.sede_id)} → ${estado}`)
  }

  console.log('\nResumen de lo que falta')
  console.log(`   médicos por crear: ${acciones.medicosCrear.length} · por reactivar: ${acciones.medicosReactivar.length} · sedes por vincular: ${acciones.sedesAgregar.length}`)
  console.log(`   visitantes por crear: ${acciones.visitantesCrear.length}`)
  console.log(`   contactos por crear: ${acciones.contactosCrear.length} · por reactivar: ${acciones.contactosReactivar.length}`)
  console.log(`   configuración por registrar: ${acciones.configRegistrar ? 'sí' : 'no'}`)
  console.log(
    `   citas por crear: ${acciones.sinAgenda ? `${plan.citas.length} (cuando se aplique la 0840)` : acciones.citasCrear.length}` +
      (acciones.sinAgenda ? '' : ` · ya en la agenda: ${acciones.citasYaEstan}`)
  )
}

async function aplicar(ctx: Contexto, plan: Plan, acciones: Acciones) {
  const { db, adminId } = ctx
  const ids = new Map<string, string>()
  const existentes = await leerExistentes(ctx)
  for (const m of existentes.medicos) ids.set(m.numero_documento, m.id)

  if (acciones.configRegistrar) {
    const c = acciones.configRegistrar
    const { error } = await db.rpc('config_registrar', {
      p_tabla: 'config_personas',
      p_valores: c.valores,
      p_desde: c.desde,
      p_hasta: c.hasta,
      p_motivo: c.motivo,
      p_user: adminId,
    })
    if (error) fallar('config_registrar (configuración de prueba de Carmen)', error)
    console.log(`   configuración de prueba registrada (${c.desde} a ${c.hasta})`)
  }

  for (const medico of acciones.medicosCrear) {
    const { data, error } = await db.rpc('terceros_crear_medico', {
      p_medico: {
        tipo_documento: medico.tipo_documento,
        numero_documento: medico.numero_documento,
        nombre: medico.nombre,
        especialidades: medico.especialidades,
        municipality_id: medico.municipality_id,
        notas: 'Médico de prueba de la simulación de la app de visita (0840)',
      },
      p_sedes: medico.sedes,
      p_user: adminId,
    })
    if (error) fallar(`terceros_crear_medico (${medico.nombre})`, error)
    ids.set(medico.clave, String(data))
    console.log(`   médico creado: ${medico.nombre}`)
  }
  for (const medico of acciones.medicosReactivar) {
    const { error } = await db.from('medicos').update({ activo: true }).eq('id', medico.id)
    if (error) fallar(`reactivar ${medico.nombre}`, error)
    console.log(`   médico reactivado: ${medico.nombre}`)
  }
  if (acciones.sedesAgregar.length > 0) {
    const { error } = await db.from('medico_sedes').insert(
      acciones.sedesAgregar.map(s => ({ medico_id: s.medico_id, sede_id: s.sede_id, rol: s.rol, principal: false, created_by: adminId }))
    )
    if (error) fallar('vincular sedes de los médicos de prueba', error)
    console.log(`   sedes vinculadas: ${acciones.sedesAgregar.length}`)
  }

  if (acciones.visitantesCrear.length > 0) {
    const filas = acciones.visitantesCrear.map(v => {
      const medicoId = ids.get(v.medico)
      if (!medicoId) throw new Error(`No se encontró el médico ${v.medico} para asignar a Carmen`)
      return { medico_id: medicoId, executive_id: v.executive_id, line_id: v.line_id, municipality_id: null, created_by: adminId }
    })
    const { error } = await db.from('medico_visitantes').insert(filas)
    if (error) fallar('asignar a Carmen como visitante', error)
    console.log(`   visitantes creados: ${filas.length}`)
  }

  if (acciones.contactosCrear.length > 0) {
    const { error } = await db.from('contactos').insert(acciones.contactosCrear.map(c => ({ ...c, created_by: adminId })))
    if (error) fallar('crear contactos de prueba', error)
    console.log(`   contactos creados: ${acciones.contactosCrear.length}`)
  }
  for (const contacto of acciones.contactosReactivar) {
    const { error } = await db.from('contactos').update({ activo: true }).eq('id', contacto.id)
    if (error) fallar(`reactivar ${contacto.nombre}`, error)
    console.log(`   contacto reactivado: ${contacto.nombre}`)
  }

  if (acciones.citasCrear.length > 0) {
    // El perfil y el subtipo se revisan con la configuración ya registrada (agenda_crear lo haría; el insert directo no).
    const despues = await leerExistentes(ctx)
    const problemas = problemasDelPlan({ ...plan, citas: acciones.citasCrear }, { config: despues.config, subtipo: ctx.subtipo, diasLibres: ctx.diasLibres })
    if (problemas.length > 0) throw new Error(`Las citas no cumplen las reglas de la agenda:\n  - ${problemas.join('\n  - ')}`)
    const filas = filasDeCitas(acciones.citasCrear, ids, adminId, new Date().toISOString())
    const { error } = await db.from('visitas_agenda').insert(filas)
    if (error) fallar('crear las citas simuladas', error)
    console.log(`   citas creadas: ${filas.length}`)
  }
}

async function borrar(ctx: Contexto, acciones: AccionesBorrar) {
  const { db, adminId } = ctx
  const ahora = new Date().toISOString()
  if (acciones.visitasAnular.length > 0) {
    // Como visitas_anular (la fila se queda; deleted_at y motivo), también para las de días anteriores.
    const { error } = await db
      .from('visits')
      .update({ deleted_at: ahora, deleted_reason: MOTIVO_BORRAR, updated_by: adminId })
      .in('id', acciones.visitasAnular)
      .is('deleted_at', null)
    if (error) fallar('anular las visitas de prueba', error)
    console.log(`   visitas anuladas: ${acciones.visitasAnular.length}`)
  }
  if (acciones.citasCancelar.length > 0) {
    const { error } = await db
      .from('visitas_agenda')
      // 0850: cancelar exige motivo (motivo_codigo 'otro' con su texto).
      .update({ estado: 'cancelada', visita_id: null, cancelada_at: ahora, cancelada_motivo: MOTIVO_BORRAR, motivo_codigo: 'otro' })
      .in('id', acciones.citasCancelar)
      // Solo pendientes y hechas (las cerradas violarían visitas_agenda_estado_datos_check: no_realizada_at, eliminada_at).
      .in('estado', ['pendiente', 'hecha'])
    if (error) fallar('cancelar las citas simuladas', error)
    console.log(`   citas canceladas: ${acciones.citasCancelar.length}`)
  }
  if (acciones.citasLiberar.length > 0) {
    // Como visitas_anular: la cita (no simulada) cuya visita se anuló vuelve a pendiente.
    const { error } = await db
      .from('visitas_agenda')
      .update({ estado: 'pendiente', visita_id: null })
      .in('id', acciones.citasLiberar)
      .eq('estado', 'hecha')
    if (error) fallar('devolver a pendiente las citas de visitas anuladas', error)
    console.log(`   citas devueltas a pendiente: ${acciones.citasLiberar.length}`)
  }
  for (const visitante of acciones.visitantesTerminar) {
    const { error } = await db
      .from('medico_visitantes')
      .update({ hasta: visitante.hasta, fin_motivo: 'manual' })
      .eq('id', visitante.id)
      .is('hasta', null)
    if (error) fallar('terminar los visitantes de prueba', error)
  }
  if (acciones.visitantesTerminar.length > 0) console.log(`   visitantes terminados: ${acciones.visitantesTerminar.length}`)
  if (acciones.medicosDesactivar.length > 0) {
    const { error } = await db.from('medicos').update({ activo: false }).in('id', acciones.medicosDesactivar)
    if (error) fallar('desactivar los médicos de prueba', error)
    console.log(`   médicos desactivados: ${acciones.medicosDesactivar.length}`)
  }
  if (acciones.contactosDesactivar.length > 0) {
    const { error } = await db.from('contactos').update({ activo: false }).in('id', acciones.contactosDesactivar)
    if (error) fallar('desactivar los contactos de prueba', error)
    console.log(`   contactos desactivados: ${acciones.contactosDesactivar.length}`)
  }
  for (const cfg of acciones.configCerrar) {
    const { error } = await db.rpc('config_cerrar', {
      p_tabla: 'config_personas',
      p_id: cfg.id,
      p_hasta: cfg.hasta,
      p_motivo: MOTIVO_CIERRE_CONFIG,
      p_user: adminId,
    })
    if (error) fallar('config_cerrar (configuración de prueba de Carmen)', error)
    console.log(`   configuración de prueba cerrada (rigió hasta ${cfg.hasta}, o se anuló si empezaba hoy)`)
  }
}

async function main() {
  const modo = leerModo(process.argv.slice(2))
  if (modo === 'ayuda') {
    console.log('Uso: npx tsx scripts/simulacion-carmen.ts [--aplicar | --borrar]  (sin opciones: solo lectura)')
    return
  }
  const dotenv = await import('dotenv')
  dotenv.config({ path: path.resolve(__dirname, '..', '.env.local'), quiet: true })
  const { getSupabaseAdmin } = await import('../lib/supabase-admin')
  const ctx = await leerContexto(getSupabaseAdmin())

  const dias = diasDeAgenda({
    hoy: ctx.hoy,
    calendario: ctx.calendario,
    filasGeneral: ctx.filasGeneral,
    municipio: ctx.municipio,
    diasLibres: ctx.diasLibres,
  })
  const plan = armarPlan({ hoy: ctx.hoy, dias, subtipoComprasId: ctx.subtipo.id })
  const existentes = await leerExistentes(ctx)

  if (modo === 'borrar') {
    const acciones = planBorrar(existentes, ctx.hoy)
    console.log(`Quitar la simulación de ${CARMEN.nombre} · hoy ${ctx.hoy} (Bogotá)`)
    console.log(
      `   visitas por anular: ${acciones.visitasAnular.length} · citas por cancelar: ${acciones.citasCancelar.length}` +
        ` · citas que vuelven a pendiente: ${acciones.citasLiberar.length}` +
        `${ctx.hay0840 ? '' : ' (sin la 0840 no hay agenda)'} · visitantes por terminar: ${acciones.visitantesTerminar.length}`
    )
    console.log(
      `   médicos por desactivar: ${acciones.medicosDesactivar.length} · contactos por desactivar: ${acciones.contactosDesactivar.length} · configuración por cerrar: ${acciones.configCerrar.length}`
    )
    if (acciones.citasConVisitaReal.length > 0) console.log(`   ${textoCitasConVisitaReal(acciones.citasConVisitaReal.length)}`)
    if (nadaQueBorrar(acciones)) {
      console.log(TEXTOS.nadaQueBorrar)
      return
    }
    await borrar(ctx, acciones)
    const quedan = planBorrar(await leerExistentes(ctx), ctx.hoy)
    console.log(nadaQueBorrar(quedan) ? 'Comprobación: no queda nada simulado activo.' : 'Atención: aún queda algo por quitar; corre --borrar otra vez.')
    if (!nadaQueBorrar(quedan)) process.exitCode = 1
    return
  }

  const acciones = pendientes(plan, existentes)
  mostrarPlan(ctx, plan, acciones, existentes)
  const problemas = problemasDelPlan(plan, { config: existentes.config, subtipo: ctx.subtipo, diasLibres: ctx.diasLibres })
  if (problemas.length > 0) {
    console.log(`\nProblemas del plan (agenda_crear los rechazaría):\n  - ${problemas.join('\n  - ')}`)
  }

  if (!ctx.hay0840) {
    console.log(`\n${TEXTOS.falta0840}`)
    if (modo === 'aplicar') {
      console.log(TEXTOS.aplicarSin0840)
      process.exitCode = 1
    }
    return
  }
  if (modo === 'plan') {
    console.log(`\n${nadaPendiente(acciones) ? TEXTOS.nadaPendiente : TEXTOS.soloLectura}`)
    return
  }
  if (problemas.length > 0) {
    process.exitCode = 1
    return
  }
  if (nadaPendiente(acciones)) {
    console.log(`\n${TEXTOS.nadaPendiente}`)
    return
  }
  console.log('\nAplicando…')
  await aplicar(ctx, plan, acciones)
  const despues = pendientes(plan, await leerExistentes(ctx))
  console.log(nadaPendiente(despues) ? 'Comprobación: todo lo del plan quedó en la base (otra corrida no crearía nada).' : 'Atención: algo del plan no quedó; revisa los mensajes.')
  if (!nadaPendiente(despues)) process.exitCode = 1
}

// Solo corre al llamar el archivo directamente (scripts/simulacion-check.ts importa las piezas puras).
if (/simulacion-carmen\.[cm]?[jt]s$/.test(process.argv[1] ?? '')) {
  main().catch(error => {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  })
}
