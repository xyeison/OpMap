/**
 * Carga ÚNICA del histórico del Excel "Tracker Líderes" en lideres_historico (dueño, 2026-10-30): las líderes planean
 * y reportan en la app, y el histórico del Excel entra una sola vez con este script. Hasta el 2026-10-30 la directora
 * lo subía en /lideres ("Subir el Excel"); eso se quitó. Qué se guarda y qué no:
 * docs/decisiones/2026-10-29-historico-tracker-lideres.md.
 *
 * Hace lo mismo que hacía la página:
 *   - lee la hoja REGISTRO (o la única hoja del libro) con xlsx, desde la fila 1 de la hoja, con leerTracker de
 *     lib/lideres-historico.ts;
 *   - corte = hoy en Bogotá (decide planificada o sin cerrar), huella = sha256 del archivo, archivo = su nombre;
 *   - manda el mismo cuerpo { archivo, huella, corte, filas, confirmar } a procesarCargaTracker
 *     (app/api/lideres/_lib/historico-server.ts), la función que atendía el POST de /api/lideres/historico.
 * Y, como exigía ese POST, quien carga (--user) debe ser un usuario activo con el permiso lideres:seguimiento
 * (administrador o dirección comercial).
 *
 * Uso (desde web/):
 *   npx tsx scripts/lideres-historico-cargar.ts <ruta-del-excel> --user <uuid-de-quien-carga>
 *        → vista previa (confirmar: false): filas, estados, cada líder con su usuario y aviso, ciudades sin código y
 *          fechas ilegibles. Solo lee la base (users y municipalities). Termina con "Nada guardado".
 *   npx tsx scripts/lideres-historico-cargar.ts <ruta-del-excel> --user <uuid-de-quien-carga> --run
 *        → confirmar: true: REEMPLAZA el histórico completo con lideres_historico_reemplazar (0920), y la carga queda en
 *          lideres_historico_cargas a nombre de --user. Se rechaza si alguna líder del Excel no está en OpMap.
 *
 * Privacidad: nunca imprime filas del Excel, nombres de médicos ni observaciones (leerTracker los descarta en la
 * lectura). Imprime solo conteos, el nombre de cada líder como está en el Excel con su usuario de OpMap y las ciudades
 * sin código. Variables de web/.env.local (cliente service_role de lib/supabase-admin.ts); no las imprime. Costo
 * Google: 0. No recalcula asignaciones. Pruebas puras (argumentos, lectura del Excel, quién carga y lo que imprime):
 * scripts/lideres-historico-check.ts.
 */
import { createHash } from 'crypto'
import fs from 'fs'
import path from 'path'
import * as XLSX from 'xlsx'
import type { VistaPreviaTracker } from '../app/api/lideres/_lib/historico-server'
import { isUuid } from '../app/api/_lib/api-error'
import { HOJA_TRACKER, leerTracker, type FilaTracker } from '../lib/lideres-historico'
import { getRoleTitle, hasPermission, type Role } from '../lib/permissions'
import { hoyBogota } from '../lib/visits-rules'

export const USO = 'Uso (desde web/): npx tsx scripts/lideres-historico-cargar.ts <ruta-del-excel> --user <uuid-de-quien-carga> [--run]'

// ---------------------------------------------------------------------------
// Argumentos
// ---------------------------------------------------------------------------

export interface ArgumentosCarga {
  /** Ruta del Excel "Tracker Líderes". */
  archivo: string
  /** users.id de quien carga (queda en lideres_historico_cargas.importado_por), en minúsculas. */
  user: string
  /** false: solo la vista previa; true: reemplaza el histórico. */
  run: boolean
}

export function leerArgumentos(argv: string[]): ArgumentosCarga {
  let archivo: string | null = null
  let user: string | null = null
  let run = false
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--run') run = true
    else if (arg === '--user' || arg.startsWith('--user=')) {
      const valor = arg === '--user' ? argv[++i] : arg.slice('--user='.length)
      if (!valor || valor.startsWith('-')) throw new Error(`Falta el uuid de --user. ${USO}`)
      user = valor
    } else if (arg.startsWith('-')) throw new Error(`Argumento desconocido: ${arg}. ${USO}`)
    else if (archivo === null) archivo = arg
    else throw new Error(`Sobra "${arg}": va una sola ruta del Excel. ${USO}`)
  }
  if (!archivo) throw new Error(`Falta la ruta del Excel. ${USO}`)
  if (!user) throw new Error(`Falta --user <uuid-de-quien-carga>. ${USO}`)
  if (!isUuid(user)) throw new Error(`--user debe ser el uuid (users.id) de quien carga; "${user}" no lo es.`)
  return { archivo, user: user.toLowerCase(), run }
}

// ---------------------------------------------------------------------------
// El Excel, como lo leía /lideres
// ---------------------------------------------------------------------------

/** Lo que el script saca del Excel: lo mismo que la página tenía antes de mandarlo. */
export interface LecturaCarga {
  /** Nombre del archivo sin la carpeta (como File.name en el navegador). */
  archivo: string
  /** sha256 del archivo, en hexadecimal. */
  huella: string
  /** AAAA-MM-DD: el día de la carga. */
  corte: string
  filas: FilaTracker[]
  /** Filas con algo escrito pero sin líder (no se guardan). */
  sinLider: number
  /** Filas con un estado que no es "Exitosa", "Cancelada" ni vacío. */
  estadosNoReconocidos: number
}

/**
 * La hoja REGISTRO (o la única del libro), desde la fila 1 de la hoja aunque el rango guardado empiece más abajo
 * (range: 0: los números de fila cuadran), leída con leerTracker y el corte. Ningún texto libre sale de aquí.
 */
export function leerExcelTracker(bytes: Uint8Array, nombre: string, corte: string): { ok: true; lectura: LecturaCarga } | { ok: false; error: string } {
  const libro = XLSX.read(bytes, { type: 'buffer' })
  const hoja = libro.Sheets[HOJA_TRACKER] ?? (libro.SheetNames.length === 1 ? libro.Sheets[libro.SheetNames[0]] : undefined)
  if (!hoja) return { ok: false, error: 'El archivo no tiene la hoja REGISTRO del Tracker de líderes.' }
  const filas = XLSX.utils.sheet_to_json<unknown[]>(hoja, { header: 1, raw: true, defval: '', blankrows: true, range: 0 })
  const leida = leerTracker(filas, corte)
  if (!leida.ok) return leida
  return { ok: true, lectura: { archivo: nombre, huella: createHash('sha256').update(bytes).digest('hex'), corte, ...leida.lectura } }
}

/** El cuerpo que la página mandaba a POST /api/lideres/historico; ahora va a procesarCargaTracker. */
export function cuerpoDeCarga(lectura: LecturaCarga, confirmar: boolean) {
  return { archivo: lectura.archivo, huella: lectura.huella, corte: lectura.corte, filas: lectura.filas, confirmar }
}

// ---------------------------------------------------------------------------
// Quién carga
// ---------------------------------------------------------------------------

export interface UsuarioQueCarga {
  id: string
  full_name: string
  role: string
  active: boolean | null
}

/**
 * Por qué --user no puede quedar como quien carga (null si puede): debe existir, estar activo (sin dato cuenta como
 * activo, igual que en lideres_historico_reemplazar) y tener lideres:seguimiento, como pedía el POST.
 */
export function problemaDeQuienCarga(usuario: UsuarioQueCarga | null): string | null {
  if (!usuario) return 'No hay un usuario de OpMap con ese uuid (--user).'
  if (usuario.active === false) return `${usuario.full_name} está inactivo: la carga debe quedar a nombre de un usuario activo.`
  if (!hasPermission(usuario.role as Role, 'lideres:seguimiento')) {
    return `${usuario.full_name} (${getRoleTitle(usuario.role as Role)}) no tiene el permiso lideres:seguimiento: carga el administrador o la dirección comercial.`
  }
  return null
}

// ---------------------------------------------------------------------------
// Lo que se imprime (solo conteos, líderes con su usuario y ciudades sin código)
// ---------------------------------------------------------------------------

/** Lo que responde procesarCargaTracker (lo mismo que respondía el POST). */
export interface RespuestaCarga {
  error?: string
  vistaPrevia?: VistaPreviaTracker
  guardado?: { carga_id?: string; filas?: number }
}

const n = (valor: number) => valor.toLocaleString('es-CO')

function lineasVistaPrevia(lectura: LecturaCarga, vista: VistaPreviaTracker): string[] {
  const lineas = [
    `Vista previa: ${n(vista.filas)} actividades (${n(vista.porEstado.realizada)} realizadas, ${n(vista.porEstado.cancelada)} canceladas, ${n(vista.porEstado.sin_cerrar)} sin cerrar y ${n(vista.porEstado.planificada)} planificadas).`,
    `  Filas sin líder (no se guardan): ${n(lectura.sinLider)}.`,
    `  Con un estado que no es "Exitosa" ni "Cancelada" (cuentan como sin cerrar, o planificadas si son del corte en adelante): ${n(lectura.estadosNoReconocidos)}.`,
    `  Fechas ilegibles (se guardan sin fecha, solo con sus dígitos y separadores): ${n(vista.fechasIlegibles)}.`,
    '',
    'Líderes (como están en el Excel → su usuario de OpMap):',
    ...vista.lideres.map(item => {
      const usuario = item.user_id ? `${item.nombre ?? '(sin nombre)'} (${item.user_id})` : 'NO ESTÁ EN OPMAP'
      return `  "${item.lider_texto}" → ${usuario} · ${n(item.filas)} ${item.filas === 1 ? 'fila' : 'filas'}${item.aviso ? ` · aviso: ${item.aviso}` : ''}`
    }),
    '',
  ]
  if (vista.ciudadesSinCodigo.length === 0) lineas.push('Ciudades sin código DANE: ninguna.')
  else {
    lineas.push('Ciudades que no son un municipio de Colombia (se guardan con su texto):')
    for (const item of vista.ciudadesSinCodigo) lineas.push(`  ${item.ciudad_texto || '(vacía)'}: ${n(item.filas)}`)
  }
  return lineas
}

/** Todo lo que se imprime con la respuesta de procesarCargaTracker: la vista previa y el resultado. */
export function lineasResultado(lectura: LecturaCarga, status: number, cuerpo: RespuestaCarga, run: boolean): string[] {
  const lineas = cuerpo.vistaPrevia ? lineasVistaPrevia(lectura, cuerpo.vistaPrevia) : []
  if (status !== 200) return [...lineas, '', `Error ${status}: ${cuerpo.error ?? 'sin detalle'}`, 'Nada guardado.']
  if (run) {
    return [...lineas, '', `Guardado: ${n(cuerpo.guardado?.filas ?? 0)} actividades (carga ${cuerpo.guardado?.carga_id ?? '?'}). El histórico anterior se reemplazó.`]
  }
  const sinUsuario = (cuerpo.vistaPrevia?.lideres ?? []).filter(item => !item.user_id).length
  return [
    ...lineas,
    '',
    sinUsuario > 0
      ? `Con --run se rechazaría: ${sinUsuario === 1 ? 'una líder no está' : `${n(sinUsuario)} líderes no están`} en OpMap (su nombre en el Excel debe ser el de su usuario).`
      : 'Para reemplazar el histórico con este archivo, repite el comando con --run.',
    'Nada guardado.',
  ]
}

// ---------------------------------------------------------------------------
// Programa
// ---------------------------------------------------------------------------

async function main() {
  const args = leerArgumentos(process.argv.slice(2))
  const ruta = path.resolve(args.archivo)
  const leida = leerExcelTracker(fs.readFileSync(ruta), path.basename(ruta), hoyBogota())
  if (!leida.ok) throw new Error(leida.error)
  const { lectura } = leida

  // Variables de web/.env.local, como los otros scripts con Supabase real
  const dotenv = await import('dotenv')
  dotenv.config({ path: path.resolve(__dirname, '..', '.env.local'), quiet: true })
  const { supabaseAdmin } = await import('../lib/supabase-admin')
  const { procesarCargaTracker } = await import('../app/api/lideres/_lib/historico-server')

  const { data: usuario, error } = await supabaseAdmin.from('users').select('id, full_name, role, active').eq('id', args.user).maybeSingle<UsuarioQueCarga>()
  if (error) throw new Error(`No se pudo leer el usuario de --user: ${error.message}`)
  const problema = problemaDeQuienCarga(usuario)
  if (problema !== null || !usuario) throw new Error(problema ?? 'No hay un usuario de OpMap con ese uuid (--user).')

  console.log(`Archivo: ${lectura.archivo} (sha256 ${lectura.huella})`)
  console.log(`Corte: ${lectura.corte} (hoy en Bogotá: lo que no tiene resultado queda planificado si es de este día en adelante; si no, sin cerrar)`)
  console.log(`Quién carga: ${usuario.full_name} (${getRoleTitle(usuario.role as Role)})`)
  console.log(args.run ? 'Modo: --run (reemplaza el histórico completo)' : 'Modo: vista previa (no escribe)')
  console.log('')

  const respuesta = await procesarCargaTracker(cuerpoDeCarga(lectura, args.run), args.user)
  const cuerpo = (await respuesta.json()) as RespuestaCarga
  for (const linea of lineasResultado(lectura, respuesta.status, cuerpo, args.run)) console.log(linea)
  if (respuesta.status !== 200) process.exitCode = 1
}

// Solo corre al llamar el archivo directamente (scripts/lideres-historico-check.ts importa las piezas puras)
if (/lideres-historico-cargar\.[cm]?[jt]s$/.test(process.argv[1] ?? '')) {
  main().catch(error => {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  })
}
