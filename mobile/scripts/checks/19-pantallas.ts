/**
 * Sección 19 de scripts/movil-check.ts (spec 2026-10-15-usabilidad-y-agenda-con-hora, paquete 5):
 * Hoy (debeRecargarHoy, citaDeAhora, cita tocable), Días libres, Números, Visita, Nueva sede,
 * Nuevo médico e Ingreso.
 *
 * Corren en Node, sin React Native ni red (las que revisan una pantalla leen su archivo y revisan cada llamada dentro de
 * su bloque). Este solo, desde mobile/:
 *   npx tsx scripts/checks/correr.ts 19-pantallas
 */
import { FRESCURA_SIN_PEDIR_MS } from '../../lib/contexto-memoria'
import {
  citaAtrasada,
  citaDeAhora,
  debeRecargarHoy,
  erroresNuevoMedico,
  faltaParaEntrar,
  faltanVisitas,
  marcasDiasLibres,
  primerDiaRegistrable,
  textoSiguienteCita,
  textoUbicacionTomada,
} from '../../lib/pantallas'
import type { CitaItem, EstadoCita } from '../../lib/tipos'
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

/** El texto entre `desde` y el siguiente `hasta` (vacío si falta un marcador: la prueba que lo use falla). */
function bloque(texto: string, desde: string, hasta: string): string {
  const i = texto.indexOf(desde)
  const j = i > -1 ? texto.indexOf(hasta, i + desde.length) : -1
  return i > -1 && j > -1 ? texto.slice(i, j) : ''
}

function cita(id: string, hora: string | null, estado: EstadoCita = 'pendiente', fecha = '2026-10-15', medico = `Dr. ${id}`): CitaItem {
  return {
    id,
    fecha,
    hora,
    tipo: 'medica',
    medico: { id: `m-${id}`, nombre: medico },
    cuenta: null,
    subtipo: null,
    sede: { id: 's1', nombre: 'Clínica Norte', cuenta_nombre: null } as CitaItem['sede'],
    nota: null,
    estado,
    visita_id: estado === 'hecha' ? `v-${id}` : null,
    distancia_m: null,
    dentro_del_radio: null,
    anticipada: true,
    cancelable: estado === 'pendiente',
  }
}

export async function pruebas(t: Probador): Promise<void> {
  t.seccion('19. Resto de pantallas')

  // -------------------------------------------------------------------------
  t.seccion('19a. Hoy: cuándo vuelve a pedir (debeRecargarHoy)')
  {
    const t0 = Date.parse('2026-10-15T10:00:00-05:00')
    t.check('sin carga previa → pide', debeRecargarHoy(null, t0, false))
    t.check('a los 59,999 s, sin invalidar → no pide', !debeRecargarHoy(t0, t0 + 59_999, false))
    t.check('a los 60 s (FRESCURA_SIN_PEDIR_MS) → pide', FRESCURA_SIN_PEDIR_MS === 60_000 && debeRecargarHoy(t0, t0 + FRESCURA_SIN_PEDIR_MS, false))
    t.check('invalidado (visita, cita, día libre) o tiró para actualizar → pide aunque no pasen 60 s', debeRecargarHoy(t0, t0 + 5_000, true))
    const casiMedianoche = Date.parse('2026-10-15T23:59:40-05:00')
    t.check('cambió el día en Bogotá (aunque no pasen 60 s) → pide', debeRecargarHoy(casiMedianoche, casiMedianoche + 30_000, false))
    t.check('el reloj del teléfono volvió atrás → pide', debeRecargarHoy(t0, t0 - 1_000, false))
  }

  // -------------------------------------------------------------------------
  t.seccion('19b. Hoy: la cita de ahora, "Siguiente: …" y "Atrasada"')
  {
    const ahora = new Date('2026-10-15T10:05:00-05:00')
    const c0930 = cita('c0930', '09:30') // 35 min antes: fuera
    const c0940 = cita('c0940', '09:40') // 25 min antes: dentro
    const c1030 = cita('c1030', '10:30', 'pendiente', '2026-10-15', 'Dra. Gómez') // en 25 min: dentro
    const c1110 = cita('c1110', '11:10') // en 65 min: fuera
    const hecha = cita('hecha', '10:00', 'hecha')
    const sinHora = cita('sinhora', null)
    const cancelada = cita('cancelada', '10:10', 'cancelada')
    const manana = cita('manana', '10:10', 'pendiente', '2026-10-16')
    const todas = [c1110, c1030, sinHora, hecha, c0940, cancelada, c0930, manana]

    t.check('citaDeAhora: la pendiente más temprana entre 30 min antes y 60 min después (09:40 a las 10:05)', citaDeAhora(todas, ahora)?.id === 'c0940', citaDeAhora(todas, ahora)?.id)
    t.check(
      'citaDeAhora: sin hora, hechas, canceladas y de otro día no cuentan',
      citaDeAhora([sinHora, hecha, cancelada, manana, c1030], ahora)?.id === 'c1030' && citaDeAhora([sinHora, hecha, cancelada, manana], ahora) === null
    )
    t.check('citaDeAhora: fuera de la ventana (35 min antes, 65 min después) → null', citaDeAhora([c0930, c1110], ahora) === null && citaDeAhora([], ahora) === null)
    t.check(
      'citaDeAhora: los bordes (30 min antes y 60 min después) entran; 31 y 61 no',
      citaDeAhora([cita('a', '09:35')], ahora) !== null &&
        citaDeAhora([cita('b', '11:05')], ahora) !== null &&
        citaDeAhora([cita('c', '09:34')], ahora) === null &&
        citaDeAhora([cita('d', '11:06')], ahora) === null
    )
    t.check('textoSiguienteCita → "Siguiente: 10:30 · Dra. Gómez (en 25 min)"', textoSiguienteCita(c1030, ahora) === 'Siguiente: 10:30 · Dra. Gómez (en 25 min)', textoSiguienteCita(c1030, ahora))
    t.check(
      'textoSiguienteCita: ya pasó su hora → "(hace 25 min)"; a la hora en punto → "(ahora)"',
      textoSiguienteCita(c0940, ahora) === 'Siguiente: 09:40 · Dr. c0940 (hace 25 min)' && textoSiguienteCita(cita('e', '10:05', 'pendiente', '2026-10-15', 'Dra. Ruiz'), ahora) === 'Siguiente: 10:05 · Dra. Ruiz (ahora)',
      [textoSiguienteCita(c0940, ahora)]
    )
    t.check('citaAtrasada: pendiente de hoy con hora pasada → sí (09:40 y 09:30 a las 10:05)', citaAtrasada(c0940, ahora) && citaAtrasada(c0930, ahora))
    t.check(
      'citaAtrasada: con hora por venir, hecha, cancelada, sin hora o de otro día → no',
      !citaAtrasada(c1030, ahora) && !citaAtrasada(hecha, ahora) && !citaAtrasada(cancelada, ahora) && !citaAtrasada(sinHora, ahora) && !citaAtrasada(cita('ayer', '09:00', 'pendiente', '2026-10-14'), ahora)
    )
  }

  // -------------------------------------------------------------------------
  t.seccion('19c. Textos puros: Números, Nueva sede, Días libres, Nuevo médico e Ingreso')
  {
    t.check('faltanVisitas(220, 100, 22, 11) → "Te faltan 120 visitas médicas: 11 por día hábil"', faltanVisitas(220, 100, 22, 11) === 'Te faltan 120 visitas médicas: 11 por día hábil', faltanVisitas(220, 100, 22, 11))
    t.check('faltanVisitas: singular ("Te falta 1 visita médica: 1 por día hábil")', faltanVisitas(10, 9, 20, 19) === 'Te falta 1 visita médica: 1 por día hábil', faltanVisitas(10, 9, 20, 19))
    t.check(
      'faltanVisitas: institucionales y cifras con decimales (hacia arriba)',
      faltanVisitas(30, 10, 20, 10, 'institucional') === 'Te faltan 20 visitas institucionales: 2 por día hábil' && faltanVisitas(10.5, 3, 20, 10) === 'Te faltan 8 visitas médicas: 1 por día hábil',
      [faltanVisitas(30, 10, 20, 10, 'institucional'), faltanVisitas(10.5, 3, 20, 10)]
    )
    t.check(
      'faltanVisitas: null si ya cumplió, si no quedan días, sin cuota o con números no válidos',
      faltanVisitas(100, 100, 22, 11) === null &&
        faltanVisitas(100, 130, 22, 11) === null &&
        faltanVisitas(220, 100, 22, 22) === null &&
        faltanVisitas(0, 0, 22, 11) === null &&
        faltanVisitas(220, 100, 0, 0) === null &&
        faltanVisitas(220, null, 22, 11) === null &&
        faltanVisitas(Number.NaN, 1, 22, 11) === null
    )

    t.check(
      'textoUbicacionTomada → "Ubicación tomada · ±12 m" (y la aproximada y sin precisión)',
      textoUbicacionTomada(12) === 'Ubicación tomada · ±12 m' &&
        textoUbicacionTomada(250.4, true) === 'Ubicación tomada · ±250 m (aproximada)' &&
        textoUbicacionTomada(null) === 'Ubicación tomada',
      [textoUbicacionTomada(12), textoUbicacionTomada(250.4, true), textoUbicacionTomada(null)]
    )

    const items = [
      { fecha: '2026-10-20', estado: 'anulado' as const },
      { fecha: '2026-10-20', estado: 'registrado' as const },
      { fecha: '2026-10-21', estado: 'por_aprobar' as const },
      { fecha: '2026-10-22', estado: 'rechazado' as const },
      { fecha: '2026-10-23', estado: 'anulado' as const },
      { fecha: '2026-10-24', estado: 'aprobado' as const },
      { fecha: '2026-10-25', estado: 'por_aprobar' as const },
      { fecha: '2026-10-25', estado: 'aprobado' as const },
    ]
    const marcas = marcasDiasLibres(items)
    const alReves = marcasDiasLibres([...items].reverse())
    t.check(
      'marcasDiasLibres: cada día vigente con su estado (aprobado, registrado, por aprobar); el vigente manda sobre el anulado, en cualquier orden',
      marcas['2026-10-20']?.estadoLibre === 'registrado' &&
        alReves['2026-10-20']?.estadoLibre === 'registrado' &&
        marcas['2026-10-21']?.estadoLibre === 'por_aprobar' &&
        marcas['2026-10-24']?.estadoLibre === 'aprobado' &&
        marcas['2026-10-25']?.estadoLibre === 'aprobado' &&
        alReves['2026-10-25']?.estadoLibre === 'aprobado',
      marcas
    )
    t.check(
      'marcasDiasLibres: rechazado y anulado no son días libres: no se marcan',
      !('2026-10-22' in marcas) && !('2026-10-23' in marcas) && Object.keys(marcas).length === 4 && Object.keys(alReves).length === 4,
      marcas
    )
    const diezAm = new Date('2026-10-15T10:00:00-05:00')
    t.check(
      'primerDiaRegistrable: con 24 h, ayer; sin plazo, hoy; con 48 h, anteayer',
      primerDiaRegistrable('2026-10-15', 24, diezAm) === '2026-10-14' && primerDiaRegistrable('2026-10-15', 0, diezAm) === '2026-10-15' && primerDiaRegistrable('2026-10-15', 48, diezAm) === '2026-10-13',
      [primerDiaRegistrable('2026-10-15', 24, diezAm), primerDiaRegistrable('2026-10-15', 0, diezAm), primerDiaRegistrable('2026-10-15', 48, diezAm)]
    )

    const vacio = { errorDocumento: 'Escribe el número de documento del médico', nombre: '  ', municipio: null, especialidades: 0, sedes: 0 }
    const alVerificar = erroresNuevoMedico(vacio, 'verificar')
    const alCrear = erroresNuevoMedico({ errorDocumento: null, nombre: 'Ana Gómez', municipio: '11001', especialidades: 0, sedes: 0 }, 'crear')
    t.check(
      'erroresNuevoMedico: al verificar, documento, nombre y ciudad, cada uno en su campo (todos a la vez)',
      alVerificar.documento === 'Escribe el número de documento del médico' &&
        alVerificar.nombre === 'Escribe el nombre completo del médico' &&
        alVerificar.ciudad === 'Elige la ciudad del médico' &&
        !('especialidad' in alVerificar) &&
        !('sedes' in alVerificar),
      alVerificar
    )
    t.check(
      'erroresNuevoMedico: al crear, además especialidad y sedes; completo → sin errores',
      alCrear.especialidad === 'Elige al menos una especialidad' &&
        alCrear.sedes === 'Elige al menos una sede donde atiende' &&
        Object.keys(alCrear).length === 2 &&
        Object.keys(erroresNuevoMedico({ errorDocumento: null, nombre: 'Ana Gómez', municipio: '11001', especialidades: 1, sedes: 1 }, 'crear')).length === 0,
      alCrear
    )

    const nada = faltaParaEntrar('', '')
    t.check(
      'faltaParaEntrar: explica lo que falta en cada campo',
      nada.correo === 'Escribe tu correo' &&
        nada.contrasena === 'Escribe tu contraseña' &&
        faltaParaEntrar('juan', 'x').correo === 'Revisa el correo: va como nombre@empresa.com' &&
        faltaParaEntrar(' juan@vg.com ', '').correo === null &&
        faltaParaEntrar('juan@vg.com', 'x').contrasena === null,
      nada
    )
  }

  // -------------------------------------------------------------------------
  t.seccion('19d. Hoy: lo guardado primero, recarga a los 60 s o al invalidar, y la cita se toca para reportarla')
  {
    const hoy = leer('app/(app)/hoy.tsx')
    const pintar = bloque(hoy, '// Primero lo que ya hay', 'const cargarUnaVez = useCallback(')
    const unaVez = bloque(hoy, 'const cargarUnaVez = useCallback(', 'const cargar = useCallback(')
    const cargarTs = bloque(hoy, 'const cargar = useCallback(', '  useFocusEffect(')
    const alEnfocar = bloque(hoy, '  useFocusEffect(', '  // Una visita guardada')
    const alInvalidar = bloque(hoy, 'escucharInvalidacion(', '\n  )\n')
    const tirar = bloque(hoy, 'const refrescar = () => {', '\n  }\n')
    const reportarCita = bloque(hoy, 'const reportarCita = (cita: CitaItem) => {', '\n  }\n')
    const agendaDeHoy = bloque(hoy, 'function AgendaDeHoy(', '\nfunction Avance(')

    t.check(
      'Hoy: pinta primero el contexto en memoria (menos de 3 min) o el guardado hoy, sin pisar uno más nuevo',
      /contextoReciente\(\{ maxEdadMs: FRESCURA_PINTAR_MS \}\)/.test(pintar) &&
        /leerContextoGuardado\(sesion\.current\.usuarioId\)/.test(pintar) &&
        (pintar.match(/setContexto\(actual => actual \?\? /g) ?? []).length === 2
    )
    t.check(
      'Hoy: mientras actualiza muestra "Actualizando…" sin tapar la pantalla (no es la pantalla de carga)',
      /\{actualizando && !refrescando \? \(\s*<Texto suave peque>\s*Actualizando…\s*<\/Texto>/.test(hoy) &&
        /setActualizando\(true\)/.test(cargarTs) &&
        /finally \{[^}]*setActualizando\(false\)/.test(cargarTs) &&
        /if \(cargando && !contexto && !visitas\) return <Cargando/.test(hoy)
    )
    t.check(
      'Hoy: al recibir el foco decide con debeRecargarHoy (60 s o invalidado); si no, solo intenta enviar la cola',
      /if \(debeRecargarHoy\(ultimaCarga\.current, Date\.now\(\), invalidado\.current\)\) void cargar\(\)\s*else void reintentar\(\)/.test(alEnfocar)
    )
    t.check(
      'Hoy: escucha las invalidaciones (marca invalidado y, si está a la vista, vuelve a pedir)',
      /invalidado\.current = true\s*if \(enfocada\.current\) void cargar\(\)/.test(alInvalidar)
    )
    t.check('Hoy: tirar para actualizar invalida y pide sin reusar la memoria', /invalidado\.current = true\s*void cargar\(true\)/.test(tirar))
    t.check(
      'Hoy: reusa un contexto de menos de 60 s pedido cerca (salvo forzado) y si no, POST con el punto; la ultima carga es la de ese contexto',
      /const reciente = forzar \? null : contextoReciente\(\{ maxEdadMs: FRESCURA_SIN_PEDIR_MS, cercaDe: punto \?/.test(unaVez) &&
        /: api\.contexto\(punto \?/.test(unaVez) &&
        /return reciente\.recibidoEn/.test(unaVez) &&
        /ultimaCarga\.current = llegada/.test(unaVez)
    )
    t.check(
      'Hoy: sigue pidiendo con la primera ubicación (pedirUbicacionEnDosPasos(...).primera) antes del contexto',
      unaVez.indexOf('await pedirUbicacionEnDosPasos({ timeoutMs: 8_000 }).primera') > -1 &&
        unaVez.indexOf('await pedirUbicacionEnDosPasos({ timeoutMs: 8_000 }).primera') < unaVez.indexOf('contextoReciente(')
    )
    t.check(
      'Hoy: lo que se invalida mientras pide se vuelve a pedir una vez (no se queda viejo)',
      /invalidado\.current = false\s*await cargarUnaVez\(forzar \|\| vuelta > 0\)/.test(cargarTs) && /while \(invalidado\.current && enfocada\.current && vuelta < 2\)/.test(cargarTs)
    )
    t.check(
      'Hoy: tocar una cita pendiente → fijarCitaParaReportar(cita.id) y a Reportar',
      /fijarCitaParaReportar\(cita\.id\)\s*router\.push\('\/reportar'\)/.test(reportarCita) &&
        /alPresionar=\{cita\.estado === 'pendiente' \? \(\) => alReportarCita\(cita\) : cita\.visita_id \?/.test(agendaDeHoy) &&
        /alReportarCita=\{reportarCita\}/.test(hoy)
    )
    t.check(
      'Hoy: arriba de la agenda, "Siguiente: …" (citaDeAhora) que también lleva a reportarla; "Atrasada" en las de hora pasada',
      /const deAhora = citaDeAhora\(ordenadas, ahora\)/.test(agendaDeHoy) &&
        /titulo=\{textoSiguienteCita\(deAhora, ahora\)\}[^>]*alPresionar=\{\(\) => alReportarCita\(deAhora\)\}/.test(agendaDeHoy) &&
        /\{citaAtrasada\(cita, ahora\) \? <Insignia texto="Atrasada" tono="alerta" \/> : null\}/.test(agendaDeHoy)
    )
    t.check(
      'Hoy: "Visitas de hoy" dice que carga (no "Todavía no has reportado") mientras no llegan',
      hoy.indexOf('!visitas ? (\n          <Vacio texto="Cargando tus visitas de hoy…" />') > -1 &&
        hoy.indexOf('<Vacio texto="Cargando tus visitas de hoy…" />') < hoy.indexOf('<Vacio texto="Todavía no has reportado visitas hoy." />')
    )
  }

  // -------------------------------------------------------------------------
  t.seccion('19e. Ajustes, Días libres y Números')
  {
    const ajustes = leer('app/(app)/ajustes.tsx')
    const entrada = bloque(ajustes, "<Tarjeta alPresionar={() => router.push('/dias-libres')}", '</Tarjeta>')
    t.check(
      'Ajustes: "Mis días libres" abre /dias-libres (toda la fila, de 44 pt o más)',
      /<Subtitulo>Mis días libres<\/Subtitulo>/.test(entrada) && /minHeight: ALTO_TOQUE_MIN/.test(entrada)
    )

    const dias = leer('app/(app)/dias-libres.tsx')
    const registrar = bloque(dias, 'async function registrar() {', '\n  }\n')
    const anular = bloque(dias, 'async function anular(dia: DiaLibreItem) {', '\n  }\n')
    t.check(
      'Días libres: la fecha se elige en CalendarioMes, con los días libres por estado y desde el primer día que aún se puede',
      /<CalendarioMes valor=\{fecha\} alCambiar=\{setFecha\} hoy=\{hoy\} desde=\{primerDia\} marcas=\{marcas\}/.test(dias) &&
        /const marcas = useMemo\(\(\) => marcasDiasLibres\(datos\?\.items \?\? \[\]\), \[datos\]\)/.test(dias) &&
        /const primerDia = primerDiaRegistrable\(hoy, plazoHoras\)/.test(dias) &&
        !/sumarDias\(f, [-]?1\)/.test(dias)
    )
    t.check(
      'Días libres: registrar y anular invalidan el contexto (dia_libre) después de la respuesta del servidor',
      registrar.indexOf("invalidarContexto('dia_libre')") > registrar.indexOf('await api.crearDiaLibre(') &&
        registrar.indexOf('await api.crearDiaLibre(') > -1 &&
        registrar.indexOf("invalidarContexto('dia_libre')") < registrar.indexOf('} catch') &&
        anular.indexOf("invalidarContexto('dia_libre')") > anular.indexOf('await api.anularDiaLibre(') &&
        anular.indexOf('await api.anularDiaLibre(') > -1 &&
        anular.indexOf("invalidarContexto('dia_libre')") < anular.indexOf('} catch')
    )

    const numeros = leer('app/(app)/numeros.tsx')
    const cargarNumeros = bloque(numeros, 'const cargar = useCallback(async (mesPedido: string) => {', '\n  }, [])')
    t.check(
      'Números: al cambiar de mes, las cifras del anterior se atenúan con "Cargando <mes>…"',
      /const otroMes = datos !== null && datos\.mes !== mes/.test(numeros) &&
        /\{`Cargando \$\{nombreMes\(mes\)\}…`\}/.test(numeros) &&
        /opacity: otroMes \? 0\.35 : 1, pointerEvents: otroMes \? 'none' : 'auto'/.test(numeros)
    )
    t.check(
      'Números: la respuesta de un mes que ya no se ve se descarta (solo el último pedido cuenta)',
      /const pedido = \+\+ultimoPedido\.current/.test(cargarNumeros) && /if \(vigente\(\)\) setDatos\(nuevos\)/.test(cargarNumeros) && !/\bsetDatos\(\{/.test(cargarNumeros)
    )
    t.check(
      'Números: "Te faltan …" con faltanVisitas, solo en el mes en curso y con lo hecho',
      /enCurso && numeros \? faltanVisitas\(cuota\[tipo\]\.cuota, numeros\.hechas\[tipo\], cuota\.dias_habiles, cuota\.dias_habiles_transcurridos, tipo\) : null/.test(numeros) &&
        /enCurso=\{datos\.mes === mesActual\}/.test(numeros) &&
        /falta=\{falta\('medica'\)\}/.test(numeros) &&
        /falta=\{falta\('institucional'\)\}/.test(numeros)
    )
  }

  // -------------------------------------------------------------------------
  t.seccion('19f. Visita, Nueva sede, Nuevo médico e Ingreso')
  {
    const visita = leer('app/(app)/visita/[id].tsx')
    const agendar = bloque(visita, 'const agendarProxima =', '      : null\n')
    t.check(
      'Visita: Conclusión, Compromisos y Motivo con la etiqueta arriba y el texto a todo el ancho (no en Fila)',
      /<Apilado etiqueta="Conclusión">\{visita\.conclusion\}<\/Apilado>/.test(visita) &&
        /<Apilado etiqueta="Compromisos">\{visita\.compromisos\}<\/Apilado>/.test(visita) &&
        !/<Fila etiqueta="(Conclusión|Compromisos|Motivo)"/.test(visita)
    )
    t.check(
      'Visita: "Agendar la próxima reunión" solo con la próxima dentro de hoy..hoy + 30 (fijarPedidoAgendar + rutaAgendar)',
      /proxima && puedeAgendarProxima\(proxima, hoyBogota\(\)\)/.test(agendar) &&
        /fijarPedidoAgendar\(\{ tipo: visita\.tipo, medico_id: visita\.medico\?\.id \?\? null, cuenta_id: visita\.cuenta\?\.id \?\? null, subtipo_id: visita\.subtipo\?\.id \?\? null, sede_id: visita\.sede\.id \}\)\s*router\.push\(rutaAgendar\(\{ fecha: proxima \}\)\)/.test(agendar) &&
        /\{agendarProxima && proxima \? \(\s*<Boton titulo="Agendar la próxima reunión"/.test(visita)
    )
    t.check(
      'Visita: líneas y voz del contexto en memoria de menos de 10 min; solo si no hay, GET /api/me/contexto',
      /const enMemoria = contextoReciente\(\{ maxEdadMs: FRESCURA_DATOS_FIJOS_MS \}\)/.test(visita) &&
        /enMemoria \? Promise\.resolve\(enMemoria\.contexto\) : api\.contexto\(null\)\.catch\(\(\) => null\)/.test(visita) &&
        (visita.match(/api\.contexto\(/g) ?? []).length === 1
    )
    t.check('Visita: "data manager" pasa a "el equipo de datos"', /Suma cuando el equipo de datos confirme la sede/.test(visita))

    const sede = leer('app/(app)/sede/nueva.tsx')
    const pieSede = bloque(sede, 'pie={', '\n    >\n')
    t.check(
      'Nueva sede: "Ubicación tomada · ±N m" (textoUbicacionTomada), sin coordenadas en pantalla',
      /\{textoUbicacionTomada\(ubicacion\.precision, ubicacion\.aproximada\)\}/.test(sede) && !/toFixed\(6\)/.test(sede)
    )
    t.check(
      'Nueva sede: "Crear sede" fijo al pie con el aviso encima, y cada falta junto a su campo',
      /<Boton titulo="Crear sede"/.test(pieSede) &&
        /avisoPie \? <Aviso tono="peligro">\{avisoPie\}<\/Aviso>/.test(pieSede) &&
        (sede.match(/<Boton titulo="Crear sede"/g) ?? []).length === 1 &&
        /error=\{intentado \? faltas\.nombre : null\}/.test(sede) &&
        /intentado && faltas\.cuenta \? <ErrorCampo/.test(sede) &&
        /intentado && faltas\.municipio \? <ErrorCampo/.test(sede)
    )

    const medico = leer('app/(app)/medico/nuevo.tsx')
    const accion = bloque(medico, 'const accion =', 'const avisoPie =')
    const pieMedico = bloque(medico, 'pie={', '\n    >\n')
    t.check(
      'Nuevo médico: "Crear médico" (y "Verificar") en Pantalla.pie, con el error del servidor encima',
      /paso === 'datos' \? \(\s*<Boton titulo="Crear médico"/.test(accion) &&
        /<Boton titulo="Verificar"/.test(accion) &&
        (medico.match(/<Boton titulo="Crear médico"/g) ?? []).length === 1 &&
        (medico.match(/<Boton titulo="Verificar"/g) ?? []).length === 1 &&
        /\{avisoPie \? <Aviso tono="peligro">\{avisoPie\}<\/Aviso> : null\}\s*\{accion\}/.test(pieMedico)
    )
    t.check(
      'Nuevo médico: cada error junto a su campo (erroresNuevoMedico): nombre, ciudad, especialidad y sedes',
      /erroresNuevoMedico\(/.test(medico) &&
        /error=\{errores\.nombre \?\? null\}/.test(medico) &&
        /\{errores\.ciudad \? <ErrorCampo texto=\{errores\.ciudad\} \/> : null\}/.test(medico) &&
        /\{errores\.especialidad \? <ErrorCampo texto=\{errores\.especialidad\} \/> : null\}/.test(medico) &&
        /\{errores\.sedes \? <ErrorCampo texto=\{errores\.sedes\} \/> : null\}/.test(medico) &&
        !/return setError\('Elige al menos/.test(medico)
    )
    t.check(
      'Nuevo médico: sigue creando el consultorio con la final (await pedido.puntoFinal)',
      /const punto = pedido\?\.puntoFinal \? await pedido\.puntoFinal/.test(medico)
    )

    const pantallas = ['app/(app)/hoy.tsx', 'app/(app)/dias-libres.tsx', 'app/(app)/numeros.tsx', 'app/(app)/ajustes.tsx', 'app/(app)/visita/[id].tsx', 'app/(app)/medico/nuevo.tsx', 'app/(app)/sede/nueva.tsx', 'app/(auth)/login.tsx']
    const conDataManager = pantallas.filter(ruta => /data manager/i.test(leer(ruta)))
    t.check('ninguna pantalla del paquete 5 dice "data manager" (dice "el equipo de datos")', conDataManager.length === 0, conDataManager)

    const login = leer('app/(auth)/login.tsx')
    const correo = bloque(login, 'etiqueta="Correo"', '/>')
    const contrasena = bloque(login, '{...refContrasena}', '/>')
    t.check(
      'Ingreso: "Siguiente" en el correo pasa a la contraseña (onSubmitEditing → focus)',
      /returnKeyType="next"/.test(correo) &&
        /onSubmitEditing=\{\(\) => contrasena\.current\?\.focus\(\)\}/.test(correo) &&
        /const refContrasena = \{ ref: contrasena \}/.test(login) &&
        /etiqueta="Contraseña"/.test(contrasena)
    )
    t.check(
      'Ingreso: "Entrar" no se apaga y explica lo que falta junto a cada campo (faltaParaEntrar)',
      /<Boton titulo="Entrar" alPresionar=\{\(\) => void alEntrar\(\)\} cargando=\{enviando\} \/>/.test(login) &&
        /const falta = faltaParaEntrar\(email, password\)/.test(login) &&
        /error=\{intentado \? falta\.correo : null\}/.test(correo) &&
        /error=\{intentado \? falta\.contrasena : null\}/.test(contrasena) &&
        /setIntentado\(true\)\s*if \(!listo\) return/.test(login)
    )
  }
}
