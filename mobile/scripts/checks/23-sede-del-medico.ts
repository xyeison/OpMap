/**
 * Agendar con una sede que el médico aún no tiene (spec docs/specs/2026-10-30-agendar-sede-del-medico.md): las reglas
 * puras de lib/sede-del-medico.ts, la vuelta a Agendar con la sede creada (lib/retorno.ts) y lo que las pantallas
 * Agendar y Nueva sede tienen que hacer (se lee su archivo). Corren en Node, sin React Native ni red. Este solo,
 * desde mobile/:
 *   npx tsx scripts/checks/correr.ts 23-sede-del-medico
 */
import { formularioCitaVacio } from '../../lib/propuesta'
import { VIGENCIA_VUELTA_AGENDAR_MS, guardarAgendarAntesDeCrear, medicoParaAgendar, sedeParaAgendar, tomarVueltaAgendar } from '../../lib/retorno'
import {
  MENSAJE_SEDE_CREADA_SIN_VUELTA,
  MENSAJE_SEDE_SIN_UBICACION,
  cuerpoSedeNueva,
  detalleCrearSede,
  mensajeSedeCreadaSinVincular,
  sedesConVinculadas,
} from '../../lib/sede-del-medico'
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
    if (fin < 0) return ''
    const bloque = texto.slice(inicio, fin + 1)
    if (bloque.includes(marca)) return bloque
    desde = fin + 1
  }
}

export async function pruebas(t: Probador): Promise<void> {
  const { check, seccion } = t

  seccion('23. Agendar con una sede que el médico aún no tiene: reglas puras (lib/sede-del-medico.ts)')
  {
    const propias = [
      { id: 's1', nombre: 'Clínica Misericordia', cuenta_nombre: 'OINSAMED S.A.S.' },
      { id: 's2', nombre: 'Consultorio juan', cuenta_nombre: null },
    ]
    const sinVinculadas = sedesConVinculadas(propias, undefined)
    const vacias = sedesConVinculadas(propias, [])
    const conNueva = sedesConVinculadas(propias, [{ id: 's9', nombre: 'Clínica Norte', cuenta_nombre: 'Norte S.A.' }])
    const repetida = sedesConVinculadas(propias, [{ id: 's2', nombre: 'Consultorio juan', cuenta_nombre: null }, { id: 's9', nombre: 'Clínica Norte', cuenta_nombre: null }])
    check(
      'sedesConVinculadas: sin vinculadas devuelve las mismas (copia); la vinculada va primero; una que ya estaba no se repite',
      sinVinculadas.length === 2 && sinVinculadas !== propias && vacias.length === 2 &&
        conNueva.map(s => s.id).join(',') === 's9,s1,s2' &&
        repetida.map(s => s.id).join(',') === 's2,s9,s1',
      { conNueva, repetida }
    )
  }
  {
    const base = { cuenta_id: 'c1', nombre: 'Clínica Norte', municipality_id: '11001', reps_code: null }
    const sinUbicacion = cuerpoSedeNueva({ ...base, ubicacion: null })
    const conUbicacion = cuerpoSedeNueva({ ...base, reps_code: '110010000001', ubicacion: { lat: 4.6, lng: -74.1, precision: 12 } })
    check(
      'cuerpoSedeNueva: sin ubicación va sin origen ni coordenadas (el servidor la guarda manual, "por confirmar"); con ubicación es gps_app con lat, lng y precisión',
      !('origen' in sinUbicacion) && !('lat' in sinUbicacion) && !('gps_accuracy_m' in sinUbicacion) && sinUbicacion.cuenta_id === 'c1' && sinUbicacion.reps_code === null &&
        'origen' in conUbicacion && conUbicacion.origen === 'gps_app' && conUbicacion.lat === 4.6 && conUbicacion.lng === -74.1 && conUbicacion.gps_accuracy_m === 12 && conUbicacion.reps_code === '110010000001',
      { sinUbicacion, conUbicacion }
    )
    check(
      'textos: "Crear la sede" dice lo buscado y el médico; el aviso sin ubicación dice "por confirmar" y ofrece tomarla si se está en la sede',
      detalleCrearSede('Clínica Norte', 'juan') === '"Clínica Norte" no está en OpMap: créala y queda como sede de juan' &&
        /por confirmar/.test(MENSAJE_SEDE_SIN_UBICACION) && /toma la ubicación/.test(MENSAJE_SEDE_SIN_UBICACION)
    )
    check(
      'textos: si el vínculo falla al volver, el aviso dice que la sede quedó creada, a quién no se vinculó, el error y dónde reintentar; sin vuelta (30 min), que Agendar ya no la esperaba',
      mensajeSedeCreadaSinVincular('juan', 'Sin señal') === 'La sede quedó creada, pero no pude vincularla a juan (Sin señal). Búscala en Sede › Buscar en OpMap para intentarlo de nuevo.' &&
        /este médico \(Sin señal\)/.test(mensajeSedeCreadaSinVincular(null, 'Sin señal')) &&
        /quedó creada/.test(MENSAJE_SEDE_CREADA_SIN_VUELTA) && /Buscar en OpMap/.test(MENSAJE_SEDE_CREADA_SIN_VUELTA)
    )
  }

  seccion('23b. La vuelta a Agendar lleva la sede creada (lib/retorno.ts)')
  {
    const formulario = { ...formularioCitaVacio('2026-11-03', []), medico_id: 'm1', hora: '09:00' }
    const nueva = { id: 's9', nombre: 'Clínica Norte', cuenta_nombre: 'Norte S.A.' }
    tomarVueltaAgendar(1_000)
    const sinVueltaGuardada = sedeParaAgendar(nueva)
    const sinGuardar = tomarVueltaAgendar(1_000)
    guardarAgendarAntesDeCrear(formulario, 1_000)
    const guardada = sedeParaAgendar(nueva)
    const conSede = tomarVueltaAgendar(2_000)
    const otraVez = tomarVueltaAgendar(3_000)
    guardarAgendarAntesDeCrear(formulario, 1_000)
    const cancelada = tomarVueltaAgendar(1_500)
    guardarAgendarAntesDeCrear(formulario, 1_000)
    medicoParaAgendar('m2')
    const conMedico = tomarVueltaAgendar(1_500)
    guardarAgendarAntesDeCrear(formulario, 0)
    sedeParaAgendar(nueva)
    const vencida = tomarVueltaAgendar(VIGENCIA_VUELTA_AGENDAR_MS + 1)
    check(
      'la vuelta trae el formulario (con su médico) y la sede una sola vez; sin crear, sede null; Nuevo médico deja medicoId y sede null; sin guardar, sedeParaAgendar dice false y no hay vuelta; vencida (30 min), nada',
      sinVueltaGuardada === false && sinGuardar === null &&
        guardada === true && conSede?.sede?.id === 's9' && conSede.sede.nombre === 'Clínica Norte' && conSede.medicoId === null && conSede.formulario.medico_id === 'm1' && conSede.formulario.hora === '09:00' &&
        otraVez === null &&
        cancelada?.sede === null && cancelada.medicoId === null &&
        conMedico?.medicoId === 'm2' && conMedico.sede === null &&
        vencida === null,
      { sinVueltaGuardada, sinGuardar, guardada, conSede, otraVez, cancelada, conMedico, vencida }
    )
  }

  seccion('23c. Agendar: el selector "Sede" del médico busca en OpMap, vincula y ofrece "Crear la sede"')
  {
    const nueva = leer('mobile/app/(app)/agenda/nueva.tsx')
    const selectorSede = bloqueJsx(nueva, 'Selector', 'etiqueta="Sede"')
    check(
      'el selector "Sede" tiene "Buscar en OpMap" solo para la cita médica con médico, con el buscador de sedes (api.buscarSedes) y el vacío explica cómo buscar o crear',
      /buscarFuera=\{\s*formulario\.tipo === 'medica' && medico\s*\?/.test(selectorSede) &&
        /<Buscador<SedeBusquedaItem>/.test(selectorSede) &&
        /buscar=\{async q => \(await api\.buscarSedes\(q\)\)\.items\}/.test(selectorSede) &&
        /escribe arriba el nombre de la sede donde atiende para buscarla; si no está, ahí mismo la creas/.test(selectorSede),
      selectorSede.slice(0, 400)
    )
    check(
      'al tocar una sede del buscador se vincula al médico (vincularSede) y el buscador se cierra solo si salió bien; el error va al pie del buscador; "Crear la sede" solo cuando no encontró nada (siNoHay), con lo buscado y el médico',
      /alElegir=\{item =>\s*void vincularSede\(medico\.id, \{ id: item\.id, nombre: item\.nombre, cuenta_nombre: item\.cuenta_nombre \}\)\.then\(resultado => \{\s*if \(resultado\.ok\) cerrar\(\)/.test(selectorSede) &&
        /pie=\{errorSede \? <Aviso tono="peligro">\{errorSede\}<\/Aviso> : undefined\}/.test(selectorSede) &&
        /siNoHay=\{buscado => <Boton titulo="Crear la sede" detalle=\{detalleCrearSede\(buscado, medico\.nombre\)\}[^>]*alPresionar=\{\(\) => crearSede\(buscado, medico\)\}/.test(selectorSede)
    )
    check(
      'vincularSede: POST /api/terceros/medicos/[id]/sedes con rol "atiende"; un médico suyo recibe la sede en `vinculadas`, uno del buscador se vuelve a poner con lo que devolvió el servidor; la sede queda elegida; un 409 (ya la tenía) cuenta como vinculada; otro error, el mensaje y nada más',
      /const vincularSede = async \(medicoId: string, sede: SedeDeCita\): Promise<\{ ok: true \} \| \{ ok: false; error: string \}> => \{\s*setErrorSede\(null\)\s*try \{\s*const \{ medico: actualizado \} = await api\.vincularSedeMedico\(medicoId, \{ sede_id: sede\.id, rol: 'atiende' \}\)/.test(nueva) &&
        /if \(idsPropios\.has\(medicoId\)\) setVinculadas\(prev => \(\{ \.\.\.prev, \[medicoId\]: sedes \}\)\)\s*else setBuscados\(prev => \[\.\.\.prev\.filter\(b => b\.id !== medicoId\), medicoDeBusqueda\(actualizado, hoy\)\]\)\s*cambiar\(\{ medico_id: medicoId, sede_id: sede\.id \}\)\s*return \{ ok: true \}/.test(nueva) &&
        /if \(e instanceof ApiError && e\.status === 409\) \{[\s\S]*?sedesConVinculadas\(prev\[medicoId\] \?\? \[\], \[sede\]\)[\s\S]*?cambiar\(\{ medico_id: medicoId, sede_id: sede\.id \}\)\s*return \{ ok: true \}/.test(nueva) &&
        /const error = mensajeDeError\(e\)\s*setErrorSede\(error\)\s*return \{ ok: false, error \}/.test(nueva) &&
        /sedes: sedesConVinculadas\(/.test(nueva)
    )
    check(
      '"Crear la sede": guarda el formulario en la vuelta y pide Nueva sede con CLAVE_RETORNO_AGENDAR, el nombre buscado y el médico; al montarse con una sede en la vuelta (ponerSedeCreada) vuelve a traer un médico del buscador, la vincula y, si falla, lo dice bajo "¿Con quién?" (avisoPedido)',
      /const crearSede = \(nombre: string, quien: MedicoCita\) => \{\s*guardarAgendarAntesDeCrear\(formulario\)\s*fijarPedido\(\{ clave: CLAVE_RETORNO_AGENDAR, nombre, medico: \{ id: quien\.id, nombre: quien\.nombre \}, [^)]*\}\)\s*router\.push\('\/sede\/nueva'\)/.test(nueva) &&
        /else if \(vuelta\?\.sede && vuelta\.formulario\.medico_id\) \{\s*vueltaAplicada\.current = true\s*void ponerSedeCreada\(vuelta\.formulario\.medico_id, vuelta\.sede, contexto\)/.test(nueva) &&
        /const ponerSedeCreada = async \(medicoId: string, sede: SedeDeCita, ctx: ContextoResponse\) => \{\s*setAvisoPedido\(null\)[\s\S]*?const \{ medico: publico \} = await api\.medico\(medicoId\)\s*setBuscados\(prev => \[\.\.\.prev\.filter\(b => b\.id !== medicoId\), medicoDeBusqueda\(publico, hoy\)\]\)[\s\S]*?const resultado = await vincularSede\(medicoId, sede\)\s*if \(!resultado\.ok\) setAvisoPedido\(mensajeSedeCreadaSinVincular\(nombre, resultado\.error\)\)/.test(nueva)
    )
    check(
      'al volver (vuelta) la fecha y la hora son las que llevaba: cargar no las reescribe y horaAuto arranca en false',
      /if \(vuelta\) \{\s*\/\/ nada: conserva lo que llevaba\s*\} else if \(!fechaDeUrl\) \{/.test(nueva) &&
        /useState\(typeof horaDeUrl !== 'string' && !vuelta\)/.test(nueva)
    )
  }

  seccion('23d. Nueva sede pedida por Agendar: ubicación opcional, cuerpo según la ubicación y vuelta sin avisar a Reportar')
  {
    const sede = leer('mobile/app/(app)/sede/nueva.tsx')
    check(
      'desde Agendar (CLAVE_RETORNO_AGENDAR) no toma la ubicación sola ni la exige; el nombre buscado viene puesto; desde Reportar sigue igual',
      /const desdeAgendar = pedido\?\.clave === CLAVE_RETORNO_AGENDAR/.test(sede) &&
        /useState\(desdeAgendar \? limpiarNombre\(pedido\?\.nombre \?\? ''\) : ''\)/.test(sede) &&
        /useState\(!desdeAgendar\)/.test(sede) &&
        /if \(!desdeAgendar\) void ubicar\(\)/.test(sede) &&
        /ubicacion: !ubicacion && !desdeAgendar \? 'Hace falta la ubicación del teléfono/.test(sede) &&
        /\(!ubicacion && !desdeAgendar\)\) return/.test(sede)
    )
    check(
      'manda el cuerpo de cuerpoSedeNueva (gps_app solo con ubicación); desde Agendar deja la sede en la vuelta (sedeParaAgendar) y NO avisa a Reportar; sin pantalla anterior vuelve a Agendar',
      /await api\.crearSede\(\s*cuerpoSedeNueva\(\{/.test(sede) &&
        /if \(desdeAgendar\) \{[\s\S]*?if \(!sedeParaAgendar\(\{ id: sede\.id, nombre: sede\.nombre, cuenta_nombre: cuenta\.nombre \}\)\) \{\s*setError\(MENSAJE_SEDE_CREADA_SIN_VUELTA\)\s*return\s*\}\s*\} else \{\s*avisarRetorno\(\{/.test(sede) &&
        /router\.replace\(desdeAgendar \? '\/agenda\/nueva' : '\/reportar'\)/.test(sede)
    )
    check(
      'en pantalla: "Ubicación (opcional)" con el aviso de "por confirmar" y el botón "Estoy en la sede: tomar la ubicación"; dice de qué médico queda como sede',
      /desdeAgendar \? 'Ubicación \(opcional\)' : 'Ubicación del sitio'/.test(sede) &&
        /<Texto suave>\{MENSAJE_SEDE_SIN_UBICACION\}<\/Texto>/.test(sede) &&
        /'Estoy en la sede: tomar la ubicación'/.test(sede) &&
        /Queda como sede donde atiende \$\{medico\.nombre\}/.test(sede)
    )
  }
}
