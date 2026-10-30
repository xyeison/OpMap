/**
 * Datos simulados de Carmen (decisión 11 de docs/specs/2026-10-14-agenda-dictado-y-marca.md): pruebas puras de la parte
 * de scripts/simulacion-carmen.ts que arma el plan, lo compara con lo que ya hay (idempotencia) y decide qué quitar con
 * --borrar. SIN red ni Supabase.
 *
 * Uso (desde web/): npx tsx scripts/simulacion-check.ts   (va dentro de npm run test)
 * Código de salida 1 si alguna prueba falla.
 */
import {
  AGENDA_BASE,
  CARGO_CONTACTO,
  CARMEN,
  CONTACTOS_BASE,
  EXISTENTES_VACIO,
  FIN_CONFIG_MINIMO,
  LINEAS_CARMEN,
  MEDICOS_BASE,
  MOTIVO_BORRAR,
  MOTIVO_CONFIG,
  NOTA_CITA,
  RADIO_PRUEBA_M,
  SEDES,
  TEXTOS,
  TOPE_TELEFONICAS_PRUEBA,
  armarPlan,
  configDePruebaVigente,
  creadaAtCita,
  diasDeAgenda,
  documentoPrueba,
  esDocumentoPrueba,
  filasDeCitas,
  hastaVisitante,
  nadaPendiente,
  nadaQueBorrar,
  nombrePrueba,
  pendientes,
  planBorrar,
  textoCitasConVisitaReal,
  problemasDelPlan,
  type CitaExistente,
  type ConfigExistente,
  type Existentes,
  type Plan,
  type VisitaExistente,
} from './simulacion-carmen'
import { readFileSync } from 'fs'
import path from 'path'
import { festivosColombia, type DiaCalendarioEntrada, type GeneralVigencia } from '../lib/visits-rules'
import { MAX_NOTA_CITA, citaAnticipada, mensajeFechaCita, type DiaLibreAgenda } from '../lib/reporte-visitas'
import { VALORES_ESPECIALIDAD, normalizarIdentificacion } from '../lib/terceros'

let passed = 0
let failed = 0

function check(name: string, condition: boolean, detail?: unknown) {
  if (condition) {
    passed++
    console.log(`  ok    ${name}`)
  } else {
    failed++
    console.log(`  FALLA ${name}${detail === undefined ? '' : ` → ${JSON.stringify(detail)}`}`)
  }
}

function eq<T>(name: string, actual: T, expected: T) {
  const a = JSON.stringify(actual)
  const b = JSON.stringify(expected)
  check(name, a === b, a === b ? undefined : { actual, expected })
}

function lanza(fn: () => unknown): boolean {
  try {
    fn()
    return false
  } catch {
    return true
  }
}

// Calendario de prueba: los festivos nacionales de 2026 (como los carga calendario_cargar_festivos).
const FESTIVOS_2026: DiaCalendarioEntrada[] = festivosColombia(2026).map(f => ({
  fecha: f.fecha,
  alcance: 'nacional',
  municipality_id: null,
  tipo: 'no_habil',
  nombre: f.nombre,
}))
const SIN_GENERAL: GeneralVigencia[] = []
const SUBTIPO_COMPRAS = '58bd9e8e-b4aa-49f3-9167-3e338a0735ed'
const SUBTIPO_VIGENTE = { vigente_desde: '2026-10-12', vigente_hasta: null }
const HOY = '2026-10-14'

function planDe(hoy: string, diasLibres: DiaLibreAgenda[] = [], calendario: DiaCalendarioEntrada[] = FESTIVOS_2026): Plan {
  const dias = diasDeAgenda({ hoy, calendario, filasGeneral: SIN_GENERAL, municipio: '08001', diasLibres })
  return armarPlan({ hoy, dias, subtipoComprasId: SUBTIPO_COMPRAS })
}

/** Lo que habría en la base después de un --aplicar exitoso del plan (ids inventados y deterministas). */
function existentesTrasAplicar(plan: Plan): Existentes {
  const idMedico = (clave: string) => `med-${clave}`
  const medicos = plan.medicos.map(m => ({
    id: idMedico(m.clave),
    tipo_documento: m.tipo_documento,
    numero_documento: m.numero_documento,
    nombre: m.nombre,
    activo: true,
    sedes: m.sedes.map(s => s.sede_id),
  }))
  const visitantes = plan.visitantes.map((v, i) => ({
    id: `vis-${String(i).padStart(2, '0')}`,
    medico_id: idMedico(v.medico),
    executive_id: v.executive_id,
    line_id: v.line_id,
    municipality_id: null,
    desde: plan.hoy,
    hasta: null,
  }))
  const contactos = plan.contactos.map((c, i) => ({ id: `con-${i}`, cuenta_id: c.cuenta_id, nombre: c.nombre, cargo_texto: c.cargo_texto, activo: true }))
  const citas: CitaExistente[] = plan.citas.map((c, i) => ({
    id: `cita-${String(i).padStart(2, '0')}`,
    executive_id: CARMEN.executive_id,
    fecha: c.fecha,
    tipo: c.tipo,
    medico_id: c.medico ? idMedico(c.medico) : null,
    cuenta_id: c.cuenta_id,
    subtipo_id: c.subtipo_id,
    estado: 'pendiente',
    nota: c.nota,
    visita_id: null,
  }))
  const config: ConfigExistente[] = [
    {
      id: 'cfg-1',
      ...plan.config.valores,
      vigente_desde: plan.config.desde,
      vigente_hasta: plan.config.hasta,
      motivo: plan.config.motivo,
      anulado_at: null,
    },
  ]
  return { medicos, visitantes, contactos, citas, config, visitas: [] }
}

// ---------------------------------------------------------------------------------------------
console.log('1. Documentos y nombres de prueba')
{
  const d1 = documentoPrueba(1)
  eq('el 1 se escribe PRUEBA-0840-01', d1.escrito, 'PRUEBA-0840-01')
  eq('y se guarda normalizado como lo hace la API (PRUEBA084001)', d1.guardado, 'PRUEBA084001')
  eq('normalizarIdentificacion("otro") da lo mismo', normalizarIdentificacion('otro', d1.escrito), d1.guardado)
  eq('el 10 es PRUEBA-0840-10', documentoPrueba(10).escrito, 'PRUEBA-0840-10')
  check('el guardado cumple medicos_numero_documento_check (^[0-9A-Z]{3,20}$)', /^[0-9A-Z]{3,20}$/.test(d1.guardado))
  check('el escrito con guiones NO lo cumple (por eso se normaliza)', !/^[0-9A-Z]{3,20}$/.test(d1.escrito))
  check('0 y 100 no son números de prueba', lanza(() => documentoPrueba(0)) && lanza(() => documentoPrueba(100)))
  check('esDocumentoPrueba reconoce el guardado de tipo otro', esDocumentoPrueba('otro', 'PRUEBA084007'))
  check('no reconoce una cédula ni otro tipo', !esDocumentoPrueba('CC', 'PRUEBA084007') && !esDocumentoPrueba('otro', '79123456'))
  check('no reconoce el escrito con guiones ni otro número de migración', !esDocumentoPrueba('otro', 'PRUEBA-0840-07') && !esDocumentoPrueba('otro', 'PRUEBA083001'))
  eq('nombrePrueba añade " (prueba)"', nombrePrueba('Ana Pérez'), 'Ana Pérez (prueba)')
  eq('y no lo repite', nombrePrueba('Ana Pérez (prueba)'), 'Ana Pérez (prueba)')
}

// ---------------------------------------------------------------------------------------------
console.log('2. Días de la agenda: hoy y los próximos 5 días hábiles')
{
  const miercoles = diasDeAgenda({ hoy: HOY, calendario: FESTIVOS_2026, filasGeneral: SIN_GENERAL, municipio: '08001', diasLibres: [] })
  eq('miércoles 14-oct-2026: hoy + jue, vie, lun, mar, mié', miercoles.dias, ['2026-10-14', '2026-10-15', '2026-10-16', '2026-10-19', '2026-10-20', '2026-10-21'])
  eq('sin omitidas', miercoles.omitidas, [])

  const viernes = diasDeAgenda({ hoy: '2026-10-09', calendario: FESTIVOS_2026, filasGeneral: SIN_GENERAL, municipio: '08001', diasLibres: [] })
  eq('viernes 9-oct: salta el fin de semana y el festivo del lunes 12 (Día de la Raza)', viernes.dias, ['2026-10-09', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-19'])

  const sinCalendario = diasDeAgenda({ hoy: '2026-10-09', calendario: [], filasGeneral: SIN_GENERAL, municipio: '08001', diasLibres: [] })
  eq('sin calendario, el lunes 12 cuenta como hábil', sinCalendario.dias[1], '2026-10-12')

  const libres: DiaLibreAgenda[] = [
    { fecha: '2026-10-15', fraccion: 1, estado: 'aprobado' },
    { fecha: '2026-10-16', fraccion: 0.5, estado: 'aprobado' },
    { fecha: '2026-10-19', fraccion: 1, estado: 'por_aprobar' },
    { fecha: '2026-10-20', fraccion: 1, estado: 'registrado' },
  ]
  const conLibres = diasDeAgenda({ hoy: HOY, calendario: FESTIVOS_2026, filasGeneral: SIN_GENERAL, municipio: '08001', diasLibres: libres })
  eq('salta los días libres completos (aprobado y registrado); medio día y por aprobar no', conLibres.dias, ['2026-10-14', '2026-10-16', '2026-10-19', '2026-10-21', '2026-10-22', '2026-10-23'])
  eq('y dice cuáles saltó', conLibres.omitidas.map(o => o.fecha), ['2026-10-15', '2026-10-20'])

  const hoyLibre = diasDeAgenda({ hoy: HOY, calendario: FESTIVOS_2026, filasGeneral: SIN_GENERAL, municipio: '08001', diasLibres: [{ fecha: HOY, fraccion: 1, estado: 'aprobado' }] })
  eq('si hoy es día libre completo, hoy no se agenda', hoyLibre.dias[0], null)
  eq('pero los otros 5 días sí', hoyLibre.dias.slice(1), ['2026-10-15', '2026-10-16', '2026-10-19', '2026-10-20', '2026-10-21'])

  const sabado = diasDeAgenda({ hoy: '2026-10-17', calendario: FESTIVOS_2026, filasGeneral: SIN_GENERAL, municipio: '08001', diasLibres: [] })
  eq('un sábado, hoy se agenda igual (la persona sabe si trabaja) y siguen lun a vie', sabado.dias, ['2026-10-17', '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23'])

  const ciudad: DiaCalendarioEntrada[] = [
    ...FESTIVOS_2026,
    { fecha: '2026-10-17', alcance: 'ciudad', municipality_id: '08001', tipo: 'habil', nombre: 'Sábado hábil de Barranquilla' },
    { fecha: '2026-10-15', alcance: 'ciudad', municipality_id: '05001', tipo: 'no_habil', nombre: 'Otra ciudad' },
  ]
  const conCiudad = diasDeAgenda({ hoy: HOY, calendario: ciudad, filasGeneral: SIN_GENERAL, municipio: '08001', diasLibres: [] })
  eq('un día hábil de su ciudad cuenta; el de otra ciudad no', conCiudad.dias, ['2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-19', '2026-10-20'])

  const semanaLarga: GeneralVigencia[] = [
    { parametro: 'dias_habiles_semana', valor: { '1': 1, '2': 1, '3': 1, '4': 1, '5': 1, '6': 0.5, '7': 0 }, vigente_desde: '2026-10-12', vigente_hasta: null },
  ]
  const conSabado = diasDeAgenda({ hoy: HOY, calendario: FESTIVOS_2026, filasGeneral: semanaLarga, municipio: '08001', diasLibres: [] })
  eq('con el sábado como medio día hábil en config_general, el sábado entra', conSabado.dias[3], '2026-10-17')
  check('todos los días quedan dentro de la ventana de la agenda', miercoles.dias.every(d => d === null || mensajeFechaCita(d, HOY) === null))
}

// ---------------------------------------------------------------------------------------------
console.log('3. Médicos, visitantes y contactos del plan')
const PLAN = planDe(HOY)
{
  const porSede = (sedeId: string) => PLAN.medicos.filter(m => m.sedes.some(s => s.sede_id === sedeId))
  const portoazul = porSede(SEDES.portoazul.id).length
  const reina = porSede(SEDES.reinaCatalina.id).length
  check('de 4 a 5 médicos en Portoazul', portoazul >= 4 && portoazul <= 5, portoazul)
  check('de 4 a 5 médicos en Reina Catalina de Barranquilla', reina >= 4 && reina <= 5, reina)
  eq('uno de Reina Catalina también atiende en Baranoa', porSede(SEDES.baranoa.id).map(m => m.sedes.map(s => s.sede_id)), [[SEDES.reinaCatalina.id, SEDES.baranoa.id]])
  check('nadie atiende a la vez en Portoazul y Reina Catalina', PLAN.medicos.every(m => !(m.sedes.some(s => s.sede_id === SEDES.portoazul.id) && m.sedes.some(s => s.sede_id === SEDES.reinaCatalina.id))))
  check('todos: documento PRUEBA0840NN de tipo otro', PLAN.medicos.every(m => esDocumentoPrueba(m.tipo_documento, m.numero_documento)))
  eq('documentos sin repetir', new Set(PLAN.medicos.map(m => m.numero_documento)).size, PLAN.medicos.length)
  check('todos los nombres terminan en " (prueba)" y tienen 3 o más letras', PLAN.medicos.every(m => m.nombre.endsWith(' (prueba)') && m.nombre.trim().length >= 3))
  eq('nombres sin repetir', new Set(PLAN.medicos.map(m => m.nombre)).size, PLAN.medicos.length)
  check('especialidades de la lista válida (medicos_especialidades_check)', PLAN.medicos.every(m => m.especialidades.length >= 1 && m.especialidades.every(e => (VALORES_ESPECIALIDAD as readonly string[]).includes(e))))
  check('municipio de 5 dígitos, el de su sede principal', PLAN.medicos.every(m => /^\d{5}$/.test(m.municipality_id)))
  eq('los de Portoazul son de Puerto Colombia (08573)', porSede(SEDES.portoazul.id).map(m => m.municipality_id), Array(portoazul).fill('08573'))
  check('cada médico tiene al menos una sede y exactamente una principal (consultorio)', PLAN.medicos.every(m => m.sedes.length >= 1 && m.sedes.filter(s => s.principal).length === 1 && m.sedes[0].principal && m.sedes[0].rol === 'consultorio'))
  check('las sedes extra son "atiende" y sin repetir', PLAN.medicos.every(m => m.sedes.slice(1).every(s => s.rol === 'atiende' && !s.principal) && new Set(m.sedes.map(s => s.sede_id)).size === m.sedes.length))

  eq('Carmen visita a cada médico en sus dos líneas', PLAN.visitantes.length, PLAN.medicos.length * 2)
  check('todas las asignaciones son de Carmen y de sus líneas', PLAN.visitantes.every(v => v.executive_id === CARMEN.executive_id && (LINEAS_CARMEN as readonly string[]).includes(v.line_id)))
  eq('sin asignaciones repetidas (medico_visitantes_vigente_uidx)', new Set(PLAN.visitantes.map(v => `${v.medico}|${v.line_id}`)).size, PLAN.visitantes.length)

  eq('un contacto de compras por clínica', PLAN.contactos.map(c => c.cuenta_id), [SEDES.portoazul.cuenta_id, SEDES.reinaCatalina.cuenta_id])
  check('con cargo "(prueba)", rol compras y nombre de prueba', PLAN.contactos.every(c => c.cargo_texto === CARGO_CONTACTO && c.cargo_texto.includes('(prueba)') && c.rol === 'compras' && c.nombre.endsWith(' (prueba)')))
  check('la sede del contacto es de su cuenta (contactos_sede_de_la_cuenta)', PLAN.contactos.every(c => Object.values(SEDES).some(s => s.id === c.sede_id && s.cuenta_id === c.cuenta_id)))
  eq('CONTACTOS_BASE tiene dos', CONTACTOS_BASE.length, 2)
}

// ---------------------------------------------------------------------------------------------
console.log('4. Agenda del plan')
{
  const deHoy = PLAN.citas.filter(c => c.fecha === HOY)
  const medicaEn = (sedeId: string) => deHoy.filter(c => c.tipo === 'medica' && c.sede_id === sedeId).length
  eq('hoy: 3 médicas en Portoazul', medicaEn(SEDES.portoazul.id), 3)
  eq('hoy: 2 médicas en Reina Catalina', medicaEn(SEDES.reinaCatalina.id), 2)
  eq('hoy: 1 institucional de compras', deHoy.filter(c => c.tipo === 'institucional' && c.subtipo_id === SUBTIPO_COMPRAS).length, 1)
  eq('hoy: 6 citas en total', deHoy.length, 6)
  eq('citas en total', PLAN.citas.length, AGENDA_BASE.length)
  eq('usa hoy y los 5 días hábiles siguientes', Array.from(new Set(PLAN.citas.map(c => c.fecha))), PLAN.dias)
  check('los 5 días hábiles tienen citas', PLAN.dias.slice(1).every(d => PLAN.citas.some(c => c.fecha === d)))
  check('todas con la nota "Simulación" (≤ 300)', PLAN.citas.every(c => c.nota === NOTA_CITA && c.nota.length <= MAX_NOTA_CITA))
  check('todas con hora HH:MM (la hora es obligatoria desde el 2026-10-15)', PLAN.citas.every(c => c.hora !== null && /^([01]\d|2[0-3]):[0-5]\d$/.test(c.hora)))
  check('día 1, médico 5: 10:30; día 4, médico 3: 14:00 (las dos que antes iban sin hora)', PLAN.citas.some(c => c.fecha === PLAN.dias[1] && c.medico === documentoPrueba(5).guardado && c.hora === '10:30') && PLAN.citas.some(c => c.fecha === PLAN.dias[4] && c.medico === documentoPrueba(3).guardado && c.hora === '14:00'))
  check('CHECK por tipo: médica con médico y sin cuenta ni subtipo', PLAN.citas.filter(c => c.tipo === 'medica').every(c => c.medico !== null && c.cuenta_id === null && c.subtipo_id === null))
  check('CHECK por tipo: institucional con cuenta y subtipo y sin médico', PLAN.citas.filter(c => c.tipo === 'institucional').every(c => c.medico === null && c.cuenta_id !== null && c.subtipo_id !== null))
  check('la sede de la cita médica es una donde atiende su médico', PLAN.citas.filter(c => c.tipo === 'medica').every(c => PLAN.medicos.find(m => m.clave === c.medico)?.sedes.some(s => s.sede_id === c.sede_id)))
  check('la sede de la institucional es de su cuenta', PLAN.citas.filter(c => c.tipo === 'institucional').every(c => Object.values(SEDES).some(s => s.id === c.sede_id && s.cuenta_id === c.cuenta_id)))
  check('alguna cita en la sede de Baranoa', PLAN.citas.some(c => c.sede_id === SEDES.baranoa.id))
  const claves = PLAN.citas.map(c => (c.tipo === 'medica' ? `${c.fecha}|m|${c.medico}` : `${c.fecha}|i|${c.cuenta_id}|${c.subtipo_id}`))
  eq('sin duplicados por día y médico o por día, cuenta y subtipo (índices únicos)', new Set(claves).size, claves.length)
  check('todas dentro de la ventana de agenda_crear', PLAN.citas.every(c => mensajeFechaCita(c.fecha, HOY) === null))
  check('las de hoy se crean ayer en Bogotá (cuentan como agendadas)', deHoy.every(c => c.created_at !== null && citaAnticipada(c.created_at, HOY)))
  eq('created_at de hoy = ayer 18:00 de Bogotá', creadaAtCita(HOY, HOY), '2026-10-13T23:00:00.000Z')
  check('las demás se crean al aplicar (antes de su día)', PLAN.citas.filter(c => c.fecha !== HOY).every(c => c.created_at === null && citaAnticipada(`${HOY}T15:00:00.000Z`, c.fecha)))
  check('ordenadas por fecha y hora', PLAN.citas.every((c, i, l) => i === 0 || l[i - 1].fecha < c.fecha || (l[i - 1].fecha === c.fecha && (l[i - 1].hora ?? '99:99') <= (c.hora ?? '99:99'))))
  check('la plantilla solo usa médicos del plan', AGENDA_BASE.every(b => !('medico' in b) || MEDICOS_BASE.some(m => m.n === b.medico)))

  // 0850 (F1a): quien agenda es el usuario; cada fila lleva user_id (NOT NULL) además del Ejecutivo Comercial.
  const idsMedicos = new Map(PLAN.medicos.map((m, i) => [m.clave, `medico-${i}`]))
  const filas = filasDeCitas(PLAN.citas, idsMedicos, 'admin-1', `${HOY}T15:00:00.000Z`)
  check('las filas de las citas simuladas llevan user_id (el de Carmen) y su Ejecutivo Comercial', filas.length === PLAN.citas.length && filas.every(f => f.user_id === CARMEN.user_id && f.executive_id === CARMEN.executive_id), filas[0])
  check('las de hoy conservan su created_at de ayer; las demás, el de al aplicar', filas.every((f, i) => f.created_at === (PLAN.citas[i].created_at ?? `${HOY}T15:00:00.000Z`)))

  const hoyLibre = planDe(HOY, [{ fecha: HOY, fraccion: 1, estado: 'aprobado' }])
  eq('con hoy libre no hay citas de hoy', hoyLibre.citas.filter(c => c.fecha === HOY).length, 0)
  eq('y quedan las de los otros días', hoyLibre.citas.length, AGENDA_BASE.filter(b => b.dia > 0).length)
}

// ---------------------------------------------------------------------------------------------
console.log('5. Configuración de prueba')
{
  const c = PLAN.config
  eq('desde hoy', c.desde, HOY)
  eq('hasta el 2026-10-21 (spec)', c.hasta, FIN_CONFIG_MINIMO)
  eq('perfil médica e institucional', c.valores.perfil, ['medica', 'institucional'])
  check('radio 5.000 m, el máximo de config_personas_radio_check', c.valores.radio_m === RADIO_PRUEBA_M && RADIO_PRUEBA_M >= 50 && RADIO_PRUEBA_M <= 5000)
  check('telefónica habilitada con tope 3 (0..20)', c.valores.telefonica_habilitada && c.valores.tope_telefonicas_dia === TOPE_TELEFONICAS_PRUEBA && TOPE_TELEFONICAS_PRUEBA >= 0 && TOPE_TELEFONICAS_PRUEBA <= 20)
  eq('de Carmen y con el motivo de la simulación', [c.valores.executive_id, c.motivo], [CARMEN.executive_id, MOTIVO_CONFIG])
  const despues = planDe('2026-10-26')
  eq('si se corre más tarde, rige hasta el último día de la agenda', despues.config.hasta, despues.dias[5])
  check('la configuración cubre todas las citas', PLAN.citas.every(cita => cita.fecha >= c.desde && cita.fecha <= c.hasta))
  eq('el plan no tiene problemas con agenda_crear (sin configuración previa)', problemasDelPlan(PLAN, { config: [], subtipo: SUBTIPO_VIGENTE, diasLibres: [] }), [])
  const soloMedica: ConfigExistente[] = [
    { id: 'x', executive_id: CARMEN.executive_id, perfil: ['medica'], telefonica_habilitada: false, tope_telefonicas_dia: null, radio_m: null, vigente_desde: '2026-10-01', vigente_hasta: null, motivo: 'Otro', anulado_at: null },
  ]
  check('con un perfil solo médico ya registrado, la de prueba (que se registra encima) lo cubre', problemasDelPlan(PLAN, { config: soloMedica, subtipo: SUBTIPO_VIGENTE, diasLibres: [] }).length === 0)
  const vencido = problemasDelPlan(PLAN, { config: [], subtipo: { vigente_desde: '2026-10-12', vigente_hasta: '2026-10-15' }, diasLibres: [] })
  check('un subtipo de compras vencido se avisa', vencido.length === 2 && vencido.every(p => p.includes('subtipo')), vencido)
  const enLibre = problemasDelPlan(PLAN, { config: [], subtipo: SUBTIPO_VIGENTE, diasLibres: [{ fecha: '2026-10-15', fraccion: 1, estado: 'aprobado' }] })
  check('una cita en un día libre se avisa (agenda_crear la rechazaría)', enLibre.length > 0 && enLibre.every(p => p.startsWith('2026-10-15')), enLibre)
}

// ---------------------------------------------------------------------------------------------
console.log('6. Idempotencia: el plan es el mismo y la segunda corrida no crea nada')
{
  eq('armar el plan dos veces da lo mismo', planDe(HOY), PLAN)
  const vacio = pendientes(PLAN, EXISTENTES_VACIO)
  eq('en una base sin nada, crea todo', [vacio.medicosCrear.length, vacio.visitantesCrear.length, vacio.contactosCrear.length, vacio.citasCrear.length], [PLAN.medicos.length, PLAN.visitantes.length, PLAN.contactos.length, PLAN.citas.length])
  check('y registra la configuración', vacio.configRegistrar !== null)
  check('no está vacío', !nadaPendiente(vacio))

  const tras = existentesTrasAplicar(PLAN)
  const segunda = pendientes(PLAN, tras)
  check('después de aplicar, no queda nada pendiente', nadaPendiente(segunda), segunda)
  eq('todas las citas ya están', segunda.citasYaEstan, PLAN.citas.length)

  const sin0840 = pendientes(PLAN, { ...EXISTENTES_VACIO, citas: null })
  check('sin la 0840 la agenda queda pendiente y no se planea ninguna cita', sin0840.sinAgenda && sin0840.citasCrear.length === 0)

  const medicoInactivo = { ...tras, medicos: tras.medicos.map((m, i) => (i === 0 ? { ...m, activo: false } : m)) }
  eq('un médico de prueba inactivo se reactiva (no se crea otro)', [pendientes(PLAN, medicoInactivo).medicosReactivar.length, pendientes(PLAN, medicoInactivo).medicosCrear.length], [1, 0])
  const sinBaranoa = { ...tras, medicos: tras.medicos.map(m => ({ ...m, sedes: m.sedes.filter(s => s !== SEDES.baranoa.id) })) }
  eq('si le falta la sede de Baranoa, solo se vincula esa', pendientes(PLAN, sinBaranoa).sedesAgregar.map(s => s.sede_id), [SEDES.baranoa.id])
  const visitanteTerminado = { ...tras, visitantes: tras.visitantes.map((v, i) => (i === 0 ? { ...v, hasta: '2026-10-13' } : v)) }
  eq('un visitante terminado se vuelve a asignar', pendientes(PLAN, visitanteTerminado).visitantesCrear.length, 1)
  const otraCiudad = { ...tras, visitantes: tras.visitantes.map((v, i) => (i === 0 ? { ...v, municipality_id: '08001' } : v)) }
  eq('uno abierto pero de otra ciudad no cuenta', pendientes(PLAN, otraCiudad).visitantesCrear.length, 1)
  const contactoInactivo = { ...tras, contactos: tras.contactos.map((c, i) => (i === 1 ? { ...c, activo: false } : c)) }
  eq('un contacto de prueba inactivo se reactiva', [pendientes(PLAN, contactoInactivo).contactosReactivar.length, pendientes(PLAN, contactoInactivo).contactosCrear.length], [1, 0])
  const citaCancelada = { ...tras, citas: (tras.citas ?? []).map((c, i) => (i === 0 ? { ...c, estado: 'cancelada' as const } : c)) }
  eq('una cita cancelada se vuelve a crear', pendientes(PLAN, citaCancelada).citasCrear.length, 1)
  const citaHecha = { ...tras, citas: (tras.citas ?? []).map((c, i) => (i === 0 ? { ...c, estado: 'hecha' as const, visita_id: 'v1' } : c)) }
  eq('una cita hecha cuenta como que ya está', pendientes(PLAN, citaHecha).citasCrear.length, 0)
  const citaPropia = { ...tras, citas: (tras.citas ?? []).map((c, i) => (i === 0 ? { ...c, nota: null } : c)) }
  eq('una cita que Carmen ya agendó con ese médico ese día tampoco se duplica', pendientes(PLAN, citaPropia).citasCrear.length, 0)
  const configAnulada = { ...tras, config: tras.config.map(c => ({ ...c, anulado_at: '2026-10-14T12:00:00Z' })) }
  check('una configuración de prueba anulada se registra otra vez', pendientes(PLAN, configAnulada).configRegistrar !== null)
  const configVencida = { ...tras, config: tras.config.map(c => ({ ...c, vigente_desde: '2026-10-01', vigente_hasta: '2026-10-13' })) }
  check('una que ya no rige hoy también', pendientes(PLAN, configVencida).configRegistrar !== null)
  const configOtroMotivo = { ...tras, config: tras.config.map(c => ({ ...c, motivo: 'Cambio de la directora' })) }
  check('una configuración de Carmen que no es la de prueba no cuenta', pendientes(PLAN, configOtroMotivo).configRegistrar !== null)
  check('configDePruebaVigente encuentra la de prueba', configDePruebaVigente(tras.config, HOY)?.id === 'cfg-1')
}

// ---------------------------------------------------------------------------------------------
console.log('7. --borrar')
{
  const tras = existentesTrasAplicar(PLAN)
  const medicoPrueba = tras.medicos[0].id
  const citaHecha = (tras.citas ?? [])[0]
  const citaInstitucional = (tras.citas ?? []).find(c => c.tipo === 'institucional') as CitaExistente
  const visitas: VisitaExistente[] = [
    { id: 'v-medico', executive_id: CARMEN.executive_id, source: 'app', medico_id: medicoPrueba, contacto_id: null, agenda_id: citaHecha.id, deleted_at: null, visit_date: HOY },
    { id: 'v-ayer', executive_id: CARMEN.executive_id, source: 'app', medico_id: tras.medicos[1].id, contacto_id: null, agenda_id: null, deleted_at: null, visit_date: '2026-10-13' },
    { id: 'v-contacto', executive_id: CARMEN.executive_id, source: 'app', medico_id: null, contacto_id: tras.contactos[0].id, agenda_id: null, deleted_at: null, visit_date: HOY },
    // Visita institucional REAL (contacto real de la cuenta real de Portoazul) que se vinculó sola a la cita simulada.
    { id: 'v-cita-inst', executive_id: CARMEN.executive_id, source: 'app', medico_id: null, contacto_id: 'contacto-real', agenda_id: citaInstitucional.id, deleted_at: null, visit_date: HOY },
    // Institucional de prueba (contacto de prueba) que cumplió una cita simulada de compras: esa sí se anula.
    { id: 'v-inst-prueba', executive_id: CARMEN.executive_id, source: 'app', medico_id: null, contacto_id: tras.contactos[1].id, agenda_id: 'cita-inst-prueba', deleted_at: null, visit_date: HOY },
    { id: 'v-real', executive_id: CARMEN.executive_id, source: 'app', medico_id: 'medico-real', contacto_id: 'contacto-real', agenda_id: null, deleted_at: null, visit_date: HOY },
    { id: 'v-ya-anulada', executive_id: CARMEN.executive_id, source: 'app', medico_id: medicoPrueba, contacto_id: null, agenda_id: null, deleted_at: '2026-10-14T10:00:00Z', visit_date: HOY },
    { id: 'v-otra-persona', executive_id: 'otra', source: 'app', medico_id: medicoPrueba, contacto_id: null, agenda_id: null, deleted_at: null, visit_date: HOY },
    { id: 'v-vmo', executive_id: CARMEN.executive_id, source: 'vmo_import', medico_id: medicoPrueba, contacto_id: null, agenda_id: null, deleted_at: null, visit_date: HOY },
  ]
  const citaReal: CitaExistente = { id: 'cita-real', executive_id: CARMEN.executive_id, fecha: HOY, tipo: 'medica', medico_id: 'medico-real', cuenta_id: null, subtipo_id: null, estado: 'pendiente', nota: 'Llevar muestras', visita_id: null }
  const citaPropiaConPrueba: CitaExistente = { id: 'cita-propia', executive_id: CARMEN.executive_id, fecha: '2026-10-22', tipo: 'medica', medico_id: medicoPrueba, cuenta_id: null, subtipo_id: null, estado: 'pendiente', nota: null, visita_id: null }
  const yaCancelada: CitaExistente = { ...(tras.citas ?? [])[1], estado: 'cancelada' }
  const citaInstPrueba: CitaExistente = { ...citaInstitucional, id: 'cita-inst-prueba', fecha: '2026-10-15', estado: 'hecha', visita_id: 'v-inst-prueba' }
  // Cita que Carmen agendó en la app (no simulada: sin nota "Simulación", cuenta real) y reportó con un contacto de prueba.
  const citaAgendadaEnApp: CitaExistente = { id: 'cita-app', executive_id: CARMEN.executive_id, fecha: HOY, tipo: 'institucional', medico_id: null, cuenta_id: SEDES.portoazul.cuenta_id, subtipo_id: 'subtipo-compras', estado: 'hecha', nota: null, visita_id: 'v-contacto' }
  const citas: CitaExistente[] = [
    { ...citaHecha, estado: 'hecha', visita_id: 'v-medico' },
    yaCancelada,
    ...(tras.citas ?? []).slice(2).map(c => (c.id === citaInstitucional.id ? { ...c, estado: 'hecha' as const, visita_id: 'v-cita-inst' } : c)),
    citaReal,
    citaPropiaConPrueba,
    citaInstPrueba,
    citaAgendadaEnApp,
  ]
  const medicoReal = { id: 'medico-real', tipo_documento: 'CC', numero_documento: '79123456', nombre: 'Médico real', activo: true, sedes: [SEDES.portoazul.id] }
  const visitantes = [
    ...tras.visitantes,
    { id: 'vis-hoy', medico_id: medicoPrueba, executive_id: 'otra', line_id: LINEAS_CARMEN[0], municipality_id: null, desde: HOY, hasta: null },
    { id: 'vis-viejo', medico_id: tras.medicos[1].id, executive_id: CARMEN.executive_id, line_id: LINEAS_CARMEN[0], municipality_id: '08001', desde: '2026-09-01', hasta: null },
    { id: 'vis-terminado', medico_id: tras.medicos[1].id, executive_id: CARMEN.executive_id, line_id: LINEAS_CARMEN[1], municipality_id: null, desde: '2026-09-01', hasta: '2026-09-30' },
    { id: 'vis-real', medico_id: 'medico-real', executive_id: CARMEN.executive_id, line_id: LINEAS_CARMEN[0], municipality_id: null, desde: '2026-09-01', hasta: null },
  ]
  const configOtra: ConfigExistente = { id: 'cfg-otra', executive_id: CARMEN.executive_id, perfil: ['medica'], telefonica_habilitada: false, tope_telefonicas_dia: null, radio_m: null, vigente_desde: '2026-10-22', vigente_hasta: null, motivo: 'Continúa después de un valor temporal', anulado_at: null }
  const configVieja: ConfigExistente = { ...tras.config[0], id: 'cfg-vieja', vigente_desde: '2026-09-01', vigente_hasta: '2026-09-30' }
  const base: Existentes = {
    medicos: [...tras.medicos, medicoReal],
    visitantes,
    contactos: [...tras.contactos, { id: 'contacto-real', cuenta_id: SEDES.portoazul.cuenta_id, nombre: 'Compras real', cargo_texto: 'Jefe de compras', activo: true }],
    citas,
    config: [...tras.config, configOtra, configVieja],
    visitas,
  }
  const b = planBorrar(base, HOY)
  eq('anula solo las visitas de Carmen a médicos de prueba o con contactos de prueba', b.visitasAnular, ['v-ayer', 'v-contacto', 'v-inst-prueba', 'v-medico'])
  check('no anula la visita a un médico real, la ya anulada, la de otra persona ni la importada de VMO', !b.visitasAnular.some(id => ['v-real', 'v-ya-anulada', 'v-otra-persona', 'v-vmo'].includes(id)))
  check('NO anula la visita institucional real que se vinculó sola a la cita simulada de compras (cuenta real)', !b.visitasAnular.includes('v-cita-inst'), b.visitasAnular)
  eq('esa cita simulada se deja hecha (su visita es real) y se muestra', b.citasConVisitaReal, [citaInstitucional.id])
  check('…y no se cancela (la visita real seguiría apuntando a una cita cancelada)', !b.citasCancelar.includes(citaInstitucional.id))
  check('cancela las citas simuladas (también la hecha por una visita de prueba) y la que Carmen agendó con un médico de prueba', b.citasCancelar.includes(citaHecha.id) && b.citasCancelar.includes('cita-propia') && b.citasCancelar.includes('cita-inst-prueba'))
  check('no cancela la cita real ni vuelve a cancelar la ya cancelada', !b.citasCancelar.includes('cita-real') && !b.citasCancelar.includes(yaCancelada.id))
  // 0850: las que no se hicieron y las eliminadas ya están cerradas; pasarlas a cancelada violaría
  // visitas_agenda_estado_datos_check (no_realizada_at / eliminada_at) y detendría todo --borrar.
  const cerradas: CitaExistente[] = [
    { ...citaPropiaConPrueba, id: 'cita-no-se-hizo', fecha: '2026-10-12', estado: 'no_realizada' },
    { ...citaPropiaConPrueba, id: 'cita-eliminada', fecha: '2026-10-23', estado: 'eliminada' },
  ]
  const conCerradas = planBorrar({ ...base, citas: [...citas, ...cerradas] }, HOY)
  check('no cancela una simulada que no se hizo ni una eliminada (solo pendientes y hechas, como agenda_cancelar)', !conCerradas.citasCancelar.includes('cita-no-se-hizo') && !conCerradas.citasCancelar.includes('cita-eliminada') && conCerradas.citasCancelar.length === b.citasCancelar.length, conCerradas.citasCancelar)
  eq('la cita agendada en la app que cumplió una visita que se anula vuelve a pendiente (como visitas_anular)', b.citasLiberar, ['cita-app'])
  check('…y no se cancela (no es simulada)', !b.citasCancelar.includes('cita-app'))
  check('una cita real pendiente o de una visita que no se anula no se toca', !b.citasLiberar.includes('cita-real'))
  check('volver a pendiente cuenta para "nada que borrar"', !nadaQueBorrar({ ...planBorrar(EXISTENTES_VACIO, HOY), citasLiberar: ['x'] }))
  eq('cancela todas las demás simuladas', b.citasCancelar.length, PLAN.citas.length - 1 - 1 + 1 + 1)
  check('una cita simulada cuya visita ya no está viva (anulada antes) sí se cancela', planBorrar({ ...base, visitas: base.visitas.filter(v => v.id !== 'v-cita-inst') }, HOY).citasCancelar.includes(citaInstitucional.id))
  check('citasConVisitaReal solo se muestra: no cuenta para "nada que borrar"', nadaQueBorrar({ ...planBorrar(EXISTENTES_VACIO, HOY), citasConVisitaReal: ['x'] }))
  check('el texto de las citas que se dejan no dice "KAM", "representante" ni "panel"', [1, 2].every(n => !/\bkam\b|representante|panel/i.test(textoCitasConVisitaReal(n))))
  eq('termina los visitantes abiertos de los médicos de prueba (de cualquier persona)', b.visitantesTerminar.length, tras.visitantes.length + 2)
  check('no toca el visitante ya terminado ni el del médico real', !b.visitantesTerminar.some(v => v.id === 'vis-terminado' || v.id === 'vis-real'))
  eq('el que empezó hoy termina hoy (hasta >= desde)', b.visitantesTerminar.find(v => v.id === 'vis-hoy')?.hasta, HOY)
  eq('el que empezó antes termina ayer', b.visitantesTerminar.find(v => v.id === 'vis-viejo')?.hasta, '2026-10-13')
  eq('hastaVisitante: desde de mañana se queda en su desde', hastaVisitante('2026-10-15', HOY), '2026-10-15')
  eq('desactiva solo los médicos de prueba', b.medicosDesactivar, tras.medicos.map(m => m.id).sort())
  eq('desactiva solo los contactos de prueba', b.contactosDesactivar, tras.contactos.map(c => c.id).sort())
  eq('cierra solo la configuración de prueba que rige hoy, hasta ayer', b.configCerrar, [{ id: 'cfg-1', hasta: '2026-10-13' }])
  check('no toca la continuación ni la de prueba ya vencida', !b.configCerrar.some(c => c.id === 'cfg-otra' || c.id === 'cfg-vieja'))

  const borrado: Existentes = {
    medicos: base.medicos.map(m => (b.medicosDesactivar.includes(m.id) ? { ...m, activo: false } : m)),
    visitantes: base.visitantes.map(v => {
      const fin = b.visitantesTerminar.find(t => t.id === v.id)
      return fin ? { ...v, hasta: fin.hasta } : v
    }),
    contactos: base.contactos.map(c => (b.contactosDesactivar.includes(c.id) ? { ...c, activo: false } : c)),
    citas: (base.citas ?? []).map(c => (b.citasCancelar.includes(c.id) ? { ...c, estado: 'cancelada' as const, visita_id: null } : c)),
    config: base.config.map(c => (b.configCerrar.some(x => x.id === c.id) ? { ...c, vigente_hasta: '2026-10-13' } : c)),
    visitas: base.visitas.map(v => (b.visitasAnular.includes(v.id) ? { ...v, deleted_at: '2026-10-14T15:00:00Z' } : v)),
  }
  const otraVez = planBorrar(borrado, HOY)
  check('correr --borrar otra vez no hace nada', nadaQueBorrar(otraVez), otraVez)
  check('en una base sin nada simulado no hay nada que borrar', nadaQueBorrar(planBorrar(EXISTENTES_VACIO, HOY)))
  check('sin la 0840 (sin citas) igual termina, desactiva y anula', planBorrar({ ...tras, citas: null }, HOY).medicosDesactivar.length === PLAN.medicos.length)
  const reaplicar = pendientes(PLAN, borrado)
  // La institucional de hoy que cumplió la visita real se quedó hecha: --aplicar no la vuelve a crear.
  eq('después de borrar, --aplicar reactiva médicos y contactos y vuelve a crear visitantes, citas (menos la que cumplió la visita real) y configuración', [reaplicar.medicosReactivar.length, reaplicar.medicosCrear.length, reaplicar.contactosReactivar.length, reaplicar.visitantesCrear.length, reaplicar.citasCrear.length, reaplicar.configRegistrar !== null], [PLAN.medicos.length, 0, PLAN.contactos.length, PLAN.visitantes.length, PLAN.citas.length - 1, true])
  check('el motivo de borrar tiene de 5 a 300 caracteres (visits_app_check y cancelada_motivo)', MOTIVO_BORRAR.length >= 5 && MOTIVO_BORRAR.length <= 300)
}

// ---------------------------------------------------------------------------------------------
console.log('8. Textos visibles')
{
  const textos = [
    ...Object.values(TEXTOS),
    NOTA_CITA,
    CARGO_CONTACTO,
    MOTIVO_CONFIG,
    MOTIVO_BORRAR,
    ...PLAN.medicos.map(m => m.nombre),
    ...PLAN.contactos.map(c => c.nombre),
  ]
  check('ningún texto dice "KAM"', textos.every(t => !/\bkam\b/i.test(t)), textos.filter(t => /\bkam\b/i.test(t)))
  check('ninguno dice "representante" ni "panel"', textos.every(t => !/representante|panel/i.test(t)))
  check('la persona es "Ejecutivo Comercial"', TEXTOS.persona === 'Ejecutivo Comercial')
}

// ---------------------------------------------------------------------------------------------
console.log('9. La 0840 se puede re-ejecutar con la simulación aplicada (sus datos de prueba no chocan)')
{
  const sql = readFileSync(path.resolve(__dirname, '../../database/migrations/2026-10-14_0840_visitas_agenda.sql'), 'utf8')
  // LIKE → RegExp (% = cualquier cosa, _ = un carácter, \_ = guion bajo literal).
  const aRegex = (like: string) =>
    new RegExp(
      '^' +
        like
          .split(/(\\_|%|_)/)
          .map(parte => (parte === '%' ? '.*' : parte === '_' ? '.' : parte === '\\_' ? '_' : parte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
          .join('') +
        '$'
    )
  const patronesMedicos = Array.from(sql.matchAll(/medicos WHERE numero_documento LIKE '([^']+)'/g), m => m[1])
  const creadosPorLaMigracion = Array.from(sql.matchAll(/'numero_documento', '(PRUEBA0840[^']*)'/g), m => m[1])
  check('la 0840 revisa los médicos de prueba en 2 sitios (antes de probar y al final)', patronesMedicos.length === 2, patronesMedicos)
  check('ningún documento de la simulación (PRUEBA0840NN) cae en esos patrones', PLAN.medicos.every(m => patronesMedicos.every(p => !aRegex(p).test(m.numero_documento))), { patronesMedicos, docs: PLAN.medicos.map(m => m.numero_documento) })
  check('…y los médicos que crea la propia migración sí (la comprobación sigue sirviendo)', creadosPorLaMigracion.length >= 6 && creadosPorLaMigracion.every(doc => patronesMedicos.every(p => aRegex(p).test(doc))), creadosPorLaMigracion)
  check('la simulación no crea cuentas ni subtipos de prueba (la 0840 también los revisa)', !/from\('cuentas'\)\.insert|from\('subtipos_institucionales'\)\.insert/.test(readFileSync(path.resolve(__dirname, 'simulacion-carmen.ts'), 'utf8')))
}

// ---------------------------------------------------------------------------------------------
console.log('10. La 0840 y la 9944 se pueden aplicar tal cual: cada comilla de dólar cierra donde debe')
{
  /**
   * Lexer de nivel superior como el de PostgreSQL: cadenas '...' (con ''), comentarios -- y /* *\/, y $tag$…$tag$ (lo de
   * dentro NO se mira: ahí un -- no es comentario para el lexer de SQL, así que un "$$" escrito en un comentario de un DO
   * o de una función cierra el bloque antes de tiempo). Devuelve el carácter que sigue a cada cierre.
   */
  const despuesDeCadaCierre = (sql: string): string[] => {
    const despues: string[] = []
    let i = 0
    while (i < sql.length) {
      if (sql[i] === "'") {
        let j = i + 1
        for (;;) {
          const k = sql.indexOf("'", j)
          if (k < 0) throw new Error('cadena sin cerrar')
          if (sql[k + 1] === "'") {
            j = k + 2
            continue
          }
          i = k + 1
          break
        }
        continue
      }
      if (sql.startsWith('--', i)) {
        const k = sql.indexOf('\n', i)
        i = k < 0 ? sql.length : k
        continue
      }
      if (sql.startsWith('/*', i)) {
        i = sql.indexOf('*/', i + 2) + 2
        continue
      }
      const m = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i, i + 80))
      if (m) {
        const k = sql.indexOf(m[0], i + m[0].length)
        if (k < 0) throw new Error(`${m[0]} sin cerrar`)
        despues.push(sql.slice(k + m[0].length, k + m[0].length + 1))
        i = k + m[0].length
        continue
      }
      i++
    }
    return despues
  }
  for (const [archivo, bloques] of [
    ['2026-10-14_0840_visitas_agenda.sql', 6],
    ['2026-10-14_9944_visitas_agenda_rollback.sql', 4],
  ] as const) {
    const sql = readFileSync(path.resolve(__dirname, '../../database/migrations', archivo), 'utf8')
    const cierres = despuesDeCadaCierre(sql)
    check(`${archivo}: ${bloques} bloques $$ (DO y funciones) y cada uno cierra en "$$;" (ningún comentario lleva "$$")`, cierres.length === bloques && cierres.every(c => c === ';'), cierres)
  }
  check('el lexer de la prueba sí detecta un "$$" escrito en un comentario dentro de un DO', despuesDeCadaCierre("DO $$\nBEGIN\n  -- el texto entre $$ y $$ de cada archivo\nEND;\n$$;\n").some(c => c !== ';'))
}

console.log(`\n${passed} pruebas ok, ${failed} fallas`)
if (failed > 0) process.exit(1)
