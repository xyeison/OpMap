/**
 * Sección 18 de scripts/movil-check.ts (spec 2026-10-15-usabilidad-y-agenda-con-hora, paquete 4):
 * contexto en memoria (contextoReciente, invalidarContexto), rutaPatron y el registro de desarrollo, MemoriaToken,
 * arranqueDeSesion, las marcas [tiempos-app] y el perfil de audio.
 *
 * Corren en Node, sin React Native ni red (las que revisan un archivo de la app lo leen como texto). Este solo, desde
 * mobile/:
 *   npx tsx scripts/checks/correr.ts 18-tiempos
 */
import type { RecordingOptions } from 'expo-audio'
import { AJUSTES_AUDIO, opcionesGrabacion, perfilAudioDe } from '../../lib/audio-perfil'
import {
  DISTANCIA_REUSO_M,
  FRESCURA_DATOS_FIJOS_MS,
  FRESCURA_PINTAR_MS,
  FRESCURA_SIN_PEDIR_MS,
  contextoReciente,
  escucharInvalidacion,
  invalidarContexto,
  olvidarContextoEnMemoria,
  recordarContexto,
  versionContexto,
  type MotivoInvalidacion,
} from '../../lib/contexto-memoria'
import { lineaRegistroApi, rutaPatron } from '../../lib/http'
import { TIEMPO_ME_FONDO_MS, TIEMPO_ME_MS, arranqueDeSesion } from '../../lib/sesion-reglas'
import { MARCAS_REPORTE, MAX_RECORRIDO_MS, crearRegistroMarcas, marcar } from '../../lib/tiempos'
import { MemoriaToken, type LlaveroToken } from '../../lib/token'
import type { ContextoResponse } from '../../lib/tipos'
import { DISTANCIA_RECARGA_M } from '../../lib/ubicacion-pasos'
import type { Probador } from './probador'

// Corre en Node (tsx) con el programa de tipos de la app (sin @types/node): fs y path con lo mínimo.
interface FsMinimo {
  readFileSync(ruta: string, codificacion: 'utf8'): string
}
interface PathMinimo {
  resolve(...partes: string[]): string
}
declare const __dirname: string
const { readFileSync } = require('fs') as FsMinimo
const path = require('path') as PathMinimo
const leer = (relativa: string) => readFileSync(path.resolve(__dirname, '../..', relativa), 'utf8')

/** El cuerpo de una función exportada (desde su firma hasta la siguiente función de primer nivel). */
function bloqueDe(texto: string, firma: string): string {
  const desde = texto.indexOf(firma)
  if (desde < 0) return ''
  const resto = texto.slice(desde + firma.length)
  const fin = resto.search(/\n(export )?(async )?function |\nexport const |\nconst [a-zA-Z]+ = (async )?\(/)
  return firma + (fin < 0 ? resto : resto.slice(0, fin))
}

const UUID = '3f2b8c1e-9a4d-4e7b-8c2f-1a2b3c4d5e6f'
const T0 = Date.UTC(2026, 9, 15, 15, 0, 0)
const NORTE = { lat: 4.711, lng: -74.0721 }
/** ~0,0009° de latitud ≈ 100 m. */
const aMetrosAlNorte = (metros: number) => ({ lat: NORTE.lat + metros / 111_195, lng: NORTE.lng })
const CONTEXTO = { hoy: { fecha: '2026-10-15' } } as unknown as ContextoResponse
const OTRO_CONTEXTO = { hoy: { fecha: '2026-10-15' }, otro: true } as unknown as ContextoResponse

export async function pruebas(t: Probador): Promise<void> {
  t.seccion('18. Tiempos y caché')

  // -------------------------------------------------------------------------------------------
  t.seccion('18a. Contexto en memoria: frescura, cercanía e invalidación')
  {
    t.check('frescuras: 60 s sin pedir, 3 min pintar y refrescar, 10 min datos fijos', FRESCURA_SIN_PEDIR_MS === 60_000 && FRESCURA_PINTAR_MS === 180_000 && FRESCURA_DATOS_FIJOS_MS === 600_000)
    t.check('se reusa a menos de DISTANCIA_RECARGA_M (100 m), la misma de ubicacion-pasos.ts', DISTANCIA_REUSO_M === DISTANCIA_RECARGA_M && DISTANCIA_REUSO_M === 100, { DISTANCIA_REUSO_M, DISTANCIA_RECARGA_M })
    olvidarContextoEnMemoria()
    t.check('sin nada recordado → null', contextoReciente({ maxEdadMs: FRESCURA_DATOS_FIJOS_MS, ahora: T0 }) === null)

    recordarContexto(CONTEXTO, NORTE, T0)
    const fresco = contextoReciente({ maxEdadMs: FRESCURA_SIN_PEDIR_MS, ahora: T0 + 59_999 })
    t.check('con menos de maxEdadMs devuelve la entrada (contexto, punto, recibidoEn)', fresco?.contexto === CONTEXTO && fresco.recibidoEn === T0 && fresco.punto?.lat === NORTE.lat, fresco)
    t.check('justo en maxEdadMs o más viejo → null', contextoReciente({ maxEdadMs: FRESCURA_SIN_PEDIR_MS, ahora: T0 + 60_000 }) === null && contextoReciente({ maxEdadMs: FRESCURA_SIN_PEDIR_MS, ahora: T0 + 90_000 }) === null)
    t.check('entre 60 s y 3 min sirve para pintar y refrescar', contextoReciente({ maxEdadMs: FRESCURA_PINTAR_MS, ahora: T0 + 90_000 }) !== null && contextoReciente({ maxEdadMs: FRESCURA_PINTAR_MS, ahora: T0 + 180_000 }) === null)
    t.check('con un reloj que va para atrás (recibido "en el futuro") → null', contextoReciente({ maxEdadMs: FRESCURA_DATOS_FIJOS_MS, ahora: T0 - 1 }) === null)

    t.check('cercaDe a 40 m → la entrada', contextoReciente({ maxEdadMs: FRESCURA_SIN_PEDIR_MS, cercaDe: aMetrosAlNorte(40), ahora: T0 + 1_000 }) !== null)
    t.check('cercaDe a 150 m → null (más lejos que 100 m)', contextoReciente({ maxEdadMs: FRESCURA_SIN_PEDIR_MS, cercaDe: aMetrosAlNorte(150), ahora: T0 + 1_000 }) === null)
    t.check('maxDistanciaM manda sobre los 100 m', contextoReciente({ maxEdadMs: FRESCURA_SIN_PEDIR_MS, cercaDe: aMetrosAlNorte(150), maxDistanciaM: 200, ahora: T0 + 1_000 }) !== null && contextoReciente({ maxEdadMs: FRESCURA_SIN_PEDIR_MS, cercaDe: aMetrosAlNorte(40), maxDistanciaM: 30, ahora: T0 + 1_000 }) === null)
    t.check('cercaDe: null (se pide cercanía sin ubicación) → null', contextoReciente({ maxEdadMs: FRESCURA_SIN_PEDIR_MS, cercaDe: null, ahora: T0 + 1_000 }) === null)
    t.check('sin cercaDe no mira el punto (Agendar y Visita)', contextoReciente({ maxEdadMs: FRESCURA_DATOS_FIJOS_MS, ahora: T0 + 599_000 })?.contexto === CONTEXTO)

    recordarContexto(OTRO_CONTEXTO, null, T0 + 2_000)
    t.check('sin punto guardado y con cercaDe → null', contextoReciente({ maxEdadMs: FRESCURA_SIN_PEDIR_MS, cercaDe: NORTE, ahora: T0 + 3_000 }) === null)
    t.check('lo último que llega reemplaza a lo anterior', contextoReciente({ maxEdadMs: FRESCURA_SIN_PEDIR_MS, ahora: T0 + 3_000 })?.contexto === OTRO_CONTEXTO)
    recordarContexto(CONTEXTO, { lat: Number.NaN, lng: 1 }, T0 + 4_000)
    t.check('un punto no válido se guarda como null', contextoReciente({ maxEdadMs: FRESCURA_SIN_PEDIR_MS, ahora: T0 + 4_000 })?.punto === null)

    // Revisión 2026-10-15: pasada la medianoche en Bogotá, el contexto de ayer (citas, meta, configuración) no sirve.
    const AYER = { hoy: { fecha: '2026-10-14' } } as unknown as ContextoResponse
    const CASI_MEDIANOCHE = Date.UTC(2026, 9, 15, 4, 59, 50) // 23:59:50 del 14 en Bogotá
    recordarContexto(AYER, NORTE, CASI_MEDIANOCHE)
    t.check(
      'contexto de ayer → null pasada la medianoche (00:00:30), aunque tenga 40 s y sea del mismo sitio',
      contextoReciente({ maxEdadMs: FRESCURA_SIN_PEDIR_MS, cercaDe: NORTE, ahora: CASI_MEDIANOCHE + 40_000 }) === null &&
        contextoReciente({ maxEdadMs: FRESCURA_DATOS_FIJOS_MS, ahora: CASI_MEDIANOCHE + 40_000 }) === null
    )
    t.check('…y el mismo contexto antes de la medianoche sí sirve (23:59:55)', contextoReciente({ maxEdadMs: FRESCURA_SIN_PEDIR_MS, cercaDe: NORTE, ahora: CASI_MEDIANOCHE + 5_000 })?.contexto === AYER)
    recordarContexto({ otro: true } as unknown as ContextoResponse, NORTE, T0)
    t.check('un contexto sin hoy.fecha no se reusa', contextoReciente({ maxEdadMs: FRESCURA_SIN_PEDIR_MS, ahora: T0 + 1_000 }) === null)

    recordarContexto(CONTEXTO, NORTE, T0)
    const recibidos: MotivoInvalidacion[] = []
    const otros: MotivoInvalidacion[] = []
    const dejarDeEscuchar = escucharInvalidacion(motivo => recibidos.push(motivo))
    const quitarRoto = escucharInvalidacion(() => {
      throw new Error('oyente roto')
    })
    const quitarOtro = escucharInvalidacion(motivo => otros.push(motivo))
    const antes = versionContexto()
    invalidarContexto('visita')
    t.check('invalidarContexto la borra', contextoReciente({ maxEdadMs: FRESCURA_DATOS_FIJOS_MS, ahora: T0 + 1 }) === null)
    t.check('y avisa a los oyentes con el motivo (uno que falla no detiene a los demás)', recibidos.join() === 'visita' && otros.join() === 'visita', { recibidos, otros })
    t.check('y sube la versión (api.contexto no recuerda una respuesta pedida antes)', versionContexto() === antes + 1)
    dejarDeEscuchar()
    quitarRoto()
    invalidarContexto('cita')
    t.check('quien dejó de escuchar no recibe más', recibidos.join() === 'visita' && otros.join() === 'visita,cita', { recibidos, otros })
    quitarOtro()

    recordarContexto(CONTEXTO, NORTE, T0)
    const avisos: MotivoInvalidacion[] = []
    const quitar = escucharInvalidacion(motivo => avisos.push(motivo))
    const version = versionContexto()
    olvidarContextoEnMemoria()
    t.check('olvidarContextoEnMemoria (cerrar sesión) la borra sin avisar y sube la versión', contextoReciente({ maxEdadMs: FRESCURA_DATOS_FIJOS_MS, ahora: T0 + 1 }) === null && avisos.length === 0 && versionContexto() === version + 1)
    quitar()
  }

  // -------------------------------------------------------------------------------------------
  t.seccion('18b. Quién recuerda e invalida el contexto (texto de lib/api.ts, cola-contexto.tsx y sesion.ts)')
  {
    const api = leer('lib/api.ts')
    const contexto = bloqueDe(api, 'export async function contexto(')
    t.check(
      'api.contexto(punto) llama a recordarContexto con el punto pedido (sin la precisión) y solo si no hubo invalidación',
      /const pedido = punto \? \{ lat: punto\.lat, lng: punto\.lng \} : null/.test(contexto) &&
        /const version = versionContexto\(\)/.test(contexto) &&
        /if \(versionContexto\(\) === version\) recordarContexto\(respuesta, pedido\)/.test(contexto) &&
        contexto.indexOf('recordarContexto(') > contexto.indexOf("peticion<ContextoResponse>('/api/me/contexto'"),
      contexto.slice(0, 300)
    )
    t.check('api.contexto sigue mandando el punto en el CUERPO (POST), no en la URL', /metodo: 'POST',\s*cuerpo: \{\s*lat: Math\.round\(punto\.lat \* 1e6\) \/ 1e6/.test(contexto) && !/query:/.test(contexto))
    t.check(
      'corregir o anular una visita invalida el contexto después de la respuesta',
      ['export async function editarVisita(', 'export async function anularVisita('].every(firma => {
        const bloque = bloqueDe(api, firma)
        return bloque.indexOf("invalidarContexto('visita')") > bloque.indexOf('await peticion')
      })
    )
    const cola = leer('lib/cola-contexto.tsx')
    const enviar = cola.slice(cola.indexOf('const enviarVisita = async'), cola.indexOf('export function ProveedorCola'))
    t.check(
      "cola-contexto.tsx llama a invalidarContexto('visita') al recibir el 201 (después de api.crearVisita, antes de devolver)",
      enviar.indexOf('await api.crearVisita(') >= 0 && enviar.indexOf("invalidarContexto('visita')") > enviar.indexOf('await api.crearVisita(') && enviar.indexOf("invalidarContexto('visita')") < enviar.indexOf('return {'),
      enviar
    )
    // Revisión 2026-10-15: lo recién creado (médico, cuenta o sede, o la sede vinculada a un médico) debe salir en la
    // siguiente llegada, en Agendar y en Visita: el contexto en memoria se invalida después del 2xx.
    const terceros = ['export async function crearMedico(', 'export async function vincularSedeMedico(', 'export async function crearCuenta(', 'export async function crearSede(']
    const sinInvalidar = terceros.filter(firma => {
      const bloque = bloqueDe(api, firma)
      return !(bloque.indexOf("invalidarContexto('terceros')") > bloque.indexOf('await peticion') && bloque.indexOf('await peticion') > -1)
    })
    t.check("crear un médico, una cuenta o una sede y vincular una sede invalidan el contexto ('terceros') después del 2xx", sinInvalidar.length === 0, sinInvalidar)
    const sesion = leer('lib/sesion.ts')
    const olvidar = sesion.slice(sesion.indexOf('const olvidar = useCallback('), sesion.indexOf('const confirmar = useCallback('))
    t.check('sesion.ts: al cerrar sesión (olvidar) llama a olvidarContextoEnMemoria y olvida el guardado', /olvidarContextoEnMemoria\(\)/.test(olvidar) && /olvidarContextoGuardado\(\)/.test(olvidar) && /borrarToken\(\)/.test(olvidar))
  }

  // -------------------------------------------------------------------------------------------
  t.seccion('18c. rutaPatron y el registro de desarrollo de api.ts (sin cuerpo ni ids)')
  {
    t.check("rutaPatron('/api/me/visitas/<uuid>/anular') === '/api/me/visitas/:id/anular'", rutaPatron(`/api/me/visitas/${UUID}/anular`) === '/api/me/visitas/:id/anular', rutaPatron(`/api/me/visitas/${UUID}/anular`))
    t.check('rutaPatron quita la consulta', rutaPatron('/api/me/agenda?desde=2026-10-15&hasta=2026-11-14') === '/api/me/agenda' && rutaPatron('/api/terceros/sedes?q=Cl%C3%ADnica') === '/api/terceros/sedes')
    t.check('rutaPatron: un tramo que no es palabra de ruta (código, número, nombre) también es :id', rutaPatron('/api/terceros/medicos/12345/sedes') === '/api/terceros/medicos/:id/sedes' && rutaPatron('/api/x/Dra%20G%C3%B3mez') === '/api/x/:id', [rutaPatron('/api/terceros/medicos/12345/sedes'), rutaPatron('/api/x/Dra%20G%C3%B3mez')])
    t.check('rutaPatron deja igual las rutas sin ids', rutaPatron('/api/me/voz/transcribir') === '/api/me/voz/transcribir' && rutaPatron('/api/me/dias-libres') === '/api/me/dias-libres' && rutaPatron('/api/auth/me') === '/api/auth/me')

    const linea = lineaRegistroApi({ metodo: 'POST', ruta: `/api/me/visitas/${UUID}/anular?x=1`, estado: 200, ms: 412.4, serverTiming: 'auth;dur=12, rpc;dur=340, total;dur=380' })
    t.check('la línea [api]: método, patrón, estado, ms y server-timing', linea === '[api] POST /api/me/visitas/:id/anular 200 412 ms · auth;dur=12, rpc;dur=340, total;dur=380', linea)
    t.check('sin respuesta (sin red o tiempo agotado)', lineaRegistroApi({ metodo: 'GET', ruta: '/api/me/visitas', estado: null, ms: 20_000 }) === '[api] GET /api/me/visitas sin respuesta 20000 ms')
    t.check(
      'de server-timing solo pasa "nombre;dur=número"',
      lineaRegistroApi({ metodo: 'GET', ruta: '/api/me/numeros', estado: 200, ms: 5, serverTiming: 'auth;dur=1, x;desc="Dra Gómez", total;dur=5' }) === '[api] GET /api/me/numeros 200 5 ms · auth;dur=1, total;dur=5'
    )

    const api = leer('lib/api.ts')
    const registrar = bloqueDe(api, 'function registrarPeticion(')
    t.check('registrarPeticion solo escribe en desarrollo (__DEV__) y con lineaRegistroApi', /if \(!__DEV__\) return/.test(registrar) && /console\.log\(lineaRegistroApi\(datos\)\)/.test(registrar), registrar)
    const llamadas = Array.from(api.matchAll(/registrarPeticion\(\{([^}]*)\}\)/g)).map(m => m[1])
    const permitidas = new Set(['metodo', 'ruta', 'estado', 'ms', 'serverTiming'])
    const claves = llamadas.map(cuerpo => cuerpo.split(',').map(parte => parte.split(':')[0].trim()).filter(Boolean))
    t.check(
      'cada registrarPeticion de api.ts lleva solo método, ruta, estado, ms y serverTiming (nunca el cuerpo, la consulta ni el token)',
      llamadas.length === 2 && claves.every(lista => lista.every(clave => permitidas.has(clave))) && llamadas.every(cuerpo => !/texto|datos|cuerpo|body|query|token|url/.test(cuerpo)),
      claves
    )
  }

  // -------------------------------------------------------------------------------------------
  t.seccion('18d. MemoriaToken: el llavero se lee una sola vez')
  {
    function llaveroFalso(inicial: string | null, opciones: { demoraMs?: number; fallaAlLeer?: boolean; fallaAlGuardar?: boolean } = {}) {
      let guardado = inicial
      const conteo = { leer: 0, guardar: 0, borrar: 0 }
      const llavero: LlaveroToken = {
        async leer() {
          conteo.leer++
          // Como el llavero real: lo que se lee es lo que había al empezar la lectura (aunque luego se borre).
          const leido = guardado
          if (opciones.demoraMs) await new Promise(resolve => setTimeout(resolve, opciones.demoraMs))
          if (opciones.fallaAlLeer) throw new Error('llavero bloqueado')
          return leido
        },
        async guardar(token) {
          conteo.guardar++
          if (opciones.fallaAlGuardar) throw new Error('sin espacio')
          guardado = token
        },
        async borrar() {
          conteo.borrar++
          guardado = null
        },
      }
      return { llavero, conteo, valor: () => guardado }
    }

    const a = llaveroFalso('token-a', { demoraMs: 5 })
    const memoria = new MemoriaToken(a.llavero)
    const [uno, dos, tres] = await Promise.all([memoria.leer(), memoria.leer(), memoria.leer()])
    const cuatro = await memoria.leer()
    t.check('tres lecturas a la vez y una después: el llavero se lee UNA vez', uno === 'token-a' && dos === 'token-a' && tres === 'token-a' && cuatro === 'token-a' && a.conteo.leer === 1, a.conteo)
    await memoria.guardar('token-b')
    t.check('guardar actualiza la memoria y el llavero (sin volver a leerlo)', (await memoria.leer()) === 'token-b' && a.valor() === 'token-b' && a.conteo.leer === 1)
    memoria.olvidarSiEs('token-viejo')
    t.check('un 401 con OTRO token no borra el de ahora', (await memoria.leer()) === 'token-b')
    memoria.olvidarSiEs('token-b')
    t.check('un 401 con este token lo borra de la memoria (el llavero lo borra la sesión)', (await memoria.leer()) === null && a.conteo.leer === 1)
    await memoria.guardar('token-c')
    await memoria.borrar()
    t.check('borrar actualiza la memoria y el llavero', (await memoria.leer()) === null && a.valor() === null && a.conteo.borrar === 1 && a.conteo.leer === 1)

    const b = llaveroFalso('token-viejo', { demoraMs: 10 })
    const carrera = new MemoriaToken(b.llavero)
    const lectura = carrera.leer()
    await carrera.borrar()
    t.check('si se borra mientras se lee el llavero, la lectura tardía no revive el token', (await lectura) === null && (await carrera.leer()) === null, b.conteo)
    const c = llaveroFalso('token-viejo', { demoraMs: 10 })
    const carrera2 = new MemoriaToken(c.llavero)
    const lectura2 = carrera2.leer()
    await carrera2.guardar('token-nuevo')
    t.check('si se guarda mientras se lee, gana el nuevo', (await lectura2) === 'token-nuevo' && (await carrera2.leer()) === 'token-nuevo')

    const d = llaveroFalso('x', { fallaAlLeer: true })
    t.check('si el llavero falla al leer, cuenta como sin sesión (null)', (await new MemoriaToken(d.llavero).leer()) === null)
    const e = llaveroFalso('token-e', { fallaAlGuardar: true })
    const conFalla = new MemoriaToken(e.llavero)
    await conFalla.leer()
    const error = await t.lanza(() => conFalla.guardar('token-f'))
    t.check('si el llavero falla al guardar, lanza y la memoria no cambia', error === 'sin espacio' && (await conFalla.leer()) === 'token-e')
    const vacio = llaveroFalso('')
    t.check('un token vacío en el llavero es null', (await new MemoriaToken(vacio.llavero).leer()) === null)

    const almacen = leer('lib/almacen.ts')
    t.check('lib/almacen.ts: leerToken, guardarToken y borrarToken pasan por MemoriaToken', /const memoriaToken = new MemoriaToken\(llavero\)/.test(almacen) && /return memoriaToken\.leer\(\)/.test(almacen) && /return memoriaToken\.guardar\(token\)/.test(almacen) && /return memoriaToken\.borrar\(\)/.test(almacen))
    const api = leer('lib/api.ts')
    t.check('lib/api.ts: un 401 con token lo olvida en memoria antes de avisar a la sesión', /if \(respuesta\.status === 401 && token\) \{[\s\S]{0,200}olvidarTokenPor401\(token\)\s*\n\s*avisarSesionVencida\(\)/.test(api))
  }

  // -------------------------------------------------------------------------------------------
  t.seccion('18e. Arranque de la sesión: entra con el perfil guardado y confirma en segundo plano')
  {
    const perfil = { usuario: { id: 'usuario-1' } }
    t.check('TIEMPO_ME_MS = 5.000 (la persona espera) y TIEMPO_ME_FONDO_MS = 20.000 (en segundo plano, el de una petición normal)', TIEMPO_ME_MS === 5_000 && TIEMPO_ME_FONDO_MS === 20_000)
    t.check('con perfil y token vigente → entrar_y_confirmar', arranqueDeSesion({ perfilGuardado: perfil, tokenVigente: true }) === 'entrar_y_confirmar')
    t.check('sin perfil → confirmar_antes', arranqueDeSesion({ perfilGuardado: null, tokenVigente: true }) === 'confirmar_antes' && arranqueDeSesion({ perfilGuardado: undefined, tokenVigente: true }) === 'confirmar_antes')
    t.check('sin token (o vencido) → sin_sesion, aunque haya perfil', arranqueDeSesion({ perfilGuardado: perfil, tokenVigente: false }) === 'sin_sesion' && arranqueDeSesion({ perfilGuardado: null, tokenVigente: false }) === 'sin_sesion')
    t.check('perfil de otro usuario que el del token → confirmar_antes', arranqueDeSesion({ perfilGuardado: perfil, tokenVigente: true, uidDelToken: 'usuario-2' }) === 'confirmar_antes' && arranqueDeSesion({ perfilGuardado: perfil, tokenVigente: true, uidDelToken: 'usuario-1' }) === 'entrar_y_confirmar')
    t.check('perfil dañado (sin id) → confirmar_antes', arranqueDeSesion({ perfilGuardado: { usuario: { id: '' } }, tokenVigente: true }) === 'confirmar_antes' && arranqueDeSesion({ perfilGuardado: {} as never, tokenVigente: true }) === 'confirmar_antes')

    const sesion = leer('lib/sesion.ts')
    const abrir = sesion.slice(sesion.indexOf('// Al abrir la app.'), sesion.indexOf('// 401 en cualquier petición'))
    t.check(
      'sesion.ts al abrir: usa arranqueDeSesion; con entrar_y_confirmar entra con lo guardado y confirma sin esperar (void confirmar)',
      /arranqueDeSesion\(\{ perfilGuardado: guardado, tokenVigente: token !== null/.test(abrir) &&
        /if \(\(arranque === 'entrar_y_confirmar' \|\| arranque === 'entrar_vencida'\) && guardado\) \{[\s\S]*?setPerfil\(guardado\)[\s\S]*?setVencida\(arranque === 'entrar_vencida'\)[\s\S]*?setEstado\('con_sesion'\)[\s\S]*?void confirmar\(token, guardado, TIEMPO_ME_FONDO_MS\)/.test(abrir),
      abrir.slice(0, 600)
    )
    t.check(
      'nunca se entra sin token: sin_sesion o sin token → sin sesión; el vencido se olvida con aviso conservando perfil y contexto (0940: sin señal entra como entrar_vencida)',
      /const yaVencido = token !== null && tokenVencido\(token\)/.test(abrir) &&
        /tokenVigente: token !== null && !yaVencido, uidDelToken: leerCargaToken\(token\)\?\.uid, tokenVencido: yaVencido/.test(abrir) &&
        /if \(arranque === 'sin_sesion' \|\| !token\) \{\s*if \(yaVencido\) await olvidar\(MENSAJE_SESION_VENCIDA, \{ conservar: true \}\)\s*else setEstado\('sin_sesion'\)/.test(abrir)
    )
    const confirmar = sesion.slice(sesion.indexOf('const confirmar = useCallback('), sesion.indexOf('// Al abrir la app.'))
    t.check(
      'la confirmación espera /api/auth/me con el tiempo que le pasan; un 401 cierra la sesión; una respuesta tardía de otra sesión no la revive',
      /async \(token: string, guardado: Perfil \| null, tiempoMs: number\)/.test(confirmar) &&
        /api\.me\(token, tiempoMs\)/.test(confirmar) &&
        /if \(error\.status === 401\) \{\s*await olvidar\(MENSAJE_SESION_VENCIDA, \{ conservar: true \}\)/.test(confirmar) &&
        (confirmar.match(/generacion\.current !== desde/g) ?? []).length >= 2,
      confirmar.slice(0, 400)
    )
    // Revisión 2026-10-15: la confirmación en segundo plano no usa los 5 s de la espera (dejaba "Sin conexión" sin razón).
    t.check(
      'solo la confirmación que la persona espera usa TIEMPO_ME_MS; la de segundo plano y refrescar usan TIEMPO_ME_FONDO_MS',
      /await confirmar\(token, null, TIEMPO_ME_MS\)/.test(abrir) &&
        (sesion.match(/confirmar\([^)]*TIEMPO_ME_MS\)/g) ?? []).length === 1 &&
        /await confirmar\(token, perfil, TIEMPO_ME_FONDO_MS\)/.test(sesion.slice(sesion.indexOf('const refrescar = useCallback(')))
    )
    t.check('un 401 en cualquier petición sigue cerrando la sesión (alVencerSesion → olvidar), conservando perfil, contexto y cola (0940)', /api\.alVencerSesion\(\(\) => void olvidar\(MENSAJE_SESION_VENCIDA, \{ conservar: true \}\)\)/.test(sesion))
    t.check('salir y entrar cambian la generación (una confirmación vieja no revive la sesión)', /const olvidar = useCallback\(async \(motivo: string \| null, opciones: \{ conservar\?: boolean \} = \{\}\) => \{\s*generacion\.current\+\+/.test(sesion) && /const respuesta = await api\.login\(email, password\)\s*generacion\.current\+\+/.test(sesion))
    t.check('solo "Cerrar sesión" borra el perfil y el contexto guardados; el 401 los conserva', /if \(!opciones\.conservar\) \{\s*await borrarClave\(CLAVE_PERFIL\)\s*await olvidarContextoGuardado\(\)/.test(sesion) && /const salir = useCallback\(async \(\) => \{[\s\S]*?olvidar\(null\)/.test(sesion))
  }

  // -------------------------------------------------------------------------------------------
  t.seccion('18f. Marcas [tiempos-app] (solo en desarrollo, solo nombres y números)')
  {
    t.check('las 9 marcas del reporte', MARCAS_REPORTE.join(' ') === 'lista_pintada toque_hablar grabando fin_grabacion transcripcion propuesta primer_toque_tarjeta toque_confirmar visita_guardada')
    let ahora = 1_000
    const lineas: string[] = []
    let activo = false
    const registro = crearRegistroMarcas({ reloj: () => ahora, escribir: linea => lineas.push(linea), activo: () => activo })
    t.check('apagado (producción) no escribe nada', registro.marcar('lista_pintada') === null && lineas.length === 0)
    activo = true
    registro.marcar('lista_pintada')
    ahora += 4_000
    registro.marcar('toque_hablar')
    ahora += 300
    registro.marcar('grabando')
    ahora += 20_000
    registro.marcar('fin_grabacion', { bytes: 160_000.4, duracion_s: 20 })
    ahora += 5_100
    registro.marcar('transcripcion')
    ahora += 3_200
    registro.marcar('propuesta', { visitas: 2, 'Dra. Gómez': 1, texto: Number.NaN })
    ahora += 1_000
    registro.marcar('visita_guardada')
    ahora += 10
    registro.marcar('grabando')
    t.check(
      'cada marca dice lo que pasó desde la anterior y desde el inicio',
      lineas.join('\n') ===
        [
          '[tiempos-app] lista_pintada',
          '[tiempos-app] toque_hablar +4000 ms (desde lista_pintada 4000 ms)',
          '[tiempos-app] grabando +300 ms (desde lista_pintada 4300 ms)',
          '[tiempos-app] fin_grabacion +20000 ms (desde lista_pintada 24300 ms) bytes=160000 duracion_s=20',
          '[tiempos-app] transcripcion +5100 ms (desde lista_pintada 29400 ms)',
          '[tiempos-app] propuesta +3200 ms (desde lista_pintada 32600 ms) visitas=2',
          '[tiempos-app] visita_guardada +1000 ms (desde lista_pintada 33600 ms)',
          '[tiempos-app] grabando',
        ].join('\n'),
      lineas
    )
    t.check('solo nombres de marca y números (un nombre o un texto no entra)', lineas.every(l => /^\[tiempos-app\] [a-z_]+( \+\d+ ms \(desde [a-z_]+ \d+ ms\))?( [a-z][a-z0-9_]*=\d+)*$/.test(l)) && !lineas.some(l => /Gómez|Dra|NaN/.test(l)), lineas)
    lineas.length = 0
    registro.marcar('toque_hablar')
    ahora += MAX_RECORRIDO_MS + 1
    registro.marcar('toque_hablar')
    t.check('un recorrido de más de 15 min ya no es el mismo reporte: toque_hablar empieza otro', lineas[1] === '[tiempos-app] toque_hablar', lineas)
    const roto = crearRegistroMarcas({ reloj: () => 1, escribir: () => { throw new Error('consola rota') }, activo: () => true })
    t.check('si escribir falla, no lanza', (await t.lanza(() => roto.marcar('propuesta'))) === null)
    t.check('marcar() de la app no lanza ni escribe fuera de desarrollo (en Node no hay __DEV__)', (await t.lanza(() => marcar('toque_hablar', { x: 1 }))) === null)
    const tiempos = leer('lib/tiempos.ts')
    t.check('lib/tiempos.ts solo escribe con __DEV__ y no importa react-native', /typeof __DEV__ !== 'undefined' && __DEV__ === true/.test(tiempos) && !/from 'react-native'/.test(tiempos))
  }

  // -------------------------------------------------------------------------------------------
  t.seccion('18g. Perfil de audio: igual que hoy por defecto; ligero solo con EXPO_PUBLIC_PERFIL_AUDIO=ligero')
  {
    // La forma de RecordingPresets.HIGH_QUALITY de expo-audio (estéreo, 128 kbps): lib/audio.ts la usa de base.
    const BASE = {
      extension: '.m4a',
      sampleRate: 44100,
      numberOfChannels: 2,
      bitRate: 128000,
      android: { outputFormat: 'mpeg4', audioEncoder: 'aac' },
      ios: { outputFormat: 'aac ', audioQuality: 127, linearPCMBitDepth: 16, linearPCMIsBigEndian: false, linearPCMIsFloat: false },
      web: { mimeType: 'audio/webm', bitsPerSecond: 128000 },
    } as unknown as RecordingOptions
    const normal = opcionesGrabacion(perfilAudioDe(undefined), BASE)
    t.check(
      'OPCIONES_GRABACION por defecto: 64000 bps, 44100 Hz, mono, m4a, medidor y web a 64000',
      normal.bitRate === 64000 && normal.sampleRate === 44100 && normal.numberOfChannels === 1 && normal.extension === '.m4a' && normal.isMeteringEnabled === true && normal.web.bitsPerSecond === 64000,
      normal
    )
    t.check('Android: mpeg4 + aac; iOS conserva la base', normal.android.outputFormat === 'mpeg4' && normal.android.audioEncoder === 'aac' && normal.ios.audioQuality === 127)
    const ligero = opcionesGrabacion(perfilAudioDe('ligero'), BASE)
    t.check('con ligero: 32000 bps, 22050 Hz, mono, también en web (bitsPerSecond 32000)', ligero.bitRate === 32000 && ligero.sampleRate === 22050 && ligero.numberOfChannels === 1 && ligero.web.bitsPerSecond === 32000 && ligero.android.audioEncoder === 'aac', ligero)
    t.check('perfilAudioDe: " Ligero " → ligero; vacío, "normal" u otro → normal', perfilAudioDe(' Ligero ') === 'ligero' && perfilAudioDe('') === 'normal' && perfilAudioDe('normal') === 'normal' && perfilAudioDe('32k') === 'normal' && perfilAudioDe(null) === 'normal')
    t.check('la base no se modifica', BASE.bitRate === 128000 && BASE.numberOfChannels === 2 && AJUSTES_AUDIO.normal.bitRate === 64000)
    const audio = leer('lib/audio.ts')
    t.check(
      'lib/audio.ts toma el perfil de EXPO_PUBLIC_PERFIL_AUDIO y arma OPCIONES_GRABACION con opcionesGrabacion sobre HIGH_QUALITY',
      /export const PERFIL_AUDIO = perfilAudioDe\(process\.env\.EXPO_PUBLIC_PERFIL_AUDIO\)/.test(audio) &&
        /export const OPCIONES_GRABACION: RecordingOptions = opcionesGrabacion\(PERFIL_AUDIO, RecordingPresets\.HIGH_QUALITY\)/.test(audio)
    )
    t.check('lib/api.ts sigue subiendo con parteAudio(uri, () => archivo.bytes())', /parteAudio\(uri, \(\) => archivo\.bytes\(\)\)/.test(leer('lib/api.ts')))
  }
}
