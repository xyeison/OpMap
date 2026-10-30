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
 *   - Correcciones de la revisión de F1b (2026-10-30): un servidor sin F1a (/api/auth/me sin `persona`) no ofrece el
 *     ciclo de vida y cancela con solo `{ motivo }`; otra fecha va con el papel de hoy; "Cuenta para" solo con cuota;
 *     como líder solo médicos de sus líneas (también del buscador); "Como Ejecutivo Comercial"; los cuerpos de la app
 *     son EXACTAMENTE los que la web prueba (CUERPO_*_APP); el rótulo de la cuota de Paola; "¿Qué pasó con esto?" sin
 *     botones dentro de un botón; el choque en el pie con su propio texto.
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
  cuerpoCancelar,
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
import { cuerpoCitaConHora, cuerpoOtraFecha, errorChoque, textosPieAgendar, validarCitaConHora } from '../../lib/agenda'
import { tieneClaves } from '../../lib/claves-api'
import { MAX_POR_CERRAR_VISIBLES, porCerrar } from '../../lib/pantallas'
import {
  ETIQUETA_COMO,
  MENSAJE_DIRECCION_EN_LA_WEB,
  MENSAJE_SIN_LINEAS,
  TEXTO_APP_DE_LIDERES,
  avisoFuera,
  comoPorDefecto,
  conCicloDeVida,
  eligeComo,
  entraALasPestanas,
  estadoPersona,
  lineasDeBusqueda,
  medicoDelPapel,
  medicosDelPapel,
  muestraDiasLibres,
  papelDeAgenda,
  papelesDePersona,
  perfilDelPapel,
  personaDeMe,
  rotuloCuota,
  servidorDeMe,
  tieneCuota,
} from '../../lib/persona'
import { PESTANAS } from '../../lib/navegacion'
import { formularioCitaVacio } from '../../lib/propuesta'
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
    const EN_VMO = 'Las visitas de los Ejecutivos Comerciales se registran en VMO'
    check(
      'app solo para líderes (2026-10-30): sin persona y con el porqué del servidor (sin_persona) → fuera: no entra; sin señal o sin el porqué, como antes',
      estadoPersona({ role: 'sales_manager', persona: null, sinPersona: EN_VMO }) === 'fuera' &&
        estadoPersona({ role: 'admin', persona: null, sinPersona: MENSAJE_SIN_LINEAS }) === 'fuera' &&
        !entraALasPestanas('fuera') &&
        estadoPersona({ role: 'sales_manager', persona: null, sinPersona: EN_VMO, sinConfirmar: true }) === 'sin_saber' &&
        estadoPersona({ role: 'sales_manager', persona: null, sinPersona: '  ' }) === 'sin_lineas' &&
        estadoPersona({ role: 'sales_manager', persona: null, sinPersona: null }) === 'sin_lineas' &&
        estadoPersona({ role: 'line_leader', persona: LUCIA, sinPersona: EN_VMO }) === 'campo' &&
        estadoPersona({ role: 'commercial_director', persona: null, sinPersona: EN_VMO }) === 'direccion'
    )
    check(
      'avisoFuera: la dirección ve el mensaje de la web; quien queda fuera, el porqué del servidor (o "sin líneas"); los dos con para quién es la app',
      JSON.stringify(avisoFuera('direccion', null)) === JSON.stringify({ titulo: MENSAJE_DIRECCION_EN_LA_WEB, texto: TEXTO_APP_DE_LIDERES }) &&
        JSON.stringify(avisoFuera('fuera', EN_VMO)) === JSON.stringify({ titulo: EN_VMO, texto: TEXTO_APP_DE_LIDERES }) &&
        avisoFuera('fuera', null).titulo === MENSAJE_SIN_LINEAS &&
        TEXTO_APP_DE_LIDERES === 'La app es para las líderes de negocio: agendan y reportan en campo.'
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
    check('"Como Ejecutivo Comercial" / "Como líder" solo para quien tiene los dos papeles (C12)', eligeComo(PAOLA) && !eligeComo(LUCIA) && !eligeComo(CARMEN) && !eligeComo(null))
    check('"como qué" por defecto (C12): como Ejecutivo Comercial si lo tiene; la líder, como líder', comoPorDefecto(PAOLA) === 'ejecutivo' && comoPorDefecto(CARMEN) === 'ejecutivo' && comoPorDefecto(LUCIA) === 'lider')
    check(
      "las etiquetas de \"como qué\": 'Como Ejecutivo Comercial' y 'Como líder' (\"Ejecutivo Comercial\" siempre así: regla del dueño del 2026-10-29)",
      ETIQUETA_COMO.ejecutivo === 'Como Ejecutivo Comercial' && ETIQUETA_COMO.lider === 'Como líder' && !Object.values(ETIQUETA_COMO).some(texto => texto.includes('Ejecutiva'))
    )
    check(
      'papelDeAgenda: el elegido; si no elige, el suyo (la líder sin Ejecutivo Comercial, como líder); sin la persona, como Ejecutivo Comercial',
      papelDeAgenda(PAOLA, 'lider') === 'lider' && papelDeAgenda(PAOLA, null) === 'ejecutivo' && papelDeAgenda(LUCIA, null) === 'lider' && papelDeAgenda(CARMEN, undefined) === 'ejecutivo' && papelDeAgenda(null, null) === 'ejecutivo'
    )
    check(
      'servidorDeMe: /api/auth/me con la clave persona (también null) → con_f1a; sin ella → sin_f1a. conCicloDeVida: solo sin_f1a lo apaga; sin saber, queda como está',
      servidorDeMe({ persona: LUCIA }) === 'con_f1a' &&
        servidorDeMe({ persona: null }) === 'con_f1a' &&
        servidorDeMe({}) === 'sin_f1a' &&
        conCicloDeVida('con_f1a') &&
        !conCicloDeVida('sin_f1a') &&
        conCicloDeVida(undefined) &&
        conCicloDeVida(null)
    )
    check(
      'rotuloCuota (Números de Paola): "Como Ejecutivo Comercial · Sustitutos óseos"; con un solo papel o sin la persona, null',
      rotuloCuota(PAOLA) === 'Como Ejecutivo Comercial · Sustitutos óseos' && rotuloCuota(CARMEN) === null && rotuloCuota(LUCIA) === null && rotuloCuota(undefined) === null,
      rotuloCuota(PAOLA)
    )
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
    const medicos: { id: string; lineas: string[] | null }[] = [
      { id: 'm-tra', lineas: [L_TRA] },
      { id: 'm-sus', lineas: [L_SUS] },
      { id: 'm-dos', lineas: [L_SUS, L_TRA] },
      { id: 'm-dep', lineas: [L_DEP] },
      { id: 'm-sin', lineas: null },
    ]
    const ids = (lista: readonly { id: string }[]) => lista.map(m => m.id).join()
    check(
      'medicosDelPapel (C9): como líder solo los de sus líneas de líder —Paola al elegirlo (Trauma) y la líder sin Ejecutivo Comercial sin elegir nada (deportiva)—; sin saber sus líneas (null), se ofrece; como Ejecutivo Comercial o sin la persona, todos',
      ids(medicosDelPapel(medicos, PAOLA, 'lider')) === 'm-tra,m-dos,m-sin' &&
        ids(medicosDelPapel(medicos, PAOLA, 'ejecutivo')) === 'm-tra,m-sus,m-dos,m-dep,m-sin' &&
        ids(medicosDelPapel(medicos, LUCIA, null)) === 'm-dep,m-sin' &&
        ids(medicosDelPapel(medicos, CARMEN, null)) === 'm-tra,m-sus,m-dos,m-dep,m-sin' &&
        ids(medicosDelPapel(medicos, undefined, 'lider')) === 'm-tra,m-sus,m-dos,m-dep,m-sin',
      { paolaLider: ids(medicosDelPapel(medicos, PAOLA, 'lider')), lucia: ids(medicosDelPapel(medicos, LUCIA, null)) }
    )
    check(
      'lineasDeBusqueda (lo que trae el buscador): las líneas de sus visitantes vigentes, sin los terminados ni repetidas; sin los visitantes, o con uno vigente sin su línea, null (no se sabe)',
      JSON.stringify(lineasDeBusqueda({ visitantes: [{ line_id: L_TRA, hasta: null }, { line_id: L_TRA }, { line_id: L_SUS, hasta: '2026-10-01' }, { line_id: L_DEP, hasta: '2026-10-20' }] }, HOY)) === JSON.stringify([L_TRA, L_DEP]) &&
        lineasDeBusqueda({}, HOY) === null &&
        lineasDeBusqueda({ visitantes: [{ hasta: null }] }, HOY) === null &&
        JSON.stringify(lineasDeBusqueda({ visitantes: [] }, HOY)) === '[]'
    )
    check(
      'medicoDelPapel con lo del buscador: la líder no ve a uno de otra línea ni a uno sin visitantes vigentes; sí a uno de su línea y a uno sin el dato (null: lo rechazaría el servidor); como Ejecutivo Comercial, sí',
      !medicoDelPapel([L_SUS], LUCIA, null) && !medicoDelPapel([], LUCIA, null) && medicoDelPapel([L_DEP], LUCIA, null) && medicoDelPapel(null, LUCIA, null) && medicoDelPapel([L_SUS], PAOLA, 'ejecutivo') && !medicoDelPapel([L_SUS], PAOLA, 'lider')
    )
    check(
      'perfilDelPapel: como líder rige la configuración general (médica e institucional); si no, el perfil del contexto',
      perfilDelPapel(['medica'], PAOLA, 'lider').join() === 'medica,institucional' && perfilDelPapel(['medica'], PAOLA, 'ejecutivo').join() === 'medica' && perfilDelPapel(['institucional'], CARMEN, null).join() === 'institucional'
    )
    const web = leer('web/lib/persona-campo.ts')
    check('MENSAJE_SIN_LINEAS es el mismo texto del servidor (web/lib/persona-campo.ts)', web.includes(`export const MENSAJE_SIN_LINEAS = '${MENSAJE_SIN_LINEAS}'`))
    check('el mensaje de la dirección comercial: "La dirección comercial sigue a su equipo en la web" (sin "(Equipo)", que aún no existe)', MENSAJE_DIRECCION_EN_LA_WEB === 'La dirección comercial sigue a su equipo en la web')
    check(
      'el porqué de quien solo es Ejecutivo Comercial es el mismo texto del servidor (MENSAJE_EJECUTIVO_EN_VMO de web/lib/persona-campo.ts)',
      web.includes(`export const MENSAJE_EJECUTIVO_EN_VMO = '${EN_VMO}'`)
    )
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

    // El pie de Agendar (captura del 2026-10-30: tras tocar Agendar salía "Falta algo: A las 08:30 ya tienes cita con…").
    const deManana = [cita({ fecha: MANANA, hora: '08:30', medico: { id: 'm-x', nombre: 'Dra. X' } })]
    const formulario = { ...formularioCitaVacio(MANANA, ['medica']), hora: '08:45', medico_id: 'm-otro', sede_id: 'sede-1' }
    const choque = errorChoque(formulario, deManana)
    const errores = validarCitaConHora(formulario, HOY, ['medica'], { citas: deManana, ahora: A_LAS_10_42 })
    const pieTras = textosPieAgendar({ errorServidor: null, intentado: true, errores, repetida: null, choque })
    check(
      'el pie de Agendar, tras tocar: el choque con su propio texto ("A las 08:30 ya tienes cita con Dra. X: elige otra hora"), sin "Falta algo:" ni repetido',
      choque !== null && errores.length === 1 && JSON.stringify(pieTras) === JSON.stringify([mensajeChoque('08:30', 'Dra. X')]) && !pieTras.some(texto => texto.startsWith('Falta algo')),
      { errores, pieTras }
    )
    const faltaMedico = { campo: 'medico_id', mensaje: 'Elige el médico' }
    const repetida = { campo: 'medico_id', mensaje: 'Ya tienes una cita con ese médico ese día (a las 08:30): elige otro día o cancela esa cita en Mi agenda' }
    check(
      'el pie: lo que falta como "Falta algo: …" y el choque aparte; antes de tocar, ya el choque; la repetida tapa el choque; el rechazo del servidor va solo',
      JSON.stringify(textosPieAgendar({ errorServidor: null, intentado: true, errores: [faltaMedico, choque as { campo: string; mensaje: string }], repetida: null, choque })) === JSON.stringify(['Falta algo: Elige el médico', mensajeChoque('08:30', 'Dra. X')]) &&
        JSON.stringify(textosPieAgendar({ errorServidor: null, intentado: false, errores: [faltaMedico], repetida: null, choque })) === JSON.stringify([mensajeChoque('08:30', 'Dra. X')]) &&
        JSON.stringify(textosPieAgendar({ errorServidor: null, intentado: true, errores: [repetida], repetida, choque })) === JSON.stringify([repetida.mensaje]) &&
        JSON.stringify(textosPieAgendar({ errorServidor: 'Esa hora ya pasó', intentado: true, errores: [faltaMedico], repetida: null, choque })) === JSON.stringify(['No se agendó: Esa hora ya pasó']) &&
        textosPieAgendar({ errorServidor: null, intentado: false, errores: [faltaMedico], repetida: null, choque: null }).length === 0
    )
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
      'cuerpoCancelar: con F1a, el de cuerpoMotivo; con un servidor sin F1a, solo { motivo } con lo escrito o, sin escribir, la etiqueta del motivo elegido (sin motivo_codigo)',
      JSON.stringify(cuerpoCancelar('otro', ' Se cerró   la vía ', true)) === JSON.stringify({ motivo_codigo: 'otro', motivo: 'Se cerró la vía' }) &&
        JSON.stringify(cuerpoCancelar('otro', ' Se cerró   la vía ', false)) === JSON.stringify({ motivo: 'Se cerró la vía' }) &&
        JSON.stringify(cuerpoCancelar('fuerza_mayor', '', false)) === JSON.stringify({ motivo: 'Salud, clima o vía' }) &&
        !('motivo_codigo' in cuerpoCancelar('cliente', null, false))
    )
    // Los cuerpos TAL CUAL los manda la app: web/scripts/reporte-api-check.ts los pasa por el esquema del servidor y los
    // manda con POST (sección 15). Aquí se arman con las funciones de la app y se exige ese mismo texto en la web.
    const webApi = leer('web/scripts/reporte-api-check.ts')
    const literal = (cuerpo: object) =>
      `{ ${Object.entries(cuerpo).map(([clave, valor]) => `${clave}: ${valor === null ? 'null' : typeof valor === 'string' ? `'${valor}'` : String(valor)}`).join(', ')} }`
    const origen = cita({ id: 'origen', fecha: AYER, estado: 'no_realizada', motivo_codigo: 'cliente' })
    const formOtra = { ...formularioCitaVacio('2026-10-26', ['medica']), hora: '9:00', medico_id: 'm-1', sede_id: origen.sede.id, nota: '   ' }
    const cuerpos: Record<string, object> = {
      CUERPO_CITA_APP: cuerpoCitaConHora({ ...formularioCitaVacio('2026-10-23', ['medica']), hora: '10:00', medico_id: 'f1f1f1f1-0000-4000-8000-000000000001', sede_id: 'dddddddd-0000-4000-8000-000000000001' }),
      CUERPO_MOTIVO_APP: cuerpoMotivo('cliente', null),
      CUERPO_CANCELAR_SIN_F1A: cuerpoCancelar('cliente', null, false),
      CUERPO_OTRA_FECHA_APP: cuerpoOtraFecha(formOtra, origen),
    }
    const sinFijar = Object.entries(cuerpos).filter(([nombre, cuerpo]) => !webApi.includes(`const ${nombre} = ${literal(cuerpo)}\n`))
    check(
      'los cuerpos que manda la app (cuerpoCitaConHora, cuerpoMotivo, cuerpoCancelar sin F1a, cuerpoOtraFecha sin persona) son EXACTAMENTE los CUERPO_*_APP que la web pasa por su esquema y manda con POST',
      sinFijar.length === 0,
      sinFijar.map(([nombre, cuerpo]) => `${nombre} = ${literal(cuerpo)}`)
    )
    check(
      'exactos: el motivo { motivo_codigo: \'cliente\', motivo: null } (cancelar y "no se hizo") y otra fecha { fecha, hora, sede_id: null, nota: null, como: null }',
      literal(cuerpos.CUERPO_MOTIVO_APP) === "{ motivo_codigo: 'cliente', motivo: null }" &&
        literal(cuerpos.CUERPO_OTRA_FECHA_APP) === "{ fecha: '2026-10-26', hora: '09:00', sede_id: null, nota: null, como: null }",
      [literal(cuerpos.CUERPO_MOTIVO_APP), literal(cuerpos.CUERPO_OTRA_FECHA_APP)]
    )
    // La cita cancelada con "Dejó de ser Ejecutivo Comercial" (0850: motivo 'otro', quien sigue como líder) admite otra
    // fecha; sin "como", el servidor tomaría el papel de la anterior (Ejecutivo Comercial) y la rechazaría.
    const dejoDeSer = cita({ estado: 'cancelada', fecha: MANANA, motivo_codigo: 'otro', como: 'ejecutivo' })
    check(
      'otra fecha con el papel de hoy: la cancelada por "Dejó de ser Ejecutivo Comercial" la admite y, sin elegir papel, va "como" su papel (la que ya solo es líder, lider); el elegido manda; sin la persona, null',
      accionesDeCita(dejoDeSer, HOY).otraFecha &&
        cuerpoOtraFecha(formOtra, dejoDeSer, LUCIA).como === 'lider' &&
        cuerpoOtraFecha(formOtra, dejoDeSer, CARMEN).como === 'ejecutivo' &&
        cuerpoOtraFecha({ ...formOtra, como: 'lider' }, dejoDeSer, PAOLA).como === 'lider' &&
        cuerpoOtraFecha(formOtra, dejoDeSer, null).como === null &&
        cuerpoOtraFecha(formOtra, dejoDeSer).como === null
    )
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
    check(
      'Hoy con un servidor sin F1a (conCicloDeVida del perfil): ni "¿Qué pasó con esto?" ni la consulta de los días anteriores, y nada queda aparte',
      /const ciclo = conCicloDeVida\(perfil\?\.servidor\)/.test(hoy) &&
        /const pedidoAnteriores = sesion\.current\.ciclo\s*\? api\.agenda\(/.test(hoy) &&
        /: Promise\.resolve\(\)/.test(entre(hoy, 'const pedidoAnteriores = ', 'pedirUbicacionEnDosPasos')) &&
        /const sinResultado = ciclo \? porCerrar\(/.test(hoy) &&
        /\{ciclo \? \(\s*<QuePasoConEsto\s/.test(hoy)
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
    const filaQuePaso = quePaso.slice(quePaso.indexOf('<FilaCita'), quePaso.indexOf('</FilaCita>'))
    check(
      '"¿Qué pasó con esto?": la fila NO se toca (sin alPresionar: un botón dentro de otro botón no lo lee VoiceOver); Reportar es su botón',
      filaQuePaso.length > 0 && !/<FilaCita\b[^>]*\balPresionar=/.test(filaQuePaso) && !/alPresionar=\{acciones\.reportar/.test(quePaso) && /<Boton titulo="Reportar"[^>]*alPresionar=\{\(\) => alReportar\(cita\)\}/.test(filaQuePaso),
      filaQuePaso.slice(0, 300)
    )
    const formulario = leer('mobile/components/agenda/FormularioMotivo.tsx')
    check('el motivo: los de la lista (MOTIVOS_ELEGIBLES, sin "salida") y revisarMotivo antes de enviar', /MOTIVOS_ELEGIBLES\.map/.test(formulario) && /revisarMotivo\(codigo, texto, uso\)/.test(formulario) && !/'salida'/.test(formulario))

    const layout = leer('mobile/app/(app)/_layout.tsx')
    check(
      'la dirección comercial y quien el servidor dejó fuera (sin_persona) ven su aviso y no entran a las pestañas (antes de dibujar las Tabs)',
      /const quien = estadoPersona\(\{ role: perfil\?\.usuario\.role, persona: perfil\?\.persona, sinPersona: perfil\?\.sinPersona, sinConfirmar \}\)/.test(layout) &&
        /if \(!entraALasPestanas\(quien\)\) return <FueraDeLaApp \{\.\.\.avisoFuera\(quien, perfil\?\.sinPersona\)\} \/>/.test(layout) &&
        layout.indexOf('return <FueraDeLaApp') < layout.indexOf('<Tabs') &&
        /<Aviso tono="info" titulo=\{titulo\}>/.test(layout) &&
        /titulo="Cerrar sesión"/.test(layout)
    )
    check(
      'quien queda fuera puede "Volver a intentar" (refrescar: si ya le asignaron su línea, entra sin cerrar la app)',
      /titulo="Volver a intentar"[\s\S]{0,200}void refrescar\(\)/.test(entre(layout, 'function FueraDeLaApp(', 'export default function AppLayout('))
    )
    const hoySolo = leer('mobile/app/(app)/hoy.tsx')
    check(
      'Hoy: con contexto, la zona es la del contexto (null para una líder, también Paola); solo sin él, la del perfil',
      /const zona = contexto \? contexto\.ejecutiva\.zona : \(perfil\?\.ejecutiva\?\.zona \?\? null\)/.test(hoySolo)
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
    check(
      'Números de Paola: la cuota con su rótulo "Como Ejecutivo Comercial · <sus líneas>" (rotuloCuota de la persona de la sesión), una vez, antes de las tarjetas de la cuota',
      /const rotulo = rotuloCuota\(perfil\?\.persona\)/.test(numeros) &&
        /\{rotulo \? <Seccion titulo=\{rotulo\} \/> : null\}/.test(numeros) &&
        (numeros.match(/<Seccion titulo=\{rotulo\}/g) ?? []).length === 1 &&
        numeros.indexOf('<Seccion titulo={rotulo}') < numeros.indexOf('titulo="Visitas médicas"')
    )
    const visita = leer('mobile/app/(app)/visita/[id].tsx')
    check(
      'Detalle de la visita: "Cuenta para" (Suma a la meta…) solo con cuota (tieneCuota): una líder sin Ejecutivo Comercial no lo ve',
      /const conCuota = tieneCuota\(\{ persona: personaContexto \?\? perfil\?\.persona, ejecutiva: perfil\?\.ejecutiva \}\)/.test(visita) &&
        /\{conCuota \? \(\s*<Apilado etiqueta="Cuenta para">/.test(visita) &&
        (visita.match(/etiqueta="Cuenta para"/g) ?? []).length === 1
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
      /alNoSeHizo=\{ciclo \? motivo => noSeHizo\(citaAbierta, motivo\) : undefined\}/.test(agenda) &&
        /alEliminar=\{ciclo \? \(\) => eliminar\(citaAbierta\) : undefined\}/.test(agenda) &&
        /alOtraFecha=\{ciclo \? \(\) => otraFecha\(citaAbierta\) : undefined\}/.test(agenda) &&
        /alReportar=\{\(\) => reportar\(citaAbierta\)\}/.test(agenda) &&
        /api\.cerrarCita\(cita\.id, motivo\)/.test(agenda) &&
        /api\.eliminarCita\(cita\.id\)/.test(agenda) &&
        /fijarPedidoAgendar\(pedidoOtraFecha\(cita\)\)/.test(agenda) &&
        !sinComentarios(agenda).includes('30 días')
    )
    check(
      'Mi agenda con un servidor sin F1a (conCicloDeVida): sin "No se hizo", Eliminar ni "Agendar otra fecha" (sus rutas no existen), cancelar sin el código y sin preguntar si la visita fue efectiva',
      /const ciclo = conCicloDeVida\(perfil\?\.servidor\)/.test(agenda) &&
        /api\.cancelarCita\(cita\.id, motivo, ciclo\)/.test(agenda) &&
        /const visitaId = ciclo && citaAbierta\?\.estado === 'hecha'/.test(agenda) &&
        /alCancelar=\{motivo => cancelar\(citaAbierta, motivo\)\}/.test(agenda)
    )

    const nueva = leer('mobile/app/(app)/agenda/nueva.tsx')
    const nuevaVisible = sinComentarios(nueva)
    check(
      'Agendar: "¿Qué vas a hacer?" con "Visita a médico" y "Visita institucional" (ETIQUETA_ACTIVIDAD)',
      nueva.includes('<Subtitulo>¿Qué vas a hacer?</Subtitulo>') && /texto=\{ETIQUETA_ACTIVIDAD\[tipo\]\}/.test(nueva)
    )
    check(
      'Agendar: "Como Ejecutivo Comercial" / "Como líder" solo con eligeComo(persona) (rol lider_y_ejecutivo)',
      /\{eligeComo\(persona\) \? \(\s*<Grupo>\s*\{\(\['ejecutivo', 'lider'\] as ComoPersona\[\]\)\.map\(papel => \(\s*<Chip key=\{papel\} texto=\{ETIQUETA_COMO\[papel\]\}/.test(nueva)
    )
    check(
      'Agendar: otra fecha va a POST …/otra-fecha con cuerpoOtraFecha; lo demás, a POST /api/me/agenda',
      /origen \? await api\.otraFechaCita\(origen\.id, cuerpoOtraFecha\(formulario, origen, persona\)\) : await api\.agendar\(cuerpoCitaConHora\(formulario\)\)/.test(nueva)
    )
    const buscadorMedicos = entre(nueva, '<Buscador<MedicoPublico>', '/>')
    check(
      'Agendar como líder: la lista con medicosDelPapel y lo del buscador por papel; los resultados del buscador filtrados (delPapel) y buscados de nuevo al cambiar de papel (key)',
      /medicosDelPapel\(contexto\?\.mis_medicos \?\? \[\], persona, papel\)/.test(nueva) &&
        /buscados\.filter\(b => !propios\.some\(p => p\.id === b\.id\) && medicoDelPapel\(b\.lineas, persona, papel\)\)/.test(nueva) &&
        /lineas: lineasDeBusqueda\(item, hoy\)/.test(nueva) &&
        /buscar=\{async q => delPapel\(\(await api\.buscarMedicos\(q\)\)\.items\)\}/.test(buscadorMedicos) &&
        /key=\{comoLider \? 'lider' : 'ejecutivo'\}/.test(buscadorMedicos) &&
        /const comoLider = !!persona && papelDeAgenda\(persona, como\) === 'lider'/.test(nueva),
      buscadorMedicos.slice(0, 300)
    )
    const elegirComoTs = entre(nueva, 'const elegirComo = ', 'const elegirMedico = ')
    const agregarMedicoTs = entre(nueva, 'const agregarMedico = ', 'const ponerCuenta = ')
    check(
      'Agendar: al pasar a líder se quita el médico elegido si no se ofrece con ese papel (también uno del buscador); uno del buscador que no es del papel no se elige',
      /const sigue = !formulario\.medico_id \|\| ofrecidos\(nuevo\)\.some\(m => m\.id === formulario\.medico_id\)/.test(elegirComoTs) &&
        !/buscados\.some/.test(elegirComoTs) &&
        /if \(!idsPropios\.has\(nuevo\.id\) && !medicoDelPapel\(nuevo\.lineas, persona, como\)\) return/.test(agregarMedicoTs)
    )
    check('Agendar: sin "Mover" ni "Reprogramar"', !/Mover|Reprogramar/.test(nuevaVisible))

    const sesion = leer('mobile/lib/sesion.ts')
    check(
      'la sesión guarda la persona de /api/auth/me (personaDeMe) al confirmar y, después de entrar, la pide en segundo plano (completarPersona)',
      /persona: personaDeMe\(respuesta, guardado\?\.persona\)/.test(sesion) && /void completarPersona\(respuesta\.token, nuevo\)/.test(sesion) && /api\.me\(token, TIEMPO_ME_FONDO_MS\)/.test(entre(sesion, 'const completarPersona = useCallback(', 'const entrar = useCallback('))
    )
    check(
      'la sesión guarda el porqué sin persona de /api/auth/me (sin_persona) al confirmar y al completar la persona; al entrar, sin saberlo',
      /sinPersona: respuesta\.sin_persona \?\? null/.test(entre(sesion, 'const confirmar = useCallback(', 'catch (lanzado)')) &&
        /sinPersona: respuesta\.sin_persona \?\? null/.test(entre(sesion, 'const completarPersona = useCallback(', 'catch (lanzado)')) &&
        !/sinPersona/.test(entre(sesion, 'const entrar = useCallback(', 'void completarPersona('))
    )
    check(
      'la sesión guarda qué servidor respondió /api/auth/me (servidorDeMe) al confirmar y al completar la persona; al entrar, sin saberlo (queda como está)',
      /servidor: servidorDeMe\(respuesta\)/.test(entre(sesion, 'const confirmar = useCallback(', 'catch (lanzado)')) &&
        /servidor: servidorDeMe\(respuesta\)/.test(entre(sesion, 'const completarPersona = useCallback(', 'catch (lanzado)')) &&
        !/servidor/.test(entre(sesion, 'const entrar = useCallback(', 'void completarPersona('))
    )

    const api = leer('mobile/lib/api.ts')
    const funcion = (nombre: string) => entre(api, `export async function ${nombre}(`, '\n}\n')
    check(
      'lib/api.ts: cerrarCita, eliminarCita, otraFechaCita y cancelarCita (con el código del motivo), cada una a su ruta, e invalidan el contexto después del 2xx',
      /\/api\/me\/agenda\/\$\{encodeURIComponent\(id\)\}\/cerrar`/.test(funcion('cerrarCita')) &&
        /\/api\/me\/agenda\/\$\{encodeURIComponent\(id\)\}\/eliminar`/.test(funcion('eliminarCita')) &&
        /\/api\/me\/agenda\/\$\{encodeURIComponent\(id\)\}\/otra-fecha`/.test(funcion('otraFechaCita')) &&
        /cuerpo: cuerpoCancelar\(motivo\.motivo_codigo, motivo\.motivo, conCicloDeVida\)/.test(funcion('cancelarCita')) &&
        /export async function cancelarCita\(id: string, motivo: MotivoDeCierre, conCicloDeVida = true\)/.test(api) &&
        /cuerpo: cuerpoMotivo\(motivo\.motivo_codigo, motivo\.motivo\)/.test(funcion('cerrarCita')) &&
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
