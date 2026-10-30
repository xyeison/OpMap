/**
 * Sección 17 de scripts/movil-check.ts (spec 2026-10-15-usabilidad-y-agenda-con-hora, paquete 3):
 * calendario del mes, franjas de media hora, hora obligatoria (validarCitaConHora,
 * cuerpoCitaConHora), textos de Agendar, pedido para Agendar y las pantallas de la agenda.
 * F1b (actividades de campo): el choque es un error con el texto del servidor (errorChoque, ya no avisoChoque), sin
 * tope hacia adelante (ventanaInicialAgendar, rangoPorCargar) y "otra fecha" (pedidoOtraFecha, cuerpoOtraFecha). Lo
 * demás de F1b (persona, ciclo de vida, textos) está en 21-persona.ts.
 *
 * Corren en Node, sin React Native ni red (las que revisan una pantalla leen su archivo y miran cada cosa dentro de su
 * bloque: el <Selector …/> del médico, la llamada, la función). Este solo, desde mobile/:
 *   npx tsx scripts/checks/correr.ts 17-agenda
 */
import {
  DURACION_VISUAL_MIN,
  HORARIO_AGENDA,
  MENSAJE_HORA_OBLIGATORIA,
  ALTO_PANTALLA_BAJA,
  MENSAJE_CITA_REPETIDA_CUENTA,
  MENSAJE_CITA_REPETIDA_MEDICO,
  MENSAJE_HORA_PASADA,
  MIN_LIBRES_PLEGADAS,
  OTRA_HORA,
  avisoAgendadaHoy,
  bloqueaAgendar,
  citasQueChocan,
  cuerpoCitaConHora,
  cuerpoOtraFecha,
  enPie,
  errorChoque,
  errorCitaRepetida,
  fechaInicialAgendar,
  fijarCitaResaltada,
  fijarPedidoAgendar,
  filaDeAhora,
  franjaDe,
  franjaPasada,
  franjasHorario,
  lineasCitasDelDia,
  marcasDelMes,
  medicosConCitaEseDia,
  ocupacionDelDia,
  pedidoOtraFecha,
  plegarLibres,
  primeraFranjaLibre,
  puedeAgendarProxima,
  rangoPorCargar,
  rutaAgendar,
  rutaMiAgenda,
  siguienteFranjaLibre,
  textoBotonAgendar,
  textoCitasDelDia,
  tomarCitaResaltada,
  tomarPedidoAgendar,
  validarCitaConHora,
  ventanaInicialAgendar,
  vistaCalendarioAgendar,
  type PedidoAgendar,
} from '../../lib/agenda'
import {
  cuadriculaMes,
  cuadriculaSemana,
  esElegible,
  lunesDe,
  mesAnterior,
  mesDe,
  mesesDeRango,
  mesSiguiente,
  rangoDeMes,
  semanaDe,
  semanasVisibles,
  tituloMes,
  tituloSemana,
} from '../../lib/calendario'
import { tieneClaves } from '../../lib/claves-api'
import { diasEntre, sumarDias, sumarMeses } from '../../lib/fechas'
import { MENSAJE_CITA_PASADA, MENSAJE_HORA_CITA, formularioCitaVacio, type FormularioCita } from '../../lib/propuesta'
import type { CitaItem, DiaLibreItem } from '../../lib/tipos'
import type { Probador } from './probador'

// Corre en Node (tsx) con el programa de tipos de la app (sin @types/node): fs y path con lo mínimo que se usa.
interface FsMinimo {
  readFileSync(ruta: string, codificacion: 'utf8'): string
}
interface PathMinimo {
  resolve(...partes: string[]): string
}
declare const __dirname: string
const { readFileSync } = require('fs') as FsMinimo
const path = require('path') as PathMinimo

/** Archivo del repo (desde la raíz: mobile/…, web/…). */
const leer = (relativa: string) => readFileSync(path.resolve(__dirname, '../../..', relativa), 'utf8')

/** El primer bloque `<Etiqueta … />` (o `<Etiqueta …>`) que contiene `marca`; '' si no hay. */
function bloqueJsx(texto: string, etiqueta: string, marca: string): string {
  let desde = 0
  for (;;) {
    const inicio = texto.indexOf(`<${etiqueta}`, desde)
    if (inicio < 0) return ''
    // Fin de la etiqueta de apertura: el primer '>' a nivel 0 de llaves, después del nombre (que puede ser genérico).
    let nivel = 0
    let fin = -1
    for (let i = inicio + etiqueta.length + 1; i < texto.length; i++) {
      const ch = texto[i]
      if (ch === '{') nivel++
      else if (ch === '}') nivel--
      else if (ch === '>' && nivel === 0 && texto[i - 1] !== '=') {
        fin = i
        break
      }
    }
    const trozo = fin < 0 ? texto.slice(inicio) : texto.slice(inicio, fin + 1)
    if (trozo.includes(marca)) return trozo
    desde = inicio + 1
  }
}

/** El código sin comentarios (para buscar textos visibles y llamadas sin que cuente lo que dice un comentario). */
const sinComentarios = (texto: string) => texto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

const HOY = '2026-10-15' // jueves
/** Las 10:42 del 15 de octubre de 2026 en Bogotá (15:42 UTC). */
const A_LAS_10_42 = new Date('2026-10-15T15:42:00.000Z')

let secuencia = 0
function cita(extra: Partial<CitaItem> = {}): CitaItem {
  secuencia++
  return {
    id: `cita-${String(secuencia).padStart(3, '0')}`,
    fecha: HOY,
    hora: '09:30',
    tipo: 'medica',
    medico: { id: `medico-${secuencia}`, nombre: 'Dra. Ana Gómez' },
    cuenta: null,
    subtipo: null,
    sede: { id: 'sede-1', nombre: 'Clínica Norte', cuenta_id: 'cuenta-1', cuenta_nombre: 'Clínica Norte S.A.', lat: 11, lng: -74, ubicacion_confirmada: true },
    nota: null,
    estado: 'pendiente',
    visita_id: null,
    distancia_m: null,
    dentro_del_radio: null,
    anticipada: true,
    cancelable: true,
    motivo_codigo: null, no_realizada_at: null, no_realizada_motivo: null, viene_de: null, viene_de_fecha: null, viene_de_estado: null, sucesora_id: null, como: 'ejecutivo', estado_visible: 'programada',
    ...extra,
  }
}

function libre(fecha: string, extra: Partial<DiaLibreItem> = {}): DiaLibreItem {
  return {
    id: `libre-${fecha}`,
    executive_id: 'e1',
    ejecutiva: 'Carmen',
    zona: 'Barranquilla',
    fecha,
    fraccion: 1,
    motivo: 'vacaciones',
    motivo_nombre: 'Vacaciones',
    nota: null,
    estado: 'aprobado',
    fuera_de_plazo: false,
    justificacion: null,
    registrado_por_nombre: null,
    registrado_at: '2026-10-01T15:00:00.000Z',
    revisado_por_nombre: null,
    revisado_at: null,
    motivo_revision: null,
    ...extra,
  }
}

export async function pruebas(t: Probador): Promise<void> {
  const { check } = t
  t.seccion('17. Agenda con hora')

  // -------------------------------------------------------------------------
  t.seccion('17a. Calendario (lib/calendario.ts)')
  {
    const ventana = { hoy: HOY, desde: HOY, hasta: sumarDias(HOY, 30) }
    const octubre = cuadriculaMes('2026-10', ventana)
    const dias = octubre.flat()
    check(
      'cuadriculaMes(2026-10): 5 semanas de 7 días, del lunes 28 de septiembre al domingo 1 de noviembre',
      octubre.length === 5 && octubre.every(s => s.length === 7) && dias[0].fecha === '2026-09-28' && dias[dias.length - 1].fecha === '2026-11-01',
      { semanas: octubre.length, primero: dias[0]?.fecha, ultimo: dias[dias.length - 1]?.fecha }
    )
    check('cada semana empieza en lunes y los días van seguidos', octubre.every(s => new Date(`${s[0].fecha}T12:00:00Z`).getUTCDay() === 1) && dias.every((d, i) => i === 0 || diasEntre(dias[i - 1].fecha, d.fecha) === 1))
    check('hoy va marcado (solo hoy)', dias.filter(d => d.esHoy).map(d => d.fecha).join() === HOY)
    check('los de relleno no son del mes', !dias[0].delMes && !dias[dias.length - 1].delMes && dias.find(d => d.fecha === '2026-10-01')?.delMes === true)
    check(
      'elegible respeta desde y hasta: ayer no, hoy sí, hoy + 30 sí, hoy + 31 no',
      dias.find(d => d.fecha === '2026-10-14')?.elegible === false &&
        dias.find(d => d.fecha === HOY)?.elegible === true &&
        esElegible(sumarDias(HOY, 30), ventana) &&
        !esElegible(sumarDias(HOY, 31), ventana) &&
        cuadriculaMes('2026-11', ventana).flat().find(d => d.fecha === '2026-11-15')?.elegible === false
    )
    check('elegible respeta la marca apagado (día libre)', cuadriculaMes('2026-10', { ...ventana, marcas: { '2026-10-20': { apagado: true } } }).flat().find(d => d.fecha === '2026-10-20')?.elegible === false)
    check('sin desde ni hasta (Mi agenda) todo día es elegible, también los pasados', cuadriculaMes('2026-10', { hoy: HOY }).flat().every(d => d.elegible))
    const noviembre = cuadriculaMes('2026-11', { hoy: HOY })
    check('noviembre de 2026 (empieza en domingo) tiene 6 semanas', noviembre.length === 6 && noviembre[0][6].fecha === '2026-11-01' && noviembre[5][0].fecha === '2026-11-30', noviembre.map(s => s[0].fecha))
    const visibles = semanasVisibles(octubre, ventana)
    const deNoviembre = semanasVisibles(cuadriculaMes('2026-11', ventana), ventana)
    check(
      'semanasVisibles: en Agendar no se dibujan las semanas enteras fuera de hoy..hoy + 30 (octubre desde la del 12; noviembre hasta la del 9)',
      visibles.map(s => s[0].fecha).join() === '2026-10-12,2026-10-19,2026-10-26' && deNoviembre.map(s => s[0].fecha).join() === '2026-10-26,2026-11-02,2026-11-09' && semanasVisibles(octubre, {}).length === 5,
      { octubre: visibles.map(s => s[0].fecha), noviembre: deNoviembre.map(s => s[0].fecha) }
    )
    const semana = cuadriculaSemana(HOY, { hoy: HOY })
    check('la semana de hoy: de lunes 12 a domingo 18, con hoy marcado', semana.map(d => d.numero).join() === '12,13,14,15,16,17,18' && semana[3].esHoy && semanaDe('2026-10-18')[0] === '2026-10-12' && lunesDe('2026-10-12') === '2026-10-12')

    let mesMasLargo = 0
    let mesMasCorto = 99
    for (let mes = '2024-01'; mes <= '2030-12'; mes = sumarMeses(mes, 1)) {
      const { desde, hasta } = rangoDeMes(mes)
      const largo = diasEntre(desde, hasta) + 1
      mesMasLargo = Math.max(mesMasLargo, largo)
      mesMasCorto = Math.min(mesMasCorto, largo)
    }
    check('rangoDeMes nunca pasa de 31 días (2024 a 2030; el tope de GET /api/me/agenda) y febrero bisiesto tiene 29', mesMasLargo === 31 && mesMasCorto === 28 && rangoDeMes('2028-02').hasta === '2028-02-29', { mesMasLargo, mesMasCorto })
    let fuera: string[] = []
    for (const hoy of [HOY, '2026-12-20', '2027-02-10', '2028-01-31']) {
      for (let i = 0; i <= 30; i++) {
        const dia = sumarDias(hoy, i)
        const { desde, hasta } = rangoDeMes(mesDe(dia))
        if (dia < desde || dia > hasta) fuera = [...fuera, dia]
      }
    }
    check('todo día de hoy a hoy + 30 queda dentro del rango de su mes (también cruzando de año y en febrero)', fuera.length === 0, fuera)
    check('mes siguiente y anterior cruzan de año', mesSiguiente('2026-12') === '2027-01' && mesAnterior('2027-01') === '2026-12')
    check('tituloMes y tituloSemana', tituloMes('2026-10') === 'Octubre de 2026' && tituloSemana(HOY) === '12 – 18 oct' && tituloSemana('2026-10-01') === '28 sep – 4 oct', [tituloMes('2026-10'), tituloSemana(HOY), tituloSemana('2026-10-01')])
    check('mesesDeRango: la semana que cruza de mes toca los dos meses', mesesDeRango('2026-09-28', '2026-10-04').join() === '2026-09,2026-10' && mesesDeRango('2026-10-12', '2026-10-18').join() === '2026-10')
  }

  // -------------------------------------------------------------------------
  t.seccion('17b. Franjas de media hora (lib/agenda.ts)')
  {
    const franjas = franjasHorario()
    check("franjasHorario(): 24 franjas, de '07:00' a '18:30' cada 30 minutos", franjas.length === 24 && franjas[0] === '07:00' && franjas[23] === '18:30' && HORARIO_AGENDA.paso === 30, franjas)
    check("franjaDe('09:45') === '09:30' y franjaDe('10:00') === '10:00'", franjaDe('09:45') === '09:30' && franjaDe('10:00') === '10:00' && franjaDe('18:59') === '18:30')
    check('cada cita se dibuja como un bloque de 30 minutos (sin duración)', DURACION_VISUAL_MIN === 30)
    check(
      'Otra hora: de 05 a 21 y minutos 00, 15, 30 y 45',
      OTRA_HORA.horas[0] === '05' && OTRA_HORA.horas[OTRA_HORA.horas.length - 1] === '21' && OTRA_HORA.horas.length === 17 && OTRA_HORA.minutos.join() === '00,15,30,45'
    )

    const delDia = [
      cita({ hora: '08:00', estado: 'hecha' }),
      cita({ hora: '09:30' }),
      cita({ hora: '09:45' }),
      cita({ hora: null }),
      cita({ hora: '10:00', estado: 'cancelada', cancelable: false }),
    ]
    const dia = ocupacionDelDia(delDia)
    check(
      'ocupacionDelDia: dos citas en la franja 09:30, la cancelada no ocupa y la sin hora va al final',
      dia.filas.length === 24 && dia.filas.find(f => f.franja === '09:30')?.citas.length === 2 && dia.filas.find(f => f.franja === '10:00')?.citas.length === 0 && dia.sinHora.length === 1 && dia.sinHora[0].hora === null,
      dia.filas.filter(f => f.citas.length > 0).map(f => [f.franja, f.citas.length])
    )
    const temprano = ocupacionDelDia([cita({ hora: '06:30' })])
    const tarde = ocupacionDelDia([cita({ hora: '19:00' })])
    const seguidas = (filas: readonly { franja: string }[]) => filas.every((f, i) => i === 0 || franjaDe(f.franja) === f.franja && Number(f.franja.slice(0, 2)) * 60 + Number(f.franja.slice(3)) - (Number(filas[i - 1].franja.slice(0, 2)) * 60 + Number(filas[i - 1].franja.slice(3))) === 30)
    check(
      'una cita a las 06:30 amplía el día desde las 06:30, y una a las 19:00 hasta las 19:00, sin huecos',
      temprano.filas[0].franja === '06:30' && temprano.filas[0].citas.length === 1 && temprano.filas.length === 25 && tarde.filas[tarde.filas.length - 1].franja === '19:00' && seguidas(temprano.filas) && seguidas(tarde.filas),
      { temprano: temprano.filas.slice(0, 2).map(f => f.franja), tarde: tarde.filas.slice(-2).map(f => f.franja) }
    )
    check(
      'citasQueChocan: 09:45 se pisa con 09:30 y 09:45 (bloques de 30 min); 10:00 solo con 09:45; la cancelada nunca; la hecha sí',
      citasQueChocan('09:45', delDia).length === 2 && citasQueChocan('10:00', delDia).map(c => c.hora).join() === '09:45' && citasQueChocan('10:15', delDia).length === 0 && citasQueChocan('08:15', delDia).map(c => c.estado).join() === 'hecha'
    )
    check(
      'en pie (0850): pendientes y hechas; la que no se hizo, la cancelada y la eliminada no ocupan la línea ni chocan',
      enPie({ estado: 'pendiente' }) && enPie({ estado: 'hecha' }) && !enPie({ estado: 'no_realizada' }) && !enPie({ estado: 'cancelada' }) && !enPie({ estado: 'eliminada' }) &&
        ocupacionDelDia([cita({ hora: '09:30', estado: 'no_realizada' })]).filas.every(f => f.citas.length === 0) &&
        citasQueChocan('09:30', [cita({ hora: '09:30', estado: 'no_realizada' }), cita({ hora: '09:45', estado: 'eliminada' })]).length === 0
    )
    check('franjaPasada: hoy a las 10:42, 10:30 ya pasó y 11:00 no; ayer siempre; mañana nunca', franjaPasada(HOY, '10:30', A_LAS_10_42) && !franjaPasada(HOY, '11:00', A_LAS_10_42) && franjaPasada('2026-10-14', '18:00', A_LAS_10_42) && !franjaPasada('2026-10-16', '07:00', A_LAS_10_42))
    check('filaDeAhora: la línea "Ahora" va antes de la primera franja que aún no empieza', filaDeAhora(franjas, '10:42') === franjas.indexOf('11:00') && filaDeAhora(franjas, '06:00') === 0 && filaDeAhora(franjas, '20:00') === franjas.length)
  }

  // -------------------------------------------------------------------------
  t.seccion('17c. La hora que Agendar trae puesta (siguienteFranjaLibre)')
  {
    const ocupada11 = [cita({ hora: '11:00' })]
    check("hoy a las 10:42 con las 11:00 ocupada → '11:30'", siguienteFranjaLibre(HOY, ocupada11, A_LAS_10_42) === '11:30', siguienteFranjaLibre(HOY, ocupada11, A_LAS_10_42))
    check("un día futuro vacío → '08:00' (desde las 08:00, aunque el horario empiece a las 07:00)", siguienteFranjaLibre('2026-10-16', ocupada11, A_LAS_10_42) === '08:00')
    check("una cita a las 08:15 ocupa las 08:00 y las 08:30 → '09:00'", siguienteFranjaLibre('2026-10-16', [cita({ fecha: '2026-10-16', hora: '08:15' })], A_LAS_10_42) === '09:00')
    check(
      "la cancelada y la sin hora no ocupan → '08:00'",
      siguienteFranjaLibre('2026-10-16', [cita({ fecha: '2026-10-16', hora: '08:00', estado: 'cancelada' }), cita({ fecha: '2026-10-16', hora: null })], A_LAS_10_42) === '08:00'
    )
    const lleno = franjasHorario(HORARIO_AGENDA.sugeridaDesde).map(hora => cita({ fecha: '2026-10-16', hora }))
    const despuesDe1830 = new Date('2026-10-15T23:31:00.000Z') // 18:31 en Bogotá
    check('un día lleno → null', siguienteFranjaLibre('2026-10-16', lleno, A_LAS_10_42) === null)
    check('hoy después de las 18:30 → null; un día que ya pasó → null', siguienteFranjaLibre(HOY, [], despuesDe1830) === null && siguienteFranjaLibre('2026-10-14', [], A_LAS_10_42) === null)
    const base: FormularioCita = { ...formularioCitaVacio('2026-10-16', ['medica']), medico_id: 'm1', sede_id: 's1' }
    const sinHueco = validarCitaConHora({ ...base, hora: siguienteFranjaLibre('2026-10-16', lleno, A_LAS_10_42) ?? '' }, HOY, ['medica'])
    check(`sin franja libre la hora queda vacía y la validación dice "${MENSAJE_HORA_OBLIGATORIA}"`, sinHueco.length === 1 && sinHueco[0].campo === 'hora' && sinHueco[0].mensaje === MENSAJE_HORA_OBLIGATORIA, sinHueco)
    const marcas = marcasDelMes([], [libre(HOY)], { apagarLibres: true })
    check(
      'primeraFranjaLibre: salta el día libre y el día lleno; hoy después de las 18:30 empieza mañana',
      primeraFranjaLibre(HOY, '2026-10-20', lleno, marcas, A_LAS_10_42)?.fecha === '2026-10-17' &&
        primeraFranjaLibre(HOY, '2026-10-20', [], {}, despuesDe1830)?.fecha === '2026-10-16' &&
        primeraFranjaLibre(HOY, '2026-10-20', [], {}, A_LAS_10_42)?.hora === '11:00',
      primeraFranjaLibre(HOY, '2026-10-20', lleno, marcas, A_LAS_10_42)
    )
  }

  // -------------------------------------------------------------------------
  t.seccion('17d. Hora obligatoria: validarCitaConHora y cuerpoCitaConHora')
  {
    const base: FormularioCita = { ...formularioCitaVacio('2026-10-16', ['medica', 'institucional']), medico_id: 'm1', sede_id: 's1', nota: '  Llevar muestras ' }
    const sinHora = validarCitaConHora({ ...base, hora: '' }, HOY, ['medica'])
    check(`hora '' → error en hora: "${MENSAJE_HORA_OBLIGATORIA}"`, MENSAJE_HORA_OBLIGATORIA === 'Elige la hora de la cita' && sinHora.length === 1 && sinHora[0].campo === 'hora' && sinHora[0].mensaje === MENSAJE_HORA_OBLIGATORIA, sinHora)
    check("hora '   ' (solo espacios) → el mismo error", validarCitaConHora({ ...base, hora: '   ' }, HOY).some(e => e.campo === 'hora' && e.mensaje === MENSAJE_HORA_OBLIGATORIA))
    check("'10:00' → sin errores", validarCitaConHora({ ...base, hora: '10:00' }, HOY, ['medica']).length === 0)
    const malFormada = validarCitaConHora({ ...base, hora: '25:00' }, HOY)
    check("'25:00' → el mensaje de formato del servidor (no el de obligatoria)", malFormada.length === 1 && malFormada[0].campo === 'hora' && malFormada[0].mensaje === MENSAJE_HORA_CITA, malFormada)
    check(
      'los errores van en orden: la fecha, luego la hora, luego el resto',
      validarCitaConHora({ ...base, fecha: '2026-10-14', hora: '', medico_id: null }, HOY).map(e => e.campo).join() === 'fecha,hora,medico_id' &&
        validarCitaConHora({ ...base, fecha: '2026-10-14', hora: '' }, HOY)[0].mensaje === MENSAJE_CITA_PASADA
    )
    const web = leer('web/lib/reporte-visitas.ts')
    const esquemas = leer('web/lib/reporte-visitas-schemas.ts')
    check(
      'el texto es idéntico al del servidor: web/lib/reporte-visitas.ts lo define y citaCreateSchema lo usa en la hora',
      web.includes(`export const MENSAJE_HORA_OBLIGATORIA = '${MENSAJE_HORA_OBLIGATORIA}'`) && /const horaObligatoria[\s\S]{0,400}MENSAJE_HORA_OBLIGATORIA/.test(esquemas) && /\bhora:\s*horaObligatoria\b/.test(esquemas)
    )
    check('el mensaje de formato también es el del servidor', esquemas.includes(`const MENSAJE_HORA = '${MENSAJE_HORA_CITA}'`))
    check('la hora del cuerpo ya no es opcional en el servidor (CitaCreateBase.hora: string)', /export interface CitaCreateBase \{[\s\S]*?\n\s+hora: string\n/.test(web))

    let lanzado = await t.lanza(() => cuerpoCitaConHora({ ...base, hora: '' }))
    check('cuerpoCitaConHora lanza sin hora', lanzado === MENSAJE_HORA_OBLIGATORIA, lanzado)
    lanzado = await t.lanza(() => cuerpoCitaConHora({ ...base, hora: '10:00', sede_id: null }))
    check('cuerpoCitaConHora lanza si falta la sede (como cuerpoCita)', lanzado !== null)
    const cuerpo = cuerpoCitaConHora({ ...base, hora: '9:30' })
    check("cuerpoCitaConHora deja la hora en HH:MM ('9:30' → '09:30'), con las claves del contrato y la nota limpia", cuerpo.hora === '09:30' && tieneClaves(cuerpo, 'citaCreate') && cuerpo.nota === 'Llevar muestras' && cuerpo.medico_id === 'm1', cuerpo)
    const institucional = cuerpoCitaConHora({ ...base, tipo: 'institucional', medico_id: null, cuenta_id: 'c1', subtipo_id: 'sub1', hora: '07.45' })
    check('institucional: la hora también va siempre', institucional.hora === '07:45' && institucional.tipo === 'institucional' && institucional.medico_id === null)
  }

  // -------------------------------------------------------------------------
  t.seccion('17e. Textos de Agendar')
  {
    check("textoBotonAgendar → 'Agendar · jueves 16 oct · 10:00' (16 oct 2025 fue jueves)", textoBotonAgendar('2025-10-16', '10:00') === 'Agendar · jueves 16 oct · 10:00', textoBotonAgendar('2025-10-16', '10:00'))
    check(
      'textoBotonAgendar con la hora normalizada y, sin hora, solo el día',
      textoBotonAgendar(HOY, '9:30') === 'Agendar · jueves 15 oct · 09:30' && textoBotonAgendar('2026-10-16', '') === 'Agendar · viernes 16 oct' && textoBotonAgendar('2026-11-01', '14:00') === 'Agendar · domingo 1 nov · 14:00',
      [textoBotonAgendar(HOY, '9:30'), textoBotonAgendar('2026-10-16', '')]
    )
    const dra = cita({ hora: '09:30', medico: { id: 'm-x', nombre: 'Dra. X' } })
    const clinica = cita({ hora: '10:30', tipo: 'institucional', medico: null, cuenta: { id: 'c-y', nombre: 'Clínica Y' }, subtipo: { id: 's', codigo: 'compras', nombre: 'Compras' } })
    const delDia = [clinica, dra, cita({ hora: '11:00', estado: 'cancelada', medico: { id: 'm-z', nombre: 'Dr. Cancelado' } })]
    // 0850: el choque lo bloquea el servidor (409 en hora) con este texto; antes era un aviso ("Puedes agendar igual").
    const choque = (hora: string, citas = delDia) => errorChoque({ fecha: HOY, hora }, citas)
    check("errorChoque: el error en hora con el texto del servidor ('A las 09:30 ya tienes cita con Dra. X: elige otra hora')", choque('09:30')?.campo === 'hora' && choque('09:30')?.mensaje === 'A las 09:30 ya tienes cita con Dra. X: elige otra hora', choque('09:30'))
    check('errorChoque: 09:45 se cruza con la de las 09:30 (dice su hora); 10:00 no (media hora justa)', choque('09:45')?.mensaje.startsWith('A las 09:30 ya tienes cita con Dra. X') === true && choque('10:00') === null)
    check(
      'errorChoque: con dos, la primera por hora (como agenda_choque); la institucional dice cuenta y subtipo',
      choque('09:40', [dra, cita({ hora: '09:45', medico: { id: 'm-v', nombre: 'Dr. V' } })])?.mensaje === 'A las 09:30 ya tienes cita con Dra. X: elige otra hora' &&
        choque('10:45')?.mensaje === 'A las 10:30 ya tienes cita con Clínica Y · Compras: elige otra hora'
    )
    check(
      'errorChoque da null si la franja está libre, si solo choca una cancelada o una que no se hizo, sin hora, o de otro día',
      choque('08:00') === null &&
        choque('11:00') === null &&
        choque('') === null &&
        choque('09:30', [cita({ hora: null })]) === null &&
        choque('09:30', [cita({ hora: '09:30', estado: 'no_realizada' })]) === null &&
        errorChoque({ fecha: '2026-10-16', hora: '09:30' }, delDia) === null
    )
    check(
      'ningún texto dice ya "Puedes agendar igual" (ni lib/agenda.ts ni Agendar; los comentarios cuentan la historia)',
      !sinComentarios(leer('mobile/lib/agenda.ts')).includes('Puedes agendar igual') && !sinComentarios(leer('mobile/app/(app)/agenda/nueva.tsx')).includes('Puedes agendar igual')
    )
    check('avisoAgendadaHoy solo cuando la fecha es hoy (y dice que contará como no agendada)', avisoAgendadaHoy(HOY, HOY)?.includes('no agendada') === true && avisoAgendadaHoy('2026-10-16', HOY) === null)
    check("textoCitasDelDia → 'Ese día ya tienes: 09:30 Dra. X · 10:30 Clínica Y · Compras' (sin la cancelada); null si no hay", textoCitasDelDia(delDia) === 'Ese día ya tienes: 09:30 Dra. X · 10:30 Clínica Y · Compras' && textoCitasDelDia([]) === null, textoCitasDelDia(delDia))
    const conCita = medicosConCitaEseDia([dra, cita({ fecha: '2026-10-16', hora: '08:00', medico: { id: 'm-otro', nombre: 'Otro' } }), cita({ hora: null, medico: { id: 'm-sin', nombre: 'Sin' } }), cita({ estado: 'cancelada', medico: { id: 'm-c', nombre: 'C' } })], HOY)
    check("medicosConCitaEseDia: 'Cita a las 09:30' para el médico que ya tiene cita ese día (sin otros días ni canceladas)", conCita.get('m-x') === 'Cita a las 09:30' && conCita.get('m-sin') === 'Ya tiene cita ese día' && !conCita.has('m-otro') && !conCita.has('m-c'), [...conCita])
  }

  // -------------------------------------------------------------------------
  t.seccion('17f. Marcas del calendario y días libres')
  {
    const marcas = marcasDelMes(
      [cita(), cita(), cita({ estado: 'cancelada' }), cita({ fecha: '2026-10-16', estado: 'hecha' })],
      [libre('2026-10-20'), libre('2026-10-21', { fraccion: 0.5 }), libre('2026-10-22', { estado: 'por_aprobar' }), libre('2026-10-23', { estado: 'anulado' }), libre('2026-10-24', { estado: 'rechazado' })],
      { apagarLibres: true, requiereAprobacion: true }
    )
    check('cantidad de citas por día (sin las canceladas; las hechas sí)', marcas[HOY]?.citas === 2 && marcas['2026-10-16']?.citas === 1)
    check('los días libres se marcan por estado; anulados y rechazados no', marcas['2026-10-20']?.estadoLibre === 'aprobado' && marcas['2026-10-22']?.estadoLibre === 'por_aprobar' && !marcas['2026-10-23'] && !marcas['2026-10-24'])
    check('Agendar apaga el día libre aprobado de día completo; medio día y por aprobar no', marcas['2026-10-20']?.apagado === true && !marcas['2026-10-21']?.apagado && !marcas['2026-10-22']?.apagado)
    check('Mi agenda (sin apagarLibres) no apaga ningún día', !marcasDelMes([], [libre('2026-10-20')])['2026-10-20']?.apagado)
    check('registrado de día completo bloquea solo si no se exige aprobación', bloqueaAgendar(libre('x', { estado: 'registrado' }), false) && !bloqueaAgendar(libre('x', { estado: 'registrado' }), true) && bloqueaAgendar(libre('x'), true))
  }

  // -------------------------------------------------------------------------
  t.seccion('17g. Pedido para Agendar y vuelta a Mi agenda')
  {
    check('rutaAgendar lleva solo fecha y hora válidas', rutaAgendar({ fecha: '2026-10-16', hora: '9:30' }) === '/agenda/nueva?fecha=2026-10-16&hora=09:30' && rutaAgendar({ fecha: '2026-10-16' }) === '/agenda/nueva?fecha=2026-10-16' && rutaAgendar({}) === '/agenda/nueva')
    check('rutaAgendar descarta valores no válidos', rutaAgendar({ fecha: '16/10/2026', hora: '25:00' }) === '/agenda/nueva' && rutaAgendar({ fecha: '2026-02-30', hora: 'mañana' }) === '/agenda/nueva' && rutaAgendar({ hora: '' }) === '/agenda/nueva')
    const conIds = rutaAgendar({ fecha: '2026-10-16', hora: '10:00', medico_id: 'm-123', sede_id: 's-9' } as unknown as { fecha: string; hora: string })
    check('rutaAgendar nunca pone ids en la URL (aunque se los pasen)', !/m-123|s-9|medico|sede/.test(conIds), conIds)
    const pedido: PedidoAgendar = { tipo: 'medica', medico_id: 'm-123', sede_id: 's-9' }
    fijarPedidoAgendar(pedido)
    pedido.medico_id = 'cambiado'
    const tomado = tomarPedidoAgendar()
    check('el pedido (con quién) va en memoria y se toma una sola vez (copia)', tomado?.medico_id === 'm-123' && tomado.sede_id === 's-9' && tomarPedidoAgendar() === null, tomado)
    check('puedeAgendarProxima: de hoy en adelante, sin tope (0850, A4)', puedeAgendarProxima(HOY, HOY) && puedeAgendarProxima(sumarDias(HOY, 31), HOY) && puedeAgendarProxima(sumarDias(HOY, 400), HOY) && !puedeAgendarProxima('2026-10-14', HOY) && !puedeAgendarProxima(null, HOY))
    check('ventanaInicialAgendar: de hoy a hoy + 30 (una consulta de 31 días, el máximo del servidor)', ventanaInicialAgendar(HOY).desde === HOY && ventanaInicialAgendar(HOY).hasta === '2026-11-14')
    const traido = [ventanaInicialAgendar(HOY)]
    check(
      'rangoPorCargar: noviembre sin lo ya traído (del 15 al 30); octubre, nada; diciembre entero; un mes pasado, nada',
      JSON.stringify(rangoPorCargar(traido, '2026-11', HOY)) === JSON.stringify({ desde: '2026-11-15', hasta: '2026-11-30' }) &&
        rangoPorCargar(traido, '2026-10', HOY) === null &&
        JSON.stringify(rangoPorCargar(traido, '2026-12', HOY)) === JSON.stringify({ desde: '2026-12-01', hasta: '2026-12-31' }) &&
        rangoPorCargar([], '2026-09', HOY) === null &&
        JSON.stringify(rangoPorCargar([], '2026-10', HOY)) === JSON.stringify({ desde: HOY, hasta: '2026-10-31' }),
      [rangoPorCargar(traido, '2026-11', HOY), rangoPorCargar(traido, '2026-12', HOY)]
    )
    // "Agendar otra fecha" (A7): el pedido lleva la cita cerrada; el cuerpo, solo lo que puede cambiar.
    const cerrada = cita({ id: 'cerrada-1', fecha: '2026-10-12', hora: '09:00', estado: 'no_realizada', motivo_codigo: 'cliente', nota: 'Llevar muestras', medico: { id: 'm-1', nombre: 'Dra. X' } })
    const pedidoOtra = pedidoOtraFecha(cerrada)
    check('pedidoOtraFecha: el tipo, el médico, la sede y la cita misma (en memoria, nunca en la URL)', pedidoOtra.tipo === 'medica' && pedidoOtra.medico_id === 'm-1' && pedidoOtra.sede_id === 'sede-1' && pedidoOtra.otraFecha?.id === 'cerrada-1')
    const formOtra: FormularioCita = { ...formularioCitaVacio('2026-10-16', ['medica']), hora: '9:00', medico_id: 'm-1', sede_id: 'sede-1', nota: '  Llevar muestras ' }
    const cuerpoOtra = cuerpoOtraFecha(formOtra, cerrada)
    check(
      'cuerpoOtraFecha: fecha, hora HH:MM, la misma sede como null, la nota limpia y "como" (las claves del contrato)',
      tieneClaves(cuerpoOtra, 'citaOtraFecha') && cuerpoOtra.fecha === '2026-10-16' && cuerpoOtra.hora === '09:00' && cuerpoOtra.sede_id === null && cuerpoOtra.nota === 'Llevar muestras' && cuerpoOtra.como === null,
      cuerpoOtra
    )
    check(
      'cuerpoOtraFecha: otra sede va con su id; sin nota, null; con "como", el elegido; sin hora, lanza',
      cuerpoOtraFecha({ ...formOtra, sede_id: 'sede-2', nota: '', como: 'lider' }, cerrada).sede_id === 'sede-2' &&
        cuerpoOtraFecha({ ...formOtra, nota: '   ' }, cerrada).nota === null &&
        cuerpoOtraFecha({ ...formOtra, como: 'lider' }, cerrada).como === 'lider' &&
        (await t.lanza(() => cuerpoOtraFecha({ ...formOtra, hora: '' }, cerrada))) === MENSAJE_HORA_OBLIGATORIA
    )
    check('rutaMiAgenda lleva al día', rutaMiAgenda('2026-10-16') === '/agenda?fecha=2026-10-16' && rutaMiAgenda('x') === '/agenda' && rutaMiAgenda(null) === '/agenda')
    fijarCitaResaltada({ id: 'c-1', fecha: '2026-10-16' })
    const resaltada = tomarCitaResaltada()
    check('la cita recién agendada se resalta una sola vez', resaltada?.id === 'c-1' && resaltada.fecha === '2026-10-16' && tomarCitaResaltada() === null)
  }

  // -------------------------------------------------------------------------
  t.seccion('17h. Pantallas de la agenda (leen su archivo)')
  {
    const nueva = leer('mobile/app/(app)/agenda/nueva.tsx')
    const selectorHora = leer('mobile/components/agenda/SelectorHora.tsx')
    check('Agendar: no quedan el chip "Sin hora" ni el campo "Hora (opcional)"', !sinComentarios(nueva).includes('Sin hora') && !sinComentarios(nueva).includes('Hora (opcional)') && !sinComentarios(selectorHora).includes('Sin hora'))
    const queVas = nueva.indexOf('<Subtitulo>¿Qué vas a hacer?</Subtitulo>')
    const cuando = nueva.indexOf('<Subtitulo>¿Cuándo?</Subtitulo>')
    const aQueHora = nueva.indexOf('<Subtitulo>¿A qué hora?</Subtitulo>')
    const conQuien = nueva.indexOf('<Subtitulo>¿Con quién?</Subtitulo>')
    const nota = nueva.indexOf('etiqueta="Nota (opcional)"')
    check('Agendar (F1b): ¿Qué vas a hacer? → ¿Cuándo? → ¿A qué hora? → ¿Con quién? → Nota', queVas > 0 && queVas < cuando && cuando < aQueHora && aQueHora < conQuien && conQuien < nota, { queVas, cuando, aQueHora, conQuien, nota })
    const selectorMedico = bloqueJsx(nueva, 'Selector', 'etiqueta="Médico"')
    check('Agendar: el Selector de médicos empieza cerrado (sin abiertoInicial) y marca el que ya tiene cita ese día', !!selectorMedico && !selectorMedico.includes('abiertoInicial') && selectorMedico.includes('conCita.get(m.id)'), selectorMedico.slice(0, 200))
    // Revisión 2026-10-15: un solo buscador de médicos (había dos: el filtro del selector y "Buscar otro médico en OpMap").
    check(
      'Agendar: un solo buscador de médicos: el del Selector, que ofrece "Buscar en OpMap" (buscarFuera) con lo escrito',
      selectorMedico.includes('buscarFuera={{') && /donde: 'OpMap'/.test(selectorMedico) && /consulta=\{consulta\}/.test(selectorMedico) && !sinComentarios(nueva).includes('Buscar otro médico en OpMap') && !selectorMedico.includes('extra=')
    )
    const calendarioAgendar = bloqueJsx(nueva, 'CalendarioMes', 'alCambiar={elegirFecha}')
    check(
      'Agendar (0850, A4): el calendario desde hoy y SIN tope (sin hasta), con sus marcas, y pide cada mes al llegar a él',
      /desde=\{hoy\}/.test(calendarioAgendar) && !/hasta=/.test(calendarioAgendar) && /marcas=\{marcas\}/.test(calendarioAgendar) && /alCambiarMes=\{mes => void cargarMes\(mes\)\}/.test(calendarioAgendar) && /rangoPorCargar\(cargados\.current, mes, hoy\)/.test(nueva),
      calendarioAgendar
    )
    check('Agendar: usa validarCitaConHora y cuerpoCitaConHora (no validarCita ni cuerpoCita sueltas)', /validarCitaConHora\(formulario, hoy, perfil, \{ citas \}\)/.test(nueva) && /api\.agendar\(cuerpoCitaConHora\(formulario\)\)/.test(nueva) && !/\bvalidarCita\(/.test(nueva) && !/\bcuerpoCita\(/.test(nueva))
    const pie = bloqueJsx(nueva, 'Pantalla', 'pie=')
    check('Agendar: el botón principal va en Pantalla.pie con el resumen (textoBotonAgendar)', /<Pantalla pie=\{pie\}>/.test(pie) && /const pie = \([\s\S]*?<Boton titulo=\{textoBotonAgendar\(formulario\.fecha, formulario\.hora\)\}[\s\S]*?\n {2}\)/.test(nueva))
    check('Agendar: una sola carga de 31 días de citas y de días libres', /api\.agenda\(ventana\.desde, ventana\.hasta\)/.test(nueva) && /api\.diasLibres\(ventana\.desde, ventana\.hasta\)/.test(nueva))
    check('Agendar: los datos fijos salen del contexto en memoria de menos de 10 min, o de api.contexto(null)', /contextoReciente\(\{ maxEdadMs: FRESCURA_DATOS_FIJOS_MS \}\)/.test(nueva) && /reciente \? Promise\.resolve\(reciente\.contexto\) : api\.contexto\(null\)/.test(nueva))
    check('Agendar: lee rutaAgendar (fecha y hora de la URL) y tomarPedidoAgendar, y se vuelve a montar con SoloEnFoco clave', /useLocalSearchParams<\{ fecha\?: string; hora\?: string \}>/.test(nueva) && /tomarPedidoAgendar\(\)/.test(nueva) && /<SoloEnFoco clave=\{`\$\{fecha \?\? ''\}\|\$\{hora \?\? ''\}\|\$\{entrada\.vez\}`\}>/.test(nueva))
    const guardar = nueva.slice(nueva.indexOf('const guardar = async'), nueva.indexOf('if (cargando && !contexto)'))
    check("Agendar: al agendar invalida el contexto ('cita'), resalta la cita y vuelve a Mi agenda en su día", /invalidarContexto\('cita'\)/.test(guardar) && /fijarCitaResaltada\(cita\)/.test(guardar) && /router\.navigate\(rutaMiAgenda\(cita\.fecha\)\)/.test(guardar))
    check('Agendar: dice el choque (errorChoque, el texto del servidor), "Ese día ya tienes" (lista) y la cita de hoy', /errorChoque\(formulario, citas\)/.test(nueva) && /lineasCitasDelDia\(citasDelDia\)/.test(nueva) && /avisoAgendadaHoy\(formulario\.fecha, hoy\)/.test(nueva) && !/avisoChoque/.test(nueva))
    check(
      'SelectorHora: "Por la mañana" y "Por la tarde" con las franjas (no "Mañana": es el día siguiente) y "Otra hora" con OTRA_HORA',
      /franjasHorario\(\)/.test(selectorHora) && /grupo\('Por la mañana'/.test(selectorHora) && /grupo\('Por la tarde'/.test(selectorHora) && !/grupo\('Mañana'/.test(selectorHora) && /OTRA_HORA\.horas\.map/.test(selectorHora) && /OTRA_HORA\.minutos\.map/.test(selectorHora)
    )

    const agenda = leer('mobile/app/(app)/agenda.tsx')
    check('Mi agenda: usa CalendarioMes y LineaDelDia', /<CalendarioMes\s/.test(agenda) && /<LineaDelDia\s/.test(agenda))
    const cargarMes = agenda.slice(agenda.indexOf('const cargarMes = useCallback'), agenda.indexOf('const recargar = useCallback'))
    check('Mi agenda: pide por mes (rangoDeMes) con las canceladas: api.agenda(desde, hasta, true)', /const rango = rangoDeMes\(mes\)/.test(cargarMes) && /api\.agenda\(rango\.desde, rango\.hasta, true\)/.test(cargarMes) && /api\.diasLibres\(rango\.desde, rango\.hasta\)/.test(cargarMes))
    check('Mi agenda: sigue diciendo "Queda en tu agenda como cancelada"', agenda.includes('Queda en tu agenda como cancelada'))
    check('Mi agenda: tiene entrada a "/dias-libres" y a Agendar', /router\.push\('\/dias-libres'\)/.test(agenda) && /router\.push\(rutaAgendar\(/.test(agenda))
    check('Mi agenda: la semana por defecto, con "Ver mes"', /useState<'semana' \| 'mes'>\('semana'\)/.test(agenda) && agenda.includes("'Ver mes'"))
    check('Mi agenda: vuelve a pedir al recibir el foco', /useFocusEffect\(\s*useCallback\(\(\) => \{[\s\S]*?void recargar\(\)/.test(agenda))
    const cancelar = agenda.slice(agenda.indexOf('const cancelar = async'), agenda.indexOf('const noSeHizo = async'))
    const apiTs = leer('mobile/lib/api.ts')
    const cancelarApi = apiTs.slice(apiTs.indexOf('export async function cancelarCita('), apiTs.indexOf('export async function cerrarCita('))
    check(
      "Mi agenda: cancelar manda el motivo y lib/api.ts invalida el contexto ('cita') después del 2xx",
      /api\.cancelarCita\(cita\.id, motivo\)/.test(cancelar) && cancelarApi.indexOf("invalidarContexto('cita')") > cancelarApi.indexOf('await peticion')
    )
    check('Mi agenda: tocar una franja libre abre Agendar a esa hora', /alTocarFranja=\{hora => router\.push\(rutaAgendar\(\{ fecha: dia, hora \}\)\)\}/.test(agenda))
    const calendario = leer('mobile/components/agenda/CalendarioMes.tsx')
    check('CalendarioMes: la vista de mes dibuja semanasVisibles (sin las semanas enteras fuera de desde..hasta) y la de semana, cuadriculaSemana', /semanasVisibles\(cuadriculaMes\(mes, /.test(calendario) && /cuadriculaSemana\(lunes, /.test(calendario))
    const linea = leer('mobile/components/agenda/LineaDelDia.tsx')
    check(
      'LineaDelDia: "Ahora", "Sin hora" y "Ver las que no se hicieron (n)" (canceladas y no hechas), abierta sola si ahí está la cita abierta',
      />Ahora</.test(linea) && /\n\s+Sin hora\n/.test(linea) && /Ver las que no se hicieron \(\$\{cerradas\.length\}\)/.test(linea) && /cerradas\.some\(cita => cita\.id === abierta\)/.test(linea)
    )
    const detalle = leer('mobile/components/agenda/DetalleCita.tsx')
    check(
      'DetalleCita (F1b): Reportar, "Ver la visita", "No se hizo", Cancelar, "Agendar otra fecha" y "Eliminar: lo agendé por error", según accionesDeCita',
      ['titulo="Reportar"', 'titulo="Ver la visita"', 'titulo="No se hizo"', 'titulo="Cancelar"', 'titulo="Agendar otra fecha"', 'titulo="Eliminar: lo agendé por error"'].every(t => detalle.includes(t)) &&
        /const acciones = accionesDeCita\(cita, hoy, visitaEfectiva\)/.test(detalle)
    )
    check(
      'DetalleCita: el motivo es obligatorio (FormularioMotivo, sin "Motivo (opcional)") y no hay "Mover" ni "Reprogramar"',
      /<FormularioMotivo uso="cerrar"/.test(detalle) && /<FormularioMotivo uso="cancelar"/.test(detalle) && !sinComentarios(detalle).includes('Motivo (opcional)') && !/Mover|Reprogramar/.test(sinComentarios(detalle))
    )
  }

  // -------------------------------------------------------------------------
  t.seccion('17i. Revisión 2026-10-15: Agendar desde mañana, hora pasada, cita repetida, línea del día plegada')
  {
    check("fechaInicialAgendar: mañana ('2026-10-16'): la cita de hoy contaría como no agendada", fechaInicialAgendar(HOY) === '2026-10-16')
    check(
      'primeraFranjaLibre desde mañana: el 16 a las 08:00, aunque hoy a las 10:42 quede libre las 11:00',
      primeraFranjaLibre(fechaInicialAgendar(HOY), '2026-11-14', [], {}, A_LAS_10_42)?.fecha === '2026-10-16' && primeraFranjaLibre(fechaInicialAgendar(HOY), '2026-11-14', [], {}, A_LAS_10_42)?.hora === '08:00'
    )
    const base: FormularioCita = { ...formularioCitaVacio(HOY, ['medica']), medico_id: 'm1', sede_id: 's1' }
    const pasada = validarCitaConHora({ ...base, hora: '10:30' }, HOY, ['medica'], { ahora: A_LAS_10_42 })
    check(`hoy a las 10:42, la cita de las 10:30 → "${MENSAJE_HORA_PASADA}" en hora`, pasada.length === 1 && pasada[0].campo === 'hora' && pasada[0].mensaje === MENSAJE_HORA_PASADA, pasada)
    check("hoy a las 10:42, 10:45 y 11:00 → sin errores (con 'Otra hora' también vale)", validarCitaConHora({ ...base, hora: '10:45' }, HOY, ['medica'], { ahora: A_LAS_10_42 }).length === 0 && validarCitaConHora({ ...base, hora: '11:00' }, HOY, ['medica'], { ahora: A_LAS_10_42 }).length === 0)
    check('mañana a cualquier hora → sin "ya pasó"', validarCitaConHora({ ...base, fecha: '2026-10-16', hora: '07:00' }, HOY, ['medica'], { ahora: A_LAS_10_42 }).length === 0)
    const dra = cita({ hora: '09:30', medico: { id: 'm1', nombre: 'Dra. X' } })
    const repetida = errorCitaRepetida({ ...base, fecha: HOY }, [dra])
    check(
      'errorCitaRepetida: el mismo médico ese día → error en medico_id con el texto del servidor, su hora y qué hacer',
      repetida?.campo === 'medico_id' && repetida.mensaje === `${MENSAJE_CITA_REPETIDA_MEDICO} (a las 09:30): elige otro día o cancela esa cita en Mi agenda` && MENSAJE_CITA_REPETIDA_MEDICO === 'Ya tienes una cita con ese médico ese día',
      repetida
    )
    check(
      'errorCitaRepetida: no cuenta la cancelada, otro día ni otro médico',
      errorCitaRepetida(base, [cita({ medico: { id: 'm1', nombre: 'X' }, estado: 'cancelada' })]) === null &&
        errorCitaRepetida({ ...base, fecha: '2026-10-16' }, [dra]) === null &&
        errorCitaRepetida({ ...base, medico_id: 'm2' }, [dra]) === null
    )
    const institucional: FormularioCita = { ...formularioCitaVacio(HOY, ['institucional']), cuenta_id: 'c1', subtipo_id: 'st1', sede_id: 's1' }
    const deCuenta = cita({ tipo: 'institucional', medico: null, cuenta: { id: 'c1', nombre: 'Clínica Y' }, subtipo: { id: 'st1', codigo: 'compras', nombre: 'Compras' }, hora: null })
    check(
      'errorCitaRepetida: la misma cuenta y el mismo subtipo ese día → error en cuenta_id (otro subtipo no)',
      errorCitaRepetida(institucional, [deCuenta])?.mensaje === `${MENSAJE_CITA_REPETIDA_CUENTA}: elige otro día o cancela esa cita en Mi agenda` &&
        errorCitaRepetida(institucional, [deCuenta])?.campo === 'cuenta_id' &&
        errorCitaRepetida({ ...institucional, subtipo_id: 'st2' }, [deCuenta]) === null
    )
    const web = leer('web/lib/reporte-visitas.ts')
    check(
      'los textos de la cita repetida son los del servidor (web/lib/reporte-visitas.ts)',
      web.includes(`export const MENSAJE_CITA_REPETIDA_MEDICO = '${MENSAJE_CITA_REPETIDA_MEDICO}'`) && web.includes(`export const MENSAJE_CITA_REPETIDA_CUENTA = '${MENSAJE_CITA_REPETIDA_CUENTA}'`)
    )
    check(
      'validarCitaConHora con las citas: incluye la repetida (una sola vez)',
      validarCitaConHora({ ...base, fecha: '2026-10-16', hora: '10:00' }, HOY, ['medica'], { citas: [{ ...dra, fecha: '2026-10-16' }], ahora: A_LAS_10_42 }).map(e => e.campo).join() === 'medico_id'
    )
    check(
      'lineasCitasDelDia: una línea por cita en pie, por hora, sin la cancelada y la sin hora al final',
      lineasCitasDelDia([cita({ hora: '10:30', medico: { id: 'a', nombre: 'Dr. B' } }), cita({ hora: null, medico: { id: 'b', nombre: 'Dr. C' } }), dra, cita({ hora: '08:00', estado: 'cancelada' })]).join(' | ') ===
        '09:30 · Dra. X | 10:30 · Dr. B | Sin hora · Dr. C'
    )
    const { filas } = ocupacionDelDia([cita({ hora: '09:30' }), cita({ hora: '16:00' })])
    const tramos = plegarLibres(filas)
    const resumen = tramos.map(tr => (tr.tipo === 'libres' ? `[${tr.desde}-${tr.hasta}]` : tr.fila.franja)).join(' ')
    check(
      `plegarLibres: un día con 2 citas pasa de 24 filas a 5 (libres de ${MIN_LIBRES_PLEGADAS} o más plegadas, con su fin)`,
      MIN_LIBRES_PLEGADAS === 3 && filas.length === 24 && resumen === '[07:00-09:30] 09:30 [10:00-16:00] 16:00 [16:30-19:00]',
      resumen
    )
    check(
      'plegarLibres: dos libres seguidas no se pliegan; se corta en la fila de "Ahora"; lo desplegado no se pliega',
      plegarLibres(ocupacionDelDia([cita({ hora: '07:00' }), cita({ hora: '08:30' })]).filas).slice(0, 4).map(tr => (tr.tipo === 'fila' ? tr.fila.franja : 'L')).join() === '07:00,07:30,08:00,08:30' &&
        plegarLibres(filas, { cortes: [2] }).map(tr => (tr.tipo === 'libres' ? `[${tr.desde}-${tr.hasta}]` : tr.fila.franja)).slice(0, 3).join(' ') === '07:00 07:30 [08:00-09:30]' &&
        plegarLibres(filas, { cortes: [3] })[0].tipo === 'libres' &&
        plegarLibres(filas, { cortes: [3] })[1].tipo === 'fila' &&
        plegarLibres(filas, { desplegados: new Set(['10:00']) }).filter(tr => tr.tipo === 'fila').length === 2 + 12
    )
    check(
      'plegarLibres: no pierde ni repite filas',
      tramos.flatMap(tr => (tr.tipo === 'libres' ? tr.indices : [tr.indice])).join() === filas.map((_, i) => i).join()
    )
    check(
      `vistaCalendarioAgendar: semana por debajo de ${ALTO_PANTALLA_BAJA} pt (iPhone SE u 8: 667), mes en 844 y si no se sabe`,
      ALTO_PANTALLA_BAJA === 700 && vistaCalendarioAgendar(667) === 'semana' && vistaCalendarioAgendar(844) === 'mes' && vistaCalendarioAgendar(Number.NaN) === 'mes' && vistaCalendarioAgendar(0) === 'mes'
    )

    const nueva = leer('mobile/app/(app)/agenda/nueva.tsx')
    check(
      'Agendar: sin fecha en la URL abre desde mañana (fechaInicialAgendar) en el formulario y en primeraFranjaLibre',
      /formularioCitaVacio\(fechaDeUrl \?\? fechaInicialAgendar\(hoy\), \[\]\)/.test(nueva) && /primeraFranjaLibre\(fechaInicialAgendar\(hoy\), ventana\.hasta, citasVentana, marcasVentana\)/.test(nueva)
    )
    const pie = nueva.slice(nueva.indexOf('const pie = ('), nueva.indexOf('return (', nueva.indexOf('const pie = (')))
    check(
      'Agendar: el pie dice la cita repetida y el choque de hora (0850: los dos en rojo, los rechaza el servidor)',
      /\) : repetida \? \(\s*<Texto peque color=\{c\.peligro\}>\s*\{repetida\.mensaje\}/.test(pie) && /\) : choque \? \(\s*<Texto peque color=\{c\.peligro\}>\s*\{choque\.mensaje\}/.test(pie) && !/\{choque \? <Aviso/.test(nueva)
    )
    const elegirFechaTs = nueva.slice(nueva.indexOf('const elegirFecha = '), nueva.indexOf('const elegirHora = '))
    check('Agendar: al cambiar a hoy, una hora que ya pasó se cambia por la siguiente libre', /const yaPaso = typeof hora === 'string' && franjaPasada\(fecha, hora\)/.test(elegirFechaTs) && /if \(horaAuto \|\| yaPaso\)/.test(elegirFechaTs))
    check(
      'Agendar: en pantalla baja el calendario abre en la semana (vistaCalendarioAgendar con useWindowDimensions) y ofrece "Ver mes"',
      /const vistaInicial = vistaCalendarioAgendar\(altoPantalla\)/.test(nueva) && /vista=\{vistaCalendario\}/.test(nueva) && /vistaInicial === 'semana' \?/.test(nueva)
    )
    const selectorHora = leer('mobile/components/agenda/SelectorHora.tsx')
    check(
      '"Otra hora": hoy apaga las horas y los minutos que ya pasaron (como los chips)',
      /deshabilitado: libre === null/.test(selectorHora) && /const pasado = franjaPasada\(fecha, `\$\{hora\}:\$\{m\}`, reloj\)/.test(selectorHora) && /deshabilitado: pasado/.test(selectorHora)
    )
    const calendario = leer('mobile/components/agenda/CalendarioMes.tsx')
    check(
      'texto grande: chips de hora, números del calendario e insignias con maxFontSizeMultiplier 1,3',
      /const MAX_ESCALA_TEXTO = 1\.3/.test(selectorHora) && /maxFontSizeMultiplier=\{MAX_ESCALA_TEXTO\}/.test(selectorHora) && (calendario.match(/maxFontSizeMultiplier=\{MAX_ESCALA_TEXTO\}/g) ?? []).length >= 3 && /maxFontSizeMultiplier=\{1\.3\}/.test(leer('mobile/lib/ui.tsx'))
    )
    check(
      'CalendarioMes: la leyenda de citas sin cifra fija ("Bajo cada día, en pequeño: cuántas citas tienes") y "Hoy" con conHoy',
      !/>2<\/Text>/.test(calendario) && calendario.includes('Bajo cada día, en pequeño: cuántas citas tienes') && /accessibilityLabel="Ir a hoy"/.test(calendario) && /const verHoy = !!conHoy && hoyElegible/.test(calendario)
    )
    const linea = leer('mobile/components/agenda/LineaDelDia.tsx')
    check('LineaDelDia: pliega las libres seguidas (plegarLibres) cortando en "Ahora"', /plegarLibres\(filas, \{ cortes: indiceAhora >= 0 \? \[indiceAhora\] : \[\], desplegados: abiertos \}\)/.test(linea) && /Libre de \$\{tramo\.desde\} a \$\{tramo\.hasta\}/.test(linea))
    const agenda = leer('mobile/app/(app)/agenda.tsx')
    const cargarMes = agenda.slice(agenda.indexOf('const cargarMes = useCallback'), agenda.indexOf('const recargar = useCallback'))
    check(
      'Mi agenda: el error es por mes (uno que llega bien no borra el de otro) y el "Cargando" mira el del día',
      /setErrores\(prev => \(\{ \.\.\.prev, \[mes\]: aApiError\(e\) \}\)\)/.test(cargarMes) && !/setError\(null\)/.test(agenda) && /errorDelDia && !cargando\[mesDe\(dia\)\] \? null : <Cargando/.test(agenda)
    )
    check(
      'Mi agenda: "Cancelaste…" sale junto al día (después del título del día), "Hoy" en el calendario y el aviso del día libre con citas',
      agenda.indexOf('{mensaje ? <Aviso') > agenda.indexOf('{tituloDiaAgenda(dia, hoy)}') && /\n\s+conHoy\n/.test(agenda) && /pendientesEnLibre > 0 \?/.test(agenda)
    )
  }
}
