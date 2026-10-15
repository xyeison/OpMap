/**
 * Tiempos de /api/me/* (spec docs/specs/2026-10-15-usabilidad-y-agenda-con-hora.md, sección 18 y paquete 4): pruebas
 * puras de cronometro (app/api/me/_lib/tiempos.ts) con un reloj falso, la cabecera Server-Timing, la línea [tiempos]
 * sin contenido (solo el patrón de la ruta y números) y leerPorIds con trozos en paralelo y un lector falso. SIN red
 * ni Supabase. Que las rutas reales no cambian lo que responden ni dejan contenido en los logs lo comprueban
 * reporte-api-check.ts y terceros-api-check.ts (sin cambios: capturan console.info, donde va la línea [tiempos]).
 *
 * Uso (desde web/): npx tsx scripts/tiempos-check.ts   (va dentro de npm run test)
 * Código de salida 1 si alguna prueba falla.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { NextResponse } from 'next/server'
import {
  anotarUsoClaude,
  cronometro,
  medirRuta,
  patronDeRuta,
  reiniciarInstanciaTiempos,
  sumarUsoClaude,
} from '../app/api/me/_lib/tiempos'
import { TROZOS_EN_PARALELO, leerPorIds } from '../app/api/terceros/_lib/terceros-server'
import { contextoValidacion } from '../app/api/me/_lib/reporte-server'
import type { PersonaVisitas } from '../app/api/config-visitas/_lib/visitas-server'
import type { VisitaCreate } from '../lib/reporte-visitas'

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

async function lanza(fn: () => unknown | Promise<unknown>): Promise<string | null> {
  try {
    await fn()
    return null
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}

const UUID = '3f2b8c1e-9a4d-4e7b-8c2f-1a2b3c4d5e6f'
const espera = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/** Reloj falso: solo avanza cuando la prueba lo mueve. */
function relojFalso(inicio = 1000) {
  let ahora = inicio
  return { reloj: () => ahora, avanzar: (ms: number) => void (ahora += ms) }
}

async function main() {
  console.log('\n18. Tiempos de /api/me/*: cronometro, Server-Timing, [tiempos] y leerPorIds')

  // -------------------------------------------------------------------------------------------
  console.log('\n18a. cronometro con un reloj falso')
  {
    reiniciarInstanciaTiempos()
    const { reloj, avanzar } = relojFalso()
    const lineas: string[] = []
    const t = cronometro('POST /api/me/contexto', { reloj, registrar: linea => lineas.push(linea) })
    const sesion = await t.fase('auth', async () => {
      avanzar(12)
      return 'sesion'
    })
    check('fase devuelve lo que devuelve el trabajo', sesion === 'sesion')
    const falla = await lanza(() =>
      t.fase('ctx', async () => {
        avanzar(340)
        throw new Error('la base no respondió')
      })
    )
    check('una fase que falla propaga la falla tal cual', falla === 'la base no respondió', falla)
    avanzar(28)
    const respuesta = t.terminar(NextResponse.json({ ok: true }))
    check(
      'la cabecera es "auth;dur=12, ctx;dur=340, total;dur=380" (la fase que falló también cuenta)',
      respuesta.headers.get('Server-Timing') === 'auth;dur=12, ctx;dur=340, total;dur=380',
      respuesta.headers.get('Server-Timing')
    )
    check(
      'la línea es "[tiempos] POST /api/me/contexto auth=12 ctx=340 total=380 frio=1"',
      lineas.length === 1 && lineas[0] === '[tiempos] POST /api/me/contexto auth=12 ctx=340 total=380 frio=1',
      lineas
    )
    t.terminar(respuesta)
    check('terminar dos veces no repite la línea', lineas.length === 1, lineas)

    const segunda = cronometro('POST /api/me/contexto', { reloj, registrar: linea => lineas.push(linea) })
    await segunda.fase('auth', async () => avanzar(5))
    segunda.terminar(NextResponse.json({ ok: true }))
    check('frio=1 solo en la primera petición de la instancia', lineas[1] === '[tiempos] POST /api/me/contexto auth=5 total=5', lineas[1])

    const sincrona = cronometro('GET /api/me/cuota', { reloj, registrar: linea => lineas.push(linea) })
    check('una fase acepta un trabajo que no es promesa', (await sincrona.fase('cuota', () => 7)) === 7)
    const fallaSincrona = await lanza(() =>
      sincrona.fase('cuota', () => {
        avanzar(3)
        throw new Error('sin cuota')
      })
    )
    check('y su falla también se propaga y se mide', fallaSincrona === 'sin cuota' && sincrona.cabecera().startsWith('cuota;dur=3,'), sincrona.cabecera())

    const repetida = cronometro('GET /api/me/visitas', { reloj, registrar: () => undefined })
    await repetida.fase('db', async () => avanzar(10))
    await repetida.fase('db', async () => avanzar(15))
    check('la misma fase dos veces se suma', repetida.cabecera().startsWith('db;dur=25,'), repetida.cabecera())

    const redondeo = cronometro('GET /api/me/lines', { reloj, registrar: () => undefined })
    await redondeo.fase('auth', async () => avanzar(12.6))
    check('los milisegundos van enteros', redondeo.cabecera().startsWith('auth;dur=13,'), redondeo.cabecera())
  }

  // -------------------------------------------------------------------------------------------
  console.log('\n18b. La línea [tiempos] lleva solo el patrón de la ruta y números')
  {
    check("patronDeRuta cambia el uuid por ':id'", patronDeRuta(`POST /api/me/visitas/${UUID}/anular`) === 'POST /api/me/visitas/:id/anular', patronDeRuta(`POST /api/me/visitas/${UUID}/anular`))
    check('patronDeRuta quita la consulta', patronDeRuta('GET /api/me/visitas?fecha=2026-10-15') === 'GET /api/me/visitas')
    check(
      'patronDeRuta quita lo que no es de una ruta (comillas, comas, tildes, puntos)',
      patronDeRuta('GET /api/me/"Dra. Gómez",4.711') === 'GET /api/me/Dra Gmez4711',
      patronDeRuta('GET /api/me/"Dra. Gómez",4.711')
    )

    reiniciarInstanciaTiempos()
    const { reloj, avanzar } = relojFalso()
    const lineas: string[] = []
    const t = cronometro(`PATCH /api/me/visitas/${UUID}`, { reloj, registrar: linea => lineas.push(linea) })
    await t.fase('auth', async () => avanzar(4))
    await t.fase('Dra. Gómez', async () => avanzar(9))
    await t.fase('lat=4.711', async () => avanzar(9))
    t.dato('claude_in', 5123)
    t.dato('claude_in', 77)
    t.dato('audio_kb', 412.4)
    t.dato('texto', Number.NaN)
    t.dato('Lo que dijo', 3)
    t.dato('total', 99)
    t.dato('frio', 0)
    t.dato('estado', 200)
    t.dato('nulo', null)
    avanzar(1)
    t.terminar(NextResponse.json({ error: 'x' }, { status: 400 }))
    const linea = lineas[0] ?? ''
    check(
      'nombres que no son fases válidas no entran; los datos van como números; un 400 añade estado=400',
      linea === '[tiempos] PATCH /api/me/visitas/:id auth=4 total=23 claude_in=5200 audio_kb=412 estado=400 frio=1',
      linea
    )
    check('la línea no lleva el uuid, ni texto, ni coordenadas', !linea.includes(UUID) && !/Gómez|Dra|4\.711|dijo/.test(linea), linea)
    check('cada palabra después del patrón es nombre=número', linea.split(' ').slice(3).every(parte => /^[a-z][a-z0-9_]*=\d+$/.test(parte)), linea)
  }

  // -------------------------------------------------------------------------------------------
  console.log('\n18c. medirRuta: cabecera y línea en toda salida, también si el manejador lanza')
  {
    reiniciarInstanciaTiempos()
    const { reloj, avanzar } = relojFalso()
    const lineas: string[] = []
    const opciones = { reloj, registrar: (linea: string) => lineas.push(linea) }
    const ok = await medirRuta(
      'GET /api/me/numeros',
      async t => {
        await t.fase('auth', async () => avanzar(8))
        return NextResponse.json({ mes: '2026-10' })
      },
      opciones
    )
    check('la respuesta sale igual, con Server-Timing', ok.status === 200 && ok.headers.get('Server-Timing') === 'auth;dur=8, total;dur=8' && (await ok.json()).mes === '2026-10', ok.headers.get('Server-Timing'))
    const temprana = await medirRuta(
      'GET /api/me/numeros',
      async t => {
        await t.fase('auth', async () => avanzar(2))
        return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
      },
      opciones
    )
    check('una salida temprana (401) también lleva cabecera y línea con estado=401', temprana.headers.get('Server-Timing') === 'auth;dur=2, total;dur=2' && lineas[1] === '[tiempos] GET /api/me/numeros auth=2 total=2 estado=401', lineas[1])
    const error = await lanza(() =>
      medirRuta(
        'GET /api/me/numeros',
        async t => {
          await t.fase('auth', async () => avanzar(1))
          throw new Error('inesperado')
        },
        opciones
      )
    )
    check('si el manejador lanza: se relanza y la línea dice estado=500', error === 'inesperado' && lineas[2] === '[tiempos] GET /api/me/numeros auth=1 total=1 estado=500', { error, linea: lineas[2] })
    const roto = await medirRuta('GET /api/me/numeros', async () => NextResponse.json({ ok: true }), {
      reloj,
      registrar: () => {
        throw new Error('el log falló')
      },
    })
    check('si el registro falla, la respuesta sale igual', roto.status === 200)
    const informacion = console.info
    const capturadas: string[] = []
    console.info = (...args: unknown[]) => void capturadas.push(args.map(String).join(' '))
    try {
      await medirRuta('GET /api/me/cuota', async () => NextResponse.json({ ok: true }), { reloj })
    } finally {
      console.info = informacion
    }
    check('por defecto la línea va a console.info (la capturan reporte-api-check y vercel logs)', capturadas.length === 1 && capturadas[0].startsWith('[tiempos] GET /api/me/cuota '), capturadas)
  }

  // -------------------------------------------------------------------------------------------
  console.log('\n18d. usage de Claude solo como números')
  {
    const uno = sumarUsoClaude(null, { input_tokens: 5000, output_tokens: 400, cache_read_input_tokens: 4800, cache_creation_input_tokens: 10 })
    const dos = sumarUsoClaude(uno, { input_tokens: 100, output_tokens: 'x', server_tool_use: { web_search_requests: 1 } })
    check('suma entrada, salida, caché leída y llamadas; lo que no es número cuenta 0', dos.entrada === 5100 && dos.salida === 400 && dos.cache_leida === 4800 && dos.llamadas === 2, dos)
    check('sin usage (un falso de prueba) cuenta la llamada con ceros', JSON.stringify(sumarUsoClaude(null, undefined)) === JSON.stringify({ entrada: 0, salida: 0, cache_leida: 0, llamadas: 1 }))
    reiniciarInstanciaTiempos()
    const { reloj } = relojFalso()
    const lineas: string[] = []
    const t = cronometro('POST /api/me/voz/proponer', { reloj, registrar: linea => lineas.push(linea) })
    anotarUsoClaude(t, sumarUsoClaude(null, { input_tokens: 5000, output_tokens: 400, cache_read_input_tokens: 4800 }))
    anotarUsoClaude(t, sumarUsoClaude(null, { input_tokens: 6000, output_tokens: 500, cache_read_input_tokens: 0 }))
    anotarUsoClaude(t, null)
    t.terminar(NextResponse.json({}))
    check('dos respuestas (reintento) se suman en la línea', lineas[0] === '[tiempos] POST /api/me/voz/proponer total=0 claude_in=11000 claude_out=900 claude_cache=4800 claude_n=2 frio=1', lineas[0])
  }

  // -------------------------------------------------------------------------------------------
  console.log('\n18e. leerPorIds: trozos en paralelo (4 a la vez como mucho), mismo resultado y mismo orden')
  {
    type Fila = { id: string; n: number }
    /** Lector falso: 1.000 filas por página como PostgREST; cada id trae `filasPorId` filas; demora variable. */
    function lectorFalso(filasPorId: number, falla?: (trozo: string[], from: number) => boolean) {
      let enCurso = 0
      let maximo = 0
      const llamadas: { primero: string; from: number }[] = []
      const build = async (trozo: string[], from: number, to: number) => {
        enCurso++
        maximo = Math.max(maximo, enCurso)
        llamadas.push({ primero: trozo[0], from })
        try {
          // El primer trozo es el más lento: así terminan en otro orden que el de salida.
          await espera(trozo[0] === 'id-0000' ? 25 : 5 + ((trozo.length + from) % 7))
          if (falla?.(trozo, from)) return { data: null, error: { message: 'trozo con error' } }
          const todas: Fila[] = trozo.flatMap(id => Array.from({ length: filasPorId }, (_, n) => ({ id, n })))
          return { data: todas.slice(from, to + 1), error: null }
        } finally {
          enCurso--
        }
      }
      return { build, maximo: () => maximo, llamadas }
    }
    const ids = Array.from({ length: 1000 }, (_, i) => `id-${String(i).padStart(4, '0')}`)
    const secuencial = ids.flatMap(id => Array.from({ length: 2 }, (_, n) => ({ id, n })))

    const lector = lectorFalso(2)
    const filas = await leerPorIds<Fila>([...ids, ids[3], '', ids[10]], lector.build)
    check('TROZOS_EN_PARALELO = 4', TROZOS_EN_PARALELO === 4)
    check('mismo resultado y en el mismo orden que uno tras otro (1.000 ids, 7 trozos, repetidos y vacíos fuera)', JSON.stringify(filas) === JSON.stringify(secuencial), { filas: filas.length, esperadas: secuencial.length })
    check('nunca más de 4 trozos a la vez', lector.maximo() <= 4 && lector.maximo() > 1, lector.maximo())
    check('un pedido por trozo (7)', lector.llamadas.length === 7, lector.llamadas.length)

    const paginado = lectorFalso(10)
    const muchas = await leerPorIds<Fila>(ids.slice(0, 450), paginado.build)
    const esperadas = ids.slice(0, 450).flatMap(id => Array.from({ length: 10 }, (_, n) => ({ id, n })))
    check(
      'trozos de 1.500 filas: cada uno pagina de a 1.000 y el orden se conserva',
      JSON.stringify(muchas) === JSON.stringify(esperadas) && paginado.llamadas.filter(llamada => llamada.from === 1000).length === 3,
      { muchas: muchas.length, paginas: paginado.llamadas }
    )

    const uno = lectorFalso(1)
    check('con un tope de 1 va de uno en uno', JSON.stringify(await leerPorIds<Fila>(ids, uno.build, 1)) === JSON.stringify(ids.map(id => ({ id, n: 0 }))) && uno.maximo() === 1, uno.maximo())

    const vacio = lectorFalso(1)
    check('sin ids no pide nada', (await leerPorIds<Fila>(['', ''], vacio.build)).length === 0 && vacio.llamadas.length === 0)

    const conFalla = lectorFalso(1, trozo => trozo[0] === 'id-0150')
    const mensaje = await lanza(() => leerPorIds<Fila>(ids, conFalla.build))
    check('si un trozo falla, se lanza su error', mensaje === 'trozo con error', mensaje)
    await espera(80) // lo que estaba en curso termina; si siguiera pidiendo, aquí ya serían 7
    check('y no se piden trozos nuevos después de la falla (los 4 que ya estaban en curso)', conFalla.llamadas.length === 4, conFalla.llamadas.length)
  }

  // -------------------------------------------------------------------------------------------
  console.log('\n18f. Todas las rutas de /api/me/* (también la agenda) se miden y POST /api/me/visitas valida en paralelo')
  {
    const raiz = path.resolve(__dirname, '../app/api/me')
    const leer = (relativa: string) => readFileSync(path.join(raiz, relativa), 'utf8')
    const RUTAS: [string, string[]][] = [
      ['contexto/route.ts', ['GET /api/me/contexto', 'POST /api/me/contexto']],
      ['visitas/route.ts', ['GET /api/me/visitas', 'POST /api/me/visitas']],
      ['visitas/[id]/route.ts', ['PATCH /api/me/visitas/:id']],
      ['visitas/[id]/anular/route.ts', ['POST /api/me/visitas/:id/anular']],
      ['voz/transcribir/route.ts', ['POST /api/me/voz/transcribir']],
      ['voz/proponer/route.ts', ['POST /api/me/voz/proponer']],
      ['voz/campos/route.ts', ['POST /api/me/voz/campos']],
      ['numeros/route.ts', ['GET /api/me/numeros']],
      ['cuota/route.ts', ['GET /api/me/cuota']],
      ['lines/route.ts', ['GET /api/me/lines']],
      ['dias-libres/route.ts', ['GET /api/me/dias-libres', 'POST /api/me/dias-libres']],
      ['dias-libres/[id]/anular/route.ts', ['POST /api/me/dias-libres/:id/anular']],
      ['agenda/route.ts', ['GET /api/me/agenda', 'POST /api/me/agenda']],
      ['agenda/[id]/cancelar/route.ts', ['POST /api/me/agenda/:id/cancelar']],
    ]
    // "Cada ruta de /api/me/*" (spec, Medición): ningún route.ts de app/api/me queda fuera de esta lista.
    const archivosRuta: string[] = []
    const recorrer = (dir: string) => {
      for (const nombre of readdirSync(dir)) {
        const ruta = path.join(dir, nombre)
        if (statSync(ruta).isDirectory()) recorrer(ruta)
        else if (nombre === 'route.ts') archivosRuta.push(path.relative(raiz, ruta).split(path.sep).join('/'))
      }
    }
    recorrer(raiz)
    const listados = new Set(RUTAS.map(([archivo]) => archivo))
    const sinMedir = archivosRuta.filter(archivo => !listados.has(archivo))
    check('todo route.ts de app/api/me está en la lista de rutas medidas', sinMedir.length === 0 && archivosRuta.length === RUTAS.length, { sinMedir, archivosRuta })
    for (const [archivo, rutas] of RUTAS) {
      const texto = leer(archivo)
      const metodos = rutas.map(ruta => ruta.split(' ')[0])
      const exportados = Array.from(texto.matchAll(/export async function (GET|POST|PATCH|DELETE)\b/g)).map(m => m[1])
      const medidas = rutas.every(ruta => texto.includes(`medirRuta('${ruta}', async t => {`))
      const auth = (texto.match(/t\.fase\('auth', \(\) => require(Ejecutiva|User)\(/g) ?? []).length === rutas.length
      check(
        `${archivo}: ${rutas.join(' y ')} con medirRuta y la fase auth`,
        medidas && auth && exportados.length === metodos.length && exportados.every(m => metodos.includes(m)),
        { medidas, auth, exportados }
      )
    }
    const proponer = leer('voz/proponer/route.ts')
    const campos = leer('voz/campos/route.ts')
    check('proponer y campos anotan el usage de Claude (solo números)', [proponer, campos].every(texto => /usage => anotarUsoClaude\(t, sumarUsoClaude\(null, usage\)\)/.test(texto)))
    const transcribir = leer('voz/transcribir/route.ts')
    check(
      'transcribir pide el vocabulario antes de leer el audio (corre mientras sube)',
      transcribir.indexOf('const vocabulario = leerVocabulario(') > 0 && transcribir.indexOf('const vocabulario = leerVocabulario(') < transcribir.indexOf("await t.fase('audio', () => request.formData())")
    )
    const servidor = leer('_lib/reporte-server.ts')
    const validacion = servidor.slice(servidor.indexOf('export async function contextoValidacion('), servidor.indexOf('async function sedeParaValidar('))
    const primerAll = validacion.match(/await Promise\.all\(\[([\s\S]*?)\n {2}\]\)/)?.[1] ?? ''
    check(
      'contextoValidacion: la sede (con su cuenta) y el médico o el subtipo en el mismo Promise.all',
      ['lineasDeEjecutiva(persona.id)', 'sedeParaValidar(datos.sede_id)', 'medicoParaValidar(', 'institucionalParaValidar('].every(parte => primerAll.includes(parte)),
      primerAll
    )
  }

  // -------------------------------------------------------------------------------------------
  console.log('\n18g. contextoValidacion con un Supabase falso: la sede y el médico (o el subtipo) se piden a la vez')
  {
    // Supabase FALSO (nada sale a la red): cada tabla tarda 30 ms y se anota cuándo empezó y terminó cada consulta.
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supabase.tiempos.test'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba'
    const S = '11111111-1111-4111-8111-111111111111'
    const C = '22222222-2222-4222-8222-222222222222'
    const M = '33333333-3333-4333-8333-333333333333'
    const T = '44444444-4444-4444-8444-444444444444'
    const FILAS: Record<string, unknown[]> = {
      sedes: [{ id: S, nombre: 'Sede Norte', cuenta_id: C, lat: '4.711', lng: -74.0721, activo: true }],
      cuentas: [{ id: C, activo: true }],
      medicos: [{ id: M, nombre: 'Médico', activo: true }],
      medico_sedes: [{ sede_id: S }],
      medico_visitantes: [{ desde: '2026-01-01', hasta: null }],
      subtipos_institucionales: [{ id: T, codigo: 'compras', vigente_desde: '2026-01-01', vigente_hasta: null }],
      executive_lines: [],
    }
    const consultas: { tabla: string; inicio: number; fin: number }[] = []
    const fetchOriginal = globalThis.fetch
    const externas: string[] = []
    globalThis.fetch = (async (entrada: RequestInfo | URL) => {
      const url = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url)
      if (url.origin !== 'http://supabase.tiempos.test') {
        externas.push(url.origin)
        throw new Error('tiempos-check: la red está prohibida')
      }
      const tabla = url.pathname.replace('/rest/v1/', '')
      const consulta = { tabla, inicio: performance.now(), fin: 0 }
      consultas.push(consulta)
      await espera(30)
      consulta.fin = performance.now()
      return new Response(JSON.stringify(FILAS[tabla] ?? []), { status: 200, headers: { 'content-type': 'application/json' } })
    }) as typeof fetch
    try {
      const persona = { id: 'e1', nombre: 'Ana', status: 'active', userId: 'u1', kamId: 'k1', zona: 'Norte', municipio: '11001', startedAt: null, leftAt: null } as PersonaVisitas
      const medica = { tipo: 'medica', medico_id: M, sede_id: S } as unknown as VisitaCreate
      const resultado = await contextoValidacion(medica, persona, '2026-10-15')
      const de = (tabla: string) => consultas.find(consulta => consulta.tabla === tabla)
      const sede = de('sedes')
      const cuenta = de('cuentas')
      const medico = de('medicos')
      check(
        'médica: el resultado es el mismo de antes (sede activa con su cuenta, médico con sus sedes y visitante vigente)',
        resultado.sede?.id === S && resultado.sede.cuenta_activa === true && resultado.sede.lat === 4.711 && resultado.medico?.id === M &&
          resultado.medico.sede_ids.join() === S && resultado.medico.es_visitante === true && resultado.subtipo === null && resultado.contacto === null && resultado.ejecutiva.con_zona,
        resultado
      )
      check(
        'médica: el médico se pide ANTES de que termine la sede (en paralelo, no después de la sede y su cuenta)',
        Boolean(sede && cuenta && medico && medico.inicio < sede.fin && medico.inicio < cuenta.inicio),
        consultas.map(c => `${c.tabla} ${Math.round(c.inicio)}-${Math.round(c.fin)}`)
      )
      consultas.length = 0
      const institucional = { tipo: 'institucional', cuenta_id: C, subtipo_id: T, contacto_id: null, sede_id: S } as unknown as VisitaCreate
      const inst = await contextoValidacion(institucional, persona, '2026-10-15')
      const sede2 = de('sedes')
      const subtipo = de('subtipos_institucionales')
      check('institucional: el subtipo se pide a la vez que la sede, y el resultado es el mismo', Boolean(sede2 && subtipo && subtipo.inicio < sede2.fin) && inst.subtipo?.id === T && inst.medico === null && inst.sede?.id === S && inst.contacto === null, { inst, consultas })
      check('nada salió a la red salvo el Supabase falso', externas.length === 0, externas)
    } finally {
      globalThis.fetch = fetchOriginal
    }
  }

  console.log(`\n${passed} pruebas bien, ${failed} con falla`)
  if (failed > 0) process.exit(1)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
