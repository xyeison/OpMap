/**
 * Actividades de campo · F1a (migración 0850): pruebas PURAS de lib/agenda-ciclo.ts (ciclo de vida de lo programado),
 * espejo de agenda_crear, agenda_cancelar, agenda_cerrar, agenda_eliminar, agenda_otra_fecha y agenda_choque. SIN red
 * ni Supabase: solo lee el disco (la 0850, para comparar mensajes y la media hora, y web/lib, para comprobar que ya no
 * hay tope hacia adelante).
 * Spec: docs/specs/2026-10-15-actividades-de-campo.md ("Ciclo de vida de lo programado", A4, A7, A8, C6, C7, C8, C10,
 * C13 y los criterios de F1a).
 *
 * Cubre: agendaChoca (09:00 contra 09:15 choca, contra 09:30 no; sin hora, no_realizada, cancelada y eliminada nunca
 * chocan; hecha sí; la propia se excluye; el primero por hora); cada par (estado, acción, día de la cita frente a hoy)
 * de la tabla "Ciclo de vida" da permitido o su mensaje (cancelar, no se hizo, eliminar); MOTIVOS_CIERRE (otro exige
 * texto de 3 a 300, salida no se elige); origenParaOtraFecha; cuentasAgenda (sin eliminadas ni canceladas, "no se hizo"
 * aparte); estadoVisible (Atrasada hoy pasada la hora, Sin cerrar desde el día siguiente); mensajeFechaCita y
 * mensajeHoraCita (hoy + 400 sirve; hoy a una hora pasada no); los esquemas de cancelar, cerrar y otra fecha; ningún
 * archivo de web/lib exporta DIAS_AGENDA_ADELANTE; los mensajes están en la 0850.
 *
 * Uso (desde web/): npx tsx scripts/agenda-ciclo-check.ts   (va dentro de npm run test)
 * Código de salida 1 si alguna prueba falla.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import {
  ESTADOS_CITA,
  MAX_MOTIVO_CIERRE,
  MENSAJE_CANCELAR_SIN_MOTIVO,
  MENSAJE_CITA_CERRADA,
  MENSAJE_CITA_EFECTIVA_SIN_OTRA_FECHA,
  MENSAJE_CITA_NO_LLEGA,
  MENSAJE_CITA_SALIDA_SIN_OTRA_FECHA,
  MENSAJE_CITA_SIGUE_PROGRAMADA,
  MENSAJE_CITA_YA_TIENE_OTRA_FECHA,
  MENSAJE_ELIMINAR_PASADA,
  MENSAJE_HORA_PASADA,
  MENSAJE_MOTIVO_CANCELAR,
  MENSAJE_MOTIVO_CERRAR,
  MENSAJE_MOTIVO_LARGO,
  MENSAJE_MOTIVO_NO_VALIDO,
  MENSAJE_MOTIVO_SALIDA,
  MENSAJE_OTRA_FECHA_DISTINTA,
  MENSAJE_SOLO_PENDIENTE_SE_ELIMINA,
  MENSAJE_VISITA_CON_OTRA_FECHA,
  MINUTOS_CITA,
  MIN_MOTIVO_OTRO,
  MOTIVOS_CIERRE,
  TEXTO_DEJO_DE_SER_EJECUTIVO,
  TEXTO_SALIDA,
  VALORES_MOTIVO_ELEGIBLE,
  agendaChoca,
  citaCancelable,
  citaCerrable,
  citaEliminable,
  cuentasAgenda,
  estadoVisible,
  mensajeChoque,
  mensajeHoraCita,
  minutosDeHora,
  origenParaOtraFecha,
  revisarCancelar,
  revisarCerrar,
  revisarEliminar,
  revisarMotivo,
  revisarVisitaConOtraFecha,
  type CitaParaChoque,
  type EstadoCita,
} from '../lib/agenda-ciclo'
import { mensajeFechaCita } from '../lib/reporte-visitas'
import { citaCancelarSchema, citaCerrarSchema, citaCreateSchema, citaOtraFechaSchema } from '../lib/reporte-visitas-schemas'

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
const igual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

const HOY = '2026-10-15'
const AYER = '2026-10-14'
const MANANA = '2026-10-16'
/** 2026-10-15 10:42 en Bogotá (UTC−5). */
const AHORA = new Date('2026-10-15T15:42:00.000Z')

// ---------------------------------------------------------------------------------------------
console.log('\n1. agendaChoca (espejo de agenda_choque: media hora)')
const c = (id: string, hora: string | null, estado: EstadoCita = 'pendiente', fecha = MANANA): CitaParaChoque => ({ id, fecha, hora, estado })
check(`la media hora es ${MINUTOS_CITA} minutos`, MINUTOS_CITA === 30)
check('09:00 contra 09:15 choca', agendaChoca({ fecha: MANANA, hora: '09:15' }, [c('a', '09:00')])?.id === 'a')
check('09:00 contra 09:30 no choca; contra 08:30 tampoco', agendaChoca({ fecha: MANANA, hora: '09:30' }, [c('a', '09:00')]) === null && agendaChoca({ fecha: MANANA, hora: '08:30' }, [c('a', '09:00')]) === null)
check('09:00 contra 08:31 y contra 09:29 choca (también con segundos: 09:00:00)', agendaChoca({ fecha: MANANA, hora: '08:31' }, [c('a', '09:00:00')])?.id === 'a' && agendaChoca({ fecha: MANANA, hora: '09:29' }, [c('a', '09:00')])?.id === 'a')
check('la misma hora choca', agendaChoca({ fecha: MANANA, hora: '09:00' }, [c('a', '09:00')])?.id === 'a')
check('una cita sin hora (vieja) nunca choca; agendar sin hora tampoco', agendaChoca({ fecha: MANANA, hora: '09:00' }, [c('a', null)]) === null && agendaChoca({ fecha: MANANA, hora: null }, [c('a', '09:00')]) === null)
for (const estado of ['no_realizada', 'cancelada', 'eliminada'] as const) {
  check(`una ${estado} nunca choca`, agendaChoca({ fecha: MANANA, hora: '09:00' }, [c('a', '09:00', estado)]) === null)
}
check('una hecha sí choca', agendaChoca({ fecha: MANANA, hora: '09:10' }, [c('a', '09:00', 'hecha')])?.id === 'a')
check('otro día no choca', agendaChoca({ fecha: HOY, hora: '09:00' }, [c('a', '09:00')]) === null)
check('la propia (excluir) no choca consigo', agendaChoca({ fecha: MANANA, hora: '09:00' }, [c('a', '09:00')], 'a') === null)
check('con dos choques, la primera por hora y luego por id', agendaChoca({ fecha: MANANA, hora: '09:20' }, [c('z', '09:30'), c('b', '09:00'), c('a', '09:00')])?.id === 'a')
check('mensajeChoque: "A las 09:30 ya tienes cita con …: elige otra hora"', mensajeChoque('09:30', 'Dra. Pérez') === 'A las 09:30 ya tienes cita con Dra. Pérez: elige otra hora')
check('minutosDeHora: 09:30 → 570; 23:59:59 → 1439; basura → NaN', minutosDeHora('09:30') === 570 && minutosDeHora('23:59:59') === 1439 && Number.isNaN(minutosDeHora('9h')))

// ---------------------------------------------------------------------------------------------
console.log('\n2. Transiciones: cada (estado, acción, día de la cita) de la tabla "Ciclo de vida"')
type Accion = 'cancelar' | 'cerrar' | 'eliminar'
const DIAS = { ayer: AYER, hoy: HOY, mañana: MANANA } as const
/** Lo que dice la tabla (C7, C8): null = permitido. */
const ESPERADO: Record<EstadoCita, Record<Accion, Record<keyof typeof DIAS, string | null>>> = {
  pendiente: {
    cancelar: { ayer: 'Solo se cancelan las citas de hoy en adelante', hoy: null, mañana: null },
    cerrar: { ayer: null, hoy: null, mañana: MENSAJE_CITA_NO_LLEGA },
    eliminar: { ayer: MENSAJE_ELIMINAR_PASADA, hoy: null, mañana: null },
  },
  hecha: {
    cancelar: { ayer: 'Esa cita ya tiene su visita: no se cancela', hoy: 'Esa cita ya tiene su visita: no se cancela', mañana: 'Esa cita ya tiene su visita: no se cancela' },
    cerrar: { ayer: MENSAJE_CITA_CERRADA, hoy: MENSAJE_CITA_CERRADA, mañana: MENSAJE_CITA_CERRADA },
    eliminar: { ayer: MENSAJE_SOLO_PENDIENTE_SE_ELIMINA, hoy: MENSAJE_SOLO_PENDIENTE_SE_ELIMINA, mañana: MENSAJE_SOLO_PENDIENTE_SE_ELIMINA },
  },
  no_realizada: {
    cancelar: { ayer: MENSAJE_CITA_CERRADA, hoy: MENSAJE_CITA_CERRADA, mañana: MENSAJE_CITA_CERRADA },
    cerrar: { ayer: MENSAJE_CITA_CERRADA, hoy: MENSAJE_CITA_CERRADA, mañana: MENSAJE_CITA_CERRADA },
    eliminar: { ayer: MENSAJE_SOLO_PENDIENTE_SE_ELIMINA, hoy: MENSAJE_SOLO_PENDIENTE_SE_ELIMINA, mañana: MENSAJE_SOLO_PENDIENTE_SE_ELIMINA },
  },
  cancelada: {
    cancelar: { ayer: 'Esa cita ya está cancelada', hoy: 'Esa cita ya está cancelada', mañana: 'Esa cita ya está cancelada' },
    cerrar: { ayer: MENSAJE_CITA_CERRADA, hoy: MENSAJE_CITA_CERRADA, mañana: MENSAJE_CITA_CERRADA },
    eliminar: { ayer: MENSAJE_SOLO_PENDIENTE_SE_ELIMINA, hoy: MENSAJE_SOLO_PENDIENTE_SE_ELIMINA, mañana: MENSAJE_SOLO_PENDIENTE_SE_ELIMINA },
  },
  eliminada: {
    cancelar: { ayer: 'Esa cita no existe', hoy: 'Esa cita no existe', mañana: 'Esa cita no existe' },
    cerrar: { ayer: 'Esa cita no existe', hoy: 'Esa cita no existe', mañana: 'Esa cita no existe' },
    eliminar: { ayer: 'Esa cita no existe', hoy: 'Esa cita no existe', mañana: 'Esa cita no existe' },
  },
}
const revisar: Record<Accion, (cita: { estado: EstadoCita; fecha: string }, hoy: string) => string | null> = { cancelar: revisarCancelar, cerrar: revisarCerrar, eliminar: revisarEliminar }
const puede: Record<Accion, (cita: { estado: EstadoCita; fecha: string }, hoy: string) => boolean> = { cancelar: citaCancelable, cerrar: citaCerrable, eliminar: citaEliminable }
const distintos: string[] = []
let pares = 0
for (const estado of ESTADOS_CITA.map(e => e.valor)) {
  for (const accion of ['cancelar', 'cerrar', 'eliminar'] as const) {
    for (const [dia, fecha] of Object.entries(DIAS) as [keyof typeof DIAS, string][]) {
      pares++
      const cita = { estado, fecha }
      const esperado = ESPERADO[estado][accion][dia]
      const mensaje = revisar[accion](cita, HOY)
      if (mensaje !== esperado || puede[accion](cita, HOY) !== (esperado === null)) distintos.push(`${estado}/${accion}/${dia}: ${mensaje} · ${puede[accion](cita, HOY)}`)
    }
  }
}
check(`los ${pares} pares (5 estados × 3 acciones × ayer, hoy y mañana) dan lo de la tabla, y citaCancelable/Cerrable/Eliminable coinciden`, pares === 45 && distintos.length === 0, distintos)
check('el mismo día una pendiente se puede cancelar y también marcar "no se hizo"', citaCancelable({ estado: 'pendiente', fecha: HOY }, HOY) && citaCerrable({ estado: 'pendiente', fecha: HOY }, HOY))

// ---------------------------------------------------------------------------------------------
console.log('\n3. MOTIVOS_CIERRE (C10)')
check('cinco elegibles y salida, que no se elige', igual(VALORES_MOTIVO_ELEGIBLE, ['cliente', 'prioridad', 'falta_tiempo', 'fuerza_mayor', 'otro']) && MOTIVOS_CIERRE.some(m => m.valor === 'salida' && !m.elegible))
check(`"otro" exige texto (${MIN_MOTIVO_OTRO} a ${MAX_MOTIVO_CIERRE}): sin texto → mensaje de cancelar o de cerrar`, revisarMotivo('otro', '', 'cancelar') === MENSAJE_MOTIVO_CANCELAR && revisarMotivo('otro', 'ab', 'cerrar') === MENSAJE_MOTIVO_CERRAR && revisarMotivo('otro', '  ab  ', 'cancelar') === MENSAJE_MOTIVO_CANCELAR && revisarMotivo('otro', 'abc', 'cerrar') === null)
check('los demás motivos no exigen texto', VALORES_MOTIVO_ELEGIBLE.filter(m => m !== 'otro').every(m => revisarMotivo(m, null, 'cerrar') === null && revisarMotivo(m, '', 'cancelar') === null))
check(`"salida" → "${MENSAJE_MOTIVO_SALIDA}"; un código que no existe → "${MENSAJE_MOTIVO_NO_VALIDO}"`, revisarMotivo('salida', 'x', 'cancelar') === MENSAJE_MOTIVO_SALIDA && revisarMotivo('vacaciones', 'x', 'cerrar') === MENSAJE_MOTIVO_NO_VALIDO)
check(`texto de más de ${MAX_MOTIVO_CIERRE} → "${MENSAJE_MOTIVO_LARGO}"; ${MAX_MOTIVO_CIERRE} justos sirven`, revisarMotivo('cliente', 'x'.repeat(MAX_MOTIVO_CIERRE + 1), 'cerrar') === MENSAJE_MOTIVO_LARGO && revisarMotivo('otro', 'x'.repeat(MAX_MOTIVO_CIERRE), 'cancelar') === null)
check('sin código: cancelar lo toma como "otro"; cerrar lo exige', revisarMotivo(null, 'El médico viaja', 'cancelar') === null && revisarMotivo(null, 'El médico viaja', 'cerrar') === MENSAJE_MOTIVO_NO_VALIDO)
const cancelarVacio = citaCancelarSchema.safeParse({})
const cancelarTexto = citaCancelarSchema.safeParse({ motivo: 'El médico viaja' })
const cancelarCodigo = citaCancelarSchema.safeParse({ motivo_codigo: 'cliente' })
check(`citaCancelarSchema: {} → "${MENSAJE_CANCELAR_SIN_MOTIVO}" (A8); solo texto → otro; con código, sin texto`, !cancelarVacio.success && cancelarVacio.error.issues[0].message === MENSAJE_CANCELAR_SIN_MOTIVO && cancelarTexto.success && igual(cancelarTexto.data, { motivo: 'El médico viaja', motivo_codigo: 'otro' }) && cancelarCodigo.success && igual(cancelarCodigo.data, { motivo: null, motivo_codigo: 'cliente' }), { cancelarVacio, cancelarTexto, cancelarCodigo })
const cancelarOtroCorto = citaCancelarSchema.safeParse({ motivo_codigo: 'otro', motivo: 'no' })
const cancelarSalida = citaCancelarSchema.safeParse({ motivo_codigo: 'salida', motivo: 'Me voy' })
check('citaCancelarSchema: "otro" con 2 letras y "salida" → 400', !cancelarOtroCorto.success && !cancelarSalida.success && cancelarSalida.error.issues[0].message === MENSAJE_MOTIVO_SALIDA)
const cerrarVacio = citaCerrarSchema.safeParse({})
const cerrarBien = citaCerrarSchema.safeParse({ motivo_codigo: 'falta_tiempo' })
const cerrarOtro = citaCerrarSchema.safeParse({ motivo_codigo: 'otro', motivo: 'Paro en la vía' })
check('citaCerrarSchema: sin código → 400; con código, sin texto; "otro" con texto', !cerrarVacio.success && cerrarVacio.error.issues[0].message === MENSAJE_MOTIVO_NO_VALIDO && cerrarBien.success && igual(cerrarBien.data, { motivo_codigo: 'falta_tiempo', motivo: null }) && cerrarOtro.success && cerrarOtro.data.motivo === 'Paro en la vía', { cerrarVacio, cerrarBien, cerrarOtro })

// ---------------------------------------------------------------------------------------------
console.log('\n4. origenParaOtraFecha (A7)')
const o = (estado: EstadoCita, extra: { motivo_codigo?: 'cliente' | 'salida' | null; visita_efectiva?: boolean | null; tiene_sucesora?: boolean } = {}) =>
  origenParaOtraFecha({ estado, motivo_codigo: extra.motivo_codigo ?? null, visita_efectiva: extra.visita_efectiva ?? null, tiene_sucesora: extra.tiene_sucesora ?? false })
check('de una no_realizada, de una cancelada (no por salida) y de una hecha no efectiva: sí', o('no_realizada', { motivo_codigo: 'cliente' }) === null && o('cancelada', { motivo_codigo: 'cliente' }) === null && o('hecha', { visita_efectiva: false }) === null)
check(`de una pendiente → "${MENSAJE_CITA_SIGUE_PROGRAMADA}"`, o('pendiente') === MENSAJE_CITA_SIGUE_PROGRAMADA)
check('de una eliminada → no existe', o('eliminada') === 'Esa cita no existe')
check(`de una cancelada por salida → "${MENSAJE_CITA_SALIDA_SIN_OTRA_FECHA}"`, o('cancelada', { motivo_codigo: 'salida' }) === MENSAJE_CITA_SALIDA_SIN_OTRA_FECHA)
check(`de una hecha efectiva (o sin saber) → "${MENSAJE_CITA_EFECTIVA_SIN_OTRA_FECHA}"`, o('hecha', { visita_efectiva: true }) === MENSAJE_CITA_EFECTIVA_SIN_OTRA_FECHA && o('hecha') === MENSAJE_CITA_EFECTIVA_SIN_OTRA_FECHA)
check(`con sucesora → "${MENSAJE_CITA_YA_TIENE_OTRA_FECHA}"`, o('no_realizada', { tiene_sucesora: true }) === MENSAJE_CITA_YA_TIENE_OTRA_FECHA)
// Con otra fecha la cita queda cerrada: su visita no se anula ni pasa a efectiva (espejo de visitas_anular y visitas_editar).
const cumplida = { id: 'c', estado: 'hecha' as EstadoCita, visita_id: 'v-ne', viene_de: null }
const sucesora = (estado: EstadoCita) => ({ id: 'c2', estado, visita_id: null, viene_de: 'c' })
check(`visita cuya cita tiene otra fecha pendiente (o ya hecha o cancelada) → "${MENSAJE_VISITA_CON_OTRA_FECHA}"`, (['pendiente', 'hecha', 'cancelada', 'no_realizada'] as EstadoCita[]).every(e => revisarVisitaConOtraFecha('v-ne', [cumplida, sucesora(e)]) === MENSAJE_VISITA_CON_OTRA_FECHA))
check('sin otra fecha, con la otra fecha eliminada o sin cita: sí se anula o pasa a efectiva', revisarVisitaConOtraFecha('v-ne', [cumplida]) === null && revisarVisitaConOtraFecha('v-ne', [cumplida, sucesora('eliminada')]) === null && revisarVisitaConOtraFecha('v-otra', [cumplida, sucesora('pendiente')]) === null)
check('la sucesora de otra cita no cuenta', revisarVisitaConOtraFecha('v-ne', [cumplida, { ...sucesora('pendiente'), viene_de: 'otra' }]) === null)
const otraSinNota = citaOtraFechaSchema.safeParse({ fecha: '2026-11-03', hora: '09:05' })
const otraConNotaVacia = citaOtraFechaSchema.safeParse({ fecha: '2026-11-03', hora: '09:05', nota: '' })
const otraSinHora = citaOtraFechaSchema.safeParse({ fecha: '2026-11-03' })
check('citaOtraFechaSchema: sin nota no trae la clave (copia la de la anterior); nota "" → null; sin hora → 400', otraSinNota.success && !('nota' in otraSinNota.data) && otraSinNota.data.hora === '09:05' && otraConNotaVacia.success && otraConNotaVacia.data.nota === null && !otraSinHora.success, { otraSinNota, otraConNotaVacia })

// ---------------------------------------------------------------------------------------------
console.log('\n5. cuentasAgenda (Mis números) y estadoVisible (C6)')
const cuentas = cuentasAgenda({
  visitas: [{ efectiva: true, agendada: true }, { efectiva: true, agendada: false }, { efectiva: false, agendada: true }],
  citas: [
    { fecha: AYER, estado: 'hecha' },
    { fecha: AYER, estado: 'no_realizada' },
    { fecha: AYER, estado: 'eliminada' },
    { fecha: AYER, estado: 'cancelada' },
    { fecha: HOY, estado: 'pendiente' },
    { fecha: MANANA, estado: 'pendiente' },
  ],
  hoy: HOY,
})
check('cuentasAgenda: sin eliminadas ni canceladas ni las de mañana (3 hasta hoy), 1 hecha, 1 "no se hizo" aparte', igual(cuentas, { efectivas: 2, efectivas_agendadas: 1, porcentaje_agendadas: 0.5, citas_hasta_hoy: 3, citas_hechas: 1, citas_no_realizadas: 1, cumplimiento: 0.33 }), cuentas)
check('cuentasAgenda: solo eliminadas → cumplimiento null', cuentasAgenda({ visitas: [], citas: [{ fecha: AYER, estado: 'eliminada' }], hoy: HOY }).cumplimiento === null)
check('estadoVisible: hoy pasada la hora → atrasada', estadoVisible({ estado: 'pendiente', fecha: HOY, hora: '10:00' }, AHORA) === 'atrasada')
check('estadoVisible: hoy a la hora o después → programada; hoy sin hora → programada', estadoVisible({ estado: 'pendiente', fecha: HOY, hora: '10:42' }, AHORA) === 'programada' && estadoVisible({ estado: 'pendiente', fecha: HOY, hora: null }, AHORA) === 'programada')
check('estadoVisible: de ayer → sin_cerrar (desde el día siguiente); de mañana → programada', estadoVisible({ estado: 'pendiente', fecha: AYER, hora: '23:00' }, AHORA) === 'sin_cerrar' && estadoVisible({ estado: 'pendiente', fecha: MANANA, hora: '08:00' }, AHORA) === 'programada')
check('estadoVisible: las cerradas, con su estado', (['hecha', 'no_realizada', 'cancelada', 'eliminada'] as const).every(estado => estadoVisible({ estado, fecha: AYER, hora: '09:00' }, AHORA) === estado))

// ---------------------------------------------------------------------------------------------
console.log('\n6. Sin tope hacia adelante (A4) y la hora pasada (C13)')
const mas400 = new Date(Date.UTC(2026, 9, 15 + 400)).toISOString().slice(0, 10)
check(`una cita a hoy + 400 (${mas400}) es válida`, mensajeFechaCita(mas400, HOY, []) === null && mensajeHoraCita(mas400, '07:00', AHORA) === null, { fecha: mensajeFechaCita(mas400, HOY, []) })
check('ayer no sirve; hoy sí', mensajeFechaCita(AYER, HOY, []) !== null && mensajeFechaCita(HOY, HOY, []) === null)
check(`hoy a una hora que ya pasó (10:41 a las 10:42) → "${MENSAJE_HORA_PASADA}"; 10:42 en punto y después sí`, mensajeHoraCita(HOY, '10:41', AHORA) === MENSAJE_HORA_PASADA && mensajeHoraCita(HOY, '10:42', AHORA) === null && mensajeHoraCita(HOY, '18:00', AHORA) === null)
check('mañana a cualquier hora sirve (también 00:00)', mensajeHoraCita(MANANA, '00:00', AHORA) === null)
const sinHora = citaCreateSchema.safeParse({ fecha: MANANA, tipo: 'medica', medico_id: '11111111-1111-4111-8111-111111111111', sede_id: '22222222-2222-4222-8222-222222222222' })
check('citaCreateSchema: sin hora → 400 (la hora es obligatoria)', !sinHora.success && sinHora.error.issues.some(i => i.path[0] === 'hora'), sinHora.success ? sinHora.data : sinHora.error.issues)
const LIB = path.join(__dirname, '..', 'lib')
const archivosLib: string[] = []
const recorrer = (dir: string) => {
  for (const nombre of readdirSync(dir)) {
    const ruta = path.join(dir, nombre)
    if (statSync(ruta).isDirectory()) recorrer(ruta)
    else if (/\.(ts|tsx)$/.test(nombre)) archivosLib.push(ruta)
  }
}
recorrer(LIB)
const conTope = archivosLib.filter(ruta => /export\s+(const|function|let)\s+DIAS_AGENDA_ADELANTE\b|export\s*\{[^}]*\bDIAS_AGENDA_ADELANTE\b/.test(readFileSync(ruta, 'utf8')))
check(`ningún archivo de web/lib exporta DIAS_AGENDA_ADELANTE (${archivosLib.length} archivos)`, archivosLib.length > 10 && conTope.length === 0, conTope.map(ruta => path.relative(LIB, ruta)))

// ---------------------------------------------------------------------------------------------
console.log('\n7. Los mensajes y la media hora son los mismos que en la 0850')
const SQL = readFileSync(path.join(__dirname, '..', '..', 'database', 'migrations', '2026-10-15_0850_persona_de_campo_y_agenda.sql'), 'utf8')
const mensajes = {
  MENSAJE_HORA_PASADA,
  MENSAJE_CITA_CERRADA,
  MENSAJE_CITA_NO_LLEGA,
  MENSAJE_SOLO_PENDIENTE_SE_ELIMINA,
  MENSAJE_ELIMINAR_PASADA,
  MENSAJE_CITA_SIGUE_PROGRAMADA,
  MENSAJE_CITA_YA_TIENE_OTRA_FECHA,
  MENSAJE_CITA_EFECTIVA_SIN_OTRA_FECHA,
  MENSAJE_CITA_SALIDA_SIN_OTRA_FECHA,
  MENSAJE_OTRA_FECHA_DISTINTA,
  MENSAJE_VISITA_CON_OTRA_FECHA,
  MENSAJE_MOTIVO_NO_VALIDO,
  MENSAJE_MOTIVO_SALIDA,
  MENSAJE_MOTIVO_LARGO,
  MENSAJE_MOTIVO_CANCELAR,
  MENSAJE_MOTIVO_CERRAR,
  TEXTO_SALIDA,
  TEXTO_DEJO_DE_SER_EJECUTIVO,
  YA_CANCELADA: 'Esa cita ya está cancelada',
  YA_TIENE_VISITA: 'Esa cita ya tiene su visita: no se cancela',
  CANCELAR_PASADA: 'Solo se cancelan las citas de hoy en adelante',
}
const faltan = Object.entries(mensajes).filter(([, texto]) => !SQL.includes(texto.replace(/'/g, "''"))).map(([nombre]) => nombre)
check('cada mensaje de lib/agenda-ciclo.ts está, letra por letra, en la 0850', faltan.length === 0, faltan)
check(`agenda_choque usa los mismos ${MINUTOS_CITA} minutos (${MINUTOS_CITA * 60} segundos)`, SQL.includes(`< ${MINUTOS_CITA * 60}`))
check('el choque de la 0850 dice lo mismo que mensajeChoque', SQL.includes("'A las % ya tienes cita con %: elige otra hora'"))
const estadosSql = /visitas_agenda_estado_check[\s\S]*?CHECK \(estado IN \(([^)]*)\)\)/.exec(SQL)?.[1]
check('los estados del CHECK de la 0850 son ESTADOS_CITA', igual(estadosSql?.split(',').map(e => e.trim().replace(/'/g, '')), ESTADOS_CITA.map(e => e.valor)), estadosSql)
const motivosSql = /visitas_agenda_motivo_codigo_check[\s\S]*?motivo_codigo IN \(([^)]*)\)/.exec(SQL)?.[1]
check('los motivos del CHECK de la 0850 son MOTIVOS_CIERRE', igual(motivosSql?.split(',').map(e => e.trim().replace(/'/g, '')), MOTIVOS_CIERRE.map(m => m.valor)), motivosSql)

// ---------------------------------------------------------------------------------------------
console.log(`\n${passed} pruebas bien, ${failed} con falla`)
if (failed > 0) process.exit(1)
