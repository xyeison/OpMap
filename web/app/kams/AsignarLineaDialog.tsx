'use client'

// Confirmación de "Darle <línea> a <persona>" / "Quitarle <línea> a <persona>" de la página Zonas (spec 2026-10-23, E2:
// toda escritura muestra antes la vista previa simulada). Se abre desde el interruptor que hay junto a cada persona o
// vacante de "Vive aquí", así que casi siempre llega con UNA persona ya elegida; si llegan varias (celdas de Bogotá), se
// elige con radios. Flujo de un solo paso (dueño, 2026-10-23: "tienes que mejorar muchísimo la usabilidad"):
//   1. Al abrir, pide sola la vista previa: POST /api/coverage/simular con un cambio { tipo: 'linea_agregar' |
//      'linea_quitar', executive_id, line_id }. La ruta nunca escribe; devuelve las celdas (línea, Zona) que cambian, con
//      nombres y estados, el resumen por estado y, al quitar, medicosQuePierdenVisitante (los médicos de esa persona en
//      esa línea con visitante vigente, que el disparador 0820 termina sin vuelta atrás). Para Bogotá, al dar la línea a
//      quien vive en una celda la vista previa muestra las cuatro.
//   2. "Confirmar": PUT (dar) o DELETE (quitar) /api/executives/[id]/lineas/[lineId], que inserta o borra executive_lines y
//      recalcula la cobertura sin Google. Al quitar con médicos, antes hay que marcar "Entiendo…".
// La restricción de la dirección (lineasPermitidas) bloquea la opción con "La dirección limitó a <nombre> a: <líneas>"; la
// API vuelve a validarlo (409). Un fallo de red (el "Load failed" del navegador) se muestra en español con "Reintentar".
// Escape cierra y el foco entra al título.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AvisoAtencion, CAPA_MODAL, claseBotonPrimario, claseBotonSecundario, Modal } from '@/components/terceros/comun'
import { readError } from '@/app/lines/coverage-shared'
import { useVentanaAccesible } from '@/app/executives/zona-bloques'
import { ESTADO_PLAZA_LABELS, ESTADOS_PLAZA, type SimularDiffCelda, type SimularResponse, type ZonaResidente } from '@/lib/types/zonas'
import { ESTADO_BADGE, ESTADO_PLAZA_PLURAL, motivoNoPuedeDar, nombreLinea, nombreZona, numero, quienesYaLaLlevan, textoPuedeTener } from './zonas-ui'

export type ModoAsignar = 'dar' | 'quitar'

/** Quien vive en la Zona (o en una celda de Bogotá), con la Zona en la que vive para mostrarla. */
export interface ResidenteElegible extends ZonaResidente {
  kam_id: string
  zonaNombre: string
}

interface Props {
  modo: ModoAsignar
  linea: { id: string; code: string; name: string }
  /** Líneas visibles (ZonasResponse.lineas), para dar nombre a los códigos. */
  lineas: ReadonlyArray<{ code: string; name: string }>
  /** "Barranquilla" o "Bogotá (4 zonas)". */
  zonaNombre: string
  esBogota: boolean
  residentes: ResidenteElegible[]
  residenteInicial?: string | null
  onCerrar: () => void
  /** Se guardó: mensaje para la página (que recarga la tabla). */
  onGuardado: (mensaje: string) => void
}

/** Respuesta de PUT/DELETE /api/executives/[id]/lineas/[lineId] (spec, tabla de rutas). */
interface RespuestaGuardar {
  ejecutivo?: { id: string; nombre: string; status: string; lineas: string[] }
  medicosTerminados?: number
  cobertura?: { recalculada: boolean }
}

/** Un fallo de red del navegador ("Load failed", "Failed to fetch") en español; lo demás, tal cual. */
function mensajeDeError(err: unknown, fallback: string): string {
  if (err instanceof TypeError || (err instanceof Error && /load failed|failed to fetch|networkerror/i.test(err.message))) {
    return 'No hay conexión con el servidor. Reintenta en unos segundos.'
  }
  return err instanceof Error && err.message ? err.message : fallback
}

export default function AsignarLineaDialog({
  modo,
  linea,
  lineas,
  zonaNombre,
  esBogota,
  residentes,
  residenteInicial = null,
  onCerrar,
  onGuardado,
}: Props) {
  useVentanaAccesible(onCerrar)
  const tituloRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    tituloRef.current?.focus()
  }, [])

  // Con residenteInicial (el interruptor de la tabla) solo esa persona; si no, quitar = quienes llevan la línea, dar = todos.
  const elegibles = useMemo(() => {
    const base = modo === 'quitar' ? residentes.filter(residente => residente.lineas.includes(linea.code)) : residentes
    const lista = residenteInicial ? base.filter(residente => residente.id === residenteInicial) : base
    return lista.slice().sort((a, b) => a.zonaNombre.localeCompare(b.zonaNombre, 'es') || a.nombre.localeCompare(b.nombre, 'es'))
  }, [modo, residentes, linea.code, residenteInicial])

  const [executiveId, setExecutiveId] = useState<string>(() => {
    if (residenteInicial && elegibles.some(residente => residente.id === residenteInicial)) return residenteInicial
    const posibles = modo === 'dar' ? elegibles.filter(residente => !motivoNoPuedeDar(residente, linea, lineas)) : elegibles
    return posibles.length === 1 ? posibles[0].id : ''
  })
  const [simulacion, setSimulacion] = useState<SimularResponse | null>(null)
  // Quitar: "Entiendo que N médicos quedan sin visitante" (se desmarca al cambiar de persona o volver a calcular)
  const [confirmaMedicos, setConfirmaMedicos] = useState(false)
  const [simulando, setSimulando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  // Dar cuando otra persona de la misma Zona ya lleva la línea: en vez de dejar la Zona en conflicto, se le quita a esa
  // (pasarDe) y se le da a la elegida en un solo paso (dueño, 2026-10-24: "advierta que debe quitarle a una para
  // ponérsela a la otra").
  const [pasarDe, setPasarDe] = useState<string | null>(null)

  const elegido = elegibles.find(residente => residente.id === executiveId) ?? null
  const motivo = elegido && modo === 'dar' ? motivoNoPuedeDar(elegido, linea, lineas) : null
  const yaLaLlevan = useMemo(() => (modo === 'dar' ? quienesYaLaLlevan(residentes, linea.code, executiveId || null) : []), [modo, residentes, linea.code, executiveId])
  const origen = pasarDe ? residentes.find(residente => residente.id === pasarDe) ?? null : null
  // Dar sin pasar, con alguien más de la Zona llevando la línea: la Zona quedaría en conflicto → se exige pasar o quitar antes
  const bloqueadoPorConflicto = modo === 'dar' && !pasarDe && yaLaLlevan.length > 0

  const elegir = (id: string) => {
    setExecutiveId(id)
    setPasarDe(null)
    setSimulacion(null)
    setConfirmaMedicos(false)
    setError('')
  }

  const elegirPasarDe = (id: string | null) => {
    setPasarDe(id)
    setSimulacion(null)
    setConfirmaMedicos(false)
    setError('')
  }

  const previsualizar = useCallback(async () => {
    if (!elegido || motivo || bloqueadoPorConflicto) return
    setSimulando(true)
    setError('')
    try {
      const cambios =
        modo === 'quitar'
          ? [{ tipo: 'linea_quitar', executive_id: elegido.id, line_id: linea.id }]
          : [
              ...(origen ? [{ tipo: 'linea_quitar', executive_id: origen.id, line_id: linea.id }] : []),
              { tipo: 'linea_agregar', executive_id: elegido.id, line_id: linea.id },
            ]
      const response = await fetch('/api/coverage/simular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cambios }),
      })
      if (!response.ok) throw new Error(await readError(response, 'No se pudo calcular qué cambia'))
      const body = (await response.json().catch(() => null)) as SimularResponse | null
      if (!body || !Array.isArray(body.diff) || !body.resumen || typeof body.resumen !== 'object') {
        throw new Error('Respuesta inesperada del servidor')
      }
      setConfirmaMedicos(false)
      setSimulacion(body)
    } catch (err: unknown) {
      console.error('Error simulando el cambio de línea:', err)
      setError(mensajeDeError(err, 'No se pudo calcular qué cambia'))
    } finally {
      setSimulando(false)
    }
  }, [elegido, motivo, bloqueadoPorConflicto, modo, origen, linea.id])

  // La vista previa se pide sola al abrir y cada vez que cambia la persona elegida (o de quién se pasa): un paso menos.
  const ultimaSimulada = useRef<string | null>(null)
  useEffect(() => {
    if (!elegido || motivo || bloqueadoPorConflicto || simulacion || simulando) return
    const clave = `${elegido.id}:${pasarDe ?? ''}`
    if (ultimaSimulada.current === clave) return
    ultimaSimulada.current = clave
    void previsualizar()
  }, [elegido, motivo, bloqueadoPorConflicto, pasarDe, simulacion, simulando, previsualizar])

  const reintentar = () => {
    ultimaSimulada.current = null
    setSimulacion(null)
    setError('')
  }

  // Quitar (o pasar): cuántos médicos de quien pierde la línea perderían visitante (de la vista previa). null = la ruta
  // no lo trajo (versión vieja del servidor): se pide confirmar igual, porque el borrado no tiene vuelta atrás.
  const pierdeLaLinea = modo === 'quitar' ? elegido : origen
  const medicosQuePierden = useMemo<number | null>(() => {
    if (!pierdeLaLinea || !simulacion) return null
    const lista = Array.isArray(simulacion.medicosQuePierdenVisitante) ? simulacion.medicosQuePierdenVisitante : null
    const fila = lista?.find(item => item.executive_id === pierdeLaLinea.id && item.line_id === linea.id)
    return fila && Number.isFinite(fila.medicos) ? fila.medicos : null
  }, [pierdeLaLinea, simulacion, linea.id])
  const requiereConfirmacion = pierdeLaLinea !== null && simulacion !== null && (medicosQuePierden === null || medicosQuePierden > 0)
  const faltaConfirmar = requiereConfirmacion && !confirmaMedicos

  const guardar = async () => {
    if (!elegido || motivo || bloqueadoPorConflicto || !simulacion || faltaConfirmar) return
    setGuardando(true)
    setError('')
    try {
      // Pasar: primero se le quita a quien la lleva (si falla, no se le da a nadie y la Zona queda como estaba)
      let medicosDelOrigen: number | null = null
      if (modo === 'dar' && origen) {
        const quitada = await fetch(`/api/executives/${encodeURIComponent(origen.id)}/lineas/${encodeURIComponent(linea.id)}`, { method: 'DELETE' })
        if (!quitada.ok) throw new Error(await readError(quitada, `No se pudo quitarle ${linea.name} a ${origen.nombre}`))
        const cuerpo = ((await quitada.json().catch(() => null)) ?? {}) as RespuestaGuardar
        medicosDelOrigen = typeof cuerpo.medicosTerminados === 'number' ? cuerpo.medicosTerminados : null
      }
      const response = await fetch(`/api/executives/${encodeURIComponent(elegido.id)}/lineas/${encodeURIComponent(linea.id)}`, {
        method: modo === 'dar' ? 'PUT' : 'DELETE',
      })
      if (!response.ok) {
        const base = modo === 'dar' ? 'No se pudo dar la línea' : 'No se pudo quitar la línea'
        const detalle = await readError(response, base)
        throw new Error(origen ? `Se le quitó ${linea.name} a ${origen.nombre}, pero no se pudo dar a ${elegido.nombre}: ${detalle}` : detalle)
      }
      const body = ((await response.json().catch(() => null)) ?? {}) as RespuestaGuardar
      const recalculada = body.cobertura?.recalculada !== false
      const nombre = body.ejecutivo?.nombre ?? elegido.nombre
      const coberturaTexto = recalculada ? ' La cobertura se recalculó.' : ' Se guardó, pero no se pudo recalcular la cobertura: usa "Recalcular cobertura" en Líneas.'
      if (modo === 'dar' && origen) {
        const medicosTexto =
          medicosDelOrigen === null ? '' : medicosDelOrigen === 0 ? '' : ` ${numero(medicosDelOrigen)} ${medicosDelOrigen === 1 ? 'médico quedó' : 'médicos quedaron'} sin visitante.`
        onGuardado(`${linea.name} pasó de ${origen.nombre} a ${nombre} en ${zonaNombre}.${medicosTexto}${coberturaTexto}`)
      } else if (modo === 'dar') {
        onGuardado(`${nombre} ahora lleva ${linea.name} en ${zonaNombre}.${coberturaTexto}`)
      } else {
        const medicos = typeof body.medicosTerminados === 'number' ? body.medicosTerminados : null
        const medicosTexto =
          medicos === null
            ? ''
            : medicos === 0
              ? ' Ningún médico de esa línea tenía visitante.'
              : ` ${numero(medicos)} ${medicos === 1 ? 'médico de esa línea quedó' : 'médicos de esa línea quedaron'} sin visitante.`
        onGuardado(`Se le quitó ${linea.name} a ${nombre}.${medicosTexto}${coberturaTexto}`)
      }
    } catch (err: unknown) {
      console.error('Error guardando el cambio de línea:', err)
      setError(mensajeDeError(err, 'No se pudo guardar el cambio'))
      setGuardando(false)
    }
  }

  // Solo las celdas de esta línea (la ruta ya recorta a las líneas del usuario), por nombre de Zona
  const diff = useMemo<SimularDiffCelda[]>(
    () =>
      (simulacion?.diff ?? [])
        .filter(celda => celda.line_id === linea.id)
        .slice()
        .sort((a, b) => nombreZona(a.zona).localeCompare(nombreZona(b.zona), 'es')),
    [simulacion, linea.id]
  )
  const resumen = simulacion?.resumen[linea.code] ?? null

  const verbo = modo === 'dar' ? (origen ? 'Pasar' : 'Darle') : 'Quitarle'
  const titulo = origen && elegido ? `Pasar ${linea.name} de ${origen.nombre} a ${elegido.nombre}` : elegido ? `${verbo} ${linea.name} a ${elegido.nombre}` : `${verbo} ${linea.name}`
  const puedeConfirmar = !!elegido && !motivo && !bloqueadoPorConflicto && !!simulacion && !faltaConfirmar && !guardando && !simulando

  return (
    <Modal titulo={titulo} subtitulo={zonaNombre} onCerrar={onCerrar} ancho="sm:max-w-2xl" capa={CAPA_MODAL}>
      <div className="min-h-full flex flex-col">
        <div className="flex-1 p-4 sm:p-6 space-y-5 min-w-0">
          <h3 ref={tituloRef} tabIndex={-1} className="sr-only focus:outline-none">
            {titulo}
          </h3>

          {/* A quién: una persona ya elegida (tarjeta) o varias (radios, celdas de Bogotá) */}
          {elegibles.length === 0 ? (
            <p className="p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-600">
              {modo === 'dar' ? `Nadie vive en ${zonaNombre}.` : `Nadie de ${zonaNombre} lleva ${linea.name}.`}
            </p>
          ) : elegibles.length === 1 && elegido ? (
            <TarjetaPersona residente={elegido} linea={linea} lineas={lineas} mostrarZona={esBogota} bloqueo={motivo} />
          ) : (
            <ul className="space-y-2" role="radiogroup" aria-label="Ejecutivo Comercial o vacante">
              {elegibles.map(residente => {
                const bloqueo = modo === 'dar' ? motivoNoPuedeDar(residente, linea, lineas) : null
                const seleccionado = residente.id === executiveId
                return (
                  <li key={residente.id}>
                    <label
                      className={`flex items-start gap-3 p-3 border rounded-lg transition-colors ${
                        bloqueo ? 'border-gray-200 bg-gray-50 cursor-not-allowed' : seleccionado ? 'border-gray-900 bg-gray-50 cursor-pointer' : 'border-gray-200 hover:bg-gray-50 cursor-pointer'
                      }`}
                    >
                      <input
                        type="radio"
                        name="residente"
                        value={residente.id}
                        checked={seleccionado}
                        disabled={!!bloqueo || guardando}
                        onChange={() => elegir(residente.id)}
                        className="mt-1 h-4 w-4 border-gray-300 text-gray-900 focus:ring-gray-700"
                      />
                      <span className="min-w-0 flex-1">
                        <DetallePersona residente={residente} linea={linea} lineas={lineas} mostrarZona={esBogota} bloqueo={bloqueo} />
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
          )}

          {/* Otra persona de la misma Zona ya lleva la línea: avisar y ofrecer pasarla en un solo paso */}
          {modo === 'dar' && elegido && yaLaLlevan.length > 0 && (
            <AvisoAtencion>
              {origen ? (
                <>
                  <p className="font-semibold">
                    Se le quita {linea.name} a {origen.nombre} y se le da a {elegido.nombre}.
                  </p>
                  <p className="mt-1">Abajo sale cómo queda la cobertura y cuántos médicos de {origen.nombre} quedan sin visitante.</p>
                  <button type="button" onClick={() => elegirPasarDe(null)} className="mt-2 text-sm underline underline-offset-2">
                    Volver
                  </button>
                </>
              ) : (
                <>
                  <p className="font-semibold">
                    En {zonaNombre}, {yaLaLlevan.map(residente => residente.nombre).join(' y ')} ya {yaLaLlevan.length === 1 ? 'lleva' : 'llevan'} {linea.name}.
                  </p>
                  <p className="mt-1">
                    Dos personas de la misma Zona con la misma línea quedan en conflicto. Quítasela primero a quien la lleva, o pásala a {elegido.nombre} en un solo paso:
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {yaLaLlevan.map(residente => (
                      <button
                        key={residente.id}
                        type="button"
                        onClick={() => elegirPasarDe(residente.id)}
                        className="px-3 py-1.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800"
                      >
                        Pasarla de {residente.nombre} a {elegido.nombre}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </AvisoAtencion>
          )}

          <p className="text-sm text-gray-600">
            {modo === 'dar'
              ? `Al darle ${linea.name}, ${elegido?.status === 'placeholder' ? 'la Zona queda reservada para esa vacante hasta que se contrate' : 'esa persona pasa a atender la Zona en esa línea'} y, por alcance, las Zonas vecinas que nadie cubra dentro del tope.`
              : `Al quitarle ${linea.name}, la Zona pasa a atenderla la persona más cercana que lleve la línea dentro del tope, o queda sin cobertura. Sus médicos de esta línea quedan sin visitante y nada lo deshace.`}
          </p>
          {esBogota && modo === 'dar' && (
            <AvisoAtencion>
              Bogotá se parte en cuatro Zonas. Al dar la línea a quien vive en una de ellas, las otras tres le llegan por alcance (26 a 30 minutos)
              si nadie local las lleva: abajo salen las cuatro.
            </AvisoAtencion>
          )}

          {/* Qué cambia: se calcula solo al abrir */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h3 className="text-base font-bold text-gray-900">Qué cambia</h3>
              <span className="text-xs text-gray-500">Cálculo en memoria con las distancias ya conocidas: no escribe nada ni consulta Google.</span>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm break-words flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <span>{error}</span>
                {!simulacion && (
                  <button type="button" onClick={reintentar} className="self-start sm:self-auto px-3 py-1.5 bg-white border border-red-300 text-red-700 rounded-lg text-sm font-medium hover:bg-red-100">
                    Reintentar
                  </button>
                )}
              </div>
            )}

            {simulando && (
              <p className="flex items-center gap-2 text-sm text-gray-600">
                <svg className="animate-spin h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                Calculando qué cambia…
              </p>
            )}

            {!simulando && !error && !simulacion && elegido && motivo && <p className="text-sm text-amber-700">{motivo}</p>}
            {!simulando && !simulacion && bloqueadoPorConflicto && (
              <p className="text-sm text-gray-500">Se calcula cuando elijas pasarla, o cuando le quites la línea a quien la lleva.</p>
            )}

            {simulacion && elegido && (
              <div className="space-y-3">
                {diff.length === 0 ? (
                  <p className="p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-600">
                    Nada cambia en {linea.name} con este cambio: la cobertura de las Zonas queda igual.
                  </p>
                ) : (
                  <div className="overflow-x-auto border border-gray-200 rounded-xl">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="px-3 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Zona</th>
                          <th className="px-3 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Hoy</th>
                          <th className="px-3 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Después</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {diff.map(celda => (
                          <tr key={`${celda.line_id}:${celda.kam_id}`} className="align-top">
                            <td className="px-3 py-2 font-medium text-gray-900 whitespace-nowrap">{nombreZona(celda.zona)}</td>
                            <td className="px-3 py-2">
                              <CeldaEstado estado={celda.antesEstado} nombre={celda.antesNombre} />
                            </td>
                            <td className="px-3 py-2">
                              <CeldaEstado estado={celda.despuesEstado} nombre={celda.despuesNombre} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {resumen && (
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-gray-600">Después, en {linea.name}:</span>
                    {ESTADOS_PLAZA.map(estado => (
                      <span key={estado} className={`inline-flex items-center px-2.5 py-1 rounded-lg font-semibold border ${ESTADO_BADGE[estado]}`}>
                        {ESTADO_PLAZA_PLURAL[estado]}: {numero(resumen[estado] ?? 0)}
                      </span>
                    ))}
                  </div>
                )}

                {/* Quitar o pasar: médicos de quien pierde la línea que quedan sin visitante (disparador 0820, sin vuelta atrás) */}
                {pierdeLaLinea && (
                  medicosQuePierden === 0 ? (
                    <p className="text-sm text-gray-600">Ningún médico de {linea.name} tiene a {pierdeLaLinea.nombre} como visitante: nadie queda sin visitante.</p>
                  ) : (
                    <AvisoAtencion>
                      <p className="font-semibold">
                        {medicosQuePierden === null
                          ? `No se pudo contar cuántos médicos de ${linea.name} tienen a ${pierdeLaLinea.nombre} como visitante.`
                          : `${numero(medicosQuePierden)} ${medicosQuePierden === 1 ? 'médico' : 'médicos'} de ${linea.name} ${medicosQuePierden === 1 ? 'tiene' : 'tienen'} a ${pierdeLaLinea.nombre} como visitante.`}
                      </p>
                      <p className="mt-1">
                        Al quitarle la línea {medicosQuePierden === 1 ? 'queda' : 'quedan'} sin visitante hoy mismo y nada lo deshace: habría que reasignarlos desde Terceros.
                      </p>
                      <label className="mt-3 flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={confirmaMedicos}
                          onChange={event => setConfirmaMedicos(event.target.checked)}
                          disabled={guardando}
                          className="mt-0.5 h-4 w-4 rounded border-amber-400 text-gray-900 focus:ring-gray-700"
                        />
                        <span className="text-sm">
                          {medicosQuePierden === null
                            ? `Entiendo que los médicos de ${linea.name} que visita ${pierdeLaLinea.nombre} quedan sin visitante.`
                            : `Entiendo que ${numero(medicosQuePierden)} ${medicosQuePierden === 1 ? 'médico queda' : 'médicos quedan'} sin visitante.`}
                        </span>
                      </label>
                    </AvisoAtencion>
                  )
                )}
              </div>
            )}
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <span className="text-xs text-gray-500">
            {!elegido
              ? 'Elige a quién.'
              : motivo
                ? 'No se puede dar esta línea a esta persona.'
                : bloqueadoPorConflicto
                  ? 'Otra persona de la Zona ya lleva la línea: pásala o quítasela primero.'
                  : !simulacion
                    ? 'Confirmar se habilita cuando termine el cálculo.'
                    : faltaConfirmar
                      ? 'Marca "Entiendo…" para habilitar el botón.'
                      : 'Si esto es lo que quieres, confirma.'}
          </span>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onCerrar} disabled={guardando} className={claseBotonSecundario}>
              Cancelar
            </button>
            <button
              type="button"
              onClick={guardar}
              disabled={!puedeConfirmar}
              title={faltaConfirmar ? 'Marca primero "Entiendo…"' : undefined}
              className={
                modo === 'quitar'
                  ? 'px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed'
                  : claseBotonPrimario
              }
            >
              {guardando ? 'Guardando…' : origen && elegido ? `Pasar ${linea.name} a ${elegido.nombre}` : `${verbo} ${linea.name}`}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

function DetallePersona({
  residente,
  linea,
  lineas,
  mostrarZona,
  bloqueo,
}: {
  residente: ResidenteElegible
  linea: { code: string; name: string }
  lineas: ReadonlyArray<{ code: string; name: string }>
  mostrarZona: boolean
  bloqueo: string | null
}) {
  const lleva = residente.lineas.includes(linea.code)
  const limitada = residente.lineasPermitidas !== null
  return (
    <>
      <span className={`block text-sm font-medium break-words ${bloqueo ? 'text-gray-500' : 'text-gray-900'}`}>
        {residente.nombre}
        {residente.status === 'placeholder' && <span className="ml-1 text-xs font-normal text-amber-700">(por contratar)</span>}
        {mostrarZona && <span className="ml-1 text-xs font-normal text-gray-500">· vive en {residente.zonaNombre}</span>}
      </span>
      <span className={`mt-0.5 block text-xs break-words ${limitada ? 'text-amber-700' : 'text-gray-500'}`}>{textoPuedeTener(residente, lineas)}</span>
      <span className="mt-1 flex flex-wrap items-center gap-1">
        {residente.lineas.length === 0 ? (
          <span className="text-xs text-gray-400">No lleva {linea.name}</span>
        ) : (
          <>
            <span className="text-xs text-gray-500">{lleva ? 'Lleva:' : `No lleva ${linea.name}. Lleva:`}</span>
            {residente.lineas.map(code => (
              <span
                key={code}
                className={`px-2 py-0.5 rounded-full text-xs border ${code === linea.code ? 'bg-gray-900 text-white border-gray-900' : 'bg-gray-100 text-gray-700 border-gray-200'}`}
              >
                {nombreLinea(code, lineas)}
              </span>
            ))}
          </>
        )}
      </span>
      {bloqueo && <span className="mt-1 block text-xs text-amber-700 break-words">{bloqueo}</span>}
    </>
  )
}

function TarjetaPersona(props: Parameters<typeof DetallePersona>[0]) {
  return (
    <div className="p-3 border border-gray-200 rounded-lg bg-gray-50">
      <DetallePersona {...props} />
    </div>
  )
}

function CeldaEstado({ estado, nombre }: { estado: SimularDiffCelda['antesEstado']; nombre: string | null }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border whitespace-nowrap ${ESTADO_BADGE[estado]}`}>
        {ESTADO_PLAZA_LABELS[estado]}
      </span>
      {nombre && <span className="text-sm text-gray-700 break-words">{nombre}</span>}
    </div>
  )
}
