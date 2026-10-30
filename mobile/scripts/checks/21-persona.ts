/**
 * Sección 21 de scripts/movil-check.ts (F1b de actividades de campo, spec docs/specs/2026-10-15-actividades-de-campo.md,
 * "F1b"): la app de la persona de campo y el ciclo de vida de lo programado.
 *   - lib/persona.ts: quién entra (la dirección comercial ve el mensaje de la web), papel, cuota y días libres (solo
 *     con Ejecutivo Comercial), "como qué" agenda Paola y su papel en Ajustes.
 *   - lib/agenda-ciclo.ts, ESPEJO de web/lib/agenda-ciclo.ts: la prueba lee los dos archivos y compara los estados, los
 *     motivos, los límites y los mensajes; las transiciones de la tabla "Ciclo de vida"; qué ofrece cada cita.
 *   - errorChoque da el texto del servidor (el de agenda_crear en la 0850).
 *   - Hoy ("¿Qué pasó con esto?", sin "no está enlazado", "Actividades de hoy"), Números sin cuota, Días libres oculto,
 *     Ajustes, Agendar ("¿Qué vas a hacer?", "Como", otra fecha), la sesión y lib/api.ts, leyendo sus archivos.
 *   - Ningún archivo de mobile/app dice "Reportar visita", "Visitas de hoy", "Tipo de visita" ni "Reprogramar".
 *
 * Corren en Node, sin React Native ni red. Este solo, desde mobile/:
 *   npx tsx scripts/checks/correr.ts 21-persona
 */
import {
  ESTADOS_CITA,
  MAX_MOTIVO_CIERRE,
  MENSAJE_CITA_CERRADA,
  MENSAJE_CITA_EFECTIVA_SIN_OTRA_FECHA,
  MENSAJE_CITA_NO_LLEGA,
  MENSAJE_CITA_SALIDA_SIN_OTRA_FECHA,
  MENSAJE_CITA_SIGUE_PROGRAMADA,
  MENSAJE_CITA_YA_TIENE_OTRA_FECHA,
  MENSAJE_ELIMINAR_PASADA,
  MENSAJE_MOTIVO_CANCELAR,
  MENSAJE_MOTIVO_CERRAR,
  MENSAJE_MOTIVO_LARGO,
  MENSAJE_MOTIVO_NO_VALIDO,
  MENSAJE_MOTIVO_SALIDA,
  MENSAJE_SOLO_PENDIENTE_SE_ELIMINA,
  MIN_MOTIVO_OTRO,
  MINUTOS_CITA,
  MOTIVOS_CIERRE,
  MOTIVOS_ELEGIBLES,
  accionesDeCita,
  agendaChoca,
  citaCancelable,
  citaCerrable,
  citaEliminable,
  cuerpoMotivo,
  estadoVisible,
  mensajeChoque,
  mensajeTrasCerrar,
  origenParaOtraFecha,
  revisarCancelar,
  revisarCerrar,
  revisarEliminar,
  revisarMotivo,
  textoMotivoDeCierre,
  textoOtraFechaDe,
  textoVieneDe,
} from '../../lib/agenda-ciclo'
import { errorChoque } from '../../lib/agenda'
import { tieneClaves } from '../../lib/claves-api'
import { MAX_POR_CERRAR_VISIBLES, porCerrar } from '../../lib/pantallas'
import {
  ETIQUETA_COMO,
  MENSAJE_DIRECCION_EN_LA_WEB,
  MENSAJE_SIN_LINEAS,
  comoPorDefecto,
  eligeComo,
  entraALasPestanas,
  estadoPersona,
  medicosDelPapel,
  muestraDiasLibres,
  papelesDePersona,
  perfilDelPapel,
  personaDeMe,
  tieneCuota,
} from '../../lib/persona'
import { PESTANAS } from '../../lib/navegacion'
import { ETIQUETA_ESTADO_CITA, type CitaItem, type EstadoCita, type PersonaMovil } from '../../lib/tipos'
import type { Probador } from './probador'

// Corre en Node (tsx) con el programa de tipos de la app (sin @types/node): fs y path con lo mínimo que se usa.
interface FsMinimo {
  readFileSync(ruta: string, codificacion: 'utf8'): string
  readdirSync(ruta: string): string[]
  statSync(ruta: string): { isDirectory(): boolean }
}
interface PathMinimo {
  resolve(...partes: string[]): string
  join(...partes: string[]): string
  relative(desde: string, hasta: string): string
}
declare const __dirname: string
const { readFileSync, readdirSync, statSync } = require('fs') as FsMinimo
const path = require('path') as PathMinimo

const RAIZ_REPO = path.resolve(__dirname, '../../..')
/** Archivo del repo (desde la raíz: mobile/…, web/…, database/…). */
const leer = (relativa: string) => readFileSync(path.resolve(RAIZ_REPO, relativa), 'utf8')
/** El código sin comentarios (para buscar textos visibles y llamadas sin que cuente lo que dice un comentario). */
const sinComentarios = (texto: string) => texto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
/** El texto entre `desde` y el siguiente `hasta` ('' si falta un marcador: la prueba que lo use falla). */
function entre(texto: string, desde: string, hasta: string): string {
  const i = texto.indexOf(desde)
  const j = i > -1 ? texto.indexOf(hasta, i + desde.length) : -1
  return i > -1 && j > -1 ? texto.slice(i, j) : ''
}

/** Las entradas `{ valor: '…', etiqueta: '…'[, elegible: …] }` de la lista `nombre` de un archivo. */
function listaDelArchivo(texto: string, nombre: string): { valor: string; etiqueta: string; elegible?: boolean }[] {
  const bloque = new RegExp(`export const ${nombre} = \\[([\\s\\S]*?)\\] as const`).exec(texto)?.[1] ?? ''
  return Array.from(bloque.matchAll(/\{ valor: '([^']+)', etiqueta: '([^']+)'(?:, elegible: (true|false))? \}/g)).map(m => ({
    valor: m[1],
    etiqueta: m[2],
    ...(m[3] ? { elegible: m[3] === 'true' } : {}),
  }))
}

/** Lo que va después del `=` en `export const NOMBRE = …` (la línea), o null si no está. */
function definicion(texto: string, nombre: string): string | null {
  const m = new RegExp(`export const ${nombre} = (.+)$`, 'm').exec(texto)
  return m ? m[1].trim() : null
}

const HOY = '2026-10-15' // jueves
const AYER = '2026-10-14'
const MANANA = '2026-10-16'
/** Las 10:42 del 15 de octubre de 2026 en Bogotá. */
const A_LAS_10_42 = new Date('2026-10-15T15:42:00.000Z')

let secuencia = 0
function cita(extra: Partial<CitaItem> = {}): CitaItem {
  secuencia++
  return {
    id: `c21-${String(secuencia).padStart(3, '0')}`,
    fecha: HOY,
    hora: '09:00',
    tipo: 'medica',
    medico: { id: `m-${secuencia}`, nombre: 'Dra. Ana Gómez' },
    cuenta: null,
    subtipo: null,
    sede: { id: 'sede-1', nombre: 'Clínica Norte', cuenta_id: 'cuenta-1', cuenta_nombre: 'Clínica Norte S.A.', lat: 7.1, lng: -73.1, ubicacion_confirmada: true },
    nota: null,
    estado: 'pendiente',
    visita_id: null,
    distancia_m: null,
    dentro_del_radio: null,
    anticipada: true,
    cancelable: true,
    motivo_codigo: null,
    no_realizada_at: null,
    no_realizada_motivo: null,
    viene_de: null,
    viene_de_fecha: null,
    viene_de_estado: null,
    sucesora_id: null,
    como: 'ejecutivo',
    estado_visible: 'programada',
    ...extra,
  }
}

const L_TRA = 'l-trauma'
const L_SUS = 'l-sustitutos'
const L_DEP = 'l-deportiva'
const PAOLA: PersonaMovil = {
  rol: 'lider_y_ejecutivo',
  lineas: [
    { id: L_SUS, nombre: 'Sustitutos óseos', como: 'ejecutivo' },
    { id: L_TRA, nombre: 'Trauma', como: 'lider' },
  ],
}
const LUCIA: PersonaMovil = { rol: 'lider', lineas: [{ id: L_DEP, nombre: 'Medicina deportiva', como: 'lider' }] }
const CARMEN: PersonaMovil = {
  rol: 'ejecutivo',
  lineas: [
    { id: 'l-perossal', nombre: 'PerOssal', como: 'ejecutivo' },
    { id: 'l-reemplazo', nombre: 'Reemplazo articular', como: 'ejecutivo' },
  ],
}

export async function pruebas(t: Probador): Promise<void> {
  const { check } = t
  t.seccion('21. Persona de campo y ciclo de vida de la cita (F1b)')

  // -------------------------------------------------------------------------
  t.seccion('21a. Quién entra y con qué papel (lib/persona.ts)')
  {
    check(
      'la dirección comercial no entra a las pestañas (por su rol, aunque traiga persona o esté sin confirmar)',
      estadoPersona({ role: 'commercial_director', persona: null }) === 'direccion' &&
        estadoPersona({ role: 'commercial_director', persona: LUCIA, sinConfirmar: true }) === 'direccion' &&
        !entraALasPestanas('direccion')
    )
    check(
      'una líder sin Ejecutivo Comercial es persona de campo: entra (sin el aviso de "no enlazado")',
      estadoPersona({ role: 'line_leader', persona: LUCIA }) === 'campo' && entraALasPestanas('campo')
    )
    check(
      'sin líneas confirmado (persona null y la sesión confirmada) → sin_lineas; sin señal o sin el dato → sin_saber (entra: decide el servidor)',
      estadoPersona({ role: 'sales_manager', persona: null }) === 'sin_lineas' &&
        estadoPersona({ role: 'sales_manager', persona: null, sinConfirmar: true }) === 'sin_saber' &&
        estadoPersona({ role: 'sales_manager', persona: undefined }) === 'sin_saber' &&
        entraALasPestanas('sin_lineas') &&
        entraALasPestanas('sin_saber')
    )
    check(
      'personaDeMe: la del servidor manda (también null); un servidor sin la 0850 (sin la clave) deja la que se sabía',
      personaDeMe({ persona: LUCIA }, null) === LUCIA && personaDeMe({ persona: null }, LUCIA) === null && personaDeMe({}, PAOLA) === PAOLA && personaDeMe({}, undefined) === undefined
    )
    check(
      'cuota y días libres solo con Ejecutivo Comercial: la líder no; Paola y Carmen sí; sin persona, según su Ejecutivo Comercial enlazado',
      !tieneCuota({ persona: LUCIA }) &&
        !muestraDiasLibres({ persona: LUCIA, ejecutiva: null }) &&
        tieneCuota({ persona: PAOLA }) &&
        muestraDiasLibres({ persona: PAOLA }) &&
        muestraDiasLibres({ persona: CARMEN }) &&
        muestraDiasLibres({ persona: undefined, ejecutiva: { id: 'e1', full_name: 'Carmen', zona: 'Barranquilla' } }) &&
        !muestraDiasLibres({ persona: undefined, ejecutiva: null })
    )
    check('"Como Ejecutiva Comercial" / "Como líder" solo para quien tiene los dos papeles (C12)', eligeComo(PAOLA) && !eligeComo(LUCIA) && !eligeComo(CARMEN) && !eligeComo(null))
    check('"como qué" por defecto (C12): como Ejecutivo Comercial si lo tiene; la líder, como líder', comoPorDefecto(PAOLA) === 'ejecutivo' && comoPorDefecto(CARMEN) === 'ejecutivo' && comoPorDefecto(LUCIA) === 'lider')
    check("las etiquetas de \"como qué\": 'Como Ejecutiva Comercial' y 'Como líder'", ETIQUETA_COMO.ejecutivo === 'Como Ejecutiva Comercial' && ETIQUETA_COMO.lider === 'Como líder')
    check(
      'Ajustes: "Líder · Trauma" y "Ejecutivo Comercial · Sustitutos óseos · Bucaramanga" (Paola, los dos)',
      papelesDePersona(PAOLA, 'Bucaramanga').join(' | ') === 'Líder · Trauma | Ejecutivo Comercial · Sustitutos óseos · Bucaramanga',
      papelesDePersona(PAOLA, 'Bucaramanga')
    )
    check(
      'Ajustes: la líder solo "Líder · …"; un Ejecutivo Comercial con dos líneas las junta; sin zona, sin la última parte; sin persona, nada',
      papelesDePersona(LUCIA, null).join() === 'Líder · Medicina deportiva' &&
        papelesDePersona(CARMEN, 'Barranquilla').join() === 'Ejecutivo Comercial · PerOssal y Reemplazo articular · Barranquilla' &&
        papelesDePersona(CARMEN, null).join() === 'Ejecutivo Comercial · PerOssal y Reemplazo articular' &&
        papelesDePersona(undefined, 'X').length === 0
    )
    const medicos = [
      { id: 'm-tra', lineas: [L_TRA] },
      { id: 'm-sus', lineas: [L_SUS] },
      { id: 'm-dos', lineas: [L_SUS, L_TRA] },
    ]
    check(
      'medicosDelPapel (C9): Paola como líder, solo los de Trauma; como Ejecutiva, todos; a los demás no se les filtra',
      medicosDelPapel(medicos, PAOLA, 'lider').map(m => m.id).join() === 'm-tra,m-dos' &&
        medicosDelPapel(medicos, PAOLA, 'ejecutivo').length === 3 &&
        medicosDelPapel(medicos, LUCIA, 'lider').length === 3 &&
        medicosDelPapel(medicos, CARMEN, null).length === 3
    )
    check(
      'perfilDelPapel: como líder rige la configuración general (médica e institucional); si no, el perfil del contexto',
      perfilDelPapel(['medica'], PAOLA, 'lider').join() === 'medica,institucional' && perfilDelPapel(['medica'], PAOLA, 'ejecutivo').join() === 'medica' && perfilDelPapel(['institucional'], CARMEN, null).join() === 'institucional'
    )
    const web = leer('web/lib/persona-campo.ts')
    check('MENSAJE_SIN_LINEAS es el mismo texto del servidor (web/lib/persona-campo.ts)', web.includes(`export const MENSAJE_SIN_LINEAS = '${MENSAJE_SIN_LINEAS}'`))
    check('el mensaje de la dirección comercial: "La dirección comercial sigue a su equipo en la web (Equipo)"', MENSAJE_DIRECCION_EN_LA_WEB === 'La dirección comercial sigue a su equipo en la web (Equipo)')
  }

  // -------------------------------------------------------------------------
  t.seccion('21b. El espejo del ciclo de vida: mobile/lib/agenda-ciclo.ts = web/lib/agenda-ciclo.ts (lee los dos archivos)')
  {
    const web = leer('web/lib/agenda-ciclo.ts')
    const app = leer('mobile/lib/agenda-ciclo.ts')
    const estadosWeb = listaDelArchivo(web, 'ESTADOS_CITA')
    const motivosWeb = listaDelArchivo(web, 'MOTIVOS_CIERRE')
    check(
      'ESTADOS_CITA: los 5 estados, con las mismas etiquetas y en el mismo orden que la web',
      estadosWeb.length === 5 && JSON.stringify(estadosWeb) === JSON.stringify(ESTADOS_CITA.map(e => ({ valor: e.valor, etiqueta: e.etiqueta }))) && JSON.stringify(listaDelArchivo(app, 'ESTADOS_CITA')) === JSON.stringify(estadosWeb),
      { web: estadosWeb, app: ESTADOS_CITA }
    )
    check(
      'MOTIVOS_CIERRE: los 6 motivos (cliente, prioridad, falta_tiempo, fuerza_mayor, otro y salida), con sus etiquetas y cuál se elige, iguales a la web',
      motivosWeb.length === 6 && JSON.stringify(motivosWeb) === JSON.stringify(MOTIVOS_CIERRE.map(m => ({ valor: m.valor, etiqueta: m.etiqueta, elegible: m.elegible }))),
      { web: motivosWeb, app: MOTIVOS_CIERRE }
    )
    check(
      "los elegibles son los 5 sin 'salida' (la pone el sistema, A16)",
      MOTIVOS_ELEGIBLES.map(m => m.valor).join() === 'cliente,prioridad,falta_tiempo,fuerza_mayor,otro' && !MOTIVOS_ELEGIBLES.some(m => (m.valor as string) === 'salida')
    )
    check(
      'ETIQUETA_ESTADO_CITA (lib/tipos.ts) dice lo mismo que ESTADOS_CITA (la pendiente es "Programada")',
      (Object.keys(ETIQUETA_ESTADO_CITA) as EstadoCita[]).join() === ESTADOS_CITA.map(e => e.valor).join() && ESTADOS_CITA.every(e => ETIQUETA_ESTADO_CITA[e.valor] === e.etiqueta) && ETIQUETA_ESTADO_CITA.pendiente === 'Programada'
    )
    const constantes = Array.from(app.matchAll(/^export const ((?:MENSAJE|TEXTO|MIN|MAX)_[A-Z_]+|MINUTOS_CITA) = /gm)).map(m => m[1])
    const distintas = constantes.filter(nombre => definicion(web, nombre) !== definicion(app, nombre))
    check(
      `los ${constantes.length} mensajes y límites del espejo están igual escritos en la web (MENSAJE_*, TEXTO_*, MIN_*, MAX_* y MINUTOS_CITA)`,
      constantes.length >= 18 && distintas.length === 0,
      distintas.map(nombre => ({ nombre, web: definicion(web, nombre), app: definicion(app, nombre) }))
    )
    check('los límites valen lo mismo: texto de 3 a 300 con "otro", media hora de choque', MIN_MOTIVO_OTRO === 3 && MAX_MOTIVO_CIERRE === 300 && MINUTOS_CITA === 30 && MENSAJE_MOTIVO_LARGO === 'El motivo no puede superar 300 caracteres')
    check(
      'mensajeChoque: la misma plantilla en los dos archivos',
      entre(web, 'export function mensajeChoque(', '\n}') .includes('return `A las ${hora} ya tienes cita con ${conQuien}: elige otra hora`') &&
        entre(app, 'export function mensajeChoque(', '\n}').includes('return `A las ${hora} ya tienes cita con ${conQuien}: elige otra hora`')
    )
    // Las funciones del ciclo de vida: el cuerpo de la web y el de la app son el mismo código (se comparan sin espacios ni
    // comentarios; la firma puede ir en otras líneas). El cuerpo empieza en el primer "{" de fin de línea.
    const cuerpo = (texto: string, nombre: string) => {
      const firma = texto.search(new RegExp(`export function ${nombre}\\b`))
      const inicio = firma < 0 ? -1 : texto.indexOf('{\n', firma)
      const fin = inicio < 0 ? -1 : texto.indexOf('\n}\n', inicio)
      return inicio < 0 || fin < 0 ? '' : texto.slice(inicio, fin).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').replace(/\s+/g, '')
    }
    const funciones = ['citaCancelable', 'citaCerrable', 'citaEliminable', 'revisarCancelar', 'revisarCerrar', 'revisarEliminar', 'origenParaOtraFecha', 'agendaChoca']
    const otras = funciones.filter(nombre => !cuerpo(web, nombre) || cuerpo(web, nombre) !== cuerpo(app, nombre))
    check(`${funciones.join(', ')}: el mismo código que la web`, otras.length === 0, otras)
  }

  // -------------------------------------------------------------------------
  t.seccion('21c. Las transiciones de la tabla "Ciclo de vida" (A7, C7, C8, C10)')
  {
    const estados: EstadoCita[] = ['pendiente', 'hecha', 'no_realizada', 'cancelada', 'eliminada']
    const dias = { ayer: AYER, hoy: HOY, manana: MANANA } as const
    const tabla: string[] = []
    for (const estado of estados) {
      for (const [nombre, fecha] of Object.entries(dias)) {
        const c = { estado, fecha }
        tabla.push(`${estado}/${nombre}: ${citaCancelable(c, HOY) ? 'C' : '-'}${citaCerrable(c, HOY) ? 'N' : '-'}${citaEliminable(c, HOY) ? 'E' : '-'}`)
      }
    }
    // C = cancelar, N = "no se hizo", E = eliminar por error. Solo la pendiente; cancelar y eliminar de hoy en adelante;
    // "no se hizo" de su día o antes (el mismo día valen las tres).
    const esperada = [
      'pendiente/ayer: -N-', 'pendiente/hoy: CNE', 'pendiente/manana: C-E',
      'hecha/ayer: ---', 'hecha/hoy: ---', 'hecha/manana: ---',
      'no_realizada/ayer: ---', 'no_realizada/hoy: ---', 'no_realizada/manana: ---',
      'cancelada/ayer: ---', 'cancelada/hoy: ---', 'cancelada/manana: ---',
      'eliminada/ayer: ---', 'eliminada/hoy: ---', 'eliminada/manana: ---',
    ]
    check('cancelar, "no se hizo" y eliminar: cada par (estado, día) da lo de la tabla', tabla.join(' | ') === esperada.join(' | '), tabla)
    check(
      'los mensajes de la base: cerrar la de mañana, una cerrada; eliminar una hecha y una de ayer; cancelar una de ayer',
      revisarCerrar({ estado: 'pendiente', fecha: MANANA }, HOY) === MENSAJE_CITA_NO_LLEGA &&
        revisarCerrar({ estado: 'no_realizada', fecha: AYER }, HOY) === MENSAJE_CITA_CERRADA &&
        revisarEliminar({ estado: 'hecha', fecha: HOY }, HOY) === MENSAJE_SOLO_PENDIENTE_SE_ELIMINA &&
        revisarEliminar({ estado: 'pendiente', fecha: AYER }, HOY) === MENSAJE_ELIMINAR_PASADA &&
        revisarCancelar({ estado: 'pendiente', fecha: AYER }, HOY) === 'Solo se cancelan las citas de hoy en adelante' &&
        revisarCancelar({ estado: 'pendiente', fecha: HOY }, HOY) === null
    )
    check(
      "motivos: 'otro' exige texto (3 a 300, con el mensaje de cada uso); 'salida' no se elige; un código desconocido no; los demás, texto opcional",
      revisarMotivo('otro', 'no', 'cancelar') === MENSAJE_MOTIVO_CANCELAR &&
        revisarMotivo('otro', '  ', 'cerrar') === MENSAJE_MOTIVO_CERRAR &&
        revisarMotivo('otro', 'Se fue a cirugía', 'cerrar') === null &&
        revisarMotivo('salida', 'x', 'cancelar') === MENSAJE_MOTIVO_SALIDA &&
        revisarMotivo('vacaciones', null, 'cerrar') === MENSAJE_MOTIVO_NO_VALIDO &&
        revisarMotivo(null, null, 'cerrar') === MENSAJE_MOTIVO_NO_VALIDO &&
        revisarMotivo('cliente', null, 'cancelar') === null &&
        revisarMotivo('cliente', 'x'.repeat(301), 'cerrar') === MENSAJE_MOTIVO_LARGO
    )
    check(
      'otra fecha: la que no se hizo, la cancelada y la hecha NO efectiva, sí; pendiente, eliminada, cancelada por salida, hecha efectiva (o sin saber) y con sucesora, no',
      origenParaOtraFecha({ estado: 'no_realizada', motivo_codigo: 'cliente', tiene_sucesora: false }) === null &&
        origenParaOtraFecha({ estado: 'cancelada', motivo_codigo: 'otro', tiene_sucesora: false }) === null &&
        origenParaOtraFecha({ estado: 'hecha', motivo_codigo: null, visita_efectiva: false, tiene_sucesora: false }) === null &&
        origenParaOtraFecha({ estado: 'pendiente', motivo_codigo: null, tiene_sucesora: false }) === MENSAJE_CITA_SIGUE_PROGRAMADA &&
        origenParaOtraFecha({ estado: 'eliminada', motivo_codigo: null, tiene_sucesora: false }) !== null &&
        origenParaOtraFecha({ estado: 'cancelada', motivo_codigo: 'salida', tiene_sucesora: false }) === MENSAJE_CITA_SALIDA_SIN_OTRA_FECHA &&
        origenParaOtraFecha({ estado: 'hecha', motivo_codigo: null, visita_efectiva: true, tiene_sucesora: false }) === MENSAJE_CITA_EFECTIVA_SIN_OTRA_FECHA &&
        origenParaOtraFecha({ estado: 'hecha', motivo_codigo: null, tiene_sucesora: false }) === MENSAJE_CITA_EFECTIVA_SIN_OTRA_FECHA &&
        origenParaOtraFecha({ estado: 'no_realizada', motivo_codigo: 'cliente', tiene_sucesora: true }) === MENSAJE_CITA_YA_TIENE_OTRA_FECHA
    )
    check(
      'estado visible (C6): hoy pasada su hora "atrasada"; de un día anterior "sin cerrar"; por venir "programada"; las cerradas, su estado',
      estadoVisible({ estado: 'pendiente', fecha: HOY, hora: '09:00' }, A_LAS_10_42) === 'atrasada' &&
        estadoVisible({ estado: 'pendiente', fecha: AYER, hora: '15:00' }, A_LAS_10_42) === 'sin_cerrar' &&
        estadoVisible({ estado: 'pendiente', fecha: HOY, hora: '11:00' }, A_LAS_10_42) === 'programada' &&
        estadoVisible({ estado: 'pendiente', fecha: HOY, hora: null }, A_LAS_10_42) === 'programada' &&
        estadoVisible({ estado: 'no_realizada', fecha: AYER, hora: '15:00' }, A_LAS_10_42) === 'no_realizada'
    )
    const delDia = [cita({ id: 'a-0900', hora: '09:00' }), cita({ id: 'a-1000', hora: '10:00', estado: 'no_realizada' }), cita({ id: 'a-1100', hora: '11:00', estado: 'cancelada' }), cita({ id: 'a-sin', hora: null })]
    check(
      'agendaChoca (C del 0850): 09:00 contra 09:15 choca; contra 09:30 no; la que no se hizo, la cancelada y la sin hora nunca',
      agendaChoca({ fecha: HOY, hora: '09:15' }, delDia)?.id === 'a-0900' && agendaChoca({ fecha: HOY, hora: '09:30' }, delDia) === null && agendaChoca({ fecha: HOY, hora: '10:00' }, delDia) === null && agendaChoca({ fecha: HOY, hora: '11:10' }, delDia) === null
    )
  }

  // -------------------------------------------------------------------------
  t.seccion('21d. errorChoque da el texto del servidor (agenda_crear de la 0850)')
  {
    const sql = leer('database/migrations/2026-10-15_0850_persona_de_campo_y_agenda.sql')
    const plantilla = /RAISE EXCEPTION '(A las % ya tienes cita con %: elige otra hora)'/.exec(sql)?.[1] ?? ''
    const citas = [cita({ hora: '09:30', medico: { id: 'm-x', nombre: 'Dra. X' } }), cita({ hora: '14:00', tipo: 'institucional', medico: null, cuenta: { id: 'c-y', nombre: 'Clínica Y' }, subtipo: { id: 's', codigo: 'compras', nombre: 'Compras' } })]
    const error = errorChoque({ fecha: HOY, hora: '09:45' }, citas)
    check(
      'el error en `hora` con el texto que lanza la base, con la hora y con quién (el médico, o la cuenta y el subtipo)',
      plantilla !== '' &&
        error?.campo === 'hora' &&
        error.mensaje === plantilla.replace('%', '09:30').replace('%', 'Dra. X') &&
        error.mensaje === mensajeChoque('09:30', 'Dra. X') &&
        errorChoque({ fecha: HOY, hora: '14:15' }, citas)?.mensaje === 'A las 14:00 ya tienes cita con Clínica Y · Compras: elige otra hora',
      { plantilla, error }
    )
    check('sin choque, null (09:00 y 10:00 están a media hora justa de la de las 09:30)', errorChoque({ fecha: HOY, hora: '09:00' }, citas) === null && errorChoque({ fecha: HOY, hora: '10:00' }, citas) === null)
  }

  // -------------------------------------------------------------------------
  t.seccion('21e. Qué ofrece cada cita y los textos del detalle')
  {
    const acciones = (c: Partial<CitaItem>, efectiva: boolean | null = null) => {
      const a = accionesDeCita(cita(c), HOY, efectiva)
      return `${a.reportar ? 'R' : '-'}${a.noSeHizo ? 'N' : '-'}${a.cancelar ? 'C' : '-'}${a.otraFecha ? 'O' : '-'}${a.eliminar ? 'E' : '-'}`
    }
    check(
      'pendiente de hoy: Reportar, "No se hizo", Cancelar y Eliminar; de mañana: Cancelar y Eliminar; de ayer: solo "No se hizo"',
      acciones({}) === 'RNC-E' && acciones({ fecha: MANANA }) === '--C-E' && acciones({ fecha: AYER }) === '-N---',
      [acciones({}), acciones({ fecha: MANANA }), acciones({ fecha: AYER })]
    )
    check(
      '"Agendar otra fecha": la que no se hizo y la cancelada (sin sucesora); la hecha solo si su visita no fue efectiva; nunca la cancelada por salida',
      acciones({ estado: 'no_realizada', fecha: AYER, motivo_codigo: 'cliente' }) === '---O-' &&
        acciones({ estado: 'cancelada', fecha: MANANA, motivo_codigo: 'prioridad' }) === '---O-' &&
        acciones({ estado: 'no_realizada', fecha: AYER, motivo_codigo: 'cliente', sucesora_id: 'otra' }) === '-----' &&
        acciones({ estado: 'hecha', visita_id: 'v1' }, false) === '---O-' &&
        acciones({ estado: 'hecha', visita_id: 'v1' }, true) === '-----' &&
        acciones({ estado: 'hecha', visita_id: 'v1' }) === '-----' &&
        acciones({ estado: 'cancelada', fecha: MANANA, motivo_codigo: 'salida' }) === '-----'
    )
    check('el cuerpo del motivo: el código y el texto limpio (o null), hasta 300; con las claves del contrato', JSON.stringify(cuerpoMotivo('otro', '  Se fue   a cirugía ')) === JSON.stringify({ motivo_codigo: 'otro', motivo: 'Se fue a cirugía' }) && cuerpoMotivo('cliente', '').motivo === null && (cuerpoMotivo('otro', 'x'.repeat(400)).motivo ?? '').length === 300 && tieneClaves(cuerpoMotivo('cliente', null), 'citaCerrar') && tieneClaves(cuerpoMotivo('cliente', null), 'citaCancelar'))
    check(
      '"Viene de la cita del 12 oct · No se hizo" (la hecha: "No efectiva"); sin la fecha, "Viene de otra cita"; sin viene_de, nada',
      textoVieneDe(cita({ viene_de: 'x', viene_de_fecha: '2026-10-12', viene_de_estado: 'no_realizada' })) === 'Viene de la cita del 12 oct · No se hizo' &&
        textoVieneDe(cita({ viene_de: 'x', viene_de_fecha: '2026-10-12', viene_de_estado: 'cancelada' })) === 'Viene de la cita del 12 oct · Cancelada' &&
        textoVieneDe(cita({ viene_de: 'x', viene_de_fecha: '2026-10-12', viene_de_estado: 'hecha' })) === 'Viene de la cita del 12 oct · No efectiva' &&
        textoVieneDe(cita({ viene_de: 'x' })) === 'Viene de otra cita' &&
        textoVieneDe(cita()) === null
    )
    check('Agendar otra fecha dice de qué cita: "Otra fecha de la cita del 12 oct · No se hizo"', textoOtraFechaDe(cita({ fecha: '2026-10-12', estado: 'no_realizada' })) === 'Otra fecha de la cita del 12 oct · No se hizo')
    check(
      'el motivo de la cerrada: la etiqueta del código y, en la que no se hizo, su texto ("Otro" no se repite si hay texto)',
      textoMotivoDeCierre(cita({ estado: 'no_realizada', motivo_codigo: 'cliente', no_realizada_motivo: 'Viajó' })) === 'El médico o el cliente no pudo · Viajó' &&
        textoMotivoDeCierre(cita({ estado: 'no_realizada', motivo_codigo: 'otro', no_realizada_motivo: 'Se cerró la vía' })) === 'Se cerró la vía' &&
        textoMotivoDeCierre(cita({ estado: 'cancelada', motivo_codigo: 'fuerza_mayor' })) === 'Salud, clima o vía' &&
        textoMotivoDeCierre(cita({ estado: 'pendiente', motivo_codigo: null })) === null
    )
    const conDra = cita({ medico: { id: 'm', nombre: 'Dra. X' } })
    check(
      'lo que se dice al cerrar, cancelar (sigue diciendo "Queda en tu agenda como cancelada") y eliminar',
      mensajeTrasCerrar('no_se_hizo', conDra).startsWith('Anotado: la cita con Dra. X no se hizo') &&
        mensajeTrasCerrar('cancelar', conDra) === 'Cancelaste la cita con Dra. X. Queda en tu agenda como cancelada.' &&
        mensajeTrasCerrar('eliminar', conDra).includes('ya no sale en tu agenda ni cuenta en tus números')
    )
  }

  // -------------------------------------------------------------------------
  t.seccion('21f. Hoy: "¿Qué pasó con esto?" (porCerrar)')
  {
    const ayer = cita({ id: 'p-ayer', fecha: AYER, hora: '15:00' })
    const antier = cita({ id: 'p-antier', fecha: '2026-10-13', hora: '08:00' })
    const atrasada = cita({ id: 'p-0800', fecha: HOY, hora: '08:00' })
    const deAhora = cita({ id: 'p-1030', fecha: HOY, hora: '10:30' })
    const porVenir = cita({ id: 'p-1500', fecha: HOY, hora: '15:00' })
    const hecha = cita({ id: 'p-hecha', fecha: AYER, estado: 'hecha', visita_id: 'v' })
    const manana = cita({ id: 'p-manana', fecha: MANANA })
    const lista = porCerrar([porVenir, ayer, hecha, atrasada, deAhora, manana, antier, ayer], A_LAS_10_42, deAhora.id)
    check(
      'lo atrasado de hoy primero y lo sin cerrar de días anteriores (del más reciente al más viejo), sin la cita "de ahora", sin repetir',
      lista.map(c => c.id).join() === 'p-0800,p-ayer,p-antier',
      lista.map(c => c.id)
    )
    check('sin la cita "de ahora" excluida, la de las 10:30 (ya pasó) también entra', porCerrar([deAhora], A_LAS_10_42).length === 1)
    check('se ven unas pocas antes de "Ver todas"', MAX_POR_CERRAR_VISIBLES === 4)
  }

  // -------------------------------------------------------------------------
  t.seccion('21g. Pantallas (leen su archivo)')
  {
    const hoy = leer('mobile/app/(app)/hoy.tsx')
    const hoyVisible = sinComentarios(hoy)
    check(
      'Hoy: sin el aviso "no está enlazado"; el de "sin líneas" solo si el servidor lo confirmó (estadoPersona) y sin contexto',
      !hoyVisible.includes('no está enlazado') &&
        /const estado = estadoPersona\(\{ role: perfil\?\.usuario\.role, persona, sinConfirmar \}\)/.test(hoy) &&
        /const sinLineas = estado === 'sin_lineas' && !contexto/.test(hoy) &&
        /<Aviso tono="peligro" titulo=\{MENSAJE_SIN_LINEAS\}>/.test(hoy)
    )
    check('Hoy: la meta del día solo con cuota (una líder no la ve); sin contexto, el error de la carga', /\{conCuota \|\| !contexto \? <MetaDelDia /.test(hoy))
    check('Hoy: "Reportar actividad" y "Actividades de hoy"', hoyVisible.includes('<Boton titulo="Reportar actividad"') && hoyVisible.includes('<Seccion titulo="Actividades de hoy"'))
    check(
      'Hoy: "¿Qué pasó con esto?" con porCerrar (lo de hoy y los 31 días anteriores, sin la cita de ahora) y lo que está ahí no se repite en la agenda de hoy',
      /<QuePasoConEsto\s/.test(hoy) &&
        /api\.agenda\(sumarDias\(hoy, -MAX_DIAS_CONSULTA_AGENDA\), sumarDias\(hoy, -1\)\)/.test(hoy) &&
        /porCerrar\(\[\.\.\.citasDeHoy, \.\.\.anteriores\.filter\(c => c\.fecha < hoy\)\], ahora, deAhoraCroquis\?\.id \?\? null\)/.test(hoy) &&
        /aparte=\{aparte\}/.test(hoy) &&
        /const enLista = ordenadas\.filter\(c => !aparte\.has\(c\.id\)\)/.test(hoy)
    )
    const quePaso = leer('mobile/components/agenda/QuePasoConEsto.tsx')
    check(
      '"¿Qué pasó con esto?": Reportar solo lo de hoy, "No se hizo" con motivo y Cancelar solo de hoy en adelante (accionesDeCita); y "Agendar otra fecha" al cerrar',
      /titulo="¿Qué pasó con esto\?"/.test(quePaso) &&
        /\{acciones\.reportar \? <Boton titulo="Reportar"/.test(quePaso) &&
        /\{acciones\.noSeHizo \? <Boton titulo="No se hizo"/.test(quePaso) &&
        /\{acciones\.cancelar \? <Boton titulo="Cancelar"/.test(quePaso) &&
        /<FormularioMotivo/.test(quePaso) &&
        /titulo="Agendar otra fecha"/.test(quePaso)
    )
    const formulario = leer('mobile/components/agenda/FormularioMotivo.tsx')
    check('el motivo: los de la lista (MOTIVOS_ELEGIBLES, sin "salida") y revisarMotivo antes de enviar', /MOTIVOS_ELEGIBLES\.map/.test(formulario) && /revisarMotivo\(codigo, texto, uso\)/.test(formulario) && !/'salida'/.test(formulario))

    const layout = leer('mobile/app/(app)/_layout.tsx')
    check(
      'la dirección comercial ve el mensaje de la web y no entra a las pestañas (antes de dibujar las Tabs)',
      /if \(!entraALasPestanas\(estadoPersona\(\{ role: perfil\?\.usuario\.role, persona: perfil\?\.persona, sinConfirmar \}\)\)\) return <SoloEnLaWeb \/>/.test(layout) &&
        layout.indexOf('return <SoloEnLaWeb />') < layout.indexOf('<Tabs') &&
        /titulo=\{MENSAJE_DIRECCION_EN_LA_WEB\}/.test(layout) &&
        /titulo="Cerrar sesión"/.test(layout)
    )
    check('la barra de abajo no cambia: hoy, reportar, agenda, numeros y ajustes', PESTANAS.map(p => p.ruta).join() === 'hoy,reportar,agenda,numeros,ajustes')

    const numeros = leer('mobile/app/(app)/numeros.tsx')
    check(
      'Números: sin cuota (null, una líder) no se muestra la cuota sino lo hecho y la agenda; la agenda cuenta también las que no se hicieron',
      /\{datos\.cuota \? \(\s*<Contenido datos=\{\{ \.\.\.datos, cuota: datos\.cuota \}\}/.test(numeros) &&
        /: datos\.numeros \? \(\s*<SinCuota numeros=\{datos\.numeros\} \/>/.test(numeros) &&
        !/function SinCuota[\s\S]*?TarjetaTipo[\s\S]*?\n\}/.test(entre(numeros, 'function SinCuota(', '\nfunction Contenido(')) &&
        /etiqueta="No se hicieron" valor=\{numeroTexto\(agenda\.citas_no_realizadas\)\}/.test(numeros)
    )
    const agenda = leer('mobile/app/(app)/agenda.tsx')
    const ajustes = leer('mobile/app/(app)/ajustes.tsx')
    check(
      'Días libres se oculta sin Ejecutivo Comercial: en Mi agenda (botón y consulta) y en Ajustes',
      /\{conDiasLibres \? \(\s*<Boton titulo="Días libres"/.test(agenda) &&
        /conDiasLibresRef\.current \? api\.diasLibres\(rango\.desde, rango\.hasta\)/.test(agenda) &&
        /\{conDiasLibres \? \(\s*<Tarjeta alPresionar=\{\(\) => router\.push\('\/dias-libres'\)\}/.test(ajustes) &&
        /muestraDiasLibres\(\{ persona: perfil\?\.persona, ejecutiva: perfil\?\.ejecutiva \}\)/.test(agenda) &&
        /muestraDiasLibres\(\{ persona: perfil\?\.persona, ejecutiva: perfil\?\.ejecutiva \}\)/.test(ajustes)
    )
    check('Ajustes: su papel con papelesDePersona (con la zona de su Ejecutivo Comercial)', /papelesDePersona\(perfil\?\.persona, perfil\?\.ejecutiva\?\.zona\)/.test(ajustes) && /Reportas como/.test(ajustes))
    check(
      'Mi agenda: el detalle con Reportar, "No se hizo", Cancelar, Eliminar y "Agendar otra fecha" (cerrarCita, eliminarCita y el pedido de otra fecha); sin el aviso de los 30 días',
      /alNoSeHizo=\{motivo => noSeHizo\(citaAbierta, motivo\)\}/.test(agenda) &&
        /alEliminar=\{\(\) => eliminar\(citaAbierta\)\}/.test(agenda) &&
        /alOtraFecha=\{\(\) => otraFecha\(citaAbierta\)\}/.test(agenda) &&
        /alReportar=\{\(\) => reportar\(citaAbierta\)\}/.test(agenda) &&
        /api\.cerrarCita\(cita\.id, motivo\)/.test(agenda) &&
        /api\.eliminarCita\(cita\.id\)/.test(agenda) &&
        /fijarPedidoAgendar\(pedidoOtraFecha\(cita\)\)/.test(agenda) &&
        !sinComentarios(agenda).includes('30 días')
    )

    const nueva = leer('mobile/app/(app)/agenda/nueva.tsx')
    const nuevaVisible = sinComentarios(nueva)
    check(
      'Agendar: "¿Qué vas a hacer?" con "Visita a médico" y "Visita institucional" (ETIQUETA_ACTIVIDAD)',
      nueva.includes('<Subtitulo>¿Qué vas a hacer?</Subtitulo>') && /texto=\{ETIQUETA_ACTIVIDAD\[tipo\]\}/.test(nueva)
    )
    check(
      'Agendar: "Como Ejecutiva Comercial" / "Como líder" solo con eligeComo(persona) (rol lider_y_ejecutivo)',
      /\{eligeComo\(persona\) \? \(\s*<Grupo>\s*\{\(\['ejecutivo', 'lider'\] as ComoPersona\[\]\)\.map\(papel => \(\s*<Chip key=\{papel\} texto=\{ETIQUETA_COMO\[papel\]\}/.test(nueva)
    )
    check(
      'Agendar: otra fecha va a POST …/otra-fecha con cuerpoOtraFecha; lo demás, a POST /api/me/agenda',
      /origen \? await api\.otraFechaCita\(origen\.id, cuerpoOtraFecha\(formulario, origen\)\) : await api\.agendar\(cuerpoCitaConHora\(formulario\)\)/.test(nueva)
    )
    check('Agendar: sin "Mover" ni "Reprogramar"', !/Mover|Reprogramar/.test(nuevaVisible))

    const sesion = leer('mobile/lib/sesion.ts')
    check(
      'la sesión guarda la persona de /api/auth/me (personaDeMe) al confirmar y, después de entrar, la pide en segundo plano (completarPersona)',
      /persona: personaDeMe\(respuesta, guardado\?\.persona\)/.test(sesion) && /void completarPersona\(respuesta\.token, nuevo\)/.test(sesion) && /api\.me\(token, TIEMPO_ME_FONDO_MS\)/.test(entre(sesion, 'const completarPersona = useCallback(', 'const entrar = useCallback('))
    )

    const api = leer('mobile/lib/api.ts')
    const funcion = (nombre: string) => entre(api, `export async function ${nombre}(`, '\n}\n')
    check(
      'lib/api.ts: cerrarCita, eliminarCita, otraFechaCita y cancelarCita (con el código del motivo), cada una a su ruta, e invalidan el contexto después del 2xx',
      /\/api\/me\/agenda\/\$\{encodeURIComponent\(id\)\}\/cerrar`/.test(funcion('cerrarCita')) &&
        /\/api\/me\/agenda\/\$\{encodeURIComponent\(id\)\}\/eliminar`/.test(funcion('eliminarCita')) &&
        /\/api\/me\/agenda\/\$\{encodeURIComponent\(id\)\}\/otra-fecha`/.test(funcion('otraFechaCita')) &&
        /cuerpo: cuerpoMotivo\(motivo\.motivo_codigo, motivo\.motivo\)/.test(funcion('cancelarCita')) &&
        ['cancelarCita', 'cerrarCita', 'eliminarCita', 'otraFechaCita'].every(nombre => funcion(nombre).indexOf("invalidarContexto('cita')") > funcion(nombre).indexOf('await peticion'))
    )
  }

  // -------------------------------------------------------------------------
  t.seccion('21h. Textos que ya no van y sin tope hacia adelante')
  {
    const raizMovil = path.resolve(RAIZ_REPO, 'mobile')
    const archivos = (dir: string): string[] => {
      const lista: string[] = []
      for (const nombre of readdirSync(dir)) {
        const ruta = path.join(dir, nombre)
        if (statSync(ruta).isDirectory()) lista.push(...archivos(ruta))
        else if (/\.tsx?$/.test(nombre)) lista.push(ruta)
      }
      return lista
    }
    const deApp = archivos(path.join(raizMovil, 'app'))
    const prohibidos = ['Reportar visita', 'Visitas de hoy', 'Tipo de visita', 'Reprogramar']
    const conProhibidos = deApp.flatMap(ruta => prohibidos.filter(texto => readFileSync(ruta, 'utf8').includes(texto)).map(texto => `${path.relative(raizMovil, ruta)}: ${texto}`))
    check(`ningún archivo de mobile/app (${deApp.length}) contiene "Reportar visita", "Visitas de hoy", "Tipo de visita" ni "Reprogramar"`, deApp.length > 5 && conProhibidos.length === 0, conProhibidos)
    const deLib = archivos(path.join(raizMovil, 'lib'))
    const conTope = deLib.filter(ruta => /\bDIAS_AGENDA_ADELANTE\b|\bventanaCita\b|MENSAJE_CITA_LEJANA/.test(readFileSync(ruta, 'utf8')))
    check('sin tope hacia adelante: ningún archivo de mobile/lib tiene DIAS_AGENDA_ADELANTE, ventanaCita ni MENSAJE_CITA_LEJANA', conTope.length === 0, conTope.map(ruta => path.relative(raizMovil, ruta)))
  }
}
